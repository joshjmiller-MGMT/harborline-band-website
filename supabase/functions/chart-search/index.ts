// chart-search — P14 Round 2.
//
// Searches the chart_index table via Postgres full-text search. Powers the
// /team/resources search box. Players can hit this too once player-tier auth
// lands; RLS on chart_index is permissive-SELECT (visual_assets pattern).
//
// Request body:
//   {
//     query?:        string,   // websearch syntax — phrases, AND, OR
//     folder_path?:  string,   // prefix filter, e.g. "fake-books/real-book-6th-ed"
//     genre?:        string,   // exact match (Jazz / Pop / Classical / etc.)
//     edition?:      string,   // transposition: "C" (concert) | "Bb" | "Eb".
//                              //   Derived from the top-level folder: Bb-charts/* = Bb,
//                              //   Eb-charts/* = Eb, everything else = concert (C).
//     limit?:        number,   // default 50, max 200
//     offset?:       number,   // default 0
//   }
//
// Response:
//   {
//     results: [{ id, title, composer, genre, folder_path, filename,
//                 reference, drive_web_view_link, storage_path, setlists,
//                 ireal_pro, tags, key_signature, time_signature, rank }],
//     total:  number,
//     query:  string,
//     folder_path: string|null,
//   }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const query =
      typeof body?.query === "string" ? body.query.trim() : "";
    const folderPath =
      typeof body?.folder_path === "string" ? body.folder_path.trim() : "";
    const genre =
      typeof body?.genre === "string" ? body.genre.trim() : "";
    const edition =
      typeof body?.edition === "string" ? body.edition.trim() : "";
    const limit = Math.min(
      Math.max(parseInt(body?.limit) || 50, 1),
      200
    );
    const offset = Math.max(parseInt(body?.offset) || 0, 0);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const COLUMNS =
      "id, title, composer, genre, folder_path, filename, reference, drive_web_view_link, storage_path, setlists, ireal_pro, tags, key_signature, time_signature";

    // Transposition edition maps to the top-level folder bucket.
    // Bb-charts/* = Bb, Eb-charts/* = Eb, everything else = concert (C).
    // deno-lint-ignore no-explicit-any
    const applyFilters = (q: any) => {
      if (folderPath) q = q.like("folder_path", `${folderPath}%`);
      if (genre) q = q.eq("genre", genre);
      if (edition === "Bb") q = q.like("folder_path", "Bb-charts%");
      else if (edition === "Eb") q = q.like("folder_path", "Eb-charts%");
      else if (edition === "C")
        q = q
          .not("folder_path", "like", "Bb-charts%")
          .not("folder_path", "like", "Eb-charts%");
      return q;
    };

    // websearch_to_tsquery handles phrases ("john coltrane") + AND/OR + -negation
    // For browse mode (empty query), order by folder_path/filename.
    if (!query) {
      let q = supabase
        .from("chart_index")
        .select(COLUMNS, { count: "exact" })
        .order("folder_path", { ascending: true })
        .order("filename", { ascending: true })
        .range(offset, offset + limit - 1);
      q = applyFilters(q);
      const { data, error, count } = await q;
      if (error) throw error;
      return jsonResponse({
        results: (data || []).map((r) => ({ ...r, rank: 0 })),
        total: count || 0,
        query: "",
        folder_path: folderPath || null,
      });
    }

    // FTS path: use a raw SQL call via rpc to access ts_rank.
    // We do this by selecting computed columns through a view-less rpc.
    // Simpler: filter via .textSearch on the generated search_tsv,
    // then re-rank client-side. PostgREST supports websearch type.
    let q = supabase
      .from("chart_index")
      .select(COLUMNS, { count: "exact" })
      .textSearch("search_tsv", query, {
        type: "websearch",
        config: "english",
      })
      .range(offset, offset + limit - 1);
    q = applyFilters(q);
    const { data, error, count } = await q;
    if (error) throw error;
    return jsonResponse({
      results: (data || []).map((r) => ({ ...r, rank: 1 })),
      total: count || 0,
      query,
      folder_path: folderPath || null,
    });
  } catch (err) {
    console.error("chart-search error:", err);
    return jsonResponse(
      { error: "search_failed", message: (err as Error).message },
      500
    );
  }
});
