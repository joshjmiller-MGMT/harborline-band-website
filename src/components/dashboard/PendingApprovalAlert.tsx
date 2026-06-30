import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Dashboard alert that answers the Trello "where did it all go?" question:
// surfaces how many smartified tasks are sitting in board_bucket='Pending
// approval' (and how many still need SMART) on /team/smart-tasks, so the
// backlog isn't invisible. Self-contained — fetches its own counts.
export default function PendingApprovalAlert() {
  const [pending, setPending] = useState<number | null>(null);
  const [needsSmart, setNeedsSmart] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, n] = await Promise.all([
        supabase
          .from("smart_task_enrichments")
          .select("id", { count: "exact", head: true })
          .eq("board_bucket", "Pending approval"),
        supabase
          .from("smart_task_enrichments")
          .select("id", { count: "exact", head: true })
          .eq("board_bucket", "Needs SMART"),
      ]);
      if (cancelled) return;
      setPending(p.count ?? 0);
      setNeedsSmart(n.count ?? 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing waiting → don't take up dashboard space.
  if (!loading && (pending ?? 0) === 0 && needsSmart === 0) return null;

  return (
    <Card className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-sky-500/30 bg-sky-500/10 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-sky-500/15 p-2">
          <Sparkles className="h-5 w-5 text-sky-500" />
        </div>
        <div>
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking SMART board…
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                {pending} SMART {pending === 1 ? "task" : "tasks"} pending your approval
              </p>
              <p className="text-xs text-muted-foreground">
                {needsSmart > 0
                  ? `+ ${needsSmart} still need SMART. Review, approve, and send them to Active.`
                  : "Review and approve to send them to Active."}
              </p>
            </>
          )}
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link to="/team/smart-tasks">
          Review board
          <ChevronRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </Card>
  );
}
