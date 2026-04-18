import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, RefreshCw, ExternalLink } from "lucide-react";

type Item = {
  id: string;
  name: string;
  status: string;
  type: string;
  link: string;
  nextFollowup: string;
  nextFollowupDate: string | null;
  kind: "reachout" | "followup" | "unknown";
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

function ItemRow({ it, overdue, sheetUrl }: { it: Item; overdue: boolean; sheetUrl: string }) {
  const dateLabel = overdue
    ? `Overdue · ${it.nextFollowupDate}`
    : `Today${it.nextFollowupDate ? ` · ${it.nextFollowupDate}` : ""}`;
  return (
    <li>
      <a
        href={it.link || sheetUrl}
        target="_blank"
        rel="noreferrer"
        className="group flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5 mt-0.5 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground truncate">{it.name}</p>
          <p className={`text-xs truncate ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
            {dateLabel}
            {it.status && ` · ${it.status}`}
          </p>
        </div>
      </a>
    </li>
  );
}

export default function BookingAgentActionWidget() {
  const [reachouts, setReachouts] = useState<Item[]>([]);
  const [followups, setFollowups] = useState<Item[]>([]);
  const [sheetUrl, setSheetUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("booking-agent-rows");
      if (error) throw error;
      const d = data as any;
      setReachouts((d?.reachouts || []) as Item[]);
      setFollowups((d?.followups || []) as Item[]);
      setSheetUrl(d?.sheetUrl || "");
      setRefreshedAt(new Date());
    } catch (e) {
      console.error("BookingAgentActionWidget load error", e);
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

  const all = [...reachouts, ...followups]
    .filter((it) => it.nextFollowupDate)
    .map((it) => ({
      ...it,
      _ts: new Date(`${it.nextFollowupDate}T00:00:00`).getTime(),
    }))
    .sort((a, b) => a._ts - b._ts);

  const dueToday = all.filter((it) => it._ts >= todayStart && it._ts <= todayEnd);
  const overdue = all.filter((it) => it._ts < todayStart);
  const total = dueToday.length + overdue.length;

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="font-display text-lg tracking-wide-custom flex items-center gap-2 text-foreground">
          <Phone className="w-5 h-5 text-amber-500" />
          Booking Agent
          {total > 0 && (
            <Badge variant="destructive" className="ml-1">{total}</Badge>
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
        {loading && total === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground">
            🎉 No booking-agent follow-ups due today or overdue.
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
                  {dueToday.map((it) => (
                    <ItemRow key={it.id} it={it} overdue={false} sheetUrl={sheetUrl} />
                  ))}
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
                  {overdue.map((it) => (
                    <ItemRow key={it.id} it={it} overdue={true} sheetUrl={sheetUrl} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
