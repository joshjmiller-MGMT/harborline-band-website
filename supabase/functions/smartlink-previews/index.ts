// smartlink-previews — pull a release's 30-sec track previews from Apple/iTunes
// so the smart-link lander can play them inline (Josh 7/26, "pull previews from
// Apple" button). Given a title + artist, finds the best-matching album on the
// iTunes Search API and returns its tracks in order, each with Apple's
// previewUrl. Operator-gated; best-effort, read-only (the manager writes the
// result to smart_links.tracks). No fabrication: only real Apple preview URLs.
//
// The operator gate is inlined (not imported from ../_shared) so the function
// bundles cleanly when deployed via the Supabase MCP; it mirrors
// _shared/require-operator.ts exactly. Left inlined on purpose in wave 3 --
// swapping the auth gate is a behaviour change and this pass is about CORS.

// CORS narrowed from "*" to an allowlist 2026-08-05, wave 3 (finding F9).
// Caller check done first: this is NOT called by the public gethip.to lander.
// Its only caller is the operator surface /team/smart-links
// (TeamSmartLinks.tsx, "pull previews from Apple") via
// supabase.functions.invoke -- a browser XHR, so CORS applies.
// Note this import means the function is no longer _shared-free; it is
// deployed with the CLI, which bundles _shared the same way it does for the
// other 52 functions.
import { corsHeadersFor } from "../_shared/allowed-origins.ts";

// Takes `req` because the echoed origin depends on the caller. The denial path
// mattered here: before this change an unauthorised 401/403 still answered "*".
function deny(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeadersFor(req), "Content-Type": "application/json" } });
}
function base64UrlDecode(input: string): string {
  const pad = (4 - (input.length % 4)) % 4;
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
function requireOperator(req: Request): Response | null {
  if (Deno.env.get("ALLOW_ANON") === "true") return null;
  const operatorIds = (Deno.env.get("OPERATOR_USER_IDS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return deny(req, 401, { error: "unauthorized", reason: "missing_bearer" });
  }
  let payload: { sub?: string; role?: string } = {};
  try {
    const parts = authHeader.slice("bearer ".length).trim().split(".");
    if (parts.length !== 3) throw new Error("malformed_jwt");
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch (_err) {
    return deny(req, 401, { error: "unauthorized", reason: "jwt_decode_failed" });
  }
  if (payload.role === "service_role") return null;
  if (!payload.sub || !operatorIds.includes(payload.sub)) {
    return deny(req, 403, { error: "forbidden", reason: "not_an_operator" });
  }
  return null;
}

function norm(s: string): string {
  return (s || "").toLowerCase().replace(/\(.*?\)|\[.*?\]|- ep\b|- single\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
Deno.serve(async (req) => {
  // Per-request: the echoed origin depends on the caller.
  const corsHeaders = corsHeadersFor(req);
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denial = requireOperator(req);
  if (denial) return denial;

  try {
    const { title, artist } = await req.json();
    if (!title || typeof title !== "string") return json({ error: "title required" }, 400);

    const term = encodeURIComponent(`${title} ${artist || ""}`.trim());
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=50`);
    if (!res.ok) return json({ error: `itunes ${res.status}` }, 502);
    const data = await res.json();

    const want = norm(title);
    const wantArtist = norm(artist || "");

    // Group songs by their collection (album), then pick the album whose name
    // (and artist, if given) best matches — so "The Trio at Blue House, Vol. 1"
    // wins over a same-named single or a different artist's cover.
    const byColl = new Map<string, any[]>();
    for (const r of data.results ?? []) {
      if (r.wrapperType !== "track" && r.kind !== "song") continue;
      const key = String(r.collectionId ?? r.collectionName ?? "");
      if (!byColl.has(key)) byColl.set(key, []);
      byColl.get(key)!.push(r);
    }

    let best: any[] | null = null;
    let bestScore = -1;
    for (const [, rows] of byColl) {
      const coll = norm(rows[0].collectionName ?? "");
      const art = norm(rows[0].artistName ?? "");
      let score = 0;
      if (coll === want) score += 3;
      else if (coll.includes(want) || want.includes(coll)) score += 2;
      if (wantArtist && art === wantArtist) score += 2;
      else if (wantArtist && (art.includes(wantArtist) || wantArtist.includes(art))) score += 1;
      if (score > bestScore) { bestScore = score; best = rows; }
    }

    if (!best || bestScore < 2) return json({ ok: true, matched: null, tracks: [] });

    const tracks = best
      .filter((r) => r.previewUrl)
      .sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0))
      .map((r) => ({
        title: r.trackName as string,
        order: (r.trackNumber as number) ?? undefined,
        preview_url: r.previewUrl as string,
      }));

    return json({
      ok: true,
      matched: { collection: best[0].collectionName ?? null, artist: best[0].artistName ?? null },
      tracks,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
