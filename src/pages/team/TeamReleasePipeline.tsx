import { useEffect, useState, useCallback } from "react";
import TeamLayout from "@/components/TeamLayout";
import { supabase } from "@/integrations/supabase/client";
import { Rocket, CheckCircle2, Circle, Loader2, Music2 } from "lucide-react";

// Release Pipeline — the JMJ EP waterfall (each single releases sequentially to keep
// re-triggering the algorithm) + the Ari-Herstand prep checklist per single + shared prep.
// Data: public.release_singles + public.release_tasks. Types aren't in the generated
// Database yet, so the client is cast locally.
const db = supabase as unknown as {
  from: (t: string) => any;
};

interface Single {
  id: number;
  single_no: number;
  working_title: string | null;
  release_date: string | null;
  status: string;
  notes: string | null;
}
interface Task {
  id: number;
  single_no: number | null;
  phase: string | null;
  task: string;
  status: string;
  target_date: string | null;
  sort: number;
}

function daysUntil(date: string | null): string {
  if (!date) return "";
  const d = new Date(date + "T00:00:00");
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return "today";
  return `in ${days}d`;
}
function fmtDate(date: string | null): string {
  if (!date) return "TBD";
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TeamReleasePipeline() {
  const [singles, setSingles] = useState<Single[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, t] = await Promise.all([
      db.from("release_singles").select("*").order("single_no"),
      db.from("release_tasks").select("*").order("sort"),
    ]);
    setSingles((s.data as Single[]) ?? []);
    setTasks((t.data as Task[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function toggle(task: Task) {
    const next = task.status === "done" ? "todo" : "done";
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, status: next } : x)));
    await db.from("release_tasks").update({ status: next }).eq("id", task.id);
  }

  const shared = tasks.filter((t) => t.single_no == null);
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;

  const TaskRow = ({ t }: { t: Task }) => (
    <button
      onClick={() => toggle(t)}
      className="flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/40 transition"
    >
      {t.status === "done" ? (
        <CheckCircle2 className="mt-0.5 w-4 h-4 shrink-0 text-primary" />
      ) : (
        <Circle className="mt-0.5 w-4 h-4 shrink-0 text-muted-foreground" />
      )}
      <span className={t.status === "done" ? "text-muted-foreground line-through" : ""}>
        {t.phase && <span className="mr-2 text-xs uppercase tracking-wide text-primary/70">{t.phase}</span>}
        {t.task}
      </span>
    </button>
  );

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12 max-w-5xl">
        <div className="mb-8">
          <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
            <Rocket className="w-7 h-7 text-primary" /> Release Pipeline
          </h1>
          <p className="text-muted-foreground mt-2">
            Josh Miller Jazz — the debut EP as a single-a-month waterfall. Each single re-triggers the algorithm;
            the last one completes the EP.
          </p>
          {!loading && (
            <p className="mt-2 text-sm text-muted-foreground">
              {done} / {total} prep tasks done
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Waterfall overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              {singles.map((s) => {
                const st = tasks.filter((t) => t.single_no === s.single_no);
                const sd = st.filter((t) => t.status === "done").length;
                return (
                  <div key={s.id} className="rounded-lg border border-border bg-card/50 p-4">
                    <div className="flex items-center gap-2 text-xs font-display tracking-wide text-primary">
                      <Music2 className="w-3.5 h-3.5" /> SINGLE {s.single_no}
                    </div>
                    <div className="mt-2 font-medium text-sm">{s.working_title || "Untitled"}</div>
                    <div className="mt-1 text-2xl font-display text-gradient-gold">{fmtDate(s.release_date)}</div>
                    <div className="text-xs text-muted-foreground">{daysUntil(s.release_date)}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {sd}/{st.length} tasks · {s.status}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Shared / one-time prep */}
            {shared.length > 0 && (
              <section className="mb-8">
                <h2 className="font-display text-lg tracking-wide mb-2">Shared prep (do once)</h2>
                <div className="rounded-lg border border-border bg-card/30 p-2">
                  {shared.map((t) => (
                    <TaskRow key={t.id} t={t} />
                  ))}
                </div>
              </section>
            )}

            {/* Per-single checklists */}
            {singles.map((s) => {
              const st = tasks.filter((t) => t.single_no === s.single_no);
              if (st.length === 0) return null;
              return (
                <section key={s.id} className="mb-8">
                  <h2 className="font-display text-lg tracking-wide mb-2">
                    Single {s.single_no} — {fmtDate(s.release_date)}{" "}
                    <span className="text-sm text-muted-foreground">({daysUntil(s.release_date)})</span>
                  </h2>
                  <div className="rounded-lg border border-border bg-card/30 p-2">
                    {st.map((t) => (
                      <TaskRow key={t.id} t={t} />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
    </TeamLayout>
  );
}
