// P331 — Shared types for integration-health-check adapters.
//
// Each adapter is a pure async function that takes an AdapterContext and
// returns one or more AdapterResults. The orchestrating edge fn loops adapters
// with per-adapter try/catch so one broken adapter doesn't blackout the report.

export interface AdapterResult {
  integration: string;            // "google-calendar" | "google-calendar-read-path" | "monday" | ...
  status: "green" | "yellow" | "red";
  detail?: string;                // last_error, sample message, or context
  metric?: number | string;       // e.g. row count, ms latency — stringified on persist
  checked_at: string;             // ISO timestamp; usually set by the adapter at probe end
}

export interface AdapterContext {
  // Service-role client for direct table reads (e.g. token health rows).
  // RLS-bypassing — adapters MUST treat data read this way as already-trusted.
  // deno-lint-ignore no-explicit-any
  supabase: any;
  // Supabase project URL — adapters needing to call sibling edge fns use this
  // as the base for the round-trip probe.
  supabaseUrl: string;
  // The JWT to use for sibling-fn round-trip probes:
  //   - operator-mode: caller's operator JWT (traverses the same auth path as
  //     the dashboard, catching P328-class regressions where the gate rejects
  //     a real operator request).
  //   - cron-mode: the published anon JWT (the only signed JWT pg_net can
  //     present; service-role keys don't validate at the platform layer).
  callerJWT: string;
  // Caller mode. Determines how adapters interpret round-trip responses:
  //   - "operator": expect 200 with data; non-200 → red.
  //   - "cron": expect either 200 OR a structured 403 from requireOperator
  //     (i.e. the gate is alive); other responses → red.
  callerMode: "operator" | "cron";
  // Wall-clock origin for `checked_at` defaulting. Adapters MAY override per-row
  // (e.g. one adapter that emits multiple results from one probe).
  generatedAt: string;
}

export type Adapter = (ctx: AdapterContext) => Promise<AdapterResult[]>;
