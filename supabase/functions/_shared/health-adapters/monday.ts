// P331 — Monday.com health adapter.
//
// Phase 1 single probe: round-trip call to `monday-calendar-events` asserting
// configured:true (MONDAY_API_TOKEN set) and an events array is present. Returns:
//   green  — 200 + configured:true + events array (any length, including 0;
//            an enabled source with 0 events is normal during off-weeks).
//   yellow — 200 + configured:true but `error` field set on response (partial
//            failure on one source while others returned data).
//   red    — non-200, OR configured:false (token missing), OR fetch threw.
//
// Per-source yellow ("1 source enabled but 0 events for >N days") is deferred
// to P331b — needs a historical baseline to distinguish from off-week silence.

import type { Adapter, AdapterResult } from "./types.ts";

export const mondayAdapter: Adapter = async (ctx) => {
  const probeStart = Date.now();
  try {
    const r = await fetch(`${ctx.supabaseUrl}/functions/v1/monday-calendar-events`, {
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
          integration: "monday",
          status: "green",
          metric: `${elapsedMs}ms · gate ${r.status}`,
          checked_at: new Date().toISOString(),
        }];
      }
      return [{
        integration: "monday",
        status: "red",
        detail: `unexpected_status: ${r.status}`,
        metric: `${elapsedMs}ms`,
        checked_at: new Date().toISOString(),
      }];
    }

    if (!r.ok) {
      return [{
        integration: "monday",
        status: "red",
        detail: `non_200: ${r.status}`,
        metric: `${elapsedMs}ms`,
        checked_at: new Date().toISOString(),
      }];
    }

    const body = await r.json();
    if (body.configured === false) {
      return [{
        integration: "monday",
        status: "red",
        detail: body.error ?? "configured_false",
        metric: `${elapsedMs}ms`,
        checked_at: new Date().toISOString(),
      }];
    }

    if (!Array.isArray(body.events)) {
      return [{
        integration: "monday",
        status: "red",
        detail: "events_not_array",
        metric: `${elapsedMs}ms`,
        checked_at: new Date().toISOString(),
      }];
    }

    if (body.error) {
      return [{
        integration: "monday",
        status: "yellow",
        detail: `partial: ${String(body.error).slice(0, 200)}`,
        metric: `${elapsedMs}ms · ${body.events.length} events`,
        checked_at: new Date().toISOString(),
      }];
    }

    return [{
      integration: "monday",
      status: "green",
      metric: `${elapsedMs}ms · ${body.events.length} events`,
      checked_at: new Date().toISOString(),
    }];
  } catch (err) {
    return [{
      integration: "monday",
      status: "red",
      detail: `probe_threw: ${(err as Error).message?.slice(0, 200) ?? "unknown"}`,
      checked_at: new Date().toISOString(),
    }];
  }
};
