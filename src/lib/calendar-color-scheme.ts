// Canonical calendar color scheme — Josh's 2026-06-22 scheme (single source of
// truth for the frontend). The edge-fn classifier side (instrument-hours-scan /
// staffing-snapshot / staffing-color-write) was wired to this same mapping in
// PR #144; this module keeps the UI legend + dashboard alerts in lockstep.
//
// Spec: wiki/harborline/calendar-color-system-2026-06-21.md
// Color now encodes event nature + gig staffing state (acts are routed to their
// own calendars, so color is free for this).

export type CalendarColorEntry = {
  colorId: string;
  name: string; // Google Calendar color name
  hex: string; // Google's swatch hex (matches GOOGLE_EVENT_COLORS in UnifiedCalendarWidget)
  label: string; // short UI label
  meaning: string; // one-line meaning
  countsHours: boolean; // does instrument-hours-scan count it (mirrors #144)
};

// Lifecycle order: hold → needs-staffing → gig(staffed); then the non-gig kinds.
export const CALENDAR_COLOR_SCHEME: CalendarColorEntry[] = [
  { colorId: "5", name: "Banana", hex: "#f6c026", label: "Hold", meaning: "Gig hold — tentative, not yet confirmed", countsHours: false },
  { colorId: "11", name: "Tomato", hex: "#d60000", label: "Needs staffing", meaning: "Confirmed gig that still needs staff (partial or none)", countsHours: false },
  { colorId: "2", name: "Sage", hex: "#33b679", label: "Gig", meaning: "Confirmed + staffed — ready to play", countsHours: true },
  { colorId: "10", name: "Basil", hex: "#0b8043", label: "Warehouse / admin", meaning: "Warehouse + BSE-related non-gig work", countsHours: false },
  { colorId: "9", name: "Blueberry", hex: "#3f51b5", label: "Rehearsal", meaning: "Rehearsal", countsHours: true },
  { colorId: "3", name: "Grape", hex: "#8e24aa", label: "Personal / dev", meaning: "Personal or development work", countsHours: false },
  { colorId: "4", name: "Flamingo", hex: "#e67c73", label: "Fun", meaning: "Fun / vacations / things with Shina", countsHours: false },
  { colorId: "8", name: "Graphite", hex: "#616161", label: "Canceled", meaning: "Canceled — kept as a record, excluded everywhere", countsHours: false },
];

// Named ids the dashboard alerts + filters key off of.
export const HOLD_COLOR_ID = "5"; // Banana — needs a confirm follow-up
export const NEEDS_STAFFING_COLOR_ID = "11"; // Tomato — confirmed, needs staff
export const GIG_COLOR_ID = "2"; // Sage — confirmed + staffed
export const WAREHOUSE_COLOR_ID = "10"; // Basil
export const REHEARSAL_COLOR_ID = "9"; // Blueberry
export const CANCELED_COLOR_ID = "8"; // Graphite

export function colorEntry(colorId: string | null | undefined): CalendarColorEntry | undefined {
  if (!colorId) return undefined;
  return CALENDAR_COLOR_SCHEME.find((c) => c.colorId === colorId);
}
