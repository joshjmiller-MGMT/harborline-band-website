// Sub-Plan 02 Feature C — SMART task rewrite via Anthropic.
// Takes a free-text task description and returns a structured SMART version
// (revised title + definition of done, measure, blockers, effort, due date).
//
// P21: accepts optional `card_context` shaped by trello-poll's enriched poll
// (list bucket, labels, open checklist items, recent comments, age). The
// model is told to weight bucket for urgency, checklist items for
// definition-of-done, and comments for blockers — but the "don't invent
// deadlines" rule still holds.
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
- Effort: pick the closest bucket. When ambiguous, lean smaller.

When card_context is provided (from a Trello card), use it as additional signal — never as the sole source:
- The list (bucket) carries urgency intent. "Urgent" / "Daily's" → near-term; "Notes" / "To Listen to" / "To Watch" / "To Learn" / "POC - F/U" → backlog, likely no deadline. Use this to inform due_date inference only when the card text itself implies a timeframe; do not invent a date purely from the bucket name.
- Open checklist items, when present, are usually the literal definition_of_done — summarize them faithfully rather than paraphrasing them away. The measure can be "all N checklist items checked off" when that fits.
- Recent comments often surface blockers ("waiting on X", "stuck because Y"). Use them. If a comment contradicts the title (e.g. title says "buy ticket" but a comment says "already bought"), surface that in blockers.
- A high age_days on a card sitting in an active bucket suggests it's been deferred — note that as a blocker only if the comments or text imply why.
- Labels are free-form tags Josh applies; treat them as context only.`;

type CardContext = {
  list?: string | null;
  labels?: string[];
  checklist_open?: string[];
  recent_comments?: string[];
  age_days?: number | null;
  due?: string | null;
};

function formatCardContext(ctx: CardContext): string {
  const lines: string[] = ["", "Card context (from Trello):"];
  if (ctx.list) lines.push(`- Bucket: ${ctx.list}`);
  if (ctx.labels && ctx.labels.length > 0) lines.push(`- Labels: ${ctx.labels.join(", ")}`);
  if (ctx.due) lines.push(`- Due date on card: ${ctx.due}`);
  if (typeof ctx.age_days === "number" && ctx.age_days > 0) {
    lines.push(`- Age on board: ${ctx.age_days} days since last activity`);
  }
  if (ctx.checklist_open && ctx.checklist_open.length > 0) {
    lines.push(`- Open checklist items:`);
    for (const item of ctx.checklist_open) lines.push(`    • ${item}`);
  }
  if (ctx.recent_comments && ctx.recent_comments.length > 0) {
    lines.push(`- Recent comments (most recent first):`);
    for (const c of ctx.recent_comments) lines.push(`    > ${c}`);
  }
  return lines.length > 2 ? lines.join("\n") : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { input, card_context } = await req.json();
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
    const contextBlock =
      card_context && typeof card_context === "object"
        ? formatCardContext(card_context as CardContext)
        : "";
    const userText = `Today's date: ${today}\n\nRaw task: ${input.trim()}${contextBlock}`;

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
