// Scrapes DJ Event Planner (baltimoresoundeventmanager.com) using Firecrawl.
// Logs into the ASP site, navigates to "Web Links → SALES - MILLER", and
// returns the events list filtered by the configured salesperson, with the
// "Next Action Date" column driving the calendar date.
//
// Behavior:
//   GET ?debug=1   → returns raw markdown + parsed events for inspection
//   GET (default)  → returns { configured, events, debug? } in the same shape
//                    as monday-calendar-events for easy widget consumption.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const DJEP_USERNAME = Deno.env.get("DJEP_USERNAME");
const DJEP_PASSWORD = Deno.env.get("DJEP_PASSWORD");

const DJEP_URL = "https://baltimoresoundeventmanager.com/dj_event_planner/base2.asp";
const SALESPERSON_LINK_TEXT = "SALES - MILLER";
const SALESPERSON_NAME = "Josh Miller"; // shown on each row; used as a sanity filter

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

async function firecrawlScrape(): Promise<{ markdown: string; raw: any }> {
  // Use Firecrawl actions to log in, click into Web Links → Sales - Miller,
  // wait for the events list grid to render, and finally scrape markdown.
  const body = {
    url: DJEP_URL,
    formats: ["markdown"],
    onlyMainContent: false,
    waitFor: 1500,
    actions: [
      { type: "wait", milliseconds: 1500 },
      { type: "write", text: DJEP_USERNAME, selector: "input[name='UserName'], input[id*='UserName'], input[name='Username'], input[type='text']" },
      { type: "write", text: DJEP_PASSWORD, selector: "input[type='password']" },
      { type: "click", selector: "input[type='submit'], button[type='submit']" },
      { type: "wait", milliseconds: 2500 },
      // Open the Web Links section in the left nav.
      { type: "click", text: "Web Links" },
      { type: "wait", milliseconds: 1500 },
      // Click the "SALES - MILLER" link.
      { type: "click", text: SALESPERSON_LINK_TEXT },
      { type: "wait", milliseconds: 3500 },
      { type: "scrape" },
    ],
  };

  const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await r.json();
  if (!r.ok) {
    throw new Error(`Firecrawl ${r.status}: ${JSON.stringify(data).slice(0, 600)}`);
  }
  // v2 returns { success, data: { markdown, ... } } typically; some shapes nest under data.
  const markdown =
    data?.data?.markdown ??
    data?.markdown ??
    data?.data?.actions?.scrapes?.[0]?.markdown ??
    "";

  return { markdown, raw: data };
}

// Parse a markdown table row from the events list. The Sales - Miller view
// is a single grid with these visible columns (per the user's screenshot):
// Event Date | Client | Status | Next Action | Next Action Date | Event Type
// | Package | Start-End Time | Assigned Employees | Venue | Setup Time
// | Start Time | End Time | Addons | Salesperson | Total Fee | Balance Due
// | Date Booked | TSB or BSE | Open In New Tab | Event ID
//
// Firecrawl's markdown for HTML grids commonly emits each row as a `|` separated
// line. We try that first, then fall back to a heuristic line scan.

function parseDjepEvents(markdown: string): DjepEvent[] {
  const events: DjepEvent[] = [];
  if (!markdown) return events;

  // Try strict markdown table parse first.
  const lines = markdown.split("\n");
  // Find header line containing both "Event Date" and "Next Action Date".
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes("event date") && lower.includes("next action date") && lines[i].includes("|")) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx >= 0) {
    const headerCells = lines[headerIdx]
      .split("|")
      .map((c) => c.trim().toLowerCase())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1 || (idx === 0 && arr[0] !== ""));
    const colIdx = (name: string) => headerCells.findIndex((c) => c.includes(name));
    const idxNextActionDate = colIdx("next action date");
    const idxClient = colIdx("client");
    const idxNextAction = colIdx("next action");
    const idxEventDate = colIdx("event date");
    const idxStatus = colIdx("status");
    const idxEventType = colIdx("event type");
    const idxVenue = colIdx("venue");
    const idxSalesperson = colIdx("salesperson");
    const idxEventId = colIdx("event id");

    for (let i = headerIdx + 2; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes("|")) break;
      // Skip the alignment row "| --- | --- |"
      if (/^\s*\|?\s*[-: ]+\s*\|/.test(line) && !line.match(/[A-Za-z0-9]/)) continue;

      const cells = line.split("|").map((c) => c.trim());
      // Markdown rows usually start and end with "|", giving leading/trailing empties.
      const firstReal = cells[0] === "" ? 1 : 0;
      const trimmed = cells.slice(firstReal, cells[cells.length - 1] === "" ? -1 : undefined);

      const get = (i: number) => (i >= 0 && i < trimmed.length ? trimmed[i] : "");

      const nextActionDateRaw = get(idxNextActionDate);
      if (!nextActionDateRaw) continue;
      const parsed = parseDate(nextActionDateRaw);
      if (!parsed) continue;

      // Filter by salesperson if the column is present.
      const salesperson = get(idxSalesperson);
      if (salesperson && !salesperson.toLowerCase().includes("miller")) continue;

      const client = get(idxClient) || "Lead";
      const action = get(idxNextAction);
      const eventDate = get(idxEventDate);
      const status = get(idxStatus);
      const eventType = get(idxEventType);
      const venue = get(idxVenue);
      const eventId = get(idxEventId);

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
        id: `djep-${eventId || `${i}-${client}`}`.replace(/\s+/g, "-"),
        title,
        start: startISO,
        end: startISO,
        allDay: true,
        source: "djep",
        sourceLabel: "DJEP Leads",
        color: "#10b981", // emerald — distinct from Monday purple
        fields,
        itemUrl: DJEP_URL,
      });
    }
  }

  return events;
}

function parseDate(raw: string): Date | null {
  // Common DJEP formats: "4/20/2026", "04/20/2026", "4/20/2026 3:30 PM"
  const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  let [, mo, da, yr] = m;
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
    return jsonResponse({ configured: false, events: [], error: "DJEP_USERNAME / DJEP_PASSWORD not set" });
  }

  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  try {
    const { markdown, raw } = await firecrawlScrape();
    const events = parseDjepEvents(markdown);

    return jsonResponse({
      configured: true,
      events,
      debug: debug
        ? {
            markdownLength: markdown.length,
            markdownPreview: markdown.slice(0, 4000),
            sampleEvents: events.slice(0, 5),
            rawKeys: Object.keys(raw || {}),
          }
        : { count: events.length },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("DJEP scrape error:", msg);
    return jsonResponse({ configured: true, events: [], error: msg }, 200);
  }
});
