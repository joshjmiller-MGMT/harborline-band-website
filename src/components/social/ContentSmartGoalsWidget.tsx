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
import { Loader2, RefreshCw, Target } from "lucide-react";

type SmartGoal = {
  id: string;
  title: string;
  venture: string | null;
  definition_of_done: string | null;
  measure: string | null;
  member_count: number | null;
  urgency: string | null;
  earliest_deadline: string | null;
  suggested_due_date: string | null;
  priority: number | null;
  rationale: string | null;
  status: string | null;
};

type GoalsResponse = { goals: SmartGoal[] };

const VENTURE_STYLES: Record<string, string> = {
  "The Economy": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  Harborline: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  BSE: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  "JMJ / jazz": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  "Solo / operator": "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
};

const SENSITIVITY_STYLES: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40",
  soon: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  rolling: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  expired: "bg-muted text-muted-foreground border-border line-through",
};

function ventureClass(v: string | null): string {
  if (!v) return "bg-muted text-muted-foreground border-border";
  return VENTURE_STYLES[v] ?? "bg-muted text-muted-foreground border-border";
}

function formatDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ContentSmartGoalsWidget() {
  const { toast } = useToast();
  const [goals, setGoals] = useState<SmartGoal[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<GoalsResponse>(
        "content-ingest-log",
        { body: { op: "goals" } },
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
      setGoals(data?.goals ?? []);
    } catch (e) {
      console.error("content smart goals load failed", e);
      toast({
        title: "SMART goals load failed",
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
            <Target className="w-5 h-5" /> Content → SMART Goals
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Your saved reels &amp; posts, clustered into actionable goals — deduped,
            prioritized, deadline-aware.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} aria-label="Refresh">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent>
        {loading && goals.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : goals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No synthesized goals yet. They appear once content is ingested and clustered.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">P</TableHead>
                <TableHead>Venture</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead className="text-right">Reels</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono">P{g.priority ?? "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ventureClass(g.venture)}>
                      {g.venture ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <span className="font-medium text-foreground">{g.title}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {g.member_count ?? 0}
                  </TableCell>
                  <TableCell>
                    {g.urgency && g.urgency !== "none" ? (
                      <Badge
                        variant="outline"
                        className={SENSITIVITY_STYLES[g.urgency] ?? "text-muted-foreground"}
                      >
                        {g.urgency}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDay(g.earliest_deadline ?? g.suggested_due_date) || "—"}
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
