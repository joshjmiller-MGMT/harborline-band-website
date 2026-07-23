// jjmm-contacts-sync — two-way sync between /team/contacts and the JJMM
// Contact Spreadsheet's network tab (gid=554277039).
//
// Josh's doctrine (2026-07-21, re-affirmed with screenshot): "im gonna keep
// dumping contacts in the website, need to link with this contacts list here
// in the JJMM spreadsheet. remember that spreadsheet is a network source,
// two ways." The tab is RSVP-format lineage (Name / Address / Phone / Email /
// RSVP status / Notes / Column 1) repurposed as his working contact dump;
// "josh to reach out" in Notes is his follow-up flag.
//
// Sync contract (v1, deliberately conservative):
//   PULL  — sheet rows absent from contacts (name-matched, normalized) are
//           inserted with source='jjmm-sheet', sheet_synced=true; Notes
//           containing "reach out" set the followup flag. Name-matched rows
//           fill EMPTY db fields (phone/email/notes) only — the sheet never
//           overwrites non-empty db data.
//   PUSH  — person-rows (not tagged task-not-contact) absent from the sheet
//           are batch-appended: [Name, "", Phone, Email, "", context,
//           "from /team/contacts"]. Append-only: existing sheet cells are
//           never edited, so Josh's manual sheet state is always safe.
//   Marker rows (e.g. `STOPPED AT "M" - josh`) and empty names are skipped.
//   Idempotent — rerunning matches everything and writes nothing new.
//
// Auth: same google_calendar_tokens + spreadsheets-scope pattern as
// append-practice-session-row (token refresh shared verbatim). Callable by
// the operator (Sync button) and by pg_cron via the service-role JWT.

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

// Sheet id is public knowledge inside this codebase (TeamContacts.tsx links
// it); the gid is the tab Josh screenshotted 2026-07-21.
const JJMM_SHEET_ID = "1ljSJ-58WqTJP0zK9RiNAtsEG3BYW-L0Mpb1PgGi7b4g";
const CONTACT_TAB_GID = 554277039;

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

async function lookupTabTitle(accessToken: string): Promise<string> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${JJMM_SHEET_ID}?fields=sheets(properties(sheetId,title))`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`sheets metadata fetch failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const body = await res.json();
  const tab = (body.sheets || []).find(
    (s: any) => s.properties?.sheetId === CONTACT_TAB_GID,
  );
  if (!tab) throw new Error(`no tab with gid=${CONTACT_TAB_GID} in JJMM sheet`);
  return tab.properties.title as string;
}

