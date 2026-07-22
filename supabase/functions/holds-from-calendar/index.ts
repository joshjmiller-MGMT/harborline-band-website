// holds-from-calendar — auto-populate the Sales Holds tracker from Josh's
// calendars (Josh 2026-07-21: "we have my calendar, we know what's a hold,
// have this autopopulate"). Banana/yellow (colorId 5) = hold in the 2026-06-22
// color scheme. Walks every connected Google account, pulls upcoming yellow
// events, and upserts sales_holds keyed by calendar_event_id — so a re-sync
// refreshes date/label but NEVER touches statuses Josh has worked (a hold he
// closed stays closed).
//
// Auth: operator JWT (frontend) OR x-cron-secret (daily pg_cron) — same
// pattern as smart-task-rewrite.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const HOLD_COLOR_ID = "5"; // Banana/yellow = hold (Josh's color system)
const LOOKAHEAD_DAYS = 180;

// Light role sniffing from the event title — enough to prefill the Holds row.
const ROLE_WORDS = [
  "trumpet", "sax", "saxophone", "trombone", "horn", "keys", "piano",
  "drums", "drummer", "bass", "guitar", "violin", "cello", "harp",
  "vocals", "singer", "vocalist", "dj", "percussion",
];

let cachedCronSecret: string | null = null;
async function loadCronSecret(supabase: SupabaseClient): Promise<string | null> {
  if (cachedCronSecret !== null) return cachedCronSecret;
  const { data, error } = await supabase
    .from("cron_secrets").select("secret")
    .eq("name", "trello_route_cron_secret").maybeSingle();
  if (error || !data?.secret) return null;
  cachedCronSecret = data.secret as string;
  return cachedCronSecret;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function ensureFreshToken(supabase: SupabaseClient, row: {
  id: string; access_token: string; refresh_token: string; expires_at: string;
}): Promise<string> {
  if (Date.now() < new Date(row.expires_at).getTime() - 60_000) return row.access_token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!, client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: row.refresh_token, grant_type: "refresh_token",
    }),
  });
  const refreshed = await res.json();
  if (!res.ok) throw new Error(`refresh_failed: ${JSON.stringify(refreshed).slice(0, 150)}`);
  await supabase.from("google_calendar_tokens").update({
    access_token: refreshed.access_token,
    expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    last_refresh_at: new Date().toISOString(), needs_reconnect: false,
  }).eq("id", row.id);
  return refreshed.access_token as string;
}

function inferRole(title: string): string | null {
  const t = title.toLowerCase();
  for (const w of ROLE_WORDS) if (t.includes(w)) return w;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const cronHeader = req.headers.get("x-cron-secret");
  let isCron = false;
  if (cronHeader) {
    const expected = await loadCronSecret(supabase);
    if (expected && constantTimeEquals(cronHeader, expected)) isCron = true;
  }
  if (!isCron) {
    const denial = await requireOperator(req);
    if (denial) return denial;
  }

  try {
    const { data: accounts, error: accErr } = await supabase
      .from("google_calendar_tokens")
      .select("id, account_email, access_token, refresh_token, expires_at");
    if (accErr) throw new Error(`tokens_query: ${accErr.message}`);

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + LOOKAHEAD_DAYS * 86400000).toISOString();

    let scanned = 0, holdsSeen = 0, inserted = 0, refreshed = 0;
    const errors: string[] = [];

    for (const acct of accounts ?? []) {
      let token: string;
      try {
        token = await ensureFreshToken(supabase, acct);
      } catch (e) {
        errors.push(`${acct.account_email}: ${(e as Error).message.slice(0, 120)}`);
        continue;
      }
      const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("maxResults", "2500");
      const evRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!evRes.ok) {
        errors.push(`${acct.account_email}: events_${evRes.status}`);
        continue;
      }
      const evData = await evRes.json();
      for (const ev of evData.items ?? []) {
        scanned++;
        if (ev.colorId !== HOLD_COLOR_ID || ev.status === "cancelled") continue;
        holdsSeen++;
        const date = (ev.start?.date ?? ev.start?.dateTime ?? "").slice(0, 10) || null;
        if (!date) continue;
        const title = (ev.summary ?? "(untitled hold)").slice(0, 200);
        // Insert new; on re-sync refresh date/label ONLY — never statuses.
        const { data: up, error: upErr } = await supabase
          .from("sales_holds")
          .upsert(
            {
              calendar_event_id: ev.id,
              event_date: date,
              event_label: title,
              role: inferRole(title),
              hold_status: "open",
              musician_status: "available",
              followup_cadence: "weekly",
              next_check_at: new Date(Date.now() + 7 * 86400000).toISOString(),
              notes: `auto from calendar (yellow hold) · ${acct.account_email}`,
            },
            { onConflict: "calendar_event_id", ignoreDuplicates: true },
          )
          .select("id");
        if (upErr) { errors.push(`upsert ${ev.id}: ${upErr.message.slice(0, 100)}`); continue; }
        if (up && up.length > 0) inserted++;
        else {
          // Existing hold: refresh the calendar-truth fields only.
          await supabase.from("sales_holds")
            .update({ event_date: date, event_label: title, updated_at: new Date().toISOString() })
            .eq("calendar_event_id", ev.id);
          refreshed++;
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true, accounts: (accounts ?? []).length, scanned,
      yellow_holds_seen: holdsSeen, inserted, refreshed, errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
