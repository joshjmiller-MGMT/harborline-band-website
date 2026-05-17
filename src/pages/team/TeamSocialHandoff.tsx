import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ContentQueueItem, SocialQueueItem } from "@/components/social/ContentQueueItem";
import { Loader2, Share2 } from "lucide-react";

type HandoffPayload = {
  week: string;
  range: { start: string; end: string };
  items: SocialQueueItem[];
  public_url_base: string;
};

export default function TeamSocialHandoff() {
  const { week } = useParams<{ week: string }>();
  const [search] = useSearchParams();
  const token = search.get("t") ?? "";
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "loaded"; payload: HandoffPayload }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    if (!week || !token) {
      setState({ kind: "error", message: "Missing week or token in URL." });
      return;
    }
    const { data, error } = await supabase.functions.invoke<HandoffPayload>(
      "social-handoff-read",
      { body: { week, token } },
    );
    if (error) {
      const ctx = (error as { context?: Response }).context;
      let msg = error.message;
      if (ctx) {
        try {
          const body = await ctx.json();
          msg = body.error || body.message || msg;
        } catch {
          /* ignore */
        }
      }
      setState({ kind: "error", message: msg });
      return;
    }
    if (!data) {
      setState({ kind: "error", message: "Empty response." });
      return;
    }
    setState({ kind: "loaded", payload: data });
  }, [week, token]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    if (state.kind !== "loaded") return [];
    const buckets = new Map<string, SocialQueueItem[]>();
    for (const item of state.payload.items) {
      const key = item.scheduled_for ?? "Unscheduled";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(item);
    }
    return [...buckets.entries()].sort(([a], [b]) => {
      if (a === "Unscheduled") return 1;
      if (b === "Unscheduled") return -1;
      return a.localeCompare(b);
    });
  }, [state]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="container mx-auto px-6 py-5">
          <h1 className="font-display text-2xl tracking-wide-custom flex items-center gap-3">
            <Share2 className="w-6 h-6 text-primary" /> Social handoff
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Read-only view for {week ?? "—"}. Open this on your phone, save it as a
            bookmark. Updates auto-refresh on reload.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6 max-w-3xl">
        {state.kind === "loading" ? (
          <div className="text-center py-16 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            <p className="mt-2 text-sm">Loading…</p>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <p className="font-medium text-destructive">Could not load handoff.</p>
            <p className="mt-1 text-muted-foreground">{state.message}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Ask Josh to send a fresh link.
            </p>
          </div>
        ) : null}

        {state.kind === "loaded" ? (
          <>
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Week of {state.payload.range.start} → {state.payload.range.end}
            </p>
            {state.payload.items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10 border border-dashed border-border rounded-md">
                Nothing queued for this week yet.
              </p>
            ) : (
              grouped.map(([day, dayItems]) => (
                <section key={day}>
                  <h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-2">
                    {day}
                  </h2>
                  <div className="space-y-3">
                    {dayItems.map((item) => (
                      <ContentQueueItem
                        key={item.id}
                        item={item}
                        publicUrlBase={state.payload.public_url_base}
                        readOnly
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
