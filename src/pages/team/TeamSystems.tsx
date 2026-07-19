import { useCallback, useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { LayoutGrid, RefreshCw, ExternalLink, AlertCircle, Pin } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// The backend touchpoint for EVERYTHING — a registry of every system/workstream
// Claude runs, with status, where to interface (backend_path), where its
// knowledge lives (brain_ref), and how it's secured. Josh directs from here.

type SystemRow = {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string | null;
  status: string;
  backend_path: string | null;
  brain_ref: string | null;
  health: string | null;
  security_note: string | null;
  current_work: string | null;
  just_finished: string | null;
  up_next: string | null;
  blocked_on: string | null;
  pinned: boolean;
  sort_order: number;
  last_activity: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  in_flight: "bg-sky-500/15 text-sky-400",
  planned: "bg-amber-500/15 text-amber-400",
  idea: "bg-fuchsia-500/15 text-fuchsia-400",
  paused: "bg-muted/60 text-muted-foreground",
};
const STATUSES = ["active", "in_flight", "planned", "idea", "paused"];

export default function TeamSystems() {
  const [rows, setRows] = useState<SystemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("systems_registry")
      .select("id, key, name, category, description, status, backend_path, brain_ref, health, security_note, pinned, sort_order, last_activity, current_work, just_finished, up_next, blocked_on")
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data ?? []) as SystemRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setStatus = useCallback(async (id: string, status: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase.from("systems_registry").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Failed to save"); void load(); }
  }, [load]);

  const filtered = useMemo(
    () => (statusFilter ? rows.filter((r) => r.status === statusFilter) : rows),
    [rows, statusFilter],
  );

  const byCategory = useMemo(() => {
    const m = new Map<string, SystemRow[]>();
    for (const r of filtered) (m.get(r.category) ?? m.set(r.category, []).get(r.category)!).push(r);
    return [...m.entries()];
  }, [filtered]);

  const stats = useMemo(() => {
    const s: Record<string, number> = { active: 0, in_flight: 0, planned: 0, idea: 0, paused: 0 };
    let noBackend = 0;
    for (const r of rows) { s[r.status] = (s[r.status] ?? 0) + 1; if (!r.backend_path) noBackend++; }
    return { s, noBackend };
  }, [rows]);

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
              <LayoutGrid className="w-7 h-7 text-primary" /> Systems
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              The backend touchpoint for everything — {rows.length} systems · {stats.s.active} active · {stats.s.in_flight} in flight · {stats.noBackend} without a surface yet
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {/* Status filter chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button onClick={() => setStatusFilter("")} className={`text-xs px-2 py-1 rounded border ${statusFilter === "" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
            All ({rows.length})
          </button>
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              className={`text-xs px-2 py-1 rounded border ${statusFilter === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
              {s.replace("_", " ")} ({stats.s[s] ?? 0})
            </button>
          ))}
        </div>

        <div className="space-y-5">
          {byCategory.map(([cat, items]) => (
            <div key={cat}>
              <h2 className="font-display text-lg tracking-wide-custom text-foreground mb-2">{cat}</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {items.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border bg-card/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {r.pinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                          {r.backend_path ? (
                            <Link to={r.backend_path} className="text-sm font-medium text-foreground hover:text-primary inline-flex items-center gap-1">
                              {r.name} <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : (
                            <span className="text-sm font-medium text-foreground">{r.name}</span>
                          )}
                        </div>
                        {r.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{r.description}</p>}
                      </div>
                      <select
                        value={r.status}
                        onChange={(e) => setStatus(r.id, e.target.value)}
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border-0 shrink-0 cursor-pointer ${STATUS_STYLE[r.status] ?? STATUS_STYLE.paused}`}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    {r.health && <p className="text-[11px] text-foreground/80 mt-1.5">{r.health}</p>}
                    {/* CEO glance (Josh 2026-07-19): now / just shipped / next / hang-up */}
                    {(r.current_work || r.just_finished || r.up_next || r.blocked_on) && (
                      <div className="mt-1.5 space-y-0.5 text-[11px]">
                        {r.current_work && (
                          <p className="text-foreground/90"><span className="text-green-500 font-medium">Now:</span> {r.current_work}</p>
                        )}
                        {r.just_finished && (
                          <p className="text-muted-foreground"><span className="text-sky-400 font-medium">Shipped:</span> {r.just_finished}</p>
                        )}
                        {r.up_next && (
                          <p className="text-muted-foreground"><span className="text-violet-400 font-medium">Next:</span> {r.up_next}</p>
                        )}
                        {r.blocked_on && (
                          <p className="text-amber-500"><span className="font-medium">Hang-up:</span> {r.blocked_on}</p>
                        )}
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
                      {!r.backend_path && (
                        <span className="inline-flex items-center gap-1 text-amber-400">
                          <AlertCircle className="w-3 h-3" /> no backend surface yet
                        </span>
                      )}
                      {r.brain_ref && <span className="truncate">brain: {r.brain_ref}</span>}
                      {r.last_activity && <span>· {r.last_activity}</span>}
                    </div>
                    {r.security_note && r.security_note !== "n/a" && (
                      <p className="text-[10px] text-muted-foreground/70 mt-1">🔒 {r.security_note}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!loading && rows.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No systems registered.</p>
          )}
        </div>
      </div>
    </TeamLayout>
  );
}
