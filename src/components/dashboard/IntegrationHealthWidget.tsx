// P331c — Integration health widget. Top-row sibling to UnifiedCalendarWidget.
//
// Reads the freshest health snapshot by invoking integration-health-check via
// supabase.functions.invoke() — this auto-attaches the operator session JWT
// (avoiding the P328 anon-JWT regression class) and the fn persists a fresh
// row into integration_health_history every call, so the daily cron history
// stays continuous regardless of dashboard activity.
//
// The history table is RLS-on with no SELECT policies, so a direct PostgREST
// read would 403. Going through the fn is the frontend-only path. A future
// follow-up could add a SELECT policy for instant reads if mount-time adapter
// cost ever becomes a concern.
//
// Per Q2 lock (2026-05-18 decisions): mounts as a top-row sidebar card sibling
// to UnifiedCalendarWidget.

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

type Status = "green" | "yellow" | "red";

interface AdapterResult {
  integration: string;
  status: Status;
  detail?: string;
  metric?: number | string;
  checked_at: string;
}

interface HealthReport {
  adapters: AdapterResult[];
  overall: Status;
  generated_at: string;
  persist_error?: string;
}

const LABELS: Record<string, string> = {
  "auth-gate": "Auth gate",
  "secrets-sanity": "Supabase secrets",
  "google-calendar": "Google Calendar",
  "google-calendar-read-path": "Google read path",
  "gmail-scope": "Gmail scope",
  "monday": "Monday",
  "djep-availability": "DJEP",
  "trello-latency": "Trello",
  "djep-scrub": "DJEP scrub",
  "edge-fn-error-rate": "Edge fn errors",
};

const DOT: Record<Status, string> = {
  green: "bg-emerald-500",
  yellow: "bg-yellow-500",
  red: "bg-destructive",
};

const PILL_TEXT: Record<Status, string> = {
  green: "text-emerald-500",
  yellow: "text-yellow-500",
  red: "text-destructive",
};

function label(integration: string): string {
  return LABELS[integration] ?? integration;
}

export default function IntegrationHealthWidget() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "integration-health-check",
      );
      if (fnErr) {
        let body: string | null = null;
        try {
          body = JSON.stringify(await (fnErr as any).context?.json?.());
        } catch {
          // structured body unavailable
        }
        throw new Error(body ?? fnErr.message);
      }
      setReport(data as HealthReport);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const overall = report?.overall ?? null;
  const generatedAt = report?.generated_at ?? null;

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="font-display text-lg tracking-wide-custom flex items-center gap-2 text-foreground">
          <Activity className="w-5 h-5 text-primary" />
          Integration Health
          {overall && (
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${DOT[overall]}`}
              aria-label={`overall ${overall}`}
            />
          )}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={load}
          disabled={loading}
          title="Refresh all"
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh all
        </Button>
      </CardHeader>
      <CardContent>
        {generatedAt && (
          <p className="text-xs text-muted-foreground mb-3">
            Last checked {formatDistanceToNow(new Date(generatedAt), { addSuffix: true })}
          </p>
        )}

        {error && (
          <div className="text-sm text-destructive border border-destructive/40 rounded p-2 mb-3">
            Health check failed: {error}
          </div>
        )}

        {report?.persist_error && (
          <div className="text-xs text-yellow-500 border border-yellow-500/40 rounded p-2 mb-3">
            Snapshot loaded but persist failed: {report.persist_error}
          </div>
        )}

        {loading && !report && (
          <p className="text-sm text-muted-foreground">Running checks…</p>
        )}

        {report && report.adapters.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">No adapters reported.</p>
        )}

        {report && report.adapters.length > 0 && (
          <ul className="space-y-1">
            {report.adapters.map((r, idx) => {
              const isOpen = expanded.has(idx);
              return (
                <li key={`${r.integration}-${idx}`} className="border border-border/50 rounded">
                  <button
                    type="button"
                    onClick={() => toggle(idx)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/40 transition-colors"
                  >
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT[r.status]}`}
                      aria-label={r.status}
                    />
                    <span className="text-sm text-foreground flex-1 truncate">
                      {label(r.integration)}
                    </span>
                    {r.metric != null && (
                      <span className="text-xs text-muted-foreground truncate max-w-[40%]">
                        {String(r.metric)}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-2 pt-1 text-xs space-y-1 border-t border-border/40">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-20 flex-shrink-0">Status</span>
                        <span className={`${PILL_TEXT[r.status]} font-medium`}>{r.status}</span>
                      </div>
                      {r.detail && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-20 flex-shrink-0">Detail</span>
                          <span className="text-foreground break-words">{r.detail}</span>
                        </div>
                      )}
                      {r.metric != null && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-20 flex-shrink-0">Metric</span>
                          <span className="text-foreground break-words">{String(r.metric)}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-20 flex-shrink-0">Checked</span>
                        <span className="text-foreground">
                          {formatDistanceToNow(new Date(r.checked_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
