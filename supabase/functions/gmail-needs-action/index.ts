// Surfaces unread Gmail threads older than 3 days across every connected
// account that has the gmail.readonly scope, filtered to skip promotions/social/
// snoozed/spam/trash and "smart label personal" autoroutes, and dropping any
// thread whose latest sender looks like a noreply/notifications mailer.
// Returns per-account counts + top-3 expanded threads for the
// NeedsActionWidget on the dashboard.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Josh's spec 2026-05-12: substring match on the local part (no word-boundary),
// so "updates-noreply@linkedin.com" gets filtered too.
const NOREPLY_RE = /noreply@|notifications@|no-reply@|donotreply@/i;

const GMAIL_QUERY =
  "is:unread older_than:3d -category:promotions -category:social -label:^smartlabel_personal -in:snoozed -in:spam -in:trash";

async function ensureFreshToken(supabase: any, row: any): Promise<string> {
  const expiresAt = new Date(row.expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) return row.access_token;
  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const refreshed = await refreshRes.json();
  if (!refreshRes.ok) {
    const errMsg = `Refresh failed: ${JSON.stringify(refreshed)}`;
    await supabase
      .from("google_calendar_tokens")
      .update({
        needs_reconnect: true,
        last_refresh_error: errMsg,
        last_refresh_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    throw new Error(errMsg);
  }
  const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await supabase
    .from("google_calendar_tokens")
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpires,
      needs_reconnect: false,
      last_refresh_at: new Date().toISOString(),
      last_refresh_error: null,
    })
    .eq("id", row.id);
  return refreshed.access_token;
}

function ageDays(internalDateMs: number): number {
  const diffMs = Date.now() - internalDateMs;
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

function parseHeader(headers: any[], name: string): string {
  return headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

type ThreadEntry = {
  threadId: string;
  subject: string;
  sender: string;
  age_days: number;
  web_url: string;
};

type AccountResult = {
  email: string;
  count: number;
  top3: ThreadEntry[];
  error?: string;
  needsReconnect?: boolean;
};

async function fetchAccount(supabase: any, row: any): Promise<AccountResult> {
  try {
    const token = await ensureFreshToken(supabase, row);
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?` +
        new URLSearchParams({ q: GMAIL_QUERY, maxResults: "50" }),
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const list = await listRes.json();
    if (!listRes.ok) {
      return {
        email: row.account_email,
        count: 0,
        top3: [],
        error: list?.error?.message || `HTTP ${listRes.status}`,
      };
    }

    const messageStubs: { id: string; threadId: string }[] = list.messages || [];
    if (messageStubs.length === 0) {
      return { email: row.account_email, count: 0, top3: [] };
    }

    // Hydrate metadata for each message; filter out noreply senders. Group by
    // threadId so we count unique threads, not messages, and keep the OLDEST
    // unread message per thread to drive `age_days` (i.e. how long this has
    // been sitting).
    const hydrated = await Promise.all(
      messageStubs.map(async (m) => {
        const detRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!detRes.ok) return null;
        const det = await detRes.json();
        const headers = det.payload?.headers || [];
        const from = parseHeader(headers, "From");
        if (NOREPLY_RE.test(from)) return null;
        const internalDate = Number(det.internalDate || 0);
        return {
          threadId: det.threadId as string,
          subject: parseHeader(headers, "Subject") || "(no subject)",
          sender: from,
          internalDate,
        };
      }),
    );

    const byThread = new Map<string, { threadId: string; subject: string; sender: string; internalDate: number }>();
    for (const h of hydrated) {
      if (!h) continue;
      const existing = byThread.get(h.threadId);
      if (!existing || h.internalDate < existing.internalDate) {
        byThread.set(h.threadId, h);
      }
    }

    const threads = Array.from(byThread.values())
      .sort((a, b) => a.internalDate - b.internalDate); // oldest first = most overdue first

    const top3: ThreadEntry[] = threads.slice(0, 3).map((t) => ({
      threadId: t.threadId,
      subject: t.subject,
      sender: t.sender,
      age_days: ageDays(t.internalDate),
      web_url: `https://mail.google.com/mail/u/${encodeURIComponent(row.account_email)}/#inbox/${t.threadId}`,
    }));

    return { email: row.account_email, count: threads.length, top3 };
  } catch (err) {
    return {
      email: row.account_email,
      count: 0,
      top3: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: tokenRows } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .eq("gmail_scope_granted", true)
      .order("created_at", { ascending: true });

    if (!tokenRows?.length) {
      return new Response(
        JSON.stringify({ connected: false, accounts: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accounts = await Promise.all(tokenRows.map((row: any) => fetchAccount(supabase, row)));
    return new Response(
      JSON.stringify({ connected: true, accounts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
