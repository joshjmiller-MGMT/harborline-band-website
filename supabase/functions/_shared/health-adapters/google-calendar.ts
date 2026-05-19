// P331 — Google Calendar health adapter.
//
// Emits TWO AdapterResults from one probe:
//   1. "google-calendar" (token health) — inspects google_calendar_tokens rows.
//      Rolls per-account state up into one overall row using worst-of semantics.
//      Per-account detail surfaces in `detail` when ≥1 account is < green.
//   2. "google-calendar-read-path" (round-trip) — invokes google-calendar-events
//      and asserts connected:true + ≥1 account. This is the regression class
//      P328 fixed (frontend anon JWT → gate 403'd) — server-side a service-role
//      probe always passes the gate, but a hard breakage of the fn itself
//      (deploy failure, env var unset, etc.) still surfaces here.
//
// Phase 1 contracts (per scope doc § "What gets checked"):
//   green  — all accounts have needs_reconnect=false, last_refresh_at within 24h,
//            last_refresh_error IS NULL.
//   yellow — ≥1 account has last_refresh_at older than 24h OR scope missing
//            gmail.readonly (when gmail_scope_granted is false on a row that
//            previously had it — heuristic deferred to P331b; for now we only
//            yellow on stale refresh).
//   red    — ≥1 account has needs_reconnect=true OR last_refresh_error present
//            OR refresh_token IS NULL.

import type { Adapter, AdapterResult } from "./types.ts";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface TokenRow {
  id: string;
  account_email: string | null;
  refresh_token: string | null;
  last_refresh_at: string | null;
  last_refresh_error: string | null;
  needs_reconnect: boolean | null;
  gmail_scope_granted: boolean | null;
}

function classifyToken(row: TokenRow, now: number): { status: "green" | "yellow" | "red"; reason?: string } {
  if (!row.refresh_token) return { status: "red", reason: "refresh_token_null" };
  if (row.needs_reconnect) return { status: "red", reason: "needs_reconnect" };
  if (row.last_refresh_error) return { status: "red", reason: `refresh_error: ${row.last_refresh_error.slice(0, 80)}` };
  const refreshedAt = row.last_refresh_at ? new Date(row.last_refresh_at).getTime() : 0;
  if (!refreshedAt || now - refreshedAt > ONE_DAY_MS) {
    return { status: "yellow", reason: row.last_refresh_at ? "stale_refresh_24h" : "never_refreshed" };
  }
  return { status: "green" };
}

function worst(a: "green" | "yellow" | "red", b: "green" | "yellow" | "red"): "green" | "yellow" | "red" {
  const rank = { green: 0, yellow: 1, red: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}

export const googleCalendarAdapter: Adapter = async (ctx) => {
  const results: AdapterResult[] = [];

  // Row 1 — token health.
  const tokenResult: AdapterResult = await (async () => {
    const probeStart = Date.now();
    const { data, error } = await ctx.supabase
      .from("google_calendar_tokens")
      .select("id, account_email, refresh_token, last_refresh_at, last_refresh_error, needs_reconnect, gmail_scope_granted")
      .order("created_at", { ascending: true });

    if (error) {
      return {
        integration: "google-calendar",
        status: "red",
        detail: `tokens_select_failed: ${error.message ?? "unknown"}`,
        checked_at: new Date().toISOString(),
      } as AdapterResult;
    }

    const rows = (data ?? []) as TokenRow[];
    if (rows.length === 0) {
      return {
        integration: "google-calendar",
        status: "red",
        detail: "no_accounts_connected",
        metric: 0,
        checked_at: new Date().toISOString(),
      };
    }

    let overall: "green" | "yellow" | "red" = "green";
    const issues: string[] = [];
    for (const row of rows) {
      const c = classifyToken(row, probeStart);
      overall = worst(overall, c.status);
      if (c.status !== "green") {
        issues.push(`${row.account_email ?? row.id}: ${c.reason}`);
      }
    }

    return {
      integration: "google-calendar",
      status: overall,
      detail: issues.length ? issues.join("; ").slice(0, 500) : undefined,
      metric: rows.length,
      checked_at: new Date().toISOString(),
    };
  })();
  results.push(tokenResult);

  // Row 2 — read-path round-trip. Interpretation branches by caller mode:
  //   - cron: probes with the anon JWT and expects a structured 403 (gate alive)
  //     OR 200 (alive + permissive). A non-200/non-403 means the fn is broken.
  //   - operator: probes with the operator JWT and expects 200 + accounts. A 403
  //     here is exactly the P328 regression class (operator JWT not honored).
  const readPathResult: AdapterResult = await (async () => {
    const probeStart = Date.now();
    try {
      const r = await fetch(`${ctx.supabaseUrl}/functions/v1/google-calendar-events`, {
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
          return {
            integration: "google-calendar-read-path",
            status: "green",
            metric: `${elapsedMs}ms · gate ${r.status}`,
            checked_at: new Date().toISOString(),
          };
        }
        return {
          integration: "google-calendar-read-path",
          status: "red",
          detail: `unexpected_status: ${r.status}`,
          metric: `${elapsedMs}ms`,
          checked_at: new Date().toISOString(),
        };
      }

      // operator-mode
      if (!r.ok) {
        return {
          integration: "google-calendar-read-path",
          status: "red",
          detail: `non_200: ${r.status}`,
          metric: `${elapsedMs}ms`,
          checked_at: new Date().toISOString(),
        };
      }
      const body = await r.json();
      if (!body.connected || !Array.isArray(body.accounts) || body.accounts.length === 0) {
        return {
          integration: "google-calendar-read-path",
          status: "red",
          detail: `not_connected: ${body.error ?? "no_accounts"}`,
          metric: `${elapsedMs}ms`,
          checked_at: new Date().toISOString(),
        };
      }
      return {
        integration: "google-calendar-read-path",
        status: "green",
        metric: `${elapsedMs}ms · ${body.accounts.length} acct`,
        checked_at: new Date().toISOString(),
      };
    } catch (err) {
      return {
        integration: "google-calendar-read-path",
        status: "red",
        detail: `probe_threw: ${(err as Error).message?.slice(0, 200) ?? "unknown"}`,
        checked_at: new Date().toISOString(),
      };
    }
  })();
  results.push(readPathResult);

  return results;
};
