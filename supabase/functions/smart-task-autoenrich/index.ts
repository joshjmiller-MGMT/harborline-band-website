// trello-smart-superhighway — recurring auto-enrich pass over claude_action_queue.
//
// THE FORWARD-AUTOMATION HALF of the Trello → SMART superhighway. The ingest
// half is already productionized (trello-route-cards on the
// `trello-route-every-15-min` cron lands every open card in
// `claude_action_queue`). This fn is the missing smartify step: it picks up
// queued claude_action_queue cards that do NOT yet have a
// `smart_task_enrichments` row, runs each through the existing
// `smart-task-rewrite` LLM, and lands the SMART result on the
// `/team/smart-tasks` board — exactly mirroring what `smart-task-queue-drain`
// does for the Urgent `smart_task_queue`, but sourced from claude_action_queue
// so EVERY bucket flows through one smartifyer (the superhighway spec).
//
// What it deliberately does NOT do:
//   - It never mutates claude_action_queue.status. That column is the
//     orchestrator-pickup lifecycle (queued→processed/done) for the
//     website-fix loop; smartify is orthogonal. Idempotency is keyed on the
//     existence of an enrichment row for the card, NOT on queue status — so a
//     card can be both "queued for pickup" and "already smartified".
//   - It does not create work_claims lanes or mark cards done. Lane creation
//     and the mark-done-back-to-Trello sync are separate steps
//     (trigger_trello_mark_done already exists for the latter).
//
// Bucket policy (SMARTIFY_LISTS): only genuine ACTION buckets are smartified.
// Reference/recurring buckets (To Listen to / To Watch / To Learn / Daily's)
// and the Contacts bucket are EXCLUDED — the 2026-06-21 superhighway spec
// carves reference/recurring out of smartify, and Contacts routes to a contact
// board whose destination is still a Josh decision. The allowlist is a single
// constant so it can be tuned without touching the pipeline logic.
//
// Idempotency / re-runnability (hard requirement):
//   1. Candidate query already excludes cards that have an enrichment row.
//   2. The insert is guarded by a partial UNIQUE index on
//      smart_task_enrichments(trello_card_id) (migration
//      20260629xxxxxx_autoenrich_*). A concurrent run that loses the race hits
//      a unique violation, which we treat as "already enriched" (skip, no
//      error). So overlapping cron ticks can never double-insert.
//
// Ops (via ?action= or POST body):
//   - drain    → process up to `limit` candidate cards. Default 10, max 50.
//   - dry-run  → list what WOULD be processed; no writes, no Trello/LLM calls.
//
// Auth: requireOperator()-gated, with the same x-cron-secret bypass
// trello-route-cards uses (cron_secrets.name='trello_route_cron_secret') so the
// pg_cron → trigger_claude_action_smartify() → pg_net caller can invoke it
// without an operator JWT. Service-role JWT also passes (requireOperator).

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

// Trello list names whose cards are SMART-board action tasks. Anything not in
// this set is skipped by the auto-enrich pass (see header — reference/recurring
// buckets + Contacts are intentionally excluded; Urgent is already handled by
// smart-task-queue-drain via smart_task_queue). Lower-cased for case-insensitive
// matching. PENDING JOSH CONFIRM (non-blocking waiting_on_josh) — tune freely.
const SMARTIFY_LISTS = new Set<string>([
  "to claude",
  "website fixes",
  "harborline",
  "econ",
  "bse",
  "web & tech",
  "solo / personal dev / jazz",
  "notes",
  "tasks random",
  "social / media / content",
  "other projects",
  "poc - f/u",
]);

// Canonical board vocab — mirror of src/components/board/smartTaskBuckets.ts
// (the /team/smart-tasks SmartTaskWidget reads these EXACT values; the live DB
// CHECK constraint from PR #151 also enforces them). board_venture ∈
// SMART_VENTURES; board_bucket ∈ {Needs SMART, Pending approval, Active, Done}
// — a kanban column, NEVER the Trello list name.
const SMART_VENTURES = [
  "Harborline",
  "Economy",
  "JMJ",
  "Personal",
  "BSE",
  "Brand Studio",
] as const;
type SmartVenture = (typeof SMART_VENTURES)[number];
const DEFAULT_VENTURE: SmartVenture = "Personal";

