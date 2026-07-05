// Fetch & create Google Calendar events using stored tokens (multi-account)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function ensureFreshToken(supabase: any, row: any): Promise<string> {
  const expiresAt = new Date(row.expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) return row.access_token;

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
  if (!refreshRes.ok) throw new Error(`Refresh failed: ${JSON.stringify(refreshed)}`);

  const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase
    .from("google_calendar_tokens")
    .update({ access_token: refreshed.access_token, expires_at: newExpires })
    .eq("id", row.id);

  return refreshed.access_token;
}

// ── open-slot finder for auto-scheduled SMART tasks ────────────────────────
// US-East offset for a date (EDT most of the year, EST in deep winter). Good
// enough for Baltimore; freeBusy is the source of truth for conflicts.
function etOffset(dateStr: string): string {
  const m = parseInt(dateStr.slice(5, 7), 10);
  return m >= 4 && m <= 10 ? "-04:00" : "-05:00";
}

// First open `slotMin`-minute window on `dateStr`, preferring mid-afternoon
// (13:00–17:30) then late-morning (10:00–11:30), always skipping the 12–1 lunch
// hour, within 10:00–18:00. null if the mid-day band is busy (caller falls back
// to all-day so nothing is lost).
async function findOpenSlot(
  token: string,
  dateStr: string,
  slotMin: number,
  tz: string,
): Promise<{ start: string; end: string } | null> {
  const off = etOffset(dateStr);
  let busy: [number, number][] = [];
  try {
    const fb = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        timeMin: `${dateStr}T00:00:00${off}`,
        timeMax: `${dateStr}T23:59:59${off}`,
        timeZone: tz,
        items: [{ id: "primary" }],
      }),
    });
    const j = await fb.json();
    busy = ((j.calendars?.primary?.busy as { start: string; end: string }[]) || []).map(
      (b) => [Date.parse(b.start), Date.parse(b.end)] as [number, number],
    );
  } catch {
    /* no busy info → treat the day as free */
  }
  const cands: number[] = [];
  for (let h = 13; h < 18; h++) for (const mm of [0, 30]) cands.push(h * 60 + mm); // afternoon first
  for (let h = 10; h < 12; h++) for (const mm of [0, 30]) cands.push(h * 60 + mm); // then late morning
  for (const startMin of cands) {
    const endMin = startMin + slotMin;
    if (endMin > 18 * 60) continue;
    const p = (n: number) => String(n).padStart(2, "0");
    const startIso = `${dateStr}T${p(Math.floor(startMin / 60))}:${p(startMin % 60)}:00${off}`;
    const endIso = `${dateStr}T${p(Math.floor(endMin / 60))}:${p(endMin % 60)}:00${off}`;
    const s = Date.parse(startIso), e = Date.parse(endIso);
    if (!busy.some(([bs, be]) => s < be && e > bs)) return { start: startIso, end: endIso };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ connected: false, configured: false, accounts: [], events: [], error: "Google OAuth not configured" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: tokenRows } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .order("created_at", { ascending: true });

    if (!tokenRows || tokenRows.length === 0) {
      return new Response(
        JSON.stringify({ connected: false, accounts: [], events: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    // POST create — uses first account by default, or ?account=<email>
    if (req.method === "POST" && action === "create") {
      const body = await req.json();
      const targetEmail = url.searchParams.get("account") || body.account;
      const row = targetEmail
        ? tokenRows.find((r: any) => r.account_email === targetEmail) || tokenRows[0]
        : tokenRows[0];
      const token = await ensureFreshToken(supabase, row);

      // Build the start/end. findSlot → auto-pick an open mid-day 30-min block
      // (Josh's rule for sub-hour tasks); else honor allDay / explicit times.
      const tz = body.timeZone || "America/New_York";
      let startField: Record<string, string>;
      let endField: Record<string, string>;
      if (body.findSlot && body.date) {
        const slot = await findOpenSlot(token, body.date, body.slotMinutes || 30, tz);
        if (slot) {
          startField = { dateTime: slot.start, timeZone: tz };
          endField = { dateTime: slot.end, timeZone: tz };
        } else {
          startField = { date: body.date }; // mid-day full → all-day pin, nothing lost
          endField = { date: body.date };
        }
      } else if (body.allDay) {
        startField = { date: body.start.slice(0, 10) };
        endField = { date: body.end.slice(0, 10) };
      } else {
        startField = { dateTime: body.start, timeZone: tz };
        endField = { dateTime: body.end, timeZone: tz };
      }

      const createRes = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: body.summary,
            description: body.description || "",
            location: body.location || "",
            start: startField,
            end: endField,
          }),
        },
      );
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(`Create failed: ${JSON.stringify(created)}`);
      return new Response(JSON.stringify({ event: created, account: row.account_email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List events: default = past 365 days through next 90 days. Wide past
    // window so the month-grid + 6-week views can scroll back roughly a year
    // without hitting blank cells. Callers can still narrow via ?timeMin=.
    const timeMin =
      url.searchParams.get("timeMin") ||
      new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax =
      url.searchParams.get("timeMax") ||
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const allEvents: any[] = [];
    const accounts: { email: string; calendars: number }[] = [];

    // Fetch in parallel across accounts
    await Promise.all(
      tokenRows.map(async (row: any) => {
        try {
          const token = await ensureFreshToken(supabase, row);

          const calListRes = await fetch(
            "https://www.googleapis.com/calendar/v3/users/me/calendarList",
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const calList = await calListRes.json();
          if (!calListRes.ok) {
            console.error(`calendarList failed for ${row.account_email}:`, calList);
            accounts.push({
              email: row.account_email,
              calendars: 0,
              error: calList?.error?.message || `HTTP ${calListRes.status}`,
              needsReconnect: calListRes.status === 401 || calListRes.status === 403,
            });
            return;
          }
          const calendars = (calList.items || []).filter((c: any) => c.selected !== false);
          const scopeStr = String(row.scope || "");
          const driveScopeGranted =
            scopeStr.includes("drive.readonly") &&
            scopeStr.includes("drive.metadata.readonly");
          accounts.push({
            email: row.account_email,
            calendars: calendars.length,
            driveScopeGranted,
          });

          await Promise.all(
            calendars.map(async (cal: any) => {
              const evRes = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?` +
                  new URLSearchParams({
                    timeMin,
                    timeMax,
                    singleEvents: "true",
                    orderBy: "startTime",
                    maxResults: "250",
                  }),
                { headers: { Authorization: `Bearer ${token}` } },
              );
              const ev = await evRes.json();
              for (const e of ev.items || []) {
                allEvents.push({
                  id: `${row.account_email}:${e.id}`,
                  accountEmail: row.account_email,
                  calendarId: cal.id,
                  calendarName: cal.summary,
                  calendarColor: cal.backgroundColor || "#4285f4",
                  // Google per-event color id ("1".."11"), if user set one
                  eventColorId: e.colorId || null,
                  title: e.summary || "(no title)",
                  description: e.description || "",
                  location: e.location || "",
                  start: e.start?.dateTime || e.start?.date,
                  end: e.end?.dateTime || e.end?.date,
                  allDay: !!e.start?.date,
                  htmlLink: e.htmlLink,
                  organizerEmail: e.organizer?.email || null,
                  organizerSelf: !!e.organizer?.self,
                  creatorEmail: e.creator?.email || null,
                  creatorSelf: !!e.creator?.self,
                  isPrimaryCalendar: cal.id === row.account_email || !!cal.primary,
                });
              }
            }),
          );
        } catch (err) {
          console.error(`Failed for ${row.account_email}:`, err);
          accounts.push({
            email: row.account_email,
            calendars: 0,
            error: err instanceof Error ? err.message : String(err),
            needsReconnect: true,
          });
        }
      }),
    );

    // Deduplicate (same event id can appear in multiple calendars)
    const seen = new Set<string>();
    const deduped = allEvents.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    return new Response(
      JSON.stringify({
        connected: true,
        accounts,
        // Back-compat: first account email
        email: accounts[0]?.email,
        events: deduped,
      }),
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
