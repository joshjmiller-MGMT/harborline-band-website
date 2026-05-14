// instrument-hours-scan — P317.
//
// Scans Josh's Google Calendars (every connected account) over a configurable
// look-back window, classifies each event as a gig / rehearsal / practice / none
// using rules from `instrument_classifier_rules`, estimates playing-hours using
// venue-and-color heuristics, and persists verdicts to `instrument_event_classifications`.
//
// Reuses `staffing-snapshot`'s GCal token+scan plumbing verbatim. The classifier is
// rule-driven (table-editable from the portal); estimation rules are baked into
// estimateHours() and described in
// `~/.claude/projects/-Users-joshmiller-Documents-Claude/memory/project_instrument_hours_estimation.md`.
//
// Caching: idempotent on (gcal_event_id, gcal_account_email). Rows with
// review_status='reviewed' are immune — re-running the scan won't overwrite Josh's
// manual classifications.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Color hints — green = gig (Basil/Sage from P11 staffing), orange = rehearsal
// (Tangerine, Josh's typical rehearsal color, unconfirmed first scan will validate).
const GREEN_COLOR_IDS = new Set(["10", "2"]);
const ORANGE_COLOR_IDS = new Set(["6"]);
// Tomato (11) = canceled; Flamingo (4) = personal/non-work. Both → instant exclude,
// regardless of what the title says. Higher precedence than any rule.
const EXCLUDE_COLOR_IDS = new Set(["11", "4"]);

interface Rule {
  id: string;
  kind: "band" | "keyword" | "venue" | "exclude" | "review";
  pattern: string;
  patternLower: string;
  active: boolean;
  match_priority: number;
  classify_as: "gig" | "rehearsal" | "practice" | "none" | null;
  genre_hint: string | null;
  default_hours: number | null;
  notes: string;
}

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
    })
    .eq("id", row.id);
  return refreshed.access_token;
}

interface ClassificationVerdict {
  classified_as: "gig" | "rehearsal" | "practice" | "none" | "unsure";
  confidence: "high" | "medium" | "low";
  matched_rule_id: string | null;
  matched_rule_pattern: string | null;
  estimated_hours: number;
  estimation_source: string;
}

function blockHoursOf(startISO: string, endISO: string): number {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round(((end - start) / 3_600_000) * 100) / 100;
}

