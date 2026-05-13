// append-practice-session-row — P318.
//
// Mirrors one completed practice session into Josh's long-running Google
// Sheet (PRACTICE_SHEET_ID, tab gid=0). The portal is the source of truth;
// the sheet is the historical-continuity record Josh maintained by hand for
// years before the portal existed. Same column layout, same taxonomy.
//
// Input: { session_id: string }
// Reads practice_sessions + practice_session_segments, formats one row of
// 15 cells (cols A-O), calls Sheets API `values.append`.
//
// Column map (A-O — what we write; P+ are Josh's manual cumulative columns,
// untouched):
//   A Date              — M/D (no zero-pad, no year — mirrors precedent)
//   B Total Time        — `N hrs` / `N.5 hrs` for ≥60min (rounded to nearest
//                          half hr); `<N> min` otherwise.
//   C Song of the day   — practice_sessions.song_of_the_day
//   D Chords            — per-segment `<min> min - <text>`, joined with `; `
//   E Scales              (text = segment.what_practiced || segment.label;
//   F Technical           skipped/zero-second segments excluded)
//   G Patterns
//   H Lines
//   I Songs
//   J Transcriptions
//   K Arrangements
//   L Original
//   M Other
//   N Rehearsal
//   O Gigs
//
// Auth: uses the same google_calendar_tokens row pattern as sibling fns.
// Picks the oldest token row whose `scope` includes `spreadsheets`. If
// PRACTICE_SHEET_OWNER_EMAIL is set, prefers the matching account.
//
// Token refresh: shares the ensureFreshToken/refreshToken pattern with
// drive-search-event / google-calendar-events. On a 401 from Sheets, force-
// refresh once and retry.

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
const PRACTICE_SHEET_ID = Deno.env.get("PRACTICE_SHEET_ID");
const PRACTICE_SHEET_OWNER_EMAIL = Deno.env.get("PRACTICE_SHEET_OWNER_EMAIL");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function refreshToken(supabase: any, row: any): Promise<string> {
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
    await supabase
      .from("google_calendar_tokens")
      .update({
        needs_reconnect: true,
        last_refresh_error: JSON.stringify(refreshed).slice(0, 500),
        last_refresh_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    throw new Error(`Refresh failed: ${JSON.stringify(refreshed)}`);
  }
  const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase
    .from("google_calendar_tokens")
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpires,
      needs_reconnect: false,
      last_refresh_at: new Date().toISOString(),
      last_refresh_error: null,
    })
    .eq("id", row.id);
  return refreshed.access_token;
}

async function ensureFreshToken(supabase: any, row: any): Promise<string> {
  const expiresAt = new Date(row.expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) return row.access_token;
  return await refreshToken(supabase, row);
}

// Map practice-session-segment categories to sheet column letters D-O.
// Source of truth for category names is PracticeTimerWidget's preset segments;
// keeping a defensive lookup table here lets us miss-gracefully if a category
// arrives that doesn't map.
const CATEGORY_TO_COL: Record<string, string> = {
  Chords: "D",
  Scales: "E",
  Technical: "F",
  Patterns: "G",
  Lines: "H",
  Songs: "I",
  Transcriptions: "J",
  Arrangements: "K",
  Original: "L",
  Other: "M",
  Rehearsal: "N",
  Gigs: "O",
};

