// Daily best-times-to-post for IG (reels|carousel|story), TikTok, YouTube Shorts.
// Pipeline: Firecrawl scrapes ~6 public sources -> stores raw markdown ->
// ONE Claude Sonnet 4.6 call synthesizes all 5 (platform, style) combos at once
// -> upserts posting_times_cache. Single-call design respects Anthropic Tier 1
// 10k tokens/min rate limit.
// Triggered by pg_cron daily at 09:00 UTC, or manually from the widget with a JWT.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

type Platform = "instagram" | "tiktok" | "youtube_shorts";
type Style = "reels" | "carousel" | "story" | "default";

const COMBOS: { platform: Platform; style: Style }[] = [
  { platform: "instagram", style: "reels" },
  { platform: "instagram", style: "carousel" },
  { platform: "instagram", style: "story" },
  { platform: "tiktok", style: "default" },
  { platform: "youtube_shorts", style: "default" },
];

const SOURCES: { url: string; label: string; platform: "instagram" | "tiktok" | "youtube_shorts" | "general" }[] = [
  { url: "https://sproutsocial.com/insights/best-times-to-post-on-social-media/", label: "Sprout Social", platform: "general" },
  { url: "https://blog.hootsuite.com/best-time-to-post-on-social-media/", label: "Hootsuite", platform: "general" },
  { url: "https://later.com/blog/best-time-to-post-on-instagram/", label: "Later (Instagram)", platform: "instagram" },
  { url: "https://buffer.com/resources/best-time-to-post-on-social-media/", label: "Buffer", platform: "general" },
  { url: "https://www.socialpilot.co/blog/best-time-to-post-on-instagram", label: "SocialPilot (Instagram)", platform: "instagram" },
  { url: "https://influencermarketinghub.com/best-time-to-post-on-tiktok/", label: "Influencer Marketing Hub (TikTok)", platform: "tiktok" },
];

const PER_SOURCE_CHARS = 3000;

const COMBO_SCHEMA = {
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
          day: { type: "string" },
          start_hour: { type: "integer" },
          end_hour: { type: "integer" },
          rationale: { type: "string" },
        },
        required: ["day", "start_hour", "end_hour", "rationale"],
      },
    },
    change_note: { type: "string" },
    sources: { type: "array", items: { type: "string" } },
  },
  required: ["heatmap", "top_windows", "change_note", "sources"],
};

const TOOL = {
  name: "return_all_posting_times",
  description: "Return synthesized engagement heatmaps and top windows for ALL 5 (platform, content_style) combinations.",
  input_schema: {
    type: "object",
    properties: {
      instagram_reels: COMBO_SCHEMA,
      instagram_carousel: COMBO_SCHEMA,
      instagram_story: COMBO_SCHEMA,
      tiktok_default: COMBO_SCHEMA,
      youtube_shorts_default: COMBO_SCHEMA,
    },
    required: [
      "instagram_reels",
      "instagram_carousel",
      "instagram_story",
      "tiktok_default",
      "youtube_shorts_default",
    ],
  },
};

const SYSTEM_PROMPT = `You are a social-media analytics synthesizer for a US-based music/band/entertainment account targeting US Eastern Time audiences.

Your job: read raw markdown from public best-time-to-post articles (Sprout Social, Hootsuite, Later, Buffer, SocialPilot, Influencer Marketing Hub, etc.) and produce ONE consolidated response covering all 5 (platform, content_style) combinations:
- instagram_reels
- instagram_carousel
- instagram_story
- tiktok_default
- youtube_shorts_default

For EACH of the 5 combos, return:
- heatmap: 7x24 array. Index 0=Sunday..6=Saturday. Hours 0-23 in US Eastern Time. Each cell is integer 0-100 representing engagement potential.
- top_windows: 3-5 high-engagement windows with day name (e.g. "Tuesday"), start_hour and end_hour (0-23 ET), and a 1-sentence rationale citing sources.
- change_note: 1-3 sentences on what's shifted vs older guidance for this specific combo.
- sources: array of source labels you actually drew from for this combo (subset of provided sources). Don't invent.

Differentiate the heatmaps meaningfully across combos:
- IG Reels peak in evenings (6-10p ET) and lunch (12-2p ET). Strongest weekdays Tue-Thu.
- IG Carousel does well midday weekdays (10a-2p ET); slower evening engagement than Reels.
- IG Story has flatter distribution; spikes around morning commute (7-9a) and lunch.
- TikTok peaks weekday afternoons/evenings (2p-9p ET), strong weekend mornings.
- YouTube Shorts peaks Fri-Sat evenings (4p-8p ET); secondary weekday evening 6-9p.

Bias for music/entertainment accounts: weekday evenings 6-10p ET often perform well; weekends 10a-2p strong for event-promotion content; live-show recap content does best within 24-48hrs of the event.

Weight 2025/2026 source data over 2023/2024. Respond ONLY by calling the return_all_posting_times tool.`;