// Classify a single event against the rule set. Rules are pre-sorted by priority desc.
function classify(
  title: string,
  description: string,
  colorId: string | null,
  blockHours: number,
  rules: Rule[],
): ClassificationVerdict {
  const haystack = `${title}\n${description}`.toLowerCase();

  // Pass 0 — color exclude. Tomato/Flamingo events drop out regardless of title.
  if (colorId && EXCLUDE_COLOR_IDS.has(colorId)) {
    return {
      classified_as: "none",
      confidence: "high",
      matched_rule_id: null,
      matched_rule_pattern: null,
      estimated_hours: 0,
      estimation_source: colorId === "11"
        ? "color=tomato — canceled"
        : "color=flamingo — personal/non-work",
    };
  }

  // Pass 0.5 — review rules. Recording-style events Josh wants flagged for the
  // human review queue rather than silently classified as 'none'. Fires BEFORE
  // exclude so "Show Debrief, Record Vox, go thru takes" surfaces to triage
  // instead of being silent-noned by the "debrief" exclude rule. (P323 +
  // feedback_classifier_review_queue.md 2026-05-14.) Hours seeded from the
  // block; Josh edits during triage.
  for (const r of rules) {
    if (r.kind !== "review" || !r.active) continue;
    if (haystack.includes(r.patternLower)) {
      return {
        classified_as: "unsure",
        confidence: "low",
        matched_rule_id: r.id,
        matched_rule_pattern: r.pattern,
        estimated_hours: blockHours,
        estimation_source: `flag-for-review: matched "${r.pattern}" — needs triage`,
      };
    }
  }

  // Pass 1 — exclude rules. Highest priority. Single match → 'none'.
  for (const r of rules) {
    if (r.kind !== "exclude" || !r.active) continue;
    if (haystack.includes(r.patternLower)) {
      return {
        classified_as: "none",
        confidence: "high",
        matched_rule_id: r.id,
        matched_rule_pattern: r.pattern,
        estimated_hours: 0,
        estimation_source: `excluded by rule "${r.pattern}"`,
      };
    }
  }

  // Pass 2 — find best band/keyword match (priority-sorted; first match in priority order wins).
  // Subtle rule: a rehearsal/practice keyword match TAKES PRECEDENCE over a band-genre
  // match. "Harborline rehearsal" matches both the Harborline band rule (priority 90)
  // and the "rehears" keyword (priority 80) — without this override, Harborline's
  // wedding genre wins and the event gets mis-classified as a 3hr wedding. The
  // keyword is the more specific signal about what Josh actually did at that slot.
  let primaryRule: Rule | null = null;
  let rehearsalOverride: Rule | null = null;
  const keywordMatches: Rule[] = [];
  for (const r of rules) {
    if (!r.active) continue;
    if (r.kind === "exclude") continue;
    if (!haystack.includes(r.patternLower)) continue;
    if (!primaryRule && r.classify_as) primaryRule = r;
    if (r.kind === "keyword") {
      keywordMatches.push(r);
      if (r.classify_as === "rehearsal" || r.classify_as === "practice") {
        if (!rehearsalOverride) rehearsalOverride = r;
      }
    }
  }
  if (rehearsalOverride) primaryRule = rehearsalOverride;

  // Pass 3 — green-color fallback only. Josh tags real performance events green
  // even when the band tag isn't in the rule whitelist (BSE sub-acts, one-off gigs).
  // Orange-color fallback removed 2026-05-13 first-scan — it was over-firing on
  // "Flex day" / "Weekly meeting" style events that Josh tags orange for other
  // reasons. Rehearsals MUST match a keyword now.
  if (!primaryRule) {
    if (colorId && GREEN_COLOR_IDS.has(colorId)) {
      return {
        classified_as: "gig",
        confidence: "low",
        matched_rule_id: null,
        matched_rule_pattern: null,
        estimated_hours: Math.min(blockHours, 3),
        estimation_source: "green-color fallback, no rule match — block capped at 3hr",
      };
    }
    return {
      classified_as: "none",
      confidence: "high",
      matched_rule_id: null,
      matched_rule_pattern: null,
      estimated_hours: 0,
      estimation_source: "no rule or color match",
    };
  }

  // Pass 4 — estimate hours from primary classification + venue/keyword extras.
  const classified = primaryRule.classify_as as "gig" | "rehearsal" | "practice";

  if (classified === "rehearsal" || classified === "practice") {
    // Rehearsals + practice slots: trust the block. No setup inflation.
    return {
      classified_as: classified,
      confidence: "high",
      matched_rule_id: primaryRule.id,
      matched_rule_pattern: primaryRule.pattern,
      estimated_hours: blockHours,
      estimation_source: `${classified} — trust block (${blockHours}hr)`,
    };
  }

  // Gigs — apply estimation heuristic.
  return estimateGigHours(title, description, blockHours, primaryRule, keywordMatches);
}

