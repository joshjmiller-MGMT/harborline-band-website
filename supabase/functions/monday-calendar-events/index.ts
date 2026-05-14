// Pulls items with date columns from configured Monday boards
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MONDAY_API_TOKEN = Deno.env.get("MONDAY_API_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// P308 F7 — accept GraphQL variables alongside the query so callers don't
// have to string-interpolate user-controlled values into the query body.
// The original implementation interpolated `findUser` and `inspect` request
// params directly into a GraphQL string, letting an attacker break out of
// the string (e.g. `findUser=foo"){...}users{...}#`) to reshape the query
// against the Monday workspace and exfiltrate roster data.
async function mondayFetch(query: string, variables?: Record<string, unknown>) {
  const r = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      Authorization: MONDAY_API_TOKEN!,
      "Content-Type": "application/json",
      "API-Version": "2024-01",
    },
    body: JSON.stringify(variables ? { query, variables } : { query }),
  });
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

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
      const j = await mondayFetch(
        `query($name: String!) { users(name: $name) { id name email } }`,
        { name: usersSearch },
      );
      return new Response(JSON.stringify(j), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (inspectBoard) {
      // Defence-in-depth: parse the board id as a positive integer before
      // passing it as a variable. Monday's GraphQL types `ID` is permissive
      // enough that a malformed string would still go through to the API,
      // but we'd rather 400 early than rely on Monday's parser.
      const boardId = inspectBoard.match(/^\d+$/) ? inspectBoard : null;
      if (!boardId) {
        return new Response(
          JSON.stringify({ error: "inspect must be a numeric board id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const j = await mondayFetch(
        `query($ids: [ID!]) {
          boards(ids: $ids) {
            name
            columns { id title type }
            groups { id title }
          }
        }`,
        { ids: [boardId] },
      );
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
    const missingDateItems: any[] = [];
    const debugInfo: any[] = [];

    for (const src of sources) {
      // Use items_page_by_column_values for server-side person filtering when configured.
      // Supports comma-separated IDs in person_id (e.g. "54492562,97563930") so a
      // single source can match items owned by any of several Monday users.
      const personIds: string[] = (src.person_id || "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      const usePersonFilter = src.person_column_id && personIds.length > 0;

      // Optional comma-separated list of *fallback* date column IDs. When the
      // primary date column on an item is empty, the function tries each
      // fallback in order. Stored on the source row as a magic key in label,
      // OR (recommended) configured via the dashboard UI.
      const fallbackDateColumns: string[] = ((src as any).fallback_date_column_ids || "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

      // Per-source skip list. Comma-separated, case-insensitive substring
      // match against the Monday group title. "lost sale" is always implied.
      const skipGroupKeywords: string[] = ((src as any).skip_groups || "")
        .split(",")
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean);

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
          // Filter to items where the person column contains ANY of the configured user IDs.
          // Monday people columns expect each value as "person-<id>".
          const compareValues = personIds.map((id) => `"person-${id}"`).join(",");
          query = `query {
            boards(ids: [${src.board_id}]) {
              name
              items_page(
                limit: 500,
                query_params: {
                  rules: [{ column_id: "${src.person_column_id}", compare_value: [${compareValues}], operator: any_of }]
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
        personIds,
        fallbackDateColumns,
      });

      // Helper to extract { dateStr, timeStr } from a Monday date column value.
      const extractDate = (col: any): { dateStr: string | null; timeStr: string | null } => {
        if (!col) return { dateStr: null, timeStr: null };
        try {
          const parsed = col.value ? JSON.parse(col.value) : null;
          if (parsed?.date) return { dateStr: parsed.date, timeStr: parsed.time || null };
        } catch { /* ignore */ }
        if (col.text) return { dateStr: col.text.split(" ")[0], timeStr: null };
        return { dateStr: null, timeStr: null };
      };

      let withDates = 0;
      let withFallbackDates = 0;
      let missingPrimary = 0;
      for (const item of items) {
        // Skip "Lost Sale" groups entirely — they shouldn't appear in events
        // OR the missing-dates log. Booked/Completed items DO get flagged
        // because they may still need a Next Action Date assigned.
        // Additional per-source skip keywords come from `skip_groups`.
        const groupTitleRaw = (item.group?.title || "").toLowerCase().replace(/[-_]/g, " ").trim();
        const isLostSale = groupTitleRaw.includes("lost sale");
        const matchesSkipKeyword = skipGroupKeywords.some((kw) => groupTitleRaw.includes(kw));

        // Events board: track "Completed Gigs" group — these should be excluded
        // from "Items Missing Dates" but still considered for "Today's Action Items"
        // (filtered by the Next Action Step = Done rule below).
        const sourceIdentEarly = `${src.label || ""} ${boardName || ""}`.toLowerCase();
        const isEventsSourceEarly = /event/i.test(sourceIdentEarly);
        const isCompletedGroup = /complete/.test(groupTitleRaw);

        if (isLostSale || matchesSkipKeyword) continue;

        // Primary date column (e.g. "Next Action Date"). This is the one we
        // care about for the missing-dates report.
        const primaryCol = item.column_values?.find((c: any) => c.id === src.date_column_id);
        const primary = extractDate(primaryCol);

        // Fallbacks are only used for *calendar rendering* so the event still
        // shows up somewhere — they do NOT satisfy the missing-date check.
        let dateStr = primary.dateStr;
        let timeStr = primary.timeStr;
        let usedColumnId: string | null = dateStr ? src.date_column_id : null;
        if (!dateStr) {
          for (const fallbackId of fallbackDateColumns) {
            const fbCol = item.column_values?.find((c: any) => c.id === fallbackId);
            const fb = extractDate(fbCol);
            if (fb.dateStr) {
              dateStr = fb.dateStr;
              timeStr = fb.timeStr;
              usedColumnId = fallbackId;
              withFallbackDates++;
              break;
            }
          }
        }

        // Flag items missing the PRIMARY date, regardless of fallbacks.
        // Match board identity against BOTH the source label AND the actual
        // Monday board name, so renames/labels don't break the filter.
        const sourceIdent = `${src.label || ""} ${boardName || ""}`.toLowerCase();
        const isEventsSource = /event/i.test(sourceIdent);
        const isLeadsSource = /lead/i.test(sourceIdent);

        // --- Events: skip when "Next Action" / "Next Action Step" column = "Done" ---
        const nextActionCol = item.column_values?.find((c: any) => {
          const title = (c.column?.title || "").toLowerCase().trim();
          return title === "next action" || title === "next actions" || title === "next action step" || title === "next action steps";
        });
        const nextActionDone = (nextActionCol?.text || "").trim().toLowerCase() === "done";
        const skipForDone = isEventsSource && nextActionDone;

        // --- Leads: skip when item is "Booked" or "Lost Sale" ---
        // Check group title AND any status column text (e.g. "Status",
        // "Stage", "Lead Status") for those labels.
        const groupTitleLc = (item.group?.title || "").toLowerCase();
        const statusTexts: string[] = (item.column_values || [])
          .filter((c: any) => {
            const title = (c.column?.title || "").toLowerCase();
            return /status|stage|sale/.test(title);
          })
          .map((c: any) => (c.text || "").toLowerCase().trim())
          .filter(Boolean);
        const isBookedOrLost =
          /booked|lost\s*sale/.test(groupTitleLc) ||
          statusTexts.some((t) => /booked|lost\s*sale/.test(t));
        const skipLeadsStatus = isLeadsSource && isBookedOrLost;

        // Apply same exclusions to events list (action items)
        if (skipForDone || skipLeadsStatus) continue;

        if (!primary.dateStr && !(isEventsSourceEarly && isCompletedGroup)) {
          missingPrimary++;
          missingDateItems.push({
            id: `monday-missing-${src.board_id}-${item.id}`,
            itemId: item.id,
            name: item.name,
            boardId: src.board_id,
            boardName,
            sourceLabel: src.label,
            color: src.color,
            groupTitle: item.group?.title || null,
            itemUrl: item.url || `https://view.monday.com/boards/${src.board_id}/pulses/${item.id}`,
            updatedAt: item.updated_at || null,
          });
        }

        // No date at all (not even fallback) → can't render on calendar, skip.
        if (!dateStr) continue;
        withDates++;

        // For all-day items, emit a naive local-time ISO string (no "Z"),
        // so the browser parses it in the user's local timezone instead of
        // shifting it back a day from UTC midnight.
        // For timed items, the Monday-provided time is already in the user's
        // local clock — preserve it the same way.
        const startISO = timeStr
          ? `${dateStr}T${timeStr.length === 5 ? `${timeStr}:00` : timeStr}`
          : `${dateStr}T00:00:00`;
        const endISO = timeStr
          ? `${dateStr}T${timeStr.length === 5 ? `${timeStr}:00` : timeStr}`
          : startISO;

        const fields: { label: string; value: string; columnId: string }[] = [];
        for (const c of item.column_values || []) {
          if (!c.text || !c.text.trim()) continue;
          if (c.id === usedColumnId) continue;
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
          dateColumnUsed: usedColumnId,
          fields,
          updatedAt: item.updated_at || null,
          itemUrl: item.url || `https://view.monday.com/boards/${src.board_id}/pulses/${item.id}`,
        });
      }

      const last = debugInfo[debugInfo.length - 1];
      if (last) {
        last.itemsWithDates = withDates;
        last.itemsViaFallback = withFallbackDates;
        last.itemsMissingPrimary = missingPrimary;
      }
    }

    return new Response(
      JSON.stringify({ configured: true, events: allEvents, missingDateItems, debug: debugInfo }),
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
