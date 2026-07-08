import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Day plan — Josh's time-blocked day template (from the Trello Daily's bucket),
// on the dashboard (smartify restructure P4, 2026-07-07). Timed blocks render as
// an hour-by-hour rail; flexible blocks sit below. Check-off resets daily
// (client-side, keyed by date). V1 of the day/week time-blocking system.
type Block = {
  id: string;
  title: string;
  kind: string;
  duration_min: number;
  preferred_time: string | null;
  active: boolean;
  note: string | null;
  sort_order: number;
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DayPlanWidget() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // per-day check-off state, local
    try {
      const raw = localStorage.getItem(`dayplan-${todayKey()}`);
      if (raw) setDone(new Set(JSON.parse(raw) as string[]));
    } catch { /* fresh day */ }
    void (async () => {
      const { data } = await supabase
        .from("time_blocks")
        .select("id, title, kind, duration_min, preferred_time, active, note, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      setBlocks((data ?? []) as Block[]);
      setLoading(false);
    })();
  }, []);

  const toggle = useCallback((id: string) => {
    setDone((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      try { localStorage.setItem(`dayplan-${todayKey()}`, JSON.stringify([...n])); } catch { /* ok */ }
      return n;
    });
  }, []);

  const timed = useMemo(() => blocks.filter((b) => b.preferred_time && /^\d/.test(b.preferred_time)), [blocks]);
  const flexible = useMemo(() => blocks.filter((b) => !b.preferred_time || !/^\d/.test(b.preferred_time)), [blocks]);
  const nowHour = new Date().getHours();

  if (loading || blocks.length === 0) return null;

  const fmt = (t: string) => {
    const h = parseInt(t.slice(0, 2), 10);
    return h === 12 ? "12pm" : h > 12 ? `${h - 12}pm` : `${h}am`;
  };

  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" /> Day plan
          <span className="text-xs text-muted-foreground">({done.size}/{blocks.length} done)</span>
        </h3>
        <button
          onClick={() => { setDone(new Set()); try { localStorage.removeItem(`dayplan-${todayKey()}`); } catch { /* ok */ } toast.success("Day plan reset"); }}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          reset
        </button>
      </div>

      <ul className="space-y-1">
        {timed.map((b) => {
          const h = parseInt((b.preferred_time as string).slice(0, 2), 10);
          const isNow = nowHour === h;
          const checked = done.has(b.id);
          return (
            <li key={b.id}
              className={`flex items-center gap-2.5 rounded px-2 py-1.5 ${isNow ? "bg-primary/10 border border-primary/30" : ""} ${checked ? "opacity-50" : ""}`}>
              <span className="text-[11px] tabular-nums text-muted-foreground w-10 shrink-0">{fmt(b.preferred_time as string)}</span>
              <button
                onClick={() => toggle(b.id)}
                className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${checked ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "border-border hover:border-foreground"}`}
              >
                {checked && <Check className="w-3 h-3" />}
              </button>
              <span className={`text-sm text-foreground truncate ${checked ? "line-through" : ""}`}>
                {b.title.replace(/^\d+\s*-\s*/, "")}
              </span>
              {isNow && <span className="ml-auto text-[10px] uppercase tracking-wider text-primary shrink-0">now</span>}
            </li>
          );
        })}
      </ul>

      {flexible.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground">Flexible:</span>
          {flexible.map((b) => {
            const checked = done.has(b.id);
            return (
              <button key={b.id} onClick={() => toggle(b.id)}
                className={`text-[11px] px-2 py-0.5 rounded border inline-flex items-center gap-1 ${checked ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 line-through" : "border-border text-foreground hover:bg-muted/40"}`}>
                {checked && <Check className="w-3 h-3" />}{b.title}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
