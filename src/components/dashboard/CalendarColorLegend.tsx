import { CALENDAR_COLOR_SCHEME } from "@/lib/calendar-color-scheme";

/**
 * Compact legend for Josh's calendar color scheme (2026-06-22). Renders the
 * color → meaning mapping so the calendar + staffing widgets are self-documenting.
 * Pure presentational; reads the canonical scheme from calendar-color-scheme.ts.
 */
export function CalendarColorLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1.5 ${className}`}>
      {CALENDAR_COLOR_SCHEME.map((c) => (
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
