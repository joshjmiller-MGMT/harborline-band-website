// Sub-Plan 02 Feature C — SMART task rewrite via Anthropic
// Takes a free-text task description and returns a structured SMART version
// (revised title + definition of done, measure, blockers, effort, due date).
//
// Pattern mirrors social-ai/index.ts: tool_use for guaranteed JSON shape.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SMART_TOOL = {
  name: "smart_task",
  description:
    "Rewrite a vague task into a SMART (Specific, Measurable, Attainable, Realistic, Time-bound) version.",
  input_schema: {
    type: "object",
    properties: {
      revised_title: {
        type: "string",
        description: "A concise rewrite of the task title (under 12 words). Action-oriented.",
      },
      definition_of_done: {
        type: "string",
        description: "One sentence: what does 'done' actually look like?",
      },
      measure: {
        type: "string",
        description: "How completion is verified — a deliverable, number, or yes/no check.",
      },
      blockers: {
        type: "string",
        description:
          "What might block this, or 'None' if nothing obvious. Inferred from the input — do not invent dependencies.",
      },
      effort: {
        type: "string",
        enum: ["<1hr", "1-4hr", "half-day", "1-3 days", "longer"],
        description: "Rough time estimate.",
      },
      due_date: {
        type: ["string", "null"],
        description:
          "ISO date (YYYY-MM-DD) if the input mentions a deadline; otherwise null. Do not invent a deadline.",
      },
    },
    required: ["revised_title", "definition_of_done", "measure", "blockers", "effort"],
  },
};

const SYSTEM_PROMPT = `You convert vague tasks into SMART tasks for Josh, a Baltimore-based bandleader / music director / operator running multiple ventures (Harborline, BSE, The Economy, Josh Miller Jazz).

Rules:
- Be concrete. Replace "improve X" with verbs that describe the actual change.
- Keep his existing wording when it's already specific. Don't dress up plain language.
- Only include a due_date if the input mentions one (or implies one like "this week" / "by Friday"). Otherwise return null. Do not invent deadlines.
- Blockers should reflect what the input actually mentions — return "None" if nothing is implied.
- Effort: pick the closest bucket. When ambiguous, lean smaller.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { input } = await req.json();
    if (!input || typeof input !== "string" || !input.trim()) {
      return new Response(JSON.stringify({ error: "input (string) required" }), {
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

    const today = new Date().toISOString().slice(0, 10);
    const userText = `Today's date: ${today}\n\nRaw task: ${input.trim()}`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        tools: [SMART_TOOL],
        tool_choice: { type: "tool", name: SMART_TOOL.name },
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
      const body = await resp.text();
      console.error("Anthropic error", resp.status, body);
      return new Response(JSON.stringify({ error: `Anthropic ${resp.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const block = (data.content || []).find(
      (c: { type: string; name?: string }) =>
        c.type === "tool_use" && c.name === SMART_TOOL.name,
    );
    if (!block) {
      return new Response(JSON.stringify({ error: "no tool_use block returned" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ smart: block.input }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("smart-task-rewrite error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
