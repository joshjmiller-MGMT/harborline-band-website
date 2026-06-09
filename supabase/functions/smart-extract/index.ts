// smart-extract — freeform → structured run-of-show extraction.
//
// Takes ANY raw pasted text (a rough setlist sheet, an email, copied cells, a
// loose doc) and returns the structured event the doc generator renders:
// details (event fields) + songSections (sets, in order) + timeline + personnel.
// This is the "throw any messy doc at it" path. Reuses the manual-overrides-
// autocorrect pattern: Anthropic Claude Sonnet via tool_use for guaranteed JSON.
//
// Provider is Anthropic only (no Lovable) — same ANTHROPIC_API_KEY as the other
// AI edge fns. Operator-gated like the rest of the doc-gen backend.

import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTRACT_TOOL = {
  name: "extract_event",
  description:
    "Extract structured run-of-show data (event details + setlist + timeline + personnel) from the raw pasted text.",
  input_schema: {
    type: "object",
    properties: {
      details: {
        type: "object",
        description:
          "Event fields that are present or clearly inferable. Use lowercase canonical keys: 'event name', 'event date', 'event type', 'client', 'organization', 'venue', 'venue address', 'guest count', 'setup time', 'start / end', 'load-in time', 'attire', 'coordinator', 'officiant'. ONLY include keys you actually found — omit the rest. Normalize: dates as 'Month D, YYYY' (year omitted if not given), times as '4:00 PM', time ranges as 'X - Y'. Infer modestly from a header like '6/6 MVCC' → event date 'June 6' + venue 'MVCC'.",
        additionalProperties: { type: "string" },
      },
      songSections: {
        type: "array",
        description:
          "The setlist, split into its sets/sections IN PERFORMANCE ORDER. A 'set' is a labeled block of songs (e.g. 'First Set', 'Second Set', 'Final Set', 'Ceremony', 'Cocktail Hour'). Empty array if the text has no songs.",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description:
                "Set/section name. Fix obvious typos ('frist set' → 'First Set'). Title Case.",
            },
            time: {
              type: "string",
              description:
                "Time window for this set if stated (e.g. '6:30 - 8:00 PM'); empty string if none. Include break notes here only if attached to the set.",
            },
            songs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  order: {
                    type: "integer",
                    description: "Position number within the set if the source numbers them; 0 if not.",
                  },
                  title: { type: "string", description: "Song title, cleaned of leading bullets/numbers." },
                  artist: {
                    type: "string",
                    description:
                      "Artist/composer if given, else empty string. Fix ONLY unambiguous spelling typos of well-known acts (e.g. 'Girth Wind & Fire' → 'Earth, Wind & Fire', 'wanki valley' → 'Frankie Valli'); otherwise preserve exactly as written.",
                  },
                  notes: {
                    type: "string",
                    description: "Parenthetical note (arrangement, soloist, 'Stevie Wonder solos', etc.) if any, else empty.",
                  },
                },
                required: ["title", "artist"],
              },
            },
          },
          required: ["title", "songs"],
        },
      },
      timeline: {
        type: "array",
        description:
          "Run-of-show timeline entries if the text has a schedule (load-in, soundcheck, ceremony, etc.). Usually empty for a pure setlist.",
        items: {
          type: "object",
          properties: {
            time: { type: "string", description: "Time, normalized to '4:00 PM'." },
            description: { type: "string", description: "What happens at that time." },
          },
          required: ["time", "description"],
        },
      },
      personnel: {
        type: "array",
        description: "Musicians / staff named in the text, else empty.",
        items: {
          type: "object",
          properties: {
            role: { type: "string" },
            name: { type: "string" },
            department: { type: "string", description: "e.g. 'Band', 'Production', 'Vocals'. Empty if unclear." },
          },
          required: ["role", "name"],
        },
      },
      notes: {
        type: "string",
        description:
          "A one-line note on anything ambiguous, dropped, or assumed during extraction (e.g. 'no event date in source', 'corrected 2 artist typos'). Empty if clean.",
      },
    },
    required: ["details", "songSections", "timeline", "personnel"],
  },
};

