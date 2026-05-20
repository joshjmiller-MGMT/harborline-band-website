// P331 — DJEP availability health adapter.
//
// Round-trips `djep-calendar-events` and inspects the response shape:
//   { configured: bool, events: [...], cached: bool, refreshed_at, expires_at, error? }
//
// Phase 1 contracts (per scope doc § "What gets checked"):
//   green  — 200 + configured:true + events.length > 0 + cache refreshed within 24h.
//   yellow — 200 + configured:true + events present but cache refreshed_at older
//            than 24h (firecrawl + DJEP scrape is rate-limited; stale is expected
//            sometimes; not red until the call itself fails).
//   red    — non-200, OR configured:false (FIRECRAWL_API_KEY / DJEP creds missing),
//            OR events.length === 0 (the scrape returned nothing meaningful).
//
// Mode branching matches the google-calendar / monday adapters: cron-mode reads
// 200 OR 403 as "gate alive"; operator-mode probes the full read path.

import type { Adapter, AdapterResult } from "./types.ts";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const djepAvailabilityAdapter: Adapter = async (ctx) => {
  const probeStart = Date.now();
  try {
    const r = await fetch(`${ctx.supabaseUrl}/functions/v1/djep-calendar-events`, {
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
          integration: "djep-availability",
          status: "green",
          metric: `${elapsedMs}ms · gate ${r.status}`,
          checked_at: new Date().toISOString(),
        }];
      }
      return [{
        integration: "djep-availability",
        status: "red",
        detail: `unexpected_status: ${r.status}`,
        metric: `${elapsedMs}ms`,
        checked_at: new Date().toISOString(),
      }];
    }

    if (!r.ok) {
      return [{
        integration: "djep-availability",
        status: "red",
        detail: `non_200: ${r.status}`,
        metric: `${elapsedMs}ms`,
        checked_at: new Date().toISOString(),
      }];
    }

    const body = await r.json();
    if (body.configured === false) {
      return [{
        integration: "djep-availability",
        status: "red",
        detail: String(body.error ?? "configured_false").slice(0, 200),
        metric: `${elapsedMs}ms`,
        checked_at: new Date().toISOString(),
      }];
    }

    if (!Array.isArray(body.events) || body.events.length === 0) {
      return [{
        integration: "djep-availability",
        status: "red",
        detail: body.error ? `empty: ${String(body.error).slice(0, 160)}` : "empty_events",
        metric: `${elapsedMs}ms · 0 events`,
        checked_at: new Date().toISOString(),
      }];
    }

    const refreshedAt = body.refreshed_at ? new Date(body.refreshed_at).getTime() : 0;
    const cacheAgeMs = refreshedAt ? Date.now() - refreshedAt : Number.POSITIVE_INFINITY;
    if (cacheAgeMs > ONE_DAY_MS) {
      return [{
        integration: "djep-availability",
        status: "yellow",
        detail: `stale_cache_24h: ${body.refreshed_at ?? "never"}`,
        metric: `${elapsedMs}ms · ${body.events.length} events`,
        checked_at: new Date().toISOString(),
      }];
    }

    return [{
      integration: "djep-availability",
      status: "green",
      metric: `${elapsedMs}ms · ${body.events.length} events`,
      checked_at: new Date().toISOString(),
    }];
  } catch (err) {
    return [{
      integration: "djep-availability",
      status: "red",
      detail: `probe_threw: ${(err as Error).message?.slice(0, 200) ?? "unknown"}`,
      checked_at: new Date().toISOString(),
    }];
  }
};
