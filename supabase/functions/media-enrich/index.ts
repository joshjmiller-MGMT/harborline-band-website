// media-enrich — slice 2b of the DAM. Takes a locally-generated thumbnail (the
// local enricher reads the file bytes on JARSH — the only machine that can — and
// sends a small JPEG), stores it in the public `media-thumbnails` bucket, runs
// Claude vision to caption + tag + suggest an output lane, and writes it all back
// onto the media_assets row. Keeps all credentialed work (storage, Anthropic key)
// server-side; the local script only ships a thumbnail + the asset id.
//
// Auth: x-cron-secret bypass (like smart-followup-repin) so the local enricher
// can call it with the anon JWT + shared secret; service-role/operator also pass.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const BUCKET = "media-thumbnails";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

let cachedCronSecret: string | null = null;
async function loadCronSecret(supabase: SupabaseClient): Promise<string | null> {
  if (cachedCronSecret !== null) return cachedCronSecret;
  const { data } = await supabase.from("cron_secrets").select("secret").eq("name", "trello_route_cron_secret").maybeSingle();
  cachedCronSecret = (data?.secret as string) ?? null;
  return cachedCronSecret;
}
function ctEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const TOOL = {
  name: "record_media",
  description: "Record the caption, tags, and best output lane for a piece of media in a working musician/bandleader's content library.",
  input_schema: {
    type: "object",
    properties: {
      caption: { type: "string", description: "One concise sentence describing what this is (subjects, setting, action)." },
      tags: { type: "array", items: { type: "string" }, description: "3-8 lowercase keywords: subjects, setting, mood, and what it's usable for." },
      suggested_output: {
        type: "string",
        enum: ["economy-social", "harborline-epk", "harborline-social", "joshjmiller", "youtube", "knowledge", "archive", "none"],
        description: "The single best destination for this asset.",
      },
      quality: { type: "string", enum: ["hero", "good", "usable", "reject"], description: "Rough usability for content." },
    },
    required: ["caption", "tags", "suggested_output"],
  },
};

async function captionWithClaude(thumbB64: string, ctx: { filename: string; venture: string | null; folder: string | null }) {
  const prompt =
    `This media is from ${ctx.venture || "an unknown"} venture, file "${ctx.filename}"` +
    (ctx.folder ? `, in folder "${ctx.folder}".` : ".") +
    ` Caption it for the content library and record it via the tool.`;
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "record_media" },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: thumbB64 } },
          { type: "text", text: prompt },
        ],
      }],
    }),
  });
  if (!resp.ok) throw new Error(`anthropic_${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const tool = (data.content || []).find((c: { type: string }) => c.type === "tool_use");
  if (!tool) throw new Error("no_tool_use_in_response");
  return tool.input as { caption: string; tags: string[]; suggested_output: string; quality?: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const cronSecret = await loadCronSecret(supabase);
  const hdr = req.headers.get("x-cron-secret");
  const isCron = !!(hdr && cronSecret && ctEquals(hdr, cronSecret));
  if (!isCron) {
    const denial = await requireOperator(req);
    if (denial) return denial;
  }

  try {
    const body = await req.json();
    const { asset_id, thumb_b64, filename, venture, folder } = body as {
      asset_id: string; thumb_b64: string; filename: string; venture?: string; folder?: string;
    };
    if (!asset_id || !thumb_b64) return json(400, { error: "asset_id and thumb_b64 required" });

    // 1) store thumbnail
    const bytes = b64ToBytes(thumb_b64);
    const path = `${asset_id}.jpg`;
    const up = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (up.error) throw new Error(`storage_upload: ${up.error.message}`);
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const thumbnail_url = pub.publicUrl;

    // 2) caption + tag
    let ai: { caption: string; tags: string[]; suggested_output: string; quality?: string } | null = null;
    let aiError: string | null = null;
    try {
      ai = await captionWithClaude(thumb_b64, { filename, venture: venture ?? null, folder: folder ?? null });
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
    }

    // 3) write back
    const patch: Record<string, unknown> = { thumbnail_path: thumbnail_url, updated_at: new Date().toISOString() };
    if (ai) {
      patch.ai_caption = ai.caption;
      patch.ai_tags = ai.tags;
      patch.suggested_output = ai.suggested_output;
      if (ai.quality) patch.status_note = `quality:${ai.quality}`;
    }
    const { error: upErr } = await supabase.from("media_assets").update(patch).eq("id", asset_id);
    if (upErr) throw new Error(`row_update: ${upErr.message}`);

    return json(200, { ok: true, thumbnail_url, ai, ai_error: aiError });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("media-enrich error", msg);
    return json(500, { error: "unhandled", message: msg });
  }
});
