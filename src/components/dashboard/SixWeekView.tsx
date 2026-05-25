import MonthView from "react-big-calendar/lib/Month";
import { addDays, startOfWeek, format } from "date-fns";

const DAYS_PER_WEEK = 7;
const WEEKS = 6;
const TOTAL_DAYS = DAYS_PER_WEEK * WEEKS;

// Returns the Sunday on or before `date`. Mirrors the calendar's existing
// weekStartsOn: 0 setting in UnifiedCalendarWidget.
const weekStart = (date: Date) => startOfWeek(date, { weekStartsOn: 0 });

// 6 weeks of days starting from the Sunday on/before `date`. Used by both
// the per-view localizer override (so MonthView's render generates this
// range) and the static `range` method that RBC's parent Calendar consults.
const sixWeekDays = (date: Date): Date[] => {
  const start = weekStart(date);
  return Array.from({ length: TOTAL_DAYS }, (_, i) => addDays(start, i));
};

const sixWeekStart = (date: Date) => weekStart(date);
const sixWeekEnd = (date: Date) => addDays(weekStart(date), TOTAL_DAYS - 1);

type AnyProps = Record<string, unknown> & { localizer: any; date: Date };

// MonthView reads its grid from `localizer.visibleDays(date, localizer)` and
// re-measures when `localizer.neq(date, prevDate, 'month')` returns true. We
// shim those two methods so the underlying MonthView component renders 42
// days anchored at the current week instead of the calendar month, without
// touching MonthView itself or RBC internals.
export default function SixWeekView(props: AnyProps) {
  const wrapped = {
    ...props.localizer,
    visibleDays: (date: Date) => sixWeekDays(date),
    firstVisibleDay: (date: Date) => sixWeekStart(date),
    lastVisibleDay: (date: Date) => sixWeekEnd(date),
    neq: (a: Date, b: Date, unit?: string) => {
      if (unit === "month") {
        return weekStart(a).getTime() !== weekStart(b).getTime();
      }
      return props.localizer.neq(a, b, unit);
    },
  };
  const MV = MonthView as any;
  return <MV {...props} localizer={wrapped} />;
}

SixWeekView.range = (date: Date) => ({
  start: sixWeekStart(date),
  end: sixWeekEnd(date),
});

SixWeekView.navigate = (date: Date, action: "PREV" | "NEXT" | "TODAY" | "DATE") => {
  switch (action) {
    case "PREV":
      return addDays(date, -DAYS_PER_WEEK);
    case "NEXT":
      return addDays(date, DAYS_PER_WEEK);
    default:
      return date;
  }
};

SixWeekView.title = (date: Date) => {
  const start = sixWeekStart(date);
  const end = sixWeekEnd(date);
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
};
