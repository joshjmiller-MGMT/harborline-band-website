import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Inbox, Loader2, RefreshCw } from "lucide-react";

type IngestRow = {
  id: string;
  shortcode: string;
  platform: string | null;
  source_account: string | null;
  collection_name: string | null;
  url: string;
  uploader: string | null;
  caption: string | null;
  duration_sec: number | null;
  purpose: string | null;
  confidence: number | null;
  summary: string | null;
  application: string | null;
  venture: string | null;
  action: string | null;
  route: string | null;
  tags: string[] | null;
  status: string | null;
  routed_ref: string | null;
  ingested_at: string;
  processed_at: string | null;
};

type IngestSummary = {
  total: number;
  by_account: Record<string, number>;
  by_purpose: Record<string, number>;
};

type ListResponse = { items: IngestRow[]; summary: IngestSummary };

// The three IG flows get distinct, stable colors so the audit reads at a glance.
const ACCOUNT_STYLES: Record<string, string> = {
  economy: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  harborline: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  personal: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  "trello-card": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

const PURPOSE_LABEL: Record<string, string> = {
  apply_method: "Apply method",
  reach_out: "Reach out",
  reference: "Reference",
  inspiration: "Inspiration",
  noise: "Noise",
};

const ROUTE_LABEL: Record<string, string> = {
  brain_note: "Brain note",
  trello_card: "Trello card",
  poc_followup: "POC follow-up",
  waiting_on_josh: "Waiting on Josh",
  passive_ref: "Passive ref",
};

const ACCOUNT_ORDER = ["economy", "harborline", "personal"];

function accountBadgeClass(account: string | null): string {
  if (!account) return "bg-muted text-muted-foreground border-border";
  return ACCOUNT_STYLES[account] ?? "bg-muted text-muted-foreground border-border";
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ContentIngestLogWidget() {
  const { toast } = useToast();
  const [items, setItems] = useState<IngestRow[]>([]);
  const [summary, setSummary] = useState<IngestSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<ListResponse>(
        "content-ingest-log",
        { body: { op: "list" } },
      );
      if (error) {
        const ctx = (error as { context?: Response }).context;
        if (ctx) {
          try {
            const body = await ctx.json();
            throw new Error(body.error || body.message || error.message);
          } catch {
            /* fall through */
          }
        }
        throw error;
      }
      setItems(data?.items ?? []);
      setSummary(data?.summary ?? null);
    } catch (e) {
      console.error("content ingest log list failed", e);
      toast({
        title: "Ingest log load failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="w-5 h-5" /> Content Ingest Log
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Reels &amp; posts ingested from your IG accounts — transcribed, classified,
            routed. Deduped automatically.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={load}
          disabled={loading}
          aria-label="Refresh"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-mono">
              {summary.total} total
            </Badge>
            {ACCOUNT_ORDER.map((acct) => (
              <Badge
                key={acct}
                variant="outline"
                className={accountBadgeClass(acct)}
              >
                {acct} · {summary.by_account[acct] ?? 0}
              </Badge>
            ))}
            {Object.entries(summary.by_purpose)
              .sort(([, a], [, b]) => b - a)
              .map(([purpose, count]) => (
                <Badge key={purpose} variant="outline" className="text-muted-foreground">
                  {PURPOSE_LABEL[purpose] ?? purpose} · {count}
                </Badge>
              ))}
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nothing ingested yet. New reels &amp; posts will land here automatically.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Ingested</TableHead>
                <TableHead className="text-right">Reel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant="outline" className={accountBadgeClass(item.source_account)}>
                      {item.source_account ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.purpose ? (
                      <Badge variant="secondary">
                        {PURPOSE_LABEL[item.purpose] ?? item.purpose}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <span className="line-clamp-2 text-foreground">
                      {item.summary || item.caption || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.action || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.route ? ROUTE_LABEL[item.route] ?? item.route : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatTimestamp(item.ingested_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="font-mono text-xs">{item.shortcode}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