function estimateGigHours(
  title: string,
  description: string,
  blockHours: number,
  primaryRule: Rule,
  keywordMatches: Rule[],
): ClassificationVerdict {
  const haystack = `${title}\n${description}`.toLowerCase();
  const isWeddingGenre =
    primaryRule.genre_hint === "wedding" ||
    keywordMatches.some((r) => r.pattern === "wedding") ||
    /\bwedding\b/.test(haystack);

  // Parse explicit `playing: <N>hr` / `setup: <N>min` from description if Josh wrote them.
  // Format: line-by-line key/value, case-insensitive, accepts `Xhr` / `Xmin` / `X` minutes / `X` hours.
  const explicitPlaying = parseDurationHint(description, /\bplaying\s*[:=]\s*(\S+)/i);
  if (explicitPlaying !== null) {
    return {
      classified_as: "gig",
      confidence: "high",
      matched_rule_id: primaryRule.id,
      matched_rule_pattern: primaryRule.pattern,
      estimated_hours: explicitPlaying,
      estimation_source: `explicit "playing:" hint from description (${explicitPlaying}hr)`,
    };
  }

  // Wedding heuristic — additive math (Josh's choice 2026-05-13):
  // 3hr base playing + 1hr per ceremony/cocktail/reception keyword mentioned.
  if (isWeddingGenre) {
    let hours = 3;
    const extras: string[] = [];
    if (/\bceremony\b/.test(haystack)) { hours += 1; extras.push("ceremony"); }
    if (/\bcocktail\b/.test(haystack)) { hours += 1; extras.push("cocktail"); }
    // reception is the implied default in the 3hr base; the keyword rule has 1hr extra
    // available but we DON'T auto-add it (would overshoot every wedding). Tune later
    // if numbers feel low.
    return {
      classified_as: "gig",
      confidence: extras.length > 0 ? "high" : "medium",
      matched_rule_id: primaryRule.id,
      matched_rule_pattern: primaryRule.pattern,
      estimated_hours: hours,
      estimation_source: `wedding 3hr base${extras.length ? " + " + extras.join(" + ") + " +1hr each" : ""} (block was ${blockHours}hr)`,
    };
  }

  // Per-rule default_hours override (e.g. Economy gigs default 1.5hr).
  if (primaryRule.default_hours !== null && primaryRule.default_hours !== undefined) {
    return {
      classified_as: "gig",
      confidence: "high",
      matched_rule_id: primaryRule.id,
      matched_rule_pattern: primaryRule.pattern,
      estimated_hours: Number(primaryRule.default_hours),
      estimation_source: `rule default for "${primaryRule.pattern}" (${primaryRule.default_hours}hr)`,
    };
  }

  // Bar / club heuristic — small literal blocks (≤4hr) trusted; larger ones capped at 3hr
  // playing time (setup + breakdown baked in).
  if (blockHours <= 4) {
    return {
      classified_as: "gig",
      confidence: "high",
      matched_rule_id: primaryRule.id,
      matched_rule_pattern: primaryRule.pattern,
      estimated_hours: blockHours,
      estimation_source: `short block (${blockHours}hr) trusted as literal playing time`,
    };
  }

  // Long block, no override — surface to review queue.
  return {
    classified_as: "gig",
    confidence: "low",
    matched_rule_id: primaryRule.id,
    matched_rule_pattern: primaryRule.pattern,
    estimated_hours: 3,
    estimation_source: `long block (${blockHours}hr) — defaulted to 3hr playing, needs review (likely contains setup + breakdown)`,
  };
}

