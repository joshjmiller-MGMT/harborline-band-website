// djep-event-lookup — Cut 5 (Layer 7 of v2 architecture).
//
// Find a DJEP event record by name + date. Strategy: filter the djep_events_cache
// table populated by djep-calendar-events. The calendar function already pulls
// Josh's complete SALES-MILLER event list every hour via Firecrawl scrape; we
// just query that cache rather than re-running the (expensive) scrape per
// lookup. If the cache is empty or stale, we trigger a refresh first.
//
// P17 widening: on eventId hits, lazily fetch the per-event detail page via
// Firecrawl (using the eventUrl captured during the queue scrape), parse any
// additional label/value fields, and persist them under event_details[eventId]
// so subsequent lookups return the rich row without re-scraping.
//
// P307 widening: when the landing-page parse doesn't surface enough "rich-lead"
// target labels (ceremony/cocktail/music/notes/etc.), walk the additional tab
// URLs the landing page discovered (Music, Notes, Contract, etc.) in a single
// Firecrawl call (login session stays warm across navigations) and fuse their
// fields into the same event_details row. Heuristic-gated (Q4 option b) so a
// queue lookup that already returns rich landing data doesn't pay the multi-tab
// cost. Iframe-shell tabs (P17 hit this with events_edit.asp — 6KB shell, no
// label pairs) are detected and skipped rather than treated as parse errors.
//
// Returns the matched event(s) in a shape consumable by ingest-event's djep-scrape
// route — name, ISO date, and the field rows DJEP exposes for the event.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const DJEP_USERNAME = Deno.env.get("DJEP_USERNAME");
const DJEP_PASSWORD = Deno.env.get("DJEP_PASSWORD");
const CACHE_KEY = "djep:sales-miller";
const DJEP_BASE = "https://baltimoresoundeventmanager.com/dj_event_planner/";
// Re-scrape a detail page if cached entry is older than this. 24h is the
// pragmatic default — DJEP detail tends to evolve over a lead's lifecycle.
const DETAIL_TTL_MS = 24 * 60 * 60 * 1000;

// P307 multi-tab walk: heuristic that decides whether to walk discovered tab
// URLs after the landing page parse. If the landing page surfaces fewer than
// TARGET_THRESHOLD of these "rich-lead signal" labels, walk the tabs.
// Patterns match against the parsed field labels (case-insensitive).
const TARGET_FIELD_PATTERNS: RegExp[] = [
  /ceremony/i,
  /cocktail/i,
  /reception/i,
  /\bmusic\b|do not play|first dance|playlist/i,
  /\bnotes?\b|special request|special instruction/i,
  /package|pricing|quoted/i,
  /contract|agreement/i,
  /\bstart\s*time\b|event\s*start/i,
];
const TARGET_THRESHOLD = 3;
// Defensive cap on tabs walked per multi-call. Realistic DJEP detail surfaces
// 3-7 same-event anchors (Music/Notes/Contract/Edit/etc.); 6 covers the menu
// without paying for parse-error noise if anchor discovery misbehaves.
const MAX_TABS_TO_WALK = 6;
// Iframe-shell detection: P17 saw events_edit.asp return ~6KB with no
// label-pair markup (it's an outer frame whose iframe content didn't render
// inside Firecrawl's snapshot). Parse-attempts on this shape yield zero
// fields; cheaper to detect + skip than to parse + dedupe nothing.
const IFRAME_SHELL_MAX_BYTES = 10_000;

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

type DetailEntry = {
  fields: { label: string; value: string }[];
  scrapedAt: string;
  source: "djep-detail" | "djep-detail-multi";
  htmlLength?: number;
  htmlLengthsByTab?: Record<string, number>;
  tabUrls?: string[];
  skippedTabs?: string[];
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9& ]/g, "")
    .trim();
}

