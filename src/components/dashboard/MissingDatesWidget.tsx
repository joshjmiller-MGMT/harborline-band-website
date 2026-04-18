import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// Tab definitions. Each tab declares which `sourceLabel` substrings (matched
// case-insensitively) belong to it. Add Trello here once that source exists.
type TabDef = {
  key: string;
  label: string;
  matches: (item: MissingItem) => boolean;
  emptyText: string;
  comingSoon?: boolean;
};

const isCompletedGroup = (it: MissingItem) =>
  /complete/i.test(it.groupTitle || "");

const TABS: TabDef[] = [
  {
    key: "monday-leads",
    label: "Leads",
    matches: (it) => /lead/i.test(it.sourceLabel) && !isCompletedGroup(it),
    emptyText: "🎉 No Monday leads missing a date.",
  },
  {
    key: "monday-events",
    label: "Events",
    matches: (it) => /event/i.test(it.sourceLabel) && !isCompletedGroup(it),
    emptyText: "🎉 No Monday events missing a date.",
  },
  {
    key: "monday-completed",
    label: "Completed",
    matches: isCompletedGroup,
    emptyText: "🎉 No completed gigs missing a Next Action Date.",
  },
  {
    key: "trello",
    label: "Trello",
    matches: () => false,
    emptyText: "Trello integration coming soon.",
    comingSoon: true,
  },
];

function ItemList({ items, emptyText }: { items: MissingItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
      {items.map((it) => (
        <li key={it.id}>
          <a
            href={it.itemUrl}
            target="_blank"
            rel="noreferrer"
            className="group flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors"
          >
            <span
              className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
              style={{ backgroundColor: it.color || "#8b5cf6" }}
            />
            <ExternalLink className="w-3.5 h-3.5 mt-0.5 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground truncate">{it.name}</p>
              {it.groupTitle && (
                <p className="text-xs text-muted-foreground truncate">{it.groupTitle}</p>
              )}
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function MissingDatesWidget() {
  const [items, setItems] = useState<MissingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<string>(TABS[0].key);

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

  const countsByTab = TABS.reduce<Record<string, number>>((acc, tab) => {
    acc[tab.key] = items.filter(tab.matches).length;
    return acc;
  }, {});
  const totalCount = items.length;

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="font-display text-lg tracking-wide-custom flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          Items Missing Dates
          {totalCount > 0 && (
            <Badge variant="destructive" className="ml-1">{totalCount}</Badge>
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key} className="text-xs">
                {tab.label}
                {countsByTab[tab.key] > 0 && (
                  <Badge variant="destructive" className="ml-1.5 h-4 px-1.5 text-[10px]">
                    {countsByTab[tab.key]}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((tab) => (
            <TabsContent key={tab.key} value={tab.key} className="mt-4">
              {tab.comingSoon ? (
                <p className="text-sm text-muted-foreground">{tab.emptyText}</p>
              ) : loading && items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <ItemList items={items.filter(tab.matches)} emptyText={tab.emptyText} />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
