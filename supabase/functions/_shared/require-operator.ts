// require-operator — shared auth gate for edge fns that read/write Josh's
// connected Google account data (P319 — closes P308 findings F2/F3/F4/F6).
//
// Usage (place AFTER the OPTIONS short-circuit, BEFORE any business logic):
//
//   const denial = await requireOperator(req);
//   if (denial) return denial;
//
// The Supabase platform verifies the JWT signature when verify_jwt=true is set
// on the function. This helper inspects the already-verified claims:
//   - `role: "service_role"` → trusted (cron-triggered fns hit edge fns with
//     the service-role JWT; trust them so internal callers keep working).
//   - `sub` claim must appear in OPERATOR_USER_IDS env var (comma-separated
//     Supabase Auth user UUIDs).
//   - Everything else → 401 / 403.
//
// Feature flag: ALLOW_ANON=true short-circuits the check entirely. Set during
// the P319 rollout to keep edge fns live while the frontend login wires in;
// flipped to false once Josh re-logs in via /team/login.
//
// Env:
//   ALLOW_ANON          — "true" to bypass the gate (rollout flag).
//   OPERATOR_USER_IDS   — comma-separated Supabase Auth user UUIDs.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function denial(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64UrlDecode(input: string): string {
  const pad = (4 - (input.length % 4)) % 4;
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(padded);
  return new TextDecoder().decode(
    Uint8Array.from(bin, (c) => c.charCodeAt(0)),
  );
}

export async function requireOperator(req: Request): Promise<Response | null> {
  const allowAnon = Deno.env.get("ALLOW_ANON") === "true";
  if (allowAnon) return null;

  const operatorIds = (Deno.env.get("OPERATOR_USER_IDS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const authHeader =
    req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return denial(401, { error: "unauthorized", reason: "missing_bearer" });
  }

  const token = authHeader.slice("bearer ".length).trim();
  let payload: { sub?: string; role?: string } = {};
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("malformed_jwt");
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch (_err) {
    return denial(401, { error: "unauthorized", reason: "jwt_decode_failed" });
  }

  // Service-role bypass: cron + internal callers use the service-role JWT.
  if (payload.role === "service_role") return null;

  if (!payload.sub || !operatorIds.includes(payload.sub)) {
    return denial(403, { error: "forbidden", reason: "not_an_operator" });
  }

  return null;
}
