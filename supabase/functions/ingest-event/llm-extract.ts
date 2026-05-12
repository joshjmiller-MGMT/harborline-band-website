// Cut 3 — LLM extraction for Shape W + enrichment for A/B/C/D.
//
// Anthropic Sonnet 4.6 with forced tool_use → guaranteed canonical-event JSON
// shape. The system prompt + tool schema are stable across all calls (no
// timestamps, no per-request IDs, deterministic key order) so the prefix is
// fully cacheable; the user message carries the varying input text.
//
// Pattern mirrors smart-task-rewrite/index.ts (shipped 2026-05-09).

import type {
  CanonicalEventFields,
  ParseResult,
} from "./canonical-event-types.ts";

const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Tool schema mirrors CanonicalEventFields. Field order is alphabetized within
// each object to keep the rendered tool JSON byte-stable across SDK versions /
// dev edits — the cache key is sensitive to key order.
const EXTRACT_TOOL = {
  name: "extract_event",
  description:
    "Extract all event facts you can find in the input text. Use null for fields you cannot determine. Do not invent details. Prefer the most specific value when the same field appears in multiple places.",
  input_schema: {
    type: "object",
    properties: {
      attire: { type: ["string", "null"] },
      client: {
        type: "object",
        description: "Primary client / couple. Preserve titles like Bride / Groom / Partner when given.",
        properties: {
          primary: { type: ["string", "null"] },
          secondary: { type: ["string", "null"] },
          titles: { type: ["array", "null"], items: { type: "string" } },
        },
        required: ["primary", "secondary", "titles"],
        additionalProperties: false,
      },
      contact: {
        type: "object",
        properties: {
          email: { type: ["string", "null"] },
          phone: { type: ["string", "null"] },
        },
        required: ["email", "phone"],
        additionalProperties: false,
      },
      end_date: { type: ["string", "null"], description: "ISO date YYYY-MM-DD for multi-day events; null for single-day." },
      ensemble: { type: ["string", "null"], description: "Ensemble lineup as a short phrase (e.g. 'Trio: piano / bass / drums', '6-piece band')." },
      event_date: { type: ["string", "null"], description: "ISO date YYYY-MM-DD." },
      event_type: {
        type: ["string", "null"],
        description: "wedding-ceremony | wedding-reception | wedding-full | corporate | birthday | country-club | other",
      },
      guests: {
        type: "object",
        properties: {
          arrival_time: { type: ["string", "null"] },
          count: { type: ["integer", "null"] },
          party_arrival_time: { type: ["string", "null"] },
        },
        required: ["arrival_time", "count", "party_arrival_time"],
        additionalProperties: false,
      },
      logistics: {
        type: "object",
        properties: {
          audio_reinforcement: { type: ["string", "null"] },
          end_time: { type: ["string", "null"] },
          entrance: { type: ["string", "null"] },
          green_room: { type: ["string", "null"] },
          load_in: { type: ["string", "null"] },
          musician_meals: { type: ["string", "null"] },
          parking: { type: ["string", "null"] },
          setup_time: { type: ["string", "null"] },
          soundcheck: { type: ["string", "null"] },
          start_time: { type: ["string", "null"] },
        },
        required: [
          "audio_reinforcement", "end_time", "entrance", "green_room", "load_in",
          "musician_meals", "parking", "setup_time", "soundcheck", "start_time",
        ],
        additionalProperties: false,
      },
      organization: {
        type: ["string", "null"],
        description: "harborline | tsb | bse | jmt | jm3 | jm5 | null",
      },
      personnel: {
        type: "array",
        description: "Each entry is one person with a role.",
        items: {
          type: "object",
          properties: {
            email: { type: ["string", "null"] },
            name: { type: "string" },
            phone: { type: ["string", "null"] },
            role: { type: "string" },
          },
          required: ["email", "name", "phone", "role"],
          additionalProperties: false,
        },
      },
      preferences: {
        type: "object",
        properties: {
          do_not_play: { type: ["array", "null"], items: { type: "string" } },
          line_dances: {
            type: ["object", "null"],
            description: "Per dance: yes / no / maybe.",
            additionalProperties: { type: "string", enum: ["yes", "no", "maybe"] },
          },
          must_play: { type: ["array", "null"], items: { type: "string" } },
          posting_notes: { type: ["string", "null"], description: "Free-text instructions about social posting / photography permissions." },
          style_notes: { type: ["string", "null"] },
        },
        required: ["do_not_play", "line_dances", "must_play", "posting_notes", "style_notes"],
        additionalProperties: false,
      },
      song_sections: {
        type: "array",
        description: "Always emit songs sections in chronological event order.",
        items: {
          type: "object",
          properties: {
            songs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  artist: { type: ["string", "null"] },
                  bpm: { type: ["string", "null"] },
                  key: { type: ["string", "null"] },
                  notes: { type: ["string", "null"] },
                  order: { type: ["string", "null"] },
                  patches: { type: ["string", "null"] },
                  request: { type: ["boolean", "null"] },
                  singer: { type: ["string", "null"] },
                  title: { type: ["string", "null"] },
                },
                required: [
                  "artist", "bpm", "key", "notes", "order",
                  "patches", "request", "singer", "title",
                ],
                additionalProperties: false,
              },
            },
            tempo_arc: { type: ["string", "null"] },
            time: { type: ["string", "null"] },
            title: { type: "string" },
            vibe: { type: ["string", "null"] },
          },
          required: ["songs", "tempo_arc", "time", "title", "vibe"],
          additionalProperties: false,
        },
      },
      timeline: {
        type: "array",
        description: "Time-stamped events in chronological order.",
        items: {
          type: "object",
          properties: {
            date: { type: ["string", "null"], description: "ISO date for multi-day; null for single-day rollup." },
            description: { type: "string" },
            location: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
            time: { type: "string" },
            vendor: { type: ["string", "null"] },
          },
          required: ["date", "description", "location", "notes", "time", "vendor"],
          additionalProperties: false,
        },
      },
      vendors: {
        type: "array",
        description: "Vendor companies / contacts mentioned. Preserve Instagram handles when given.",
        items: {
          type: "object",
          properties: {
            company: { type: "string" },
            contact: { type: ["string", "null"] },
            ig_handle: { type: ["string", "null"] },
            type: { type: ["string", "null"] },
          },
          required: ["company", "contact", "ig_handle", "type"],
          additionalProperties: false,
        },
      },
      venue: {
        type: "object",
        properties: {
          address: { type: ["string", "null"] },
          name: { type: ["string", "null"] },
          type: {
            type: ["string", "null"],
            enum: ["indoor", "outdoor", "both", null],
          },
        },
        required: ["address", "name", "type"],
        additionalProperties: false,
      },
      venue_name: { type: ["string", "null"], description: "Duplicate of venue.name for indexability." },
    },
    required: [
      "attire", "client", "contact", "end_date", "ensemble", "event_date", "event_type",
      "guests", "logistics", "organization", "personnel", "preferences",
      "song_sections", "timeline", "vendors", "venue", "venue_name",
    ],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You extract structured event facts from arbitrary documents — narrative run-of-shows, Q&A intake forms, spreadsheets, planner timelines, birthday run sheets, corporate prep notes, anything that mentions an event.

