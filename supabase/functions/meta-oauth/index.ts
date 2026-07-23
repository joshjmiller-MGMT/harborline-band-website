// meta-oauth — Instagram Business Login for the DM-ingest pipeline.
//
// Three actions on one endpoint (verify_jwt=false — browser redirects and
// Meta callbacks can't carry Supabase JWTs; each path has its own guard):
//   ?action=start    → 302 to instagram.com/oauth/authorize (state = HMAC-
//                      signed timestamp with the app secret, 15-min window).
//   ?code=…&state=…  → the redirect back: verify state → exchange code →
//                      long-lived token (60d) → store meta_tokens → subscribe
//                      the account to message webhooks → 302 /team/social.
//   ?action=refresh  → cron-only (x-cron-secret): refresh tokens expiring
//                      within 10 days (ig_refresh_token grant).
//
// Client id: cron_secrets ig_app_id if present (Instagram Login apps carry
// their own "Instagram App ID" distinct from the Meta app id), else
// meta_app_id. Same for secrets.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FN_URL = "https://mbqyznttpvebahgygsbx.supabase.co/functions/v1/meta-oauth";
const DONE_URL = "https://harborlineband.com/team/social";
const SCOPES = "instagram_business_basic,instagram_business_manage_messages";

const db = createClient(SUPABASE_URL, SERVICE_KEY);

async function secret(name: string): Promise<string | null> {
  const { data } = await db.from("cron_secrets").select("secret").eq("name", name).single();
  return data?.secret ?? null;
}

async function hmacHex(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { Location: to } });
}
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}

async function creds() {
  const appId = (await secret("ig_app_id")) ?? (await secret("meta_app_id"));
  const appSecret = (await secret("ig_app_secret")) ?? (await secret("meta_app_secret"));
  if (!appId || !appSecret) throw new Error("meta app credentials not in cron_secrets");
  return { appId, appSecret };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // ── start: send Josh to Instagram's consent screen ────────────────
    if (action === "start") {
      const { appId, appSecret } = await creds();
      const ts = Date.now().toString();
      const state = `${ts}.${await hmacHex(appSecret, ts)}`;
      const auth = new URL("https://www.instagram.com/oauth/authorize");
      auth.searchParams.set("client_id", appId);
      auth.searchParams.set("redirect_uri", FN_URL);
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("scope", SCOPES);
      auth.searchParams.set("state", state);
      return redirect(auth.toString());
    }

    // ── refresh: cron-guarded token refresh ───────────────────────────
    if (action === "refresh") {
      const expected = await secret("meta_refresh_cron_secret");
      if (!expected || req.headers.get("x-cron-secret") !== expected) {
        return jsonResponse({ error: "forbidden" }, 403);
      }
      const { data: tokens } = await db.from("meta_tokens").select("*")
        .lt("expires_at", new Date(Date.now() + 10 * 864e5).toISOString());
      const results: Record<string, string> = {};
      for (const t of tokens ?? []) {
        const r = await fetch(
          `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(t.access_token)}`,
        );
        const body = await r.json();
        if (r.ok && body.access_token) {
          await db.from("meta_tokens").update({
            access_token: body.access_token,
            expires_at: new Date(Date.now() + (body.expires_in ?? 5184000) * 1000).toISOString(),
            updated_at: new Date().toISOString(),
            last_error: null,
          }).eq("id", t.id);
          results[t.username ?? t.ig_user_id] = "refreshed";
        } else {
          await db.from("meta_tokens").update({
            last_error: JSON.stringify(body).slice(0, 400),
            updated_at: new Date().toISOString(),
          }).eq("id", t.id);
          results[t.username ?? t.ig_user_id] = `failed: ${r.status}`;
        }
      }
      return jsonResponse({ ok: true, results });
    }

    // ── callback: ?code=…&state=… ─────────────────────────────────────
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") || "";
    if (!code) return jsonResponse({ error: "missing code or action" }, 400);

    const { appId, appSecret } = await creds();
    const [ts, mac] = state.split(".");
    const macOk = ts && mac && mac === (await hmacHex(appSecret, ts));
    if (!macOk || Date.now() - Number(ts) > 15 * 60 * 1000) {
      return jsonResponse({ error: "bad or expired state" }, 403);
    }

    // code → short-lived token
    const form = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: FN_URL,
      code,
    });
    const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST", body: form,
    });
    const short = await shortRes.json();
    if (!shortRes.ok || !short.access_token) {
      return jsonResponse({ error: "code exchange failed", detail: short }, 502);
    }

    // short → long-lived (60 days)
    const longRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${encodeURIComponent(short.access_token)}`,
    );
    const long = await longRes.json();
    if (!longRes.ok || !long.access_token) {
      return jsonResponse({ error: "long-lived exchange failed", detail: long }, 502);
    }

    // who is this
    const meRes = await fetch(
      `https://graph.instagram.com/v23.0/me?fields=user_id,username&access_token=${encodeURIComponent(long.access_token)}`,
    );
    const me = await meRes.json();
    const igUserId = String(me.user_id ?? short.user_id ?? "");
    const username = me.username ?? null;

    await db.from("meta_tokens").upsert({
      provider: "instagram",
      ig_user_id: igUserId,
      username,
      access_token: long.access_token,
      expires_at: new Date(Date.now() + (long.expires_in ?? 5184000) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      last_error: null,
    }, { onConflict: "ig_user_id" });

    // subscribe this account's messages to the app's webhook
    const subRes = await fetch(
      `https://graph.instagram.com/v23.0/me/subscribed_apps?subscribed_fields=messages&access_token=${encodeURIComponent(long.access_token)}`,
      { method: "POST" },
    );
    const sub = await subRes.json().catch(() => ({}));

    return redirect(`${DONE_URL}?ig_connected=${encodeURIComponent(username ?? igUserId)}&subscribed=${subRes.ok ? "1" : "0"}&detail=${encodeURIComponent(JSON.stringify(sub).slice(0, 120))}`);
  } catch (err) {
    return jsonResponse({ error: "unhandled", detail: String(err) }, 500);
  }
});
