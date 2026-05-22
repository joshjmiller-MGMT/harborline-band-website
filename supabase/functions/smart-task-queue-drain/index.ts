// P336 — SMART-task queue drainer.
//
// Pulls `smart_task_queue` rows with status='queued', runs each one through
// the existing `smart-task-rewrite` edge fn (vague → SMART), lands the
// result in `smart_task_enrichments`, and — when the rewrite yields a
// concrete due_date — auto-creates a Google Calendar event via
// `google-calendar-events?action=create` so the task appears on the
// dashboard's UnifiedCalendarWidget as a date-pinned event.
//
// Status lifecycle (smart_task_queue.status):
//   queued     → fresh row, awaiting drain
//   processing → drainer claimed it (in-flight)
//   smartified → SMART rewrite saved; status_notes carries 'gcal_created'
//                (event id in result_artifact) or 'no_due_date' (Josh adds
//                a date in /team/smart-tasks; the existing Save flow there
//                will create the event)
//   failed     → rewrite or downstream write failed; status_notes holds the
//                error message
//
// Ops:
//   - drain    → process up to `limit` queued rows. Default limit=10.
//   - dry-run  → list what would be processed without writing anything.
//
// Auth: requireOperator()-gated. Internal sub-calls (smart-task-rewrite,
// google-calendar-events) use the service-role JWT, which both downstream
// fns accept via the shared require-operator service-role bypass.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_VENTURE = "Personal";

type QueueRow = {
  id: string;
  trello_card_id: string;
  card_name: string;
  card_desc: string | null;
  card_url: string;
  list_name: string;
};

type SmartRewriteResult = {
  revised_title: string;
  definition_of_done: string;
  measure: string;
  blockers: string;
  effort: string;
  due_date: string | null;
};

type DrainOutcome = {
  queue_id: string;
  trello_card_id: string;
  status: "smartified" | "failed" | "skipped_claim_race";
  enrichment_id?: string;
  google_calendar_event_id?: string;
  gcal_status: "created" | "skipped_no_due_date" | "skipped_no_account" | "failed";
  gcal_error?: string;
  due_date?: string | null;
  error?: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function loadQueued(
  supabase: SupabaseClient,
  limit: number,
): Promise<QueueRow[]> {
  const { data, error } = await supabase
    .from("smart_task_queue")
    .select("id, trello_card_id, card_name, card_desc, card_url, list_name")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`load_queued_failed: ${error.message}`);
  return (data ?? []) as QueueRow[];
}

async function claimRow(
  supabase: SupabaseClient,
  queueId: string,
  picker: string,
): Promise<boolean> {
  // Atomic-ish claim: only succeeds if the row is still status='queued'.
  // If another drainer beat us, the UPDATE affects 0 rows and we skip.
  const { error, count } = await supabase
    .from("smart_task_queue")
    .update(
      {
        status: "processing",
        picked_up_at: new Date().toISOString(),
        picked_up_by: picker,
      },
      { count: "exact" },
    )
    .eq("id", queueId)
    .eq("status", "queued");
  if (error) throw new Error(`claim_failed: ${error.message}`);
  return (count ?? 0) === 1;
}

