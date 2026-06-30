import { useCallback, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Sparkles, RefreshCw, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import SmartTaskWidget from "@/components/dashboard/SmartTaskWidget";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrumBoard } from "@/components/board/ScrumBoard";
import {
  SMART_BUCKET_COLUMNS,
  SMART_VENTURES,
  type SmartBucket,
  type SmartVenture,
  normalizeVenture,
} from "@/components/board/smartTaskBuckets";
import {
  SmartTaskCard,
  ageFromCreatedAt,
  type SmartTaskCardData,
} from "@/components/board/SmartTaskCard";
import {
  useSmartTaskBoardData,
  type SmartTaskRow,
  type TrelloCard,
} from "@/hooks/useSmartTaskBoardData";

function deriveBucket(row: SmartTaskRow): SmartBucket {
  if (row.board_bucket && row.board_bucket !== "Trello inbox") {
    return row.board_bucket as SmartBucket;
  }
  if (row.google_calendar_event_id) return "Active";
  return "Pending approval";
}

function daysSinceTrello(card: TrelloCard): number | null {
  if (typeof card.age_days === "number") return card.age_days;
  if (!card.date_last_activity) return null;
  const parsed = new Date(card.date_last_activity);
  if (Number.isNaN(parsed.getTime())) return null;
  const diff = Date.now() - parsed.getTime();
  if (diff < 0) return null;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function TeamSmartTasks() {
  const {
    trello,
    smartRows,
    smartRowsLoading,
    smartRowsError,
    refreshAll,
    refreshSmartRows,
    refreshTrello: _refreshTrello,
  } = useSmartTaskBoardData();
  void _refreshTrello;

  const [ventureFilter, setVentureFilter] = useState<"All" | SmartVenture>("All");
  const [bucketFilter, setBucketFilter] = useState<"All" | SmartBucket>("All");
  const [approving, setApproving] = useState(false);

  // Trello cards with a matching SMART row (already SMART-ified) are excluded
  // from the Trello inbox column — their canonical position is the SMART row.
  const smartifiedTrelloCardIds = useMemo(() => {
    const s = new Set<string>();
    for (const row of smartRows) {
      if (row.trello_card_id) s.add(row.trello_card_id);
    }
    return s;
  }, [smartRows]);

  const cards: SmartTaskCardData[] = useMemo(() => {
    const out: SmartTaskCardData[] = [];

    for (const card of trello.cards) {
      if (smartifiedTrelloCardIds.has(card.id)) continue;
      out.push({
        id: `trello-${card.id}`,
        columnId: "Trello inbox",
        venture: "Personal",
        source: "trello",
        title: card.name,
        bucketLabel: card.list_name || "Trello",
        ageDays: daysSinceTrello(card),
        dueDate: card.due ? card.due.slice(0, 10) : null,
        definitionOfDone: null,
        measure: null,
        effort: card.desc ? card.desc.slice(0, 80) : null,
        externalUrl: card.url,
      });
    }

    for (const row of smartRows) {
      out.push({
        id: row.id,
        columnId: deriveBucket(row),
        venture: normalizeVenture(row.board_venture),
        source: "smart",
        title: row.revised_title || row.raw_input,
        bucketLabel: row.board_bucket || (row.google_calendar_event_id ? "Active" : "Pending"),
        ageDays: ageFromCreatedAt(row.created_at),
        dueDate: row.due_date,
        definitionOfDone: row.definition_of_done,
        measure: row.measure,
        effort: row.effort,
        externalUrl: row.google_calendar_html_link || row.trello_card_url,
      });
    }

    return out;
  }, [trello.cards, smartRows, smartifiedTrelloCardIds]);

  const handleCardMove = useCallback(
    async (cardId: string, _from: string, to: string) => {
      // Trello-source cards can't change bucket from the board (they go
      // through Make-SMART). Drop the operation with a toast hint.
      if (cardId.startsWith("trello-")) {
        toast.info("Use Make-SMART on the dashboard widget to move a Trello card.");
        return;
      }
      if (to === "Trello inbox") {
        toast.info("Trello inbox is read-only — drag back via the SMART buckets.");
        return;
      }

      try {
        const { error } = await supabase.functions.invoke("update-smart-task-bucket", {
          body: { id: cardId, bucket: to },
        });
        if (error) {
          const ctx = (error as unknown as { context?: Response }).context;
          let detail = error.message;
          if (ctx) {
            try {
              const body = await ctx.json();
              detail = body.detail || body.error || body.message || detail;
            } catch {
              /* swallow */
            }
          }
          throw new Error(detail);
        }
        // Refresh SMART rows to pick up the new bucket; Trello fetch is
        // expensive, so leave it alone.
        await refreshSmartRows();
        toast.success(`Moved to ${to}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save bucket");
        await refreshSmartRows();
      }
    },
    [refreshSmartRows],
  );

  const handleChangeVenture = useCallback(
    async (cardId: string, venture: SmartVenture) => {
      if (cardId.startsWith("trello-")) return;
      try {
        const { error } = await supabase.functions.invoke("update-smart-task-bucket", {
          body: { id: cardId, venture },
        });
        if (error) {
          const ctx = (error as unknown as { context?: Response }).context;
          let detail = error.message;
          if (ctx) {
            try {
              const body = await ctx.json();
              detail = body.detail || body.error || body.message || detail;
            } catch {
              /* swallow */
            }
          }
          throw new Error(detail);
        }
        await refreshSmartRows();
        toast.success(`Moved to ${venture}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update venture");
        await refreshSmartRows();
      }
    },
    [refreshSmartRows],
  );

  const cardsByVenture = useMemo(() => {
    const map = new Map<SmartVenture, SmartTaskCardData[]>();
    for (const v of SMART_VENTURES) map.set(v, []);
    for (const card of cards) {
      const arr = map.get(card.venture);
      if (arr) arr.push(card);
    }
    return map;
  }, [cards]);

  const totalCards = cards.length;
  const totalSmart = smartRows.length;
  const totalTrello = trello.cards.length - smartifiedTrelloCardIds.size;
  const isLoading = smartRowsLoading || trello.loading;

  // Bucket counts (from the same derived board cards, so the banner matches the
  // columns). Pending-approval is the headline backlog the lane surfaces.
  const bucketCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cards) m[c.columnId] = (m[c.columnId] ?? 0) + 1;
    return m;
  }, [cards]);
  const pendingTotal = bucketCounts["Pending approval"] ?? 0;
  const pendingByVenture = useMemo(() => {
    const m = new Map<SmartVenture, number>();
    for (const c of cards) {
      if (c.columnId === "Pending approval") m.set(c.venture, (m.get(c.venture) ?? 0) + 1);
    }
    return m;
  }, [cards]);

  // Bulk-approve: move Pending-approval rows → Active in one batched DB update
  // (RLS allows the authenticated operator; update-smart-task-bucket has no
  // calendar side-effect, and neither does this, so it's safe at scale). Pass a
  // venture to scope it, or omit for all ventures. For Personal we also sweep
  // board_venture IS NULL, since those rows render under Personal.
  const approvePending = useCallback(
    async (venture?: SmartVenture) => {
      const n = venture ? pendingByVenture.get(venture) ?? 0 : pendingTotal;
      if (n === 0) return;
      const where = venture ?? "all ventures";
      if (!window.confirm(`Approve ${n} pending task${n === 1 ? "" : "s"} (${where}) → move to Active?`)) {
        return;
      }
      setApproving(true);
      try {
        let q = supabase
          .from("smart_task_enrichments")
          .update({ board_bucket: "Active" })
          .eq("board_bucket", "Pending approval");
        if (venture === "Personal") {
          q = q.or("board_venture.is.null,board_venture.eq.Personal");
        } else if (venture) {
          q = q.eq("board_venture", venture);
        }
        const { error } = await q;
        if (error) throw error;
        toast.success(`Approved ${n} → Active`);
        await refreshSmartRows();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Bulk approve failed");
        await refreshSmartRows();
      } finally {
        setApproving(false);
      }
    },
    [pendingByVenture, pendingTotal, refreshSmartRows],
  );

  const venturesToRender = ventureFilter === "All" ? SMART_VENTURES : [ventureFilter];

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
              <Sparkles className="w-7 h-7 text-primary" /> SMART Tasks
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {totalCards
                ? `${totalCards} cards · ${totalTrello} in Trello inbox · ${totalSmart} SMART-ified`
                : "Cards flow Trello inbox → Needs SMART → Pending approval → Active → Done"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={ventureFilter}
              onChange={(e) => setVentureFilter(e.target.value as "All" | SmartVenture)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              title="Filter by venture"
            >
              <option value="All">All ventures</option>
              {SMART_VENTURES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <select
              value={bucketFilter}
              onChange={(e) => setBucketFilter(e.target.value as "All" | SmartBucket)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              title="Filter by bucket"
            >
              <option value="All">All buckets</option>
              {SMART_BUCKET_COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={refreshAll} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Approval backlog banner — the headline count + one-tap bulk approve. */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-sky-500/30 bg-sky-500/10 p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-medium text-foreground">
              {pendingTotal} pending approval
            </span>
            <span className="text-muted-foreground">{bucketCounts["Needs SMART"] ?? 0} needs SMART</span>
            <span className="text-muted-foreground">{bucketCounts["Active"] ?? 0} active</span>
            <span className="text-muted-foreground">{totalTrello} in Trello inbox</span>
          </div>
          <Button
            size="sm"
            onClick={() => approvePending()}
            disabled={approving || pendingTotal === 0}
            className="shrink-0"
          >
            {approving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <CheckCheck className="w-4 h-4 mr-1.5" />
            )}
            Approve all pending ({pendingTotal})
          </Button>
        </div>

        {(smartRowsError || trello.error) && (
          <div className="mb-4 p-2.5 rounded text-xs bg-destructive/10 text-destructive border border-destructive/30 space-y-1">
            {smartRowsError && <p>SMART rows: {smartRowsError}</p>}
            {trello.error && <p>Trello inbox: {trello.error}</p>}
          </div>
        )}

        {/* Quick SMART-ify composer (moved here from the dashboard, 2026-06-21). */}
        <div className="mb-6">
          <SmartTaskWidget />
        </div>

        <div className="space-y-6">
          {venturesToRender.map((venture) => {
            const allVentureCards = cardsByVenture.get(venture) ?? [];
            const ventureCards =
              bucketFilter === "All"
                ? allVentureCards
                : allVentureCards.filter((c) => c.columnId === bucketFilter);
            const count = ventureCards.length;
            const venturePending = pendingByVenture.get(venture) ?? 0;
            // When a venture filter is active, hide empty sections only if the
            // venture genuinely has no cards (so an explicitly-picked empty
            // venture still shows its board).
            if (ventureFilter === "All" && allVentureCards.length === 0) return null;
            return (
              <section key={venture} className="space-y-2">
                <header className="flex items-center justify-between border-b border-border pb-1">
                  <h2 className="font-display text-lg tracking-wide-custom text-foreground">
                    {venture}
                  </h2>
                  <div className="flex items-center gap-2">
                    {venturePending > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => approvePending(venture)}
                        disabled={approving}
                      >
                        <CheckCheck className="w-3.5 h-3.5 mr-1" />
                        Approve {venturePending}
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {count} {count === 1 ? "card" : "cards"}
                    </span>
                  </div>
                </header>
                <ScrumBoard
                  columns={SMART_BUCKET_COLUMNS}
                  cards={ventureCards}
                  onCardMove={handleCardMove}
                  renderCard={(card) => (
                    <SmartTaskCard card={card} onChangeVenture={handleChangeVenture} />
                  )}
                  emptyColumnLabel="—"
                />
              </section>
            );
          })}
        </div>
      </div>
    </TeamLayout>
  );
}
