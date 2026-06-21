// content-ingest-log — read-only audit surface for the IG content-ingest pipeline.
//
// Backs the "Content Ingest Log" + "Content → SMART Goals" sections at the bottom of
// /team/social. Reels & posts pulled from Josh's IG accounts (economy / harborline /
// personal) are transcribed, classified, deadline-stamped, and routed; each lands as a
// row in public.content_ingest_log (deduped on shortcode). Clusters of items become
// public.content_smart_goals. This fn surfaces both for the widgets.
//
// Ops:
//   list   recent rows (default 100, newest first) + a summary object
//          (total, counts per source_account, counts per purpose).
//   goals  synthesized SMART goals, sorted by priority then urgency then size.
//
// Auth: requireOperator() gates the op (matches team-users). Service-role bypass
// preserved for cron. Reads via the service-role client to see past RLS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DISPLAY_COLUMNS = [
  "id",
  "shortcode",
  "platform",
  "source_account",
  "collection_name",
  "url",
  "uploader",
  "caption",
  "duration_sec",
  "purpose",
  "confidence",
  "summary",
  "application",
  "venture",
  "action",
  "route",
  "tags",
  "status",
  "routed_ref",
  "deadline",
  "deadline_raw",
  "time_sensitivity",
  "recurring",
  "ingested_at",
  "processed_at",
].join(", ");

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

// urgency rank for sorting goals (most pressing first; expired last)
const URGENCY_RANK: Record<string, number> = {
  urgent: 0,
  soon: 1,
  rolling: 2,
  none: 3,
  expired: 4,
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clampLimit(input: unknown): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const denial = await requireOperator(req);
  if (denial) return denial;

  // Accept the op from the JSON body (POST) or the query string (GET).
  let op = "list";
  let limit = DEFAULT_LIMIT;
  if (req.method === "POST") {
    let body: { op?: string; limit?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "invalid_json" });
    }
    op = (body.op as string | undefined) ?? "list";
    limit = clampLimit(body.limit);
  } else if (req.method === "GET") {
    const params = new URL(req.url).searchParams;
    op = params.get("op") ?? "list";
    limit = clampLimit(params.get("limit"));
  } else {
    return json(405, { error: "method_not_allowed" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (op === "list") {
    const { data: rows, error } = await supabase
      .from("content_ingest_log")
      .select(DISPLAY_COLUMNS)
      .order("ingested_at", { ascending: false })
      .limit(limit);
    if (error) {
      return json(500, { error: "list_failed", detail: error.message });
    }

    // Rollup the full table (not just the page) for the summary chips.
    const { data: summaryRows, error: summaryError } = await supabase
      .from("content_ingest_log")
      .select("source_account, purpose");
    if (summaryError) {
      return json(500, { error: "summary_failed", detail: summaryError.message });
    }

    const byAccount: Record<string, number> = {};
    const byPurpose: Record<string, number> = {};
    for (const r of summaryRows ?? []) {
      const acct = (r as { source_account: string | null }).source_account;
      const purpose = (r as { purpose: string | null }).purpose;
      if (acct) byAccount[acct] = (byAccount[acct] ?? 0) + 1;
      if (purpose) byPurpose[purpose] = (byPurpose[purpose] ?? 0) + 1;
    }

    return json(200, {
      items: rows ?? [],
      summary: {
        total: summaryRows?.length ?? 0,
        by_account: byAccount,
        by_purpose: byPurpose,
      },
    });
  }

  if (op === "goals") {
    const { data: goals, error } = await supabase
      .from("content_smart_goals")
      .select("*");
    if (error) {
      return json(500, { error: "goals_failed", detail: error.message });
    }
    const sorted = (goals ?? []).slice().sort((a, b) => {
      const ga = a as { priority: number | null; urgency: string | null; member_count: number | null };
      const gb = b as { priority: number | null; urgency: string | null; member_count: number | null };
      return (
        (ga.priority ?? 9) - (gb.priority ?? 9) ||
        (URGENCY_RANK[ga.urgency ?? "none"] ?? 5) - (URGENCY_RANK[gb.urgency ?? "none"] ?? 5) ||
        (gb.member_count ?? 0) - (ga.member_count ?? 0)
      );
    });
    return json(200, { goals: sorted });
  }

  return json(400, { error: "unknown_op", op });
});
