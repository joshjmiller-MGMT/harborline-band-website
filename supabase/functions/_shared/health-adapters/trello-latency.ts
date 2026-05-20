// P331 — Trello latency health adapter.
//
// Phase 1 Q3 lock (decision record 2026-05-18-p331-q1-q4-defaults-confirmed.md):
// LAST-POLL-LATENCY ONLY. No separate quota-remaining adapter — Trello rate
// limits surface as 429 → non-200 → red automatically.
//
// Contracts:
//   green  — 2xx in <5000ms.
//   yellow — 2xx in 5000-10000ms.
//   red    — non-2xx OR >10000ms OR fetch threw.
//
// Mode branching: cron-mode reads 200 OR 403 as "gate alive" with the latency
// budget applied to the gate response itself; operator-mode probes the full
// trello-poll path with `action=poll`.

import type { Adapter, AdapterResult } from "./types.ts";

const GREEN_MS = 5_000;
const YELLOW_MS = 10_000;

function classifyLatency(elapsedMs: number, ok: boolean): "green" | "yellow" | "red" {
  if (!ok) return "red";
  if (elapsedMs > YELLOW_MS) return "red";
  if (elapsedMs > GREEN_MS) return "yellow";
  return "green";
}

export const trelloLatencyAdapter: Adapter = async (ctx) => {
  const probeStart = Date.now();
  try {
    const r = await fetch(`${ctx.supabaseUrl}/functions/v1/trello-poll?action=poll`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ctx.callerJWT}`,
        apikey: ctx.callerJWT,
        "Content-Type": "application/json",
      },
    });
    const elapsedMs = Date.now() - probeStart;

    if (ctx.callerMode === "cron") {
      const gateAlive = r.status === 403 || r.status === 200;
      const status = classifyLatency(elapsedMs, gateAlive);
      if (!gateAlive) {
        return [{
          integration: "trello-latency",
          status: "red",
          detail: `unexpected_status: ${r.status}`,
          metric: `${elapsedMs}ms`,
          checked_at: new Date().toISOString(),
        }];
      }
      return [{
        integration: "trello-latency",
        status,
        detail: status === "green" ? undefined : `slow_gate_${elapsedMs}ms`,
        metric: `${elapsedMs}ms · gate ${r.status}`,
        checked_at: new Date().toISOString(),
      }];
    }

    if (!r.ok) {
      return [{
        integration: "trello-latency",
        status: "red",
        detail: `non_200: ${r.status}`,
        metric: `${elapsedMs}ms`,
        checked_at: new Date().toISOString(),
      }];
    }

    const body = await r.json().catch(() => ({} as Record<string, unknown>));
    const cardCount = Array.isArray((body as { cards?: unknown[] }).cards)
      ? (body as { cards: unknown[] }).cards.length
      : null;
    const status = classifyLatency(elapsedMs, true);

    return [{
      integration: "trello-latency",
      status,
      detail: status === "green" ? undefined : `slow_${elapsedMs}ms`,
      metric: cardCount != null
        ? `${elapsedMs}ms · ${cardCount} cards`
        : `${elapsedMs}ms`,
      checked_at: new Date().toISOString(),
    }];
  } catch (err) {
    return [{
      integration: "trello-latency",
      status: "red",
      detail: `probe_threw: ${(err as Error).message?.slice(0, 200) ?? "unknown"}`,
      checked_at: new Date().toISOString(),
    }];
  }
};
