import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";

type MissingItem = {
  id: string;
  itemId: string;
  name: string;
  boardId: string;
  boardName: string;
  sourceLabel: string;
  color: string;
  groupTitle: string | null;
  itemUrl: string;
  updatedAt: string | null;
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // mirror calendar refresh cadence

export default function MissingDatesWidget() {
  const [items, setItems] = useState<MissingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("monday-calendar-events");
      if (error) throw error;
      const list: MissingItem[] = (data as any)?.missingDateItems ?? [];
      setItems(list);
      setRefreshedAt(new Date());
    } catch (e) {
      console.error("MissingDatesWidget load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Group by source label for readability.
  const grouped = items.reduce<Record<string, MissingItem[]>>((acc, it) => {
    const k = it.sourceLabel || it.boardName || "Other";
    (acc[k] ||= []).push(it);
    return acc;
  }, {});

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="font-display text-lg tracking-wide-custom flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          Items Missing Dates
          {items.length > 0 && (
            <Badge variant="destructive" className="ml-1">{items.length}</Badge>
          )}
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={load}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {refreshedAt && (
          <p className="text-xs text-muted-foreground mb-3">
            Updated {refreshedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
        )}

        {loading && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            🎉 Every Monday item has a date. Nothing to action.
          </p>
        ) : (
          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {Object.entries(grouped).map(([source, list]) => (
              <div key={source}>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: list[0]?.color || "#8b5cf6" }}
                  />
                  <h4 className="text-sm font-display tracking-wide-custom text-foreground">
                    {source}
                  </h4>
                  <Badge variant="outline" className="text-xs">{list.length}</Badge>
                </div>
                <ul className="space-y-1">
                  {list.map((it) => (
                    <li key={it.id}>
                      <a
                        href={it.itemUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 mt-0.5 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground truncate">{it.name}</p>
                          {it.groupTitle && (
                            <p className="text-xs text-muted-foreground truncate">
                              {it.groupTitle}
                            </p>
                          )}
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
