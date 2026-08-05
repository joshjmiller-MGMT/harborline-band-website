// allowed-origins — replaces the blanket `Access-Control-Allow-Origin: "*"` that
// 56 of 58 edge functions were shipping (security finding F9, 2026-08-05).
//
// What this does and does not do:
//   * CORS is a BROWSER policy. It stops other people's web pages from calling
//     these functions with a visitor's credentials. It is not an auth layer —
//     requireOperator / HMAC checks remain the real gate, and curl ignores CORS
//     entirely. This closes the outer wall, nothing more.
//   * Requests with NO Origin header (cron via pg_net, server-to-server, curl)
//     are not browser requests, so no CORS headers are needed and none are sent.
//     That is why converting a function cannot break a scheduled job.
//   * An origin that is not on the list simply gets no Allow-Origin header back.
//     The browser then blocks the response, which is the correct failure mode.
//     We deliberately do not echo an unknown origin, and do not 403 — a 403
//     would also break the no-Origin server callers above.
//
// `Vary: Origin` is required: without it a CDN or browser cache can serve one
// origin's allowed response to a different origin.

const ALLOWED_EXACT = new Set([
  "https://harborlineband.com",
  "https://www.harborlineband.com",
  // gethip.to is a separate domain served by the same Netlify project (smart
  // links / fan landers), not a subdomain of harborlineband.com.
  "https://gethip.to",
  "https://www.gethip.to",
]);

// Local dev (vite) and Netlify deploy previews for the harborline-official site.
const ALLOWED_PATTERNS: RegExp[] = [
  /^http:\/\/localhost:\d{2,5}$/,
  /^http:\/\/127\.0\.0\.1:\d{2,5}$/,
  /^https:\/\/[a-z0-9][a-z0-9-]*--harborline-official\.netlify\.app$/,
  /^https:\/\/harborline-official\.netlify\.app$/,
];

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_EXACT.has(origin)) return true;
  return ALLOWED_PATTERNS.some((re) => re.test(origin));
}

/**
 * CORS headers for this request. Pass the incoming Request.
 * Drop-in replacement for the old module-level `corsHeaders` constant — the one
 * behavioural difference is that it must be called per-request, because the
 * echoed origin depends on the caller.
 */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin as string;
    headers["Access-Control-Max-Age"] = "86400";
  }
  return headers;
}
