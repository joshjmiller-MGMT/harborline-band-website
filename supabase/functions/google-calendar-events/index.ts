// Fetch & create Google Calendar events using stored tokens
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getValidAccessToken(supabase: any): Promise<{ token: string; email: string } | null> {
  const { data: rows } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!rows || rows.length === 0) return null;
  const row = rows[0];

  const expiresAt = new Date(row.expires_at).getTime();
  // Refresh if expiring within 60s
  if (Date.now() < expiresAt - 60_000) {
    return { token: row.access_token, email: row.account_email };
  }

  // Refresh
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

  return { token: refreshed.access_token, email: row.account_email };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: "Google OAuth not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const auth = await getValidAccessToken(supabase);
    if (!auth) {
      return new Response(
        JSON.stringify({ connected: false, events: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    if (req.method === "POST" && action === "create") {
      const body = await req.json();
      const createRes = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${auth.token}`,
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
      return new Response(JSON.stringify({ event: created }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List events: default = next 90 days
    const timeMin =
      url.searchParams.get("timeMin") ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax =
      url.searchParams.get("timeMax") ||
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch list of all calendars
    const calListRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      { headers: { Authorization: `Bearer ${auth.token}` } },
    );
    const calList = await calListRes.json();
    const calendars = (calList.items || []).filter((c: any) => c.selected !== false);

    const allEvents: any[] = [];
    for (const cal of calendars) {
      const evRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?` +
          new URLSearchParams({
            timeMin,
            timeMax,
            singleEvents: "true",
            orderBy: "startTime",
            maxResults: "250",
          }),
        { headers: { Authorization: `Bearer ${auth.token}` } },
      );
      const ev = await evRes.json();
      for (const e of ev.items || []) {
        allEvents.push({
          id: e.id,
          calendarId: cal.id,
          calendarName: cal.summary,
          calendarColor: cal.backgroundColor || "#4285f4",
          title: e.summary || "(no title)",
          description: e.description || "",
          location: e.location || "",
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          allDay: !!e.start?.date,
          htmlLink: e.htmlLink,
        });
      }
    }

    return new Response(
      JSON.stringify({ connected: true, email: auth.email, events: allEvents }),
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
