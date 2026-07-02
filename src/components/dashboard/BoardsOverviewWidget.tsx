import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LayoutGrid, Rocket, Send, Share2, ArrowRight } from "lucide-react";

// Boards overview — surfaces the top/urgent item from each per-domain board onto the
// dashboard (multi-board architecture: work the top items here, drill into a board for depth).
const db = supabase as unknown as { from: (t: string) => any };

interface Summary {
  releaseNextDate: string | null;
  releaseTasksTodo: number;
  outreachTodo: number;
  socialQueued: number;
}

function daysUntil(date: string | null): string {
  if (!date) return "";
  const days = Math.ceil((new Date(date + "T00:00:00").getTime() - Date.now()) / 86400000);
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return "today";
  return `in ${days}d`;
}

export default function BoardsOverviewWidget() {
  const [s, setS] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    const [singles, relTasks, outreach, social] = await Promise.all([
      db.from("release_singles").select("release_date,status").order("single_no"),
      db.from("release_tasks").select("id").eq("status", "todo"),
      db.from("outreach_targets").select("id").eq("status", "todo"),
      db.from("social_content_queue").select("id").eq("status", "queued"),
    ]);
    const upcoming = ((singles.data as { release_date: string | null; status: string }[]) ?? [])
      .filter((r) => r.status !== "released" && r.release_date)
      .map((r) => r.release_date as string)
      .sort();
    setS({
      releaseNextDate: upcoming[0] ?? null,
      releaseTasksTodo: (relTasks.data ?? []).length,
      outreachTodo: (outreach.data ?? []).length,
      socialQueued: (social.data ?? []).length,
    });
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const Row = ({
    to,
    icon: Icon,
    label,
    detail,
  }: {
    to: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    detail: string;
  }) => (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-muted/40 transition"
    >
      <span className="flex items-center gap-2 text-sm">
        <Icon className="w-4 h-4 text-primary shrink-0" />
        {label}
      </span>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {detail}
        <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </Link>
  );

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg tracking-wide-custom flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-primary" /> Boards
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <Row
          to="/team/release-pipeline"
          icon={Rocket}
          label="Release Pipeline"
          detail={
            s
              ? `next ${daysUntil(s.releaseNextDate)} · ${s.releaseTasksTodo} to do`
              : "…"
          }
        />
        <Row
          to="/team/outreach"
          icon={Send}
          label="Outreach"
          detail={s ? `${s.outreachTodo} to do` : "…"}
        />
        <Row
          to="/team/social"
          icon={Share2}
          label="Social — content queue"
          detail={s ? `${s.socialQueued} queued` : "…"}
        />
      </CardContent>
    </Card>
  );
}
