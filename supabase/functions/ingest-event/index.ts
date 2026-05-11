// ingest-event — Sub-Plan 03 v2 architecture, Layer 2 (ingestion routes).
//
// Cut 1: PLUMBING ONLY. All 4 routes accept their inputs, compute a
// source_files provenance entry, and upsert a canonical_events row keyed by
// (event_date, normalized_name). Shape detection + deterministic parsers
// (Layer 3+) land in Cut 2; LLM extraction fallback (Layer 4) in Cut 3.
//
// Routes:
//   paste         — pasted free text or sheet rows (current generator's input)
//   drive-url     — Drive file ID → MCP read → text → parser dispatch
//   djep-scrape   — { name, date } → Firecrawl scrape of DJEP record
//   drive-search  — { name, date } → search Drive for files matching this event
//
// Request shape: { route, name, eventDate, organization?, eventType?, payload }
// Response shape: { id, route, sourceFile, merged: boolean }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const EXTRACTOR_VERSION = "v2.0-cut1-stub";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
  detected_shape?: "A" | "B" | "C" | "D" | "W" | null;
  extracted_excerpt?: string;
  ingested_at: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Mirrors the generated normalized_name column in SQL so the client can
// pre-check / cache without a round-trip. Keep in sync with the migration.
function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\p{P}]+$/u, "");
}

// Parse event-date strings the same way generate-run-of-show does.
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
  switch (route) {
    case "paste": {
      const excerpt = typeof p.text === "string" ? p.text.slice(0, 500) : undefined;
      return {
        source_type: "paste",
        detected_shape: null,
        extracted_excerpt: excerpt,
        ingested_at,
      };
    }
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
        ingested_at,
      };
    }
    case "djep-scrape": {
      return {
        source_type: "djep-scrape",
        url: typeof p.djepUrl === "string" ? p.djepUrl : undefined,
        detected_shape: null,
        ingested_at,
      };
    }
    case "drive-search": {
      return {
        source_type: "drive-search-hit",
        url: typeof p.url === "string" ? p.url : undefined,
        drive_id: typeof p.driveId === "string" ? p.driveId : undefined,
        modified_at: typeof p.modifiedAt === "string" ? p.modifiedAt : undefined,
        detected_shape: null,
        ingested_at,
      };
    }
  }
}

async function upsertCanonicalEvent(opts: {
  name: string;
  eventDate: string;
  organization?: string;
  eventType?: string;
  sourceFile: SourceFile;
}): Promise<{ id: string; merged: boolean }> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const normalized = normalizeName(opts.name);

  // Look up existing row by (event_date, normalized_name) — the unique key.
  const { data: existing, error: selectErr } = await supabase
    .from("canonical_events")
    .select("id, source_files")
    .eq("event_date", opts.eventDate)
    .eq("normalized_name", normalized)
    .maybeSingle();

  if (selectErr) throw new Error(`select failed: ${selectErr.message}`);

  if (existing?.id) {
    const prevSources = Array.isArray(existing.source_files)
      ? existing.source_files
      : [];
    const { error: updateErr } = await supabase
      .from("canonical_events")
      .update({
        source_files: [...prevSources, opts.sourceFile],
        extractor_version: EXTRACTOR_VERSION,
        extracted_at: new Date().toISOString(),
        // Only set organization / event_type on existing rows if they were null —
        // don't clobber better data from a prior ingest.
        ...(opts.organization ? { organization: opts.organization } : {}),
        ...(opts.eventType ? { event_type: opts.eventType } : {}),
      })
      .eq("id", existing.id);
    if (updateErr) throw new Error(`update failed: ${updateErr.message}`);
    return { id: existing.id, merged: true };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("canonical_events")
    .insert({
      event_date: opts.eventDate,
      name: opts.name,
      organization: opts.organization ?? null,
      event_type: opts.eventType ?? null,
      source_files: [opts.sourceFile],
      extractor_version: EXTRACTOR_VERSION,
    })
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

    const sourceFile = buildSourceFileForRoute(route, payload);
    const { id, merged } = await upsertCanonicalEvent({
      name,
      eventDate,
      organization,
      eventType,
      sourceFile,
    });

    return jsonResponse({
      id,
      route,
      merged,
      sourceFile,
      extractor_version: EXTRACTOR_VERSION,
      // Cut 1 plumbing only — extraction fields stay null until Cut 2.
      cut: 1,
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
