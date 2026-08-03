// The coaching engine (Josh's spec, 2026-08-02).
//
// THE LAW: suggest, never decide. Every function here returns a *proposal* with
// its reasoning attached. Josh picks. He was explicit — "I don't want you to
// choose for me. I would like you to present the option and then have a
// suggestion based on historical data."
//
// TIMING: suggestions surface when he ARRIVES at a section, not all up front
// (confirmed 8/2). So each section computes its own, independently.
//
// The goal in his words: "even coverage at a rising level of proficiency" — the
// app's job is to notice neglect and rotate him through it.

import { type PracticeItem, daysSincePracticed } from "./practice-mastery";

export interface HistoryRow {
  category: string;
  started_at: string;
  method_id: string | null;
  dim2_id: string | null;
  dim3_id: string | null;
  bpm: number | null;
  range_from: number | null;
  range_to: number | null;
  maintenance: boolean | null;
  keys_worked: string[] | null;
  what_practiced: string | null;
}

export interface Suggestion {
  /** One line, in Josh's terms. */
  text: string;
  /** Why — always shown, so a bad suggestion is visibly bad. */
  because: string;
  /** Pre-fill target when the suggestion names a specific item. */
  itemId?: string;
}

const MS_DAY = 86_400_000;
const daysAgo = (iso: string) => (Date.now() - new Date(iso).getTime()) / MS_DAY;

/** Colour ladder step names, used to phrase a transition suggestion. */
const LADDER: Record<number, string> = {
  0: "unrated", 1: "red", 2: "orange", 3: "yellow",
  4: "green", 5: "blue", 6: "purple", 7: "pink",
};

/**
 * Lines and Songs: move ONE item up through each colour transition per session.
 * Josh flagged the delicate case explicitly — a line moved red→orange last
 * session "is in a really delicate state" and should be pushed on to yellow
 * before it slides back. So recently-promoted items outrank merely-stale ones.
 */
export function suggestItem(items: PracticeItem[]): Suggestion | null {
  const live = items.filter((i) => !i.archived_at);
  if (!live.length) return null;

  const recentlyPromoted = live
    .filter((i) => i.color_level > 0 && i.color_level < 7 && i.color_level_updated_at)
    .filter((i) => daysAgo(i.color_level_updated_at as string) <= 14)
    .sort((a, b) =>
      daysAgo(a.color_level_updated_at as string) - daysAgo(b.color_level_updated_at as string));

  if (recentlyPromoted.length) {
    const it = recentlyPromoted[0];
    const d = Math.round(daysAgo(it.color_level_updated_at as string));
    return {
      text: `Push ${it.title} from ${LADDER[it.color_level]} to ${LADDER[it.color_level + 1]}`,
      because: `You moved it up ${d === 0 ? "today" : `${d}d ago`} — it's still delicate, so it's the cheapest one to advance.`,
      itemId: it.id,
    };
  }

  // Otherwise the oldest low-colour item: neglect first, difficulty second.
  const stale = [...live]
    .filter((i) => i.color_level < 7)
    .sort((a, b) => {
      const ga = (7 - Math.max(1, a.color_level)) * daysSincePracticed(a);
      const gb = (7 - Math.max(1, b.color_level)) * daysSincePracticed(b);
      return gb - ga;
    })[0];
  if (!stale) return null;
  const never = !stale.last_practiced_at;
  return {
    text: `${stale.title} — ${LADDER[stale.color_level]} to ${LADDER[stale.color_level + 1]}`,
    because: never
      ? "Never logged. Unrated lines are the ones you haven't learned yet."
      : `Last touched ${Math.round(daysSincePracticed(stale))}d ago at ${LADDER[stale.color_level]}.`,
    itemId: stale.id,
  };
}

/**
 * Anything chosen from a fixed vocabulary (parent scales, chord qualities,
 * methods): suggest whatever has gone longest without being picked. Options are
 * passed in already scoped to the section, so this never crosses columns.
 */
export function suggestNeglected(
  options: Array<{ id: string; label: string }>,
  history: HistoryRow[],
  field: "method_id" | "dim2_id" | "dim3_id",
  noun: string,
): Suggestion | null {
  if (!options.length) return null;
  const lastSeen = new Map<string, number>();
  for (const h of history) {
    const id = h[field];
    if (!id) continue;
    const d = daysAgo(h.started_at);
    if (!lastSeen.has(id) || d < (lastSeen.get(id) as number)) lastSeen.set(id, d);
  }
  const never = options.filter((o) => !lastSeen.has(o.id));
  if (never.length) {
    return {
      text: `Try ${never[0].label}`,
      because: `No ${noun} logged for it yet — this is the gap in your coverage.`,
    };
  }
  const oldest = [...options].sort(
    (a, b) => (lastSeen.get(b.id) ?? 0) - (lastSeen.get(a.id) ?? 0))[0];
  return {
    text: `Try ${oldest.label}`,
    because: `Longest gap — ${Math.round(lastSeen.get(oldest.id) as number)}d since you last did it.`,
  };
}

/**
 * Patterns: Josh stays in a band and pushes it over time (110-130 one day,
 * 120-140 the next). Suggest the next window up from wherever he last was.
 */
export function suggestPatternRange(history: HistoryRow[]): Suggestion | null {
  const ranges = history
    .filter((h) => h.category?.startsWith("Patter") && h.range_from != null)
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  if (!ranges.length) return null;
  const last = ranges[0];
  const from = last.range_from as number;
  const to = last.range_to ?? from;
  const width = Math.max(4, to - from);
  return {
    text: `Next window: ${to + 1}-${to + 1 + width}`,
    because: `Last time you worked ${from}-${to}. Same width, moved up.`,
  };
}

/**
 * Keys: the app should push him OFF his defaults. He admitted the recurring
 * (C, Eb, F#, A) groups are "a flaw in my practice that I tend to gravitate
 * towards those keys first" — so suggest the least-covered centres.
 */
export function suggestKeys(history: HistoryRow[], count = 4): Suggestion | null {
  const ALL = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const seen = new Map<string, number>();
  for (const h of history) {
    for (const k of h.keys_worked ?? []) seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  if (!seen.size) return null;
  const ranked = ALL.map((k) => ({ k, n: seen.get(k) ?? 0 })).sort((a, b) => a.n - b.n);
  const picks = ranked.slice(0, count);
  if (picks.every((p) => p.n === ranked[ranked.length - 1].n)) return null; // already even
  return {
    text: `Keys: ${picks.map((p) => p.k).join(", ")}`,
    because: `Your least-covered centres. ${picks.filter((p) => p.n === 0).length
      ? `${picks.filter((p) => p.n === 0).length} of them you've never logged.`
      : "Evens out the coverage."}`,
  };
}
