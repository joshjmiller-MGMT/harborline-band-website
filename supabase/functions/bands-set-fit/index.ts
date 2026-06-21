// bands-set-fit — write-back for the /team/bands relationship board.
//
// When a band card is dragged to a new Artist-Fit column on the board, the
// frontend calls this fn to persist the new rating into the JJMM "Artists" tab
// (the same sheet the board reads via booking-agent-rows tab=bands).
//
// Input:  { row_index: number, fit: string }   e.g. { row_index: 7, fit: "4 — Strong Yes" }
//         fit="" clears the rating (drag to the Unrated column).
// Effect: values.update on `<Artists tab>!<Artist Fit col><row_index>`.
//
// sheet_id is read from booking_agent_config (single source, same as the read
// path). The Artists tab gid is stable (1165689834). The Artist-Fit column is
// resolved from the header row so a column reorder doesn't mis-write; falls back
// to column P (the current position) if the header can't be found.
//
// Auth mirrors append-practice-session-row (P318): requireOperator gate + the
// google_calendar_tokens OAuth row whose scope includes `spreadsheets`, with the
// shared ensureFreshToken/refreshToken pattern and a one-shot 401 retry.

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

// The JJMM "Artists — bands for show swaps / support slots" tab (stable gid).
const BANDS_TAB_GID = 1165689834;
// Fallback column for "Artist Fit" if the header row can't be resolved.
const ARTIST_FIT_FALLBACK_COL = "P";
const ARTIST_FIT_HEADER = "artist fit";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// 0 → "A", 25 → "Z", 26 → "AA".
function indexToColLetter(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
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

// Resolve the tab title for BANDS_TAB_GID (values.update needs the A1 tab name,
// not the gid). Resilient to a tab rename.
async function lookupTabTitle(accessToken: string, sheetId: string): Promise<string> {
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
  const tab = (body.sheets || []).find((s: any) => s.properties?.sheetId === BANDS_TAB_GID);
  if (!tab) throw new Error(`no sheet with gid=${BANDS_TAB_GID} found in spreadsheet`);
  return tab.properties.title as string;
}

// Find the "Artist Fit" column letter from the header row; fall back to P.
async function resolveFitColumn(accessToken: string, sheetId: string, tabName: string): Promise<string> {
  const range = `${tabName}!1:1`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return ARTIST_FIT_FALLBACK_COL;
  const body = await res.json();
  const headers: string[] = (body.values && body.values[0]) || [];
  const idx = headers.findIndex((h) => (h || "").trim().toLowerCase() === ARTIST_FIT_HEADER);
  return idx >= 0 ? indexToColLetter(idx) : ARTIST_FIT_FALLBACK_COL;
}

async function updateCell(
  accessToken: string,
  sheetId: string,
  range: string,
  value: string,
): Promise<Response> {
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
  );
  url.searchParams.set("valueInputOption", "USER_ENTERED");
  return await fetch(url.toString(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [[value]] }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return jsonResponse({ error: "Google OAuth not configured" }, 500);
  }

  try {
    const body = await req.json();
    const rowIndex = Number(body?.row_index);
    if (!Number.isInteger(rowIndex) || rowIndex < 2) {
      return jsonResponse({ error: "row_index (integer ≥ 2) required" }, 400);
    }
    // fit may be "" (clear). Reject non-string.
    const fit = typeof body?.fit === "string" ? body.fit : null;
    if (fit === null) return jsonResponse({ error: "fit (string) required" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: cfg } = await supabase
      .from("booking_agent_config")
      .select("sheet_id, enabled")
      .eq("id", "default")
      .maybeSingle();
    if (!cfg?.sheet_id) {
      return jsonResponse({ error: "booking_agent_config.sheet_id not set" }, 412);
    }
    const sheetId = cfg.sheet_id as string;

    // Pick the OAuth token row that can write Sheets (spreadsheets scope).
    const { data: tokenRows } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .order("created_at", { ascending: true });

    if (!tokenRows || tokenRows.length === 0) {
      return jsonResponse({
        error: "no_google_account_connected",
        message: "Connect a Google account on /team/dashboard first.",
      }, 412);
    }

    const tokenRow =
      tokenRows.find((r: any) => r.scope && /\bspreadsheets\b/.test(r.scope)) || null;
    if (!tokenRow) {
      return jsonResponse({
        error: "spreadsheets_scope_not_granted",
        message: "Spreadsheets scope not yet granted. Re-consent at /team/dashboard Google OAuth.",
      }, 412);
    }

    let accessToken = await ensureFreshToken(supabase, tokenRow);
    const tabName = await lookupTabTitle(accessToken, sheetId);
    const col = await resolveFitColumn(accessToken, sheetId, tabName);
    const range = `${tabName}!${col}${rowIndex}`;

    let res = await updateCell(accessToken, sheetId, range, fit);
    if (res.status === 401) {
      accessToken = await refreshToken(supabase, tokenRow);
      res = await updateCell(accessToken, sheetId, range, fit);
    }

    if (!res.ok) {
      const errText = await res.text();
      return jsonResponse({
        error: "sheets_api_error",
        status: res.status,
        detail: errText.slice(0, 500),
      }, res.status);
    }

    return jsonResponse({
      ok: true,
      range,
      fit,
      account_email: tokenRow.account_email,
      sheet_url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${BANDS_TAB_GID}`,
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
