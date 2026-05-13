// manage-monday-source — operator-gated CRUD for monday_calendar_sources.
// Replaces direct frontend INSERT / UPDATE / DELETE calls. Pairs with the
// P319 migration that drops anon write policies on monday_calendar_sources.
//
// Body shape:
//   { action: "create", payload: <full row sans id> }
//   { action: "update", id: string, patch: Partial<row> }
//   { action: "delete", id: string }
//
// Returns: { ok: true, row?: <inserted/updated row>, deleted?: number }
// Errors:
//   400 — bad shape
//   401/403 — not an operator
//   500 — service-role op failed

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
    const action = body?.action as string | undefined;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (action === "create") {
      const payload = body?.payload;
      if (!payload || typeof payload !== "object")
        return jsonResponse({ error: "payload required" }, 400);
      const { data, error } = await supabase
        .from("monday_calendar_sources")
        .insert(payload)
        .select()
        .single();
      if (error)
        return jsonResponse({ error: "insert_failed", message: error.message }, 500);
      return jsonResponse({ ok: true, row: data });
    }

    if (action === "update") {
      const id = typeof body?.id === "string" ? body.id : "";
      const patch = body?.patch;
      if (!id) return jsonResponse({ error: "id required" }, 400);
      if (!patch || typeof patch !== "object")
        return jsonResponse({ error: "patch required" }, 400);
      const { data, error } = await supabase
        .from("monday_calendar_sources")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error)
        return jsonResponse({ error: "update_failed", message: error.message }, 500);
      return jsonResponse({ ok: true, row: data });
    }

    if (action === "delete") {
      const id = typeof body?.id === "string" ? body.id : "";
      if (!id) return jsonResponse({ error: "id required" }, 400);
      const { error, count } = await supabase
        .from("monday_calendar_sources")
        .delete({ count: "exact" })
        .eq("id", id);
      if (error)
        return jsonResponse({ error: "delete_failed", message: error.message }, 500);
      return jsonResponse({ ok: true, deleted: count ?? 0 });
    }

    return jsonResponse({ error: "unknown action" }, 400);
  } catch (err) {
    console.error("manage-monday-source error:", err);
    return jsonResponse(
      { error: "internal_error", message: (err as Error).message },
      500,
    );
  }
});
