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
            start: body.allDay
              ? { date: body.start.slice(0, 10) }
              : { dateTime: body.start, timeZone: body.timeZone || "America/New_York" },
            end: body.allDay
              ? { date: body.end.slice(0, 10) }
              : { dateTime: body.end, timeZone: body.timeZone || "America/New_York" },
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
