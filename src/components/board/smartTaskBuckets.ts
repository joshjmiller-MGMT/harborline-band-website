import type { ScrumColumn } from "./ScrumBoard";

export const SMART_VENTURES = [
  "Harborline",
  "Economy",
  "JMJ",
  "Personal",
  "BSE",
  "Brand Studio",
] as const;
export type SmartVenture = (typeof SMART_VENTURES)[number];

export const DEFAULT_VENTURE: SmartVenture = "Personal";

export function normalizeVenture(v: string | null | undefined): SmartVenture {
  if (!v) return DEFAULT_VENTURE;
  return (SMART_VENTURES as readonly string[]).includes(v)
    ? (v as SmartVenture)
    : DEFAULT_VENTURE;
}

// "Trello inbox" sits in the columns list but is only populated by trello-poll
// output, not by smart_task_enrichments rows. Persisted board_bucket values
// are the four after it.
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

export const SMART_BUCKET_COLUMNS: ScrumColumn[] = [
  { id: "Trello inbox", title: "Trello inbox", accent: "text-amber-500" },
  { id: "Needs SMART", title: "Needs SMART", accent: "text-orange-400" },
  { id: "Pending approval", title: "Pending approval", accent: "text-sky-400" },
  { id: "Active", title: "Active (calendar)", accent: "text-emerald-400" },
  { id: "Done", title: "Done", accent: "text-muted-foreground" },
];

// One color per venture — color is processed faster than text, so the eye
// learns "purple = Economy" etc. without reading (kanban-swimlane best practice).
export const VENTURE_COLORS: Record<SmartVenture, string> = {
  Harborline: "bg-sky-500",
  Economy: "bg-violet-500",
  JMJ: "bg-amber-500",
  Personal: "bg-emerald-500",
  BSE: "bg-rose-500",
  "Brand Studio": "bg-fuchsia-500",
};
