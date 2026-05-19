// P331 — Integration health check orchestrator.
//
// Triggers:
//   - Daily 7am ET cron (11:00 UTC during EDT; pg_cron migration shipping with this fn).
//     Cron passes a shared `x-cron-secret` whose canonical value lives in
//     public.cron_secrets (RLS-on, no policies; service-role read only). pg_net
//     can't mint a service-role JWT, so the header is the bypass.
//   - On-demand from the dashboard's Refresh button (operator JWT; P331c).
//
// Each adapter is invoked with shared context + per-adapter try/catch so a single
// broken adapter cannot blackout the report. AdapterResults are INSERTed into
// `integration_health_history` (one row per result; the latest row per
// integration powers the dashboard widget; older rows support trend graphs).
//
// Response is the consolidated HealthReport — same shape the widget consumes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";
import type { Adapter, AdapterResult } from "../_shared/health-adapters/types.ts";
import { googleCalendarAdapter } from "../_shared/health-adapters/google-calendar.ts";
import { mondayAdapter } from "../_shared/health-adapters/monday.ts";
import { gmailScopeAdapter } from "../_shared/health-adapters/gmail-scope.ts";
import { djepAvailabilityAdapter } from "../_shared/health-adapters/djep-availability.ts";
import { trelloLatencyAdapter } from "../_shared/health-adapters/trello-latency.ts";
import { djepScrubAdapter } from "../_shared/health-adapters/djep-scrub.ts";
import { edgeFnErrorRateAdapter } from "../_shared/health-adapters/edge-fn-error-rate.ts";
import { authGateAdapter } from "../_shared/health-adapters/auth-gate.ts";
import { secretsSanityAdapter } from "../_shared/health-adapters/secrets-sanity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ADAPTERS: Array<{ name: string; run: Adapter }> = [
  { name: "auth-gate", run: authGateAdapter },
  { name: "secrets-sanity", run: secretsSanityAdapter },
  { name: "google-calendar", run: googleCalendarAdapter },
  { name: "gmail-scope", run: gmailScopeAdapter },
  { name: "monday", run: mondayAdapter },
  { name: "djep-availability", run: djepAvailabilityAdapter },
  { name: "trello-latency", run: trelloLatencyAdapter },
  { name: "djep-scrub", run: djepScrubAdapter },
  { name: "edge-fn-error-rate", run: edgeFnErrorRateAdapter },
];

function worst(a: "green" | "yellow" | "red", b: "green" | "yellow" | "red"): "green" | "yellow" | "red" {
  const rank = { green: 0, yellow: 1, red: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}

// Cron-secret + anon-JWT caches. Cleared per worker boot; refreshed on first
// cron-flagged request. Constant-time compare on cron-secret lookup avoids
// timing-leaks of the secret prefix.
// deno-lint-ignore no-explicit-any
let cachedCronSecret: string | null = null;
let cachedAnonJwt: string | null = null;
// deno-lint-ignore no-explicit-any
async function loadCronSecret(supabase: any): Promise<string | null> {
  if (cachedCronSecret !== null) return cachedCronSecret;
  const { data, error } = await supabase
    .from("cron_secrets")
    .select("secret")
    .eq("name", "integration_health_check_cron_secret")
    .maybeSingle();
  if (error || !data?.secret) return null;
  cachedCronSecret = data.secret as string;
  return cachedCronSecret;
}
// deno-lint-ignore no-explicit-any
async function loadAnonJwt(supabase: any): Promise<string | null> {
  if (cachedAnonJwt !== null) return cachedAnonJwt;
  const { data, error } = await supabase
    .from("cron_secrets")
    .select("secret")
    .eq("name", "supabase_anon_jwt")
    .maybeSingle();
  if (error || !data?.secret) return null;
  cachedAnonJwt = data.secret as string;
  return cachedAnonJwt;
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Service-role client used for both the cron-secret lookup and persist.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Cron-secret bypass (pg_cron caller). pg_net can't mint a service-role JWT,
  // so the trigger fn passes a shared header instead. Secret lives in
  // public.cron_secrets (RLS-on, no policies — only service-role-bypass reads).
  const cronHeader = req.headers.get("x-cron-secret");
  let isCron = false;
  if (cronHeader) {
    const expected = await loadCronSecret(supabase);
    if (expected && constantTimeEquals(cronHeader, expected)) isCron = true;
  }

  if (!isCron) {
    const denial = await requireOperator(req);
    if (denial) return denial;
  }

  const generatedAt = new Date().toISOString();
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const callerMode: "cron" | "operator" = isCron ? "cron" : "operator";
  // For cron sibling-fn probes the only signed JWT pg_net can present is the
  // anon JWT (service-role keys aren't accepted at the platform layer here).
  // For operator probes we forward the operator's JWT so the round-trip
  // exercises the same auth path as the dashboard.
  let callerJWT: string;
  if (isCron) {
    callerJWT = (await loadAnonJwt(supabase)) ?? "";
  } else {
    callerJWT = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice("bearer ".length).trim()
      : "";
  }

  const ctx = {
    supabase,
    supabaseUrl: SUPABASE_URL,
    callerJWT,
    callerMode,
    generatedAt,
  };

  const allResults: AdapterResult[] = [];
  for (const adapter of ADAPTERS) {
    try {
      const adapterResults = await adapter.run(ctx);
      allResults.push(...adapterResults);
    } catch (err) {
      // Adapter threw outside its own try/catch — surface as one synthetic red row
      // so the report stays well-formed and operators see the breakage.
      allResults.push({
        integration: adapter.name,
        status: "red",
        detail: `adapter_threw: ${(err as Error).message?.slice(0, 200) ?? "unknown"}`,
        checked_at: new Date().toISOString(),
      });
    }
  }

  // Persist — every run inserts a row per result (no upsert; history is queryable).
  const rowsToInsert = allResults.map((r) => ({
    integration: r.integration,
    status: r.status,
    detail: r.detail ?? null,
    metric_value: r.metric != null ? String(r.metric) : null,
    checked_at: r.checked_at,
  }));

  if (rowsToInsert.length > 0) {
    const { error: insertErr } = await supabase
      .from("integration_health_history")
      .insert(rowsToInsert);
    if (insertErr) {
      // Persist failure is itself a health concern but shouldn't fail the response —
      // surface alongside the report so the caller sees both layers.
      return new Response(
        JSON.stringify({
          adapters: allResults,
          overall: allResults.reduce<"green" | "yellow" | "red">(
            (acc, r) => worst(acc, r.status),
            "green",
          ),
          generated_at: generatedAt,
          persist_error: insertErr.message,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  const overall = allResults.reduce<"green" | "yellow" | "red">(
    (acc, r) => worst(acc, r.status),
    "green",
  );

  return new Response(
    JSON.stringify({
      adapters: allResults,
      overall,
      generated_at: generatedAt,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