// Map a Trello list name to a canonical board_venture, case-insensitively.
// Same mapping as fix/smartify-vocab-at-source's smart-task-queue-drain patch,
// so both smartify paths emit identical vocab. Unknown → Personal.
const VENTURE_ALIASES: Record<string, SmartVenture> = {
  "harborline": "Harborline",
  "website fixes": "Harborline",
  "economy": "Economy",
  "the economy": "Economy",
  "econ": "Economy",
  "jmj": "JMJ",
  "josh miller jazz": "JMJ",
  "solo / personal dev / jazz": "JMJ",
  "personal": "Personal",
  "tasks random": "Personal",
  "notes": "Personal",
  "daily's": "Personal",
  "bse": "BSE",
  "production": "BSE",
  "brand studio": "Brand Studio",
  "social / media / content": "Brand Studio",
  // POC follow-ups + web/tech + misc default to Personal unless the card text
  // says otherwise; the LLM rewrite does not set venture, so list is our signal.
  "tech/ai": "Personal",
};

function mapVenture(listName: string | null | undefined): SmartVenture {
  if (!listName) return DEFAULT_VENTURE;
  const key = listName.trim().toLowerCase();
  const canonical = SMART_VENTURES.find((v) => v.toLowerCase() === key);
  if (canonical) return canonical;
  return VENTURE_ALIASES[key] ?? DEFAULT_VENTURE;
}

// board_bucket = 'Needs SMART' when the rewrite is incomplete (Josh finishes it
// on the board) OR the model asked clarifying questions; else 'Pending
// approval'. Never the list name.
function smartIsComplete(s: SmartRewriteResult): boolean {
  const fieldsFilled = Boolean(
    s.revised_title?.trim() && s.definition_of_done?.trim() && s.measure?.trim(),
  );
  const hasQuestions = Array.isArray(s.clarifying_questions) &&
    s.clarifying_questions.length > 0;
  return fieldsFilled && !hasQuestions;
}

type CandidateCard = {
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
  clarifying_questions?: string[];
};

