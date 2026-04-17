// Generates daily best-times-to-post guidance for Instagram & TikTok
// using Lovable AI, synthesizing current public best-practice sources.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a social media analytics expert. Synthesize the most current public best-time-to-post guidance from reputable sources (Later, Buffer, Sprout Social, HubSpot, SocialPilot, Hootsuite — their latest 2025/2026 reports). Return a 7x24 heatmap (0=Sun..6=Sat, hours 0-23 in US Eastern Time) where each cell is an integer 0-100 score representing engagement potential. Also return top 3-5 windows per platform and a short "what changed" note vs typical historical baselines.`;

async function generate(platform: "instagram" | "tiktok") {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not configured");

  const tools = [{
    type: "function",
    function: {
      name: "return_posting_times",
      description: "Return engagement heatmap and top windows.",
      parameters: {
        type: "object",
        properties: {
          heatmap: {
            type: "array",
            description: "7 arrays (Sun..Sat), each with 24 integers 0-100",
            items: { type: "array", items: { type: "integer" } },
          },
          top_windows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                day: { type: "string", description: "e.g. Tuesday" },
                start_hour: { type: "integer", description: "0-23 ET" },
                end_hour: { type: "integer", description: "0-23 ET" },
                rationale: { type: "string" },
              },
              required: ["day", "start_hour", "end_hour", "rationale"],
              additionalProperties: false,
            },
          },
          change_note: { type: "string", description: "1-3 sentence summary of what shifted recently vs older guidance." },
          sources: { type: "array", items: { type: "string" } },
        },
        required: ["heatmap", "top_windows", "change_note", "sources"],
        additionalProperties: false,
      },
    },
  }];

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Give the latest best-times-to-post guidance for ${platform.toUpperCase()} for a US-based music/band/entertainment account targeting US Eastern Time audience. Today is ${new Date().toISOString().slice(0,10)}.` },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "return_posting_times" } },
    }),
  });

  if (resp.status === 429) throw new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (resp.status === 402) throw new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (!resp.ok) throw new Error(`AI error ${resp.status}: ${await resp.text()}`);

  const data = await resp.json();
  const call = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("No tool call returned");
  return JSON.parse(call.function.arguments);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { platforms } = await req.json().catch(() => ({}));
    const list: ("instagram" | "tiktok")[] = platforms?.length ? platforms : ["instagram", "tiktok"];
    const results: Record<string, any> = {};
    for (const p of list) {
      results[p] = await generate(p);
    }
    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("posting-times error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
