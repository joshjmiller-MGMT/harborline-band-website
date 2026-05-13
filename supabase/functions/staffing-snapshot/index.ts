// Pulls the next N days of Google Calendar events colored "green" across all
// connected accounts, parses staff names from event descriptions, infers an
// expected headcount from the event title, and returns a per-event staffing
// snapshot for the StaffingWidget.
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

// "Green" in Google's per-event palette: Basil ("10", the default dark green)
// and Sage ("2", the lighter green). Both are user-pickable as "green" in the
// GCal UI on different surfaces, so we accept either. Narrow this set if it
// over-captures.
const GREEN_COLOR_IDS = new Set(["10", "2"]);

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

type HeadcountInference = {
  expected: number | null;
  // Reason string surfaced in the UI so Josh can see WHY a number was picked.
  source: string;
};

function inferExpectedHeadcount(title: string): HeadcountInference {
  const t = title.toLowerCase();

  // Explicit JM codes win over everything else.
  if (/\bjm\s*5\b/.test(t)) return { expected: 5, source: "jm5 code" };
  if (/\bjm\s*4\b/.test(t)) return { expected: 4, source: "jm4 code" };
  if (/\bjm\s*3\b/.test(t)) return { expected: 3, source: "jm3 code" };
  if (/\bjm\s*2\b/.test(t)) return { expected: 2, source: "jm2 code" };

  // Named ensembles.
  if (/\beconomy\b/.test(t)) {
    return { expected: 4, source: "Economy → Jon+Sean+bass+singer (4 min, +1 optional)" };
  }
  if (/\bquartet\b/.test(t)) return { expected: 4, source: "quartet" };
  if (/\bquintet\b/.test(t)) return { expected: 5, source: "quintet" };
  if (/\btrio\b/.test(t)) return { expected: 3, source: "trio" };
  if (/\bduo\b/.test(t)) return { expected: 2, source: "duo" };

  // Brand-name defaults.
  if (/\bharborline\b/.test(t)) return { expected: 6, source: "Harborline brand → 6-piece default" };

  // Style hints — jazz events default to a standard 4-piece ensemble.
  if (/\bjazz\b/.test(t)) return { expected: 4, source: "jazz → 4-piece default" };

  return { expected: null, source: "no rule matched — title not tagged" };
}

const ROLE_TOKENS = [
  "piano",
  "keys",
  "keyboard",
  "drums",
  "drummer",
  "bass",
  "bassist",
  "guitar",
  "guitarist",
  "sax",
  "saxophone",
  "trumpet",
  "trombone",
  "horn",
  "horns",
  "vocal",
  "vocals",
  "vox",
  "voc",
  "sing",
  "singer",
  "vocalist",
  "perc",
  "percussion",
  "md",
  "mc",
  "emcee",
  "leader",
  "bandleader",
  "violin",
  "cello",
  "harp",
];

const NON_STAFF_KEYS = new Set([
  "setup",
  "set up",
  "load in",
  "loadin",
  "load-in",
  "load out",
  "loadout",
  "downbeat",
  "start",
  "end",
  "address",
  "venue",
  "location",
  "contact",
  "phone",
  "email",
  "client",
  "coordinator",
  "planner",
  "host",
  "pay",
  "fee",
  "rate",
  "notes",
  "note",
  "parking",
  "dress",
  "attire",
  "sound",
  "tech",
  "wifi",
  "wi-fi",
  "url",
  "link",
  "https",
  "http",
  "meal",
  "meals",
  "musician meals",
  "musician_meals",
  "ensemble",
  "djep",
  "form",
  "doc",
  "directions",
  "weather",
  "cancellation",
  "deposit",
  "balance",
]);

function stripParenNote(s: string): string {
  return s.replace(/\([^)]*\)/g, "").trim();
}

function splitNames(value: string): string[] {
  const cleaned = stripParenNote(value);
  return cleaned
    .split(/\s*(?:[,/&]|\band\b|\bw\/|\bwith\b)\s*/i)
    .map((n) => n.trim())
    .filter((n) => n.length > 0 && n.length < 60 && !/[@:0-9]/.test(n))
    .map((n) => n.replace(/^[-*•·]\s*/, "").trim())
    .filter((n) => n.length > 0);
}

