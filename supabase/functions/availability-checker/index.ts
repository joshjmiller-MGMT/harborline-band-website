// Aggregates availability for a given date from Google Calendar, Gmail,
// Monday.com, and DJEP. Returns a tiered verdict (Confirmed/Tentative/Mention/Clear).
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
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

// Build common US date string variants for a given Y-M-D
function buildDateVariants(year: number, month: number, day: number): string[] {
  const monthsLong = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const monthsShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const m = month, d = day, y = year, yy = String(year).slice(2);
  const mp = String(m).padStart(2, "0");
  const dp = String(d).padStart(2, "0");
  return Array.from(new Set([
    `${m}/${d}/${y}`, `${m}/${d}/${yy}`, `${mp}/${dp}/${y}`, `${mp}/${dp}/${yy}`,
    `${m}-${d}-${y}`, `${m}-${d}-${yy}`, `${mp}-${dp}-${y}`, `${mp}-${dp}-${yy}`,
    `${y}-${mp}-${dp}`,
    `${monthsLong[m-1]} ${d}, ${y}`, `${monthsLong[m-1]} ${d}`,
    `${monthsShort[m-1]} ${d}, ${y}`, `${monthsShort[m-1]} ${d}`,
    `${monthsLong[m-1]} ${d}${["th","st","nd","rd"][((d%10>3||~~(d%100/10)===1)?0:d%10)]}`,
  ]));
}

