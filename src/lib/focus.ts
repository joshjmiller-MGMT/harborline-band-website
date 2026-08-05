// Focus layer — the ADD-support helpers Josh approved on 2026-07-21 (review
// card ab338385, resolution "Build all 5"): (1) a "just one thing" next action,
// (2) a visible 25/5 timer, (3) a soft WIP cap on Active, (4) aging heat on
// cards, (5) a completion micro-celebration. Capture-anywhere was already live.
//
// The rules live here as pure functions so the dashboard widget and the SMART
// board agree on what "next" and "stale" mean, and so both are testable without
// a browser.

/** Soft cap on the Active stage. Soft on purpose — it warns, it never blocks. */
export const FOCUS_WIP_CAP = 5;

/** Classic timeboxing split, in seconds. */
export const POMODORO = { work: 25 * 60, break: 5 * 60 } as const;

/** Whole days between a timestamp and now. Never negative. */
export function ageDays(createdAt: string, now: number = Date.now()): number {
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

export type HeatTier = "fresh" | "warm" | "hot" | "stale";

/**
 * Aging heat: the longer a card sits, the warmer it reads. Fights
 * out-of-sight-out-of-mind by making age visible instead of buried in a
 * timestamp nobody scans.
 */
export function heatTier(days: number): HeatTier {
  if (days >= 14) return "stale";
  if (days >= 7) return "hot";
  if (days >= 3) return "warm";
  return "fresh";
}

/** Tailwind classes per tier. Fresh renders unmarked — no noise for new cards. */
export const HEAT_STYLE: Record<HeatTier, { dot: string; text: string }> = {
  fresh: { dot: "bg-transparent", text: "text-muted-foreground" },
  warm: { dot: "bg-amber-500/60", text: "text-amber-400" },
  hot: { dot: "bg-orange-500/70", text: "text-orange-400" },
  stale: { dot: "bg-rose-500/80", text: "text-rose-400" },
};

/** "12d" / "3d" — compact enough to sit inline on a board row. */
export function heatLabel(days: number): string {
  return `${days}d`;
}

export type FocusCandidate = {
  id: string;
  due_date: string | null;
  created_at: string;
};

/**
 * The one thing. Dated work outranks undated work (urgency salience), soonest
 * due first so anything overdue floats to the top; among undated cards the
 * oldest wins, which is the same signal aging heat shows on the board.
 */
export function sortByFocusPriority<T extends FocusCandidate>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const da = a.due_date ? Date.parse(a.due_date) : Infinity;
    const db = b.due_date ? Date.parse(b.due_date) : Infinity;
    if (da !== db) return da - db;
    return Date.parse(a.created_at) - Date.parse(b.created_at);
  });
}

export function pickNextFocus<T extends FocusCandidate>(rows: T[]): T | null {
  return sortByFocusPriority(rows)[0] ?? null;
}

/** mm:ss for the visible timer. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** One line of praise per completion, cycled so it does not go stale. */
const CHEERS = ["Done.", "That's one.", "Cleared.", "Off the board.", "Next."];
export function cheer(n: number): string {
  return CHEERS[Math.abs(n) % CHEERS.length];
}
