// ingest-event — Sub-Plan 03 v2 architecture, Layers 2-4.
//
// Cut 3: LLM extraction (Anthropic Sonnet 4.6) handles Shape W AND enriches
// Shape A/B/C/D rows for fields the deterministic parsers missed. Prior data
// is never clobbered — LLM only fills nulls in the existing extraction.
//
// Routes:
//   paste         — pasted free text. Triggers shape detection + parser run.
//   drive-url     — Drive file ID + optional pre-fetched text (Drive read happens
//                   in Cut 5; if caller passes payload.text, it parses now).
//   djep-scrape   — { name, date } → Firecrawl scrape (full scrape in Cut 5).
//   drive-search  — { name, date } → Drive search (full search in Cut 5).
//
// Request shape: { route, name, eventDate, organization?, eventType?, payload }
// Response shape: { id, route, sourceFile, merged, shape?, fields?, warnings? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { detectShape } from "./shape-detector.ts";
import { parseShapeA } from "./parser-a-tsb-narrative.ts";
import { parseShapeB } from "./parser-b-dj-qa.ts";
import { parseShapeC } from "./parser-c-ceremony.ts";
import { parseShapeD } from "./parser-d-harborline-sheet.ts";
import { extractCanonicalEvent } from "./llm-extract.ts";
import type {
  CanonicalEventFields,
  ParseResult,
  Shape,
} from "./canonical-event-types.ts";

const EXTRACTOR_VERSION = "v2.4-cut6-drive-fetch";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");

// Drive export mapping: Google-native MIME → text export MIME.
// Anything not listed uses files.get?alt=media (raw bytes) — non-text formats
// like PDF/DOCX/PPTX aren't parsed here; the caller should pre-fetch + extract
// text before posting, or punt to LLM-via-OCR in a future cut.
const DRIVE_EXPORT_MIME: Record<string, string> = {
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.presentation": "text/plain",
};

async function refreshGoogleToken(supabase: any, row: any): Promise<string> {
  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const refreshed = await refreshRes.json();
  if (!refreshRes.ok) {
    await supabase
      .from("google_calendar_tokens")
      .update({
        needs_reconnect: true,
        last_refresh_error: JSON.stringify(refreshed).slice(0, 500),
        last_refresh_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    throw new Error(`Google token refresh failed: ${JSON.stringify(refreshed)}`);
  }
  const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase
    .from("google_calendar_tokens")
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpires,
      needs_reconnect: false,
      last_refresh_at: new Date().toISOString(),
      last_refresh_error: null,
    })
    .eq("id", row.id);
  return refreshed.access_token;
}

async function getGoogleAccessToken(supabase: any): Promise<string | null> {
  const { data: rows } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1);
  const row = rows?.[0];
  if (!row) return null;
  const expiresAt = new Date(row.expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) return row.access_token;
  return await refreshGoogleToken(supabase, row);
}

// Cut 6: backend fetch of Drive file content. Supports Google-native Docs and
// Sheets via files.export (text/plain and text/csv respectively). Raw formats
// like PDF/DOCX go through files.get?alt=media but we don't extract text from
// the binary here — caller should pre-fetch + parse those formats. Returns
// { text, mimeType } or throws with a structured error message.
async function fetchDriveFileText(
  supabase: any,
  driveId: string,
  hintMime?: string,
): Promise<{ text: string; mimeType: string }> {
  const accessToken = await getGoogleAccessToken(supabase);
  if (!accessToken) {
    throw new Error("no_google_account_connected: connect a Google account on /team/dashboard first");
  }

  // Resolve real MIME if caller didn't supply one (lets the UI just pass a Drive URL).
  let mimeType = hintMime || "";
  if (!mimeType) {
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveId}?fields=mimeType,name`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!metaRes.ok) {
      const err = await metaRes.text();
      throw new Error(`drive_meta_failed (${metaRes.status}): ${err.slice(0, 200)}`);
    }
    const meta = await metaRes.json();
    mimeType = meta.mimeType || "";
  }

  const exportMime = DRIVE_EXPORT_MIME[mimeType];
  const url = exportMime
    ? `https://www.googleapis.com/drive/v3/files/${driveId}/export?mimeType=${encodeURIComponent(exportMime)}`
    : `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`;

  let res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401) {
    const { data: rows } = await supabase
      .from("google_calendar_tokens")
      .select("*").order("created_at", { ascending: true }).limit(1);
    const fresh = await refreshGoogleToken(supabase, rows![0]);
    res = await fetch(url, { headers: { Authorization: `Bearer ${fresh}` } });
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`drive_fetch_failed (${res.status}): ${err.slice(0, 200)}`);
  }

  // For non-Google-native formats we just return the raw text as-is. PDFs etc
  // will return binary that won't parse usefully — caller should detect and
  // pre-process those formats before posting.
  const text = await res.text();
  return { text, mimeType };
}

