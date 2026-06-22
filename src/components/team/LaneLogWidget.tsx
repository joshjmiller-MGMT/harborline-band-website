import { useCallback, useEffect, useMemo, useState } from "react";
// NOTE: `work_claims` is the orchestration lease table (JARSH + Legion/Mac branch
// sessions). It is NOT in the generated Supabase `types.ts`, so the typed
// `supabase.from(...)` overload doesn't know it — we cast the client to `any` for
// this one read. RLS already allows `authenticated` full access and `/team/*` is
// auth-gated, so the operator can read it directly with no edge function.
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CircleDot,
  CircleDashed,
  CheckCircle2,
  GitBranch,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

type LaneStatus = "in_progress" | "available" | "done" | string;

type LaneRow = {
  work_key: string;
  title: string | null;
  status: LaneStatus;
  claimed_by: string | null;
  machine: string | null;
  branch: string | null;
  pr_url: string | null;
  priority: number | null;
  spec_ref: string | null;
  notes: string | null;
  heartbeat_at: string | null;
  claimed_at: string | null;
  released_at: string | null;
};

// Live ops view — poll fairly tight so Josh sees claims/handoffs as they happen.
const REFRESH_INTERVAL_MS = 30 * 1000;
// An in-progress lane whose heartbeat is older than this is likely a dead session
// holding a lease (the "stale-sweep" hazard). Flag it so Josh can free it.
const STALE_HEARTBEAT_MS = 15 * 60 * 1000;
// Cap the Done section so a long history doesn't dominate the widget.
const DONE_LIMIT = 12;

