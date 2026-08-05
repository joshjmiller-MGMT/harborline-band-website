// P312 — Persist a single SMART task's board bucket and/or venture swim
// lane on the smart_task_enrichments row. Operator-gated via the P319
// umbrella; service role bypasses the gate so internal callers still work.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

// CORS narrowed from "*" to an allowlist 2026-08-05 (finding F9). Headers are
// per-request now because the echoed origin depends on the caller.
import { corsHeadersFor } from "../_shared/allowed-origins.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_BUCKETS = new Set([
  "Needs SMART",
  "Pending approval",
  "Active",
  "Done",
]);

const ALLOWED_VENTURES = new Set([
  "Harborline",
  "Economy",
  "JJM",
  "Personal",
  "BSE",
  "Brand Studio",
]);

// Legacy tokens from before the 2026-08 JJM rebrand — normalize forward so a
// stale client sending the old vocab never hits the DB CHECK constraint.
const LEGACY_VENTURES: Record<string, string> = { JMJ: "JJM" };

Deno.serve(async (req) => {
  // Scoped per-request rather than module-level: the echoed origin varies by
  // caller, so a shared constant would race across concurrent requests.
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    id?: string;
    bucket?: string | null;
    venture?: string | null;
    recurring_followup?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const id = (body.id || "").trim();
  if (!id) {
    return new Response(JSON.stringify({ error: "missing_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const patch: Record<string, string | null | boolean> = {};

  if (body.recurring_followup !== undefined) {
    patch.recurring_followup = Boolean(body.recurring_followup);
  }

  if (body.bucket !== undefined) {
    const bucket = body.bucket === null ? null : String(body.bucket).trim();
    if (bucket !== null && !ALLOWED_BUCKETS.has(bucket)) {
      return new Response(
        JSON.stringify({
          error: "invalid_bucket",
          detail: `bucket must be one of ${[...ALLOWED_BUCKETS].join(", ")} or null`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    patch.board_bucket = bucket;
  }

  if (body.venture !== undefined) {
    let venture = body.venture === null ? null : String(body.venture).trim();
    if (venture !== null && LEGACY_VENTURES[venture]) venture = LEGACY_VENTURES[venture];
    if (venture !== null && !ALLOWED_VENTURES.has(venture)) {
      return new Response(
        JSON.stringify({
          error: "invalid_venture",
          detail: `venture must be one of ${[...ALLOWED_VENTURES].join(", ")} or null`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    patch.board_venture = venture;
  }

  if (Object.keys(patch).length === 0) {
    return new Response(
      JSON.stringify({ error: "no_fields", detail: "send at least one of bucket, venture, or recurring_followup" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from("smart_task_enrichments")
    .update(patch)
    .eq("id", id)
    .select("id, board_bucket, board_venture")
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: "update_failed", detail: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ ok: true, row: data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
