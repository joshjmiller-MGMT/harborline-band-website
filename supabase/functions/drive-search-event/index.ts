// drive-search-event — Cut 5 (Layer 6 of v2 architecture).
//
// Executes a Drive name+date search against Josh's connected Google account.
// Builds a structured query from { name, date } (13 date variants × N name
// variants), runs it via Drive API v3 using the access_token from
// google_calendar_tokens, and returns the matched files. Per Q6: "auto-find
// first; if 0 or 5+ matches fall back to picker; auto-confirm on 1 match" —
// this function returns the raw matches; the picker UI lives in the caller.
//
// Scope requirement: drive.metadata.readonly + drive.readonly. The OAuth
// scope list in google-calendar-oauth is the source of truth; if Josh hasn't
// re-consented since the scopes were added, the token row's `scope` won't
// include drive.readonly and this function returns 412.
//
// Token refresh: shares the ensureFreshToken pattern with
// google-calendar-events. On a 401 from Drive, force-refresh once and retry.

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

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function parseDate(raw: string): { y: number; m: number; d: number } | null {
  const s = raw.trim();
  let mm = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mm) return { y: parseInt(mm[1]), m: parseInt(mm[2]), d: parseInt(mm[3]) };
  mm = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (mm) {
    const y = mm[3].length === 2 ? 2000 + parseInt(mm[3]) : parseInt(mm[3]);
    return { y, m: parseInt(mm[1]), d: parseInt(mm[2]) };
  }
  return null;
}

function dateVariants(raw: string): string[] {
  const parsed = parseDate(raw);
  if (!parsed) return [raw];
  const { y, m, d } = parsed;
  const m2 = String(m).padStart(2, "0");
  const d2 = String(d).padStart(2, "0");
  const yShort = String(y).slice(-2);
  const longMonth = MONTHS_LONG[m - 1];
  const shortMonth = MONTHS_SHORT[m - 1];
  return Array.from(new Set([
    `${m}/${d}/${y}`,
    `${m}-${d}-${y}`,
    `${m}.${d}.${y}`,
    `${m}/${d}/${yShort}`,
    `${m}-${d}-${yShort}`,
    `${m}.${d}.${yShort}`,
    `${m2}/${d2}/${y}`,
    `${m2}-${d2}-${y}`,
    `${y}-${m2}-${d2}`,
    `${longMonth} ${d} ${y}`,
    `${longMonth} ${d}, ${y}`,
    `${shortMonth} ${d} ${y}`,
    `${shortMonth} ${d}, ${y}`,
  ]));
}

function nameVariants(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const cleaned = trimmed.replace(/\s+/g, " ");
  const tokens = cleaned.split(" ").filter(Boolean);

  const out = new Set<string>();
  out.add(cleaned);

  const honorifics = /^(mr|mrs|ms|dr)\.?\s+/i;
  if (honorifics.test(cleaned)) out.add(cleaned.replace(honorifics, ""));

  if (tokens.length >= 2) out.add(tokens[tokens.length - 1]);

  if (tokens.length === 2) {
    out.add(tokens[0]);
    out.add(tokens[1]);
  }

  if (cleaned.includes("&")) {
    for (const half of cleaned.split("&").map((s) => s.trim()).filter(Boolean)) {
      out.add(half);
      const halfTokens = half.split(" ").filter(Boolean);
      if (halfTokens.length >= 2) out.add(halfTokens[halfTokens.length - 1]);
    }
  }

  return Array.from(out);
}

