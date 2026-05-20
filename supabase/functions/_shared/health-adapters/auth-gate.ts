// P331 — Auth-gate health adapter.
//
// Verifies the P319 operator-gate is wired correctly:
//   - ALLOW_ANON must be unset or "false" (true would short-circuit the gate).
//   - OPERATOR_USER_IDS must contain ≥1 UUID.
//   - Each UUID must match an actual auth.users row (catches typos / deleted users).
//
// Phase 1 contracts (per scope doc § "What gets checked"):
//   green  — ALLOW_ANON != "true" + OPERATOR_USER_IDS set + every UUID resolves
//            to an auth.users row that exists (we don't check active/banned —
//            Supabase doesn't expose `banned_until` cleanly via the JS client
//            without admin-API + service-role-key plumbing).
//   yellow — UUID(s) configured but one+ doesn't resolve to an auth.users row
//            (the rest do).
//   red    — ALLOW_ANON=true, OR OPERATOR_USER_IDS empty/unset, OR all UUIDs
//            fail to resolve.
//
// Mode-independent: reads env + auth.users via service-role.

import type { Adapter, AdapterResult } from "./types.ts";

export const authGateAdapter: Adapter = async (ctx) => {
  const checkedAt = new Date().toISOString();
  const allowAnon = Deno.env.get("ALLOW_ANON") === "true";

  if (allowAnon) {
    return [{
      integration: "auth-gate",
      status: "red",
      detail: "ALLOW_ANON=true (gate bypassed)",
      checked_at: checkedAt,
    }];
  }

  const operatorIds = (Deno.env.get("OPERATOR_USER_IDS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (operatorIds.length === 0) {
    return [{
      integration: "auth-gate",
      status: "red",
      detail: "OPERATOR_USER_IDS not set",
      checked_at: checkedAt,
    }];
  }

  // Service-role admin lookup per UUID. Failures here mean either the UUID
  // was deleted / typo'd in env, or the admin API isn't reachable (which
  // is itself a config-level red).
  const lookups = await Promise.all(operatorIds.map(async (id) => {
    try {
      const { data, error } = await ctx.supabase.auth.admin.getUserById(id);
      if (error || !data?.user) return { id, resolved: false };
      return { id, resolved: true };
    } catch (_err) {
      return { id, resolved: false };
    }
  }));

  const unresolved = lookups.filter((l) => !l.resolved);
  const resolved = lookups.length - unresolved.length;

  if (resolved === 0) {
    return [{
      integration: "auth-gate",
      status: "red",
      detail: `no_operator_uuids_resolved: ${unresolved.map((u) => u.id.slice(0, 8)).join(",")}`,
      metric: `0/${lookups.length} resolved · ALLOW_ANON=false`,
      checked_at: checkedAt,
    }];
  }

  if (unresolved.length > 0) {
    return [{
      integration: "auth-gate",
      status: "yellow",
      detail: `partial_unresolved: ${unresolved.map((u) => u.id.slice(0, 8)).join(",")}`,
      metric: `${resolved}/${lookups.length} resolved · ALLOW_ANON=false`,
      checked_at: checkedAt,
    }];
  }

  return [{
    integration: "auth-gate",
    status: "green",
    metric: `${resolved}/${lookups.length} resolved · ALLOW_ANON=false`,
    checked_at: checkedAt,
  }];
};
