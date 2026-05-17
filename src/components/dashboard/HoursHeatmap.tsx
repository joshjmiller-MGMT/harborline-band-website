import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  aggregateDailyHours,
  fmtHours,
  KIND_COLOR,
  TEN_K_HOURS_GOAL,
  totalByKind,
  type InstrumentClassification,
  type InstrumentKind,
} from "@/lib/instrument-hours";

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Heat intensity per day. Calibrated for hour-counts: 0.5hr → 1, 2hr → 2, 4hr → 3, 6hr+ → 4.
const heatLevel = (hours: number): number => {
  if (hours <= 0) return 0;
  if (hours < 1) return 1;
  if (hours < 3) return 2;
  if (hours < 5) return 3;
  return 4;
};

const heatBg = (level: number) => {
  if (level === 0) return "bg-muted/30";
  if (level === 1) return "bg-amber-500/30";
  if (level === 2) return "bg-amber-500/55";
  if (level === 3) return "bg-amber-500/80";
  return "bg-amber-500";
};

type HeatmapKindFilter = "all" | "gig" | "rehearsal";

const RESAMPLE_STALE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RESAMPLE_BATCH = 10;

export default function HoursHeatmap() {
  const [classifications, setClassifications] = useState<InstrumentClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [resampling, setResampling] = useState(false);
  const [resampleEligibleOnly, setResampleEligibleOnly] = useState(false);
  const [allTime, setAllTime] = useState(false);
  const [kindFilter, setKindFilter] = useState<HeatmapKindFilter>("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("instrument_event_classifications")
      .select("*")
      .neq("classified_as", "none")
      .order("event_start", { ascending: true });
    setClassifications((data as InstrumentClassification[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("instrument_hours")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instrument_event_classifications" },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Auto rows eligible for resampling: never resampled, or last resampled >30d
  // ago. Reviewed/needs-review rows are immune — only `auto` rows can drift
  // without anyone looking. This is the "filter chip" pool.
  const resampleEligibleIds = useMemo(() => {
    const cutoff = Date.now() - RESAMPLE_STALE_MS;
    const ids = new Set<string>();
    for (const c of classifications) {
      if (c.review_status !== "auto") continue;
      if (!c.last_resampled_at || new Date(c.last_resampled_at).getTime() < cutoff) {
        ids.add(c.id);
      }
    }
    return ids;
  }, [classifications]);

  // Filter the row set for the heatmap when a single-kind view is selected.
  // The per-kind breakdown grid and the headline goal-progress badge keep
  // showing the full picture regardless — the filter is just for the squares.
  const filteredForHeatmap = useMemo(() => {
    let rows = classifications;
    if (resampleEligibleOnly) rows = rows.filter((c) => resampleEligibleIds.has(c.id));
    if (kindFilter !== "all") rows = rows.filter((c) => c.classified_as === kindFilter);
    return rows;
  }, [classifications, kindFilter, resampleEligibleOnly, resampleEligibleIds]);

  const dailyHours = useMemo(() => aggregateDailyHours(filteredForHeatmap), [filteredForHeatmap]);
  const kindTotals = useMemo(() => totalByKind(classifications), [classifications]);
  const grandTotal = kindTotals.gig + kindTotals.rehearsal + kindTotals.practice;
  const pctOfGoal = (grandTotal / TEN_K_HOURS_GOAL) * 100;

  const today = startOfDay(new Date());

  const heatmapWeeks = useMemo(() => {
    if (!allTime) return 53;
    if (!classifications.length) return 53;
    const earliest = new Date(classifications[0].event_start);
    const earliestDay = startOfDay(earliest);
    const daysSpan = Math.ceil((today.getTime() - earliestDay.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(53, Math.ceil(daysSpan / 7) + 2);
  }, [allTime, classifications, today]);

  const heatmap = useMemo(() => {
    const end = today;
    const endDow = end.getDay();
    const lastSunday = addDays(end, -endDow);
    const startSunday = addDays(lastSunday, -(heatmapWeeks - 1) * 7);
    const weeks: { date: Date; hours: number; level: number }[][] = [];
    for (let w = 0; w < heatmapWeeks; w++) {
      const col: { date: Date; hours: number; level: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(startSunday, w * 7 + d);
        if (date > end) {
          col.push({ date, hours: -1, level: -1 });
          continue;
        }
        const hours = dailyHours.get(dayKey(date)) || 0;
        col.push({ date, hours, level: heatLevel(hours) });
      }
      weeks.push(col);
    }
    return weeks;
  }, [dailyHours, today, heatmapWeeks]);

  const monthLabels = useMemo(() => {
    const labels: { col: number; label: string }[] = [];
    let last = "";
    heatmap.forEach((week, idx) => {
      const first = week[0]?.date;
      if (!first) return;
      const m = first.toLocaleString("en-US", { month: "short" });
      if (m !== last) {
        labels.push({ col: idx, label: m });
        last = m;
      }
    });
    return labels;
  }, [heatmap]);

  const resample = async () => {
    setResampling(true);
    try {
      const { data, error } = await supabase.functions.invoke("instrument-hours-resample", {
        body: { oldest: RESAMPLE_BATCH },
      });
      if (error) throw error;
      const n = data?.resampled ?? 0;
      toast({
        title: n > 0 ? `${n} event${n === 1 ? "" : "s"} sent to review queue` : "Nothing to resample",
        description: n > 0 ? "Catching over-extrapolation by spot-checking auto-classified rows." : "All auto rows have been resampled in the last 30 days.",
      });
      await load();
    } catch (e) {
      toast({
        title: "Resample failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setResampling(false);
    }
  };

  const rescan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("instrument-hours-scan", {
        body: { months_back: 240 },
      });
      if (error) throw error;
      toast({
        title: "Calendar re-scan complete",
        description: `${data?.persisted ?? 0} events classified · ${data?.skipped_reviewed ?? 0} reviewed rows preserved`,
      });
      await load();
    } catch (e) {
      toast({
        title: "Re-scan failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500" />
            Hours on the instrument
            <Badge variant="secondary" className="ml-1 text-xs font-mono">
              {fmtHours(grandTotal)} / {TEN_K_HOURS_GOAL.toLocaleString()} ({pctOfGoal.toFixed(1)}%)
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAllTime((v) => !v)}
              className="h-7 text-xs"
              title={allTime ? "Show last 12 months only" : "Show full history (scrolls horizontally)"}
            >
              {allTime ? "Compact" : "Show all time"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={resample}
              disabled={resampling || resampleEligibleIds.size === 0}
              className="h-7 text-xs gap-1"
              title={`Send ${Math.min(RESAMPLE_BATCH, resampleEligibleIds.size)} stale auto-classified events to the review queue for a sanity check`}
            >
              <ShieldCheck className={`w-3 h-3 ${resampling ? "animate-pulse" : ""}`} />
              {resampling ? "Sampling…" : `Resample ${Math.min(RESAMPLE_BATCH, resampleEligibleIds.size)}`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={rescan}
              disabled={scanning}
              className="h-7 text-xs gap-1"
              title="Re-classify calendar events using current rules"
            >
              <RefreshCw className={`w-3 h-3 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? "Scanning…" : "Re-scan"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Per-kind breakdown */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(["gig", "rehearsal", "practice"] as InstrumentKind[]).map((k) => {
            const c = KIND_COLOR[k];
            return (
              <div
                key={k}
                className={`rounded border ${c.border} p-2 text-center bg-card`}
              >
                <div className={`text-xs ${c.text} uppercase tracking-wide`}>{k}s</div>
                <div className="font-mono text-lg font-bold">{fmtHours(kindTotals[k])}</div>
                <div className="text-[10px] text-muted-foreground">hours</div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${Math.min(100, pctOfGoal)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Toward Malcolm Gladwell's 10,000-hour rule. Mileage may vary.
          </p>
        </div>

        {/* Heatmap */}
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && classifications.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No classified events yet. Hit Re-scan to read your calendar.
          </p>
        )}
        {!loading && classifications.length > 0 && (
          <>
            <div className="mb-2 flex items-center gap-1 flex-wrap text-[10px]">
              <span className="text-muted-foreground mr-1">Heatmap:</span>
              {(["all", "gig", "rehearsal"] as HeatmapKindFilter[]).map((k) => {
                const active = kindFilter === k;
                const label = k === "all" ? "All" : k === "gig" ? "Gigs" : "Rehearsals";
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKindFilter(k)}
                    className={`h-6 px-2 rounded border transition-colors ${
                      active
                        ? "bg-amber-500/20 border-amber-500/60 text-foreground"
                        : "bg-card border-border text-muted-foreground hover:border-amber-500/40 hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setResampleEligibleOnly((v) => !v)}
                disabled={resampleEligibleIds.size === 0}
                className={`h-6 px-2 rounded border transition-colors ml-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  resampleEligibleOnly
                    ? "bg-amber-500/20 border-amber-500/60 text-foreground"
                    : "bg-card border-border text-muted-foreground hover:border-amber-500/40 hover:text-foreground"
                }`}
                title="Show only days containing auto-classified events not resampled in the last 30 days"
              >
                Resample-eligible · {resampleEligibleIds.size}
              </button>
            </div>
            <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="flex gap-[3px] pl-7 mb-1 text-[10px] text-muted-foreground">
                {heatmap.map((_, idx) => {
                  const label = monthLabels.find((m) => m.col === idx)?.label;
                  return (
                    <div key={idx} className="w-[11px] text-center">
                      {label || ""}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-[3px]">
                <div className="flex flex-col gap-[3px] text-[10px] text-muted-foreground pr-1">
                  {["", "Mon", "", "Wed", "", "Fri", ""].map((d, i) => (
                    <div key={i} className="h-[11px] leading-[11px] w-6 text-right">{d}</div>
                  ))}
                </div>
                {heatmap.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {week.map((cell, di) => (
                      <div
                        key={di}
                        className={`w-[11px] h-[11px] rounded-sm ${cell.level < 0 ? "bg-transparent" : heatBg(cell.level)}`}
                        title={cell.hours < 0 ? "" : `${dayKey(cell.date)} — ${cell.hours.toFixed(1)}hr`}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground">
                <span>Less</span>
                {[0, 1, 2, 3, 4].map((l) => (
                  <div key={l} className={`w-[11px] h-[11px] rounded-sm ${heatBg(l)}`} />
                ))}
                <span>More</span>
              </div>
            </div>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