You are part of a doc-generator pipeline for Josh Miller, a Baltimore-based bandleader / music director running multiple ventures (Harborline, BSE — Baltimore Sound Entertainment, The Economy, Josh Miller Jazz / TSB).

Rules:
- Extract every fact present in the input. Use null for fields the input does not mention. Never invent details.
- For two-spouse events (weddings), populate client.primary and client.secondary as separate names, and preserve client.titles like ["Bride", "Groom"] / ["Bride", "Bride"] / ["Groom", "Partner"] when the input states them. If only "David & Erica Hoffman" is given without titles, infer the shared last name forward: primary "David Hoffman", secondary "Erica Hoffman".
- Vendor block: preserve every vendor's Instagram handle (ig_handle) when given. BSE's vendor IG-tag block is load-bearing for downstream social posts.
- Timeline: always emit in chronological order.
- Song sections: always emit in chronological event order (Prelude → Processional → Ceremony → Recessional → Postlude → Cocktail → Dinner → Intros → First Dance → Reception sets → Last Dance).
- Line-dance preferences: yes / no / maybe per dance. Common ones: Electric Slide, Cha Cha Slide, Cupid Shuffle, YMCA, Wobble, Shout, Sweet Caroline.
- Personnel: each instrument or role gets its own entry. Don't pack multiple roles into one entry.
- Dates: emit ISO YYYY-MM-DD. If the input says "3/28/2026" emit "2026-03-28".
- Organization inference: "BSE" / "Baltimore Sound Entertainment" → bse. "Harborline" → harborline. "TSB" / "The Starr Band" → tsb. Otherwise null.
- Do not include fields outside the extract_event tool schema. Do not add commentary.`;

export type LlmExtractOptions = {
  apiKey: string;
  text: string;
  hintShape?: string;
  hintName?: string;
  hintDate?: string;
};

export async function extractCanonicalEvent(
  opts: LlmExtractOptions,
): Promise<ParseResult | null> {
  const { apiKey, text, hintShape, hintName, hintDate } = opts;

  // User message carries all per-request volatile content. The system prompt
  // and tool schema above are byte-stable across calls so the prefix caches.
  const userText = [
    hintName ? `Event name (caller-supplied): ${hintName}` : null,
    hintDate ? `Event date (caller-supplied): ${hintDate}` : null,
    hintShape ? `Suspected shape (detector): ${hintShape}` : null,
    "",
    "Input text:",
    text,
  ].filter((s) => s !== null).join("\n");

  const resp = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
      messages: [{ role: "user", content: userText }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.error("llm-extract anthropic error", resp.status, body);
    return null;
  }

  const data = await resp.json();
  const block = (data.content || []).find(
    (c: { type: string; name?: string }) =>
      c.type === "tool_use" && c.name === EXTRACT_TOOL.name,
  );
  if (!block) {
    console.error("llm-extract: no tool_use block returned", JSON.stringify(data).slice(0, 500));
    return null;
  }

  const fields = stripNulls(block.input) as CanonicalEventFields;
  const warnings: string[] = [];

  const usage = data.usage || {};
  if (usage.cache_read_input_tokens === 0 && usage.cache_creation_input_tokens === 0) {
    warnings.push("llm-extract: prompt cache miss (no cache_creation either — system prompt may be below 2048-token threshold)");
  }

  return {
    shape: "W",
    fields,
    confidence: 0.7,
    warnings,
  };
}

// Strip null leaves so the merge step in index.ts treats them as "no signal"
// rather than overwriting. Keep object/array shapes — empty arrays/objects are
// meaningful ("looked, found none").
function stripNulls(input: unknown): unknown {
  if (input === null || input === undefined) return undefined;
  if (Array.isArray(input)) {
    const arr = input
      .map((v) => stripNulls(v))
      .filter((v) => v !== undefined);
    return arr;
  }
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const cleaned = stripNulls(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return input;
}
