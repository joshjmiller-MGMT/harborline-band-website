// P340c — staffing-color-write
//
// Triggered from StaffingWidget when Josh saves edited staffing details from
// `/team/scheduler`. Writes back to the originating Google Calendar event:
//   1. updates the event description to reflect the new staff list (replaces
//      any existing `Staff:` line; appends if absent).
//   2. sets the event colorId based on the new staffed_count vs expected:
//        - staffed_count >= expected → colorId "2"  (Sage  — fully staffed)
//        - staffed_count <  expected → colorId "5"  (Banana — partially staffed)
//      Red (`colorId "11"`) is NOT set here — that's the "gig not confirmed"
//      state which lives on Josh's side in GCal directly (events with red
//      colorId are pre-filtered OUT of staffing-snapshot via GREEN_COLOR_IDS).
//
// Inputs (POST body):
//   { accountEmail, calendarId, eventId, newStaffNames: string[], expected: number | null }
//
// Reads the existing event from GCal (via the same multi-account token table
// google-calendar-events uses) to preserve narrative parts of the description
// the user wrote that aren't the staff list.
//
// Auth: requireOperator()-gated. Service-role bypass preserved.

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

// Color IDs match Google Calendar's documented "1".."11" event colors.
const COLOR_SAGE_FULLY_STAFFED = "2";        // "Sage"
const COLOR_BANANA_PARTIALLY_STAFFED = "5";  // "Banana"

// Matches `Staff:` / `Staffing:` / `Staffed:` (case-insensitive) at line start,
// the rest of that line is the existing staff list. Used to replace.
const STAFF_LINE_RE = /^[ \t]*staff(?:ing|ed)?:\s*(.+)$/im;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

function mergeDescription(existing: string, newStaffNames: string[]): string {
  const staffLine = `Staff: ${newStaffNames.join(", ")}`;
  if (STAFF_LINE_RE.test(existing)) {
    return existing.replace(STAFF_LINE_RE, staffLine);
  }
  if (!existing || existing.trim().length === 0) return staffLine;
  return `${existing.trimEnd()}\n${staffLine}`;
}

function colorForStaffing(staffed: number, expected: number | null): string {
  if (expected === null || expected <= 0) return COLOR_BANANA_PARTIALLY_STAFFED;
  return staffed >= expected
    ? COLOR_SAGE_FULLY_STAFFED
    : COLOR_BANANA_PARTIALLY_STAFFED;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed", expected: "POST" });
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return json(500, { error: "google_oauth_not_configured" });
  }

  let body: {
    accountEmail?: string;
    calendarId?: string;
    eventId?: string;
    newStaffNames?: string[];
    expected?: number | null;
  };
  try {
    body = await req.json();
  } catch (_err) {
    return json(400, { error: "invalid_json" });
  }

  const { accountEmail, calendarId, eventId, newStaffNames, expected } = body;
  if (!accountEmail || !calendarId || !eventId || !Array.isArray(newStaffNames)) {
    return json(400, {
      error: "missing_fields",
      required: ["accountEmail", "calendarId", "eventId", "newStaffNames[]"],
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: tokenRow, error: tokErr } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .eq("account_email", accountEmail)
      .maybeSingle();
    if (tokErr || !tokenRow) {
      return json(404, { error: "no_token_for_account", accountEmail });
    }
    const token = await ensureFreshToken(supabase, tokenRow);

    // Fetch the existing event to preserve the parts of description we aren't
    // touching. PATCH semantics let us omit unchanged fields; we still want
    // accurate merging of description, so we read first.
    const evUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
    const evRes = await fetch(evUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!evRes.ok) {
      const errBody = await evRes.text();
      return json(evRes.status, {
        error: "event_fetch_failed",
        status: evRes.status,
        detail: errBody.slice(0, 300),
      });
    }
    const existingEvent = await evRes.json();
    const existingDescription = existingEvent.description ?? "";

    // Trim + de-dupe + drop empties (mirror staffing-snapshot's name sanitization).
    const cleanedNames = Array.from(
      new Set(
        newStaffNames
          .map((n) => n.trim())
          .filter((n) => n.length > 0 && n.length < 60),
      ),
    );

    const newDescription = mergeDescription(existingDescription, cleanedNames);
    const expectedVal = typeof expected === "number" ? expected : null;
    const newColorId = colorForStaffing(cleanedNames.length, expectedVal);

    // PATCH the event: description + colorId only.
    const patchRes = await fetch(evUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: newDescription,
        colorId: newColorId,
      }),
    });
    if (!patchRes.ok) {
      const errBody = await patchRes.text();
      return json(patchRes.status, {
        error: "event_patch_failed",
        status: patchRes.status,
        detail: errBody.slice(0, 300),
      });
    }
    const patched = await patchRes.json();

    return json(200, {
      ok: true,
      account: accountEmail,
      eventId: patched.id,
      newColorId,
      newStaffCount: cleanedNames.length,
      expected: expectedVal,
      derivedFromExpected: expectedVal !== null,
      htmlLink: patched.htmlLink,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("staffing-color-write error", msg);
    return json(500, { error: "unhandled", message: msg });
  }
});
