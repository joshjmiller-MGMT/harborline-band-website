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
// P21 (2026-05-13): tool schema also returns a `confidence` signal. Low-confidence
// suggestions set review_status='needs-review' (the UI surfaces a Review queue chip);
// high/medium continue current auto-apply-when-empty behavior unchanged.
//
// P310 (2026-05-17): named-people recognition. Roster lives in `band_members`
// (separate table from `brand_collaborators` — see decision record
// `2026-05-13-round-3-q1-q7b-defaults-confirmed.md` Q5). Each active member
// with a reference image at `visual-assets/reference-faces/<id>.jpg` is
// supplied to Claude in a `<people>` block (name + role + base64 reference).
// The model fills `people_names` strictly from the supplied roster — never
// free-text. Empty array when no roster match (legacy generic role tagging
// continues unchanged for non-band-member people).

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

interface BandMember {
  id: string;
  name: string;
  role: string;
  reference_image_path: string;
}

function buildTool(roster: BandMember[]) {
  const rosterNames = roster.map((m) => m.name);
  const peopleNamesDescription = rosterNames.length
    ? `Names of band members from the supplied <people> reference roster who clearly appear in the image. MUST be exactly one of: ${rosterNames.map((n) => `"${n}"`).join(", ")}. Never invent names. Never include people who aren't on the roster (use the generic people_roles field for them). Only list a name if you can match the face against the reference image with high confidence — when in doubt, leave it out.`
    : "Empty array — no band-member roster supplied for this call.";
  return {
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
      people_names: {
        type: "array",
        items: { type: "string" },
        description: peopleNamesDescription,
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
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "Your own confidence in this tagging call as a whole. Use `low` when ANY of these are true: (a) `kind` falls back to `other` or `screenshot` because nothing else fit; (b) `people_roles` includes `unknown`; (c) `venue` is set but you're guessing at the place rather than reading clear cues; (d) the image is genuinely ambiguous between two plausible `kind` values (e.g. press-shot vs. promo, event-photo vs. live-performance); (e) lighting/composition make the subject hard to read. Use `medium` when the call is plausible but you want a human eyeball before it propagates downstream. Use `high` only when the structured fields are unambiguous from what's in frame.",
      },
    },
    required: [
      "kind",
      "people_names",
      "people_roles",
      "people_count",
      "venue",
      "instruments",
      "location",
      "tags",
      "alt_text",
      "caption",
      "ventures",
      "confidence",
    ],
  },
  };
}

const SYSTEM_PROMPT = `You are tagging visual assets for Josh Miller's music ventures: Harborline (live wedding/event band, Baltimore), Economy (alt-rock/indie band), Josh Miller Jazz (jazz trio/quartet/quintet), and BSE (Baltimore Sound Entertainment, the live-music umbrella). You're also fine to tag personal headshots and brand-kit graphics.

Goals:
- Produce structured taxonomy fields (kind, people_roles, people_count, venue, instruments, location) Josh can group + filter by months later. This is the primary output — be deliberate.
- ALSO produce supplemental tags that are search-useful (aesthetic, mood, use-case, event sub-type) and that DON'T duplicate the structured fields.
- Alt-text should be plain, factual, accessible — not marketing copy.
- Caption can be slightly evocative but stay factual.
- For ventures, pick all that fit. Most live-show shots will be \`harborline\` and/or \`bse\`. Studio band shots are usually \`economy\` or \`jmj\`. Solo Josh portraits often hit \`personal\`, \`harborline\`, and \`jmj\`.

Named people (band members):
- When a <people> block follows, each entry is a band-member reference (name + role + reference photo). If the target image clearly shows one of those people, include their name in \`people_names\` (exact spelling from the roster). If you're not confident the face matches, leave them out — false positives are worse than misses.
- \`people_names\` is roster-only: never invent names; never include people who aren't in the supplied <people> block (use the generic \`people_roles\` field for them instead — e.g. clients, audience, vendors).
- The \`josh-miller\` token in \`people_roles\` is independent of \`people_names\`: if Josh is on the roster, list him by name in \`people_names\` AND keep adding the \`josh-miller\` role token if he's the principal subject of a headshot/solo portrait.

Other hard rules:
- Never fabricate venue names — only set \`venue\` if visible signage, architecture, or distinctive features make it obvious.
- Never invent instruments — only what's clearly visible in frame.
- Tags should be lowercase, hyphenated multi-word (e.g. \`black-tie\`, \`cocktail-hour\`).
- Set \`confidence\` honestly — \`low\` routes the asset to a human review queue, which is the right move whenever you fell back to \`other\`/\`screenshot\`, included \`unknown\` in roles, or guessed at a venue. Don't over-claim \`high\`.

Respond ONLY by calling the tag_image tool.`;

