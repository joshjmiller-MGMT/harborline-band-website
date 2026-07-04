// Surfaces the CRM Events board's "NEED TO STAFF" gigs so the scheduler's
// staffing section reflects what still needs staffing on Monday — not just the
// Google-Calendar red/orange items. Josh 2026-07: "there's a column on the
// events board that says Employee Status; 'NEED TO STAFF' means I still need to
// staff it — please include that."
//
// Read-only, operator-gated. Isolated from monday-calendar-events (the busy
// calendar feed) on purpose so this can't regress the dashboard calendar.
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MONDAY_API_TOKEN = Deno.env.get("MONDAY_API_TOKEN");

// CRM Events board + the three columns we need (verified 2026-07-04).
const EVENTS_BOARD_ID = "8455743669";
const COL_EMPLOYEE_STATUS = "color_mm01k3nh"; // "NEED TO STAFF" | "Staffed" | null
const COL_EVENT_STAGE = "color_mm01ec6s"; // Fully Booked | CANCELLED | POSTPONED | …
const COL_EVENT_DATE = "date_mm0fxm18"; // the actual event date

// Event Stage values that mean "don't bother staffing this".
const DEAD_STAGE = /cancel|postpon|lost|complete|dead/i;
const NEEDS_STAFF = /need\s*to\s*staff/i;

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

function todayISO(): string {
  // YYYY-MM-DD in UTC — good enough for a day-granularity "upcoming" cutoff.
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  if (!MONDAY_API_TOKEN) {
    return new Response(
      JSON.stringify({ configured: false, connected: false, events: [], error: "MONDAY_API_TOKEN not set" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const itemFields = `id name url column_values(ids: ["${COL_EMPLOYEE_STATUS}","${COL_EVENT_STAGE}","${COL_EVENT_DATE}"]) { id text }`;
    const items: any[] = [];
    let cursor: string | null = null;
    let boardName = "";

    do {
      const query = cursor
        ? `query { next_items_page(limit: 500, cursor: "${cursor}") { cursor items { ${itemFields} } } }`
        : `query { boards(ids: [${EVENTS_BOARD_ID}]) { name items_page(limit: 500) { cursor items { ${itemFields} } } } }`;
      const data = await mondayFetch(query);
      if (data.errors) {
        return new Response(
          JSON.stringify({ configured: true, connected: false, events: [], error: JSON.stringify(data.errors) }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const page = cursor ? data.data?.next_items_page : data.data?.boards?.[0]?.items_page;
      if (!cursor) boardName = data.data?.boards?.[0]?.name || "";
      if (!page) break;
      items.push(...(page.items || []));
      cursor = page.cursor || null;
    } while (cursor);

    const today = todayISO();
    const events = items
      .map((it) => {
        const cv = (id: string) =>
          (it.column_values || []).find((c: any) => c.id === id)?.text || "";
        return {
          id: String(it.id),
          name: it.name as string,
          url:
            (it.url as string) ||
            `https://baltimore-sound-entertainment.monday.com/boards/${EVENTS_BOARD_ID}/pulses/${it.id}`,
          employeeStatus: cv(COL_EMPLOYEE_STATUS),
          eventStage: cv(COL_EVENT_STAGE),
          eventDate: cv(COL_EVENT_DATE) || null, // "YYYY-MM-DD" | null
        };
      })
      // Only genuine needs-to-staff gigs, excluding dead stages.
      .filter((e) => NEEDS_STAFF.test(e.employeeStatus) && !DEAD_STAGE.test(e.eventStage))
      // Upcoming (or undated) only — a past gig can't be staffed.
      .filter((e) => !e.eventDate || e.eventDate >= today)
      // Soonest first; undated sink to the bottom.
      .sort((a, b) => {
        if (!a.eventDate && !b.eventDate) return a.name.localeCompare(b.name);
        if (!a.eventDate) return 1;
        if (!b.eventDate) return -1;
        return a.eventDate.localeCompare(b.eventDate);
      });

    return new Response(
      JSON.stringify({
        configured: true,
        connected: true,
        boardName,
        boardId: EVENTS_BOARD_ID,
        count: events.length,
        events,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ configured: true, connected: false, events: [], error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
