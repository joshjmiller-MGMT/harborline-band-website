// Handles Google OAuth: initiate (?action=start) and callback (?code=...)
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

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  // P14 (2026-05-12): drive.file = write access to files created by the app.
  // Used by scripts/chart-library-drive-sync.mjs to push chart-library/output/
  // into a Harborline/chart-library/ folder under the connected Drive. Safer
  // than full `drive` scope — we can only touch files we created.
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function getRedirectUri(_req: Request): string {
  // Must match the URI registered in Google Cloud Console exactly
  return `${SUPABASE_URL}/functions/v1/google-calendar-oauth`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({
        error: "Google OAuth not configured. Add GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET secrets.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const code = url.searchParams.get("code");
  const stateReturn = url.searchParams.get("state"); // where to send user after auth
  const redirectUri = getRedirectUri(req);

  // 1) Start OAuth flow — return the URL (frontend opens it)
  if (action === "start") {
    const returnTo = url.searchParams.get("return_to") || "";
    const loginHint = url.searchParams.get("login_hint");
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", returnTo);
    if (loginHint) authUrl.searchParams.set("login_hint", loginHint);

    return new Response(
      JSON.stringify({ auth_url: authUrl.toString(), redirect_uri: redirectUri }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2) Callback — exchange code for tokens
  if (code) {
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(`Token exchange failed: ${JSON.stringify(tokens)}`);

      // Fetch user email
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userRes.json();

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Multi-account: remove only existing token rows for THIS email, then insert fresh.
      if (userInfo.email) {
        await supabase
          .from("google_calendar_tokens")
          .delete()
          .eq("account_email", userInfo.email);
      }
      const gmailScopeGranted = (tokens.scope || "").includes("gmail.readonly");
      const { error: insErr } = await supabase.from("google_calendar_tokens").insert({
        account_email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scope: tokens.scope,
        needs_reconnect: false,
        last_refresh_at: new Date().toISOString(),
        last_refresh_error: null,
        gmail_scope_granted: gmailScopeGranted,
      });
      if (insErr) throw insErr;

      // Return a self-closing popup page. The popup (a) posts a message to
      // its opener so the dashboard can refresh in place, then (b) closes
      // itself. Same-window fallback: if there's no opener, redirect to the
      // dashboard with ?google_connected=1 so the existing useEffect picks it
      // up. The visible "Connected ✓" copy is what users see for the brief
      // moment between the script firing and the window closing — or for the
      // longer moment if scripts are blocked, in which case the meta refresh
      // takes over.
      const FRONTEND_ORIGIN = Deno.env.get("FRONTEND_ORIGIN") || "https://harborlineband.com";
      const returnPath = stateReturn && stateReturn.startsWith("/") ? stateReturn : "/team/dashboard";
      const returnUrl = `${FRONTEND_ORIGIN}${returnPath}?google_connected=1`;
      const returnUrlJson = JSON.stringify(returnUrl);
      const accountEmail = (userInfo.email || "").replace(/[<>"&]/g, "");
      // Polished popup. Fires immediately on load:
      //   1. If we have an opener: postMessage to refresh the dashboard, then window.close()
      //   2. If close is blocked, fall through to redirect (50ms)
      //   3. If no opener: full-page redirect right away
      //   4. If JS is blocked entirely: meta-refresh fires at 2s
      // The page itself is on-brand dark + centered card so the brief flash before
      // close is intentional UX, not a raw-HTML blip.
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Connected · Harborline</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="2; url=${returnUrl}">
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; background: #0a0a0a; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #fafafa;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 24px;
    }
    .card {
      max-width: 380px; width: 100%;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 32px 28px;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4);
    }
    .ring {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: rgba(16,185,129,0.12);
      border: 1px solid rgba(16,185,129,0.35);
      margin: 0 auto 16px;
      display: flex; align-items: center; justify-content: center;
    }
    .ring svg { width: 28px; height: 28px; color: #10b981; }
    h1 {
      font-size: 18px; font-weight: 600; margin: 0 0 6px;
      letter-spacing: -0.01em;
    }
    .email {
      color: #a1a1aa; font-size: 13px; margin: 0 0 16px;
      word-break: break-all;
    }
    .hint { color: #71717a; font-size: 12px; margin: 0; }
    .hint a { color: #60a5fa; text-decoration: none; }
    .hint a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card" role="status" aria-live="polite">
    <div class="ring" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
    <h1>Connected</h1>
    ${accountEmail ? `<p class="email">${accountEmail}</p>` : ""}
    <p class="hint">Closing window… or <a href="${returnUrl}">return manually</a>.</p>
  </div>
  <script>
    (function () {
      var returnUrl = ${returnUrlJson};
      function go() { try { window.location.replace(returnUrl); } catch (_) {} }
      try {
        var hasOpener = window.opener && !window.opener.closed;
        if (hasOpener) {
          try { window.opener.postMessage({ type: "google_oauth_complete" }, "*"); } catch (_) {}
          window.close();
          // Closing a non-script-opened window can be blocked. Quick fallback to redirect.
          setTimeout(go, 50);
        } else {
          go();
        }
      } catch (_) { go(); }
    })();
  </script>
</body>
</html>`;
      return new Response(html, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(`<html><body><h1>OAuth error</h1><pre>${msg}</pre></body></html>`, {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Missing action or code" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
