// tag-visual-asset — Claude vision API auto-suggests structured taxonomy + alt-text +
// caption + venture hints for a freshly-uploaded visual asset. Caller (the team gallery
// page) passes the visual_assets row id; we look up the storage_path, call Claude on the
// public URL, and update the row's ai_suggested_* columns. Caller decides whether to
// surface the suggestions for human approval or auto-apply.
//
// P9 (2026-05-12): tool schema expanded to return kind / people_roles / people_count /
// venue / instruments / location alongside the original tags / alt / caption / ventures.
// Each structured field lands in its own ai_suggested_* column so the asset library UI
// can group/filter on it cleanly; "Apply" in the UI folds the structured fields back
// into the tags array with prefix convention (kind:..., role:..., count:..., venue:...,
// instrument:..., location:...).
//
// People are intentionally NOT named — we return generic role tags (musician, client,
// bridal-party, audience, etc.) and a coarse count bucket, to avoid face-recognition
// hallucination without a real reference set. Named-people recognition is a future phase.

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
  description: "Return structured taxonomy + tags + alt-text + caption + venture hints for the supplied image of a music/band/event-industry asset.",
  input_schema: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: [
          "headshot",
          "press-shot",
          "live-performance",
          "rehearsal",
          "venue-photo",
          "event-photo",
          "behind-the-scenes",
          "studio",
          "promo",
          "logo",
          "screenshot",
          "other",
        ],
        description: "Single best-fit kind. headshot = portrait of a person, face dominant. press-shot = staged promotional band/artist photo. live-performance = performing on stage with audience or stage lighting context. rehearsal = practicing in a non-performance setting. venue-photo = the venue itself (interior/exterior/setup), people incidental or absent. event-photo = candid event coverage (guests, dancing, ceremony) where the focus is the event rather than the band performing. behind-the-scenes = travel / load-in / green room / hangs. studio = recording or production environment. promo = brand graphic, ad, or marketing asset. logo = wordmark or icon. screenshot = computer screen capture. other = none of the above.",
      },
      people_roles: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "musician",
            "vocalist",
            "client",
            "bridal-party",
            "audience",
            "guest",
            "officiant",
            "vendor",
            "staff",
            "child",
            "josh-miller",
            "unknown",
          ],
        },
        description: "Generic role tags for visible people. NOT identifications by name. `josh-miller` is the only exception — only set if a man with a beard appears to be the principal subject of a headshot or solo portrait (the operator); if unsure, omit. `unknown` = people clearly visible but role ambiguous. Empty array if no people are visible.",
      },
      people_count: {
        type: "string",
        enum: ["none", "solo", "duo", "small-group", "large-group"],
        description: "Coarse count bucket. solo = 1, duo = 2, small-group = 3-6, large-group = 7+. none = no people visible.",
      },
      venue: {
        type: "string",
        description: "Venue name if clearly recognizable from signage, architecture, or distinctive features Josh would know (e.g. 'Cylburn Arboretum', 'Pendry Baltimore', 'Gramercy Mansion'). Empty string if not identifiable. Do NOT guess if you can't see clear cues.",
      },
      instruments: {
        type: "array",
        items: { type: "string" },
        description: "Lowercase, singular instrument names visible in the image (e.g. ['piano', 'upright-bass', 'saxophone', 'drum-kit', 'electric-guitar']). Include only what's clearly present, not implied. Empty array if no instruments visible.",
      },
      location: {
        type: "string",
        enum: [
          "indoor-stage",
          "outdoor-stage",
          "ballroom",
          "studio",
          "rehearsal-space",
          "outdoor-event",
          "indoor-event",
          "domestic",
          "transit",
          "office",
          "other",
          "",
        ],
        description: "Generic location category — never an address. Empty string if not determinable.",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "5-12 lowercase short tags. Mix concrete (e.g. 'cocktail-hour', 'bridal-party-portrait', 'first-dance') and conceptual (e.g. 'black-and-white', 'golden-hour', 'press-shot'). No hashes. These supplement the structured fields above — don't duplicate values that already appear in kind / people_roles / instruments / location. Aim for the kinds of search terms Josh would type months later.",
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
    },
    required: [
      "kind",
      "people_roles",
      "people_count",
      "venue",
      "instruments",
      "location",
      "tags",
      "alt_text",
      "caption",
      "ventures",
    ],
  },
};

const SYSTEM_PROMPT = `You are tagging visual assets for Josh Miller's music ventures: Harborline (live wedding/event band, Baltimore), Economy (alt-rock/indie band), Josh Miller Jazz (jazz trio/quartet/quintet), and BSE (Baltimore Sound Entertainment, the live-music umbrella). You're also fine to tag personal headshots and brand-kit graphics.

Goals:
- Produce structured taxonomy fields (kind, people_roles, people_count, venue, instruments, location) Josh can group + filter by months later. This is the primary output — be deliberate.
- ALSO produce supplemental tags that are search-useful (aesthetic, mood, use-case, event sub-type) and that DON'T duplicate the structured fields.
- Alt-text should be plain, factual, accessible — not marketing copy.
- Caption can be slightly evocative but stay factual.
- For ventures, pick all that fit. Most live-show shots will be \`harborline\` and/or \`bse\`. Studio band shots are usually \`economy\` or \`jmj\`. Solo Josh portraits often hit \`personal\`, \`harborline\`, and \`jmj\`.

Hard rules:
- Never name a specific person except \`josh-miller\` (the operator). If you can't identify someone with certainty, use generic role tags (musician, client, bridal-party, etc.) or \`unknown\`.
- Never fabricate venue names — only set \`venue\` if visible signage, architecture, or distinctive features make it obvious.
- Never invent instruments — only what's clearly visible in frame.
- Tags should be lowercase, hyphenated multi-word (e.g. \`black-tie\`, \`cocktail-hour\`).

Respond ONLY by calling the tag_image tool.`;

interface TagImageOutput {
  kind: string;
  people_roles: string[];
  people_count: string;
  venue: string;
  instruments: string[];
  location: string;
  tags: string[];
  alt_text: string;
  caption: string;
  ventures: string[];
}

async function callClaudeVision(imageUrl: string, hint: { filename: string; folder: string }): Promise<TagImageOutput> {
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
  return block.input as TagImageOutput;
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
      ai_suggested_kind: tagged.kind,
      ai_suggested_people_roles: tagged.people_roles,
      ai_suggested_people_count: tagged.people_count,
      ai_suggested_venue: tagged.venue || null,
      ai_suggested_instruments: tagged.instruments,
      ai_suggested_location: tagged.location || null,
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
      updates.tags = buildPrefixedTags(tagged);
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

// Flatten the structured taxonomy + free tags into a single tags array with prefix
// convention. Used for the auto-apply path and mirrored in the UI's Apply button so
// search/filter on the tags column keeps working.
function buildPrefixedTags(t: TagImageOutput): string[] {
  const out: string[] = [];
  if (t.kind) out.push(`kind:${t.kind}`);
  if (t.people_count && t.people_count !== "none") out.push(`count:${t.people_count}`);
  for (const r of t.people_roles || []) out.push(`role:${r}`);
  if (t.venue) out.push(`venue:${slug(t.venue)}`);
  for (const i of t.instruments || []) out.push(`instrument:${i}`);
  if (t.location) out.push(`location:${t.location}`);
  for (const tag of t.tags || []) out.push(tag);
  return Array.from(new Set(out));
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
