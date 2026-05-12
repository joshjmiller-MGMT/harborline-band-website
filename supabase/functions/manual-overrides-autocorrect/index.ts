// P6 — Doc-gen v1 manual-overrides autocorrect
// Takes the raw "Label: Value" textarea contents and the active template's
// field list, returns per-line corrections (label snapped to canonical,
// value normalized — title-case names, time/date format).
//
// Pattern mirrors smart-task-rewrite: tool_use for guaranteed JSON shape.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTOCORRECT_TOOL = {
  name: "autocorrect_overrides",
  description:
    "Return corrections for each manual-override line that needs label or value normalization.",
  input_schema: {
    type: "object",
    properties: {
      corrections: {
        type: "array",
        description:
          "One entry per line that needs ANY change. Skip lines that are already correct. Do NOT invent new lines — only correct lines that Josh actually wrote.",
        items: {
          type: "object",
          properties: {
            line_index: {
              type: "integer",
              description: "Zero-based index of the line in the input (matches the numbered list).",
            },
            original_label: {
              type: "string",
              description: "The raw label text from the input line (before the colon).",
            },
            original_value: {
              type: "string",
              description: "The raw value text from the input line (after the colon).",
            },
            corrected_label: {
              type: "string",
              description:
                "Canonical label from the template field list. If the input label maps to none of the template fields, return the input label unchanged.",
            },
            corrected_value: {
              type: "string",
              description:
                "Normalized value. Title-case people/venue names. Times as '4:00 PM' (12-hour with space and uppercase AM/PM). Dates as 'Month D, YYYY' (e.g. 'April 24, 2026'). Otherwise preserve the user's wording.",
            },
            reason: {
              type: "string",
              description:
                "Short tag describing what changed: 'label typo', 'time format', 'date format', 'capitalization', or a combination like 'label + time'.",
            },
          },
          required: [
            "line_index",
            "original_label",
            "original_value",
            "corrected_label",
            "corrected_value",
            "reason",
          ],
        },
      },
    },
    required: ["corrections"],
  },
};

const SYSTEM_PROMPT = `You normalize manual-entry lines from Josh's run-of-show doc generator.

Input: a numbered list of "Label: Value" lines and a list of canonical field labels for the active template.

For each line:
1. Snap the label to the closest canonical template label. This includes:
   - Typos ('setup tim' → 'Setup Time')
   - Abbreviations ('ev type' → 'Event Type')
   - Near-matches and aliases ('on-site POC' → 'Musician POS')
   - **Case-only mismatches** ('guest count' → 'Guest Count', 'attire' → 'Attire'). Always emit a correction if the casing differs from the canonical label, even if nothing else needs to change on the line.
   If the user's label clearly doesn't correspond to any template field, leave the entire line unchanged (don't force a bad match — and don't emit a correction).
2. Normalize the value:
   - Times: '4:00 PM' format (12-hour, uppercase AM/PM, space before AM/PM, leading zero only on minute not hour). Examples: '4pm' → '4:00 PM'; '16:30' → '4:30 PM'; '9 am' → '9:00 AM'.
   - Time ranges (for Start / End, Load-in Time, etc.): same per-side rule with ' - ' separator. '5-9pm' → '5:00 PM - 9:00 PM'.
   - Dates: 'Month D, YYYY'. '4/24/26' → 'April 24, 2026'; 'april 24' (no year) → leave year out: 'April 24'.
   - Names (Client, Coordinator, Officiant, Musician POS, Project Lead, etc.): Title Case. 'john smith' → 'John Smith'.
   - Venue / Venue Address: Title Case for venue name; preserve street address punctuation.
   - Event Type: lowercase or normal case as user wrote, BUT fix obvious typos ('weeding' → 'wedding', 'corp event' → 'corporate event').
   - Numbers (Guest Count): plain integer if a count, otherwise preserve.

Only return a corrections array entry for lines that ACTUALLY need a change. If a line is already in canonical form, skip it (do not include in corrections).

Do NOT invent new lines for fields Josh didn't enter. Your job is normalization, not completion.

Do NOT change a value beyond format normalization. If Josh wrote 'Smith Wedding', do not change it to 'The Smith Wedding'.`;

interface TemplateField {
  label: string;
  key: string;
}

interface Body {
  overrides?: string;
  template_fields?: TemplateField[];
  template_label?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const overrides = (body.overrides || "").trim();
    const templateFields = Array.isArray(body.template_fields) ? body.template_fields : [];

    if (!overrides) {
      return new Response(JSON.stringify({ corrections: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (templateFields.length === 0) {
      return new Response(
        JSON.stringify({ error: "template_fields (non-empty array) required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lines = overrides.split("\n").map((l) => l.trim());
    const numberedLines = lines.map((l, i) => `${i}: ${l}`).join("\n");
    const templateList = templateFields.map((f) => `- ${f.label}`).join("\n");

    const userText = `Active template: ${body.template_label || "run-of-show"}

Canonical field labels for this template:
${templateList}

Manual-entry lines (numbered, zero-based):
${numberedLines}

Return corrections only for lines that need a change. Use line_index to identify each line.`;

    const model = Deno.env.get("AUTOCORRECT_MODEL") || "claude-sonnet-4-6";

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        tools: [AUTOCORRECT_TOOL],
        tool_choice: { type: "tool", name: AUTOCORRECT_TOOL.name },
        messages: [{ role: "user", content: userText }],
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
      (c: { type: string; name?: string }) =>
        c.type === "tool_use" && c.name === AUTOCORRECT_TOOL.name,
    );
    if (!block) {
      return new Response(JSON.stringify({ error: "no tool_use block returned" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        corrections: block.input.corrections || [],
        model,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("manual-overrides-autocorrect error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
