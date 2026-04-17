// Pulls items with date columns from configured Monday boards
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MONDAY_API_TOKEN = Deno.env.get("MONDAY_API_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function mondayFetch(query: string) {
  const r = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      Authorization: MONDAY_API_TOKEN!,
      "Content-Type": "application/json",
      "API-Version": "2024-01",
    },
    body: JSON.stringify({ query }),
  });
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const inspectBoard = url.searchParams.get("inspect");
  const usersSearch = url.searchParams.get("findUser");

  if (!MONDAY_API_TOKEN) {
    return new Response(
      JSON.stringify({ configured: false, events: [], error: "MONDAY_API_TOKEN not set" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    if (usersSearch) {
      const j = await mondayFetch(`query { users(name: "${usersSearch}") { id name email } }`);
      return new Response(JSON.stringify(j), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (inspectBoard) {
      const j = await mondayFetch(`query {
        boards(ids: [${inspectBoard}]) {
          name
          columns { id title type }
          groups { id title }
        }
      }`);
      return new Response(JSON.stringify(j), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: sources } = await supabase
      .from("monday_calendar_sources")
      .select("*")
      .eq("enabled", true);

    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ configured: true, events: [], note: "No Monday sources configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const allEvents: any[] = [];
    const debugInfo: any[] = [];

    for (const src of sources) {
      // Use items_page_by_column_values for server-side person filtering when configured.
      // This handles boards with thousands of items (no 200 cap) and is much more accurate.
      const usePersonFilter = src.person_column_id && src.person_id;

      let boardName = "";
      const items: any[] = [];
      let cursor: string | null = null;

      const itemFields = `id name updated_at url group { title } column_values { id text value column { title } }`;

      do {
        let query: string;
        if (cursor) {
          query = `query {
            next_items_page(limit: 500, cursor: "${cursor}") {
              cursor
              items { ${itemFields} }
            }
          }`;
        } else if (usePersonFilter) {
          // Filter to items where the person column contains Josh's user ID.
          query = `query {
            boards(ids: [${src.board_id}]) {
              name
              items_page(
                limit: 500,
                query_params: {
                  rules: [{ column_id: "${src.person_column_id}", compare_value: [${src.person_id}], operator: any_of }]
                }
              ) {
                cursor
                items { ${itemFields} }
              }
            }
          }`;
        } else {
          query = `query {
            boards(ids: [${src.board_id}]) {
              name
              items_page(limit: 500) {
                cursor
                items { ${itemFields} }
              }
            }
          }`;
        }

        const data = await mondayFetch(query);
        if (data.errors) {
          console.error(`Monday board ${src.board_id} error:`, JSON.stringify(data.errors));
          debugInfo.push({ board: src.board_id, label: src.label, errors: data.errors });
          break;
        }

        let page: any;
        if (cursor) {
          page = data.data?.next_items_page;
        } else {
          const board = data.data?.boards?.[0];
          boardName = board?.name || "";
          page = board?.items_page;
        }

        if (!page) break;
        items.push(...(page.items || []));
        cursor = page.cursor || null;
      } while (cursor);

      debugInfo.push({
        board: src.board_id,
        label: src.label,
        itemsFetched: items.length,
        usePersonFilter,
      });

      let withDates = 0;
      for (const item of items) {
        const dateCol = item.column_values?.find((c: any) => c.id === src.date_column_id);
        if (!dateCol) continue;

        let dateStr: string | null = null;
        let timeStr: string | null = null;
        try {
          const parsed = dateCol.value ? JSON.parse(dateCol.value) : null;
          if (parsed?.date) {
            dateStr = parsed.date;
            timeStr = parsed.time || null;
          }
        } catch { /* ignore */ }
        if (!dateStr && dateCol.text) {
          dateStr = dateCol.text.split(" ")[0];
        }
        if (!dateStr) continue;
        withDates++;

        const startISO = timeStr
          ? new Date(`${dateStr}T${timeStr}`).toISOString()
          : new Date(`${dateStr}T00:00:00`).toISOString();
        const endISO = timeStr
          ? new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString()
          : startISO;

        const fields: { label: string; value: string; columnId: string }[] = [];
        for (const c of item.column_values || []) {
          if (!c.text || !c.text.trim()) continue;
          if (c.id === src.date_column_id) continue;
          fields.push({
            label: c.column?.title || c.id,
            value: c.text,
            columnId: c.id,
          });
        }

        allEvents.push({
          id: `monday-${src.board_id}-${item.id}`,
          title: item.name,
          start: startISO,
          end: endISO,
          allDay: !timeStr,
          source: "monday",
          sourceLabel: src.label,
          color: src.color,
          boardName,
          groupTitle: item.group?.title || null,
          fields,
          updatedAt: item.updated_at || null,
          itemUrl: item.url || `https://view.monday.com/boards/${src.board_id}/pulses/${item.id}`,
        });
      }

      const last = debugInfo[debugInfo.length - 1];
      if (last) last.itemsWithDates = withDates;
    }

    return new Response(
      JSON.stringify({ configured: true, events: allEvents, debug: debugInfo }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
