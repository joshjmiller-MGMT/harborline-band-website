// refresh-google-token — server-side OAuth refresh helper.
//
// Why this exists: local sync scripts (e.g. scripts/chart-library-drive-sync.mjs)
// can't refresh access_tokens directly because the GOOGLE_CALENDAR_CLIENT_ID /
// GOOGLE_CALENDAR_CLIENT_SECRET values live in Supabase's Vault — what the
// dashboard surfaces isn't the literal secret Google's token endpoint accepts.
// This edge function holds the canonical refresh logic (using the real secrets
// from edge-function env), so any local caller can invoke it via service-role
// JWT and get a fresh token back without ever touching Google directly.
//
// Body: { account_email: string }
// Returns: { access_token, expires_at, scope, account_email }
// Errors:
//   400 — missing account_email
//   404 — no token row for that account
//   412 — needs_reconnect (refresh_token revoked or invalid)
//   500 — refresh upstream error
//
// Auth: verify_jwt=true. Callers send the SUPABASE_SERVICE_ROLE_KEY (or any
// authenticated JWT — RLS isn't gating this; the secret-handling is the gate).

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET)
    return jsonResponse({ error: "google_oauth_not_configured" }, 500);

  try {
    const body = await req.json().catch(() => ({}));
    const accountEmail =
      typeof body?.account_email === "string" ? body.account_email.trim() : "";
    if (!accountEmail) return jsonResponse({ error: "account_email required" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: rows, error: selErr } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .eq("account_email", accountEmail);
    if (selErr) throw selErr;
    const row = rows && rows[0];
    if (!row)
      return jsonResponse(
        { error: "token_not_found", account_email: accountEmail },
        404,
      );

    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
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
      return jsonResponse(
        {
          error: "refresh_failed",
          account_email: accountEmail,
          detail: refreshed,
          hint:
            "If error is invalid_grant the refresh_token was revoked — Josh needs to reconnect via /team/dashboard.",
        },
        412,
      );
    }

    const newExpires = new Date(
      Date.now() + refreshed.expires_in * 1000,
    ).toISOString();
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

    return jsonResponse({
      access_token: refreshed.access_token,
      expires_at: newExpires,
      scope: row.scope,
      account_email: accountEmail,
    });
  } catch (err) {
    console.error("refresh-google-token error:", err);
    return jsonResponse(
      { error: "internal_error", message: (err as Error).message },
      500,
    );
  }
});