const SYSTEM_PROMPT = `You extract structured run-of-show data from rough, messy, pasted input for Josh's band doc generator.

The input can be anything: copied spreadsheet cells, a loose email, a typo-laden setlist, multiple columns smushed together. Your job is to read it like a working musician would and pull out the real structure.

Rules:
- SETLIST: group songs into their sets/sections in the order they're performed. Sets are often labeled ("First Set", "Second Set", "Final"/"Last Set") and may be laid out side-by-side in columns — treat each labeled block as one section. Capture each set's time window if given (e.g. "6:30 - 8:00"). Strip leading bullets/numbers from titles; keep the order number if present.
- SONGS: pull "Title - Artist" or "Title — Artist". If only a title is given, leave artist empty. Put parentheticals (arrangement/soloist notes) in notes. Fix ONLY unambiguous typos of famous acts (e.g. "Girth Wind & Fire" → "Earth, Wind & Fire"); never invent or "improve" a song the user didn't write.
- EVENT FIELDS: pull any event name, date, venue, client, times, guest count, etc. Modestly infer from a header like a sheet title "6/6 MVCC" → date "June 6", venue "MVCC". Don't fabricate fields that aren't there — omit them.
- Normalize dates to "Month D, YYYY" (omit year if absent), times to "4:00 PM", ranges to "X - Y".
- Do NOT hallucinate. If the input is just a setlist with no event info, return songSections populated and details mostly empty. If something is ambiguous or you corrected/dropped anything, say so briefly in notes.`;

interface Body {
  text?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  try {
    const body = (await req.json()) as Body;
    const text = (body.text || "").trim();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "text (non-empty) required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // Guard against pathological pastes — cap input to keep latency/cost sane.
    const wasClipped = text.length > 24000;
    const clipped = wasClipped ? text.slice(0, 24000) : text;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = Deno.env.get("SMART_EXTRACT_MODEL") || "claude-sonnet-4-6";

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        // A big multi-set wedding (setlist + timeline + personnel) can exceed 4096
        // output tokens; truncation there silently drops sets. 8192 gives headroom.
        max_tokens: 8192,
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        tools: [EXTRACT_TOOL],
        tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
        messages: [{ role: "user", content: `Raw input:\n\n${clipped}` }],
      }),
    });

    if (resp.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limited, please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("Anthropic error", resp.status, errBody);
      const lowCredit = /credit balance is too low|Plans\s*&\s*Billing/i.test(errBody);
      const message = lowCredit
        ? "AI extraction is unavailable — the Anthropic API account is out of credits. Add credits at console.anthropic.com → Plans & Billing, then retry."
        : `AI extraction failed (Anthropic ${resp.status}). Try again in a moment.`;
      return new Response(JSON.stringify({ error: message, anthropic_status: resp.status, billing: lowCredit }), {
        status: lowCredit ? 402 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    // If the model hit the output cap, the forced tool_use JSON is cut off — its
    // input is partial (trailing sets/songs silently missing). Surface it.
    const outputTruncated = data.stop_reason === "max_tokens";
    const block = (data.content || []).find(
      (c: { type: string; name?: string }) =>
        c.type === "tool_use" && c.name === EXTRACT_TOOL.name,
    );
    if (!block) {
      return new Response(JSON.stringify({ error: "no tool_use block returned" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const out = block.input as Record<string, unknown>;
    // Surface anything the operator should know about silently-dropped input/output
    // by folding it into `notes` (the UI already shows that field).
    const warnings: string[] = [];
    if (wasClipped) {
      warnings.push(
        `Input was capped at 24,000 characters — the last ${text.length - 24000} were not read; re-run that tail separately if it had more sets.`,
      );
    }
    if (outputTruncated) {
      warnings.push(
        "Extraction hit the output length limit and may be missing the final sets/songs — split the paste into smaller pieces and re-run.",
      );
    }
    const modelNotes = typeof out.notes === "string" ? out.notes : "";
    const notes = [modelNotes, ...warnings].filter(Boolean).join(" — ");

    // Normalize/guard the shape so the frontend can trust it.
    const result = {
      details: (out.details && typeof out.details === "object") ? out.details : {},
      songSections: Array.isArray(out.songSections) ? out.songSections : [],
      timeline: Array.isArray(out.timeline) ? out.timeline : [],
      personnel: Array.isArray(out.personnel) ? out.personnel : [],
      notes,
      truncated: outputTruncated || wasClipped,
      model,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("smart-extract error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
