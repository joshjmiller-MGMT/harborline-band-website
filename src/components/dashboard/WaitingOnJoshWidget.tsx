import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Check, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

type Row = {
  id: string;
  title: string;
  detail: string | null;
  source_session: string | null;
  priority: string;
  queued_at: string;
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function ageLabel(queuedAt: string): string {
  const ms = Date.now() - new Date(queuedAt).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

const PRIORITY_RANK: Record<string, number> = { high: 0, normal: 1, low: 2 };

export default function WaitingOnJoshWidget() {
  const [rows, setRows] = useState<Row[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [resolving, setResolving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("waiting_on_josh")
        .select("id, title, detail, source_session, priority, queued_at")
        .is("resolved_at", null)
        .order("queued_at", { ascending: false });
      if (error) throw error;
      const sorted = (data || []).slice().sort((a, b) => {
        const pr = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
        if (pr !== 0) return pr;
        return new Date(b.queued_at).getTime() - new Date(a.queued_at).getTime();
      });
      setRows(sorted);
    } catch (e) {
      console.error("WaitingOnJoshWidget load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [load]);

  async function resolve(id: string) {
    if (!confirm("Mark resolved?")) return;
    setResolving((r) => ({ ...r, [id]: true }));
    try {
      const { error } = await supabase
        .from("waiting_on_josh")
        .update({ resolved_at: new Date().toISOString(), resolved_by: "josh" })
        .eq("id", id);
      if (error) throw error;
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      console.error("resolve error:", e);
      alert("Couldn't resolve. Check console.");
    } finally {
      setResolving((r) => ({ ...r, [id]: false }));
    }
  }

  if (rows.length === 0 && !loading) {
    return (
      <div className="rounded border border-border/40 bg-card/30 p-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <UserCheck className="w-4 h-4 text-primary" />
          Nothing waiting on you. Good.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-border/40 bg-card/30">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-display tracking-wide-custom text-foreground">Waiting on Josh</h4>
          <Badge variant="outline" className="text-xs">{rows.length}</Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={load} disabled={loading} title="Refresh">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <ul className="divide-y divide-border/40">
        {rows.map((r) => {
          const isOpen = !!expanded[r.id];
          const isResolving = !!resolving[r.id];
          return (
            <li key={r.id} className="px-3 py-2">
              <div className="flex items-start gap-2">
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [r.id]: !e[r.id] }))}
                  className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={isOpen ? "Collapse" : "Expand"}
                >
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.priority === "high" && (
                      <Badge variant="destructive" className="text-[10px] uppercase tracking-wider">
                        High
                      </Badge>
                    )}
                    {r.priority === "low" && (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                        Low
                      </Badge>
                    )}
                    <span className="text-sm text-foreground">{r.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    {r.source_session && (
                      <span className="font-mono opacity-70">{r.source_session}</span>
                    )}
                    <span>·</span>
                    <span>queued {ageLabel(r.queued_at)}</span>
                  </div>
                  {isOpen && r.detail && (
                    <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap leading-relaxed">
                      {r.detail}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => resolve(r.id)}
                  disabled={isResolving}
                  title="Mark resolved"
                  className="flex-shrink-0"
                >
                  <Check className={`w-4 h-4 ${isResolving ? "opacity-50" : "text-primary"}`} />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
