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

export type ColorLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

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
];

export const colorSpec = (level: number): ColorSpec => {
  const clamped = Math.max(0, Math.min(6, Math.round(level))) as ColorLevel;
  return COLOR_SCALE[clamped];
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
// recommendations from. Strings outside this map are technique-y (Chords, Scales,
// Technical, Patterns, Arrangements, Original, Rehearsal, Gigs, Other) and don't
// get recommendation auto-fill.
export const SEGMENT_CATEGORY_TO_KIND: Record<string, PracticeItemKind> = {
  Lines: "line",
  Songs: "song",
  Transcriptions: "transcription",
};

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
