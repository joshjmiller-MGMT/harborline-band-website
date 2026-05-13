// Enforces the booking rule "≥2 evenings/week free" across all connected
// Google Calendar accounts. For each week in the next N weeks (Mon-Sun, ET),
// counts how many distinct evenings are "busy" (a timed event starting at or
// after 18:00 ET, OR an all-day event tagged green = performance) and flags
// any week where 5+ evenings are busy (i.e. ≤2 evenings free).
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

// Matches P11's GREEN definition — green-tagged all-day events count as a
// performance evening even though they have no start time.
const GREEN_COLOR_IDS = new Set(["10", "2"]);

const EVENING_HOUR_ET = 18; // 6 PM local

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
  if (!refreshRes.ok) {
    const errMsg = `Refresh failed: ${JSON.stringify(refreshed)}`;
    await supabase
      .from("google_calendar_tokens")
      .update({
        needs_reconnect: true,
        last_refresh_error: errMsg,
        last_refresh_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    throw new Error(errMsg);
  }
  const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase
    .from("google_calendar_tokens")
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpires,
      needs_reconnect: false,
      last_refresh_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  return refreshed.access_token;
}

type ETParts = { y: number; m: number; d: number; hour: number };

// Convert any Date / ISO string into its components in America/New_York. Uses
// Intl.DateTimeFormat so DST is handled correctly; cheap enough to call per event.
function toET(input: string | Date): ETParts {
  const date = typeof input === "string" ? new Date(input) : input;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    hour: Number(parts.hour) % 24,
  };
}

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Returns the Monday on or before the given Y-M-D (ET local). Treats Sunday
// as the last day of the previous Mon-Sun window.
function mondayOnOrBefore(y: number, m: number, d: number): { y: number; m: number; d: number } {
  // Use a fixed-noon ET-ish anchor (12:00 UTC) so DOW math is stable. We only
  // need the day-of-week — the exact wall clock doesn't matter for that.
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dow = anchor.getUTCDay(); // 0 Sun … 6 Sat
  const offsetToMonday = (dow + 6) % 7; // Mon = 0, Tue = 1, … Sun = 6
  const monday = new Date(Date.UTC(y, m - 1, d - offsetToMonday, 12, 0, 0));
  return {
    y: monday.getUTCFullYear(),
    m: monday.getUTCMonth() + 1,
    d: monday.getUTCDate(),
  };
}

