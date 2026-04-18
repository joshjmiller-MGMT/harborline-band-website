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

// Firecrawl /v2/scrape with actions array — multi-step interactive navigation.
// Logs in, clicks "Web Links", clicks "SALES - MILLER", waits for the grid,
// then returns the rendered HTML which we parse for events.
async function firecrawlScrape(): Promise<{ events: DjepEvent[]; raw: any }> {
  const clickByTextJs = (text: string) => `
    (() => {
      const target = ${JSON.stringify(text)}.toLowerCase().trim();
      const all = Array.from(document.querySelectorAll('a, button, span, div, td, li'));
      const el = all.find(e => (e.textContent || '').toLowerCase().trim() === target)
              || all.find(e => (e.textContent || '').toLowerCase().includes(target));
      if (el) { el.click(); return true; }
      return false;
    })();
  `;

  // Submit the login form via JavaScript so values are guaranteed to be set
  // (write actions can miss input events on legacy ASP forms).
  const submitLoginJs = `
    (() => {
      try {
        var u = document.querySelector("input[name='username']");
        var p = document.querySelector("input[name='password']");
        if (!u || !p) return { ok: false, reason: 'no-fields' };
        u.focus(); u.value = ${JSON.stringify(DJEP_USERNAME ?? "")};
        u.dispatchEvent(new Event('input', { bubbles: true }));
        u.dispatchEvent(new Event('change', { bubbles: true }));
        p.focus(); p.value = ${JSON.stringify(DJEP_PASSWORD ?? "")};
        p.dispatchEvent(new Event('input', { bubbles: true }));
        p.dispatchEvent(new Event('change', { bubbles: true }));
        var form = u.form || document.querySelector("form[name='logonform']") || document.forms[0];
        if (!form) return { ok: false, reason: 'no-form' };
        form.submit();
        return { ok: true, action: form.action, userLen: u.value.length, passLen: p.value.length };
      } catch (e) {
        return { ok: false, error: String(e && e.message || e) };
      }
    })();
  `;

  const body = {
    url: DJEP_URL,
    formats: ["html"],
    onlyMainContent: false,
    waitFor: 2000,
    timeout: 120000,
    actions: [
      { type: "wait", milliseconds: 1500 },
      { type: "executeJavascript", script: `(() => ({ stage: 'logon-page', title: document.title, url: location.href, hasUser: !!document.querySelector("input[name='username']"), hasPass: !!document.querySelector("input[name='password']") }))()` },
      { type: "executeJavascript", script: submitLoginJs },
      { type: "wait", milliseconds: 5000 },
      { type: "executeJavascript", script: `(() => ({ stage: 'post-login', title: document.title, url: location.href, bodyStart: (document.body.innerText || '').slice(0, 400) }))()` },
      { type: "executeJavascript", script: clickByTextJs("Web Links") },
      { type: "wait", milliseconds: 1500 },
      { type: "executeJavascript", script: clickByTextJs("SALES - MILLER") },
      { type: "wait", milliseconds: 4500 },
      { type: "executeJavascript", script: `(() => ({ stage: 'post-nav', title: document.title, url: location.href, tableCount: document.querySelectorAll('table').length }))()` },
      { type: "scrape" },
    ],
  };

  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Firecrawl scrape ${res.status}: ${JSON.stringify(json).slice(0, 600)}`);
  }

  const data = json?.data ?? json;
  const actionScrapes = data?.actions?.scrapes ?? data?.actions?.scrape ?? [];
  const lastActionHtml = Array.isArray(actionScrapes) && actionScrapes.length
    ? (actionScrapes[actionScrapes.length - 1]?.html ?? actionScrapes[actionScrapes.length - 1]?.content)
    : null;
  const html: string = lastActionHtml ?? data?.html ?? data?.rawHtml ?? "";
  if (!html) {
    throw new Error(`Firecrawl scrape returned no HTML. Keys: ${Object.keys(data || {}).join(",")}`);
  }

  const events = parseEventsFromHtml(html);
  return {
    events,
    raw: {
      keys: Object.keys(data || {}),
      htmlLength: html.length,
      tableCount: (html.match(/<table/gi) || []).length,
      actionResults: data?.actions?.javascriptReturns ?? data?.actions?.scripts ?? data?.actions ?? null,
      htmlSample: html.slice(0, 4000),
    },
  };
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(s: string): string {
  return decodeHtmlEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function parseEventsFromHtml(html: string): DjepEvent[] {
  const tableMatches = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]);
  if (!tableMatches.length) return [];
  const table = tableMatches.sort((a, b) => b.length - a.length)[0];

  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  if (rows.length < 2) return [];

  const headerCells = [...rows[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) =>
    stripTags(m[1]).toLowerCase()
  );
  const colIdx = (...names: string[]): number => {
    for (const n of names) {
      const i = headerCells.findIndex((h) => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const idx = {
    eventDate: colIdx("event date"),
    client: colIdx("client", "name"),
    status: colIdx("status"),
    nextAction: headerCells.findIndex((h) => h === "next action" || (h.includes("next action") && !h.includes("date"))),
    nextActionDate: colIdx("next action date", "next date"),
    eventType: colIdx("event type", "type"),
    venue: colIdx("venue", "location"),
    salesperson: colIdx("salesperson", "sales"),
    eventId: colIdx("event id", "id"),
  };

  const events: DjepEvent[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = [...rows[i].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) => stripTags(m[1]));
    if (cells.length === 0) continue;
    const get = (j: number) => (j >= 0 && j < cells.length ? cells[j] : "");

    const nextActionDateRaw = get(idx.nextActionDate);
    const eventDateRaw = get(idx.eventDate);
    const dateRaw = nextActionDateRaw || eventDateRaw;
    const parsed = parseDate(dateRaw);
    if (!parsed) continue;

    const client = get(idx.client) || "Lead";
    const status = get(idx.status);
    const action = get(idx.nextAction);
    const eventType = get(idx.eventType);
    const venue = get(idx.venue);
    const salesperson = get(idx.salesperson);
    const eventId = get(idx.eventId);

    if (salesperson && !salesperson.toLowerCase().includes("miller")) continue;

    const title = action ? `${action} · ${client}` : client;
    const startISO = parsed.toISOString();
    const fields: { label: string; value: string }[] = [];
    if (status) fields.push({ label: "Status", value: status });
    if (action) fields.push({ label: "Next Action", value: action });
    if (eventDateRaw) fields.push({ label: "Event Date", value: eventDateRaw });
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
  return events;
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
    const { events, raw } = await firecrawlScrape();
    const meta = await writeCache(events, raw);
    return jsonResponse({
      configured: true,
      events,
      cached: false,
      refreshed_at: meta.refreshed_at,
      expires_at: meta.expires_at,
      debug: debug
        ? { count: events.length, sampleEvents: events.slice(0, 5), raw }
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
