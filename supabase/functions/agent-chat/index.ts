// agent-chat — the AI Teammates chat endpoint (Josh 2026-07-12).
//
// Josh talks to a field-expert teammate (Booker/Sonny/Marlo/Frankie/Lou/Libby)
// from /team/members. This fn:
//   1. records Josh's message,
//   2. answers AS the persona (Claude, persona system_prompt from the DB),
//   3. creates agent_jobs rows when Josh assigns actionable work — the
//      orchestrator session executes those and posts results into the log.
//
// Request:  { agent_slug: string, message: string }
// Response: { reply: string, jobs: [{id, title}], agent: {status, current_action} }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "claude-sonnet-4-6";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// One forced tool: the persona replies AND (optionally) creates jobs.
const RESPOND_TOOL = {
  name: "respond",
  description:
    "Reply to Josh as the teammate, and create jobs for any actionable work he assigned.",
  input_schema: {
    type: "object",
    properties: {
      reply: {
        type: "string",
        description:
          "Your chat reply to Josh. Plain, short sentences. If you created jobs, tell him what you queued.",
      },
      jobs_to_create: {
        type: "array",
        description:
          "Jobs Josh assigned in this message (empty if he was just asking/chatting). One job per distinct deliverable.",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short job label, max 70 chars" },
            instruction: {
              type: "string",
              description:
                "Self-contained instruction for the executor: what to produce, where it goes, what done looks like.",
            },
          },
          required: ["title", "instruction"],
        },
      },
    },
    required: ["reply", "jobs_to_create"],
  },
};

const OPERATING_FRAME = `
## How you operate (system context, applies to every teammate)
- You are one of six AI teammates Josh manages from his /team/members page. You chat here; heavy jobs you queue are executed by the orchestrator (a Claude Code session with full tool access) acting as you, and results land back in your log.
- When Josh assigns work, create a job via jobs_to_create and confirm in your reply. When he's just asking a question you can answer from context, answer directly — no job needed.
- Never fabricate facts about Josh's business. If you don't know, say what you'd need to check and queue a job to check it.
- Outbound anything (emails, posts, messages to humans) is DRAFT-ONLY — Josh sends. Money never moves. Destructive changes go to the review queue.
- Josh's style: plain, short sentences. No hype adjectives.
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denialResp = await requireOperator(req);
  if (denialResp) return denialResp;

  try {
    const body = await req.json().catch(() => ({}));
    const slug = typeof body?.agent_slug === "string" ? body.agent_slug.trim() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!slug || !message)
      return jsonResponse({ error: "bad_request", message: "agent_slug and message required" }, 400);

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: agent, error: agentErr } = await db
      .from("agent_teammates")
      .select("*")
      .eq("slug", slug)
      .single();
    if (agentErr || !agent)
      return jsonResponse({ error: "unknown_agent", message: slug }, 404);

    // Record Josh's message first — it's part of the log even if the model call fails.
    await db.from("agent_messages").insert({
      agent_id: agent.id,
      role: "josh",
      kind: "chat",
      body: message,
    });

    // Context: recent conversation + open jobs + recent completed work.
    const { data: recent } = await db
      .from("agent_messages")
      .select("role, kind, body, created_at")
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false })
      .limit(24);
    const { data: openJobs } = await db
      .from("agent_jobs")
      .select("id, title, status, created_at")
      .eq("agent_id", agent.id)
      .in("status", ["queued", "in_progress", "blocked"])
      .order("created_at", { ascending: false })
      .limit(10);
    const { data: doneJobs } = await db
      .from("agent_jobs")
      .select("title, finished_at, result_md")
      .eq("agent_id", agent.id)
      .eq("status", "done")
      .order("finished_at", { ascending: false })
      .limit(5);

    const historyText = (recent || [])
      .reverse()
      .map((m) => `${m.role === "josh" ? "Josh" : agent.name}${m.kind !== "chat" ? ` [${m.kind}]` : ""}: ${m.body}`)
      .join("\n");
    const openJobsText = (openJobs || [])
      .map((j) => `- [${j.status}] ${j.title}`)
      .join("\n") || "(none)";
    const doneJobsText = (doneJobs || [])
      .map((j) => `- ${j.title}${j.result_md ? ` — ${j.result_md.slice(0, 140)}` : ""}`)
      .join("\n") || "(none yet)";

    const systemText = `${agent.system_prompt}\n${OPERATING_FRAME}`;
    const userText = `## Your open jobs\n${openJobsText}\n\n## Recently completed\n${doneJobsText}\n\n## Conversation (oldest first; the last Josh line is the new message to answer)\n${historyText}`;

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: systemText,
        messages: [{ role: "user", content: userText }],
        tools: [RESPOND_TOOL],
        tool_choice: { type: "tool", name: "respond" },
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      console.error("anthropic error", resp.status, detail.slice(0, 500));
      return jsonResponse({ error: "model_error", message: `Anthropic ${resp.status}` }, 502);
    }
    const data = await resp.json();
    const toolUse = (data.content || []).find((c: { type: string }) => c.type === "tool_use");
    const out = (toolUse?.input || {}) as {
      reply?: string;
      jobs_to_create?: { title: string; instruction: string }[];
    };
    const reply = out.reply || "(no reply)";
    const jobsToCreate = Array.isArray(out.jobs_to_create) ? out.jobs_to_create : [];

    // Persist the reply + any jobs.
    await db.from("agent_messages").insert({
      agent_id: agent.id,
      role: "agent",
      kind: "chat",
      body: reply,
    });

    const createdJobs: { id: string; title: string }[] = [];
    for (const j of jobsToCreate.slice(0, 5)) {
      if (!j?.title || !j?.instruction) continue;
      const { data: jobRow } = await db
        .from("agent_jobs")
        .insert({ agent_id: agent.id, title: j.title.slice(0, 200), instruction: j.instruction })
        .select("id, title")
        .single();
      if (jobRow) {
        createdJobs.push(jobRow);
        await db.from("agent_messages").insert({
          agent_id: agent.id,
          job_id: jobRow.id,
          role: "system",
          kind: "action",
          body: `Job queued: ${jobRow.title}`,
        });
      }
    }

    // Surface "what I'm working on" on the card.
    let status = agent.status as string;
    let currentAction = agent.current_action as string | null;
    if (createdJobs.length) {
      status = "working";
      currentAction = `Queued: ${createdJobs[0].title}`;
      await db
        .from("agent_teammates")
        .update({ status, current_action: currentAction, updated_at: new Date().toISOString() })
        .eq("id", agent.id);
    }

    return jsonResponse({
      reply,
      jobs: createdJobs,
      agent: { status, current_action: currentAction },
    });
  } catch (err) {
    console.error("agent-chat error:", err);
    return jsonResponse(
      { error: "agent_chat_failed", message: (err as Error).message },
      500,
    );
  }
});
