// P313 — Anon-readable read-only handoff surface for `/team/social-handoff/<week>`.
// Validates a deterministic HMAC week-token before returning the week's queue.
//
// Q6 (b): no Drive permission churn, no SMTP path. The operator UI calls
// `social-queue-mutate` op=mint_handoff_url to issue the URL; Des opens it on
// her phone; this fn validates the token and returns the items keyed to that
// ISO week. No mutation surface here.
//
// verify_jwt=false on deploy — this fn is anon-callable. Token check is the
// only authorization gate.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SOCIAL_HANDOFF_SECRET =
  Deno.env.get("SOCIAL_HANDOFF_SECRET") ?? "p313-default-rotate-me";

const WEEK_RE = /^\d{4}-W\d{2}$/;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacToken(week: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SOCIAL_HANDOFF_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`social-handoff:${week}`),
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let body: { week?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const week = (body.week ?? "").trim();
  const token = (body.token ?? "").trim();
  if (!WEEK_RE.test(week)) return json(400, { error: "invalid_week" });
  if (!token) return json(400, { error: "missing_token" });

  const expected = await hmacToken(week);
  if (!constantTimeEq(token, expected)) return json(403, { error: "invalid_token" });

  const range = weekRange(week);
  if (!range) return json(400, { error: "invalid_week_range" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Pull items either scheduled inside the week range OR with no scheduled_for
  // but status='ready' (so "ready but not yet slotted" still surfaces).
  const { data, error } = await supabase
    .from("social_content_queue")
    .select("id, media_paths, caption, scheduled_for, slot, accounts, status, assigned_to, notes, updated_at")
    .or(
      `and(scheduled_for.gte.${range.start},scheduled_for.lte.${range.end}),and(scheduled_for.is.null,status.eq.ready)`,
    )
    .in("status", ["queued", "ready"])
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: true });

  if (error) {
    return json(500, { error: "read_failed", detail: error.message });
  }

  return json(200, {
    week,
    range,
    items: data ?? [],
    public_url_base: `${SUPABASE_URL}/storage/v1/object/public/visual-assets/`,
  });
});
