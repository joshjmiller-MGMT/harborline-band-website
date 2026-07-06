import { useCallback, useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Landmark, RefreshCw, ExternalLink, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type GrantRow = {
  id: string;
  name: string;
  act: string | null;
  deadline: string | null;
  deadline_note: string | null;
  award_range: string | null;
  fit: string | null;
  status: string;
  url: string | null;
  materials_status: string | null;
  notes: string | null;
  brain_ref: string | null;
  sort_order: number;
};

const STATUSES = ["researching", "drafting", "submitted", "awarded", "declined", "skip", "bookmark"];
const STATUS_STYLE: Record<string, string> = {
  researching: "bg-amber-500/15 text-amber-400",
  drafting: "bg-sky-500/15 text-sky-400",
  submitted: "bg-violet-500/15 text-violet-400",
  awarded: "bg-emerald-500/15 text-emerald-400",
  declined: "bg-rose-500/15 text-rose-400",
  skip: "bg-muted/60 text-muted-foreground",
  bookmark: "bg-muted/60 text-muted-foreground",
};
const FIT_STYLE: Record<string, string> = {
  strong: "bg-emerald-500/15 text-emerald-400",
  stretch: "bg-amber-500/15 text-amber-400",
  skip: "bg-muted/60 text-muted-foreground",
};

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const ms = Date.parse(`${d}T23:59:59`) - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export default function TeamGrants() {
  const [rows, setRows] = useState<GrantRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("grants")
      .select("id, name, act, deadline, deadline_note, award_range, fit, status, url, materials_status, notes, brain_ref, sort_order")
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data ?? []) as GrantRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setStatus = useCallback(async (id: string, status: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase.from("grants").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Failed to save"); void load(); }
  }, [load]);

  // Sort: live deadlines first (soonest), then undated.
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const da = a.deadline ? Date.parse(a.deadline) : Infinity;
      const db = b.deadline ? Date.parse(b.deadline) : Infinity;
      return da - db || a.sort_order - b.sort_order;
    });
  }, [rows]);

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
              <Landmark className="w-7 h-7 text-primary" /> Grants & Funding
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {rows.length} opportunities · time-sensitive first
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <div className="space-y-2">
          {sorted.map((g) => {
            const days = daysUntil(g.deadline);
            const urgent = days !== null && days >= 0 && days <= 14 && !["submitted", "awarded", "declined", "skip"].includes(g.status);
            return (
              <div key={g.id} className={`rounded-lg border bg-card/40 p-3.5 ${urgent ? "border-amber-500/40" : "border-border"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{g.name}</span>
                      {g.act && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary">{g.act}</span>}
                      {g.fit && <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${FIT_STYLE[g.fit] ?? ""}`}>{g.fit} fit</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                      {g.deadline ? (
                        <span className={`inline-flex items-center gap-1 ${urgent ? "text-amber-400 font-medium" : ""}`}>
                          <CalendarClock className="w-3 h-3" />
                          {g.deadline}{days !== null && days >= 0 ? ` · ${days}d left` : days !== null ? " · past" : ""}
                          {g.deadline_note ? ` (${g.deadline_note})` : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {g.deadline_note || "no fixed deadline"}</span>
                      )}
                      {g.award_range && <span>· {g.award_range}</span>}
                      {g.url && (
                        <a href={g.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
                          apply <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                  <select
                    value={g.status}
                    onChange={(e) => setStatus(g.id, e.target.value)}
                    className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border-0 shrink-0 cursor-pointer ${STATUS_STYLE[g.status] ?? ""}`}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {g.materials_status && (
                  <p className="text-[11px] text-foreground/80 mt-2"><span className="text-muted-foreground">Materials:</span> {g.materials_status}</p>
                )}
                {g.notes && <p className="text-[11px] text-muted-foreground mt-1">{g.notes}</p>}
                {g.brain_ref && <p className="text-[10px] text-muted-foreground/70 mt-1">brain: {g.brain_ref}</p>}
              </div>
            );
          })}
          {!loading && rows.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No grants tracked yet.</p>
          )}
        </div>
      </div>
    </TeamLayout>
  );
}
