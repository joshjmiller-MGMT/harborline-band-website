// smartlink-og — server-side Open Graph tags for smart-link landers (2026-07-24).
//
// The problem this solves: the site is a client-rendered React SPA. When a
// smart link is shared to Facebook, iMessage, WhatsApp, Slack, Discord, etc.,
// their crawlers fetch the raw HTML and DO NOT run JavaScript — so the
// per-release <title>/og:image that React-Helmet injects at runtime is never
// seen, and the link preview falls back to the generic Harborline card (no
// artwork, wrong title). For a link whose entire job is to be shared, that's a
// direct hit to click-through.
//
// This edge function intercepts the lander routes, fetches the release row,
// and rewrites the <head> of the served HTML with correct per-release OG tags
// BEFORE it reaches the crawler. Real users still get the identical SPA — only
// the meta tags in <head> change.
//
// Routes handled:
//   - /l/:slug on any host (harborlineband.com/l/... and gethip.to/l/...)
//   - root-level /:slug on the gethip.to short host (gethip.to/blue-house-vol-1)
// Everything else passes straight through untouched.

import type { Context } from "https://edge.netlify.com";

const SUPABASE_URL = "https://mbqyznttpvebahgygsbx.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icXl6bnR0cHZlYmFoZ3lnc2J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTY5MzksImV4cCI6MjA5MzEzMjkzOX0.mecTrCsLrvsL09CzH6d-bNSylwMZuIlegAatWYxCCxY";

// Root paths on the short host that are real app routes, not release slugs.
const RESERVED = new Set(["", "l", "team", "about", "songs", "epk", "faq", "contact", "api", "assets", "favicon.ico"]);

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(req: Request, context: Context) {
  const url = new URL(req.url);
  const host = url.hostname.toLowerCase();
  const isShortHost = /(^|\.)gethip\.to$/.test(host);

  // Resolve the slug from either /l/:slug or (short host only) /:slug.
  let slug: string | null = null;
  if (url.pathname.startsWith("/l/")) {
    slug = url.pathname.slice(3).split("/")[0];
  } else if (isShortHost) {
    const seg = url.pathname.replace(/^\//, "").split("/")[0];
    if (seg && !seg.includes(".") && !RESERVED.has(seg)) slug = seg;
  }
  if (!slug) return; // not a lander — pass through unchanged

  // Look up the release. Anon key + INSERT/SELECT RLS already allow public read.
  let row: any = null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/smart_links?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=title,artist,subtitle,artwork_url&limit=1`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
    );
    if (res.ok) row = (await res.json())[0] ?? null;
  } catch {
    return; // on any lookup error, serve the page as-is
  }
  if (!row) return; // unknown slug — let the SPA render its "not found"

  // Get the real HTML the site would serve, then rewrite its head.
  const response = await context.next();
  const ct = response.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return response;

  let html = await response.text();
  const pageUrl = `https://${host}${url.pathname}`;
  const title = `${row.artist} — ${row.title}`;
  const desc = row.subtitle
    ? `${row.subtitle} · Listen to ${row.title} by ${row.artist}.`
    : `Listen to ${row.title} by ${row.artist}.`;
  const img = row.artwork_url || "https://harborlineband.com/og-image.jpg";

  // Strip the generic OG/twitter/title so crawlers don't see duplicates.
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta[^>]+property="og:[^"]*"[^>]*>/gi, "")
    .replace(/<meta[^>]+name="twitter:[^"]*"[^>]*>/gi, "")
    .replace(/<link[^>]+rel="canonical"[^>]*>/gi, "");

  const tags = `
    <title>${esc(title)}</title>
    <link rel="canonical" href="${esc(pageUrl)}" />
    <meta property="og:type" content="music.song" />
    <meta property="og:site_name" content="${esc(row.artist)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${esc(pageUrl)}" />
    <meta property="og:image" content="${esc(img)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="1200" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <meta name="twitter:image" content="${esc(img)}" />
  `;
  html = html.replace(/<\/head>/i, `${tags}</head>`);

  return new Response(html, {
    status: 200,
    headers: { ...Object.fromEntries(response.headers), "content-type": "text/html; charset=utf-8" },
  });
}

export const config = { path: ["/l/:slug", "/:slug"] };