// Parse "<N>hr" / "<N> hours" / "<N>min" / "<N> minutes" / "<N>" hours.
function parseDurationHint(text: string, anchor: RegExp): number | null {
  const m = text.match(anchor);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  const numMatch = raw.match(/^([\d.]+)/);
  if (!numMatch) return null;
  const num = parseFloat(numMatch[1]);
  if (!Number.isFinite(num)) return null;
  if (/\bmin\b/.test(raw) || /\bm\b/.test(raw)) return Math.round((num / 60) * 100) / 100;
  return num; // default unit = hours
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ configured: false, connected: false, error: "Google OAuth not configured" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load active classifier rules (priority desc).
    const { data: ruleRows, error: ruleErr } = await supabase
      .from("instrument_classifier_rules")
      .select("*")
      .eq("active", true)
      .order("match_priority", { ascending: false });
    if (ruleErr) throw new Error(`Failed to load rules: ${ruleErr.message}`);
    const rules: Rule[] = (ruleRows || []).map((r: any) => ({
      ...r,
      patternLower: r.pattern.toLowerCase(),
    }));

    const { data: tokenRows } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .order("created_at", { ascending: true });

    if (!tokenRows || tokenRows.length === 0) {
      return new Response(
        JSON.stringify({ configured: true, connected: false, scanned: 0, classified: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Window — default 120 months (~10 years all-time). Body param overrides.
    // Default 240mo (~20 years) — Josh's GCal history goes back "literally forever";
    // let Google Calendar's own retention be the floor, not our cap.
    let monthsBack = 240;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body && typeof body.months_back === "number") {
          monthsBack = Math.max(1, Math.min(360, body.months_back));
        }
      } catch {
        // body optional
      }
    }

    const now = new Date();
    const timeMin = new Date(now.getTime() - monthsBack * 30 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Existing reviewed rows — skip these to preserve Josh's manual classifications.
    const { data: reviewedRows } = await supabase
      .from("instrument_event_classifications")
      .select("gcal_event_id, gcal_account_email")
      .eq("review_status", "reviewed");
    const reviewedKey = new Set(
      (reviewedRows || []).map((r: any) => `${r.gcal_account_email}::${r.gcal_event_id}`),
    );

    let totalScanned = 0;
    let totalClassified = 0;
    let totalSkippedReviewed = 0;
    const upserts: any[] = [];

    for (const row of tokenRows) {
      let token: string;
      try {
        token = await ensureFreshToken(supabase, row);
      } catch (e) {
        console.error(`Token refresh failed for ${row.account_email}: ${e}`);
        continue;
      }

      const calListRes = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const calList = await calListRes.json();
      if (!calListRes.ok) continue;
      const calendars = (calList.items || []).filter((c: any) => c.selected !== false);

      for (const cal of calendars) {
        // Page through events — GCal caps at 2500 per call so loop on nextPageToken.
        let pageToken: string | undefined;
        do {
          const params = new URLSearchParams({
            timeMin,
            timeMax,
            singleEvents: "true",
            orderBy: "startTime",
            maxResults: "2500",
          });
          if (pageToken) params.set("pageToken", pageToken);
          const evRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const ev = await evRes.json();
          if (!evRes.ok) break;

          for (const e of ev.items || []) {
            if (e.status === "cancelled") continue;
            if (!e.start?.dateTime || !e.end?.dateTime) continue; // skip all-day for now

            totalScanned++;
            const key = `${row.account_email}::${e.id}`;
            if (reviewedKey.has(key)) {
              totalSkippedReviewed++;
              continue;
            }

            const title = e.summary || "(no title)";
            const description = e.description || "";
            const colorId = e.colorId ? String(e.colorId) : null;
            const blockHours = blockHoursOf(e.start.dateTime, e.end.dateTime);

            const verdict = classify(title, description, colorId, blockHours, rules);

            // Skip persistence for 'none' verdicts to keep the table from filling
            // with every non-music calendar event Josh has ever had.
            if (verdict.classified_as === "none") continue;

            totalClassified++;
            upserts.push({
              gcal_event_id: e.id,
              gcal_account_email: row.account_email,
              gcal_calendar_id: cal.id,
              event_title: title.slice(0, 500),
              event_description: description.slice(0, 2000),
              event_color_id: colorId,
              event_start: e.start.dateTime,
              event_end: e.end.dateTime,
              block_hours: blockHours,
              classified_as: verdict.classified_as,
              confidence: verdict.confidence,
              matched_rule_id: verdict.matched_rule_id,
              matched_rule_pattern: verdict.matched_rule_pattern,
              estimated_hours: verdict.estimated_hours,
              estimation_source: verdict.estimation_source,
              review_status: verdict.confidence === "high" ? "auto" : "needs-review",
            });
          }
          pageToken = ev.nextPageToken;
        } while (pageToken);
      }
    }

    // Bulk-upsert in chunks (Postgrest has a payload limit; 500 rows at a time is safe).
    for (let i = 0; i < upserts.length; i += 500) {
      const chunk = upserts.slice(i, i + 500);
      const { error: upErr } = await supabase
        .from("instrument_event_classifications")
        .upsert(chunk, { onConflict: "gcal_event_id,gcal_account_email" });
      if (upErr) {
        console.error(`Upsert chunk ${i}-${i + chunk.length} failed: ${upErr.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        configured: true,
        connected: true,
        months_back: monthsBack,
        accounts: tokenRows.length,
        scanned: totalScanned,
        classified: totalClassified,
        skipped_reviewed: totalSkippedReviewed,
        persisted: upserts.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