async function firecrawlScrape(url: string): Promise<{ markdown: string | null; error: string | null }> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return { markdown: null, error: "FIRECRAWL_API_KEY not configured" };
  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!resp.ok) return { markdown: null, error: `Firecrawl ${resp.status}: ${await resp.text()}` };
    const data = await resp.json();
    const md = data?.data?.markdown ?? null;
    if (!md) return { markdown: null, error: "Firecrawl returned no markdown" };
    return { markdown: md.slice(0, 60000), error: null };
  } catch (e) {
    return { markdown: null, error: e instanceof Error ? e.message : "scrape failed" };
  }
}

async function scrapeAll(supabase: any): Promise<void> {
  const results = await Promise.allSettled(SOURCES.map((s) => firecrawlScrape(s.url)));
  const rows = results.map((r, i) => {
    const src = SOURCES[i];
    if (r.status === "fulfilled" && r.value.markdown) {
      return {
        source_url: src.url,
        source_label: src.label,
        platform: src.platform,
        raw_markdown: r.value.markdown,
        scrape_error: null,
      };
    }
    const err = r.status === "fulfilled" ? r.value.error : (r.reason?.message ?? "unknown");
    return {
      source_url: src.url,
      source_label: src.label,
      platform: src.platform,
      raw_markdown: "",
      scrape_error: err,
    };
  });
  await supabase.from("posting_times_sources").insert(rows);
}

async function loadAllRecentScrapes(supabase: any): Promise<{ label: string; url: string; markdown: string }[]> {
  const cutoff = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("posting_times_sources")
    .select("source_label, source_url, raw_markdown, scraped_at")
    .gte("scraped_at", cutoff)
    .not("raw_markdown", "eq", "")
    .order("scraped_at", { ascending: false });
  const seen = new Set<string>();
  const out: { label: string; url: string; markdown: string }[] = [];
  for (const row of data || []) {
    if (seen.has(row.source_url)) continue;
    seen.add(row.source_url);
    out.push({
      label: row.source_label,
      url: row.source_url,
      markdown: row.raw_markdown.slice(0, PER_SOURCE_CHARS),
    });
  }
  return out;
}

async function synthesizeAll(scrapes: { label: string; url: string; markdown: string }[]) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const userContent =
    `Synthesize all 5 (platform, content_style) heatmaps from the sources below.\n` +
    `Today is ${new Date().toISOString().slice(0, 10)}.\n\n` +
    `=== SCRAPED SOURCES (truncated to first ${PER_SOURCE_CHARS} chars each) ===\n\n` +
    scrapes.map((s) => `## ${s.label}\nURL: ${s.url}\n\n${s.markdown}\n\n`).join("---\n\n");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [TOOL],
      tool_choice: { type: "tool", name: "return_all_posting_times" },
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  const block = (data.content || []).find((c: any) => c.type === "tool_use" && c.name === "return_all_posting_times");
  if (!block) throw new Error("Anthropic did not return tool_use block");
  return block.input;
}

const COMBO_KEYS: Record<string, { platform: Platform; style: Style }> = {
  instagram_reels: { platform: "instagram", style: "reels" },
  instagram_carousel: { platform: "instagram", style: "carousel" },
  instagram_story: { platform: "instagram", style: "story" },
  tiktok_default: { platform: "tiktok", style: "default" },
  youtube_shorts_default: { platform: "youtube_shorts", style: "default" },
};

async function runRefresh(supabase: any, doScrape: boolean) {
  if (doScrape) {
    await scrapeAll(supabase);
  }

  const scrapes = await loadAllRecentScrapes(supabase);
  if (scrapes.length === 0) {
    return { results: {}, summary: [{ ok: false, reason: "no scrapes available" }] };
  }

  const synth = await synthesizeAll(scrapes);

  const summary: any[] = [];
  const refreshedAt = new Date().toISOString();
  for (const [key, { platform, style }] of Object.entries(COMBO_KEYS)) {
    const cell = (synth as any)[key];
    if (!cell) {
      summary.push({ platform, style, ok: false, reason: "missing in synthesis output" });
      continue;
    }
    const { error } = await supabase.from("posting_times_cache").upsert(
      {
        platform,
        style,
        heatmap: cell.heatmap,
        top_windows: cell.top_windows,
        change_note: cell.change_note,
        sources: cell.sources,
        refreshed_at: refreshedAt,
      },
      { onConflict: "platform,style" },
    );
    if (error) {
      console.error(`upsert failed for ${platform}/${style}`, error);
      summary.push({ platform, style, ok: false, reason: error.message });
    } else {
      summary.push({ platform, style, ok: true });
    }
  }

  return { synth, summary };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = Deno.env.get("POSTING_TIMES_CRON_SECRET");
  const headerSecret = req.headers.get("x-cron-secret");
  const isCron = cronSecret && headerSecret && headerSecret === cronSecret;

  const authHeader = req.headers.get("Authorization");
  const hasJwt = authHeader?.startsWith("Bearer ");

  if (!isCron && !hasJwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const doScrape = body?.scrape !== false;

    const out = await runRefresh(supabase, doScrape);
    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("posting-times error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
