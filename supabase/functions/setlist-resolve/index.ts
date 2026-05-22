// setlist-resolve — P333.
//
// Resolves a raw song list (one tune per line) into a chart manifest by
// fuzzy-matching each line against the chart_index table, then persists the
// build to setlist_builds for the local Python CLI to materialize.
//
// Three actions on POST (all requireOperator()-gated):
//
//   { action: "create",
//     raw_input: string,           // one song per line
//     event_name: string,
//     event_date?: string,         // YYYY-MM-DD
//     venue?: string }
//
//     Resolves each line, persists a row, returns
//     { build_id, gig_slug, matched, unmatched }.
//
//   { action: "fetch", build_id: string }
//
//     Returns the full row (manifest + chart-library-relative paths) for the
//     local Python CLI to read. Local CLI calls this with the operator JWT.
//
//   { action: "mark_materialized", build_id: string,
//     materialized_path: string,
//     summary?: object }
//
//     Flips status to 'materialized'. Called by the local CLI after the copy.
//
// gig_slug rule: <YYYY-MM-DD>-<event-slug>[-<venue-slug>] when event_date is
// present, else just <event-slug>[-<venue-slug>]. Slugify = lowercase +
// non-alphanum→hyphen + collapse runs + trim hyphens.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

// Normalize a tune name for matching: lowercase, drop leading articles,
// strip punctuation, collapse whitespace.
function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/^\s*(the|a|an)\s+/i, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type ChartHit = {
  id: string;
  title: string;
  composer: string | null;
  folder_path: string;
  filename: string;
  reference: string | null;
};

type ResolvedLine = {
  input: string;
  match_type: "exact" | "fuzzy" | "none";
  candidates: ChartHit[];
};

