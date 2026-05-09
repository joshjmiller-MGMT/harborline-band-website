// tag-visual-asset — Claude vision API auto-suggests tags + alt-text + caption + venture
// hints for a freshly-uploaded visual asset. Caller (the team gallery page) passes the
// visual_assets row id; we look up the storage_path, call Claude on the public URL,
// and update the row's ai_suggested_* columns. Caller decides whether to surface the
// suggestions for human approval or auto-apply.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const TOOL = {
  name: "tag_image",
  description: "Return tags, alt-text, caption, and venture hints for the supplied image of a music/band/event-industry asset.",
  input_schema: {
    type: "object",
    properties: {
      tags: {
        type: "array",
        items: { type: "string" },
        description: "5-12 lowercase short tags. Mix concrete (e.g. 'piano', 'cylburn-arboretum', 'bridal-party') and conceptual (e.g. 'cocktail-hour', 'black-and-white', 'press-shot'). No hashes.",
      },
      alt_text: {
        type: "string",
        description: "1-sentence accessible alt text (under 140 chars). Plain description, no marketing voice.",
      },
      caption: {
        type: "string",
        description: "1-sentence editorial caption usable on social or in a press kit. Slightly evocative but factual.",
      },
      ventures: {
        type: "array",
        items: { type: "string", enum: ["harborline", "economy", "jmj", "personal", "bse"] },
        description: "Best-fit ventures for this asset. Empty array if no strong fit.",
      },
      shoot_kind: {
        type: "string",
        enum: ["live-show", "portrait", "rehearsal", "venue", "promo", "behind-the-scenes", "brand-asset", "other"],
        description: "Single best-fit category.",
      },
    },
    required: ["tags", "alt_text", "caption", "ventures", "shoot_kind"],
  },
};

const SYSTEM_PROMPT = `You are tagging visual assets for Josh Miller's music ventures: Harborline (live wedding/event band, Baltimore), Economy (alt-rock/indie band), Josh Miller Jazz (jazz trio/quartet/quintet), and BSE (Baltimore Sound Entertainment, the live-music umbrella). You're also fine to tag personal headshots and brand-kit graphics.

Goals:
- Produce tags Josh can search by months later. Mix subject (instrument, person, location, event-type), aesthetic (lighting, mood, color), and use-case (press-shot, social, web-hero).
- Alt-text should be plain, factual, accessible — not marketing copy.
- Caption can be slightly evocative but stay factual.
- For ventures, pick all that fit. Most live-show shots will be \`harborline\` and/or \`bse\`. Studio band shots are usually \`economy\` or \`jmj\`. Solo Josh portraits often hit \`personal\`, \`harborline\`, and \`jmj\`.
- Tags should be lowercase, hyphenated multi-word (e.g. \`black-tie\`, \`cocktail-hour\`).

Respond ONLY by calling the tag_image tool.`;

async function callClaudeVision(imageUrl: string, hint: { filename: string; folder: string }) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

  const userText =
    `Tag this image. Filename: \`${hint.filename}\`. Storage folder: \`${hint.folder || "(root)"}\`. ` +
    `Use the filename + folder as soft hints (e.g. folder \`shoots/2025-08-pendry\` suggests venue=Pendry, year=2025) but don't fabricate details you can't see in the image itself.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [TOOL],
      tool_choice: { type: "tool", name: "tag_image" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl } },
            { type: "text", text: userText },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${body.slice(0, 500)}`);
  }

  const data = await resp.json();
  const block = (data.content || []).find((c: any) => c.type === "tool_use" && c.name === "tag_image");
  if (!block) throw new Error("Anthropic did not return tag_image tool_use");
  return block.input as {
    tags: string[];
    alt_text: string;
    caption: string;
    ventures: string[];
    shoot_kind: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Supabase env not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const assetId = body?.asset_id as string | undefined;
  if (!assetId) {
    return new Response(JSON.stringify({ error: "asset_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: asset, error: fetchErr } = await supabase
    .from("visual_assets")
    .select("id, filename, folder, storage_path, mime_type")
    .eq("id", assetId)
    .maybeSingle();
  if (fetchErr || !asset) {
    return new Response(JSON.stringify({ error: `asset not found: ${fetchErr?.message ?? "no row"}` }), {
      status: 404,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/visual-assets/${asset.storage_path}`;

  try {
    const tagged = await callClaudeVision(publicUrl, {
      filename: asset.filename,
      folder: asset.folder,
    });

    const updates: Record<string, unknown> = {
      ai_suggested_tags: tagged.tags,
      ai_suggested_alt: tagged.alt_text,
      ai_suggested_caption: tagged.caption,
      ai_processed_at: new Date().toISOString(),
      ai_error: null,
    };

    // First-pass auto-apply: if the row has no human edits yet (empty tags + no alt + no
    // ventures), fill them in so the gallery doesn't look empty. User can always edit.
    const { data: current } = await supabase
      .from("visual_assets")
      .select("tags, alt_text, ventures")
      .eq("id", assetId)
      .maybeSingle();
    const noHumanEdits =
      current &&
      (!current.tags || current.tags.length === 0) &&
      !current.alt_text &&
      (!current.ventures || current.ventures.length === 0);
    if (noHumanEdits) {
      updates.tags = tagged.tags;
      updates.alt_text = tagged.alt_text;
      updates.ventures = tagged.ventures;
    }

    const { error: updErr } = await supabase
      .from("visual_assets")
      .update(updates)
      .eq("id", assetId);
    if (updErr) throw new Error(`update failed: ${updErr.message}`);

    return new Response(
      JSON.stringify({ ok: true, asset_id: assetId, suggestions: tagged, auto_applied: noHumanEdits }),
      { headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("visual_assets")
      .update({ ai_error: msg, ai_processed_at: new Date().toISOString() })
      .eq("id", assetId);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
