// gig-pack-export — turn a resolved gig pack into ONE downloadable zip.
//
// Josh's 7/17-18 spec, phase-2 step 1 (plan: wiki/chart-library/gig-pack-phase2-plan-2026-08.md):
// "setlist in → a folder of all the charts out." The UI already resolves a
// setlist to chart rows; this streams those PDFs out of the PRIVATE `charts`
// bucket with the service role and returns a zip the phone/iPad can import
// straight into forScore.
//
// Entry naming is the whole point — it has to be gig-usable on a music stand:
//   "03 Autumn Leaves/Bb/Autumn Leaves (Bb).pdf"
// Numbered so set order survives alphabetical sorting in every file browser.
//
// Zero new credentials (that's why this ships before the Drive export).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from "https://deno.land/x/zipjs@v2.7.45/index.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function deny(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function b64urlDecode(s: string): string {
  const pad = (4 - (s.length % 4)) % 4;
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
// Operator gate, inlined (mirrors _shared/require-operator) so the function
// bundles cleanly regardless of deploy path.
function requireOperator(req: Request): Response | null {
  if (Deno.env.get("ALLOW_ANON") === "true") return null;
  const ids = (Deno.env.get("OPERATOR_USER_IDS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h?.toLowerCase().startsWith("bearer ")) return deny(401, { error: "unauthorized" });
  try {
    const parts = h.slice(7).trim().split(".");
    if (parts.length !== 3) throw new Error("bad jwt");
    const p = JSON.parse(b64urlDecode(parts[1])) as { sub?: string; role?: string };
    if (p.role === "service_role") return null;
    if (!p.sub || !ids.includes(p.sub)) return deny(403, { error: "forbidden" });
    return null;
  } catch {
    return deny(401, { error: "unauthorized" });
  }
}

// Filesystem-safe, but keep it readable — these names land on Josh's iPad.
const safe = (s: string) =>
  (s || "untitled").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80);

type ChartIn = { storage_path: string; filename?: string; variation?: string };
type SongIn = { song: string; charts: ChartIn[] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denial = requireOperator(req);
  if (denial) return denial;

  let body: { gig_date?: string; songs?: SongIn[] };
  try {
    body = await req.json();
  } catch {
    return deny(400, { error: "bad_json" });
  }
  const songs = Array.isArray(body.songs) ? body.songs : [];
  if (songs.length === 0) return deny(400, { error: "no_songs" });
  const gigDate = (body.gig_date || new Date().toISOString().slice(0, 10)).slice(0, 20);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const zipWriter = new ZipWriter(new BlobWriter("application/zip"));

  let added = 0;
  const missing: string[] = [];

  for (const [i, s] of songs.entries()) {
    const n = String(i + 1).padStart(2, "0");
    const songDir = `${n} ${safe(s.song)}`;
    for (const c of s.charts ?? []) {
      if (!c.storage_path) continue;
      const { data, error } = await db.storage.from("charts").download(c.storage_path);
      if (error || !data) {
        missing.push(`${s.song} — ${c.storage_path}`);
        continue;
      }
      const bytes = new Uint8Array(await data.arrayBuffer());
      const leaf = safe(c.filename || c.storage_path.split("/").pop() || "chart.pdf");
      const dir = c.variation ? `${songDir}/${safe(c.variation)}` : songDir;
      await zipWriter.add(`${dir}/${leaf}`, new Uint8ArrayReader(bytes));
      added++;
    }
  }

  // A pack that silently drops charts is worse than one that says so — the
  // manifest rides along inside the zip.
  const manifest = [
    `Gig pack — ${gigDate}`,
    `${songs.length} songs · ${added} charts`,
    "",
    ...songs.map((s, i) => `${String(i + 1).padStart(2, "0")}. ${s.song} (${(s.charts ?? []).length} charts)`),
    ...(missing.length ? ["", "COULD NOT INCLUDE:", ...missing] : []),
  ].join("\n");
  await zipWriter.add("_manifest.txt", new TextReader(manifest));

  const blob = await zipWriter.close();
  if (added === 0) return deny(404, { error: "no_charts_fetched", missing });

  return new Response(blob.stream(), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="gig-pack-${gigDate}.zip"`,
      "X-Charts-Added": String(added),
      "X-Charts-Missing": String(missing.length),
    },
  });
});
