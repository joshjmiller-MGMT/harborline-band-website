// Shared helpers for the P317 instrument-hours track.
//
// Color tokens for the per-kind breakdown stat tile + heatmap legend. Re-uses
// Harborline's primary palette but assigns each kind a stable color so the
// breakdown tile reads at a glance.

export const TEN_K_HOURS_GOAL = 10000;

export type InstrumentKind = "gig" | "rehearsal" | "practice";

export const KIND_COLOR: Record<InstrumentKind, { bg: string; text: string; border: string }> = {
  gig:       { bg: "bg-primary",     text: "text-primary",     border: "border-primary/40" },
  rehearsal: { bg: "bg-orange-500",  text: "text-orange-500",  border: "border-orange-500/40" },
  practice:  { bg: "bg-blue-500",    text: "text-blue-500",    border: "border-blue-500/40" },
};

export const CONFIDENCE_TONE: Record<
  "high" | "medium" | "low",
  { bg: string; text: string }
> = {
  high:   { bg: "bg-green-500/15",  text: "text-green-500" },
  medium: { bg: "bg-amber-500/15",  text: "text-amber-500" },
  low:    { bg: "bg-red-500/15",    text: "text-red-500" },
};

export interface InstrumentClassification {
  id: string;
  gcal_event_id: string;
  gcal_account_email: string;
  gcal_calendar_id: string;
  event_title: string;
  event_description: string;
  event_color_id: string | null;
  event_start: string;
  event_end: string;
  block_hours: number;
  classified_as: InstrumentKind | "none" | "unsure";
  confidence: "high" | "medium" | "low";
  matched_rule_id: string | null;
  matched_rule_pattern: string | null;
  estimated_hours: number;
  estimation_source: string;
  review_status: "auto" | "needs-review" | "reviewed";
  reviewed_at: string | null;
  last_resampled_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ClassifierRule {
  id: string;
  kind: "band" | "keyword" | "venue" | "exclude";
  pattern: string;
  active: boolean;
  match_priority: number;
  classify_as: "gig" | "rehearsal" | "practice" | "none" | null;
  genre_hint: string | null;
  default_hours: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

// Aggregate estimated_hours per yyyy-mm-dd local-date key.
export function aggregateDailyHours(
  classifications: Pick<InstrumentClassification, "event_start" | "estimated_hours" | "classified_as">[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of classifications) {
    if (c.classified_as === "none" || c.classified_as === "unsure") continue;
    const d = new Date(c.event_start);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    map.set(key, (map.get(key) || 0) + Number(c.estimated_hours || 0));
  }
  return map;
}

export function totalByKind(
  classifications: Pick<InstrumentClassification, "estimated_hours" | "classified_as">[],
): Record<InstrumentKind, number> {
  const acc: Record<InstrumentKind, number> = { gig: 0, rehearsal: 0, practice: 0 };
  for (const c of classifications) {
    if (c.classified_as === "gig" || c.classified_as === "rehearsal" || c.classified_as === "practice") {
      acc[c.classified_as] += Number(c.estimated_hours || 0);
    }
  }
  return acc;
}

export function fmtHours(h: number): string {
  if (h < 10) return h.toFixed(1);
  return Math.round(h).toLocaleString();
}
