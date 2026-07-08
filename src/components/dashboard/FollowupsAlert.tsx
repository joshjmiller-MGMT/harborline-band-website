import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Repeat, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Follow-ups alert — recurring "follow up until done" tasks, surfaced on the
// dashboard (moved here out of the SMART board, 2026-07-07). These re-pin to the
// management calendar daily until moved to Done, so they belong front-and-center.
type Followup = {
  id: string;
  revised_title: string | null;
  raw_input: string;
  board_venture: string | null;
  due_date: string | null;
};

const VENTURE_DOT: Record<string, string> = {
  Harborline: "bg-sky-500", Economy: "bg-violet-500", JMJ: "bg-amber-500",
  Personal: "bg-emerald-500", BSE: "bg-rose-500", "Brand Studio": "bg-fuchsia-500",
};

export default function FollowupsAlert() {
  const [rows, setRows] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("smart_task_enrichments")
        .select("id, revised_title, raw_input, board_venture, due_date")
        .eq("recurring_followup", true)
        .eq("board_bucket", "Active")
        .order("due_date", { ascending: true, nullsFirst: false });
      setRows((data ?? []) as Followup[]);
      setLoading(false);
    })();
  }, []);

  if (loading || rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <Repeat className="w-4 h-4 text-indigo-400" /> Follow-ups
          <span className="text-xs text-muted-foreground">({rows.length} until done)</span>
        </h3>
        <Link to="/team/smart-tasks" className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-0.5">
          board <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full shrink-0 ${VENTURE_DOT[r.board_venture || "Personal"] ?? "bg-muted-foreground"}`} />
            <span className="text-foreground truncate flex-1">{r.revised_title || r.raw_input}</span>
            {r.due_date && <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{r.due_date}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
