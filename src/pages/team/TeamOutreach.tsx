import { useEffect, useState, useCallback } from "react";
import TeamLayout from "@/components/TeamLayout";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2 } from "lucide-react";

// Outreach board — proactive targets to pitch (venues, festivals, radio, playlists,
// press, collaborators). Seeded from the IG-digest activation pass. Its own per-domain
// board (multi-board architecture). Backed by public.outreach_targets.
const db = supabase as unknown as { from: (t: string) => any };

interface Target {
  id: number;
  target: string;
  type: string | null;
  act: string | null;
  why: string | null;
  next_action: string | null;
  status: string;
  source: string | null;
  sort: number;
}

const STATUS_FLOW = ["todo", "contacted", "in_progress", "won", "passed"];
const STATUS_LABEL: Record<string, string> = {
  todo: "To do",
  contacted: "Contacted",
  in_progress: "In progress",
  won: "Won",
  passed: "Passed",
};
const STATUS_STYLE: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  contacted: "bg-primary/15 text-primary",
  in_progress: "bg-amber-500/15 text-amber-400",
  won: "bg-green-500/15 text-green-400",
  passed: "bg-border text-muted-foreground line-through",
};

export default function TeamOutreach() {
  const [items, setItems] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await db.from("outreach_targets").select("*").order("sort");
    setItems((data as Target[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function cycle(t: Target) {
    const idx = STATUS_FLOW.indexOf(t.status);
    const next = STATUS_FLOW[(idx + 1) % STATUS_FLOW.length];
    setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    await db.from("outreach_targets").update({ status: next }).eq("id", t.id);
  }

  const open = items.filter((t) => t.status !== "passed");
  const done = items.filter((t) => t.status === "won").length;

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="mb-8">
          <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
            <Send className="w-7 h-7 text-primary" /> Outreach
          </h1>
          <p className="text-muted-foreground mt-2">
            Proactive targets to pitch — venues, festivals, radio, playlists, press, collaborators. Tap a status
            to advance it.
          </p>
          {!loading && (
            <p className="mt-2 text-sm text-muted-foreground">
              {items.length} targets · {done} won
            </p>
          )}
        </div>

        {/* Outreach funnel at a glance — color-coded status counts. */}
        {!loading && items.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {STATUS_FLOW.map((s) => {
              const n = items.filter((t) => t.status === s).length;
              return (
                <span
                  key={s}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[s] ?? "bg-muted"}`}
                >
                  {STATUS_LABEL[s]}{" "}
                  <span className="tabular-nums font-semibold">{n}</span>
                </span>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {open.map((t) => (
              <div key={t.id} className="rounded-lg border border-border bg-card/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{t.target}</div>
                    {t.next_action && <div className="mt-1 text-sm text-muted-foreground">{t.next_action}</div>}
                    {t.why && <div className="mt-1 text-xs text-muted-foreground/70">{t.why}</div>}
                  </div>
                  <button
                    onClick={() => cycle(t)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[t.status] ?? "bg-muted"}`}
                    title="Click to advance status"
                  >
                    {STATUS_LABEL[t.status] ?? t.status}
                  </button>
                </div>
              </div>
            ))}
            {open.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No open targets.</p>
            )}
          </div>
        )}
      </div>
    </TeamLayout>
  );
}
