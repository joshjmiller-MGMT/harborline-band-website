import { useCallback, useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Rss, RefreshCw, ExternalLink, Film, Headphones, GraduationCap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type FeedItem = {
  id: string;
  kind: string;
  title: string;
  url: string | null;
  note: string | null;
  venture: string | null;
  consumed: boolean;
};

const KINDS: { key: string; label: string; icon: typeof Film; accent: string }[] = [
  { key: "watch", label: "Watch", icon: Film, accent: "text-violet-400" },
  { key: "listen", label: "Listen", icon: Headphones, accent: "text-amber-400" },
  { key: "learn", label: "Learn", icon: GraduationCap, accent: "text-emerald-400" },
];

export default function TeamFeed() {
  const [rows, setRows] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConsumed, setShowConsumed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("feed_items")
      .select("id, kind, title, url, note, venture, consumed")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as FeedItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleConsumed = useCallback(async (id: string, consumed: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, consumed } : r)));
    const { error } = await supabase.from("feed_items").update({ consumed, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Failed to save"); void load(); }
  }, [load]);

  const visible = useMemo(
    () => (showConsumed ? rows : rows.filter((r) => !r.consumed)),
    [rows, showConsumed],
  );
  const byKind = useMemo(() => {
    const m = new Map<string, FeedItem[]>();
    for (const r of visible) (m.get(r.kind) ?? m.set(r.kind, []).get(r.kind)!).push(r);
    return m;
  }, [visible]);

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
              <Rss className="w-7 h-7 text-primary" /> Feed
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Things to watch, listen to, and learn — everything you want to consume
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowConsumed((s) => !s)}>
              {showConsumed ? "Hide done" : "Show done"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          {KINDS.map(({ key, label, icon: Icon, accent }) => {
            const items = byKind.get(key) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={key}>
                <h2 className={`font-display text-lg tracking-wide-custom mb-2 flex items-center gap-2 ${accent}`}>
                  <Icon className="w-5 h-5" /> {label}
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </h2>
                <div className="rounded-lg border border-border bg-card/40 divide-y divide-border/50">
                  {items.map((r) => (
                    <div key={r.id} className={`px-3 py-2 flex items-center gap-3 ${r.consumed ? "opacity-50" : ""}`}>
                      <button
                        onClick={() => toggleConsumed(r.id, !r.consumed)}
                        className={`w-5 h-5 rounded border shrink-0 flex items-center justify-center ${r.consumed ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "border-border hover:border-foreground"}`}
                        title={r.consumed ? "Mark not done" : "Mark done"}
                      >
                        {r.consumed && <Check className="w-3 h-3" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm text-foreground truncate ${r.consumed ? "line-through" : ""}`}>{r.title}</p>
                        {r.note && <p className="text-[11px] text-muted-foreground truncate">{r.note}</p>}
                      </div>
                      {r.url && (
                        <a href={r.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Open">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {!loading && visible.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Nothing in the feed{showConsumed ? "" : " — all caught up"}.</p>
          )}
        </div>
      </div>
    </TeamLayout>
  );
}
