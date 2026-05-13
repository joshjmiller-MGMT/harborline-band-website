import { useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import PracticeTimerWidget from "@/components/dashboard/PracticeTimerWidget";
import PracticeItemsWidget from "@/components/dashboard/PracticeItemsWidget";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Activity, Flame, Calendar, BarChart3, Clock, Plus } from "lucide-react";

interface SessionRow {
  id: string;
  preset_name: string;
  started_at: string;
  ended_at: string | null;
  total_minutes: number;
  status: string;
}
interface SegmentRow {
  id: string;
  session_id: string;
  category: string;
  actual_seconds: number;
  created_at: string;
}

const dayKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const fmtMin = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

// Heatmap colors (5 levels) — using primary HSL with opacity
const heatBg = (level: number) => {
  if (level === 0) return "bg-muted/30";
  if (level === 1) return "bg-primary/20";
  if (level === 2) return "bg-primary/40";
  if (level === 3) return "bg-primary/60";
  if (level === 4) return "bg-primary/80";
  return "bg-primary";
};

export default function TeamPractice() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [logDate, setLogDate] = useState(dayKey(new Date()));
  const [logHours, setLogHours] = useState("");
  const [logMinutes, setLogMinutes] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [logSong, setLogSong] = useState("");
  const [logSubmitting, setLogSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [s, seg] = await Promise.all([
      supabase
        .from("practice_sessions")
        .select("id, preset_name, started_at, ended_at, total_minutes, status")
        .order("started_at", { ascending: false }),
      supabase
        .from("practice_session_segments")
        .select("id, session_id, category, actual_seconds, created_at")
        .order("created_at", { ascending: false }),
    ]);
    setSessions((s.data as SessionRow[]) || []);
    setSegments((seg.data as SegmentRow[]) || []);
    setLoading(false);
  };

  const submitPastSession = async () => {
    const h = parseInt(logHours || "0", 10) || 0;
    const m = parseInt(logMinutes || "0", 10) || 0;
    const total = h * 60 + m;
    if (total <= 0) {
      toast({ title: "Add a duration", description: "Hours or minutes must be > 0.", variant: "destructive" });
      return;
    }
    if (!logDate) {
      toast({ title: "Pick a date", variant: "destructive" });
      return;
    }
    setLogSubmitting(true);
    const startedAt = new Date(`${logDate}T18:00:00`);
    const endedAt = new Date(startedAt.getTime() + total * 60_000);
    const { error } = await supabase.from("practice_sessions").insert({
      preset_id: null,
      preset_name: "Manual entry",
      song_of_the_day: logSong || "",
      notes: logNotes || "",
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      total_minutes: total,
      status: "completed",
    });
    setLogSubmitting(false);
    if (error) {
      toast({ title: "Couldn't save session", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Session logged", description: `${fmtMin(total)} on ${logDate}` });
    setLogOpen(false);
    setLogHours("");
    setLogMinutes("");
    setLogNotes("");
    setLogSong("");
    load();
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("practice_analytics")
      .on("postgres_changes", { event: "*", schema: "public", table: "practice_sessions" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Per-day total minutes (from sessions for fastest aggregate)
  const dayTotals = useMemo(() => {
    const map = new Map<string, number>();
    sessions.forEach((s) => {
      const k = dayKey(new Date(s.started_at));
      map.set(k, (map.get(k) || 0) + (s.total_minutes || 0));
    });
    return map;
  }, [sessions]);

  // Week / month totals
  const today = startOfDay(new Date());
  const weekAgo = addDays(today, -6);
  const monthAgo = addDays(today, -29);

  const weekMin = useMemo(() => {
    let t = 0;
    for (let i = 0; i < 7; i++) t += dayTotals.get(dayKey(addDays(weekAgo, i))) || 0;
    return t;
  }, [dayTotals, weekAgo]);
  const monthMin = useMemo(() => {
    let t = 0;
    for (let i = 0; i < 30; i++) t += dayTotals.get(dayKey(addDays(monthAgo, i))) || 0;
    return t;
  }, [dayTotals, monthAgo]);
  const allTimeMin = useMemo(
    () => sessions.reduce((a, s) => a + (s.total_minutes || 0), 0),
    [sessions]
  );

  // Streak: consecutive days up to today with >0 minutes
  const streak = useMemo(() => {
    let count = 0;
    let cursor = new Date(today);
    while ((dayTotals.get(dayKey(cursor)) || 0) > 0) {
      count += 1;
      cursor = addDays(cursor, -1);
      if (count > 365) break;
    }
    return count;
  }, [dayTotals, today]);

  const longestStreak = useMemo(() => {
    let best = 0;
    let cur = 0;
    for (let i = 0; i < 365; i++) {
      const k = dayKey(addDays(today, -i));
      if ((dayTotals.get(k) || 0) > 0) {
        cur += 1;
        best = Math.max(best, cur);
      } else cur = 0;
    }
    return best;
  }, [dayTotals, today]);

  // Category breakdown (last 30 days)
  const categoryTotals = useMemo(() => {
    const since = monthAgo.getTime();
    const map = new Map<string, number>();
    segments.forEach((s) => {
      if (new Date(s.created_at).getTime() < since) return;
      map.set(s.category, (map.get(s.category) || 0) + (s.actual_seconds || 0));
    });
    return Array.from(map.entries())
      .map(([cat, sec]) => ({ category: cat, minutes: Math.round(sec / 60) }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [segments, monthAgo]);

  const categoryMax = categoryTotals[0]?.minutes || 1;

  // Compact heatmap = last 53 weeks (~1 year). "All time" = span back to the
  // earliest session, uncapped — the container already overflow-scrolls so a
  // 5-year history will just be horizontally scrollable.
  const [heatmapAllTime, setHeatmapAllTime] = useState(false);

  const heatmapAllTimeWeeks = useMemo(() => {
    const earliest = sessions.length
      ? new Date(sessions[sessions.length - 1].started_at)
      : addDays(today, -52 * 7);
    const earliestDay = startOfDay(earliest);
    const daysSpan = Math.ceil((today.getTime() - earliestDay.getTime()) / (1000 * 60 * 60 * 24));
    const computed = Math.ceil(daysSpan / 7) + 1;
    return Math.max(53, computed);
  }, [sessions, today]);

  const heatmapWeeks = heatmapAllTime ? heatmapAllTimeWeeks : 53;

  const heatmap = useMemo(() => {
    const end = today;
    const endDow = end.getDay();
    const lastSunday = addDays(end, -endDow);
    const startSunday = addDays(lastSunday, -(heatmapWeeks - 1) * 7);
    const max = Math.max(...Array.from(dayTotals.values()), 1);
    const weeks: { date: Date; minutes: number; level: number }[][] = [];
    for (let w = 0; w < heatmapWeeks; w++) {
      const col: { date: Date; minutes: number; level: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(startSunday, w * 7 + d);
        if (date > end) {
          col.push({ date, minutes: -1, level: -1 });
          continue;
        }
        const minutes = dayTotals.get(dayKey(date)) || 0;
        let level = 0;
        if (minutes > 0) {
          const ratio = minutes / max;
          if (ratio < 0.25) level = 1;
          else if (ratio < 0.5) level = 2;
          else if (ratio < 0.75) level = 3;
          else level = 4;
        }
        col.push({ date, minutes, level });
      }
      weeks.push(col);
    }
    return weeks;
  }, [dayTotals, today, heatmapWeeks]);

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

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12">
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
              <Activity className="w-7 h-7 text-primary" /> Practice Analytics
            </h1>
            <p className="text-muted-foreground mt-2">
              Totals, streaks, category breakdown, and a practice heatmap spanning your full history.
            </p>
          </div>
          <Dialog open={logOpen} onOpenChange={setLogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> Log past session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log a past session</DialogTitle>
                <DialogDescription>
                  Backfill a practice session you forgot to start the timer for.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="log-date">Date</Label>
                  <Input
                    id="log-date"
                    type="date"
                    value={logDate}
                    max={dayKey(new Date())}
                    onChange={(e) => setLogDate(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="log-hours">Hours</Label>
                    <Input
                      id="log-hours"
                      type="number"
                      min="0"
                      max="24"
                      placeholder="0"
                      value={logHours}
                      onChange={(e) => setLogHours(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="log-minutes">Minutes</Label>
                    <Input
                      id="log-minutes"
                      type="number"
                      min="0"
                      max="59"
                      placeholder="0"
                      value={logMinutes}
                      onChange={(e) => setLogMinutes(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="log-song">Song of the day (optional)</Label>
                  <Input
                    id="log-song"
                    value={logSong}
                    onChange={(e) => setLogSong(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="log-notes">Notes (optional)</Label>
                  <Textarea
                    id="log-notes"
                    rows={3}
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setLogOpen(false)} disabled={logSubmitting}>
                  Cancel
                </Button>
                <Button onClick={submitPastSession} disabled={logSubmitting}>
                  {logSubmitting ? "Saving…" : "Save session"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Practice timer */}
        <div className="mb-6">
          <PracticeTimerWidget />
        </div>

        {/* Practice library — songs + lines + voicings + etc., color-coded */}
        <div className="mb-6">
          <PracticeItemsWidget />
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatTile icon={<Clock className="w-4 h-4" />} label="This week" value={fmtMin(weekMin)} sub={`${(weekMin / 7).toFixed(0)} min/day avg`} />
          <StatTile icon={<Calendar className="w-4 h-4" />} label="Last 30 days" value={fmtMin(monthMin)} sub={`${(monthMin / 30).toFixed(0)} min/day avg`} />
          <StatTile icon={<Flame className="w-4 h-4" />} label="Current streak" value={`${streak} day${streak === 1 ? "" : "s"}`} sub={`Best: ${longestStreak}`} />
          <StatTile icon={<BarChart3 className="w-4 h-4" />} label="All time" value={fmtMin(allTimeMin)} sub={`${sessions.length} sessions`} />
        </div>

        {/* Category breakdown + Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Category breakdown · last 30 days
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!loading && categoryTotals.length === 0 && (
                <p className="text-sm text-muted-foreground">No segments logged yet.</p>
              )}
              <div className="space-y-2">
                {categoryTotals.map((c) => (
                  <div key={c.category}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{c.category}</span>
                      <span className="text-muted-foreground font-mono">{fmtMin(c.minutes)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(c.minutes / categoryMax) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Recent sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 && <p className="text-sm text-muted-foreground">No sessions yet.</p>}
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {sessions.slice(0, 20).map((s) => (
                  <div key={s.id} className="flex items-center justify-between border rounded p-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.preset_name || "Custom"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.started_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={s.status === "completed" ? "default" : "secondary"}>
                      {fmtMin(s.total_minutes || 0)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Heatmap */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="w-4 h-4 text-primary" />
                Practice heatmap ·{" "}
                {heatmapAllTime
                  ? `all time (${Math.round(heatmapAllTimeWeeks / 52 * 10) / 10}y)`
                  : "last 12 months"}
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setHeatmapAllTime((v) => !v)}
                className="h-7 text-xs gap-1"
                title={
                  heatmapAllTime
                    ? "Show last 12 months only"
                    : "Show the full history (scrolls horizontally)"
                }
              >
                {heatmapAllTime ? "Compact" : "Show all time"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                {/* Month labels */}
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
                  {/* Day labels */}
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
                          title={cell.minutes < 0 ? "" : `${dayKey(cell.date)} — ${fmtMin(cell.minutes)}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                {/* Legend */}
                <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground">
                  <span>Less</span>
                  {[0, 1, 2, 3, 4].map((l) => (
                    <div key={l} className={`w-[11px] h-[11px] rounded-sm ${heatBg(l)}`} />
                  ))}
                  <span>More</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TeamLayout>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-1">
          {icon} {label}
        </div>
        <p className="font-mono text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
