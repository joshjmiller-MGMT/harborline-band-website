// djep-event-lookup — Cut 5 (Layer 7 of v2 architecture).
//
// Find a DJEP event record by name + date. Strategy: filter the djep_events_cache
// table populated by djep-calendar-events. The calendar function already pulls
// Josh's complete SALES-MILLER event list every hour via Firecrawl scrape; we
// just query that cache rather than re-running the (expensive) scrape per
// lookup. If the cache is empty or stale, we trigger a refresh first.
//
// Returns the matched event(s) in a shape consumable by ingest-event's djep-scrape
// route — name, ISO date, and the field rows DJEP exposes for the event.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CACHE_KEY = "djep:sales-miller";

type DjepEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  source: "djep";
  sourceLabel: string;
  color: string;
  fields: { label: string; value: string }[];
  itemUrl: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9& ]/g, "")
    .trim();
}

function parseDateToISO(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

function scoreEventMatch(
  event: DjepEvent,
  nameTokens: string[],
  isoDate: string | null,
): number {
  const eventTitle = normalize(event.title);
  let nameScore = 0;
  for (const tok of nameTokens) {
    if (eventTitle.includes(tok)) nameScore += 1;
  }
  const nameRatio = nameTokens.length === 0 ? 0 : nameScore / nameTokens.length;

  let dateScore = 0;
  if (isoDate) {
    const eventIso = parseDateToISO(event.start);
    if (eventIso === isoDate) dateScore = 1;
  }

  // Date is the stronger signal; weight 0.6 to date, 0.4 to name overlap.
  return dateScore * 0.6 + nameRatio * 0.4;
}

async function maybeRefreshCache(supabase: ReturnType<typeof createClient>): Promise<void> {
  const { data } = await supabase
    .from("djep_events_cache")
    .select("expires_at")
    .eq("cache_key", CACHE_KEY)
    .maybeSingle();
  const expiresAt = (data as { expires_at?: string } | null)?.expires_at;
  if (expiresAt && new Date(expiresAt).getTime() > Date.now()) return;

  // Trigger djep-calendar-events refresh (fire-and-forget; this function
  // can still serve a stale-cache hit if the refresh hasn't completed).
  await fetch(`${SUPABASE_URL}/functions/v1/djep-calendar-events?refresh=1`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  }).catch(() => undefined);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const date = typeof body?.date === "string" ? body.date.trim() : "";
    if (!name) return jsonResponse({ error: "name required" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    await maybeRefreshCache(supabase);

    const { data, error } = await supabase
      .from("djep_events_cache")
      .select("events, refreshed_at")
      .eq("cache_key", CACHE_KEY)
      .maybeSingle();
    if (error) throw new Error(`cache read failed: ${error.message}`);

    const events = ((data as { events?: DjepEvent[] } | null)?.events) ?? [];
    if (events.length === 0) {
      return jsonResponse({
        matches: [],
        total_in_cache: 0,
        cache_refreshed_at: (data as { refreshed_at?: string } | null)?.refreshed_at ?? null,
        note: "DJEP cache is empty. The djep-calendar-events function may need to run successfully first.",
      });
    }

    const nameTokens = normalize(name).split(" ").filter((t) => t.length >= 2);
    const isoDate = parseDateToISO(date);

    const scored = events
      .map((e) => ({ event: e, score: scoreEventMatch(e, nameTokens, isoDate) }))
      .filter((r) => r.score >= 0.4)
      .sort((a, b) => b.score - a.score);

    const matches = scored.slice(0, 10).map(({ event, score }) => ({
      djep_id: event.id,
      title: event.title,
      event_date: parseDateToISO(event.start),
      fields: event.fields,
      source_url: event.itemUrl,
      match_score: Number(score.toFixed(2)),
    }));

    return jsonResponse({
      matches,
      total_in_cache: events.length,
      cache_refreshed_at: (data as { refreshed_at?: string } | null)?.refreshed_at ?? null,
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
