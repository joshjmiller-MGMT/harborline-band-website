// P313 — Operator-gated mutate surface for `social_content_queue` and
// `social_workflow_status`. Also mints the anon-readable week-token URL
// consumed by `social-handoff-read`.
//
// Q6 locked → read-only `/team/social-handoff/<week>` URL is the Des handoff
// surface; this fn is the operator-internal surface that feeds it.
//
// Tables are RLS-on with no anon policies; service-role from this fn is the
// only write path. requireOperator() gates every op (service-role bypass is
// preserved for any future cron callers).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";
import { HANDOFF_PEOPLE } from "../_shared/social-people.ts";

// CORS narrowed from "*" to an allowlist 2026-08-05 (finding F9). Headers are
// per-request now because the echoed origin depends on the caller.
import { corsHeadersFor } from "../_shared/allowed-origins.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SOCIAL_HANDOFF_SECRET =
  Deno.env.get("SOCIAL_HANDOFF_SECRET") ?? "p313-default-rotate-me";

const ALLOWED_SLOTS = new Set([
  "tue_post",
  "thu_post",
  "tue_stories",
  "wed_stories",
  "thu_stories",
  "fri_stories",
]);
const ALLOWED_ACCOUNTS = new Set(["personal", "harborline", "economy"]);
const ALLOWED_STATUSES = new Set(["queued", "ready", "published", "skipped"]);
const STATUS_DAY_FLAGS = new Set([
  "mon_prep_done",
  "tue_post_done",
  "tue_stories_done",
  "wed_stories_done",
  "thu_stories_done",
  "thu_post_done",
  "fri_stories_done",
]);

const WEEK_RE = /^\d{4}-W\d{2}$/;

// Factory rather than a module-level closure over corsHeaders: the echoed origin
// varies per caller, so a shared constant would race across concurrent requests.
function makeJson(corsHeaders: Record<string, string>) {
  return (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

// Week-only message keeps pre-existing "whole week" links valid; per-person
// links (media→content people chain, Josh 7/20) bind the person into the HMAC.
async function hmacToken(week: string, person?: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SOCIAL_HANDOFF_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const message = person
    ? `social-handoff:${week}:${person}`
    : `social-handoff:${week}`;
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(sig))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sanitizeAccounts(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((a) => typeof a === "string" && ALLOWED_ACCOUNTS.has(a)))];
}

function sanitizeMediaPaths(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((p) => typeof p === "string" && p.length > 0 && p.length < 500);
}

function sanitizeSlot(input: unknown): string | null {
  if (typeof input !== "string" || !input) return null;
  return ALLOWED_SLOTS.has(input) ? input : null;
}

function sanitizeDate(input: unknown): string | null {
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  return input;
}

Deno.serve(async (req) => {
  // Scoped per-request rather than module-level: the echoed origin varies by
  // caller, so a shared constant would race across concurrent requests.
  const corsHeaders = corsHeadersFor(req);
  const json = makeJson(corsHeaders);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const denial = await requireOperator(req);
  if (denial) return denial;

  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let body: { op?: string; [k: string]: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const op = (body.op as string | undefined) ?? "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (op === "list") {
    const { data, error } = await supabase
      .from("social_content_queue")
      .select("*")
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) return json(500, { error: "list_failed", detail: error.message });
    return json(200, { items: data });
  }

  if (op === "insert") {
    const row = {
      media_paths: sanitizeMediaPaths(body.media_paths),
      caption: typeof body.caption === "string" ? body.caption.slice(0, 5000) : "",
      scheduled_for: sanitizeDate(body.scheduled_for),
      slot: sanitizeSlot(body.slot),
      accounts: sanitizeAccounts(body.accounts),
      status: typeof body.status === "string" && ALLOWED_STATUSES.has(body.status)
        ? body.status
        : "queued",
      assigned_to: typeof body.assigned_to === "string" ? body.assigned_to.slice(0, 100) : "",
      notes: typeof body.notes === "string" ? body.notes.slice(0, 5000) : "",
    };
    const { data, error } = await supabase
      .from("social_content_queue")
      .insert(row)
      .select()
      .single();
    if (error) return json(500, { error: "insert_failed", detail: error.message });
    return json(200, { item: data });
  }

  if (op === "update") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return json(400, { error: "missing_id" });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("media_paths" in body) patch.media_paths = sanitizeMediaPaths(body.media_paths);
    if ("caption" in body) {
      patch.caption =
        typeof body.caption === "string" ? body.caption.slice(0, 5000) : "";
    }
    if ("scheduled_for" in body) patch.scheduled_for = sanitizeDate(body.scheduled_for);
    if ("slot" in body) patch.slot = sanitizeSlot(body.slot);
    if ("accounts" in body) patch.accounts = sanitizeAccounts(body.accounts);
    if ("status" in body && typeof body.status === "string" && ALLOWED_STATUSES.has(body.status)) {
      patch.status = body.status;
    }
    if ("assigned_to" in body && typeof body.assigned_to === "string") {
      patch.assigned_to = body.assigned_to.slice(0, 100);
    }
    if ("notes" in body && typeof body.notes === "string") {
      patch.notes = body.notes.slice(0, 5000);
    }
    const { data, error } = await supabase
      .from("social_content_queue")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) return json(500, { error: "update_failed", detail: error.message });
    return json(200, { item: data });
  }

  if (op === "delete") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return json(400, { error: "missing_id" });
    const { error } = await supabase
      .from("social_content_queue")
      .delete()
      .eq("id", id);
    if (error) return json(500, { error: "delete_failed", detail: error.message });
    return json(200, { ok: true });
  }

  if (op === "mint_handoff_url") {
    const week = typeof body.week === "string" ? body.week : "";
    if (!WEEK_RE.test(week)) {
      return json(400, { error: "invalid_week", detail: "expected YYYY-Www format" });
    }
    const person = typeof body.person === "string" && body.person ? body.person : "";
    if (person && !HANDOFF_PEOPLE.has(person)) {
      return json(400, { error: "invalid_person", detail: "unknown handoff person slug" });
    }
    const token = await hmacToken(week, person || undefined);
    const path = `/team/social-handoff/${week}?t=${token}${person ? `&p=${person}` : ""}`;
    return json(200, { week, person: person || null, token, path });
  }

  if (op === "status_get") {
    const date = sanitizeDate(body.date);
    if (!date) return json(400, { error: "invalid_date" });
    const { data, error } = await supabase
      .from("social_workflow_status")
      .select("*")
      .eq("date", date)
      .maybeSingle();
    if (error) return json(500, { error: "status_get_failed", detail: error.message });
    return json(200, { row: data ?? null });
  }

  if (op === "status_set") {
    const date = sanitizeDate(body.date);
    if (!date) return json(400, { error: "invalid_date" });
    const flag = typeof body.flag === "string" ? body.flag : "";
    if (!STATUS_DAY_FLAGS.has(flag)) return json(400, { error: "invalid_flag" });
    const value = body.value === true;
    const patch: Record<string, unknown> = {
      date,
      [flag]: value,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("social_workflow_status")
      .upsert(patch, { onConflict: "date" })
      .select()
      .single();
    if (error) return json(500, { error: "status_set_failed", detail: error.message });
    return json(200, { row: data });
  }

  return json(400, { error: "unknown_op", op });
});
