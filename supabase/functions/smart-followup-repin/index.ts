// smart-followup-repin — daily driver for recurring follow-ups (the "Caitlyn"
// pattern). A SMART task flagged recurring_followup that still sits in 'Active'
// (i.e. Josh hasn't moved it to Done) gets its calendar block walked forward to
// an open mid-day slot on the management calendar every cadence period, so it
// keeps re-surfacing on today's calendar until it's truly done.
//
// A follow-up is re-surfaced when it has never been surfaced, or when
// (today - followup_last_surfaced_at) >= followup_cadence_days (null → 1/daily).
// Re-pin walks the SAME event forward (google-calendar-events action=update) so
// there's no trail of stale past-day blocks; if the event is missing it creates
// a fresh one. On each re-pin we set due_date=today and stamp
// followup_last_surfaced_at so the dedupe holds within a cadence window.
//
// Moving the card to 'Done' (board_bucket) is the "truly done" signal — done
// rows fall out of the scan, so re-surfacing stops. No separate done flag.
//
// Ops: drain (default) re-pins due follow-ups; dry-run lists what would move.
// Auth: requireOperator()-gated; the daily cron hits it the same way
// smart-task-autoenrich is triggered (anon JWT + x-cron-secret under ALLOW_ANON).
// The internal google-calendar-events call uses the service-role JWT.

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

// Route re-pinned blocks to Josh's MANAGEMENT calendar (his central hub) — same
// target as the SMART queue drainer.
const MGMT_CALENDAR_EMAIL = "joshmillermanagement@gmail.com";

type FollowupRow = {
  id: string;
  revised_title: string | null;
  raw_input: string;
  due_date: string | null;
  effort: string | null;
  definition_of_done: string | null;
  measure: string | null;
  google_calendar_event_id: string | null;
  google_calendar_html_link: string | null;
  followup_cadence_days: number | null;
  followup_last_surfaced_at: string | null;
};

