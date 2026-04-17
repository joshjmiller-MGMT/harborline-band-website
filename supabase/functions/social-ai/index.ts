// Social Media AI helper: generates post ideas from a source, or per-platform captions for a post.
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
};

async function callAI(messages: any[], tools?: any[], toolChoice?: any) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const body: any = {
    model: "google/gemini-3-flash-preview",
    messages,
  };
  if (tools) {
    body.tools = tools;
    if (toolChoice) body.tool_choice = toolChoice;
  }
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (resp.status === 429) {
    throw new Response(
      JSON.stringify({ error: "Rate limited, please try again in a moment." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (resp.status === 402) {
    throw new Response(
      JSON.stringify({ error: "AI credits exhausted. Add credits in Lovable Cloud settings." }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!resp.ok) {
    const t = await resp.text();
    console.error("AI gateway error", resp.status, t);
    throw new Error(`AI gateway error ${resp.status}`);
  }
  return await resp.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, brandSlug, sourceTitle, sourceDescription, postTitle, postNotes, platforms } =
      await req.json();
    const voice = BRAND_VOICE[brandSlug] ?? "Generic friendly brand voice.";

    if (mode === "ideas") {
      // Generate 3-5 post ideas from a source
      const tools = [
        {
          type: "function",
          function: {
            name: "return_ideas",
            description: "Return social media post ideas for the source.",
            parameters: {
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
                    additionalProperties: false,
                  },
                },
              },
              required: ["ideas"],
              additionalProperties: false,
            },
          },
        },
      ];
      const data = await callAI(
        [
          { role: "system", content: `You are a social media strategist. Brand voice: ${voice}` },
          {
            role: "user",
            content: `Generate 4 distinct post ideas for this source.\n\nSource: ${sourceTitle}\nDetails: ${sourceDescription || "(none)"}\n\nReturn varied angles (behind the scenes, performance clip, audience reaction, gear/setlist tease, etc.).`,
          },
        ],
        tools,
        { type: "function", function: { name: "return_ideas" } },
      );
      const call = data.choices?.[0]?.message?.tool_calls?.[0];
      const args = call ? JSON.parse(call.function.arguments) : { ideas: [] };
      return new Response(JSON.stringify(args), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "captions") {
      const plats: string[] = platforms?.length ? platforms : ["instagram", "tiktok", "facebook"];
      const props: Record<string, any> = {};
      for (const p of plats) {
        props[p] = { type: "string", description: PLATFORM_GUIDANCE[p] ?? `Caption for ${p}` };
      }
      const tools = [
        {
          type: "function",
          function: {
            name: "return_captions",
            description: "Return platform-specific captions.",
            parameters: {
              type: "object",
              properties: props,
              required: plats,
              additionalProperties: false,
            },
          },
        },
      ];
      const data = await callAI(
        [
          { role: "system", content: `You are a social media copywriter. Brand voice: ${voice}` },
          {
            role: "user",
            content: `Write captions for this post on each platform.\n\nPost: ${postTitle}\nNotes: ${postNotes || "(none)"}\n\nKeep voice consistent across platforms but tailor format/length to each platform's conventions.`,
          },
        ],
        tools,
        { type: "function", function: { name: "return_captions" } },
      );
      const call = data.choices?.[0]?.message?.tool_calls?.[0];
      const args = call ? JSON.parse(call.function.arguments) : {};
      return new Response(JSON.stringify({ captions: args }), {
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