async function markFailed(
  supabase: SupabaseClient,
  queueId: string,
  err: string,
) {
  await supabase
    .from("smart_task_queue")
    .update({
      status: "failed",
      status_notes: err.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq("id", queueId);
}

async function markSmartified(
  supabase: SupabaseClient,
  queueId: string,
  enrichmentId: string,
  notes: string,
) {
  await supabase
    .from("smart_task_queue")
    .update({
      status: "smartified",
      status_notes: notes,
      result_artifact: enrichmentId,
      completed_at: new Date().toISOString(),
    })
    .eq("id", queueId);
}

// Compose the raw_input string that smart-task-rewrite will see. The card
// title alone is usually too terse; appending the description gives the
// model the same context Josh would paste manually.
function rawInputFor(row: QueueRow): string {
  const title = row.card_name.trim();
  const desc = (row.card_desc ?? "").trim();
  return desc ? `${title}\n\n${desc}` : title;
}

async function callSmartRewrite(
  row: QueueRow,
): Promise<SmartRewriteResult> {
  const resp = await fetch(`${FUNCTIONS_BASE}/smart-task-rewrite`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: rawInputFor(row),
      card_context: {
        list: row.list_name,
        // The dispatcher already filters by Trello list; we surface that as
        // the bucket signal. Other fields (labels, checklist, comments) are
        // available on trello_card_routes.raw_card_snapshot but aren't
        // load-bearing for v1 — defer.
      },
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`smart_rewrite_${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = await resp.json();
  if (!data?.smart) throw new Error(`smart_rewrite_no_payload: ${JSON.stringify(data).slice(0, 200)}`);
  return data.smart as SmartRewriteResult;
}

async function insertEnrichment(
  supabase: SupabaseClient,
  row: QueueRow,
  smart: SmartRewriteResult,
): Promise<string> {
  // board_bucket starts at 'Pending approval'. If we successfully create a
  // GCal event afterwards we flip it to 'Active' in a follow-up update.
  const { data, error } = await supabase
    .from("smart_task_enrichments")
    .insert({
      raw_input: rawInputFor(row),
      revised_title: smart.revised_title,
      definition_of_done: smart.definition_of_done,
      measure: smart.measure,
      blockers: smart.blockers,
      effort: smart.effort,
      due_date: smart.due_date,
      trello_card_id: row.trello_card_id,
      trello_card_url: row.card_url,
      board_bucket: "Pending approval",
      board_venture: DEFAULT_VENTURE,
    })
    .select("id")
    .single();
  if (error) throw new Error(`enrichment_insert_failed: ${error.message}`);
  return data.id as string;
}

type GcalAttemptResult =
  | { ok: true; eventId: string; htmlLink: string }
  | { ok: false; status: "no_due_date" | "no_account" | "failed"; error?: string };

async function createGcalEvent(
  smart: SmartRewriteResult,
  row: QueueRow,
): Promise<GcalAttemptResult> {
  if (!smart.due_date) return { ok: false, status: "no_due_date" };

  // Mirror SmartTaskWidget.tsx's createCalendarEvent shape — all-day event
  // spanning the due date in UTC. google-calendar-events normalizes the
  // YYYY-MM-DD start/end for allDay=true.
  const startIso = `${smart.due_date}T00:00:00.000Z`;
  const endIso = `${smart.due_date}T23:59:59.000Z`;
  const description = [
    `Auto-created from Trello "${row.list_name}" card.`,
    `Card: ${row.card_url}`,
    "",
    `Definition of done: ${smart.definition_of_done}`,
    `Measure: ${smart.measure}`,
    smart.blockers && smart.blockers.toLowerCase() !== "none"
      ? `Blockers: ${smart.blockers}`
      : null,
    `Effort: ${smart.effort}`,
  ]
    .filter(Boolean)
    .join("\n");

  let resp: Response;
  try {
    resp = await fetch(`${FUNCTIONS_BASE}/google-calendar-events?action=create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: smart.revised_title,
        description,
        start: startIso,
        end: endIso,
        allDay: true,
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: "failed", error: `fetch_threw: ${msg}` };
  }

  if (!resp.ok) {
    const body = await resp.text();
    return {
      ok: false,
      status: "failed",
      error: `gcal_${resp.status}: ${body.slice(0, 200)}`,
    };
  }
  const data = await resp.json();
  // google-calendar-events returns { connected: false, ... } when no Google
  // account is connected. Treat that as a non-fatal skip — the SMART row
  // still landed; Josh can add a calendar event manually later.
  if (data?.connected === false) {
    return { ok: false, status: "no_account" };
  }
  const eventId = data?.event?.id as string | undefined;
  const htmlLink = data?.event?.htmlLink as string | undefined;
  if (!eventId || !htmlLink) {
    return {
      ok: false,
      status: "failed",
      error: `gcal_response_missing_event_fields: ${JSON.stringify(data).slice(0, 200)}`,
    };
  }
  return { ok: true, eventId, htmlLink };
}

async function attachGcalToEnrichment(
  supabase: SupabaseClient,
  enrichmentId: string,
  eventId: string,
  htmlLink: string,
) {
  const { error } = await supabase
    .from("smart_task_enrichments")
    .update({
      google_calendar_event_id: eventId,
      google_calendar_html_link: htmlLink,
      board_bucket: "Active",
    })
    .eq("id", enrichmentId);
  if (error) throw new Error(`enrichment_gcal_update_failed: ${error.message}`);
}

async function processOne(
  supabase: SupabaseClient,
  row: QueueRow,
  picker: string,
): Promise<DrainOutcome> {
  const claimed = await claimRow(supabase, row.id, picker);
  if (!claimed) {
    return {
      queue_id: row.id,
      trello_card_id: row.trello_card_id,
      status: "skipped_claim_race",
      gcal_status: "skipped_no_due_date",
    };
  }

  let smart: SmartRewriteResult;
  try {
    smart = await callSmartRewrite(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markFailed(supabase, row.id, msg);
    return {
      queue_id: row.id,
      trello_card_id: row.trello_card_id,
      status: "failed",
      gcal_status: "skipped_no_due_date",
      error: msg,
    };
  }

  let enrichmentId: string;
  try {
    enrichmentId = await insertEnrichment(supabase, row, smart);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markFailed(supabase, row.id, msg);
    return {
      queue_id: row.id,
      trello_card_id: row.trello_card_id,
      status: "failed",
      gcal_status: "skipped_no_due_date",
      error: msg,
      due_date: smart.due_date,
    };
  }

  const gcalRes = await createGcalEvent(smart, row);
  let notes: string;
  let outcomeGcalStatus: DrainOutcome["gcal_status"];
  let gcalError: string | undefined;
  let gcalEventId: string | undefined;
  if (gcalRes.ok) {
    try {
      await attachGcalToEnrichment(supabase, enrichmentId, gcalRes.eventId, gcalRes.htmlLink);
    } catch (err) {
      // Enrichment row landed but the GCal stamp didn't. Don't fail the
      // queue row — the SMART data is saved; surface the gap in notes.
      const msg = err instanceof Error ? err.message : String(err);
      notes = `gcal_event_created_but_stamp_failed: ${gcalRes.eventId}; ${msg}`;
      outcomeGcalStatus = "failed";
      gcalError = msg;
      gcalEventId = gcalRes.eventId;
      await markSmartified(supabase, row.id, enrichmentId, notes);
      return {
        queue_id: row.id,
        trello_card_id: row.trello_card_id,
        status: "smartified",
        enrichment_id: enrichmentId,
        google_calendar_event_id: gcalEventId,
        gcal_status: outcomeGcalStatus,
        gcal_error: gcalError,
        due_date: smart.due_date,
      };
    }
    notes = `gcal_created: ${gcalRes.eventId}`;
    outcomeGcalStatus = "created";
    gcalEventId = gcalRes.eventId;
  } else {
    if (gcalRes.status === "no_due_date") notes = "no_due_date";
    else if (gcalRes.status === "no_account") notes = "gcal_skipped_no_account";
    else notes = `gcal_failed: ${gcalRes.error ?? "unknown"}`;
    outcomeGcalStatus = gcalRes.status === "no_due_date"
      ? "skipped_no_due_date"
      : gcalRes.status === "no_account"
        ? "skipped_no_account"
        : "failed";
    gcalError = gcalRes.status === "failed" ? gcalRes.error : undefined;
  }

  await markSmartified(supabase, row.id, enrichmentId, notes);

  return {
    queue_id: row.id,
    trello_card_id: row.trello_card_id,
    status: "smartified",
    enrichment_id: enrichmentId,
    google_calendar_event_id: gcalEventId,
    gcal_status: outcomeGcalStatus,
    gcal_error: gcalError,
    due_date: smart.due_date,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  try {
    const url = new URL(req.url);
    const body = req.method === "POST"
      ? await req.json().catch(() => ({}))
      : {};
    const action = (
      url.searchParams.get("action") ||
      (typeof body?.action === "string" ? body.action : "") ||
      "drain"
    );
    if (action !== "drain" && action !== "dry-run") {
      return json(400, { error: "unknown_action", action });
    }

    const rawLimit = Number(
      url.searchParams.get("limit") ?? body?.limit ?? DEFAULT_LIMIT,
    );
    const limit = Math.min(
      Math.max(Number.isFinite(rawLimit) ? rawLimit : DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const queued = await loadQueued(supabase, limit);

    if (action === "dry-run") {
      return json(200, {
        mode: "dry-run",
        limit,
        queued_count: queued.length,
        queued: queued.map((r) => ({
          queue_id: r.id,
          trello_card_id: r.trello_card_id,
          card_name: r.card_name,
          list_name: r.list_name,
        })),
      });
    }

    const picker = `smart-task-queue-drain:${Date.now()}`;
    const outcomes: DrainOutcome[] = [];
    for (const row of queued) {
      const outcome = await processOne(supabase, row, picker);
      outcomes.push(outcome);
    }

    return json(200, {
      mode: "drain",
      limit,
      attempted: queued.length,
      smartified: outcomes.filter((o) => o.status === "smartified").length,
      failed: outcomes.filter((o) => o.status === "failed").length,
      claim_races: outcomes.filter((o) => o.status === "skipped_claim_race").length,
      gcal_created: outcomes.filter((o) => o.gcal_status === "created").length,
      gcal_skipped_no_due_date: outcomes.filter((o) => o.gcal_status === "skipped_no_due_date" && o.status === "smartified").length,
      gcal_skipped_no_account: outcomes.filter((o) => o.gcal_status === "skipped_no_account").length,
      gcal_failed: outcomes.filter((o) => o.gcal_status === "failed").length,
      outcomes,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("smart-task-queue-drain error", msg);
    return json(500, { error: "unhandled", message: msg });
  }
});