interface TagImageOutput {
  kind: string;
  people_names: string[];
  people_roles: string[];
  people_count: string;
  venue: string;
  instruments: string[];
  location: string;
  tags: string[];
  alt_text: string;
  caption: string;
  ventures: string[];
  confidence: "high" | "medium" | "low";
}

interface RosterEntry extends BandMember {
  reference_base64: string;
  reference_media_type: string;
}

async function callClaudeVision(
  imageUrl: string,
  hint: { filename: string; folder: string },
  roster: RosterEntry[],
): Promise<TagImageOutput> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

  const userContent: any[] = [];

  // Roster reference block: one image + label per band member, then the target.
  // Ordering matters — Claude binds the names to the preceding reference photos.
  if (roster.length > 0) {
    userContent.push({
      type: "text",
      text:
        `<people>\nReference roster — these are the only names you may use in \`people_names\`. ` +
        `Each entry below is followed by a reference photo of that person. ` +
        `Match faces against these references; if the target image clearly shows one of them, ` +
        `list the exact name. If unsure, omit.\n</people>`,
    });
    for (const member of roster) {
      userContent.push({
        type: "text",
        text: `Reference — name: "${member.name}" · role: ${member.role}`,
      });
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: member.reference_media_type,
          data: member.reference_base64,
        },
      });
    }
    userContent.push({
      type: "text",
      text: "<target>The image below is the asset to tag. Apply the reference roster above when populating `people_names`.</target>",
    });
  }

  userContent.push({ type: "image", source: { type: "url", url: imageUrl } });
  userContent.push({
    type: "text",
    text:
      `Tag this image. Filename: \`${hint.filename}\`. Storage folder: \`${hint.folder || "(root)"}\`. ` +
      `Use the filename + folder as soft hints (e.g. folder \`shoots/2025-08-pendry\` suggests venue=Pendry, year=2025) but don't fabricate details you can't see in the image itself.`,
  });

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
      tools: [buildTool(roster)],
      tool_choice: { type: "tool", name: "tag_image" },
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${body.slice(0, 500)}`);
  }

  const data = await resp.json();
  const block = (data.content || []).find((c: any) => c.type === "tool_use" && c.name === "tag_image");
  if (!block) throw new Error("Anthropic did not return tag_image tool_use");
  const out = block.input as TagImageOutput;

  // Defense in depth: even with the schema constraint, sanitize people_names
  // to the roster. If the roster is empty, force people_names to [] regardless
  // of what the model returned.
  const rosterNameSet = new Set(roster.map((m) => m.name));
  out.people_names = (out.people_names ?? []).filter((n) => rosterNameSet.has(n));

  return out;
}

async function loadRoster(supabase: ReturnType<typeof createClient>): Promise<RosterEntry[]> {
  const { data, error } = await supabase
    .from("band_members")
    .select("id, name, role, reference_image_path")
    .eq("active", true)
    .not("reference_image_path", "is", null);
  if (error) {
    console.error("loadRoster select failed", error);
    return [];
  }
  const members = (data ?? []) as BandMember[];
  const out: RosterEntry[] = [];
  for (const m of members) {
    try {
      const { data: blob, error: dlErr } = await supabase.storage
        .from("visual-assets")
        .download(m.reference_image_path);
      if (dlErr || !blob) {
        console.warn(`roster download skipped for ${m.name} (${m.reference_image_path}): ${dlErr?.message ?? "no blob"}`);
        continue;
      }
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // base64 encode in chunks to avoid call-stack blowouts on large refs.
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const b64 = btoa(binary);
      const media = blob.type || mediaTypeFromPath(m.reference_image_path);
      out.push({ ...m, reference_base64: b64, reference_media_type: media });
    } catch (e) {
      console.warn(`roster entry ${m.name} failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  return out;
}

