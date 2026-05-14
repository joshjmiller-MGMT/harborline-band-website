import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";

type EveningEvent = {
  id: string;
  title: string;
  accountEmail: string;
  htmlLink: string;
};

type Evening = {
  date: string;
  reason: string;
  events: EveningEvent[];
};

type WeekBucket = {
  weekStart: string;
  weekEnd: string;
  busyEvenings: number;
  freeEvenings: number;
  flag: boolean;
  evenings: Evening[];
};

type Response = {
  configured: boolean;
  connected: boolean;
  windowWeeks?: number;
  weeks: WeekBucket[];
  accounts?: { email: string; calendars: number; error?: string }[];
  error?: string;
};

/**
 * Compact "booking rule" surface for embedding in NeedsActionWidget.
 *
 * Rule: ≥2 evenings/week free (evening = Mon-Sun 6PM+ ET). Renders one chip per
 * flagged week (busyEvenings >= 5). Hides itself entirely when no week in the
 * window is flagged.
 */
export function EveningAvailabilityNeedsAction({ weeks = 8 }: { weeks?: number } = {}) {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: resp } = await supabase.functions.invoke("evening-availability-check", {
          method: "POST",
          body: { weeks },
        });
        if (!cancelled) setData(resp as Response);
      } catch {
        // Swallow; widget hides if it can't load.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weeks]);

  if (loading) return null;
  if (!data || !data.connected) return null;

  const flagged = (data.weeks || []).filter((w) => w.flag);
  if (flagged.length === 0) return null;

  return (
    <a
      href="/team/scheduler"
      className="block border border-destructive/40 rounded-lg p-3 bg-destructive/5 group hover:border-destructive/60 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-sm font-medium">
            {flagged.length} week{flagged.length === 1 ? "" : "s"} over booking limit (≥5 evenings busy)
          </span>
        </div>
        <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-foreground shrink-0" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
        {flagged.map((w) => {
          const monday = parseISO(`${w.weekStart}T00:00:00`);
          return (
            <span
              key={w.weekStart}
              title={`${w.weekStart} → ${w.weekEnd} · ${w.busyEvenings} evenings booked, ${w.freeEvenings} free`}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30 tabular-nums"
            >
              Week of {format(monday, "M/d")} — {w.busyEvenings} evening{w.busyEvenings === 1 ? "" : "s"} booked
            </span>
          );
        })}
      </div>
      <p className="mt-2 pl-6 text-[11px] text-muted-foreground">
        Rule: keep ≥2 evenings free per week (evening = 6PM+).
      </p>
    </a>
  );
}
