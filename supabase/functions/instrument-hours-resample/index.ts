// instrument-hours-resample — P324.
//
// Sanity-check pass: re-surface past-classified auto events as review prompts
// so Josh can catch rule over-extrapolation. Flips selected `auto` rows to
// `needs-review` and bumps `last_resampled_at`. Reviewed/needs-review rows
// are immune — only `review_status='auto'` rows are touched.
//
// Two modes:
//   { ids: string[] }   — resample the specific row ids
//   { oldest: number }  — pick the N auto rows least recently resampled
//                          (NULLS FIRST on last_resampled_at, then oldest event_start)
//
// Operator-gated. Surfacing happens via the existing HoursReviewQueueWidget
// (no parallel UI surface).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_RESAMPLE = 50;

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

  let body: { ids?: unknown; oldest?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let targetIds: string[] = [];

  if (Array.isArray(body.ids)) {
    targetIds = body.ids
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .slice(0, MAX_RESAMPLE);
    if (targetIds.length === 0) {
      return new Response(JSON.stringify({ error: "empty_ids" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else if (typeof body.oldest === "number" && Number.isInteger(body.oldest) && body.oldest > 0) {
    const limit = Math.min(body.oldest, MAX_RESAMPLE);
    const { data: picked, error: pickErr } = await supabase
      .from("instrument_event_classifications")
      .select("id")
      .eq("review_status", "auto")
      .order("last_resampled_at", { ascending: true, nullsFirst: true })
      .order("event_start", { ascending: true })
      .limit(limit);
    if (pickErr) {
      return new Response(JSON.stringify({ error: "pick_failed", detail: pickErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    targetIds = (picked || []).map((r: { id: string }) => r.id);
    if (targetIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, resampled: 0, ids: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
    return new Response(
      JSON.stringify({ error: "invalid_body", detail: "supply { ids: string[] } or { oldest: integer }" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Only flip rows that are currently 'auto' — never overwrite manual triage.
  const { data: updated, error: upErr } = await supabase
    .from("instrument_event_classifications")
    .update({
      review_status: "needs-review",
      last_resampled_at: new Date().toISOString(),
    })
    .in("id", targetIds)
    .eq("review_status", "auto")
    .select("id, event_title, event_start");

  if (upErr) {
    return new Response(JSON.stringify({ error: "update_failed", detail: upErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      resampled: updated?.length ?? 0,
      ids: (updated || []).map((r: { id: string }) => r.id),
      sample: (updated || []).slice(0, 5).map((r: { event_title: string; event_start: string }) => ({
        title: r.event_title,
        start: r.event_start,
      })),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
