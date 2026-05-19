// P331 — DJEP scrub (booking-agent-rows) health adapter.
//
// Phase 1 Q4 lock (decision record 2026-05-18-p331-q1-q4-defaults-confirmed.md):
// LOG-RAW + DEFER THRESHOLD. Phase 1 records raw `counts.rows` into metric_value;
// status is green unless the call itself fails. After ~1 week of logged data,
// a follow-up record picks a real drift threshold from observed variance.
//
// Contracts:
//   green  — 200 + configured:true (events/reachouts/followups arrays present).
//   red    — non-200, OR configured:false, OR fetch threw, OR `error` field set
//            at the top level of the response.
//
// Mode branching: cron-mode reads 200 OR 403 as "gate alive"; operator-mode
// probes the full path and records the row_count.

import type { Adapter, AdapterResult } from "./types.ts";

export const djepScrubAdapter: Adapter = async (ctx) => {
  const probeStart = Date.now();
  try {
    const r = await fetch(`${ctx.supabaseUrl}/functions/v1/booking-agent-rows`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ctx.callerJWT}`,
        apikey: ctx.callerJWT,
        "Content-Type": "application/json",
      },
    });
    const elapsedMs = Date.now() - probeStart;

    if (ctx.callerMode === "cron") {
      if (r.status === 403 || r.status === 200) {
        return [{
          integration: "djep-scrub",
          status: "green",
          metric: `${elapsedMs}ms · gate ${r.status}`,
          checked_at: new Date().toISOString(),
        }];
      }
      return [{
        integration: "djep-scrub",
        status: "red",
        detail: `unexpected_status: ${r.status}`,
        metric: `${elapsedMs}ms`,
        checked_at: new Date().toISOString(),
      }];
    }

    if (!r.ok) {
      return [{
        integration: "djep-scrub",
        status: "red",
        detail: `non_200: ${r.status}`,
        metric: `${elapsedMs}ms`,
        checked_at: new Date().toISOString(),
      }];
    }

    const body = await r.json();
    if (body.configured === false) {
      return [{
        integration: "djep-scrub",
        status: "red",
        detail: String(body.error ?? "configured_false").slice(0, 200),
        metric: `${elapsedMs}ms`,
        checked_at: new Date().toISOString(),
      }];
    }
    if (body.error) {
      return [{
        integration: "djep-scrub",
        status: "red",
        detail: String(body.error).slice(0, 200),
        metric: `${elapsedMs}ms`,
        checked_at: new Date().toISOString(),
      }];
    }

    const counts = (body.counts ?? {}) as {
      rows?: number;
      reachouts?: number;
      followups?: number;
      events?: number;
    };
    const rowCount = typeof counts.rows === "number" ? counts.rows : 0;

    return [{
      integration: "djep-scrub",
      status: "green",
      metric: rowCount,
      detail:
        `rows=${rowCount} · reachouts=${counts.reachouts ?? 0} · followups=${counts.followups ?? 0} · ${elapsedMs}ms`,
      checked_at: new Date().toISOString(),
    }];
  } catch (err) {
    return [{
      integration: "djep-scrub",
      status: "red",
      detail: `probe_threw: ${(err as Error).message?.slice(0, 200) ?? "unknown"}`,
      checked_at: new Date().toISOString(),
    }];
  }
};