async function readTab(accessToken: string, tabName: string): Promise<string[][]> {
  const range = `${tabName}!A:G`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${JJMM_SHEET_ID}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`sheets read failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const body = await res.json();
  return (body.values || []) as string[][];
}

async function appendRows(
  accessToken: string,
  tabName: string,
  rows: string[][],
): Promise<void> {
  if (rows.length === 0) return;
  const range = `${tabName}!A:G`;
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${JJMM_SHEET_ID}/values/${encodeURIComponent(range)}:append`,
  );
  url.searchParams.set("valueInputOption", "USER_ENTERED");
  url.searchParams.set("insertDataOption", "INSERT_ROWS");
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: rows }),
  });
  if (!res.ok) {
    throw new Error(`sheets append failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}

const normName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

// Rows that are Josh's progress markers, not people.
const isMarkerRow = (name: string) => /^stopped at\b/i.test(name.trim());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Cron path: pg_cron calls with the anon bearer (passes verify_jwt) + an
  // x-cron-secret header checked against cron_secrets (the trigger_trello_route
  // pattern — there is no service-role JWT in this project's cron plumbing).
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret) {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await sb
      .from("cron_secrets")
      .select("secret")
      .eq("name", "jjmm_contacts_sync_cron_secret")
      .single();
    if (!data || data.secret !== cronSecret) {
      return jsonResponse({ error: "forbidden", reason: "bad_cron_secret" }, 403);
    }
  } else {
    const denial = await requireOperator(req);
    if (denial) return denial;
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return jsonResponse({ error: "Google OAuth not configured" }, 500);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    let tabName: string;
    try {
      tabName = await lookupTabTitle(accessToken);
    } catch (e) {
      // one forced refresh, mirrors the practice fn's 401 retry
      accessToken = await refreshToken(supabase, tokenRow);
      tabName = await lookupTabTitle(accessToken);
    }

    // ── read sheet ────────────────────────────────────────────────────
    const values = await readTab(accessToken, tabName);
    if (values.length === 0) throw new Error("tab read returned no rows at all");
    const dataRows = values.slice(1); // row 1 = Name,Address,Phone,Email,RSVP status,Notes,Column 1

    type SheetRow = { name: string; phone: string; email: string; notes: string };
    const sheetRows: SheetRow[] = [];
    let skippedMarkers = 0;
    for (const r of dataRows) {
      const name = (r[0] || "").trim();
      if (!name) continue;
      if (isMarkerRow(name)) { skippedMarkers++; continue; }
      sheetRows.push({
        name,
        phone: (r[2] || "").trim(),
        email: (r[3] || "").trim(),
        notes: (r[5] || "").trim(),
      });
    }
    const sheetByName = new Map<string, SheetRow>();
    for (const s of sheetRows) {
      if (!sheetByName.has(normName(s.name))) sheetByName.set(normName(s.name), s);
    }

    // ── read db ───────────────────────────────────────────────────────
    const { data: dbRows, error: dbErr } = await supabase
      .from("contacts")
      .select("id, name, phone, email, role, org, notes, tags, followup_note, sheet_synced");
    if (dbErr) throw new Error(`contacts read failed: ${dbErr.message}`);
    const dbByName = new Map<string, any>();
    for (const c of dbRows || []) {
      if (c.name && !dbByName.has(normName(c.name))) dbByName.set(normName(c.name), c);
    }

    let pulled = 0, filled = 0, matched = 0, pushed = 0;

    // ── PULL: sheet → db ──────────────────────────────────────────────
    for (const [key, s] of sheetByName) {
      const existing = dbByName.get(key);
      if (!existing) {
        const followup = /reach out/i.test(s.notes);
        const { error } = await supabase.from("contacts").insert({
          name: s.name,
          phone: s.phone || null,
          email: s.email || null,
          notes: s.notes || null,
          followup,
          followup_note: followup ? s.notes : null,
          source: "jjmm-sheet",
          sheet_synced: true,
        });
        if (error) throw new Error(`insert failed for "${s.name}": ${error.message}`);
        pulled++;
      } else {
        matched++;
        const patch: Record<string, unknown> = {};
        if (!existing.phone && s.phone) patch.phone = s.phone;
        if (!existing.email && s.email) patch.email = s.email;
        if (!existing.notes && s.notes) patch.notes = s.notes;
        if (!existing.sheet_synced) patch.sheet_synced = true;
        if (Object.keys(patch).length > 0) {
          patch.updated_at = new Date().toISOString();
          const { error } = await supabase.from("contacts").update(patch).eq("id", existing.id);
          if (error) throw new Error(`fill failed for "${existing.name}": ${error.message}`);
          if (patch.phone || patch.email || patch.notes) filled++;
        }
      }
    }

    // ── PUSH: db → sheet (append-only) ────────────────────────────────
    const toPush = (dbRows || []).filter((c: any) =>
      c.name &&
      !(c.tags || []).includes("task-not-contact") &&
      !sheetByName.has(normName(c.name)),
    );
    const appendValues = toPush.map((c: any) => {
      const context = [c.role, c.org, c.followup_note || c.notes]
        .filter(Boolean).join(" — ").slice(0, 160);
      return [c.name, "", c.phone || "", c.email || "", "", context, "from /team/contacts"];
    });
    await appendRows(accessToken, tabName, appendValues);
    if (toPush.length > 0) {
      const { error } = await supabase
        .from("contacts")
        .update({ sheet_synced: true, updated_at: new Date().toISOString() })
        .in("id", toPush.map((c: any) => c.id));
      if (error) throw new Error(`sheet_synced flag update failed: ${error.message}`);
      pushed = toPush.length;
    }

    return jsonResponse({
      ok: true,
      tab: tabName,
      sheet_rows: sheetRows.length,
      db_contacts: (dbRows || []).length,
      pulled, filled, matched, pushed,
      skipped_markers: skippedMarkers,
      account_email: tokenRow.account_email,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: "unhandled", detail: msg }, 500);
  }
});
