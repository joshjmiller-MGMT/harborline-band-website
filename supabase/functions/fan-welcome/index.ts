// fan-welcome — sends the "thanks for signing up" welcome on a new fan signup
// (Josh 7/24). Personal, not sales-ey.
//
// WHO CALLS THIS (corrected 2026-08-05): the AFTER INSERT trigger
// trg_fan_welcome on fan_signups, via pg_net — see migration
// 20260724180000_fan_welcome.sql. Nothing else. The line that used to sit here,
// "the lander calls this best-effort right after a successful fan_signups
// insert", described an earlier design and was already wrong: SmartLink.tsx
// says so in as many words — "the welcome message fires server-side from an
// AFTER INSERT trigger (fan-welcome edge fn) — no client call needed, and it
// works even though anon can't read the row back."
//
// EMAIL: sent via Resend (RESEND_API_KEY). FROM = RESEND_FROM env, default
//   onboarding@resend.dev (Resend's test sender — only delivers to the account
//   owner until you verify a domain; verify gethip.to/harborlineband for
//   production). No key set → status 'no_sender', nothing lost.
// SMS: not wired yet — Twilio + A2P 10DLC registration is a multi-day
//   compliance setup. Returns 'sms_pending' so those signups are queued.
//
// verify_jwt=false, pinned in supabase/config.toml. The trigger does present an
// anon JWT today, but the function is meant to be reachable without one and a
// deploy must not quietly change that — see the config.toml note about the
// posting-times cron outage. It only ever sends the fixed welcome to the
// address the fan just gave, and marks fan_signups — no data exposure, no
// arbitrary send.
//
// CORS: DELIBERATELY LEFT ON "*" in wave 3, 2026-08-05. This is the one
// function of the nine that was not converted, and the reason is that its
// caller list above contains no browser. CORS is a browser policy; pg_net
// sends no Origin, so an allowlist here would never be consulted by anything.
// The conversion would be a pure no-op bought with a deploy — and on this
// project a deploy is not free: the 2026-08-02 posting-times deploy silently
// flipped verify_jwt and killed a daily cron for three days. Zero benefit is
// not worth a nonzero risk. If a browser ever calls this function, convert it
// then: import corsHeadersFor from ../_shared/allowed-origins.ts and build the
// headers per request, exactly as the other 56 do.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Joshua J Miller <onboarding@resend.dev>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const db = createClient(SUPABASE_URL, SERVICE_KEY);

const SUBJECT = "You're in — thank you";
const BODY_TEXT = `Hey — thanks for signing up. It genuinely means a lot.

I'll only ever reach out about real things I've got going on: new music, shows, the occasional early thing before it's public. Stuff I'm actually excited to share. Nothing else, ever.

I don't share or sell your info. You're here because you chose to be, and I'll keep it worth it.

— Josh (Joshua J Miller)`;

const BODY_HTML = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:480px">
<p>Hey — thanks for signing up. It genuinely means a lot.</p>
<p>I'll only ever reach out about real things I've got going on: new music, shows, the occasional early thing before it's public. Stuff I'm actually excited to share. Nothing else, ever.</p>
<p style="color:#666">I don't share or sell your info. You're here because you chose to be, and I'll keep it worth it.</p>
<p>— Josh <span style="color:#888">(Joshua J Miller)</span></p>
</div>`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function sendEmail(to: string): Promise<{ ok: boolean; detail?: string }> {
  if (!RESEND_API_KEY) return { ok: false, detail: "no_key" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject: SUBJECT, text: BODY_TEXT, html: BODY_HTML }),
  });
  if (res.ok) return { ok: true };
  return { ok: false, detail: (await res.text()).slice(0, 300) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let body: { fan_signup_id?: string; contact_type?: string; contact_value?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  // Resolve the target — prefer a fan_signup row so we can mark it welcomed.
  let signupId = body.fan_signup_id ?? null;
  let type = body.contact_type ?? null;
  let value = body.contact_value ?? null;
  if (signupId && (!type || !value)) {
    const { data } = await db.from("fan_signups").select("contact_type, contact_value, welcomed_at").eq("id", signupId).single();
    if (data) {
      if (data.welcomed_at) return json({ ok: true, status: "already_welcomed" });
      type = data.contact_type; value = data.contact_value;
    }
  }
  if (!type || !value) return json({ error: "no target" }, 400);

  let status: string;
  if (type === "email") {
    const r = await sendEmail(value);
    status = r.ok ? "sent" : (r.detail === "no_key" ? "no_sender" : "failed");
    if (status === "failed") console.error("resend failed:", r.detail);
  } else {
    // SMS not wired (Twilio + A2P 10DLC pending) — queue it.
    status = "sms_pending";
  }

  if (signupId) {
    await db.from("fan_signups").update({
      welcome_status: status,
      welcomed_at: status === "sent" ? new Date().toISOString() : null,
    }).eq("id", signupId);
  }

  return json({ ok: status === "sent", status });
});
