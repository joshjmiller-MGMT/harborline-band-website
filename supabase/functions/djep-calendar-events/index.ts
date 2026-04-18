// DJ Event Planner (DJEP) → calendar events
//
// Uses Firecrawl's /v2/extract LLM-powered endpoint with a natural-language
// prompt to log in, navigate to "Web Links → SALES - MILLER", and pull out the
// events list with the "Next Action Date" column as the calendar date.
//
// Results are cached in the `djep_events_cache` Supabase table for 1 hour so
// the dashboard stays snappy. Pass ?refresh=1 to force a fresh scrape.
// Pass ?debug=1 to include the raw extract payload.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const DJEP_USERNAME = Deno.env.get("DJEP_USERNAME");
const DJEP_PASSWORD = Deno.env.get("DJEP_PASSWORD");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DJEP_URL =
  "https://baltimoresoundeventmanager.com/dj_event_planner/base2.asp";
const CACHE_KEY = "djep:sales-miller";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

type DjepEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  source: "djep";
  sourceLabel: string;
  color: string;
  fields: { label: string; value: string }[];
  itemUrl: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function getCachedEvents(): Promise<
  { events: DjepEvent[]; refreshed_at: string; expires_at: string } | null
> {
  const { data, error } = await supabase
    .from("djep_events_cache")
    .select("events, refreshed_at, expires_at")
    .eq("cache_key", CACHE_KEY)
    .maybeSingle();

  if (error) {
    console.error("Cache read error:", error.message);
    return null;
  }
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return {
    events: (data.events as DjepEvent[]) ?? [],
    refreshed_at: data.refreshed_at,
    expires_at: data.expires_at,
  };
}

async function writeCache(events: DjepEvent[], raw: unknown) {
  const now = new Date();
  const expires = new Date(now.getTime() + CACHE_TTL_MS);
  const { error } = await supabase
    .from("djep_events_cache")
    .upsert(
      {
        cache_key: CACHE_KEY,
        events,
        raw,
        refreshed_at: now.toISOString(),
        expires_at: expires.toISOString(),
      },
      { onConflict: "cache_key" }
    );
  if (error) console.error("Cache write error:", error.message);
  return { refreshed_at: now.toISOString(), expires_at: expires.toISOString() };
}

// Firecrawl /v2/extract — uses an LLM agent to navigate the site and return
// structured data per the supplied JSON schema. Much more reliable than
// trying to script the ASP UI step-by-step with click actions.
async function firecrawlExtract(): Promise<{ events: DjepEvent[]; raw: any }> {
  const schema = {
    type: "object",
    properties: {
      events: {
        type: "array",
        description:
          "Every row from the Sales - Miller events list grid. Include all rows visible.",
        items: {
          type: "object",
          properties: {
            client: { type: "string", description: "Client / lead name" },
            status: { type: "string", description: "Lead status (e.g. Inquiry, Booked)" },
            next_action: { type: "string", description: "Next Action description" },
            next_action_date: {
              type: "string",
              description:
                "Next Action Date in MM/DD/YYYY format (this is what we use as the calendar date)",
            },
            event_date: { type: "string", description: "Event Date (MM/DD/YYYY) if shown" },
            event_type: { type: "string" },
            venue: { type: "string" },
            salesperson: { type: "string" },
            event_id: { type: "string", description: "DJEP Event ID number" },
          },
          required: ["client", "next_action_date"],
        },
      },
    },
    required: ["events"],
  };

  const prompt = `Log in to the DJ Event Planner site using username "${DJEP_USERNAME}" and password "${DJEP_PASSWORD}".
After logging in, click the "Web Links" item in the left navigation to expand it, then click the "SALES - MILLER" link.
Wait for the events grid to load. The grid has columns including: Event Date, Client, Status, Next Action, Next Action Date, Event Type, Venue, Salesperson, Event ID, plus others.
Extract every row in that grid where the salesperson is Josh Miller. For each row return the fields defined in the schema. The "Next Action Date" column is the most important field — it is the date we will display on the calendar.`;

  const body = {
    urls: [DJEP_URL],
    prompt,
    schema,
    enableWebSearch: false,
    // Allow long-running navigation; extract jobs are async on Firecrawl
  };

  // Kick off the extract job
  const startRes = await fetch("https://api.firecrawl.dev/v2/extract", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const startJson = await startRes.json();
  if (!startRes.ok) {
    throw new Error(
      `Firecrawl extract start ${startRes.status}: ${JSON.stringify(startJson).slice(0, 600)}`
    );
  }

  const jobId = startJson?.id ?? startJson?.data?.id;
  // If the API returned data inline (sync), use it directly
  if (!jobId && (startJson?.data || startJson?.success)) {
    return parseExtractPayload(startJson);
  }
  if (!jobId) {
    throw new Error(`Firecrawl extract: no job id in response ${JSON.stringify(startJson).slice(0, 400)}`);
  }

  // Poll for completion (extract is async — typically 30-60s)
  const deadline = Date.now() + 90_000; // 90s budget
  let lastJson: any = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetch(
      `https://api.firecrawl.dev/v2/extract/${jobId}`,
      {
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
      }
    );
    const statusJson = await statusRes.json();
    lastJson = statusJson;
    const status = statusJson?.status ?? statusJson?.data?.status;
    if (status === "completed" || statusJson?.data?.events || statusJson?.data?.data?.events) {
      return parseExtractPayload(statusJson);
    }
    if (status === "failed" || status === "cancelled") {
      throw new Error(`Firecrawl extract ${status}: ${JSON.stringify(statusJson).slice(0, 400)}`);
    }
  }
  throw new Error(
    `Firecrawl extract timed out after 90s. Last status: ${JSON.stringify(lastJson).slice(0, 400)}`
  );
}