type Route = "paste" | "drive-url" | "djep-scrape" | "drive-search";

type SourceFile = {
  url?: string;
  source_type:
    | "paste"
    | "drive-doc"
    | "drive-sheet"
    | "docx"
    | "pdf"
    | "djep-scrape"
    | "drive-search-hit"
    | "unknown";
  drive_id?: string;
  modified_at?: string;
  detected_shape?: Shape | null;
  extracted_excerpt?: string;
  is_blank_starter?: boolean;
  ingested_at: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// DJEP match → plain-text representation the parsers/LLM can read. Each
// DJEP field row becomes a "Label: value" line — Shape B-friendly format.
function formatDjepMatchAsText(match: {
  title?: string;
  event_date?: string;
  fields?: { label: string; value: string }[];
  source_url?: string;
}): string {
  const lines: string[] = [];
  if (match.title) lines.push(`DJEP Event: ${match.title}`);
  if (match.event_date) lines.push(`Wedding Date: ${match.event_date}`);
  for (const row of match.fields || []) {
    if (row.label && row.value) {
      lines.push(`${row.label}: ${row.value}`);
    }
  }
  if (match.source_url) lines.push(`\nSource: ${match.source_url}`);
  return lines.join("\n");
}

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\p{P}]+$/u, "");
}