function ageLabel(ts: string | null): string {
  if (!ts) return "—";
  const ms = Date.now() - new Date(ts).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function isStale(row: LaneRow): boolean {
  if (row.status !== "in_progress" || !row.heartbeat_at) return false;
  return Date.now() - new Date(row.heartbeat_at).getTime() > STALE_HEARTBEAT_MS;
}

const STATUS_META: Record<
  string,
  { label: string; icon: typeof CircleDot; dot: string }
> = {
  in_progress: { label: "Working now", icon: CircleDot, dot: "text-amber-500" },
  available: { label: "Queued", icon: CircleDashed, dot: "text-muted-foreground" },
  done: { label: "Done", icon: CheckCircle2, dot: "text-emerald-500" },
};

export default function LaneLogWidget() {
  const [rows, setRows] = useState<LaneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => Promise<{ data: LaneRow[] | null; error: { message: string } | null }>;
        };
      })
        .from("work_claims")
        .select(
          "work_key, title, status, claimed_by, machine, branch, pr_url, priority, spec_ref, notes, heartbeat_at, claimed_at, released_at",
        );
      if (error) throw new Error(error.message);
      setRows(data || []);
      setError(null);
      setLastSync(new Date().toISOString());
    } catch (e) {
      console.error("LaneLogWidget load error:", e);
      setError(e instanceof Error ? e.message : "Failed to load lanes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [load]);

  const groups = useMemo(() => {
    const inProgress = rows
      .filter((r) => r.status === "in_progress")
      .sort((a, b) => {
        // stale first (needs attention), then freshest heartbeat
        const sa = isStale(a) ? 1 : 0;
        const sb = isStale(b) ? 1 : 0;
        if (sa !== sb) return sb - sa;
        return (
          new Date(b.heartbeat_at ?? 0).getTime() -
          new Date(a.heartbeat_at ?? 0).getTime()
        );
      });
    const available = rows
      .filter((r) => r.status === "available")
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    const done = rows
      .filter((r) => r.status === "done")
      .sort(
        (a, b) =>
          new Date(b.released_at ?? b.heartbeat_at ?? 0).getTime() -
          new Date(a.released_at ?? a.heartbeat_at ?? 0).getTime(),
      );
    return { inProgress, available, done };
  }, [rows]);

  const staleCount = groups.inProgress.filter(isStale).length;

  function toggle(key: string) {
    setExpanded((e) => ({ ...e, [key]: !e[key] }));
  }

  function renderRow(row: LaneRow) {
    const open = !!expanded[row.work_key];
    const stale = isStale(row);
    return (
      <li key={row.work_key} className="px-3 py-2">
        <div className="flex items-start gap-2">
          <button
            onClick={() => toggle(row.work_key)}
            className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <code className="text-xs font-mono text-foreground">{row.work_key}</code>
              {typeof row.priority === "number" && (
                <Badge variant="outline" className="text-[10px]">
                  P{row.priority}
                </Badge>
              )}
              {row.machine && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {row.machine}
                </span>
              )}
              {stale && (
                <Badge
                  variant="destructive"
                  className="text-[10px] uppercase tracking-wider inline-flex items-center gap-1"
                  title="No heartbeat in 15+ min — session may be dead, holding the lease"
                >
                  <AlertTriangle className="w-3 h-3" /> stale
                </Badge>
              )}
            </div>
            {row.title && (
              <p className="text-sm text-foreground leading-snug mt-0.5">{row.title}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
              {row.claimed_by && row.claimed_by !== "(unclaimed)" && (
                <span className="font-mono opacity-70">{row.claimed_by}</span>
              )}
              {row.status === "in_progress" && (
                <span>· beat {ageLabel(row.heartbeat_at)}</span>
              )}
              {row.status === "done" && row.released_at && (
                <span>· done {ageLabel(row.released_at)}</span>
              )}
              {row.pr_url && (
                <a
                  href={row.pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  PR <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            {open && (
              <div className="mt-2 space-y-1.5 text-[11px] text-muted-foreground">
                {row.branch && row.branch !== "-" && (
                  <div className="flex items-center gap-1.5">
                    <GitBranch className="w-3 h-3 flex-shrink-0" />
                    <code className="font-mono">{row.branch}</code>
                  </div>
                )}
                {row.spec_ref && (
                  <div>
                    <span className="uppercase tracking-wider opacity-70">Spec:</span>{" "}
                    <span className="font-mono break-all">{row.spec_ref}</span>
                  </div>
                )}
                {row.notes && (
                  <p className="whitespace-pre-wrap leading-relaxed bg-muted/30 rounded p-2">
                    {row.notes}
                  </p>
                )}
                {row.claimed_at && (
                  <div className="opacity-70">claimed {ageLabel(row.claimed_at)}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </li>
    );
  }

  function renderSection(status: "in_progress" | "available" | "done", list: LaneRow[]) {
    if (list.length === 0) return null;
    const meta = STATUS_META[status];
    const SectionIcon = meta.icon;
    const collapsible = status === "done";
    const visible = collapsible && !showDone ? [] : list.slice(0, collapsible ? DONE_LIMIT : list.length);
    return (
      <div key={status}>
        <button
          onClick={() => collapsible && setShowDone((s) => !s)}
          className={`flex items-center gap-2 w-full px-3 py-1.5 bg-muted/20 border-y border-border/40 ${
            collapsible ? "hover:bg-muted/40 transition-colors" : "cursor-default"
          }`}
        >
          <SectionIcon className={`w-3.5 h-3.5 ${meta.dot}`} />
          <span className="text-xs font-display tracking-wide-custom text-foreground">
            {meta.label}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {list.length}
          </Badge>
          {collapsible && (
            <span className="ml-auto text-muted-foreground">
              {showDone ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </span>
          )}
        </button>
        {visible.length > 0 && (
          <ul className="divide-y divide-border/40">{visible.map(renderRow)}</ul>
        )}
        {collapsible && showDone && list.length > DONE_LIMIT && (
          <p className="px-3 py-1.5 text-[11px] text-muted-foreground">
            +{list.length - DONE_LIMIT} older done lanes not shown
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded border border-border/40 bg-card/30">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-display tracking-wide-custom text-foreground">
            Lane Log
          </h4>
          <Badge variant="outline" className="text-xs">
            {groups.inProgress.length} working · {groups.available.length} queued
          </Badge>
          {staleCount > 0 && (
            <Badge variant="destructive" className="text-[10px] uppercase tracking-wider">
              {staleCount} stale
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              synced {ageLabel(lastSync)}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={load}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="px-3 py-4 text-sm text-destructive">
          Couldn't load lanes: {error}
        </div>
      ) : rows.length === 0 && !loading ? (
        <div className="px-3 py-4 text-sm text-muted-foreground">No lanes in the log.</div>
      ) : (
        <div>
          {renderSection("in_progress", groups.inProgress)}
          {renderSection("available", groups.available)}
          {renderSection("done", groups.done)}
        </div>
      )}
    </div>
  );
}
