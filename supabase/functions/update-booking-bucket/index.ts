// P311 — Persist a single lead's bucket in the booking_pipeline_buckets
// overlay table. Operator-gated; the table is RLS-on with no anon policies.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_BUCKETS = new Set([
  "Reach Out",
  "Awaiting Reply",
  "In Convo",
  "Followup 2",
  "Confirmed",
  "Done",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { sheet_id?: string; row_index?: number; bucket?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sheetId = (body.sheet_id || "").trim();
  const rowIndex = typeof body.row_index === "number" ? body.row_index : NaN;
  const bucket = (body.bucket || "").trim();

  if (!sheetId || !Number.isInteger(rowIndex) || rowIndex < 2) {
    return new Response(JSON.stringify({ error: "invalid_sheet_id_or_row_index" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return new Response(
      JSON.stringify({ error: "invalid_bucket", detail: `bucket must be one of ${[...ALLOWED_BUCKETS].join(", ")}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase
    .from("booking_pipeline_buckets")
    .upsert(
      { sheet_id: sheetId, row_index: rowIndex, bucket, updated_at: new Date().toISOString() },
      { onConflict: "sheet_id,row_index" },
    );

  if (error) {
    return new Response(JSON.stringify({ error: "upsert_failed", detail: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, sheet_id: sheetId, row_index: rowIndex, bucket }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