function parseDateToISO(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

function scoreEventMatch(
  event: DjepEvent,
  nameTokens: string[],
  isoDate: string | null,
): number {
  const eventTitle = normalize(event.title);
  let nameScore = 0;
  for (const tok of nameTokens) {
    if (eventTitle.includes(tok)) nameScore += 1;
  }
  const nameRatio = nameTokens.length === 0 ? 0 : nameScore / nameTokens.length;

  let dateScore = 0;
  if (isoDate) {
    const eventIso = parseDateToISO(event.start);
    if (eventIso === isoDate) dateScore = 1;
  }

  return dateScore * 0.6 + nameRatio * 0.4;
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

// Detail-page parser. DJEP's events_report.asp is an ASP-classic page rendered
// as a series of nested tables with <td>Label:</td><td>Value</td> rows, plus
// some <input>/<textarea>/<select> form widgets carrying their own values.
// Best-effort — noise lines are filtered in pushField().
function parseDetailHtml(html: string, eventId: string): {
  fields: { label: string; value: string }[];
  tabUrls: string[];
} {
  const fields: { label: string; value: string }[] = [];
  const seenLabels = new Set<string>();

  const pushField = (label: string, value: string) => {
    const cleanLabel = label.replace(/[:\s*]+$/g, "").trim();
    const cleanValue = value.trim();
    if (!cleanLabel || !cleanValue) return;
    if (cleanLabel.length > 80) return;
    if (cleanValue.length > 4000) return;
    if (/^(undefined|null|n\/a|n\.a\.|none|—|-|\.)$/i.test(cleanValue)) return;
    // Drop date-widget triplets (Month8/Day8/Year8 style names).
    if (/^(month|day|year)\d*$/i.test(cleanLabel)) return;
    // Drop form-plumbing label/value pairs that aren't user-facing.
    if (/^(parsio|trigger|automation|tablesort|customertype|orderkey)/i.test(cleanLabel)) return;
    // Drop pairs where the value itself looks like a label (header cells
    // mistakenly paired as label+value when the table is a list view).
    if (/^[A-Z][A-Za-z ]{0,30}$/.test(cleanValue) && cleanValue.split(" ").length <= 3) {
      const commonLabels = /^(ID|Name|Date|Time|Subject|Status|Action|Trigger|Employee|Type|Page Views?|IP Address|Sent Email Date|Automation Type|Browser Details|Signed)$/i;
      if (commonLabels.test(cleanValue)) return;
    }
    const dedupeKey = `${cleanLabel.toLowerCase()}|${cleanValue.toLowerCase()}`;
    if (seenLabels.has(dedupeKey)) return;
    seenLabels.add(dedupeKey);
    fields.push({ label: cleanLabel, value: cleanValue });
  };

  // Shape 1: <td>Label:</td><td>Value</td>. STRICT: only accept pairs where
  // the label ends in ":" / "：". The looser title-case heuristic mis-pairs
  // adjacent header cells in tabular lists (e.g. "Date" + "Subject").
  const cellPairRe = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>\s*<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
  for (const m of html.matchAll(cellPairRe)) {
    const labelText = stripTags(m[1]);
    const valueText = stripTags(m[2]);
    if (!labelText || !valueText) continue;
    if (!/[:：]\s*$/.test(labelText)) continue;
    pushField(labelText, valueText);
  }

  // Shape 2: <input name="..." value="...">.
  const inputRe = /<input\b([^>]*)>/gi;
  for (const m of html.matchAll(inputRe)) {
    const attrs = m[1];
    const typeMatch = attrs.match(/\btype\s*=\s*["']?([a-z]+)/i);
    const type = (typeMatch?.[1] ?? "text").toLowerCase();
    if (!["text", "hidden", "number", "tel", "email", "date", "time"].includes(type)) continue;
    const nameMatch = attrs.match(/\bname\s*=\s*["']([^"']+)["']/i);
    const valueMatch = attrs.match(/\bvalue\s*=\s*["']([^"']*)["']/i);
    if (!nameMatch || !valueMatch) continue;
    const rawName = nameMatch[1];
    const rawValue = decodeHtmlEntities(valueMatch[1]);
    if (!rawValue.trim()) continue;
    if (/^(action|submit|_|__|csrf|viewstate|eventvalidation|sessionkey|token)$/i.test(rawName)) continue;
    if (/^\d+$/.test(rawName)) continue;
    const label = rawName.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
    pushField(label, rawValue);
  }

  // Shape 3: <textarea name="...">value</textarea>.
  const textareaRe = /<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi;
  for (const m of html.matchAll(textareaRe)) {
    const attrs = m[1];
    const inner = decodeHtmlEntities(m[2]).trim();
    if (!inner) continue;
    const nameMatch = attrs.match(/\bname\s*=\s*["']([^"']+)["']/i);
    if (!nameMatch) continue;
    const label = nameMatch[1].replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
    pushField(label, inner);
  }

  // Shape 4: <select name="..."> with one <option … selected>...</option>.
  const selectRe = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
  for (const m of html.matchAll(selectRe)) {
    const attrs = m[1];
    const inner = m[2];
    const nameMatch = attrs.match(/\bname\s*=\s*["']([^"']+)["']/i);
    if (!nameMatch) continue;
    const selectedRe = /<option\b([^>]*\bselected\b[^>]*)>([\s\S]*?)<\/option>/i;
    const selected = inner.match(selectedRe);
    if (!selected) continue;
    const value = stripTags(selected[2]);
    if (!value || /^(--|select|choose|none)/i.test(value)) continue;
    const label = nameMatch[1].replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
    pushField(label, value);
  }

  // Discover tab anchors for a future multi-tab walk follow-up.
  const tabUrls = new Set<string>();
  const anchorRe = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(anchorRe)) {
    const href = decodeHtmlEntities(m[1]);
    if (!/events_(?:edit|report)\.asp/i.test(href)) continue;
    if (!new RegExp(`eventid=${eventId}\\b`, "i").test(href)) continue;
    try {
      const abs = new URL(href, DJEP_BASE).href;
      tabUrls.add(abs);
    } catch {
      // ignore
    }
  }

  return { fields, tabUrls: [...tabUrls] };
}

// Count how many of TARGET_FIELD_PATTERNS the parsed fields satisfy. Each
// pattern can match at most once — we're measuring breadth of rich-lead
// coverage, not raw label count. Below TARGET_THRESHOLD signals "walk tabs".
function countTargetCoverage(fields: { label: string; value: string }[]): number {
  let hits = 0;
  for (const pat of TARGET_FIELD_PATTERNS) {
    if (fields.some((f) => pat.test(f.label))) hits += 1;
  }
  return hits;
}

// Iframe-shell: small HTML AND no <td>Label:</td><td>Value</td> pairs anywhere.
// Both conditions required — a small page that does have label pairs is just a
// terse detail tab, not a shell. P17 hit this with events_edit.asp.
function isIframeShell(html: string): boolean {
  if (html.length >= IFRAME_SHELL_MAX_BYTES) return false;
  return !/<td[^>]*>[^<]{0,200}[:：]\s*<\/td>\s*<td/i.test(html);
}

// Merge multiple field bags with first-source-wins per label (case-insensitive).
// Order of `bags` is precedence order: bags[0] highest, bags[N] lowest. Used to
// fuse landing-page parse + each tab parse before the queue-vs-detail merge runs.
function mergeFieldBags(
  ...bags: { label: string; value: string }[][]
): { label: string; value: string }[] {
  const seen = new Set<string>();
  const out: { label: string; value: string }[] = [];
  for (const bag of bags) {
    for (const f of bag) {
      const key = f.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
  }
  return out;
}

async function firecrawlEventDetail(eventUrl: string): Promise<{ html: string; debug: unknown }> {
  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");
  if (!DJEP_USERNAME || !DJEP_PASSWORD) throw new Error("DJEP_USERNAME / DJEP_PASSWORD not configured");

  const submitLoginJs = `
    (() => {
      try {
        var u = document.querySelector("input[name='username']");
        var p = document.querySelector("input[name='password']");
        if (!u || !p) return { ok: false, reason: 'no-fields' };
        u.value = ${JSON.stringify(DJEP_USERNAME ?? "")};
        u.dispatchEvent(new Event('input', { bubbles: true }));
        p.value = ${JSON.stringify(DJEP_PASSWORD ?? "")};
        p.dispatchEvent(new Event('input', { bubbles: true }));
        var form = u.form || document.querySelector("form[name='logonform']") || document.forms[0];
        if (!form) return { ok: false, reason: 'no-form' };
        var btn = form.querySelector("input[type='submit'], button[type='submit']");
        if (btn) { btn.click(); } else { HTMLFormElement.prototype.submit.call(form); }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e && e.message || e) };
      }
    })();
  `;

  const navigateToDetailJs = `
    (() => {
      window.location.href = ${JSON.stringify(eventUrl)};
      return { ok: true, target: ${JSON.stringify(eventUrl)} };
    })();
  `;

  const body = {
    // Start at base2.asp — the login redirect lands back here after submitLogin.
    // After login the session cookie lets us navigate to any events_report.asp?eventid=… URL.
    url: "https://baltimoresoundeventmanager.com/dj_event_planner/base2.asp",
    formats: ["html"],
    onlyMainContent: false,
    waitFor: 2000,
    timeout: 120000,
    actions: [
      { type: "wait", milliseconds: 1500 },
      { type: "executeJavascript", script: submitLoginJs },
      { type: "wait", milliseconds: 5000 },
      { type: "executeJavascript", script: navigateToDetailJs },
      { type: "wait", milliseconds: 6000 },
      { type: "executeJavascript", script: `(() => ({ url: location.href, title: document.title, htmlLength: document.documentElement.outerHTML.length }))()` },
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
    throw new Error(`Firecrawl detail scrape returned no HTML. Keys: ${Object.keys(data || {}).join(",")}`);
  }
  return {
    html,
    debug: {
      htmlLength: html.length,
      actionResults: data?.actions?.javascriptReturns ?? data?.actions?.scripts ?? null,
    },
  };
}

// Single Firecrawl call: login once, then for each tab URL navigate + wait +
// scrape. The shared login session keeps cookies warm across tabs; if we made
// one Firecrawl call per tab we'd re-pay the login latency (and re-render
// base2.asp) each time. Returns html keyed by tabUrl in input order.
async function firecrawlEventDetailMulti(
  tabUrls: string[],
): Promise<{ htmlByTab: Record<string, string>; debug: unknown }> {
  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");
  if (!DJEP_USERNAME || !DJEP_PASSWORD) {
    throw new Error("DJEP_USERNAME / DJEP_PASSWORD not configured");
  }
  if (tabUrls.length === 0) {
    throw new Error("firecrawlEventDetailMulti called with no tabUrls");
  }

  const submitLoginJs = `
    (() => {
      try {
        var u = document.querySelector("input[name='username']");
        var p = document.querySelector("input[name='password']");
        if (!u || !p) return { ok: false, reason: 'no-fields' };
        u.value = ${JSON.stringify(DJEP_USERNAME ?? "")};
        u.dispatchEvent(new Event('input', { bubbles: true }));
        p.value = ${JSON.stringify(DJEP_PASSWORD ?? "")};
        p.dispatchEvent(new Event('input', { bubbles: true }));
        var form = u.form || document.querySelector("form[name='logonform']") || document.forms[0];
        if (!form) return { ok: false, reason: 'no-form' };
        var btn = form.querySelector("input[type='submit'], button[type='submit']");
        if (btn) { btn.click(); } else { HTMLFormElement.prototype.submit.call(form); }
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e && e.message || e) };
      }
    })();
  `;

  const perTabActions: unknown[] = [];
  for (const url of tabUrls) {
    const navJs = `
      (() => {
        window.location.href = ${JSON.stringify(url)};
        return { ok: true, target: ${JSON.stringify(url)} };
      })();
    `;
    perTabActions.push(
      { type: "executeJavascript", script: navJs },
      { type: "wait", milliseconds: 5000 },
      { type: "scrape" },
    );
  }

  const body = {
    url: "https://baltimoresoundeventmanager.com/dj_event_planner/base2.asp",
    formats: ["html"],
    onlyMainContent: false,
    waitFor: 2000,
    // Total budget = login (~6.5s) + N * (nav 0s + wait 5s + scrape ~3-6s).
    // Six tabs ≈ 80s. 180s gives ample headroom.
    timeout: 180000,
    actions: [
      { type: "wait", milliseconds: 1500 },
      { type: "executeJavascript", script: submitLoginJs },
      { type: "wait", milliseconds: 5000 },
      ...perTabActions,
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
    throw new Error(`Firecrawl multi-scrape ${res.status}: ${JSON.stringify(json).slice(0, 600)}`);
  }
  const data = json?.data ?? json;
  const scrapes = data?.actions?.scrapes ?? data?.actions?.scrape ?? [];
  if (!Array.isArray(scrapes)) {
    throw new Error(`Firecrawl multi-scrape: unexpected actions.scrapes shape (${typeof scrapes})`);
  }

  // scrapes[i] corresponds to tabUrls[i] by action order. If Firecrawl returned
  // fewer scrapes than tabs (timeout truncation), the missing tabs map to "".
  const htmlByTab: Record<string, string> = {};
  for (let i = 0; i < tabUrls.length; i++) {
    const entry = scrapes[i];
    const html = entry?.html ?? entry?.content ?? "";
    htmlByTab[tabUrls[i]] = html;
  }

  return {
    htmlByTab,
    debug: {
      scrapesReturned: scrapes.length,
      tabsRequested: tabUrls.length,
      htmlLengthsByTab: Object.fromEntries(
        Object.entries(htmlByTab).map(([k, v]) => [k, v.length]),
      ),
    },
  };
}

async function persistEventDetail(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  entry: DetailEntry,
): Promise<void> {
  // Read-modify-write on the event_details jsonb column. Detail scrapes are
  // lazy-on-lookup, so contention is negligible; an atomic jsonb_set RPC would
  // be a future optimization, not a v1 need.
  const { data: existing, error: readErr } = await supabase
    .from("djep_events_cache")
    .select("event_details")
    .eq("cache_key", CACHE_KEY)
    .maybeSingle();
  if (readErr) {
    console.error("persistEventDetail read failed:", readErr.message);
    return;
  }
  const merged: Record<string, DetailEntry> = {
    ...((existing as { event_details?: Record<string, DetailEntry> } | null)?.event_details ?? {}),
    [eventId]: entry,
  };
  const { error: writeErr } = await supabase
    .from("djep_events_cache")
    .update({ event_details: merged })
    .eq("cache_key", CACHE_KEY);
  if (writeErr) {
    console.error("persistEventDetail write failed:", writeErr.message);
  }
}

async function maybeRefreshCache(supabase: ReturnType<typeof createClient>): Promise<void> {
  const { data } = await supabase
    .from("djep_events_cache")
    .select("expires_at")
    .eq("cache_key", CACHE_KEY)
    .maybeSingle();
  const expiresAt = (data as { expires_at?: string } | null)?.expires_at;
  if (expiresAt && new Date(expiresAt).getTime() > Date.now()) return;
  await fetch(`${SUPABASE_URL}/functions/v1/djep-calendar-events?refresh=1`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  }).catch(() => undefined);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const date = typeof body?.date === "string" ? body.date.trim() : "";
    const eventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
    if (!name && !eventId) {
      return jsonResponse({ error: "name or eventId required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    await maybeRefreshCache(supabase);

    const { data, error } = await supabase
      .from("djep_events_cache")
      .select("events, event_details, refreshed_at")
      .eq("cache_key", CACHE_KEY)
      .maybeSingle();
    if (error) throw new Error(`cache read failed: ${error.message}`);

    const events = ((data as { events?: DjepEvent[] } | null)?.events) ?? [];
    const eventDetails = ((data as { event_details?: Record<string, DetailEntry> } | null)?.event_details) ?? {};
    if (events.length === 0) {
      return jsonResponse({
        matches: [],
        total_in_cache: 0,
        cache_refreshed_at: (data as { refreshed_at?: string } | null)?.refreshed_at ?? null,
        note: "DJEP cache is empty.",
      });
    }

    if (eventId) {
      const idNorm = eventId.toLowerCase();
      const idLabelMatch = (label: string): boolean => {
        const norm = label.toLowerCase().replace(/[\s_-]+/g, "");
        return norm === "eventid" || norm === "id";
      };
      const idHits: DjepEvent[] = events.filter((e) => {
        if (e.id.toLowerCase() === idNorm) return true;
        if (e.id.toLowerCase() === `djep-${idNorm}`) return true;
        for (const f of e.fields) {
          if (idLabelMatch(f.label) && f.value.trim().toLowerCase() === idNorm) return true;
        }
        return false;
      });

      // event_details is keyed by numeric event ID and may carry a row even
      // when the SALES-MILLER queue (events[]) doesn't — e.g. a previously
      // scraped lead that fell off the queue's filter. Synthesize a stub from
      // the cached detail so the lookup still returns something usable.
      if (idHits.length === 0 && eventDetails[eventId]) {
        const cached = eventDetails[eventId];
        const findField = (re: RegExp) =>
          cached.fields.find((f) => re.test(f.label))?.value ?? "";
        const detailUrl = `${DJEP_BASE}events_report.asp?eventid=${eventId}`;
        idHits.push({
          id: `djep-${eventId}`,
          title: findField(/^(event\s*)?title$|^event\s*name$|^client$/i) ||
            `DJEP event ${eventId}`,
          start: findField(/^(event\s*)?date$|^start/i),
          end: "",
          allDay: true,
          source: "djep",
          sourceLabel: "DJEP",
          color: "",
          fields: [],
          itemUrl: detailUrl,
          eventUrl: detailUrl,
        });
      }

      if (idHits.length === 0) {
        return jsonResponse({
          matches: [],
          total_in_cache: events.length,
          cache_refreshed_at: (data as { refreshed_at?: string } | null)?.refreshed_at ?? null,
          mode: "eventId",
          not_found: "eventId",
          note: `Event ID ${eventId} isn't in the DJEP cache (${events.length} event${events.length === 1 ? "" : "s"} cached from the SALES-MILLER queue). Try searching by client name + event date instead.`,
        }, 404);
      }

      // P17 — lazy detail-page scrape. P307 — additional multi-tab walk gated
      // by a target-field coverage heuristic.
      //   detail:"skip"        → queue fields only, no Firecrawl
      //   detail:"force"       → re-scrape landing page; multi-walk if heuristic fires
      //   detail:"force-multi" → re-scrape landing AND always multi-walk (bypass heuristic)
      //   (default)            → use cache if fresh, else re-scrape landing + heuristic
      const detailFlag = String(body?.detail ?? "").toLowerCase();
      const wantDetail = detailFlag !== "skip";
      const forceDetail = detailFlag === "force" || detailFlag === "force-multi";
      const forceMulti = detailFlag === "force-multi";
      const detailLog: Record<string, unknown> = {};
      const enrichedHits: typeof idHits = [];
      for (const event of idHits) {
        const eventNumericId = (event.fields.find((f) => idLabelMatch(f.label))?.value.trim()) || eventId;
        const cachedDetail = eventDetails[eventNumericId];
        const cachedFresh = cachedDetail &&
          Date.now() - new Date(cachedDetail.scrapedAt).getTime() < DETAIL_TTL_MS;

        let detailFields = cachedDetail?.fields ?? [];
        let detailSource:
          | "cached"
          | "fresh"
          | "fresh-multi"
          | "skipped"
          | "error"
          | "no-url" = cachedDetail ? "cached" : "skipped";

        if (wantDetail && event.eventUrl && (forceDetail || !cachedDetail || !cachedFresh)) {
          if (!FIRECRAWL_API_KEY || !DJEP_USERNAME || !DJEP_PASSWORD) {
            detailSource = "skipped";
            detailLog[eventNumericId] = { skipped: "missing Firecrawl/DJEP env" };
          } else {
            try {
              // Pass 1: landing page (events_report.asp). Always runs — its
              // anchor scan also feeds the tabUrls candidate set for pass 2.
              const { html, debug: scrapeDebug } = await firecrawlEventDetail(event.eventUrl);
              const landingParsed = parseDetailHtml(html, eventNumericId);
              const landingHtmlLength = (scrapeDebug as { htmlLength?: number })?.htmlLength;
              const targetHits = countTargetCoverage(landingParsed.fields);

              // Pass 2 (heuristic): if landing coverage is thin AND we have
              // additional tabs to visit, walk them in one Firecrawl call.
              // Filter out the landing URL itself + cap at MAX_TABS_TO_WALK.
              const landingNormalized = event.eventUrl.split("#")[0];
              const candidateTabs = landingParsed.tabUrls.filter(
                (u) => u.split("#")[0] !== landingNormalized,
              );
              const needsMultiWalk = (forceMulti || targetHits < TARGET_THRESHOLD) &&
                candidateTabs.length > 0;
              const tabsToWalk = candidateTabs.slice(0, MAX_TABS_TO_WALK);

              let multiDebug: unknown = null;
              let mergedDetailFields = landingParsed.fields;
              const htmlLengthsByTab: Record<string, number> = {};
              const skippedTabs: string[] = [];

              if (needsMultiWalk) {
                try {
                  const { htmlByTab, debug } = await firecrawlEventDetailMulti(tabsToWalk);
                  multiDebug = debug;
                  const tabFieldBags: { label: string; value: string }[][] = [];
                  for (const url of tabsToWalk) {
                    const tabHtml = htmlByTab[url] ?? "";
                    htmlLengthsByTab[url] = tabHtml.length;
                    if (!tabHtml || isIframeShell(tabHtml)) {
                      skippedTabs.push(url);
                      continue;
                    }
                    const parsed = parseDetailHtml(tabHtml, eventNumericId);
                    tabFieldBags.push(parsed.fields);
                  }
                  mergedDetailFields = mergeFieldBags(
                    landingParsed.fields,
                    ...tabFieldBags,
                  );
                  detailSource = "fresh-multi";
                } catch (multiErr) {
                  // Multi-walk failed — fall back to landing-only rather than
                  // erroring the whole request. The landing fields are still
                  // valuable; surface the failure in detail_log.
                  detailSource = "fresh";
                  detailLog[`${eventNumericId}_multi_error`] =
                    multiErr instanceof Error ? multiErr.message : String(multiErr);
                }
              } else {
                detailSource = "fresh";
              }

              const entry: DetailEntry = {
                fields: mergedDetailFields,
                scrapedAt: new Date().toISOString(),
                source: detailSource === "fresh-multi" ? "djep-detail-multi" : "djep-detail",
                htmlLength: landingHtmlLength,
                tabUrls: landingParsed.tabUrls,
                ...(detailSource === "fresh-multi"
                  ? { htmlLengthsByTab, skippedTabs }
                  : {}),
              };
              await persistEventDetail(supabase, eventNumericId, entry);
              detailFields = mergedDetailFields;
              detailLog[eventNumericId] = {
                landing_fields: landingParsed.fields.length,
                merged_fields: mergedDetailFields.length,
                target_hits: targetHits,
                target_threshold: TARGET_THRESHOLD,
                landing_tab_urls: landingParsed.tabUrls.length,
                tabs_walked: needsMultiWalk ? tabsToWalk.length : 0,
                tabs_skipped_shell: skippedTabs.length,
                landing_html_length: landingHtmlLength,
                ...(needsMultiWalk ? { multi_debug: multiDebug } : {}),
                actionResults: (scrapeDebug as { actionResults?: unknown })?.actionResults,
              };
            } catch (e) {
              detailSource = "error";
              detailLog[eventNumericId] = { error: e instanceof Error ? e.message : String(e) };
            }
          }
        } else if (!event.eventUrl) {
          detailSource = "no-url";
        }

        // Fuse queue + detail fields. Queue wins on collision; detail-only
        // labels appended.
        const queueLabels = new Set(event.fields.map((f) => f.label.toLowerCase()));
        const merged = [
          ...event.fields,
          ...detailFields.filter((f) => !queueLabels.has(f.label.toLowerCase())),
        ];
        enrichedHits.push({
          ...event,
          fields: merged,
          // deno-lint-ignore no-explicit-any
          ...({ _detailSource: detailSource } as any),
        });
      }

      const matches = enrichedHits.slice(0, 10).map((event) => ({
        djep_id: event.id,
        title: event.title,
        event_date: parseDateToISO(event.start),
        fields: event.fields,
        source_url: event.eventUrl ?? event.itemUrl,
        match_score: 1,
        // deno-lint-ignore no-explicit-any
        detail_source: (event as any)._detailSource as string,
      }));

      return jsonResponse({
        matches,
        total_in_cache: events.length,
        cache_refreshed_at: (data as { refreshed_at?: string } | null)?.refreshed_at ?? null,
        mode: "eventId",
        detail_log: detailLog,
      });
    }

    const nameTokens = normalize(name).split(" ").filter((t) => t.length >= 2);
    const isoDate = parseDateToISO(date);
    const scored = events
      .map((e) => ({ event: e, score: scoreEventMatch(e, nameTokens, isoDate) }))
      .filter((r) => r.score >= 0.4)
      .sort((a, b) => b.score - a.score);
    const matches = scored.slice(0, 10).map(({ event, score }) => ({
      djep_id: event.id,
      title: event.title,
      event_date: parseDateToISO(event.start),
      fields: event.fields,
      source_url: event.itemUrl,
      match_score: Number(score.toFixed(2)),
    }));
    return jsonResponse({
      matches,
      total_in_cache: events.length,
      cache_refreshed_at: (data as { refreshed_at?: string } | null)?.refreshed_at ?? null,
      mode: "search",
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