function mediaTypeFromPath(p: string): string {
  const lower = p.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

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
    const roster = await loadRoster(supabase);
    const tagged = await callClaudeVision(
      publicUrl,
      { filename: asset.filename, folder: asset.folder },
      roster,
    );

    const updates: Record<string, unknown> = {
      ai_suggested_tags: tagged.tags,
      ai_suggested_alt: tagged.alt_text,
      ai_suggested_caption: tagged.caption,
      ai_suggested_kind: tagged.kind,
      ai_suggested_people_names: tagged.people_names,
      ai_suggested_people_roles: tagged.people_roles,
      ai_suggested_people_count: tagged.people_count,
      ai_suggested_venue: tagged.venue || null,
      ai_suggested_instruments: tagged.instruments,
      ai_suggested_location: tagged.location || null,
      ai_processed_at: new Date().toISOString(),
      ai_error: null,
    };

    // P21: low-confidence suggestions land in the review queue. High/medium continue
    // the existing flow (auto-apply to empty rows, surface for manual Apply otherwise).
    // Note: don't touch review_status for already-reviewed rows on re-run unless the
    // new call comes back low — Fork A default (re-run resets only if confidence
    // re-fires low; otherwise sticky reviewed). See current-row read below.
    const isLowConfidence = tagged.confidence === "low";

    // First-pass auto-apply: if the row has no human edits yet (empty tags + no alt + no
    // ventures), fill them in so the gallery doesn't look empty. User can always edit.
    // Low-confidence suppresses auto-apply — Josh has to Apply from the review queue.
    const { data: current } = await supabase
      .from("visual_assets")
      .select("tags, alt_text, ventures, review_status")
      .eq("id", assetId)
      .maybeSingle();
    const noHumanEdits =
      current &&
      (!current.tags || current.tags.length === 0) &&
      !current.alt_text &&
      (!current.ventures || current.ventures.length === 0);
    const autoApplied = noHumanEdits && !isLowConfidence;
    if (autoApplied) {
      updates.tags = buildPrefixedTags(tagged);
      updates.alt_text = tagged.alt_text;
      updates.ventures = tagged.ventures;
    }

    // review_status transitions (Fork A default — hybrid):
    //   low + (auto | reviewed | needs-review) → 'needs-review'
    //   not-low + reviewed → stay 'reviewed' (Josh's prior call is sticky)
    //   not-low + (auto | needs-review) → 'auto'
    const priorStatus = current?.review_status ?? "auto";
    let nextStatus: string;
    if (isLowConfidence) {
      nextStatus = "needs-review";
    } else if (priorStatus === "reviewed") {
      nextStatus = "reviewed";
    } else {
      nextStatus = "auto";
    }
    updates.review_status = nextStatus;

    const { error: updErr } = await supabase
      .from("visual_assets")
      .update(updates)
      .eq("id", assetId);
    if (updErr) throw new Error(`update failed: ${updErr.message}`);

    return new Response(
      JSON.stringify({
        ok: true,
        asset_id: assetId,
        suggestions: tagged,
        auto_applied: autoApplied,
        confidence: tagged.confidence,
        review_status: nextStatus,
      }),
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
  for (const n of t.people_names || []) out.push(`person:${slug(n)}`);
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
