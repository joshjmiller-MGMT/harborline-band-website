// Shared helpers for the P315 mastery color system.
//
// The six-color competency ladder Josh uses mentally:
//   1 red    — played once
//   2 orange — practiced through all 12 keys slowly
//   3 yellow — practiced through all 12 keys decently
//   4 green  — practiced through all 12 keys well in both hands
//   5 blue   — used in songs
//   6 purple — fully internalized / memorized
//   0        — unrated
//
// Recommendation score = (7 − max(1, color_level)) × daysSinceLastPracticed.
// Reds-that-are-old bubble to the top; purples-just-done sink. Unrated items
// (color 0) get treated as red-equivalent so newly-added stuff surfaces.

// Level 7 (pink) added 2026-08-02 per Josh: beyond "internalized" there's a
// further state — lines pulled out of it, sometimes the whole transcription
// taken through 12 keys. Mastery-memorization.
export type ColorLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type PracticeItemKind =
  | "song"
  | "line"
  | "voicing"
  | "chord"
  | "transcription"
  | "VA"
  | "device"
  | "technique"
  | "other";

export interface PracticeItem {
  id: string;
  kind: PracticeItemKind;
  title: string;
  artist: string;
  key: string;
  notes: string;
  color_level: number;
  /** Extra roles beyond kind: ca, chord_movement, lh_device, rh_device, technique… */
  roles?: string[] | null;
  color_level_updated_at: string | null;
  last_practiced_at: string | null;
  times_practiced: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ColorSpec {
  level: ColorLevel;
  name: string;
  meaning: string;
  // Tailwind class tokens. Kept here so widgets stay consistent.
  swatchBg: string;
  swatchRing: string;
  badgeBg: string;
  badgeText: string;
  borderTint: string;
}

export const COLOR_SCALE: ColorSpec[] = [
  {
    level: 0,
    name: "unrated",
    meaning: "no rating yet",
    swatchBg: "bg-muted-foreground/20",
    swatchRing: "ring-muted-foreground/40",
    badgeBg: "bg-muted",
    badgeText: "text-muted-foreground",
    borderTint: "border-muted",
  },
  {
    level: 1,
    name: "red",
    meaning: "played once",
    swatchBg: "bg-red-500",
    swatchRing: "ring-red-500/60",
    badgeBg: "bg-red-500/15",
    badgeText: "text-red-500",
    borderTint: "border-red-500/40",
  },
  {
    level: 2,
    name: "orange",
    meaning: "12-keyed slowly",
    swatchBg: "bg-orange-500",
    swatchRing: "ring-orange-500/60",
    badgeBg: "bg-orange-500/15",
    badgeText: "text-orange-500",
    borderTint: "border-orange-500/40",
  },
  {
    level: 3,
    name: "yellow",
    meaning: "12-keyed decently",
    swatchBg: "bg-yellow-400",
    swatchRing: "ring-yellow-400/60",
    badgeBg: "bg-yellow-400/15",
    badgeText: "text-yellow-500",
    borderTint: "border-yellow-400/40",
  },
  {
    level: 4,
    name: "green",
    meaning: "12-keyed well, both hands",
    swatchBg: "bg-green-500",
    swatchRing: "ring-green-500/60",
    badgeBg: "bg-green-500/15",
    badgeText: "text-green-500",
    borderTint: "border-green-500/40",
  },
  {
    level: 5,
    name: "blue",
    meaning: "used in songs",
    swatchBg: "bg-blue-500",
    swatchRing: "ring-blue-500/60",
    badgeBg: "bg-blue-500/15",
    badgeText: "text-blue-500",
    borderTint: "border-blue-500/40",
  },
  {
    level: 6,
    name: "purple",
    meaning: "fully internalized",
    swatchBg: "bg-purple-500",
    swatchRing: "ring-purple-500/60",
    badgeBg: "bg-purple-500/15",
    badgeText: "text-purple-500",
    borderTint: "border-purple-500/40",
  },
  {
    level: 7,
    name: "pink",
    meaning: "mastery — lines pulled out, 12-keyed",
    swatchBg: "bg-pink-500",
    swatchRing: "ring-pink-500/60",
    badgeBg: "bg-pink-500/15",
    badgeText: "text-pink-500",
    borderTint: "border-pink-500/40",
  },
];

export const colorSpec = (level: number): ColorSpec => {
  const clamped = Math.max(0, Math.min(7, Math.round(level))) as ColorLevel;
  return COLOR_SCALE[clamped];
};

// The SAME colours mean different things per item kind (Josh 8/2). The base
// COLOR_SCALE wording is line-flavoured; songs and transcriptions have their
// own ladders in his words. Canonical: wiki/harborline/practice-system-canonical-2026-08.md
export const MEANINGS_BY_KIND: Record<string, Record<number, string>> = {
  song: {
    0: "no rating yet",
    1: "don't know it at all",
    2: "have to read it",
    3: "only read it for the melody",
    4: "know it, memorized",
    5: "know it well enough to play in other keys",
    6: "know it so well I have my own arrangement",
    7: "mastery — fully my own",
  },
  transcription: {
    0: "no rating yet",
    1: "haven't started — have it somewhere",
    2: "know it somewhat; can sing along to most",
    3: "can sing the whole thing, played through it",
    4: "can play it, but reading",
    5: "memorized, performable at concert tempo",
    // Josh 8/2, final: purple is identifying and EXTRACTING the lines; pink is
    // taking the transcription ITSELF through 12 keys (or a decent portion).
    6: "identified the lines and pulled them out",
    7: "12-keyed the transcription itself, or a good portion of it",
  },
};

/** Colour spec with the wording for this item kind (falls back to the line scale). */
export const colorSpecFor = (kind: string, level: number): ColorSpec => {
  const base = colorSpec(level);
  const m = MEANINGS_BY_KIND[kind]?.[base.level];
  return m ? { ...base, meaning: m } : base;
};

export const KIND_LABELS: Record<PracticeItemKind, string> = {
  song: "Song",
  line: "Line",
  voicing: "Voicing",
  chord: "Chord",
  transcription: "Transcription",
  VA: "VA",
  device: "Device",
  technique: "Technique",
  other: "Other",
};

export const KIND_OPTIONS: PracticeItemKind[] = [
  "song",
  "line",
  "voicing",
  "chord",
  "transcription",
  "VA",
  "device",
  "technique",
  "other",
];

// Category strings used by PracticeTimerWidget segments → kind we should pull
// recommendations + datalist suggestions from. Strings outside this map (Rehearsal,
// Gigs, Other) are free-text contexts and don't filter — they show every item.
// Originals are songs you wrote; Arrangements falls into the `other` bucket until
// it earns its own kind.
export const SEGMENT_CATEGORY_TO_KIND: Record<string, PracticeItemKind> = {
  Chords: "chord",
  Scales: "technique",
  Technical: "technique",
  Patterns: "device",
  Lines: "line",
  Songs: "song",
  Transcriptions: "transcription",
  Arrangements: "other",
  Original: "song",
};

// ── Section pools (Josh 2026-08-03) ────────────────────────────────────────
// "What to practice" suggestions must match the section you're IN. Scales
// suggests scale work, Chords suggests the chordal EXERCISES (Barry chord
// exercise / Bill / 4ths — method-level work), and the numbered movements
// (Barry movements, CAs, diads, VAs) belong to the advanced-chordal pool that
// surfaces in Misc/Other/Combinations — never in Chords.
const MOVEMENT_ROLES = new Set(["ca", "chord_movement"]);

export const isMovementItem = (it: Pick<PracticeItem, "kind" | "roles">): boolean =>
  it.kind === "VA" || (it.roles ?? []).some((r) => MOVEMENT_ROLES.has(r));

/**
 * The named-item pool for a session section. Returns null when the section
 * takes no item suggestions at all (its suggestions are method-level and come
 * from the coach instead — e.g. Scales).
 */
export function sectionPool(items: PracticeItem[], category: string): PracticeItem[] | null {
  switch (category) {
    case "Chords":
      // Method-level chord work only. Movements are Misc's business.
      return items.filter((it) => it.kind === "chord" && !isMovementItem(it));
    case "Scales":
      // Scale exercises are methods (Belzer, parent scales) — no named items.
      return null;
    case "Technical":
    case "Technique":
      return items.filter((it) => it.kind === "technique" && !isMovementItem(it));
    case "Misc":
    case "Miscellaneous":
    case "Other":
    case "Combinations":
      // The advanced-chordal pool: numbered movements, CAs, VAs, diads.
      return items.filter(isMovementItem);
    case "Arrangements":
      // Arrangements ARE the CAs.
      return items.filter((it) => (it.roles ?? []).includes("ca"));
    default: {
      const kind = SEGMENT_CATEGORY_TO_KIND[category];
      if (!kind) return null;
      return items.filter((it) => it.kind === kind && !isMovementItem(it));
    }
  }
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const NEVER_PRACTICED_DAYS_FLOOR = 30;

export function daysSincePracticed(item: Pick<PracticeItem, "last_practiced_at">, now = Date.now()): number {
  if (!item.last_practiced_at) return NEVER_PRACTICED_DAYS_FLOOR;
  const t = new Date(item.last_practiced_at).getTime();
  if (!Number.isFinite(t)) return NEVER_PRACTICED_DAYS_FLOOR;
  return Math.max(0, (now - t) / MS_PER_DAY);
}

export function recommendationScore(item: PracticeItem, now = Date.now()): number {
  // Treat unrated (0) as red-equivalent so newly-added stuff still surfaces.
  const effective = item.color_level === 0 ? 1 : item.color_level;
  return (7 - effective) * daysSincePracticed(item, now);
}

export function recommendItems(
  items: PracticeItem[],
  opts: { kind?: PracticeItemKind; count?: number; now?: number } = {}
): PracticeItem[] {
  const { kind, count = 3, now = Date.now() } = opts;
  return items
    .filter((it) => !it.archived_at)
    .filter((it) => (kind ? it.kind === kind : true))
    .map((it) => ({ item: it, score: recommendationScore(it, now) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ item }) => item);
}
