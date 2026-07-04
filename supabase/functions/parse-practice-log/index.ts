// parse-practice-log — turns a free-text / dictated practice note into the
// structured fields the practice log expects (duration, song, notes, date,
// focus areas). Josh 2026-07: "let me just type or talk a bunch of text about
// what I did and it'll break it down into its information."
//
// Claude tool-use (forced) so the result is always valid structured JSON.
// Operator-gated; the frontend fills the log form with the result for Josh to
// review before saving (human-in-the-loop — we never auto-write a session).
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You extract structured data from a musician's free-text or dictated practice log.
Rules:
- Be faithful. Never invent a duration, song, or detail the text does not state or clearly imply.
- Convert any hours to total minutes (e.g. "an hour and a half" = 90). If no duration is stated, use 0.
- song_of_the_day: the main tune/piece worked on, if one stands out. Empty string if none.
- notes: a concise, clean first-person summary of what was practiced and reflected on. Keep the musician's meaning; drop filler.
- date: only if a specific day is stated or clearly implied. Resolve "today"/"yesterday" against the provided current date. Empty string otherwise.
- focus_areas: short tags for what was worked on (e.g. "comping", "ii-V-I", "left-hand voicings", "sight-reading", "time feel"). Empty array if unclear.`;

const PARSE_TOOL = {
  name: "log_practice",
  description: "Return the structured practice session extracted from the text.",
  input_schema: {
    type: "object",
    properties: {
      total_minutes: {
        type: "integer",
        description: "Total minutes practiced (convert hours→minutes). 0 if not stated.",
      },
      song_of_the_day: {
        type: "string",
        description: "Main song/tune worked on. Empty string if none.",
      },
      notes: {
        type: "string",
        description: "Concise first-person summary of what was practiced.",
      },
      date: {
        type: "string",
        description: "YYYY-MM-DD if a day is stated/implied, else empty string.",
      },
      focus_areas: {
        type: "array",
        items: { type: "string" },
        description: "Short tags for what was worked on.",
      },
    },
    required: ["total_minutes", "song_of_the_day", "notes", "date", "focus_areas"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  try {
    const body = await req.json().catch(() => ({}));
    const text = (body.text || "").toString().trim();
    if (!text) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = (body.today || new Date().toISOString().slice(0, 10)).toString();
    const model = Deno.env.get("PRACTICE_PARSE_MODEL") || "claude-sonnet-4-6";

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: [PARSE_TOOL],
        tool_choice: { type: "tool", name: PARSE_TOOL.name },
        messages: [
          { role: "user", content: `Current date: ${today}\n\nPractice log:\n${text}` },
        ],
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
      return new Response(JSON.stringify({ error: `Anthropic ${resp.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const block = (data.content || []).find(
      (c: { type: string; name?: string }) => c.type === "tool_use" && c.name === PARSE_TOOL.name,
    );
    if (!block) {
      return new Response(JSON.stringify({ error: "no tool_use block returned" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = block.input as {
      total_minutes: number;
      song_of_the_day: string;
      notes: string;
      date: string;
      focus_areas: string[];
    };

    return new Response(JSON.stringify({ parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
