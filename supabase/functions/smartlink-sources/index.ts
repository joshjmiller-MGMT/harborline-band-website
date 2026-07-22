// smartlink-sources — auto-discover a release's links on every platform
// (Josh 2026-07-22: "the program should source the links and i decide which
// ones to add by clicking from a list"). Uses the Odesli / song.link public
// API: given ONE known link (e.g. the Spotify album URL), it returns the
// same release on Apple Music, YouTube, Tidal, Amazon, Deezer, Pandora,
// SoundCloud… No API key required.
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Odesli platform ids → our smart-link platform keys (display order preserved
// by the frontend's PLATFORMS catalog).
const PLATFORM_MAP: Record<string, string> = {
  spotify: "spotify",
  appleMusic: "apple_music",
  youtubeMusic: "youtube_music",
  youtube: "youtube",
  bandcamp: "bandcamp",
  soundcloud: "soundcloud",
  amazonMusic: "amazon_music",
  tidal: "tidal",
  deezer: "deezer",
  pandora: "pandora",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string" || !/^https?:\/\//.test(url)) {
      return new Response(JSON.stringify({ error: "url (https link to the release on any platform) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const api = `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}&userCountry=US`;
    const res = await fetch(api, { headers: { "User-Agent": "harborline-smartlinks/1.0" } });
    if (!res.ok) {
      const body = await res.text();
      return new Response(JSON.stringify({ error: `odesli_${res.status}`, detail: body.slice(0, 200) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();

    // Release metadata (nice for confirming the right record was matched).
    const firstEntity = data.entitiesByUniqueId?.[data.entityUniqueId] ?? {};
    const sources: { platform: string; url: string }[] = [];
    for (const [odesliKey, ourKey] of Object.entries(PLATFORM_MAP)) {
      const link = data.linksByPlatform?.[odesliKey]?.url;
      if (link) sources.push({ platform: ourKey, url: link });
    }

    return new Response(JSON.stringify({
      ok: true,
      matched: { title: firstEntity.title ?? null, artist: firstEntity.artistName ?? null },
      page_url: data.pageUrl ?? null, // Odesli's own landing (reference only)
      sources,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
