import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock, RefreshCw, TrendingUp, Instagram, Music2, Sparkles } from "lucide-react";

type Platform = "instagram" | "tiktok";
type CacheRow = {
  platform: Platform;
  heatmap: number[][]; // 7 x 24
  top_windows: { day: string; start_hour: number; end_hour: number; rationale: string }[];
  change_note: string;
  sources: string[];
  refreshed_at: string;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PLATFORM_META: Record<Platform, { label: string; icon: any }> = {
  instagram: { label: "Instagram", icon: Instagram },
  tiktok: { label: "TikTok", icon: Music2 },
};

function formatHour(h: number) {
  const mer = h < 12 ? "a" : "p";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${mer}`;
}

function heatColor(score: number) {
  // 0..100 → cool to hot using primary hue
  const intensity = Math.max(0, Math.min(100, score)) / 100;
  // hsl uses primary purple; lerp lightness from 18% (dark) to 65% (bright)
  const l = 18 + intensity * 47;
  const a = 0.25 + intensity * 0.75;
  return `hsl(262 83% ${l}% / ${a})`;
}

export default function PostingTimesWidget() {
  const { toast } = useToast();
  const [data, setData] = useState<Record<Platform, CacheRow | null>>({ instagram: null, tiktok: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Platform>("instagram");

  const load = async () => {
    const { data: rows } = await supabase
      .from("posting_times_cache")
      .select("*")
      .in("platform", ["instagram", "tiktok"]);
    const next: Record<Platform, CacheRow | null> = { instagram: null, tiktok: null };
    (rows || []).forEach((r: any) => {
      next[r.platform as Platform] = r as CacheRow;
    });
    setData(next);
    setLoading(false);

    // Auto-refresh once per local calendar day, after 6am.
    // Triggers on missing data or if newest cache row was last refreshed before today 6am.
    const now = new Date();
    const todaySixAm = new Date(now);
    todaySixAm.setHours(6, 0, 0, 0);
    const cutoff = now.getTime() >= todaySixAm.getTime()
      ? todaySixAm.getTime()
      : todaySixAm.getTime() - 24 * 60 * 60 * 1000; // before 6am: use yesterday 6am
    const stale = (["instagram", "tiktok"] as Platform[]).some((p) => {
      const row = next[p];
      if (!row) return true;
      return new Date(row.refreshed_at).getTime() < cutoff;
    });
    if (stale) refresh(true);
  };

  // Most recent refresh across both platforms
  const lastRefreshed = (() => {
    const times = (["instagram", "tiktok"] as Platform[])
      .map((p) => data[p]?.refreshed_at)
      .filter(Boolean)
      .map((t) => new Date(t as string).getTime());
    return times.length ? new Date(Math.max(...times)) : null;
  })();

  const formatLastRefreshed = (d: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  const refresh = async (silent = false) => {
    setRefreshing(true);
    if (!silent) toast({ title: "Refreshing posting-time data…" });
    try {
      const { data: result, error } = await supabase.functions.invoke("posting-times", {
        body: { platforms: ["instagram", "tiktok"] },
      });
      if (error) throw error;
      // Persist results
      for (const p of ["instagram", "tiktok"] as Platform[]) {
        const r = result?.[p];
        if (!r) continue;
        await supabase.from("posting_times_cache").upsert(
          {
            platform: p,
            heatmap: r.heatmap,
            top_windows: r.top_windows,
            change_note: r.change_note,
            sources: r.sources,
            refreshed_at: new Date().toISOString(),
          },
          { onConflict: "platform" },
        );
      }
      await load();
      if (!silent) toast({ title: "Updated" });
    } catch (e: any) {
      toast({ title: "Refresh failed", description: e?.message || "Try again later", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderPlatform = (p: Platform) => {
    const row = data[p];
    if (!row) {
      return (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No data yet. Click Refresh to fetch the latest guidance.
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {/* Change note */}
        {row.change_note && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold mb-1">
              <Sparkles className="w-4 h-4 text-primary" /> What changed
            </div>
            <p className="text-muted-foreground">{row.change_note}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Heatmap */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4" /> Engagement Heatmap (ET)
              </h4>
              <span className="text-xs text-muted-foreground">
                Updated {new Date(row.refreshed_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <div className="grid" style={{ gridTemplateColumns: "auto repeat(24, minmax(18px, 1fr))" }}>
                  {/* Header row: hours */}
                  <div />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={`h-${h}`} className="text-[9px] text-muted-foreground text-center pb-1">
                      {h % 3 === 0 ? formatHour(h) : ""}
                    </div>
                  ))}
                  {/* Rows */}
                  {DAYS.map((day, di) => (
                    <>
                      <div key={`d-${di}`} className="text-xs text-muted-foreground pr-2 flex items-center justify-end">
                        {day}
                      </div>
                      {Array.from({ length: 24 }, (_, h) => {
                        const score = row.heatmap?.[di]?.[h] ?? 0;
                        return (
                          <div
                            key={`c-${di}-${h}`}
                            className="aspect-square rounded-sm m-[1px]"
                            style={{ backgroundColor: heatColor(score) }}
                            title={`${day} ${formatHour(h)} — score ${score}`}
                          />
                        );
                      })}
                    </>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Top windows */}
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4" /> Top windows
            </h4>
            <ul className="space-y-2">
              {row.top_windows?.map((w, i) => (
                <li key={i} className="rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{w.day}</span>
                    <Badge variant="outline">
                      {formatHour(w.start_hour)}–{formatHour(w.end_hour)} ET
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{w.rationale}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sources */}
        {row.sources?.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Sources synthesized: {row.sources.join(", ")}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 font-display tracking-wide-custom">
          <Clock className="w-5 h-5 text-primary" /> Best Times to Post
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => refresh(false)} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing" : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Platform)}>
            <TabsList className="grid grid-cols-2 mb-4">
              {(["instagram", "tiktok"] as Platform[]).map((p) => {
                const Icon = PLATFORM_META[p].icon;
                return (
                  <TabsTrigger key={p} value={p} className="gap-2">
                    <Icon className="w-4 h-4" /> {PLATFORM_META[p].label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {(["instagram", "tiktok"] as Platform[]).map((p) => (
              <TabsContent key={p} value={p}>{renderPlatform(p)}</TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