function addDays(y: number, m: number, d: number, n: number): { y: number; m: number; d: number } {
  const t = new Date(Date.UTC(y, m - 1, d + n, 12, 0, 0));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

type RawEvent = {
  id: string;
  accountEmail: string;
  calendarName: string;
  title: string;
  start?: string; // RFC3339 dateTime
  date?: string; // YYYY-MM-DD (all-day)
  end?: string;
  allDay: boolean;
  htmlLink: string;
  colorId?: string;
};

type WeekBucket = {
  weekStart: string; // YYYY-MM-DD (Mon, ET)
  weekEnd: string; // YYYY-MM-DD (Sun, ET)
  busyEvenings: number;
  freeEvenings: number;
  flag: boolean; // busyEvenings >= 5 → ≤2 free
  evenings: { date: string; reason: string; events: { id: string; title: string; accountEmail: string; htmlLink: string }[] }[];
};

function eventEveningReason(ev: RawEvent): { date: string; reason: string } | null {
  if (ev.allDay) {
    // Only all-day events tagged green count as performance / evening-busy.
    if (ev.colorId && GREEN_COLOR_IDS.has(String(ev.colorId)) && ev.date) {
      return { date: ev.date, reason: "all-day performance (green)" };
    }
    return null;
  }
  if (!ev.start) return null;
  const et = toET(ev.start);
  if (et.hour < EVENING_HOUR_ET) return null;
  return { date: isoDate(et.y, et.m, et.d), reason: `evening event @ ${String(et.hour).padStart(2, "0")}:00 ET` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let bodyWeeks: number | undefined;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body && typeof body.weeks === "number") bodyWeeks = body.weeks;
      } catch {
        // body optional
      }
    }
    const url = new URL(req.url);
    const weeks = Math.max(
      1,
      Math.min(26, Number(bodyWeeks ?? url.searchParams.get("weeks") ?? 8)),
    );

    const { data: tokenRows } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .order("created_at", { ascending: true });

    if (!tokenRows || tokenRows.length === 0) {
      return new Response(
        JSON.stringify({ configured: true, connected: false, weeks: [], windowWeeks: weeks }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build week buckets up front. Anchor = Monday on or before "today in ET".
    const nowET = toET(new Date());
    const anchorMon = mondayOnOrBefore(nowET.y, nowET.m, nowET.d);
    const buckets: WeekBucket[] = [];
    const bucketByStart = new Map<string, WeekBucket>();
    for (let i = 0; i < weeks; i++) {
      const start = addDays(anchorMon.y, anchorMon.m, anchorMon.d, i * 7);
      const end = addDays(anchorMon.y, anchorMon.m, anchorMon.d, i * 7 + 6);
      const b: WeekBucket = {
        weekStart: isoDate(start.y, start.m, start.d),
        weekEnd: isoDate(end.y, end.m, end.d),
        busyEvenings: 0,
        freeEvenings: 7,
        flag: false,
        evenings: [],
      };
      buckets.push(b);
      bucketByStart.set(b.weekStart, b);
    }

    // For each event, find the bucket it belongs to by its Monday-of-week.
    function bucketForDate(date: string): WeekBucket | null {
      const [y, m, d] = date.split("-").map(Number);
      const mon = mondayOnOrBefore(y, m, d);
      const key = isoDate(mon.y, mon.m, mon.d);
      return bucketByStart.get(key) ?? null;
    }

    // Fetch window for the calendar API: from anchor Monday → end of last bucket.
    const lastBucket = buckets[buckets.length - 1];
    const [ly, lm, ld] = lastBucket.weekEnd.split("-").map(Number);
    const lastDay = addDays(ly, lm, ld, 1); // exclusive upper bound
    // timeMin = anchor Monday 00:00 ET ≈ UTC 04:00–05:00 depending on DST. Use 04:00 UTC.
    const timeMin = new Date(Date.UTC(anchorMon.y, anchorMon.m - 1, anchorMon.d, 4, 0, 0)).toISOString();
    const timeMax = new Date(Date.UTC(lastDay.y, lastDay.m - 1, lastDay.d, 4, 0, 0)).toISOString();

    const accountSummaries: any[] = [];
    const allRaw: RawEvent[] = [];

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
            accountSummaries.push({
              email: row.account_email,
              calendars: 0,
              error: calList?.error?.message || `HTTP ${calListRes.status}`,
            });
            return;
          }
          const calendars = (calList.items || []).filter((c: any) => c.selected !== false);
          accountSummaries.push({ email: row.account_email, calendars: calendars.length });

          await Promise.all(
            calendars.map(async (cal: any) => {
              const evRes = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?` +
                  new URLSearchParams({
                    timeMin,
                    timeMax,
                    singleEvents: "true",
                    orderBy: "startTime",
                    maxResults: "500",
                  }),
                { headers: { Authorization: `Bearer ${token}` } },
              );
              const ev = await evRes.json();
              if (!evRes.ok) return;

              for (const e of ev.items || []) {
                // Skip cancelled / declined events.
                if (e.status === "cancelled") continue;
                const isAllDay = !!e.start?.date;
                allRaw.push({
                  id: `${row.account_email}:${e.id}`,
                  accountEmail: row.account_email,
                  calendarName: cal.summary,
                  title: e.summary || "(no title)",
                  start: e.start?.dateTime,
                  date: e.start?.date,
                  end: e.end?.dateTime || e.end?.date,
                  allDay: isAllDay,
                  htmlLink: e.htmlLink,
                  colorId: e.colorId,
                });
              }
            }),
          );
        } catch (err) {
          accountSummaries.push({
            email: row.account_email,
            calendars: 0,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }),
    );

    // Dedup raw events across calendars (same id surfaces multiple times).
    const seen = new Set<string>();
    const rawEvents = allRaw.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    // Assign each qualifying event to its (week-bucket, evening-date).
    type EveningKey = `${string}|${string}`; // weekStart|YYYY-MM-DD
    const eveningMap = new Map<EveningKey, WeekBucket["evenings"][number]>();

    for (const e of rawEvents) {
      const reason = eventEveningReason(e);
      if (!reason) continue;
      const bucket = bucketForDate(reason.date);
      if (!bucket) continue; // outside window (shouldn't happen given filter)
      const key: EveningKey = `${bucket.weekStart}|${reason.date}`;
      let evening = eveningMap.get(key);
      if (!evening) {
        evening = { date: reason.date, reason: reason.reason, events: [] };
        eveningMap.set(key, evening);
        bucket.evenings.push(evening);
      }
      evening.events.push({
        id: e.id,
        title: e.title,
        accountEmail: e.accountEmail,
        htmlLink: e.htmlLink || "",
      });
    }

    // Final counts: distinct evenings busy per bucket.
    for (const b of buckets) {
      // Sort evenings by date so the UI renders in order.
      b.evenings.sort((a, z) => a.date.localeCompare(z.date));
      b.busyEvenings = b.evenings.length;
      b.freeEvenings = Math.max(0, 7 - b.busyEvenings);
      b.flag = b.busyEvenings >= 5;
    }

    return new Response(
      JSON.stringify({
        configured: true,
        connected: true,
        windowWeeks: weeks,
        timeMin,
        timeMax,
        accounts: accountSummaries,
        weeks: buckets,
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