function parseExtractPayload(payload: any): { events: DjepEvent[]; raw: any } {
  // Firecrawl extract returns the structured data under a few possible shapes.
  const extracted =
    payload?.data?.events ??
    payload?.data?.data?.events ??
    payload?.events ??
    payload?.data?.json?.events ??
    [];

  const events: DjepEvent[] = [];
  for (const row of Array.isArray(extracted) ? extracted : []) {
    const dateRaw = String(row?.next_action_date ?? "");
    const parsed = parseDate(dateRaw);
    if (!parsed) continue;

    const salesperson = String(row?.salesperson ?? "");
    if (salesperson && !salesperson.toLowerCase().includes("miller")) continue;

    const client = String(row?.client ?? "Lead");
    const action = String(row?.next_action ?? "");
    const status = String(row?.status ?? "");
    const eventDate = String(row?.event_date ?? "");
    const eventType = String(row?.event_type ?? "");
    const venue = String(row?.venue ?? "");
    const eventId = String(row?.event_id ?? "");

    const title = action ? `${action} · ${client}` : client;
    const startISO = parsed.toISOString();
    const fields: { label: string; value: string }[] = [];
    if (status) fields.push({ label: "Status", value: status });
    if (action) fields.push({ label: "Next Action", value: action });
    if (eventDate) fields.push({ label: "Event Date", value: eventDate });
    if (eventType) fields.push({ label: "Event Type", value: eventType });
    if (venue) fields.push({ label: "Venue", value: venue });
    if (salesperson) fields.push({ label: "Salesperson", value: salesperson });
    if (eventId) fields.push({ label: "Event ID", value: eventId });

    events.push({
      id: `djep-${eventId || `${client}-${dateRaw}`}`.replace(/\s+/g, "-"),
      title,
      start: startISO,
      end: startISO,
      allDay: true,
      source: "djep",
      sourceLabel: "DJEP Leads",
      color: "#10b981",
      fields,
      itemUrl: DJEP_URL,
    });
  }

  return { events, raw: payload };
}

function parseDate(raw: string): Date | null {
  const m = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return null;
  const [, mo, da, yr] = m;
  const year = yr.length === 2 ? 2000 + Number(yr) : Number(yr);
  const d = new Date(year, Number(mo) - 1, Number(da));
  if (isNaN(d.getTime())) return null;
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!FIRECRAWL_API_KEY) {
    return jsonResponse({ configured: false, events: [], error: "FIRECRAWL_API_KEY not set" });
  }
  if (!DJEP_USERNAME || !DJEP_PASSWORD) {
    return jsonResponse({
      configured: false,
      events: [],
      error: "DJEP_USERNAME / DJEP_PASSWORD not set",
    });
  }

  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const forceRefresh = url.searchParams.get("refresh") === "1";

  // Try cache first
  if (!forceRefresh) {
    const cached = await getCachedEvents();
    if (cached) {
      return jsonResponse({
        configured: true,
        events: cached.events,
        cached: true,
        refreshed_at: cached.refreshed_at,
        expires_at: cached.expires_at,
        debug: debug ? { count: cached.events.length, source: "cache" } : { count: cached.events.length },
      });
    }
  }

  try {
    const { events, raw } = await firecrawlExtract();
    const meta = await writeCache(events, raw);
    return jsonResponse({
      configured: true,
      events,
      cached: false,
      refreshed_at: meta.refreshed_at,
      expires_at: meta.expires_at,
      debug: debug
        ? {
            count: events.length,
            sampleEvents: events.slice(0, 5),
            rawKeys: Object.keys(raw || {}),
          }
        : { count: events.length },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("DJEP extract error:", msg);
    // Fall back to stale cache if scrape failed
    const stale = await supabase
      .from("djep_events_cache")
      .select("events, refreshed_at, expires_at")
      .eq("cache_key", CACHE_KEY)
      .maybeSingle();
    if (stale.data) {
      return jsonResponse({
        configured: true,
        events: stale.data.events ?? [],
        cached: true,
        stale: true,
        refreshed_at: stale.data.refreshed_at,
        expires_at: stale.data.expires_at,
        error: msg,
      });
    }
    return jsonResponse({ configured: true, events: [], error: msg }, 200);
  }
});
