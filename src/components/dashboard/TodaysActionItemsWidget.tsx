import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, RefreshCw, ExternalLink } from "lucide-react";

type CalEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  source: string;
  sourceLabel: string;
  color: string;
  itemUrl?: string;
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export default function TodaysActionItemsWidget() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("monday-calendar-events");
      if (error) throw error;
      const list: CalEvent[] = (data as any)?.events ?? [];
      setEvents(list);
      setRefreshedAt(new Date());
    } catch (e) {
      console.error("TodaysActionItemsWidget load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Detection: source label contains "action items" (case-insensitive).
  // Window: today + overdue (start <= end-of-today).
  const cutoff = endOfToday().getTime();
  const todayStart = startOfToday().getTime();
  const filtered = events
    .filter((e) => /action items/i.test(e.sourceLabel))
    .filter((e) => new Date(e.start).getTime() <= cutoff)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="font-display text-lg tracking-wide-custom flex items-center gap-2 text-destructive">
          <CalendarClock className="w-5 h-5 text-destructive" />
          Today's Action Items
          {filtered.length > 0 && (
            <Badge variant="destructive" className="ml-1">{filtered.length}</Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={load} disabled={loading} title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {refreshedAt && (
          <p className="text-xs text-muted-foreground mb-3">
            Updated {refreshedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
        )}
        {loading && events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            🎉 No action items due today or overdue.
          </p>
        ) : (
          <ul className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
            {filtered.map((e) => {
              const startMs = new Date(e.start).getTime();
              const isOverdue = startMs < todayStart;
              const dateLabel = isOverdue
                ? `Overdue · ${new Date(e.start).toLocaleDateString([], { month: "short", day: "numeric" })}`
                : e.allDay
                  ? "Today"
                  : `Today · ${new Date(e.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
              return (
                <li key={e.id}>
                  <a
                    href={e.itemUrl || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: e.color || "#8b5cf6" }}
                    />
                    <ExternalLink className="w-3.5 h-3.5 mt-0.5 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{e.title}</p>
                      <p className={`text-xs truncate ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                        {dateLabel} · {e.sourceLabel}
                      </p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
