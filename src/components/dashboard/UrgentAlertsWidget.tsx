import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, RefreshCw, ExternalLink } from "lucide-react";

// P340 — Urgent alerts pin. MVP shape: surface every `smart_task_queue` row
// where `list_name = 'Urgent'` AND `status IN ('queued','in_progress')` so
// Trello-routed urgent items live at the top of the dashboard instead of
// buried in SMART-task widget scroll. Per-row actions (I'm-on-it / done /
// push-to-tomorrow) + realtime subscription land in a follow-up; this is the
// visibility-only first pass per Josh's "alerts section above the dashboard"
// 2026-05-24 card.

type QueueRow = {
  id: string;
  trello_card_id: string;
  card_name: string;
  card_desc: string | null;
  card_url: string | null;
  status: string;
  created_at: string;
};

const STATUS_BADGE: Record<string, string> = {
  queued: "bg-destructive/15 text-destructive",
  in_progress: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

export default function UrgentAlertsWidget() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("smart_task_queue")
      .select("id, trello_card_id, card_name, card_desc, card_url, status, created_at")
      .eq("list_name", "Urgent")
      .in("status", ["queued", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      setError(error.message);
    } else {
      setRows((data ?? []) as QueueRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const count = rows.length;
  const empty = !loading && count === 0;

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-display tracking-wide-custom">
          <Zap className="w-4 h-4 text-destructive" />
          {empty ? "No urgent items" : `Urgent — ${count} ${count === 1 ? "item" : "items"}`}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh urgent alerts"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>

      {!empty && (
        <CardContent className="space-y-2 pt-0">
          {loading && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="text-sm text-destructive">Couldn't load: {error}</p>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className="flex items-start gap-3 rounded-md border border-border bg-background/50 px-3 py-2"
              >
                <span
                  className={`mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                    STATUS_BADGE[row.status] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {row.status === "in_progress" ? "in-flight" : row.status}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-foreground">{row.card_name}</p>
                  {row.card_desc && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {row.card_desc}
                    </p>
                  )}
                </div>
                {row.card_url && (
                  <a
                    href={row.card_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 text-muted-foreground hover:text-primary transition-colors"
                    aria-label="Open Trello card"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}