function formatDateMD(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatTotalTime(totalMinutes: number | null | undefined): string {
  const t = totalMinutes ?? 0;
  if (t <= 0) return "0 min";
  if (t < 60) return `${t} min`;
  // Round to nearest half-hour. 1.0 → "1 hrs"; 1.5 → "1.5 hrs"; 2.0 → "2 hrs".
  const halfHrs = Math.round(t / 30) / 2;
  return `${halfHrs} hrs`;
}

function formatSegmentCell(text: string, actualSeconds: number): string {
  const mins = Math.max(1, Math.round(actualSeconds / 60));
  return `${mins} min - ${text}`.trim();
}

interface Segment {
  category: string | null;
  label: string | null;
  what_practiced: string | null;
  actual_seconds: number | null;
  skipped: boolean | null;
}

interface Session {
  ended_at: string | null;
  total_minutes: number | null;
  song_of_the_day: string | null;
}

function buildRow(session: Session, segments: Segment[]): string[] {
  const cells: Record<string, string[]> = {
    D: [], E: [], F: [], G: [], H: [], I: [],
    J: [], K: [], L: [], M: [], N: [], O: [],
  };

  for (const seg of segments) {
    if (seg.skipped) continue;
    const sec = seg.actual_seconds ?? 0;
    if (sec <= 0) continue;
    const col = seg.category ? CATEGORY_TO_COL[seg.category] : null;
    if (!col) continue;
    const text = (seg.what_practiced && seg.what_practiced.trim())
      || (seg.label && seg.label.trim())
      || "";
    cells[col].push(formatSegmentCell(text, sec));
  }

  return [
    formatDateMD(session.ended_at),                  // A
    formatTotalTime(session.total_minutes),          // B
    session.song_of_the_day || "",                   // C
    cells.D.join("; "),                              // D Chords
    cells.E.join("; "),                              // E Scales
    cells.F.join("; "),                              // F Technical
    cells.G.join("; "),                              // G Patterns
    cells.H.join("; "),                              // H Lines
    cells.I.join("; "),                              // I Songs
    cells.J.join("; "),                              // J Transcriptions
    cells.K.join("; "),                              // K Arrangements
    cells.L.join("; "),                              // L Original
    cells.M.join("; "),                              // M Other
    cells.N.join("; "),                              // N Rehearsal
    cells.O.join("; "),                              // O Gigs
  ];
}

// Surfaces "Sheets API not enabled in this Cloud project" as a structured
// signal (mirrors drive-search-event's drive_api_not_enabled handling).
class SheetsApiNotEnabledError extends Error {
  enableUrl: string;
  projectId: string | null;
  constructor(projectId: string | null) {
    super("Google Sheets API not enabled in this Cloud project.");
    this.projectId = projectId;
    this.enableUrl = projectId
      ? `https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=${projectId}`
      : "https://console.developers.google.com/apis/api/sheets.googleapis.com/overview";
  }
}

// Look up the tab name for gid=0 (the canonical practice-log tab). Done per
// invocation — it's a cheap metadata call and avoids hardcoding the tab name
// (Josh has renamed sheets before; this stays resilient to rename).
async function lookupFirstTabName(accessToken: string, sheetId: string): Promise<string> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties(sheetId,title))`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403 && /has not been used in project|sheets\.googleapis\.com/i.test(body)) {
      const projectMatch = body.match(/project (\d+)/);
      throw new SheetsApiNotEnabledError(projectMatch ? projectMatch[1] : null);
    }
    throw new Error(`sheets metadata fetch failed: ${res.status} ${body.slice(0, 300)}`);
  }
  const body = await res.json();
  const tab = (body.sheets || []).find((s: any) => s.properties?.sheetId === 0);
  if (!tab) throw new Error("no sheet with sheetId=0 found in spreadsheet");
  return tab.properties.title as string;
}

async function appendRow(
  accessToken: string,
  sheetId: string,
  tabName: string,
  row: string[],
): Promise<Response> {
  const range = `${tabName}!A:O`;
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append`,
  );
  url.searchParams.set("valueInputOption", "USER_ENTERED");
  url.searchParams.set("insertDataOption", "INSERT_ROWS");
  return await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [row] }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return jsonResponse({ error: "Google OAuth not configured" }, 500);
  }
  if (!PRACTICE_SHEET_ID) {
    return jsonResponse({ error: "PRACTICE_SHEET_ID secret not set" }, 500);
  }

  try {
    const body = await req.json();
    const sessionId = typeof body?.session_id === "string" ? body.session_id : "";
    if (!sessionId) return jsonResponse({ error: "session_id required" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: sessionRow, error: sessErr } = await supabase
      .from("practice_sessions")
      .select("ended_at, total_minutes, song_of_the_day")
      .eq("id", sessionId)
      .single();
    if (sessErr || !sessionRow) {
      return jsonResponse({ error: "session not found", detail: sessErr?.message }, 404);
    }

    const { data: segRows, error: segErr } = await supabase
      .from("practice_session_segments")
      .select("category, label, what_practiced, actual_seconds, skipped")
      .eq("session_id", sessionId)
      .order("sort_order", { ascending: true });
    if (segErr) {
      return jsonResponse({ error: "segment fetch failed", detail: segErr.message }, 500);
    }

    const row = buildRow(sessionRow as Session, (segRows || []) as Segment[]);

    // Pick the token row that owns the sheet. Prefer PRACTICE_SHEET_OWNER_EMAIL
    // if set; otherwise oldest token with the spreadsheets scope granted.
    const { data: tokenRows } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .order("created_at", { ascending: true });

    if (!tokenRows || tokenRows.length === 0) {
      return jsonResponse({
        error: "no_google_account_connected",
        message: "Connect a Google account on /team/dashboard first.",
        row_preview: row,
      }, 412);
    }

    const tokenRow = PRACTICE_SHEET_OWNER_EMAIL
      ? tokenRows.find((r: any) => r.account_email === PRACTICE_SHEET_OWNER_EMAIL)
      : tokenRows.find((r: any) => r.scope && /\bspreadsheets\b/.test(r.scope))
        || tokenRows[0];

    if (!tokenRow) {
      return jsonResponse({
        error: "owner_account_not_found",
        message: `PRACTICE_SHEET_OWNER_EMAIL=${PRACTICE_SHEET_OWNER_EMAIL} is not among connected accounts.`,
        row_preview: row,
      }, 412);
    }

    if (!tokenRow.scope || !/\bspreadsheets\b/.test(tokenRow.scope)) {
      return jsonResponse({
        error: "spreadsheets_scope_not_granted",
        account_email: tokenRow.account_email,
        message: "Spreadsheets scope not yet granted. Re-consent at /team/dashboard Google OAuth.",
        row_preview: row,
      }, 412);
    }

    let accessToken = await ensureFreshToken(supabase, tokenRow);
    const tabName = await lookupFirstTabName(accessToken, PRACTICE_SHEET_ID);
    let res = await appendRow(accessToken, PRACTICE_SHEET_ID, tabName, row);

    if (res.status === 401) {
      accessToken = await refreshToken(supabase, tokenRow);
      res = await appendRow(accessToken, PRACTICE_SHEET_ID, tabName, row);
    }

    if (!res.ok) {
      const errText = await res.text();
      return jsonResponse({
        error: "sheets_api_error",
        status: res.status,
        detail: errText.slice(0, 500),
        row_preview: row,
      }, res.status);
    }

    const appendBody = await res.json();
    // Sheets returns updates.updatedRange like "Sheet1!A123:O123"; pull the row.
    const updatedRange = appendBody?.updates?.updatedRange || "";
    const rowMatch = updatedRange.match(/!A(\d+):/);
    const rowIndex = rowMatch ? parseInt(rowMatch[1], 10) : null;

    return jsonResponse({
      ok: true,
      row_index: rowIndex,
      sheet_url: `https://docs.google.com/spreadsheets/d/${PRACTICE_SHEET_ID}/edit#gid=0&range=A${rowIndex || ""}`,
      account_email: tokenRow.account_email,
      row_preview: row,
    });
  } catch (err) {
    if (err instanceof SheetsApiNotEnabledError) {
      return jsonResponse({
        error: "sheets_api_not_enabled",
        project_id: err.projectId,
        enable_url: err.enableUrl,
        message: "Google Sheets API is not enabled in this Cloud project. Enable it once, wait ~1 minute, then retry.",
      }, 412);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: "unhandled", detail: msg }, 500);
  }
});
