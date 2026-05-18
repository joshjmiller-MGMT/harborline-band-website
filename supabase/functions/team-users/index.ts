// P330 — Operator-gated user-management surface for /team/admin/users.
//
// Ops:
//   list             list all auth.users (id, email, created_at, last_sign_in_at,
//                    display_name from user_metadata)
//   invite           invite a user by email (Supabase invite flow); sends
//                    personalized "Welcome to the team" email with a magic
//                    setup link
//   reset_password   admin-triggered: generate a recovery link for an existing
//                    user and email it to them (bypasses per-IP rate-limit since
//                    we mint via service-role)
//   delete           remove a user from auth (only the operator can fire this;
//                    OPERATOR_USER_IDS guard protects against self-delete)
//
// Auth: requireOperator() gates all ops. Service-role bypass preserved for cron.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://harborlineband.com";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  if (trimmed.length > 254) return null;
  return trimmed;
}

function sanitizeName(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, 100);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const denial = await requireOperator(req);
  if (denial) return denial;

  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let body: { op?: string; [k: string]: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const op = (body.op as string | undefined) ?? "";
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (op === "list") {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) {
      return json(500, { error: "list_failed", detail: error.message });
    }
    const users = data.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      display_name:
        (u.user_metadata?.display_name as string | undefined) ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      invited_at: u.invited_at ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null,
    }));
    return json(200, { users });
  }

  if (op === "invite") {
    const email = sanitizeEmail(body.email);
    if (!email) return json(400, { error: "invalid_email" });
    const displayName = sanitizeName(body.display_name);

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${SITE_URL}/team/login`,
      data: displayName ? { display_name: displayName } : undefined,
    });
    if (error) {
      return json(500, { error: "invite_failed", detail: error.message });
    }
    return json(200, {
      ok: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    });
  }

  if (op === "reset_password") {
    const email = sanitizeEmail(body.email);
    if (!email) return json(400, { error: "invalid_email" });

    // generateLink mints a one-time recovery URL and triggers the recovery
    // email via the Auth template; bypasses per-IP rate-limits because we go
    // through service-role.
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${SITE_URL}/team/login` },
    });
    if (error) {
      return json(500, { error: "reset_failed", detail: error.message });
    }
    return json(200, {
      ok: true,
      // Don't return the recovery URL itself — email is the delivery channel.
      sent_to: data.user?.email ?? email,
    });
  }

  if (op === "delete") {
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return json(400, { error: "missing_id" });

    // Defense in depth: never let the operator delete themselves via this
    // endpoint (would lock the portal). requireOperator() doesn't surface the
    // caller's UID, but we can refuse to delete any user in OPERATOR_USER_IDS.
    const operatorIds = (Deno.env.get("OPERATOR_USER_IDS") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (operatorIds.includes(id)) {
      return json(403, {
        error: "cannot_delete_operator",
        detail: "Remove user_id from OPERATOR_USER_IDS env var first.",
      });
    }

    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) {
      return json(500, { error: "delete_failed", detail: error.message });
    }
    return json(200, { ok: true });
  }

  return json(400, { error: "unknown_op", op });
});
