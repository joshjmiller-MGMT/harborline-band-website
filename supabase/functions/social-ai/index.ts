// Social Media AI helper: generates post ideas from a source, or per-platform captions for a post.
// Ported from Lovable AI gateway to direct Anthropic Messages API (Claude Sonnet 4.6).

import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BRAND_VOICE: Record<string, string> = {
  harborline:
    "Harborline is Baltimore's go-to top-rated live band for weddings, corporate galas, and high-end private events. Polished, classy, modern, celebratory. Third person. Never use 'award-winning'.",
  "the-economy":
    "The Economy is a high-energy party/cover band — fun, witty, a little irreverent, made for breweries, festivals, and dance floors. Casual, punchy, playful.",
  solo: "Josh Miller solo — acoustic singer-songwriter vibe. Intimate, warm, personal. First-person OK. Cafés, restaurants, weddings ceremonies, cocktail hours.",
};

const PLATFORM_GUIDANCE: Record<string, string> = {
  instagram:
    "Instagram caption: 1-3 short paragraphs, scannable, 1 strong hook line, end with 5-10 relevant hashtags on a new line.",
  tiktok:
    "TikTok caption: 1-2 punchy lines max, hook-driven, 3-5 trending-style hashtags inline.",
  facebook:
    "Facebook caption: slightly longer/warmer than IG, conversational, can include a CTA link placeholder, no hashtags.",
  youtube_shorts:
    "YouTube Shorts caption: title-style first line (hook), 1-2 sentence description, 3-5 hashtags inline, no link.",
};

const IDEAS_TOOL = {
  name: "return_ideas",
  description: "Return social media post ideas for the source.",
  input_schema: {
    type: "object",
    properties: {
      ideas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short internal title (max 60 chars)" },
            angle: { type: "string", description: "1-2 sentence hook/angle" },
          },
          required: ["title", "angle"],
        },
      },
    },
    required: ["ideas"],
  },
};

function captionsTool(plats: string[]) {
  const props: Record<string, any> = {};
  for (const p of plats) {
    props[p] = { type: "string", description: PLATFORM_GUIDANCE[p] ?? `Caption for ${p}` };
  }
  return {
    name: "return_captions",
    description: "Return platform-specific captions.",
    input_schema: {
      type: "object",
      properties: props,
      required: plats,
    },
  };
}

async function callClaude(opts: {
  systemText: string;
  userText: string;
  tool: any;
}) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: [
        { type: "text", text: opts.systemText, cache_control: { type: "ephemeral" } },
      ],
      tools: [opts.tool],
      tool_choice: { type: "tool", name: opts.tool.name },
      messages: [{ role: "user", content: opts.userText }],
    }),
  });

  if (resp.status === 429) {
    throw new Response(
      JSON.stringify({ error: "Rate limited, please try again in a moment." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!resp.ok) {
    const body = await resp.text();
    console.error("Anthropic error", resp.status, body);
    throw new Error(`Anthropic ${resp.status}`);
  }
  const data = await resp.json();
  const block = (data.content || []).find((c: any) => c.type === "tool_use" && c.name === opts.tool.name);
  if (!block) throw new Error("Anthropic did not return tool_use block");
  return block.input;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  try {
    const { mode, brandSlug, sourceTitle, sourceDescription, postTitle, postNotes, platforms } =
      await req.json();
    const voice = BRAND_VOICE[brandSlug] ?? "Generic friendly brand voice.";

    if (mode === "ideas") {
      const result = await callClaude({
        systemText: `You are a social media strategist. Brand voice: ${voice}\n\nReturn 4 distinct post ideas with varied angles (behind the scenes, performance clip, audience reaction, gear/setlist tease, etc.). Respond by calling return_ideas.`,
        userText: `Source: ${sourceTitle}\nDetails: ${sourceDescription || "(none)"}`,
        tool: IDEAS_TOOL,
      });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "captions") {
      const plats: string[] = platforms?.length ? platforms : ["instagram", "tiktok", "facebook"];
      const tool = captionsTool(plats);
      const result = await callClaude({
        systemText: `You are a social media copywriter. Brand voice: ${voice}\n\nWrite captions for the given post on each platform. Keep voice consistent across platforms but tailor format and length to each platform's conventions. Respond by calling return_captions.`,
        userText: `Post: ${postTitle}\nNotes: ${postNotes || "(none)"}`,
        tool,
      });
      return new Response(JSON.stringify({ captions: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("social-ai error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
