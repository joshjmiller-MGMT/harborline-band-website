// DJ Event Planner (DJEP) → past events Josh worked
//
// Parallel of djep-calendar-events but scrapes the employee_events.asp
// past-events view (Josh's canonical list of every BSE gig he worked, with
// Role per row — "musician" / "live act" / etc.).
//
// URL: employee_events.asp?action=past_events&view_all=true
//
// Triggered by Josh 2026-05-29 as the canonical source for:
// (a) venue-roster expansion candidates for harborlineband.com /venues/
// (b) testimonial-target client list (filter rows where Role is musician/
//     live act / similar — those are the gigs where Josh was the performer
//     rather than the operator)
//
// Cache key: djep:past-events (separate from djep:all-events used by
// djep-calendar-events).
//
// Auth: requireOperator (same gate as djep-calendar-events) OR an x-cron-secret
// header matching the DJEP_PAST_EVENTS_CRON_SECRET env var (mirrors the
// trello-route-cards trigger pattern). The cron-secret path lets pg_net.http_post
// from SQL trigger refresh without needing an operator JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

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

// Cron secret name in public.cron_secrets — fetched at request time so the
// secret can be rotated server-side without a redeploy.
const CRON_SECRET_NAME = "djep_past_events_cron_secret";

const DJEP_URL =
  "https://baltimoresoundeventmanager.com/dj_event_planner/base2.asp";
const PAST_EVENTS_URL =
  "https://baltimoresoundeventmanager.com/dj_event_planner/employee_events.asp?action=past_events&view_all=true";
const CACHE_KEY = "djep:past-events";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — past events don't change

type PastEventRow = {
  id: string;
  fields: { label: string; value: string }[];
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

async function getCachedRows(): Promise<
  { rows: PastEventRow[]; refreshed_at: string; expires_at: string } | null
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
    rows: (data.events as PastEventRow[]) ?? [],
    refreshed_at: data.refreshed_at,
    expires_at: data.expires_at,
  };
}

async function writeCache(rows: PastEventRow[], raw: unknown) {
  const now = new Date();
  const expires = new Date(now.getTime() + CACHE_TTL_MS);
  const { error } = await supabase.from("djep_events_cache").upsert(
    {
      cache_key: CACHE_KEY,
      events: rows,
      raw,
      refreshed_at: now.toISOString(),
      expires_at: expires.toISOString(),
    },
    { onConflict: "cache_key" }
  );
  if (error) console.error("Cache write error:", error.message);
  return { refreshed_at: now.toISOString(), expires_at: expires.toISOString() };
}

