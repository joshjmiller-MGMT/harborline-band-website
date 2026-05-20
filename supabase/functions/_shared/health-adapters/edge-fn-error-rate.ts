// P331 — Supabase Edge Function error-rate health adapter.
//
// Self-summarizing: reads the prior 24h of integration_health_history rows and
// computes the red-row fraction. This is a *proxy* for platform 5xx rates —
// Supabase doesn't expose function_edge_logs to runtime edge fns without a
// Personal Access Token (Management API path), so we substitute the adapter
// signal we already have. When a sibling adapter detects non-200 / probe-threw,
// it lands as a red row here; this adapter rolls those reds into an aggregate.
//
// Phase 1 contracts (per scope doc § "What gets checked"):
//   green  — red-row fraction < 1% in last 24h.
//   yellow — 1-5%.
//   red    — >5%.
//
// Bootstrap window: with fewer than 10 prior rows (~3 hours of cron + on-demand
// runs), the adapter reports green with a `bootstrap_n_rows` detail rather than
// false-flagging on a small sample. Real signal kicks in after a couple cron
// cycles have populated history.

import type { Adapter, AdapterResult } from "./types.ts";

const BOOTSTRAP_MIN_ROWS = 10;
const YELLOW_THRESHOLD = 0.01;
const RED_THRESHOLD = 0.05;

export const edgeFnErrorRateAdapter: Adapter = async (ctx) => {
  const checkedAt = new Date().toISOString();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await ctx.supabase
    .from("integration_health_history")
    .select("status, integration")
    .gte("checked_at", since)
    .neq("integration", "edge-fn-error-rate"); // exclude self to avoid feedback

  if (error) {
    return [{
      integration: "edge-fn-error-rate",
      status: "red",
      detail: `history_select_failed: ${error.message ?? "unknown"}`,
      checked_at: checkedAt,
    }];
  }

  const rows = (data ?? []) as Array<{ status: string; integration: string }>;
  const total = rows.length;

  if (total < BOOTSTRAP_MIN_ROWS) {
    return [{
      integration: "edge-fn-error-rate",
      status: "green",
      detail: `bootstrap_n_${total}_rows`,
      metric: `${total} samples · 24h`,
      checked_at: checkedAt,
    }];
  }

  const redCount = rows.filter((r) => r.status === "red").length;
  const redFrac = redCount / total;

  let status: "green" | "yellow" | "red";
  if (redFrac > RED_THRESHOLD) status = "red";
  else if (redFrac > YELLOW_THRESHOLD) status = "yellow";
  else status = "green";

  return [{
    integration: "edge-fn-error-rate",
    status,
    detail: status === "green"
      ? undefined
      : `red_rows=${redCount}/${total} (${(redFrac * 100).toFixed(1)}%)`,
    metric: `${redCount}/${total} red · 24h`,
    checked_at: checkedAt,
  }];
};
