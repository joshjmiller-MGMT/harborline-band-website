// P313 — Anon-readable read-only handoff surface for `/team/social-handoff/<week>`.
// Validates a deterministic HMAC week-token before returning the week's queue.
//
// Q6 (b): no Drive permission churn, no SMTP path. The operator UI calls
// `social-queue-mutate` op=mint_handoff_url to issue the URL; the recipient
// opens it on their phone; this fn validates the token and returns the items
// keyed to that ISO week. No mutation surface here.
//
// Per-person links (media→content people chain, Josh 7/20): an optional
// `person` slug is bound into the HMAC and filters items to that assignee.
// Week-only links (no person) keep working and show the whole week.
//
// verify_jwt=false on deploy — this fn is anon-callable. Token check is the
// only authorization gate.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { HANDOFF_PEOPLE } from "../_shared/social-people.ts";

// CORS narrowed from "*" to an allowlist 2026-08-05, wave 3 (finding F9).
// Traced first, because this one is opened by a non-operator on their phone.
// social-queue-mutate op=mint_handoff_url returns a PATH
// (/team/social-handoff/<week>?t=...), not an absolute URL, so the link is
// always opened on whichever frontend origin Josh shares it from. That is the
// same Netlify project either way -- harborlineband.com or gethip.to -- and
// both are on the allowlist, with their www variants and deploy previews.
// The page then calls this fn with supabase.functions.invoke, a browser XHR.
// The HMAC week-token remains the only authorization gate; CORS does not
// change who may read a week, only which pages may ask.
import { corsHeadersFor } from "../_shared/allowed-origins.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SOCIAL_HANDOFF_SECRET =
  Deno.env.get("SOCIAL_HANDOFF_SECRET") ?? "p313-default-rotate-me";

const WEEK_RE = /^\d{4}-W\d{2}$/;

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

// ISO week → { startDate (Mon), endDate (Sun) } inclusive.
function weekRange(week: string): { start: string; end: string } | null {
  const m = week.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const wk = parseInt(m[2], 10);
  // ISO 8601: week 1 contains the first Thursday of the year.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const weekOneMonday = new Date(jan4);
  weekOneMonday.setUTCDate(jan4.getUTCDate() - jan4Dow);
  const start = new Date(weekOneMonday);
  start.setUTCDate(weekOneMonday.getUTCDate() + (wk - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  // Per-request: the echoed origin depends on the caller.
  const corsHeaders = corsHeadersFor(req);
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let body: { week?: string; token?: string; person?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const week = (body.week ?? "").trim();
  const token = (body.token ?? "").trim();
  const person = (body.person ?? "").trim();
  if (!WEEK_RE.test(week)) return json(400, { error: "invalid_week" });
  if (!token) return json(400, { error: "missing_token" });
  if (person && !HANDOFF_PEOPLE.has(person)) {
    return json(400, { error: "invalid_person" });
  }

  const expected = await hmacToken(week, person || undefined);
  if (!constantTimeEq(token, expected)) return json(403, { error: "invalid_token" });

  const range = weekRange(week);
  if (!range) return json(400, { error: "invalid_week_range" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Pull items either scheduled inside the week range OR with no scheduled_for
  // but status='ready' (so "ready but not yet slotted" still surfaces).
  // Per-person links additionally filter to that assignee's items.
  let query = supabase
    .from("social_content_queue")
    .select("id, media_paths, caption, scheduled_for, slot, accounts, status, assigned_to, notes, updated_at")
    .or(
      `and(scheduled_for.gte.${range.start},scheduled_for.lte.${range.end}),and(scheduled_for.is.null,status.eq.ready)`,
    )
    .in("status", ["queued", "ready"]);
  if (person) query = query.eq("assigned_to", person);
  const { data, error } = await query
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: true });

  if (error) {
    return json(500, { error: "read_failed", detail: error.message });
  }

  return json(200, {
    week,
    person: person || null,
    range,
    items: data ?? [],
    public_url_base: `${SUPABASE_URL}/storage/v1/object/public/visual-assets/`,
  });
});