async function resolveLine(
  supabase: ReturnType<typeof createClient>,
  rawLine: string,
): Promise<ResolvedLine> {
  const trimmed = rawLine.trim();
  if (!trimmed) {
    return { input: rawLine, match_type: "none", candidates: [] };
  }

  // Strip leading numbering ("1. Foo", "1) Foo", "- Foo")
  const cleaned = trimmed.replace(/^[\s\d]+[.)\-:]\s*/, "").trim();
  const norm = normalizeTitle(cleaned);
  if (!norm) {
    return { input: rawLine, match_type: "none", candidates: [] };
  }

  // Pass 1: exact normalized title match. Postgres has no case-insensitive
  // normalized-title column, so use ilike on title with the original cleaned
  // form first, then fall back to fuzzy.
  const exact = await supabase
    .from("chart_index")
    .select("id, title, composer, folder_path, filename, reference")
    .ilike("title", cleaned)
    .limit(10);

  if (!exact.error && exact.data && exact.data.length > 0) {
    return {
      input: rawLine,
      match_type: "exact",
      candidates: exact.data as ChartHit[],
    };
  }

  // Pass 2: full-text search via search_tsv. Use websearch_to_tsquery via the
  // built-in textSearch helper. Cap at 5 candidates per line.
  const fts = await supabase
    .from("chart_index")
    .select("id, title, composer, folder_path, filename, reference")
    .textSearch("search_tsv", cleaned, {
      type: "websearch",
      config: "english",
    })
    .limit(5);

  if (!fts.error && fts.data && fts.data.length > 0) {
    return {
      input: rawLine,
      match_type: "fuzzy",
      candidates: fts.data as ChartHit[],
    };
  }

  // Pass 3: title-contains fallback for stubborn names.
  const contains = await supabase
    .from("chart_index")
    .select("id, title, composer, folder_path, filename, reference")
    .ilike("title", `%${cleaned}%`)
    .limit(5);

  if (!contains.error && contains.data && contains.data.length > 0) {
    return {
      input: rawLine,
      match_type: "fuzzy",
      candidates: contains.data as ChartHit[],
    };
  }

  return { input: rawLine, match_type: "none", candidates: [] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const denial = await requireOperator(req);
  if (denial) return denial;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (_err) {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "create";
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (action === "create") {
    const rawInput = typeof body.raw_input === "string" ? body.raw_input : "";
    const eventName =
      typeof body.event_name === "string" ? body.event_name.trim() : "";
    const eventDate =
      typeof body.event_date === "string" && body.event_date.trim()
        ? body.event_date.trim()
        : null;
    const venue =
      typeof body.venue === "string" && body.venue.trim()
        ? body.venue.trim()
        : null;

    if (!rawInput.trim() || !eventName) {
      return jsonResponse(
        { error: "missing_required", reason: "raw_input + event_name" },
        400,
      );
    }

    const lines = rawInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return jsonResponse({ error: "empty_input" }, 400);
    }

    const resolved: ResolvedLine[] = [];
    for (const line of lines) {
      resolved.push(await resolveLine(supabase, line));
    }

    const matched = resolved.filter((r) => r.match_type !== "none");
    const unmatched = resolved.filter((r) => r.match_type === "none");

    const eventSlug = slugify(eventName);
    const venueSlug = venue ? slugify(venue) : "";
    const datePart = eventDate ?? "";
    const parts = [datePart, eventSlug, venueSlug].filter(Boolean);
    const gigSlug = parts.join("-");

    const manifest = {
      lines: resolved,
      stats: {
        total_lines: lines.length,
        matched: matched.length,
        unmatched: unmatched.length,
        total_charts: matched.reduce((n, r) => n + r.candidates.length, 0),
      },
    };

    const insert = await supabase
      .from("setlist_builds")
      .insert({
        gig_slug: gigSlug,
        event_name: eventName,
        event_date: eventDate,
        venue,
        raw_input: rawInput,
        manifest,
        status: "queued",
      })
      .select("id, gig_slug, created_at")
      .single();

    if (insert.error || !insert.data) {
      return jsonResponse(
        { error: "insert_failed", detail: insert.error?.message },
        500,
      );
    }

    return jsonResponse({
      build_id: insert.data.id,
      gig_slug: insert.data.gig_slug,
      created_at: insert.data.created_at,
      matched: matched.map((r) => ({
        input: r.input,
        match_type: r.match_type,
        candidates: r.candidates,
      })),
      unmatched: unmatched.map((r) => r.input),
      stats: manifest.stats,
    });
  }

  if (action === "fetch") {
    const buildId =
      typeof body.build_id === "string" ? body.build_id.trim() : "";
    if (!buildId) {
      return jsonResponse({ error: "missing_build_id" }, 400);
    }
    const row = await supabase
      .from("setlist_builds")
      .select("*")
      .eq("id", buildId)
      .maybeSingle();
    if (row.error) {
      return jsonResponse(
        { error: "fetch_failed", detail: row.error.message },
        500,
      );
    }
    if (!row.data) {
      return jsonResponse({ error: "not_found", build_id: buildId }, 404);
    }
    return jsonResponse({ build: row.data });
  }

  if (action === "mark_materialized") {
    const buildId =
      typeof body.build_id === "string" ? body.build_id.trim() : "";
    const materializedPath =
      typeof body.materialized_path === "string"
        ? body.materialized_path.trim()
        : "";
    const summary =
      typeof body.summary === "object" && body.summary ? body.summary : null;
    if (!buildId || !materializedPath) {
      return jsonResponse(
        { error: "missing_required", reason: "build_id + materialized_path" },
        400,
      );
    }
    const update = await supabase
      .from("setlist_builds")
      .update({
        status: "materialized",
        materialized_at: new Date().toISOString(),
        materialized_path: materializedPath,
        materialized_summary: summary,
      })
      .eq("id", buildId)
      .select("id, status, materialized_at, materialized_path")
      .single();
    if (update.error) {
      return jsonResponse(
        { error: "update_failed", detail: update.error.message },
        500,
      );
    }
    return jsonResponse({ build: update.data });
  }

  return jsonResponse({ error: "unknown_action", action }, 400);
});
