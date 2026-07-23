// smartlink-track — Netlify Edge Function at /api/track (2026-07-23).
//
// Why an edge hop for analytics: the lander used to insert smart_link_events
// straight from the browser, which can never see WHERE the fan is. Netlify's
// edge runtime hands us request geolocation for free (country/region/city —
// no external geo API, no per-lookup cost, works identically on
// harborlineband.com and the gethip.to alias since both serve this site).
// Josh 7/23: "id love location tracking."
//
// The client still falls back to a direct (geo-less) insert if this path
// fails — analytics stay best-effort, a fan's click is never blocked.
//
// The Supabase anon key below is the PUBLIC client key (already shipped in
// the site bundle); RLS on smart_link_events allows INSERT only.

import type { Context } from "https://edge.netlify.com";

const SUPABASE_URL = "https://mbqyznttpvebahgygsbx.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icXl6bnR0cHZlYmFoZ3lnc2J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTY5MzksImV4cCI6MjA5MzEzMjkzOX0.mecTrCsLrvsL09CzH6d-bNSylwMZuIlegAatWYxCCxY";

const ALLOWED_KINDS = new Set(["view", "click"]);

export default async function handler(req: Request, context: Context) {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "bad json" }), { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.slice(0, 80) : "";
  const kind = typeof body.kind === "string" ? body.kind : "";
  if (!slug || !ALLOWED_KINDS.has(kind)) {
    return new Response(JSON.stringify({ error: "bad event" }), { status: 400 });
  }
  const s = (v: unknown, max = 300) =>
    typeof v === "string" && v.trim() ? v.slice(0, max) : null;

  const geo = context.geo ?? {};
  const row = {
    slug,
    kind,
    platform: s(body.platform, 80),
    ua: s(req.headers.get("user-agent"), 300),
    referrer: s(body.referrer, 300),
    country: s(geo.country?.name ?? geo.country?.code, 80),
    region: s(geo.subdivision?.name, 80),
    city: s(geo.city, 80),
    utm_source: s(body.utm_source, 120),
    utm_medium: s(body.utm_medium, 120),
    utm_campaign: s(body.utm_campaign, 120),
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/smart_link_events`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });

  return new Response(JSON.stringify({ ok: res.ok }), {
    status: res.ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
}

export const config = { path: "/api/track" };
