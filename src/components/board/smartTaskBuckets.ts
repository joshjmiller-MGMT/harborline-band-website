export const SMART_VENTURES = [
  "Harborline",
  "Economy",
  "JJM",
  "Personal",
  "BSE",
  "Brand Studio",
] as const;
export type SmartVenture = (typeof SMART_VENTURES)[number];

export const DEFAULT_VENTURE: SmartVenture = "Personal";

// Legacy tokens from before the 2026-08 JJM rebrand (Josh Miller Jazz → Joshua
// J Miller). Old rows/writers may still say "JMJ"; map them forward, never drop.
const LEGACY_VENTURE_MAP: Record<string, SmartVenture> = {
  JMJ: "JJM",
};

export function normalizeVenture(v: string | null | undefined): SmartVenture {
  if (!v) return DEFAULT_VENTURE;
  if (LEGACY_VENTURE_MAP[v]) return LEGACY_VENTURE_MAP[v];
  return (SMART_VENTURES as readonly string[]).includes(v)
    ? (v as SmartVenture)
    : DEFAULT_VENTURE;
}

// "Trello inbox" is derived from trello-poll output only — it is never
// persisted to board_bucket (see PERSISTABLE_SMART_BUCKETS below).
export const SMART_BUCKETS = [
  "Trello inbox",
  "Needs SMART",
  "Pending approval",
  "Active",
  "Done",
] as const;
export type SmartBucket = (typeof SMART_BUCKETS)[number];

// Buckets that can be persisted to board_bucket on smart_task_enrichments.
export const PERSISTABLE_SMART_BUCKETS = [
  "Needs SMART",
  "Pending approval",
  "Active",
  "Done",
] as const;
export type PersistableSmartBucket = (typeof PERSISTABLE_SMART_BUCKETS)[number];

// One color per venture — color is processed faster than text, so the eye
// learns "purple = Economy" etc. without reading (kanban-swimlane best practice).
export const VENTURE_COLORS: Record<SmartVenture, string> = {
  Harborline: "bg-primary",
  Economy: "bg-accent",
  JJM: "bg-amber-500",
  Personal: "bg-emerald-500",
  BSE: "bg-rose-500",
  "Brand Studio": "bg-fuchsia-500",
};
