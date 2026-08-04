// gcal-direct — direct Google Calendar access for headless internal jobs
// (pg_cron-driven edge fns like smart-followup-repin).
//
// Why this exists (2026-08-04, the smart-followup-repin post-mortem): internal
// jobs used to round-trip through the google-calendar-events HTTP endpoint,
// which is operator-gated for the UI. That fn-to-fn hop depended on an auth
// handshake the job didn't need — and it silently broke when the platform
// changed the service key format. Jobs already hold service-role DB access, so
// they read google_calendar_tokens and call the Google API themselves. No HTTP
// hop, no handshake to break.
//
// Logic mirrors google-calendar-events exactly: same token refresh, same
// open-slot rules (mid-afternoon 13:00-17:30 first, then late morning
// 10:00-11:30, never the 12-1 lunch hour), same all-day fallback when the
// mid-day band is full.

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");

// deno-lint-ignore no-explicit-any
type AnyClient = any;

export type GcalEvent = {
  id?: string;
  htmlLink?: string;
  [k: string]: unknown;
};

async function ensureFreshToken(supabase: AnyClient, row: AnyClient): Promise<string> {
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

// Fresh access token for one connected account (exact email match, or the
// oldest-connected account when no email given). null → no account connected
// or Google OAuth env not configured.
export async function getAccountToken(
  supabase: AnyClient,
  accountEmail?: string,
): Promise<{ token: string; email: string } | null> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
  const { data: tokenRows } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .order("created_at", { ascending: true });
  if (!tokenRows || tokenRows.length === 0) return null;
  const row = accountEmail
    ? tokenRows.find((r: AnyClient) => r.account_email === accountEmail) || tokenRows[0]
    : tokenRows[0];
  const token = await ensureFreshToken(supabase, row);
  return { token, email: row.account_email as string };
}

// US-East offset for a date (EDT most of the year, EST in deep winter). Good
// enough for Baltimore; freeBusy is the source of truth for conflicts.
function etOffset(dateStr: string): string {
  const m = parseInt(dateStr.slice(5, 7), 10);
  return m >= 4 && m <= 10 ? "-04:00" : "-05:00";
}

// First open `slotMin`-minute window on `dateStr`, preferring mid-afternoon
// (13:00-17:30) then late-morning (10:00-11:30), always skipping the 12-1
// lunch hour, within 10:00-18:00. null if the mid-day band is busy (caller
// falls back to all-day so nothing is lost).
export async function findOpenSlot(
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

// Start/end fields for a re-pinned block on `date`: an open mid-day slot when
// one exists, else an all-day pin (nothing is lost when the day is packed).
export async function slotFieldsFor(
  token: string,
  date: string,
  slotMinutes: number,
  tz: string,
): Promise<{ start: Record<string, string>; end: Record<string, string> }> {
  const slot = await findOpenSlot(token, date, slotMinutes, tz);
  if (slot) {
    return {
      start: { dateTime: slot.start, timeZone: tz },
      end: { dateTime: slot.end, timeZone: tz },
    };
  }
  return { start: { date }, end: { date } };
}

export type GcalResult =
  | { ok: true; event: GcalEvent }
  | { ok: false; status: number; body: string };

export async function createEvent(
  token: string,
  fields: { summary: string; description?: string; start: Record<string, string>; end: Record<string, string> },
): Promise<GcalResult> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: fields.summary,
      description: fields.description || "",
      start: fields.start,
      end: fields.end,
    }),
  });
  if (!res.ok) return { ok: false, status: res.status, body: (await res.text()).slice(0, 300) };
  return { ok: true, event: await res.json() };
}

export async function patchEvent(
  token: string,
  eventId: string,
  fields: { summary?: string; description?: string; start: Record<string, string>; end: Record<string, string> },
): Promise<GcalResult> {
  const patchBody: Record<string, unknown> = { start: fields.start, end: fields.end };
  if (typeof fields.summary === "string") patchBody.summary = fields.summary;
  if (typeof fields.description === "string") patchBody.description = fields.description;
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    },
  );
  if (!res.ok) return { ok: false, status: res.status, body: (await res.text()).slice(0, 300) };
  return { ok: true, event: await res.json() };
}
