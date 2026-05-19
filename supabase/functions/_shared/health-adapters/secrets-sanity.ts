// P331 — Supabase secrets sanity adapter.
//
// Validates that every required edge-function secret is present. Only inspects
// presence (Deno.env.get returns a non-empty string) — does NOT call the
// upstream API to verify the value (those are covered by their per-integration
// adapters, e.g. trello-latency surfaces a bad TRELLO_API_TOKEN as non-200).
//
// Required (red if any missing) — drives a live integration that has no other
// place to surface its absence:
//   GOOGLE_CALENDAR_CLIENT_ID
//   GOOGLE_CALENDAR_CLIENT_SECRET
//   MONDAY_API_TOKEN
//   TRELLO_API_KEY
//   TRELLO_API_TOKEN
//   ANTHROPIC_API_KEY
//   SOCIAL_HANDOFF_SECRET
//   OPERATOR_USER_IDS
//   FIRECRAWL_API_KEY
//   DJEP_USERNAME
//   DJEP_PASSWORD
//
// Optional (yellow if missing): TRELLO_BOARD_ID — used by trello-client board
// resolution; absent value falls back to name lookup which works fine.
//
// Mode-independent: Deno.env.get is local to the edge-fn worker process.

import type { Adapter, AdapterResult } from "./types.ts";

const REQUIRED_SECRETS = [
  "GOOGLE_CALENDAR_CLIENT_ID",
  "GOOGLE_CALENDAR_CLIENT_SECRET",
  "MONDAY_API_TOKEN",
  "TRELLO_API_KEY",
  "TRELLO_API_TOKEN",
  "ANTHROPIC_API_KEY",
  "SOCIAL_HANDOFF_SECRET",
  "OPERATOR_USER_IDS",
  "FIRECRAWL_API_KEY",
  "DJEP_USERNAME",
  "DJEP_PASSWORD",
];

const OPTIONAL_SECRETS = [
  "TRELLO_BOARD_ID",
];

export const secretsSanityAdapter: Adapter = async (_ctx) => {
  const checkedAt = new Date().toISOString();
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  for (const key of REQUIRED_SECRETS) {
    const v = Deno.env.get(key);
    if (!v || v.trim() === "") missingRequired.push(key);
  }
  for (const key of OPTIONAL_SECRETS) {
    const v = Deno.env.get(key);
    if (!v || v.trim() === "") missingOptional.push(key);
  }

  const requiredPresent = REQUIRED_SECRETS.length - missingRequired.length;
  const metric = `${requiredPresent}/${REQUIRED_SECRETS.length} required`;

  if (missingRequired.length > 0) {
    return [{
      integration: "secrets-sanity",
      status: "red",
      detail: `missing_required: ${missingRequired.join(",")}`,
      metric,
      checked_at: checkedAt,
    }];
  }
  if (missingOptional.length > 0) {
    return [{
      integration: "secrets-sanity",
      status: "yellow",
      detail: `missing_optional: ${missingOptional.join(",")}`,
      metric,
      checked_at: checkedAt,
    }];
  }
  return [{
    integration: "secrets-sanity",
    status: "green",
    metric,
    checked_at: checkedAt,
  }];
};
