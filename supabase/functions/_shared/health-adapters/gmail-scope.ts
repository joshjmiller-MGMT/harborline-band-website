// P331 — Gmail scope health adapter.
//
// Inspects google_calendar_tokens.gmail_scope_granted across all connected
// accounts. Independent of the google-calendar token-health adapter (which
// rolls Gmail-scope into a deferred yellow heuristic) — this one is the
// dedicated row for Gmail-scope coverage so the dashboard can surface
// re-consent prompts narrowly.
//
// Phase 1 contracts (per scope doc § "What gets checked"):
//   green  — all accounts have gmail_scope_granted=true.
//   yellow — one account missing (others healthy).
//   red    — all missing OR no accounts connected.
//
// Mode-independent: this adapter reads the table directly via service-role,
// so cron + operator modes produce identical results.

import type { Adapter, AdapterResult } from "./types.ts";

interface ScopeRow {
  id: string;
  account_email: string | null;
  gmail_scope_granted: boolean | null;
}

export const gmailScopeAdapter: Adapter = async (ctx) => {
  const checkedAt = new Date().toISOString();
  const { data, error } = await ctx.supabase
    .from("google_calendar_tokens")
    .select("id, account_email, gmail_scope_granted");

  if (error) {
    return [{
      integration: "gmail-scope",
      status: "red",
      detail: `tokens_select_failed: ${error.message ?? "unknown"}`,
      checked_at: checkedAt,
    }];
  }

  const rows = (data ?? []) as ScopeRow[];
  if (rows.length === 0) {
    return [{
      integration: "gmail-scope",
      status: "red",
      detail: "no_accounts_connected",
      metric: 0,
      checked_at: checkedAt,
    }];
  }

  const missing = rows.filter((r) => r.gmail_scope_granted !== true);
  const total = rows.length;
  const grantedCount = total - missing.length;

  if (missing.length === 0) {
    return [{
      integration: "gmail-scope",
      status: "green",
      metric: `${grantedCount}/${total} granted`,
      checked_at: checkedAt,
    }];
  }

  if (missing.length === total) {
    return [{
      integration: "gmail-scope",
      status: "red",
      detail: "all_accounts_missing_gmail_scope",
      metric: `0/${total} granted`,
      checked_at: checkedAt,
    }];
  }

  return [{
    integration: "gmail-scope",
    status: "yellow",
    detail: missing
      .map((r) => r.account_email ?? r.id)
      .join("; ")
      .slice(0, 300),
    metric: `${grantedCount}/${total} granted`,
    checked_at: checkedAt,
  }];
};