type RepinOutcome = {
  id: string;
  title: string;
  action: "updated" | "created" | "skipped_not_due" | "no_account" | "failed";
  event_id?: string;
  error?: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Cron-secret bypass — mirrors smart-task-autoenrich. The daily pg_cron caller
// presents an anon JWT (which requireOperator rejects) plus the shared
// x-cron-secret; matching that secret authorizes the request without an
// operator JWT. Service-role JWT (internal callers) still passes requireOperator.
let cachedCronSecret: string | null = null;
async function loadCronSecret(supabase: SupabaseClient): Promise<string | null> {
  if (cachedCronSecret !== null) return cachedCronSecret;
  const { data, error } = await supabase
    .from("cron_secrets")
    .select("secret")
    .eq("name", "trello_route_cron_secret")
    .maybeSingle();
  if (error || !data?.secret) return null;
  cachedCronSecret = data.secret as string;
  return cachedCronSecret;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

// Today in America/New_York as YYYY-MM-DD (the calendar day Josh lives in).
function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Whole days from a → b (both YYYY-MM-DD), parsed at UTC midnight.
function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function titleOf(r: FollowupRow): string {
  return (r.revised_title || r.raw_input || "Follow-up").slice(0, 120);
}

// Does this follow-up need re-pinning today? Two guards:
//  1) If it's already scheduled for today or a future day, leave it — it's
//     visible ahead; don't yank it earlier.
//  2) Otherwise (overdue or unscheduled), re-pin, but only once per cadence
//     window (default daily) so we don't move it multiple times a day.
function isDue(r: FollowupRow, today: string): boolean {
  if (r.due_date && r.due_date >= today) return false;
  if (!r.followup_last_surfaced_at) return true;
  const cadence = r.followup_cadence_days && r.followup_cadence_days > 0
    ? r.followup_cadence_days
    : 1;
  return daysBetween(r.followup_last_surfaced_at, today) >= cadence;
}

async function loadOpenFollowups(supabase: SupabaseClient): Promise<FollowupRow[]> {
  const { data, error } = await supabase
    .from("smart_task_enrichments")
    .select(
      "id, revised_title, raw_input, due_date, effort, definition_of_done, measure, google_calendar_event_id, google_calendar_html_link, followup_cadence_days, followup_last_surfaced_at",
    )
    .eq("recurring_followup", true)
    .eq("board_bucket", "Active");
  if (error) throw new Error(`load_followups_failed: ${error.message}`);
  return (data ?? []) as FollowupRow[];
}

function descriptionFor(r: FollowupRow): string {
  return [
    "Recurring follow-up — re-surfaces until moved to Done.",
    r.definition_of_done ? `Definition of done: ${r.definition_of_done}` : null,
    r.measure ? `Measure: ${r.measure}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

// Walk the follow-up's block to an open 30-min slot today. Update the existing
// event if we have one; otherwise create a fresh one.
async function repinOne(
  supabase: SupabaseClient,
  r: FollowupRow,
  today: string,
): Promise<RepinOutcome> {
  const summary = titleOf(r);
  const description = descriptionFor(r);
  const hasEvent = !!r.google_calendar_event_id;
  const path = hasEvent ? "update" : "create";
  const payload: Record<string, unknown> = {
    findSlot: true,
    date: today,
    slotMinutes: 30,
    timeZone: "America/New_York",
    summary,
    description,
  };
  if (hasEvent) payload.eventId = r.google_calendar_event_id;

  let resp: Response;
  try {
    resp = await fetch(
      `${FUNCTIONS_BASE}/google-calendar-events?action=${path}&account=${encodeURIComponent(MGMT_CALENDAR_EMAIL)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
  } catch (err) {
    return { id: r.id, title: summary, action: "failed", error: `fetch_threw: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (!resp.ok) {
    const body = await resp.text();
    // A stale/deleted event id → fall back to creating a fresh one this pass.
    if (hasEvent && (resp.status === 404 || resp.status === 410)) {
      return repinOne(supabase, { ...r, google_calendar_event_id: null }, today);
    }
    return { id: r.id, title: summary, action: "failed", error: `gcal_${resp.status}: ${body.slice(0, 200)}` };
  }

  const data = await resp.json();
  if (data?.connected === false) {
    return { id: r.id, title: summary, action: "no_account" };
  }
  const eventId = data?.event?.id as string | undefined;
  const htmlLink = data?.event?.htmlLink as string | undefined;

  const patch: Record<string, unknown> = {
    due_date: today,
    followup_last_surfaced_at: today,
  };
  if (eventId) patch.google_calendar_event_id = eventId;
  if (htmlLink) patch.google_calendar_html_link = htmlLink;

  const { error: upErr } = await supabase
    .from("smart_task_enrichments")
    .update(patch)
    .eq("id", r.id);
  if (upErr) {
    return { id: r.id, title: summary, action: "failed", event_id: eventId, error: `row_update_failed: ${upErr.message}` };
  }

  return { id: r.id, title: summary, action: hasEvent ? "updated" : "created", event_id: eventId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const cronSecret = await loadCronSecret(supabase);
  const cronHeader = req.headers.get("x-cron-secret");
  const isCron = !!(cronHeader && cronSecret && constantTimeEquals(cronHeader, cronSecret));
  if (!isCron) {
    const denial = await requireOperator(req);
    if (denial) return denial;
  }

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action =
      url.searchParams.get("action") ||
      (typeof body?.action === "string" ? body.action : "") ||
      "drain";
    if (action !== "drain" && action !== "dry-run") {
      return json(400, { error: "unknown_action", action });
    }

    const today = todayET();
    const open = await loadOpenFollowups(supabase);
    const due = open.filter((r) => isDue(r, today));

    if (action === "dry-run") {
      return json(200, {
        mode: "dry-run",
        today,
        open_count: open.length,
        due_count: due.length,
        due: due.map((r) => ({ id: r.id, title: titleOf(r), last_surfaced: r.followup_last_surfaced_at, cadence: r.followup_cadence_days ?? 1 })),
      });
    }

    const outcomes: RepinOutcome[] = [];
    for (const r of due) {
      outcomes.push(await repinOne(supabase, r, today));
    }

    return json(200, {
      mode: "drain",
      today,
      open_count: open.length,
      due_count: due.length,
      updated: outcomes.filter((o) => o.action === "updated").length,
      created: outcomes.filter((o) => o.action === "created").length,
      no_account: outcomes.filter((o) => o.action === "no_account").length,
      failed: outcomes.filter((o) => o.action === "failed").length,
      outcomes,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("smart-followup-repin error", msg);
    return json(500, { error: "unhandled", message: msg });
  }
});
