import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarClock, RefreshCw, ExternalLink, ChevronDown } from "lucide-react";

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

function ItemRow({ e, overdue }: { e: CalEvent; overdue: boolean }) {
  const dateLabel = overdue
    ? `Overdue · ${new Date(e.start).toLocaleDateString([], { month: "short", day: "numeric" })}`
    : e.allDay
      ? "Today"
      : `Today · ${new Date(e.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return (
    <li>
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
          <p className={`text-xs truncate ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
            {dateLabel} · {e.sourceLabel}
          </p>
        </div>
      </a>
    </li>
  );
}

export default function TodaysActionItemsWidget() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);

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

  const todayStart = startOfToday().getTime();
  const todayEnd = endOfToday().getTime();
  const actionItems = events
    .filter((e) => /action items/i.test(e.sourceLabel))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const dueToday = actionItems.filter((e) => {
    const t = new Date(e.start).getTime();
    return t >= todayStart && t <= todayEnd;
  });
  const overdue = actionItems.filter((e) => new Date(e.start).getTime() < todayStart);
  const total = dueToday.length + overdue.length;

  return (
    <Card className="bg-card/50 border-border">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <CardTitle className="font-display text-lg tracking-wide-custom flex items-center gap-2 text-destructive">
              <CalendarClock className="w-5 h-5 text-destructive" />
              Today's Action Items
              {total > 0 && (
                <Badge variant="destructive" className="ml-1">{total}</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={(ev) => { ev.stopPropagation(); load(); }}
                disabled={loading}
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {refreshedAt && (
              <p className="text-xs text-muted-foreground mb-3">
                Updated {refreshedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
            )}
            {loading && events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : total === 0 ? (
              <p className="text-sm text-muted-foreground">
                🎉 No action items due today or overdue.
              </p>
            ) : (
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-sm font-display tracking-wide-custom text-foreground">Due Today</h4>
                    <Badge variant="outline" className="text-xs">{dueToday.length}</Badge>
                  </div>
                  {dueToday.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-2">Nothing due today.</p>
                  ) : (
                    <ul className="space-y-1">
                      {dueToday.map((e) => <ItemRow key={e.id} e={e} overdue={false} />)}
                    </ul>
                  )}
                </section>
                <section>
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-sm font-display tracking-wide-custom text-destructive">Overdue</h4>
                    <Badge variant="destructive" className="text-xs">{overdue.length}</Badge>
                  </div>
                  {overdue.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-2">Nothing overdue.</p>
                  ) : (
                    <ul className="space-y-1">
                      {overdue.map((e) => <ItemRow key={e.id} e={e} overdue={true} />)}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
