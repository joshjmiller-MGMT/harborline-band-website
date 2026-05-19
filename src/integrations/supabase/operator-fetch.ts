// P328 — operator-aware fetch helper for direct edge-fn calls.
//
// Why: P319-followup gated read-side edge fns (google-calendar-events,
// monday-calendar-events, djep-calendar-events, booking-agent-rows,
// djep-event-lookup) with requireOperator(). Several dashboard widgets still
// called them via raw fetch() with the anon publishable key in the
// Authorization header — the anon JWT has no operator sub claim, so every
// call returned 403 not_an_operator and the UI rendered "not connected" /
// "no sources" even though the backend tokens were healthy.
//
// supabase.functions.invoke() auto-attaches the session JWT, but it doesn't
// support URL query params and changes response handling. This helper lets
// the existing fetch()-based call sites stay shape-compatible while picking
// up the signed-in operator's JWT.
//
// Returns the session access_token if signed in, else the anon publishable
// key as a fallback. The fallback only matters for calls to edge fns that
// don't require operator auth (e.g. google-calendar-oauth?action=start).

import { supabase } from "./client";

export async function operatorAuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token =
    data.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return `Bearer ${token}`;
}