function dayBoundsISO(dateStr: string): { startISO: string; endISO: string } {
  // dateStr in YYYY-MM-DD, treat as local NY day
  const [y, m, d] = dateStr.split("-").map(Number);
  // Use UTC bounds wide enough to cover ET
  const start = new Date(Date.UTC(y, m - 1, d, 4, 0, 0)); // ~midnight ET
  const end = new Date(Date.UTC(y, m - 1, d + 1, 4, 0, 0));
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

async function checkGoogleCalendars(supabase: any, dateStr: string) {
  const { startISO, endISO } = dayBoundsISO(dateStr);
  const accounts: any[] = [];
  const events: any[] = [];

  const { data: tokenRows } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .order("created_at", { ascending: true });

  if (!tokenRows?.length) return { accounts, events, connected: false };

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
          accounts.push({ email: row.account_email, error: calList?.error?.message || `HTTP ${calListRes.status}` });
          return;
        }
        const calendars = (calList.items || []).filter((c: any) => c.selected !== false);
        accounts.push({ email: row.account_email, calendars: calendars.length });

        await Promise.all(calendars.map(async (cal: any) => {
          const evRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?` +
              new URLSearchParams({
                timeMin: startISO,
                timeMax: endISO,
                singleEvents: "true",
                orderBy: "startTime",
                maxResults: "50",
              }),
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const ev = await evRes.json();
          for (const e of ev.items || []) {
            events.push({
              source: "google_calendar",
              account: row.account_email,
              calendar: cal.summary,
              title: e.summary || "(no title)",
              start: e.start?.dateTime || e.start?.date,
              end: e.end?.dateTime || e.end?.date,
              allDay: !!e.start?.date,
              location: e.location || "",
              status: e.status, // confirmed | tentative | cancelled
              htmlLink: e.htmlLink,
            });
          }
        }));
      } catch (err) {
        accounts.push({ email: row.account_email, error: err instanceof Error ? err.message : String(err) });
      }
    }),
  );
  return { accounts, events, connected: true };
}

async function checkGmail(supabase: any, dateStr: string, variants: string[]) {
  const { data: tokenRows } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .order("created_at", { ascending: true });
  if (!tokenRows?.length) return { messages: [], accounts: [], connected: false };

  // Gmail "after:YYYY/MM/DD before:YYYY/MM/DD" — for emails received that day
  const [y, m, d] = dateStr.split("-").map(Number);
  const after = `${y}/${m}/${d}`;
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
  const before = `${nextDay.getUTCFullYear()}/${nextDay.getUTCMonth() + 1}/${nextDay.getUTCDate()}`;

  // 180-day cap for mention search
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const mentionAfter = `${sixMonthsAgo.getUTCFullYear()}/${sixMonthsAgo.getUTCMonth() + 1}/${sixMonthsAgo.getUTCDate()}`;
  // Gmail OR query — quote each variant
  const orQuery = variants.map(v => `"${v.replace(/"/g, '')}"`).join(" OR ");
  const mentionQuery = `after:${mentionAfter} (${orQuery})`;
  const dayQuery = `after:${after} before:${before}`;

  const accounts: any[] = [];
  const messages: any[] = [];
  const seen = new Set<string>();

  await Promise.all(tokenRows.map(async (row: any) => {
    try {
      const token = await ensureFreshToken(supabase, row);
      const scope = row.scope || "";
      if (!scope.includes("gmail.readonly")) {
        accounts.push({ email: row.account_email, gmailScope: false, needsReconnect: true });
        return;
      }
      accounts.push({ email: row.account_email, gmailScope: true });

      // Run both queries in parallel
      const [mentionRes, dayRes] = await Promise.all([
        fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(mentionQuery)}&maxResults=15`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(dayQuery)}&maxResults=15`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const mentionList = mentionRes.ok ? await mentionRes.json() : { messages: [] };
      const dayList = dayRes.ok ? await dayRes.json() : { messages: [] };

      const tagged = [
        ...(mentionList.messages || []).map((m: any) => ({ id: m.id, matchType: "mention" as const })),
        ...(dayList.messages || []).map((m: any) => ({ id: m.id, matchType: "received_that_day" as const })),
      ];

      // Dedupe by id (mention takes precedence if both)
      const byId = new Map<string, "mention" | "received_that_day">();
      for (const t of tagged) {
        if (!byId.has(t.id)) byId.set(t.id, t.matchType);
        else if (t.matchType === "mention") byId.set(t.id, "mention");
      }

      // Hydrate metadata for up to 20 per account
      const ids = Array.from(byId.keys()).slice(0, 20);
      await Promise.all(ids.map(async (id) => {
        if (seen.has(id)) return;
        seen.add(id);
        const detRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!detRes.ok) return;
        const det = await detRes.json();
        const headers = det.payload?.headers || [];
        const get = (n: string) => headers.find((h: any) => h.name.toLowerCase() === n.toLowerCase())?.value || "";
        messages.push({
          source: "gmail",
          account: row.account_email,
          id,
          threadId: det.threadId,
          subject: get("Subject"),
          from: get("From"),
          date: get("Date"),
          snippet: det.snippet || "",
          matchType: byId.get(id),
          link: `https://mail.google.com/mail/u/0/#inbox/${det.threadId}`,
        });
      }));
    } catch (err) {
      accounts.push({ email: row.account_email, error: err instanceof Error ? err.message : String(err) });
    }
  }));

  return { accounts, messages, connected: true };
}

async function callInternalFn(path: string, params: Record<string, string>) {
  const url = new URL(`${SUPABASE_URL}/functions/v1/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) return null;
  return await res.json();
}

function eventOnDate(ev: any, dateStr: string): boolean {
  const s = ev.start || ev.startDate || ev.date || ev.start_at;
  if (!s) return false;
  return String(s).slice(0, 10) === dateStr;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const dateStr: string = body.date;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Response(JSON.stringify({ error: "date (YYYY-MM-DD) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const [y, m, d] = dateStr.split("-").map(Number);
    const variants = buildDateVariants(y, m, d);

    const [gcal, gmail, mondayRes, djepRes] = await Promise.all([
      checkGoogleCalendars(supabase, dateStr).catch((e) => ({ error: String(e), accounts: [], events: [] })),
      checkGmail(supabase, dateStr, variants).catch((e) => ({ error: String(e), accounts: [], messages: [] })),
      callInternalFn("monday-calendar-events", {}).catch(() => null),
      callInternalFn("djep-calendar-events", {}).catch(() => null),
    ]);

    // Filter Monday/DJEP events to that date
    const mondayEvents = Array.isArray(mondayRes?.events)
      ? mondayRes.events.filter((e: any) => eventOnDate(e, dateStr)).map((e: any) => ({ ...e, source: "monday" }))
      : [];
    const djepEvents = Array.isArray(djepRes?.events)
      ? djepRes.events.filter((e: any) => eventOnDate(e, dateStr)).map((e: any) => ({ ...e, source: "djep" }))
      : [];

    // Tier verdict
    const calEvents = (gcal as any).events || [];
    const confirmedCal = calEvents.filter((e: any) => e.status === "confirmed");
    const tentativeCal = calEvents.filter((e: any) => e.status === "tentative");

    let verdict: "confirmed_busy" | "tentative" | "mention_only" | "clear" = "clear";
    if (confirmedCal.length > 0 || mondayEvents.length > 0 || djepEvents.length > 0) {
      verdict = "confirmed_busy";
    } else if (tentativeCal.length > 0) {
      verdict = "tentative";
    } else if (((gmail as any).messages || []).length > 0) {
      verdict = "mention_only";
    }

    return new Response(JSON.stringify({
      date: dateStr,
      verdict,
      googleCalendar: gcal,
      gmail,
      monday: { events: mondayEvents, accounts: mondayRes?.sources || [] },
      djep: { events: djepEvents },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
