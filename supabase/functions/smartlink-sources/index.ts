// smartlink-sources v2 — auto-discover a release's links on every platform.
// v1 (Odesli only) missed platforms whose links exist but aren't in Odesli's
// graph yet for young releases (Josh 7/22: "apple music links were there, also
// youtube"). v2 is multi-source:
//   1. Odesli resolve on the seed URL
//   2. iTunes Search API direct (fills apple_music by exact title+artist)
//   3. Deezer API direct (fills deezer)
//   4. If new URLs were found, a SECOND Odesli pass seeded with the Apple URL
//      — Odesli's Apple graph often unlocks youtube/youtube_music/amazon.
// All results merged, deduped by platform, seed platform excluded from "new".
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

type Found = Map<string, string>; // our platform key -> url

async function odesli(url: string, into: Found): Promise<{ title?: string; artist?: string }> {
  try {
    const res = await fetch(
      `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}&userCountry=US`,
      { headers: { "User-Agent": "harborline-smartlinks/2.0" } },
    );
    if (!res.ok) return {};
    const data = await res.json();
    for (const [k, ours] of Object.entries(PLATFORM_MAP)) {
      const link = data.linksByPlatform?.[k]?.url;
      if (link && !into.has(ours)) into.set(ours, link);
    }
    const ent = data.entitiesByUniqueId?.[data.entityUniqueId] ?? {};
    return { title: ent.title, artist: ent.artistName };
  } catch {
    return {};
  }
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\(.*?\)|\[.*?\]|- ep\b|- single\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

async function itunesSearch(title: string, artist: string, into: Found) {
  if (into.has("apple_music")) return;
  try {
    const term = encodeURIComponent(`${title} ${artist}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=album&limit=5`);
    if (!res.ok) return;
    const data = await res.json();
    const want = norm(title);
    for (const r of data.results ?? []) {
      if (norm(r.collectionName ?? "").includes(want) || want.includes(norm(r.collectionName ?? ""))) {
        if (r.collectionViewUrl) { into.set("apple_music", r.collectionViewUrl); return; }
      }
    }
  } catch { /* best-effort */ }
}

async function deezerSearch(title: string, artist: string, into: Found) {
  if (into.has("deezer")) return;
  try {
    const res = await fetch(`https://api.deezer.com/search/album?q=${encodeURIComponent(title)}`);
    if (!res.ok) return;
    const data = await res.json();
    const want = norm(title); const wantArtist = norm(artist);
    for (const r of data.data ?? []) {
      if (norm(r.title ?? "") === want && (!wantArtist || norm(r.artist?.name ?? "") === wantArtist)) {
        if (r.link) { into.set("deezer", r.link); return; }
      }
    }
  } catch { /* best-effort */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  try {
    const { url, title, artist } = await req.json();
    if (!url || typeof url !== "string" || !/^https?:\/\//.test(url)) {
      return new Response(JSON.stringify({ error: "url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const found: Found = new Map();
    // Pass 1: Odesli on the seed.
    const meta = await odesli(url, found);
    const useTitle = (typeof title === "string" && title) || meta.title || "";
    const useArtist = (typeof artist === "string" && artist) || meta.artist || "";

    // Pass 2+3: direct platform searches fill Odesli's gaps.
    if (useTitle) {
      await itunesSearch(useTitle, useArtist, found);
      await deezerSearch(useTitle, useArtist, found);
    }

    // Pass 4: re-seed Odesli from the Apple URL — often unlocks YouTube/Amazon.
    const apple = found.get("apple_music");
    if (apple && apple !== url && (!found.has("youtube") || !found.has("youtube_music") || !found.has("amazon_music"))) {
      await odesli(apple, found);
    }

    const sources = [...found.entries()].map(([platform, u]) => ({ platform, url: u }));
    return new Response(JSON.stringify({
      ok: true,
      matched: { title: useTitle || null, artist: useArtist || null },
      sources,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
