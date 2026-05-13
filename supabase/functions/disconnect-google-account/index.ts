// disconnect-google-account — operator-gated DELETE of a google_calendar_tokens
// row by account_email. Replaces the frontend's direct
// `supabase.from("google_calendar_tokens").delete()` call (P319 closes the
// write-side gap from P308 F1).
//
// Body:    { account_email: string }
// Returns: { ok: true, deleted: number }
// Errors:
//   400 — missing account_email
//   401/403 — not an operator (see _shared/require-operator.ts)
//   500 — service-role delete failed

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

  const denial = await requireOperator(req);
  if (denial) return denial;

  try {
    const body = await req.json().catch(() => ({}));
    const accountEmail =
      typeof body?.account_email === "string" ? body.account_email.trim() : "";
    if (!accountEmail) return jsonResponse({ error: "account_email required" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error, count } = await supabase
      .from("google_calendar_tokens")
      .delete({ count: "exact" })
      .eq("account_email", accountEmail);
    if (error) {
      return jsonResponse(
        { error: "delete_failed", message: error.message },
        500,
      );
    }

    return jsonResponse({ ok: true, deleted: count ?? 0 });
  } catch (err) {
    console.error("disconnect-google-account error:", err);
    return jsonResponse(
      { error: "internal_error", message: (err as Error).message },
      500,
    );
  }
});
