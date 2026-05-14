import type { ScrumColumn } from "./ScrumBoard";

export const BOOKING_BUCKETS = [
  "Reach Out",
  "Awaiting Reply",
  "In Convo",
  "Followup 2",
  "Confirmed",
  "Done",
] as const;

export type BookingBucket = (typeof BOOKING_BUCKETS)[number];

export const BOOKING_BUCKET_COLUMNS: ScrumColumn[] = [
  { id: "Reach Out", title: "Reach Out", accent: "text-amber-500" },
  { id: "Awaiting Reply", title: "Awaiting Reply", accent: "text-orange-400" },
  { id: "In Convo", title: "In Convo", accent: "text-sky-400" },
  { id: "Followup 2", title: "Followup 2", accent: "text-violet-400" },
  { id: "Confirmed", title: "Confirmed", accent: "text-emerald-400" },
  { id: "Done", title: "Done", accent: "text-muted-foreground" },
];