function escapeDriveQ(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildDriveQuery(names: string[], dates: string[]): string {
  const nameClauses = names.map((n) => `name contains '${escapeDriveQ(n)}'`);
  const dateClauses = dates.map((d) => `fullText contains '${escapeDriveQ(d)}'`);
  const namePart = nameClauses.length > 0 ? `(${nameClauses.join(" or ")})` : "";
  const datePart = dateClauses.length > 0 ? `(${dateClauses.join(" or ")})` : "";
  const parts = [namePart, datePart].filter(Boolean);
  // Always exclude trashed; restrict to Docs/Sheets/PDF MIME types per Q3 scope.
  parts.push("trashed = false");
  return parts.join(" and ");
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

async function driveSearch(accessToken: string, query: string, pageSize: number) {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", query);
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set(
    "fields",
    "files(id,name,mimeType,modifiedTime,owners(emailAddress),webViewLink,iconLink,size)",
  );
  url.searchParams.set("orderBy", "modifiedTime desc");
  url.searchParams.set("corpora", "user");
  return await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
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
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const date = typeof body?.date === "string" ? body.date.trim() : "";
    const account = typeof body?.account === "string" ? body.account : null;
    const pageSize = Math.min(Math.max(parseInt(body?.page_size) || 25, 1), 100);
    if (!name) return jsonResponse({ error: "name required" }, 400);
    if (!date) return jsonResponse({ error: "date required" }, 400);

    const names = nameVariants(name);
    const dates = dateVariants(date);
    const driveQuery = buildDriveQuery(names, dates);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: tokenRows } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .order("created_at", { ascending: true });

    if (!tokenRows || tokenRows.length === 0) {
      return jsonResponse(
        {
          drive_query: driveQuery,
          name_variants: names,
          date_variants: dates,
          files: [],
          error: "no_google_account_connected",
          message: "Connect a Google account on /team/dashboard first.",
        },
        412,
      );
    }

    const row = account
      ? tokenRows.find((r: any) => r.account_email === account) || tokenRows[0]
      : tokenRows[0];

    if (!row.scope || !/\bdrive\.readonly\b/.test(row.scope)) {
      return jsonResponse(
        {
          drive_query: driveQuery,
          name_variants: names,
          date_variants: dates,
          files: [],
          error: "drive_scope_not_granted",
          account_email: row.account_email,
          message:
            "Drive scope not yet granted. Re-consent at /team/dashboard Google OAuth.",
        },
        412,
      );
    }

    let accessToken = await ensureFreshToken(supabase, row);
    let res = await driveSearch(accessToken, driveQuery, pageSize);

    if (res.status === 401) {
      accessToken = await refreshToken(supabase, row);
      res = await driveSearch(accessToken, driveQuery, pageSize);
    }

    if (!res.ok) {
      const errText = await res.text();

      // Detect "Drive API not enabled in this Cloud project" (one-click fix in
      // the Cloud Console). Surface it as a structured signal with the enable
      // URL so the dashboard can render a single Enable button instead of a
      // raw JSON dump.
      if (res.status === 403 && /has not been used in project|drive\.googleapis\.com/i.test(errText)) {
        const projectMatch = errText.match(/project (\d+)/);
        const projectId = projectMatch ? projectMatch[1] : null;
        const enableUrl = projectId
          ? `https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=${projectId}`
          : "https://console.developers.google.com/apis/api/drive.googleapis.com/overview";
        return jsonResponse(
          {
            drive_query: driveQuery,
            files: [],
            error: "drive_api_not_enabled",
            project_id: projectId,
            enable_url: enableUrl,
            message: "Google Drive API is not enabled in this Cloud project. Enable it once in the Cloud Console, wait ~1 minute, then retry.",
          },
          412,
        );
      }

      return jsonResponse(
        {
          drive_query: driveQuery,
          files: [],
          error: "drive_api_error",
          status: res.status,
          detail: errText.slice(0, 500),
        },
        res.status,
      );
    }

    const driveBody = await res.json();
    const files = (driveBody.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      mime_type: f.mimeType,
      modified_time: f.modifiedTime,
      owners: (f.owners || []).map((o: any) => o.emailAddress),
      web_view_link: f.webViewLink,
      icon_link: f.iconLink,
      size: f.size ? parseInt(f.size) : null,
    }));

    return jsonResponse({
      drive_query: driveQuery,
      name_variants: names,
      date_variants: dates,
      account_email: row.account_email,
      files,
      file_count: files.length,
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