type EnrichOutcome = {
  trello_card_id: string;
  list_name: string;
  status: "enriched" | "failed" | "skipped_already_enriched";
  enrichment_id?: string;
  board_bucket?: string;
  board_venture?: string;
  google_calendar_event_id?: string;
  gcal_status?: "created" | "skipped_no_due_date" | "skipped_no_account" | "failed";
  due_date?: string | null;
  error?: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Candidate cards: status='queued', in an allowlisted SMART action bucket, and
// WITHOUT an existing enrichment row. We over-fetch queued rows then filter by
// list + enrichment-existence in code (PostgREST has no clean NOT EXISTS; the
// candidate volume is small and capped).
async function loadCandidates(
  supabase: SupabaseClient,
  limit: number,
): Promise<CandidateCard[]> {
  const { data, error } = await supabase
    .from("claude_action_queue")
    .select("trello_card_id, card_name, card_desc, card_url, list_name")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(`load_candidates_failed: ${error.message}`);
  const rows = (data ?? []) as CandidateCard[];

  const inAllowlist = rows.filter((r) =>
    SMARTIFY_LISTS.has((r.list_name ?? "").trim().toLowerCase())
  );
  if (inAllowlist.length === 0) return [];

  // Which of these already have an enrichment? One IN query.
  const ids = inAllowlist.map((r) => r.trello_card_id);
  const { data: existing, error: exErr } = await supabase
    .from("smart_task_enrichments")
    .select("trello_card_id")
    .in("trello_card_id", ids);
  if (exErr) throw new Error(`load_existing_enrichments_failed: ${exErr.message}`);
  const enriched = new Set((existing ?? []).map((e) => e.trello_card_id as string));

  return inAllowlist
    .filter((r) => !enriched.has(r.trello_card_id))
    .slice(0, limit);
}

function rawInputFor(row: CandidateCard): string {
  const title = (row.card_name ?? "").trim();
  const desc = (row.card_desc ?? "").trim();
  return desc ? `${title}\n\n${desc}` : title;
}

// Auth for internal fn-to-fn calls (smart-task-rewrite, google-calendar-events).
// The proven cron pattern (trigger_trello_route): present a real anon JWT as the
// Bearer — which passes the platform gateway AND decodes cleanly in
// requireOperator — plus the x-cron-secret header that the callee's cron bypass
// matches to skip the operator gate. We do NOT use SUPABASE_SERVICE_ROLE_KEY as
// the Bearer: it is now the non-JWT `sb_secret_` format and requireOperator
// throws jwt_decode_failed on it (the bug this fix closes).
type InternalAuth = { anonJwt: string | null; cronSecret: string | null };

function internalHeaders(auth: InternalAuth): Record<string, string> {
  const bearer = auth.anonJwt ?? SUPABASE_SERVICE_ROLE_KEY; // fallback if anon JWT missing
  const h: Record<string, string> = {
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
  };
  if (auth.cronSecret) h["x-cron-secret"] = auth.cronSecret;
  return h;
}

async function callSmartRewrite(
  row: CandidateCard,
  auth: InternalAuth,
): Promise<SmartRewriteResult> {
  const resp = await fetch(`${FUNCTIONS_BASE}/smart-task-rewrite`, {
    method: "POST",
    headers: internalHeaders(auth),
    body: JSON.stringify({
      input: rawInputFor(row),
      card_context: { list: row.list_name },
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`smart_rewrite_${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = await resp.json();
  if (!data?.smart) {
    throw new Error(`smart_rewrite_no_payload: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.smart as SmartRewriteResult;
}

// Returns the new enrichment id, or null if a concurrent run already inserted
// one for this card (unique-violation → treat as already-enriched, no error).
async function insertEnrichment(
  supabase: SupabaseClient,
  row: CandidateCard,
  smart: SmartRewriteResult,
  bucket: string,
  venture: SmartVenture,
): Promise<string | null> {
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
      board_bucket: bucket,
      board_venture: venture,
    })
    .select("id")
    .single();
  if (error) {
    // 23505 = unique_violation on the partial unique index → another run won.
    if ((error as { code?: string }).code === "23505") return null;
    throw new Error(`enrichment_insert_failed: ${error.message}`);
  }
  return data.id as string;
}

type GcalAttemptResult =
  | { ok: true; eventId: string; htmlLink: string }
  | { ok: false; status: "no_due_date" | "no_account" | "failed"; error?: string };

// Mirrors smart-task-queue-drain.createGcalEvent — all-day event on the due
// date, non-fatal if no Google account is connected.
async function createGcalEvent(
  smart: SmartRewriteResult,
  row: CandidateCard,
  auth: InternalAuth,
): Promise<GcalAttemptResult> {
  if (!smart.due_date) return { ok: false, status: "no_due_date" };
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
      // NOTE: google-calendar-events does NOT yet honor x-cron-secret (only
      // requireOperator). This call therefore only succeeds once that fn gets
      // the same bypass — which is the gate for enabling AUTOENRICH_AUTO_GCAL
      // (default off). See the handoff note. A failure here is non-fatal: the
      // enrichment row still lands; only the calendar stamp is skipped.
      headers: internalHeaders(auth),
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
    return { ok: false, status: "failed", error: `gcal_${resp.status}: ${body.slice(0, 200)}` };
  }
  const data = await resp.json();
  if (data?.connected === false) return { ok: false, status: "no_account" };
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
  row: CandidateCard,
  auth: InternalAuth,
): Promise<EnrichOutcome> {
  const venture = mapVenture(row.list_name);

  let smart: SmartRewriteResult;
  try {
    smart = await callSmartRewrite(row, auth);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { trello_card_id: row.trello_card_id, list_name: row.list_name, status: "failed", error: msg };
  }

  const bucket = smartIsComplete(smart) ? "Pending approval" : "Needs SMART";

  let enrichmentId: string | null;
  try {
    enrichmentId = await insertEnrichment(supabase, row, smart, bucket, venture);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { trello_card_id: row.trello_card_id, list_name: row.list_name, status: "failed", error: msg };
  }
  if (enrichmentId === null) {
    return {
      trello_card_id: row.trello_card_id,
      list_name: row.list_name,
      status: "skipped_already_enriched",
    };
  }

  // Calendar event only when the rewrite yielded a concrete due_date AND the
  // task is board-ready (Pending approval). A 'Needs SMART' card is not pinned
  // to the calendar yet — Josh finishes it first.
  let gcalStatus: EnrichOutcome["gcal_status"] = "skipped_no_due_date";
  let gcalEventId: string | undefined;
  // Approval-gated by default (Josh 2026-06-29): autoenrich lands cards as
  // Pending approval WITHOUT a calendar event; gcal happens on approval.
  // Set AUTOENRICH_AUTO_GCAL=true to restore full auto-to-calendar.
  const AUTO_GCAL = (Deno.env.get("AUTOENRICH_AUTO_GCAL") ?? "false") === "true";
  if (AUTO_GCAL && bucket === "Pending approval" && smart.due_date) {
    const gcalRes = await createGcalEvent(smart, row, auth);
    if (gcalRes.ok) {
      try {
        await attachGcalToEnrichment(supabase, enrichmentId, gcalRes.eventId, gcalRes.htmlLink);
        gcalStatus = "created";
        gcalEventId = gcalRes.eventId;
      } catch (_err) {
        // Enrichment landed; only the GCal stamp failed. Non-fatal.
        gcalStatus = "failed";
        gcalEventId = gcalRes.eventId;
      }
    } else {
      gcalStatus = gcalRes.status === "no_account"
        ? "skipped_no_account"
        : gcalRes.status === "failed"
          ? "failed"
          : "skipped_no_due_date";
    }
  }

  return {
    trello_card_id: row.trello_card_id,
    list_name: row.list_name,
    status: "enriched",
    enrichment_id: enrichmentId,
    board_bucket: gcalStatus === "created" ? "Active" : bucket,
    board_venture: venture,
    google_calendar_event_id: gcalEventId,
    gcal_status: gcalStatus,
    due_date: smart.due_date,
  };
}

// Cron-secret bypass — reuse the SAME secret trello-route-cards uses so no new
// secret is required (mirrors trello-route-cards.loadCronSecret).
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

// Anon JWT used as the Bearer on internal fn-to-fn calls (see internalHeaders).
// Lives in public.cron_secrets alongside the cron secret; the working crons use
// the same value.
let cachedAnonJwt: string | null = null;
async function loadAnonJwt(supabase: SupabaseClient): Promise<string | null> {
  if (cachedAnonJwt !== null) return cachedAnonJwt;
  const { data, error } = await supabase
    .from("cron_secrets")
    .select("secret")
    .eq("name", "supabase_anon_jwt")
    .maybeSingle();
  if (error || !data?.secret) return null;
  cachedAnonJwt = data.secret as string;
  return cachedAnonJwt;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const cronSecret = await loadCronSecret(supabase);
  const cronHeader = req.headers.get("x-cron-secret");
  let isCron = false;
  if (cronHeader && cronSecret && constantTimeEquals(cronHeader, cronSecret)) {
    isCron = true;
  }
  if (!isCron) {
    const denial = await requireOperator(req);
    if (denial) return denial;
  }

  // Auth for the internal calls this fn makes (smart-task-rewrite / gcal).
  const internalAuth: InternalAuth = {
    anonJwt: await loadAnonJwt(supabase),
    cronSecret,
  };

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = (
      url.searchParams.get("action") ||
      (typeof body?.action === "string" ? body.action : "") ||
      "drain"
    );
    if (action !== "drain" && action !== "dry-run") {
      return json(400, { error: "unknown_action", action });
    }

    const rawLimit = Number(url.searchParams.get("limit") ?? body?.limit ?? DEFAULT_LIMIT);
    const limit = Math.min(
      Math.max(Number.isFinite(rawLimit) ? rawLimit : DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );

    const candidates = await loadCandidates(supabase, limit);

    if (action === "dry-run") {
      return json(200, {
        mode: "dry-run",
        limit,
        candidate_count: candidates.length,
        candidates: candidates.map((c) => ({
          trello_card_id: c.trello_card_id,
          card_name: c.card_name,
          list_name: c.list_name,
          would_set_board_venture: mapVenture(c.list_name),
        })),
        smartify_lists: [...SMARTIFY_LISTS],
      });
    }

    const outcomes: EnrichOutcome[] = [];
    for (const row of candidates) {
      outcomes.push(await processOne(supabase, row, internalAuth));
    }

    return json(200, {
      mode: "drain",
      limit,
      attempted: candidates.length,
      enriched: outcomes.filter((o) => o.status === "enriched").length,
      failed: outcomes.filter((o) => o.status === "failed").length,
      skipped_already_enriched: outcomes.filter((o) => o.status === "skipped_already_enriched").length,
      gcal_created: outcomes.filter((o) => o.gcal_status === "created").length,
      outcomes,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("smart-task-autoenrich error", msg);
    return json(500, { error: "unhandled", message: msg });
  }
});

