import { CALENDAR_COLOR_SCHEME } from "@/lib/calendar-color-scheme";

/**
 * Compact legend for Josh's calendar color scheme (2026-06-22). Renders the
 * color → meaning mapping so the calendar + staffing widgets are self-documenting.
 * Pure presentational; reads the canonical scheme from calendar-color-scheme.ts.
 *
 * Pass `colorIds` to show only a subset (in scheme order) — e.g. the staffing
 * widget shows just the 3 staffing-status colors, not the whole calendar scheme.
 */
export function CalendarColorLegend({
  className = "",
  colorIds,
}: {
  className?: string;
  colorIds?: string[];
}) {
  const entries = colorIds
    ? CALENDAR_COLOR_SCHEME.filter((c) => colorIds.includes(c.colorId))
    : CALENDAR_COLOR_SCHEME;
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1.5 ${className}`}>
      {entries.map((c) => (
        <span
          key={c.colorId}
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
          title={c.meaning}
        >
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-border"
            style={{ backgroundColor: c.hex }}
          />
          {c.label}
        </span>
      ))}
    </div>
  );
}