type StaffParse = {
  staff_names: string[];
  matched_lines: string[];
};

function parseStaff(description: string): StaffParse {
  if (!description) return { staff_names: [], matched_lines: [] };

  // Strip HTML — GCal sometimes includes basic <br> / <a> markup.
  const text = description
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const names = new Set<string>();
  const matched: string[] = [];

  for (const line of lines) {
    // Pattern A: "Role: Name" or "Role - Name"
    const colonMatch = line.match(/^([A-Za-z][A-Za-z \-/&]{1,30})\s*[:\-–]\s*(.+)$/);
    if (colonMatch) {
      const rawKey = colonMatch[1].trim().toLowerCase();
      const rawValue = colonMatch[2].trim();
      const keyTokens = rawKey.split(/\s+/);
      const looksLikeRole = keyTokens.some((tok) =>
        ROLE_TOKENS.includes(tok.replace(/[^a-z]/g, "")),
      );
      const looksLikeNonStaff = NON_STAFF_KEYS.has(rawKey);

      if (looksLikeRole && !looksLikeNonStaff) {
        const extracted = splitNames(rawValue);
        if (extracted.length > 0) {
          matched.push(line);
          for (const n of extracted) names.add(n);
          continue;
        }
      }
    }

    // Pattern B: "Name (Role)" or "Name - Role"
    const nameRoleMatch = line.match(
      /^([A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+)?)\s*(?:\(([^)]+)\)|[-–]\s*([^,]+))/,
    );
    if (nameRoleMatch) {
      const candidate = nameRoleMatch[1].trim();
      const roleHint = (nameRoleMatch[2] || nameRoleMatch[3] || "").toLowerCase();
      const looksLikeRole = ROLE_TOKENS.some((r) => roleHint.includes(r));
      if (looksLikeRole && candidate.length > 1 && candidate.length < 40) {
        matched.push(line);
        names.add(candidate);
        continue;
      }
    }
  }

  return {
    staff_names: Array.from(names),
    matched_lines: matched,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const denial = await requireOperator(req);
  if (denial) return denial;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({
        configured: false,
        connected: false,
        events: [],
        error: "Google OAuth not configured",
      }),
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
        JSON.stringify({ configured: true, connected: false, events: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    let bodyDays: number | undefined;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body && typeof body.days === "number") bodyDays = body.days;
      } catch {
        // body optional
      }
    }
    const days = Math.max(
      1,
      Math.min(180, Number(bodyDays ?? url.searchParams.get("days") ?? 90)),
    );
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

    const eventBuckets: any[] = [];
    const accountSummaries: any[] = [];

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
                    maxResults: "250",
                  }),
                { headers: { Authorization: `Bearer ${token}` } },
              );
              const ev = await evRes.json();
              if (!evRes.ok) return;

              for (const e of ev.items || []) {
                if (!e.colorId || !GREEN_COLOR_IDS.has(String(e.colorId))) continue;

                const title = e.summary || "(no title)";
                const description = e.description || "";
                const inference = inferExpectedHeadcount(title);
                const parsed = parseStaff(description);
                const staffed_count = parsed.staff_names.length;
                const expected = inference.expected;
                const missing_count =
                  expected === null ? null : Math.max(0, expected - staffed_count);

                eventBuckets.push({
                  id: `${row.account_email}:${e.id}`,
                  accountEmail: row.account_email,
                  calendarId: cal.id,
                  calendarName: cal.summary,
                  title,
                  description,
                  location: e.location || "",
                  start: e.start?.dateTime || e.start?.date,
                  end: e.end?.dateTime || e.end?.date,
                  allDay: !!e.start?.date,
                  htmlLink: e.htmlLink,
                  colorId: e.colorId,
                  expected_headcount: expected,
                  expected_source: inference.source,
                  staffed_count,
                  missing_count,
                  staff_names: parsed.staff_names,
                  matched_lines: parsed.matched_lines,
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

    // Dedup by id (same event may surface across multiple calendars).
    const seen = new Set<string>();
    const deduped = eventBuckets.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    deduped.sort((a, b) => (a.start || "").localeCompare(b.start || ""));

    return new Response(
      JSON.stringify({
        configured: true,
        connected: true,
        windowDays: days,
        timeMin,
        timeMax,
        accounts: accountSummaries,
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