function parseEventDateToISO(raw: string): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) {
    const [, mo, d, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (m) {
    const [, mo, d, yy] = m;
    return `20${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const monthsLong = [
    "january","february","march","april","may","june",
    "july","august","september","october","november","december",
  ];
  const monthsShort = [
    "jan","feb","mar","apr","may","jun",
    "jul","aug","sep","oct","nov","dec",
  ];
  const lower = s.toLowerCase().replace(/,/g, "");
  m = lower.match(/^(\w+)\s+(\d{1,2})\s+(\d{4})$/);
  if (m) {
    const [, monStr, d, y] = m;
    const idx = monthsLong.indexOf(monStr);
    const idxShort = monthsShort.indexOf(monStr);
    const monthNum = idx >= 0 ? idx + 1 : idxShort >= 0 ? idxShort + 1 : 0;
    if (monthNum > 0) {
      return `${y}-${String(monthNum).padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  return null;
}

function buildSourceFileForRoute(
  route: Route,
  payload: Record<string, unknown> | undefined,
): SourceFile {
  const ingested_at = new Date().toISOString();
  const p = payload ?? {};
  const text = typeof p.text === "string" ? p.text
    : typeof p.rawText === "string" ? p.rawText
    : "";
  switch (route) {
    case "paste":
      return {
        source_type: "paste",
        detected_shape: null,
        extracted_excerpt: text.slice(0, 500),
        ingested_at,
      };
    case "drive-url": {
      const url = typeof p.url === "string" ? p.url : undefined;
      const drive_id = typeof p.driveId === "string" ? p.driveId : undefined;
      const mime = typeof p.mimeType === "string" ? p.mimeType : "";
      let source_type: SourceFile["source_type"] = "unknown";
      if (mime.includes("spreadsheet")) source_type = "drive-sheet";
      else if (mime.includes("document")) source_type = "drive-doc";
      else if (mime.includes("pdf")) source_type = "pdf";
      else if (mime.includes("wordprocessingml")) source_type = "docx";
      return {
        url,
        drive_id,
        source_type,
        modified_at: typeof p.modifiedAt === "string" ? p.modifiedAt : undefined,
        detected_shape: null,
        extracted_excerpt: text.slice(0, 500),
        ingested_at,
      };
    }
    case "djep-scrape":
      return {
        source_type: "djep-scrape",
        url: typeof p.djepUrl === "string" ? p.djepUrl : undefined,
        detected_shape: null,
        extracted_excerpt: text.slice(0, 500),
        ingested_at,
      };
    case "drive-search":
      return {
        source_type: "drive-search-hit",
        url: typeof p.url === "string" ? p.url : undefined,
        drive_id: typeof p.driveId === "string" ? p.driveId : undefined,
        modified_at: typeof p.modifiedAt === "string" ? p.modifiedAt : undefined,
        detected_shape: null,
        extracted_excerpt: text.slice(0, 500),
        ingested_at,
      };
  }
}

// Merge deterministic parser output (primary) with LLM extraction (enrichment).
// Deterministic wins on every populated field; LLM fills nulls/empties.
// Used for both Shape W (parser=null, LLM=primary) and A/B/C/D (parser=primary,
// LLM=gap-filler).
function mergeParserAndLlmFields(
  primary: CanonicalEventFields | undefined,
  enrichment: CanonicalEventFields | undefined,
): CanonicalEventFields | undefined {
  if (!primary && !enrichment) return undefined;
  if (!enrichment) return primary;
  if (!primary) return enrichment;

  const out: Record<string, unknown> = { ...primary };

  for (const k of [
    "name", "event_date", "end_date", "organization", "event_type",
    "venue_name", "attire",
  ] as const) {
    if (!out[k] && enrichment[k]) out[k] = enrichment[k];
  }

  for (const k of ["client", "venue", "contact", "guests", "logistics", "preferences"] as const) {
    const a = (out[k] as Record<string, unknown> | undefined) || {};
    const b = (enrichment[k] as Record<string, unknown> | undefined) || {};
    const combined: Record<string, unknown> = { ...a };
    for (const [field, value] of Object.entries(b)) {
      if (value !== undefined && value !== null && value !== "" && !combined[field]) {
        combined[field] = value;
      }
    }
    if (Object.keys(combined).length > 0) out[k] = combined;
  }

  for (const k of ["personnel", "vendors", "timeline", "song_sections"] as const) {
    const a = (out[k] as unknown[] | undefined) || [];
    const b = (enrichment[k] as unknown[] | undefined) || [];
    // Deterministic parser owns its arrays; LLM array only contributes
    // when the parser produced nothing. Prevents duplicate personnel rows
    // when both ran on the same input.
    if (a.length === 0 && b.length > 0) out[k] = b;
  }

  return out as CanonicalEventFields;
}

function runParser(shape: Shape, text: string, filename?: string): ParseResult | null {
  switch (shape) {
    case "A": return parseShapeA(text, filename);
    case "B": return parseShapeB(text, filename);
    case "C": return parseShapeC(text, filename);
    case "D": return parseShapeD(text, filename);
    case "W": return null;
  }
}

// Merge a partial CanonicalEventFields into an existing row, preferring the
// prior value when set. This is the "deterministic-parser doesn't clobber"
// rule from the v2 architecture sketch (Layer 4 enrichment).
function mergeFields(
  prev: Record<string, unknown>,
  next: CanonicalEventFields,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...prev };

  // `name` is intentionally excluded — it's caller-controlled and load-bearing
  // for the unique-index merge key. See upsertCanonicalEvent for the rationale.
  const scalarKeys: (keyof CanonicalEventFields)[] = [
    "event_date", "end_date", "organization", "event_type", "venue_name", "attire",
  ];
  for (const k of scalarKeys) {
    if (next[k] && !merged[k]) merged[k] = next[k] as string;
  }

  const objectKeys: (keyof CanonicalEventFields)[] = [
    "client", "venue", "contact", "guests", "logistics", "preferences",
  ];
  for (const k of objectKeys) {
    const incoming = next[k] as Record<string, unknown> | undefined;
    if (!incoming) continue;
    const existing = (merged[k] as Record<string, unknown> | undefined) || {};
    const combined: Record<string, unknown> = { ...existing };
    for (const [field, value] of Object.entries(incoming)) {
      if (value !== undefined && value !== null && value !== "" && !combined[field]) {
        combined[field] = value;
      }
    }
    merged[k] = combined;
  }

  const arrayKeys: (keyof CanonicalEventFields)[] = [
    "personnel", "vendors", "timeline", "song_sections",
  ];
  for (const k of arrayKeys) {
    const incoming = next[k] as unknown[] | undefined;
    if (!incoming || incoming.length === 0) continue;
    const existing = (merged[k] as unknown[] | undefined) || [];
    merged[k] = [...existing, ...incoming];
  }

  return merged;
}

async function upsertCanonicalEvent(opts: {
  name: string;
  eventDate: string;
  organization?: string;
  eventType?: string;
  sourceFile: SourceFile;
  parsedFields?: CanonicalEventFields;
}): Promise<{ id: string; merged: boolean }> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const normalized = normalizeName(opts.name);

  const { data: existing, error: selectErr } = await supabase
    .from("canonical_events")
    .select(
      "id, source_files, name, organization, event_type, venue_name, attire, " +
      "client, venue, contact, guests, logistics, personnel, vendors, " +
      "timeline, song_sections, preferences",
    )
    .eq("event_date", opts.eventDate)
    .eq("normalized_name", normalized)
    .maybeSingle();

  if (selectErr) throw new Error(`select failed: ${selectErr.message}`);

  if (existing?.id) {
    const prevSources = Array.isArray(existing.source_files)
      ? existing.source_files
      : [];

    const mergedFields = opts.parsedFields
      ? mergeFields(existing as Record<string, unknown>, opts.parsedFields)
      : {};

    // mergeFields returns the full prev+next blob. Compute the diff to limit
    // the UPDATE to fields that actually changed.
    const update: Record<string, unknown> = {
      source_files: [...prevSources, opts.sourceFile],
      extractor_version: EXTRACTOR_VERSION,
      extracted_at: new Date().toISOString(),
      ...(opts.organization && !existing.organization
        ? { organization: opts.organization }
        : {}),
      ...(opts.eventType && !existing.event_type
        ? { event_type: opts.eventType }
        : {}),
    };
    for (
      const k of [
        "venue_name", "attire", "client", "venue", "contact", "guests",
        "logistics", "personnel", "vendors", "timeline", "song_sections", "preferences",
      ]
    ) {
      const prev = (existing as Record<string, unknown>)[k];
      const merged = mergedFields[k];
      if (merged !== undefined && JSON.stringify(merged) !== JSON.stringify(prev)) {
        update[k] = merged;
      }
    }

    const { error: updateErr } = await supabase
      .from("canonical_events")
      .update(update)
      .eq("id", existing.id);
    if (updateErr) throw new Error(`update failed: ${updateErr.message}`);
    return { id: existing.id, merged: true };
  }

  // New row. The canonical `name` always uses the caller-supplied value — the
  // unique index keys off normalized_name, and letting the parser override it
  // would break dedup on re-ingest (a second caller posting the same name+date
  // wouldn't find this row). The parser's name suggestion is logged on the
  // source_files entry for traceability.
  if (opts.parsedFields?.name && opts.parsedFields.name !== opts.name) {
    (opts.sourceFile as Record<string, unknown>).parsed_name_suggestion =
      opts.parsedFields.name;
  }
  // Caller-supplied organization + event_type win over parser/LLM output (same
  // rule as `name`). The parser/LLM "Organization: Baltimore Sound
  // Entertainment" reads the booking agency from the doc body, but the caller
  // is naming the canonical org-of-record (e.g. "harborline" for a Harborline
  // ROS even if BSE booked the gig). Parser/LLM values still log on the source
  // entry for traceability.
  if (opts.parsedFields?.organization && opts.parsedFields.organization !== opts.organization) {
    (opts.sourceFile as Record<string, unknown>).parsed_organization_suggestion =
      opts.parsedFields.organization;
  }
  if (opts.parsedFields?.event_type && opts.parsedFields.event_type !== opts.eventType) {
    (opts.sourceFile as Record<string, unknown>).parsed_event_type_suggestion =
      opts.parsedFields.event_type;
  }
  const newRow: Record<string, unknown> = {
    event_date: opts.eventDate,
    name: opts.name,
    organization: opts.organization || opts.parsedFields?.organization || null,
    event_type: opts.eventType || opts.parsedFields?.event_type || null,
    source_files: [opts.sourceFile],
    extractor_version: EXTRACTOR_VERSION,
  };
  if (opts.parsedFields) {
    const f = opts.parsedFields;
    if (f.venue_name) newRow.venue_name = f.venue_name;
    if (f.attire) newRow.attire = f.attire;
    if (f.end_date) newRow.end_date = f.end_date;
    if (f.client && Object.keys(f.client).length) newRow.client = f.client;
    if (f.venue && Object.keys(f.venue).length) newRow.venue = f.venue;
    if (f.contact && Object.keys(f.contact).length) newRow.contact = f.contact;
    if (f.guests && Object.keys(f.guests).length) newRow.guests = f.guests;
    if (f.logistics && Object.keys(f.logistics).length) newRow.logistics = f.logistics;
    if (f.preferences && Object.keys(f.preferences).length) newRow.preferences = f.preferences;
    if (f.personnel && f.personnel.length) newRow.personnel = f.personnel;
    if (f.vendors && f.vendors.length) newRow.vendors = f.vendors;
    if (f.timeline && f.timeline.length) newRow.timeline = f.timeline;
    if (f.song_sections && f.song_sections.length) newRow.song_sections = f.song_sections;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("canonical_events")
    .insert(newRow)
    .select("id")
    .single();
  if (insertErr) throw new Error(`insert failed: ${insertErr.message}`);
  return { id: inserted!.id as string, merged: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const route = body?.route as Route | undefined;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const eventDateRaw = typeof body?.eventDate === "string" ? body.eventDate : "";
    const organization =
      typeof body?.organization === "string" ? body.organization : undefined;
    const eventType =
      typeof body?.eventType === "string" ? body.eventType : undefined;
    const payload = (body?.payload ?? {}) as Record<string, unknown>;

    if (!route || !["paste", "drive-url", "djep-scrape", "drive-search"].includes(route)) {
      return jsonResponse(
        { error: "route must be one of: paste, drive-url, djep-scrape, drive-search" },
        400,
      );
    }
    if (!name) return jsonResponse({ error: "name (string) required" }, 400);

    const eventDate = parseEventDateToISO(eventDateRaw);
    if (!eventDate) {
      return jsonResponse(
        { error: `eventDate could not be parsed: ${JSON.stringify(eventDateRaw)}` },
        400,
      );
    }

    let text = typeof payload.text === "string" ? payload.text
      : typeof payload.rawText === "string" ? payload.rawText
      : "";
    let filename = typeof payload.filename === "string" ? payload.filename : undefined;
    let resolvedMime = typeof payload.mimeType === "string" ? payload.mimeType : undefined;

    // Cut 6: backend Drive fetch. When the caller passes driveId (or a Drive URL
    // we can extract one from) but no pre-fetched text, fetch the file content
    // from Drive directly using Josh's stored OAuth token. Lets the UI just
    // send {driveId, mimeType} and get a canonical row back without exposing
    // access tokens to the browser.
    if (!text.trim() && (route === "drive-url" || route === "drive-search")) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
      let driveId = typeof payload.driveId === "string" ? payload.driveId : "";
      if (!driveId && typeof payload.url === "string") {
        const m = payload.url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (m) driveId = m[1];
      }
      if (driveId) {
        try {
          const fetched = await fetchDriveFileText(supabase, driveId, resolvedMime);
          text = fetched.text;
          resolvedMime = fetched.mimeType;
          // Push the resolved mime + fetched text back into payload so
          // buildSourceFileForRoute can categorize source_type and capture an
          // extracted_excerpt for the audit trail.
          (payload as Record<string, unknown>).mimeType = fetched.mimeType;
          (payload as Record<string, unknown>).driveId = driveId;
          (payload as Record<string, unknown>).text = text;
        } catch (err) {
          return jsonResponse(
            {
              error: err instanceof Error ? err.message : String(err),
              drive_id: driveId,
              hint: "If this file isn't a Google Doc or Sheet (PDF, DOCX, etc.), pre-fetch text on the client and pass it as payload.text.",
            },
            err instanceof Error && err.message.startsWith("no_google_account_connected") ? 412 : 502,
          );
        }
      }
    }

    // Cut 5: djep-scrape route auto-fetches the DJEP record by name+date when
    // no text was supplied by the caller. Filters the djep_events_cache table
    // populated by djep-calendar-events (no per-call Firecrawl scrape).
    if (route === "djep-scrape" && !text.trim()) {
      try {
        const lookup = await fetch(
          `${SUPABASE_URL}/functions/v1/djep-event-lookup`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name, date: eventDate }),
          },
        );
        if (lookup.ok) {
          const result = await lookup.json();
          const best = (result.matches || [])[0];
          if (best) {
            text = formatDjepMatchAsText(best);
            (payload as Record<string, unknown>).djep_match = best;
          }
        }
      } catch (err) {
        console.error("djep-event-lookup failed", err);
      }
    }

    const sourceFile = buildSourceFileForRoute(route, payload);
    if (route === "djep-scrape" && payload.djep_match) {
      const m = payload.djep_match as { djep_id?: string; source_url?: string };
      (sourceFile as Record<string, unknown>).djep_id = m.djep_id;
      (sourceFile as Record<string, unknown>).url = m.source_url ?? sourceFile.url;
    }

    // Layer 3: shape detection + deterministic parser
    let parseResult: ParseResult | null = null;
    let detectedShape: Shape | null = null;
    if (text.trim()) {
      const detection = detectShape({
        text,
        filename,
        source_type: sourceFile.source_type,
      });
      detectedShape = detection.shape;
      sourceFile.detected_shape = detection.shape;
      parseResult = runParser(detection.shape, text, filename);
      if (parseResult) {
        sourceFile.is_blank_starter = parseResult.is_blank_starter || false;
      }
    }

    // Layer 4: LLM extraction (Cut 3)
    //  - Shape W or no deterministic match  → LLM extraction IS the parser
    //  - Shape A/B/C/D with a blank starter → skip (nothing to extract)
    //  - Shape A/B/C/D with content         → LLM enriches gaps (fills nulls)
    //  - Skip entirely if disabled via payload.skip_llm = true (debugging)
    let llmResult: ParseResult | null = null;
    let llmRan = false;
    const llmSkipped = payload.skip_llm === true;
    const isBlankStarter = parseResult?.is_blank_starter === true;
    const shouldRunLlm = text.trim() && !llmSkipped && !isBlankStarter;

    if (shouldRunLlm) {
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) {
        console.warn("ingest-event: ANTHROPIC_API_KEY not set; skipping LLM extraction");
      } else {
        try {
          llmResult = await extractCanonicalEvent({
            apiKey,
            text,
            hintShape: detectedShape ?? undefined,
            hintName: name,
            hintDate: eventDate,
          });
          llmRan = true;
        } catch (err) {
          console.error("llm-extract failed", err);
        }
      }
    }

    // Merge: deterministic parser wins on fields it set; LLM fills the rest.
    // For Shape W there's only the LLM result; for A/B/C/D the deterministic
    // result is the primary and LLM enriches.
    const mergedFields = mergeParserAndLlmFields(
      parseResult?.fields,
      llmResult?.fields,
    );

    const finalShape = parseResult?.shape ?? detectedShape ?? "W";

    const { id, merged } = await upsertCanonicalEvent({
      name,
      eventDate,
      organization,
      eventType,
      sourceFile,
      parsedFields: mergedFields,
    });

    return jsonResponse({
      id,
      route,
      merged,
      sourceFile,
      extractor_version: EXTRACTOR_VERSION,
      cut: 5,
      shape: finalShape,
      confidence: parseResult?.confidence ?? (llmResult?.confidence ?? null),
      is_blank_starter: parseResult?.is_blank_starter ?? false,
      llm_ran: llmRan,
      llm_skipped_reason: llmSkipped
        ? "skip_llm=true"
        : isBlankStarter
        ? "blank-starter"
        : !text.trim()
        ? "no-text"
        : null,
      warnings: [
        ...(parseResult?.warnings ?? []),
        ...(llmResult?.warnings ?? []),
      ],
      fields_extracted: mergedFields ? Object.keys(mergedFields).length : 0,
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
