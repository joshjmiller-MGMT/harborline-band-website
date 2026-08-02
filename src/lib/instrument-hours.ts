// Shared helpers for the P317 instrument-hours track.
//
// Color tokens for the per-kind breakdown stat tile + heatmap legend. Re-uses
// Harborline's primary palette but assigns each kind a stable color so the
// breakdown tile reads at a glance.

export const TEN_K_HOURS_GOAL = 10000;

// Josh 8/2: teaching, music directing and arranging are real hours toward the
// 10,000. They get their own kinds rather than being folded into playing time.
export type InstrumentKind = "gig" | "rehearsal" | "practice" | "teaching" | "md" | "arranging";

export const KIND_ORDER: InstrumentKind[] = ["gig", "rehearsal", "practice", "teaching", "md", "arranging"];

export const KIND_LABEL: Record<InstrumentKind, string> = {
  gig: "Gigs",
  rehearsal: "Rehearsals",
  practice: "Practice",
  teaching: "Teaching",
  md: "MD",
  arranging: "Arranging",
};

export const KIND_COLOR: Record<InstrumentKind, { bg: string; text: string; border: string }> = {
  gig:       { bg: "bg-primary",     text: "text-primary",     border: "border-primary/40" },
  rehearsal: { bg: "bg-orange-500",  text: "text-orange-500",  border: "border-orange-500/40" },
  practice:  { bg: "bg-accent",      text: "text-accent",      border: "border-accent/40" },
  teaching:  { bg: "bg-emerald-500", text: "text-emerald-500", border: "border-emerald-500/40" },
  md:        { bg: "bg-sky-500",     text: "text-sky-500",     border: "border-sky-500/40" },
  arranging: { bg: "bg-pink-500",    text: "text-pink-500",    border: "border-pink-500/40" },
};

// Heat ramps per kind, so a square's COLOUR says what kind of work it was and
// its INTENSITY says how many hours. Tailwind needs whole class names present
// in the source to keep them, hence the literal table.
export const KIND_HEAT: Record<InstrumentKind, string[]> = {
  gig:       ["bg-primary/25",     "bg-primary/50",     "bg-primary/75",     "bg-primary"],
  rehearsal: ["bg-orange-500/25",  "bg-orange-500/50",  "bg-orange-500/75",  "bg-orange-500"],
  practice:  ["bg-accent/25",      "bg-accent/50",      "bg-accent/75",      "bg-accent"],
  teaching:  ["bg-emerald-500/25", "bg-emerald-500/50", "bg-emerald-500/75", "bg-emerald-500"],
  md:        ["bg-sky-500/25",     "bg-sky-500/50",     "bg-sky-500/75",     "bg-sky-500"],
  arranging: ["bg-pink-500/25",    "bg-pink-500/50",    "bg-pink-500/75",    "bg-pink-500"],
};

/** Hours per day per kind, so a day can be coloured by what dominated it. */
export function aggregateDailyByKind(
  rows: Pick<InstrumentClassification, "event_start" | "estimated_hours" | "classified_as">[],
): Map<string, Partial<Record<InstrumentKind, number>>> {
  const map = new Map<string, Partial<Record<InstrumentKind, number>>>();
  for (const c of rows) {
    if (!KIND_ORDER.includes(c.classified_as as InstrumentKind)) continue;
    const k = c.classified_as as InstrumentKind;
    const d = new Date(c.event_start);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const day = map.get(key) || {};
    day[k] = (day[k] || 0) + Number(c.estimated_hours || 0);
    map.set(key, day);
  }
  return map;
}

/** Which kind owned the most hours that day — decides the square's colour. */
export function dominantKind(day: Partial<Record<InstrumentKind, number>>): InstrumentKind | null {
  let best: InstrumentKind | null = null;
  let bestHours = 0;
  for (const k of KIND_ORDER) {
    const h = day[k] || 0;
    if (h > bestHours) { bestHours = h; best = k; }
  }
  return best;
}

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
  const acc = Object.fromEntries(KIND_ORDER.map((k) => [k, 0])) as Record<InstrumentKind, number>;
  for (const c of classifications) {
    if (KIND_ORDER.includes(c.classified_as as InstrumentKind)) {
      acc[c.classified_as as InstrumentKind] += Number(c.estimated_hours || 0);
    }
  }
  return acc;
}

export function fmtHours(h: number): string {
  if (h < 10) return h.toFixed(1);
  return Math.round(h).toLocaleString();
}
