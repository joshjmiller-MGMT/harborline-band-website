// venue-tracker-writeback — board→sheet edits for /team/venues.
//
// Josh 7/21: "i can't change the status, the whole page seems like a
// snapshot. i should be able to change statuses, change everything, and it
// should work two ways back and forth with the sheet." Reads already flow
// sheet→board live (booking-agent-rows, 5-min auto-refresh); this fn is the
// board→sheet direction. Last-writer-wins per spec — but never wrong-row.
//
// SAFETY — verify-then-write. booking-agent-rows derives rowIndex from a CSV
// export that DROPS fully-empty rows, so a blank row in the middle of the tab
// makes every rowIndex below it drift. This fn re-reads the tab via the authed
// Sheets API (true row numbers, empty rows included) and:
//   1. writes at row_index only if that row's name cell matches venue_name;
//   2. else finds the UNIQUE row whose name cell matches and writes there
//      (returns corrected_row_index);
//   3. else refuses with 409 row_anchor_mismatch — refresh and retry.
//
// Input: {
//   row_index: number,          // sheet row anchor shown in the modal
//   venue_name: string,         // expected name-cell value at that row
//   name_header: string,        // the actual header of the name column
//   updates: { [header]: value } // changed fields only, keyed by real headers
// }
//
// Auth: operator-gated (UI path only). Token = google_calendar_tokens row
// with the spreadsheets scope (append-practice-session-row pattern).

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

// 0-based column index → sheet letter (0 → A, 26 → AA).
function colIndexToLetter(i: number): string {
  let n = i + 1, s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const norm = (s: string) => (s || "").trim().toLowerCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return jsonResponse({ error: "Google OAuth not configured" }, 500);
  }

  try {
    const body = await req.json();
    const rowIndex = typeof body?.row_index === "number" ? body.row_index : 0;
    const venueName = typeof body?.venue_name === "string" ? body.venue_name.trim() : "";
    const nameHeader = typeof body?.name_header === "string" ? body.name_header : "";
    const updates = (body?.updates && typeof body.updates === "object") ? body.updates as Record<string, string> : {};
    if (rowIndex < 2) return jsonResponse({ error: "row_index must be >= 2 (row 1 is headers)" }, 400);
    if (Object.keys(updates).length === 0) return jsonResponse({ error: "no updates provided" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: cfg } = await supabase
      .from("booking_agent_config")
      .select("sheet_id, venue_tab_gid")
      .eq("id", "default")
      .maybeSingle();
    if (!cfg?.sheet_id) return jsonResponse({ error: "booking_agent_config not set" }, 412);
    const gid = parseInt(cfg.venue_tab_gid || "", 10);
    if (isNaN(gid)) return jsonResponse({ error: "venue_tab_gid not set — open /team/venues once to auto-detect" }, 412);

    // ── token (spreadsheets scope) ────────────────────────────────────
    const { data: tokenRows } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .order("created_at", { ascending: true });
    const tokenRow = (tokenRows || []).find(
      (r: any) => r.scope && /\bspreadsheets\b/.test(r.scope),
    );
    if (!tokenRow) {
      return jsonResponse({
        error: "spreadsheets_scope_not_granted",
        message: "No connected Google account has the spreadsheets scope. Re-consent at /team/dashboard.",
      }, 412);
    }
    let accessToken = await ensureFreshToken(supabase, tokenRow);

    // ── resolve tab title by gid ──────────────────────────────────────
    const metaFetch = async (tok: string) => {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cfg.sheet_id}?fields=sheets(properties(sheetId,title))`,
        { headers: { Authorization: `Bearer ${tok}` } },
      );
      if (!res.ok) throw new Error(`metadata fetch failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
      return res.json();
    };
    let meta;
    try {
      meta = await metaFetch(accessToken);
    } catch (_e) {
      accessToken = await refreshToken(supabase, tokenRow);
      meta = await metaFetch(accessToken);
    }
    const tab = (meta.sheets || []).find((s: any) => s.properties?.sheetId === gid);
    if (!tab) return jsonResponse({ error: `no tab with gid=${gid}` }, 404);
    const tabName = tab.properties.title as string;

    // ── authed full read: true row numbers, empty rows preserved ──────
    const readRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cfg.sheet_id}/values/${encodeURIComponent(tabName)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!readRes.ok) throw new Error(`tab read failed: ${readRes.status} ${(await readRes.text()).slice(0, 200)}`);
    const values: string[][] = (await readRes.json()).values || [];
    if (values.length < 1) return jsonResponse({ error: "tab is empty" }, 409);
    const headers = values[0];

    const nameColIdx = headers.findIndex((h) => norm(h) === norm(nameHeader));
    if (nameColIdx < 0) return jsonResponse({ error: `name_header "${nameHeader}" not found on sheet` }, 409);

    // ── locate the row: anchor first, unique-name fallback ────────────
    const nameAt = (r: number) => norm((values[r - 1] || [])[nameColIdx] || "");
    let targetRow = 0;
    let corrected = false;
    if (rowIndex <= values.length && venueName && nameAt(rowIndex) === norm(venueName)) {
      targetRow = rowIndex;
    } else if (venueName) {
      const matches: number[] = [];
      for (let r = 2; r <= values.length; r++) {
        if (nameAt(r) === norm(venueName)) matches.push(r);
      }
      if (matches.length === 1) { targetRow = matches[0]; corrected = true; }
      else {
        return jsonResponse({
          error: "row_anchor_mismatch",
          message: `Row ${rowIndex} no longer holds "${venueName}" and ${matches.length} rows match that name. Refresh the page and retry.`,
        }, 409);
      }
    } else {
      return jsonResponse({ error: "venue_name required for row verification" }, 400);
    }

    // ── build batch update: header-keyed → cell ranges ────────────────
    const data: { range: string; values: string[][] }[] = [];
    const unknownHeaders: string[] = [];
    for (const [key, value] of Object.entries(updates)) {
      const idx = headers.findIndex((h) => norm(h) === norm(key));
      if (idx < 0) { unknownHeaders.push(key); continue; }
      data.push({
        range: `${tabName}!${colIndexToLetter(idx)}${targetRow}`,
        values: [[String(value ?? "")]],
      });
    }
    if (data.length === 0) {
      return jsonResponse({ error: "no updates matched sheet headers", unknown_headers: unknownHeaders }, 409);
    }

    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cfg.sheet_id}/values:batchUpdate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
      },
    );
    if (!writeRes.ok) {
      return jsonResponse({
        error: "sheets_write_failed",
        status: writeRes.status,
        detail: (await writeRes.text()).slice(0, 400),
      }, writeRes.status);
    }
    const writeBody = await writeRes.json();

    return jsonResponse({
      ok: true,
      tab: tabName,
      row: targetRow,
      corrected_row_index: corrected ? targetRow : undefined,
      updated_cells: writeBody.totalUpdatedCells ?? data.length,
      unknown_headers: unknownHeaders.length ? unknownHeaders : undefined,
      account_email: tokenRow.account_email,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: "unhandled", detail: msg }, 500);
  }
});
