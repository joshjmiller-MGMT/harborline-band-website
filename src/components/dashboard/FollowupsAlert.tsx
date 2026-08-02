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
  Harborline: "bg-primary", Economy: "bg-accent", JJM: "bg-amber-500",
  Personal: "bg-emerald-500", BSE: "bg-rose-500", "Brand Studio": "bg-fuchsia-500",
};

type ContactFollowup = { id: string; name: string; phone: string | null; email: string | null };

// Sales holds whose rep check-in is due (Lou job 2026-07-20): the hold loop is
// self-nudging — due check-ins surface here next to task follow-ups, and the
// drafted rep/player messages live one click away on /team/holds.
type DueHold = {
  id: string;
  event_date: string | null;
  event_label: string | null;
  sales_rep: string | null;
  musician: string | null;
  next_check_at: string | null;
};

export default function FollowupsAlert() {
  const [rows, setRows] = useState<Followup[]>([]);
  const [people, setPeople] = useState<ContactFollowup[]>([]);
  const [dueHolds, setDueHolds] = useState<DueHold[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [tasks, contacts, holds] = await Promise.all([
        supabase
          .from("smart_task_enrichments")
          .select("id, revised_title, raw_input, board_venture, due_date")
          .eq("recurring_followup", true)
          .eq("board_bucket", "Active")
          .order("due_date", { ascending: true, nullsFirst: false }),
        supabase
          .from("contacts")
          .select("id, name, phone, email")
          .eq("followup", true)
          .order("name", { ascending: true }),
        supabase
          .from("sales_holds")
          .select("id, event_date, event_label, sales_rep, musician, next_check_at")
          .eq("hold_status", "open")
          .lte("next_check_at", new Date().toISOString())
          .order("event_date", { ascending: true, nullsFirst: false }),
      ]);
      setRows((tasks.data ?? []) as Followup[]);
      setPeople((contacts.data ?? []) as ContactFollowup[]);
      setDueHolds((holds.data ?? []) as DueHold[]);
      setLoading(false);
    })();
  }, []);

  if (loading || (rows.length === 0 && people.length === 0 && dueHolds.length === 0)) return null;

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <Repeat className="w-4 h-4 text-accent" /> Follow-ups
          <span className="text-xs text-muted-foreground">
            ({rows.length} task{rows.length === 1 ? "" : "s"} · {people.length} people
            {dueHolds.length > 0 ? ` · ${dueHolds.length} hold check-in${dueHolds.length === 1 ? "" : "s"}` : ""})
          </span>
        </h3>
        <span className="flex items-center gap-3">
          <Link to="/team/contacts" className="text-xs text-accent hover:text-accent/80 inline-flex items-center gap-0.5">
            contacts <ChevronRight className="w-3 h-3" />
          </Link>
          <Link to="/team/review" className="text-xs text-accent hover:text-accent/80 inline-flex items-center gap-0.5">
            board <ChevronRight className="w-3 h-3" />
          </Link>
        </span>
      </div>
      {rows.length > 0 && (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full shrink-0 ${VENTURE_DOT[r.board_venture || "Personal"] ?? "bg-muted-foreground"}`} />
              <span className="text-foreground truncate flex-1">{r.revised_title || r.raw_input}</span>
              {r.due_date && <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{r.due_date}</span>}
            </li>
          ))}
        </ul>
      )}
      {dueHolds.length > 0 && (
        <div className={rows.length > 0 ? "mt-2 pt-2 border-t border-accent/20" : ""}>
          <p className="text-[11px] text-muted-foreground mb-1">Hold check-ins due (chase the rep):</p>
          <ul className="space-y-1">
            {dueHolds.slice(0, 6).map((h) => (
              <li key={h.id} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full shrink-0 bg-yellow-500" />
                <Link to="/team/holds" className="text-foreground truncate flex-1 hover:text-accent">
                  {h.event_date || "?"} · {h.event_label || "hold"}
                  {h.sales_rep ? ` — ask ${h.sales_rep}` : ""}
                  {h.musician ? ` (holding ${h.musician.split(" ")[0]})` : ""}
                </Link>
              </li>
            ))}
            {dueHolds.length > 6 && (
              <li>
                <Link to="/team/holds" className="text-xs text-accent hover:underline">
                  +{dueHolds.length - 6} more on Sales Holds
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}
      {people.length > 0 && (
        <div className={rows.length > 0 || dueHolds.length > 0 ? "mt-2 pt-2 border-t border-accent/20" : ""}>
          <p className="text-[11px] text-muted-foreground mb-1">Follow up with:</p>
          {/* Clean person chips only (task-junk lives on boards now, Josh 7/19).
              Capped at 8; the rest are one click away on Contacts. */}
          <p className="text-sm leading-relaxed flex flex-wrap gap-1.5">
            {people.slice(0, 8).map((p) => (
              <Link key={p.id} to="/team/contacts"
                className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-foreground/90 hover:border-accent text-xs">
                {p.name.split(/[-—(·]/)[0].trim()}
              </Link>
            ))}
            {people.length > 8 && (
              <Link to="/team/contacts" className="text-xs text-accent hover:underline self-center">
                +{people.length - 8} more
              </Link>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