async function firecrawlScrape(): Promise<{ rows: PastEventRow[]; raw: any }> {
  const navigatePastEventsJs = `
    (() => {
      try {
        window.location.href = ${JSON.stringify(PAST_EVENTS_URL)};
        return { ok: true, href: ${JSON.stringify(PAST_EVENTS_URL)} };
      } catch (e) {
        return { ok: false, error: String(e && e.message || e) };
      }
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
        if (btn && typeof btn.click === 'function') { btn.click(); }
        else { HTMLFormElement.prototype.submit.call(form); }
        return { ok: true, action: form.action };
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
    timeout: 180000,
    actions: [
      { type: "wait", milliseconds: 1500 },
      { type: "executeJavascript", script: submitLoginJs },
      { type: "wait", milliseconds: 5000 },
      { type: "executeJavascript", script: `(() => ({ stage: 'post-login', title: document.title, url: location.href }))()` },
      { type: "executeJavascript", script: navigatePastEventsJs },
      { type: "wait", milliseconds: 12000 },
      { type: "executeJavascript", script: `(() => ({ stage: 'post-nav', title: document.title, url: location.href, tableCount: document.querySelectorAll('table').length, headers: Array.from(document.querySelectorAll('th')).slice(0, 40).map(e => (e.textContent||'').trim()) }))()` },
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

  const { rows, debug: parseDebug } = parseRowsFromHtml(html);
  return {
    rows,
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

function extractHref(cellHtml: string): string | undefined {
  const m = cellHtml.match(/href\s*=\s*["']([^"']+)["']/i);
  if (!m) return undefined;
  const raw = decodeHtmlEntities(m[1].trim());
  if (!raw || raw.startsWith("#") || raw.toLowerCase().startsWith("javascript:")) return undefined;
  try { return new URL(raw, DJEP_URL).href; } catch { return undefined; }
}

// Permissive parser — past_events page shape is undocumented here, so detect
// the header row by looking for cells containing "Event Date" + "Client" (the
// minimal signal). Then collect data rows with the same shape. Every column
// gets emitted as a label/value field; consumers (Josh, the gap-report query)
// can pick out Role, Venue, Event Type, etc. as needed.
function parseRowsFromHtml(html: string): { rows: PastEventRow[]; debug: any } {
  const allRows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  if (!allRows.length) return { rows: [], debug: { reason: "no-rows" } };

  const rowCells: string[][] = [];
  const rowCellsHtml: string[][] = [];
  for (const r of allRows) {
    const matches = [...r.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)];
    rowCells.push(matches.map((m) => stripTags(m[1])));
    rowCellsHtml.push(matches.map((m) => m[1]));
  }

  let headerIdx = -1;
  for (let i = 0; i < rowCells.length; i++) {
    const lower = rowCells[i].map((c) => c.toLowerCase());
    const hasEventDate = lower.some((c) => c === "event date" || c.includes("event date"));
    const hasClient = lower.some((c) => c === "client" || c === "name" || c.includes("client"));
    if (hasEventDate && hasClient) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    return {
      rows: [],
      debug: {
        reason: "no-header-row",
        rowCount: allRows.length,
        sampleHeaders: rowCells.slice(0, 12).map((cs) => cs.slice(0, 10)),
      },
    };
  }

  const headerCellsRaw = rowCells[headerIdx];
  const expectedLen = headerCellsRaw.length;
  const headerCellsLower = headerCellsRaw.map((c) => c.toLowerCase());

  const dataRowsPairs: { cells: string[]; cellsHtml: string[] }[] = [];
  for (let i = headerIdx + 1; i < rowCells.length; i++) {
    if (rowCells[i].length !== expectedLen) continue;
    // Skip rows that are all-empty
    if (rowCells[i].every((c) => !c.trim())) continue;
    dataRowsPairs.push({ cells: rowCells[i], cellsHtml: rowCellsHtml[i] });
  }

  const debug = {
    headerIdx,
    expectedLen,
    totalRows: allRows.length,
    dataRowCount: dataRowsPairs.length,
    headers: headerCellsRaw,
  };
  if (!dataRowsPairs.length) return { rows: [], debug: { ...debug, reason: "no-data-rows" } };

  // Column indices for the most-likely useful fields, for downstream consumers.
  const findCol = (...names: string[]): number => {
    for (const n of names) {
      const i = headerCellsLower.findIndex((h) => h.includes(n));
      if (i >= 0) return i;
    }
    return -1;
  };
  const eventDateIdx = findCol("event date", "date");
  const clientIdx = findCol("client", "name");
  const roleIdx = findCol("role", "position", "assignment");
  const venueIdx = findCol("venue", "location");
  const eventIdIdx = findCol("event id", "eventid", "id");

  const rows: PastEventRow[] = [];
  for (const { cells, cellsHtml } of dataRowsPairs) {
    const fields: { label: string; value: string }[] = [];
    for (let i = 0; i < cells.length; i++) {
      const val = cells[i].trim();
      if (!val) continue;
      const label = (headerCellsRaw[i] ?? `Column ${i}`).trim();
      if (!label) continue;
      fields.push({ label, value: val });
    }
    if (!fields.length) continue;

    const eventId = eventIdIdx >= 0 ? (cells[eventIdIdx] ?? "").trim() : "";
    const eventDate = eventDateIdx >= 0 ? (cells[eventDateIdx] ?? "").trim() : "";
    const client = clientIdx >= 0 ? (cells[clientIdx] ?? "").trim() : "";

    let eventUrl: string | undefined;
    if (eventId && /^\d+$/.test(eventId)) {
      eventUrl = `${DJEP_URL.replace(/base2\.asp$/, "")}events_report.asp?eventid=${eventId}`;
    }
    if (!eventUrl && eventDateIdx >= 0) eventUrl = extractHref(cellsHtml[eventDateIdx] ?? "");
    if (!eventUrl && clientIdx >= 0) eventUrl = extractHref(cellsHtml[clientIdx] ?? "");

    const id = `djep-past-${eventId || `${client}-${eventDate}`}`.replace(/\s+/g, "-");

    rows.push({
      id,
      fields,
      ...(eventUrl ? { eventUrl } : {}),
    });
  }

  return { rows, debug: { ...debug, eventDateIdx, clientIdx, roleIdx, venueIdx, eventIdIdx, parsedRows: rows.length } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronHeader = req.headers.get("x-cron-secret");
  let cronAuthed = false;
  if (cronHeader) {
    const { data: secretRow } = await supabase
      .from("cron_secrets")
      .select("secret")
      .eq("name", CRON_SECRET_NAME)
      .maybeSingle();
    if (secretRow?.secret && cronHeader === secretRow.secret) cronAuthed = true;
  }
  if (!cronAuthed) {
    const denial = await requireOperator(req);
    if (denial) return denial;
  }

  if (!FIRECRAWL_API_KEY) {
    return jsonResponse({ configured: false, rows: [], error: "FIRECRAWL_API_KEY not set" });
  }
  if (!DJEP_USERNAME || !DJEP_PASSWORD) {
    return jsonResponse({ configured: false, rows: [], error: "DJEP_USERNAME / DJEP_PASSWORD not set" });
  }

  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const forceRefresh = url.searchParams.get("refresh") === "1";

  if (!forceRefresh) {
    const cached = await getCachedRows();
    if (cached) {
      return jsonResponse({
        configured: true,
        rows: cached.rows,
        cached: true,
        refreshed_at: cached.refreshed_at,
        expires_at: cached.expires_at,
        debug: debug ? { count: cached.rows.length, source: "cache" } : { count: cached.rows.length },
      });
    }
  }

  try {
    const { rows, raw } = await firecrawlScrape();
    const meta = await writeCache(rows, raw);
    return jsonResponse({
      configured: true,
      rows,
      cached: false,
      refreshed_at: meta.refreshed_at,
      expires_at: meta.expires_at,
      debug: debug
        ? { count: rows.length, sampleRows: rows.slice(0, 5), raw }
        : { count: rows.length },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("DJEP past-events scrape error:", msg);
    const stale = await supabase
      .from("djep_events_cache")
      .select("events, refreshed_at, expires_at")
      .eq("cache_key", CACHE_KEY)
      .maybeSingle();
    if (stale.data) {
      return jsonResponse({
        configured: true,
        rows: stale.data.events ?? [],
        cached: true,
        stale: true,
        refreshed_at: stale.data.refreshed_at,
        expires_at: stale.data.expires_at,
        error: msg,
      });
    }
    return jsonResponse({ configured: true, rows: [], error: msg }, 200);
  }
});
