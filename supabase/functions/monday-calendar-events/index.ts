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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!MONDAY_API_TOKEN) {
    return new Response(
      JSON.stringify({ configured: false, events: [], error: "MONDAY_API_TOKEN not set" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
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

    for (const src of sources) {
      const query = `query {
        boards(ids: [${src.board_id}]) {
          name
          items_page(limit: 200) {
            items {
              id
              name
              column_values(ids: ["${src.date_column_id}"]) {
                id
                text
                value
              }
            }
          }
        }
      }`;

      const res = await fetch("https://api.monday.com/v2", {
        method: "POST",
        headers: {
          Authorization: MONDAY_API_TOKEN,
          "Content-Type": "application/json",
          "API-Version": "2024-01",
        },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok || data.errors) {
        console.error(`Monday board ${src.board_id} error:`, JSON.stringify(data));
        continue;
      }

      const board = data.data?.boards?.[0];
      const items = board?.items_page?.items || [];

      for (const item of items) {
        const dateCol = item.column_values?.[0];
        if (!dateCol) continue;
        let dateStr: string | null = null;
        let timeStr: string | null = null;
        try {
          const parsed = dateCol.value ? JSON.parse(dateCol.value) : null;
          if (parsed?.date) {
            dateStr = parsed.date;
            timeStr = parsed.time || null;
          }
        } catch {
          // ignore parse errors
        }
        if (!dateStr && dateCol.text) {
          dateStr = dateCol.text.split(" ")[0];
        }
        if (!dateStr) continue;

        const startISO = timeStr
          ? new Date(`${dateStr}T${timeStr}`).toISOString()
          : new Date(`${dateStr}T00:00:00`).toISOString();
        const endISO = timeStr
          ? new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString()
          : startISO;

        allEvents.push({
          id: `monday-${src.board_id}-${item.id}`,
          title: item.name,
          start: startISO,
          end: endISO,
          allDay: !timeStr,
          source: "monday",
          sourceLabel: src.label,
          color: src.color,
          boardName: board.name,
          itemUrl: `https://view.monday.com/boards/${src.board_id}/pulses/${item.id}`,
        });
      }
    }

    return new Response(
      JSON.stringify({ configured: true, events: allEvents }),
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
