import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Clock, RefreshCw, TrendingUp, Instagram, Music2, Sparkles, Youtube } from "lucide-react";

type Platform = "instagram" | "tiktok" | "youtube_shorts";
type Style = "reels" | "carousel" | "story" | "default";

type CacheRow = {
  platform: Platform;
  style: Style;
  heatmap: number[][];
  top_windows: { day: string; start_hour: number; end_hour: number; rationale: string }[];
  change_note: string;
  sources: string[];
  refreshed_at: string;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PLATFORM_META: Record<Platform, { label: string; icon: any; styles: Style[] }> = {
  instagram: { label: "Instagram", icon: Instagram, styles: ["reels", "carousel", "story"] },
  tiktok: { label: "TikTok", icon: Music2, styles: ["default"] },
  youtube_shorts: { label: "YouTube Shorts", icon: Youtube, styles: ["default"] },
};

const STYLE_LABEL: Record<Style, string> = {
  reels: "Reels",
  carousel: "Carousel",
  story: "Story",
  default: "Standard",
};

const PLATFORMS: Platform[] = ["instagram", "tiktok", "youtube_shorts"];

function formatHour(h: number) {
  const mer = h < 12 ? "a" : "p";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${mer}`;
}

function heatColor(score: number) {
  const intensity = Math.max(0, Math.min(100, score)) / 100;
  const l = 18 + intensity * 47;
  const a = 0.25 + intensity * 0.75;
  return `hsl(262 83% ${l}% / ${a})`;
}

const cellKey = (p: Platform, s: Style) => `${p}:${s}`;

export default function PostingTimesWidget() {
  const { toast } = useToast();
  const [data, setData] = useState<Record<string, CacheRow | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePlatform, setActivePlatform] = useState<Platform>("instagram");
  const [activeStyle, setActiveStyle] = useState<Record<Platform, Style>>({
    instagram: "reels",
    tiktok: "default",
    youtube_shorts: "default",
  });

  const load = async () => {
    const { data: rows } = await supabase.from("posting_times_cache").select("*");
    const next: Record<string, CacheRow | null> = {};
    (rows || []).forEach((r: any) => {
      next[cellKey(r.platform, r.style)] = r as CacheRow;
    });
    setData(next);
    setLoading(false);

    // Auto-refresh once per local day after 6am if any (platform, style) is stale.
    const now = new Date();
    const todaySixAm = new Date(now);
    todaySixAm.setHours(6, 0, 0, 0);
    const cutoff = now.getTime() >= todaySixAm.getTime()
      ? todaySixAm.getTime()
      : todaySixAm.getTime() - 24 * 60 * 60 * 1000;
    const stale = PLATFORMS.flatMap((p) => PLATFORM_META[p].styles.map((s) => cellKey(p, s)))
      .some((k) => {
        const row = next[k];
        if (!row) return true;
        return new Date(row.refreshed_at).getTime() < cutoff;
      });
    if (stale) refresh(true);
  };

  const lastRefreshed = useMemo(() => {
    const times = Object.values(data)
      .filter((r): r is CacheRow => Boolean(r))
      .map((r) => new Date(r.refreshed_at).getTime());
    return times.length ? new Date(Math.max(...times)) : null;
  }, [data]);

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
      const { error } = await supabase.functions.invoke("posting-times", {
        body: { source: "manual", scrape: true },
      });
      if (error) throw error;
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
    const t = setInterval(() => { load(); }, 30 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderCell = (platform: Platform, style: Style) => {
    const row = data[cellKey(platform, style)];
    if (!row) {
      return (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No data yet. Click Refresh to fetch the latest guidance.
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {row.change_note && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold mb-1">
              <Sparkles className="w-4 h-4 text-primary" /> What changed
            </div>
            <p className="text-muted-foreground">{row.change_note}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                  <div />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={`h-${h}`} className="text-[9px] text-muted-foreground text-center pb-1">
                      {h % 3 === 0 ? formatHour(h) : ""}
                    </div>
                  ))}
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

        {row.sources?.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Sources synthesized: {row.sources.join(", ")}
          </div>
        )}
      </div>
    );
  };

  const renderPlatform = (platform: Platform) => {
    const styles = PLATFORM_META[platform].styles;
    if (styles.length === 1) return renderCell(platform, styles[0]);
    return (
      <Tabs
        value={activeStyle[platform]}
        onValueChange={(v) => setActiveStyle((s) => ({ ...s, [platform]: v as Style }))}
      >
        <TabsList className={`grid mb-4`} style={{ gridTemplateColumns: `repeat(${styles.length}, 1fr)` }}>
          {styles.map((s) => (
            <TabsTrigger key={s} value={s}>{STYLE_LABEL[s]}</TabsTrigger>
          ))}
        </TabsList>
        {styles.map((s) => (
          <TabsContent key={s} value={s}>{renderCell(platform, s)}</TabsContent>
        ))}
      </Tabs>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 font-display tracking-wide-custom">
            <Clock className="w-5 h-5 text-primary" /> Best Times to Post
          </CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {lastRefreshed
              ? <>Last refreshed {formatLastRefreshed(lastRefreshed)} · auto-refreshes every morning</>
              : <>Auto-refreshes every morning</>}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refresh(false)} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing" : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
        ) : (
          <Tabs value={activePlatform} onValueChange={(v) => setActivePlatform(v as Platform)}>
            <TabsList className="grid grid-cols-3 mb-4">
              {PLATFORMS.map((p) => {
                const Icon = PLATFORM_META[p].icon;
                return (
                  <TabsTrigger key={p} value={p} className="gap-2">
                    <Icon className="w-4 h-4" /> {PLATFORM_META[p].label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {PLATFORMS.map((p) => (
              <TabsContent key={p} value={p}>{renderPlatform(p)}</TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
