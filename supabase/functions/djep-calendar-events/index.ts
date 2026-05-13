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
  eventUrl?: string;
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

  // Find the SALES - MILLER link and navigate the top window directly to its href.
  // This bypasses iframe/popup quirks that prevented the previous click from loading content.
  const navigateSalesMillerJs = `
    (() => {
      const docs = [document];
      try {
        for (const f of Array.from(document.querySelectorAll('iframe, frame'))) {
          try { if (f.contentDocument) docs.push(f.contentDocument); } catch(e) {}
        }
      } catch(e) {}
      const allLinks = [];
      for (const d of docs) {
        try { allLinks.push(...Array.from(d.querySelectorAll('a[href]'))); } catch(e) {}
      }
      const matches = allLinks.filter(a => {
        const t = (a.textContent || '').toLowerCase();
        return t.includes('sales - miller') || t.includes('sales-miller') || t.includes('sales miller');
      });
      const link = matches[0];
      if (!link) return { ok: false, reason: 'no-link', candidates: allLinks.map(a => (a.textContent||'').trim()).filter(Boolean).slice(0, 50) };
      const href = link.getAttribute('href') || link.href;
      if (!href) return { ok: false, reason: 'no-href' };
      const absolute = new URL(href, location.href).href;
      window.location.href = absolute;
      return { ok: true, href: absolute, linkText: (link.textContent || '').trim() };
    })();
  `;

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
        var btn = form.querySelector("input[type='submit'], button[type='submit']");
        if (btn && typeof btn.click === 'function') {
          btn.click();
        } else {
          HTMLFormElement.prototype.submit.call(form);
        }
        return { ok: true, action: form.action, userLen: u.value.length, passLen: p.value.length, viaButton: !!btn };
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
      { type: "executeJavascript", script: submitLoginJs },
      { type: "wait", milliseconds: 5000 },
      { type: "executeJavascript", script: `(() => ({ stage: 'post-login', title: document.title, url: location.href }))()` },
      { type: "executeJavascript", script: clickByTextJs("Web Links") },
      { type: "wait", milliseconds: 2000 },
      { type: "executeJavascript", script: navigateSalesMillerJs },
      { type: "wait", milliseconds: 6000 },
      { type: "executeJavascript", script: `(() => ({ stage: 'post-nav', title: document.title, url: location.href, tableCount: document.querySelectorAll('table').length, headers: Array.from(document.querySelectorAll('th')).slice(0, 30).map(e => (e.textContent||'').trim()) }))()` },
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

  const { events, debug: parseDebug } = parseEventsFromHtml(html);
  return {
    events,
    raw: {
      keys: Object.keys(data || {}),
      htmlLength: html.length,
      tableCount: (html.match(/<table/gi) || []).length,
      actionResults: data?.actions?.javascriptReturns ?? data?.actions?.scripts ?? data?.actions ?? null,
      parse: parseDebug,
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

// Extract the first href in a raw cell HTML snippet, resolved against DJEP_URL.
function extractHref(cellHtml: string): string | undefined {
  const m = cellHtml.match(/href\s*=\s*["']([^"']+)["']/i);
  if (!m) return undefined;
  const raw = decodeHtmlEntities(m[1].trim());
  if (!raw || raw.startsWith("#") || raw.toLowerCase().startsWith("javascript:")) return undefined;
  try {
    return new URL(raw, DJEP_URL).href;
  } catch {
    return undefined;
  }
}

function parseEventsFromHtml(html: string): { events: DjepEvent[]; debug: any } {
  // DJEP nests tables, so extracting <table>...</table> blocks is unreliable.
  // Scan ALL <tr> rows, find the one whose cells match the events-list header,
  // then collect subsequent rows with the same shape.
  const allRows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  if (!allRows.length) return { events: [], debug: { reason: "no-rows" } };

  // Parallel arrays: stripped text per cell, and raw inner HTML per cell.
  // The raw HTML lets us pull href= out of cells like "Open in New Tab".
  const rowCells: string[][] = [];
  const rowCellsHtml: string[][] = [];
  for (const r of allRows) {
    const matches = [...r.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)];
    rowCells.push(matches.map((m) => stripTags(m[1])));
    rowCellsHtml.push(matches.map((m) => m[1]));
  }

  // Find header row: cells include "Event Date", "Client", "Next Action Date".
  let headerIdx = -1;
  for (let i = 0; i < rowCells.length; i++) {
    const lower = rowCells[i].map((c) => c.toLowerCase());
    if (
      lower.some((c) => c === "event date") &&
      lower.some((c) => c === "client") &&
      lower.some((c) => c.includes("next action date"))
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    return {
      events: [],
      debug: {
        reason: "no-header-row",
        rowCount: allRows.length,
        sampleHeaders: rowCells.slice(0, 10).map((cs) => cs.slice(0, 8)),
      },
    };
  }

  // Preserve original-cased headers for label output; keep lowercase variant for matching.
  const headerCellsRaw = rowCells[headerIdx];
  const headerCells = headerCellsRaw.map((c) => c.toLowerCase());
  const expectedLen = headerCells.length;
  // Keep parallel HTML for data rows alongside the text cells.
  const dataRowsPairs: { cells: string[]; cellsHtml: string[] }[] = [];
  for (let i = headerIdx + 1; i < rowCells.length; i++) {
    if (rowCells[i].length !== expectedLen) continue;
    dataRowsPairs.push({ cells: rowCells[i], cellsHtml: rowCellsHtml[i] });
  }
  const debug = {
    headerIdx,
    expectedLen,
    totalRows: allRows.length,
    dataRowCount: dataRowsPairs.length,
    headers: headerCells,
  };
  if (!dataRowsPairs.length) return { events: [], debug: { ...debug, reason: "no-data-rows" } };

  const colIdx = (...names: string[]): number => {
    for (const n of names) {
      const i = headerCells.findIndex((h) => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const idx = {
    eventDate: headerCells.findIndex((h) => h === "event date"),
    client: headerCells.findIndex((h) => h === "client") >= 0 ? headerCells.findIndex((h) => h === "client") : colIdx("client", "name"),
    status: headerCells.findIndex((h) => h === "status"),
    nextAction: headerCells.findIndex((h) => h === "next action"),
    nextActionDate: headerCells.findIndex((h) => h === "next action date"),
    eventType: colIdx("event type", "type"),
    venue: colIdx("venue", "location"),
    salesperson: colIdx("salesperson", "sales"),
    eventId: colIdx("event id"),
    openInNewTab: colIdx("open in new tab"),
  };
  // Columns whose values are already covered by a known field above — skip in the
  // generic "all other columns" pass to avoid duplicate entries.
  const handled = new Set<number>([
    idx.eventDate, idx.client, idx.status, idx.nextAction, idx.nextActionDate,
    idx.eventType, idx.venue, idx.salesperson, idx.eventId, idx.openInNewTab,
  ].filter((n) => n >= 0));

  const events: DjepEvent[] = [];
  for (const { cells, cellsHtml } of dataRowsPairs) {
    const get = (j: number) => (j >= 0 && j < cells.length ? cells[j] : "");
    const getHtml = (j: number) => (j >= 0 && j < cellsHtml.length ? cellsHtml[j] : "");

    const nextActionDateRaw = get(idx.nextActionDate).trim();
    const eventDateRaw = get(idx.eventDate).trim();
    // Calendar position is ALWAYS the Next Action Date.
    // STRICT: skip any row where the NAD cell is empty, a placeholder, or
    // identical to the Event Date (defensive — DJEP sometimes leaves NAD blank
    // and we must NOT fall back to the event date).
    if (!nextActionDateRaw) continue;
    if (/^(n\/?a|none|tbd|-+|—)$/i.test(nextActionDateRaw)) continue;
    if (nextActionDateRaw === eventDateRaw) continue;
    const parsed = parseDate(nextActionDateRaw);
    if (!parsed) continue;
    const dateRaw = nextActionDateRaw;

    const client = get(idx.client) || "Lead";
    const status = get(idx.status);
    const action = get(idx.nextAction);
    const eventType = get(idx.eventType);
    const venue = get(idx.venue);
    const salesperson = get(idx.salesperson);
    const eventId = get(idx.eventId);

    // Salesperson filter is already applied server-side via the SALES-MILLER URL.

    const title = action ? `${action} · ${client}` : client;
    const fields: { label: string; value: string }[] = [];
    if (status) fields.push({ label: "Status", value: status });
    if (action) fields.push({ label: "Next Action", value: action });
    fields.push({ label: "Next Action Date", value: nextActionDateRaw });
    if (eventDateRaw) fields.push({ label: "Event Date", value: eventDateRaw });
    if (eventType) fields.push({ label: "Event Type", value: eventType });
    if (venue) fields.push({ label: "Venue", value: venue });
    if (salesperson) fields.push({ label: "Salesperson", value: salesperson });
    if (eventId) fields.push({ label: "Event ID", value: eventId });

    // Capture every remaining non-empty column with its original-cased header
    // as the label. This is what closes the bulk of the "DJEP fields are filled
    // in but missed by the scraper" gap (P17): the queue already returns 21
    // columns (Package, Start-End Time, Assigned Employees, Setup Time, Start
    // Time, End Time, Addons, Total Fee, Balance Due, Date Booked, TSB or BSE,
    // …) and previously we threw all of them away.
    for (let i = 0; i < cells.length; i++) {
      if (handled.has(i)) continue;
      const val = cells[i].trim();
      if (!val) continue;
      const label = (headerCellsRaw[i] ?? `Column ${i}`).trim();
      if (!label) continue;
      fields.push({ label, value: val });
    }

    // Per-event detail URL. DJEP's standard convention is
    // events_edit.asp?eventid=<numeric>; when we have a numeric event ID
    // we construct it directly (most reliable, survives onclick="window.open"
    // patterns in the queue's "Open in New Tab" column where there's no real
    // href to extract). Otherwise fall back to scraping a href out of either
    // the "Open in New Tab" cell or the Client cell.
    // Per-event detail URL. DJEP's queue rows link the date/status cells to
    // events_report.asp?eventid=<numeric> (verified via firstRowSample debug
    // 2026-05-13). events_edit.asp is the edit-form shell which renders empty
    // when loaded standalone; events_report.asp is the read-only detail view
    // that works without the base2.asp iframe wrapper. Prefer the constructed
    // URL when we have a numeric ID; fall back to the first href we can find
    // in any cell (most likely the Event Date or Status cell).
    let eventUrl: string | undefined;
    if (eventId && /^\d+$/.test(eventId)) {
      eventUrl = `${DJEP_URL.replace(/base2\.asp$/, "")}events_report.asp?eventid=${eventId}`;
    }
    if (!eventUrl) eventUrl = extractHref(getHtml(idx.eventDate));
    if (!eventUrl) eventUrl = extractHref(getHtml(idx.status));
    if (!eventUrl) eventUrl = extractHref(getHtml(idx.openInNewTab));
    if (!eventUrl) eventUrl = extractHref(getHtml(idx.client));

    // Use plain YYYY-MM-DD (no time/Z) so the client parses these in local
    // time without UTC midnight drift. End is exclusive (next day) to match
    // Google's all-day convention, which the client widget already handles.
    const y = parsed.getFullYear();
    const mo = String(parsed.getMonth() + 1).padStart(2, "0");
    const da = String(parsed.getDate()).padStart(2, "0");
    const startDateOnly = `${y}-${mo}-${da}`;
    const endDate = new Date(parsed);
    endDate.setDate(endDate.getDate() + 1);
    const endDateOnly = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

    events.push({
      id: `djep-${eventId || `${client}-${dateRaw}`}`.replace(/\s+/g, "-"),
      title,
      start: startDateOnly,
      end: endDateOnly,
      allDay: true,
      source: "djep",
      sourceLabel: "DJEP Leads",
      color: "#10b981",
      fields,
      itemUrl: DJEP_URL,
      ...(eventUrl ? { eventUrl } : {}),
    });
  }
  return { events, debug: { ...debug, idx, parsedRows: events.length } };
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
