// fan-broadcast — send a message to Josh's owned fan list (Josh 7/24).
// "message my list": compose → pick a segment → send. Email via Resend (live),
// SMS via Twilio (sends when TWILIO_* secrets are set; A2P 10DLC pending).
//
// Recipients come from OUR contacts table (tag 'fan'), optionally scoped to a
// release (tag 'fan:<slug>'). The audience is never held by a platform.
//
// Operator-gated. Modes: test (send only to a given address/number), or full
// send to the resolved segment.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "Joshua J Miller <onboarding@resend.dev>";
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM = Deno.env.get("TWILIO_FROM");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const db = createClient(SUPABASE_URL, SERVICE_KEY);
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:520px;white-space:pre-wrap">${body.replace(/</g, "&lt;")}</div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, text: body, html }),
  });
  return r.ok;
}

async function sendSms(to: string, body: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return false;
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
  });
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denial = await requireOperator(req);
  if (denial) return denial;

  let b: { channel?: string; segment?: string; subject?: string; body?: string; test_to?: string };
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const channel = b.channel === "sms" ? "sms" : "email";
  const segment = (b.segment || "all").trim();
  const subject = (b.subject || "").trim();
  const body = (b.body || "").trim();
  if (!body) return json({ error: "body required" }, 400);
  if (channel === "email" && !subject) return json({ error: "subject required for email" }, 400);

  // Provider readiness
  if (channel === "email" && !RESEND_API_KEY) return json({ error: "no_email_sender", message: "Resend key not set." }, 412);
  if (channel === "sms" && (!TWILIO_SID || !TWILIO_FROM)) return json({ error: "no_sms_sender", message: "Twilio not configured yet (needs SID/token/number + A2P registration)." }, 412);

  // Test send — one recipient, no segment loop, no log.
  if (b.test_to) {
    const ok = channel === "email" ? await sendEmail(b.test_to, subject, body) : await sendSms(b.test_to, body);
    return json({ ok, mode: "test", to: b.test_to });
  }

  // Resolve the segment from OUR contacts (owned list).
  const wantTag = segment === "all" ? "fan" : `fan:${segment}`;
  const col = channel === "email" ? "email" : "phone";
  const { data: rows, error } = await db
    .from("contacts")
    .select(`id, ${col}`)
    .contains("tags", [wantTag])
    .not(col, "is", null);
  if (error) return json({ error: "recipient_query_failed", detail: error.message }, 500);

  const recipients = [...new Set((rows || []).map((r: any) => (r[col] as string)?.trim()).filter(Boolean))];
  let sent = 0, failed = 0;
  for (const to of recipients) {
    const ok = channel === "email" ? await sendEmail(to, subject, body) : await sendSms(to, body);
    ok ? sent++ : failed++;
  }

  await db.from("fan_broadcasts").insert({
    channel, segment, subject: subject || null, body,
    recipients: recipients.length, sent, failed,
    status: failed === 0 ? "sent" : (sent === 0 ? "failed" : "partial"),
    created_by: "operator",
  });

  return json({ ok: sent > 0 || recipients.length === 0, recipients: recipients.length, sent, failed });
});
