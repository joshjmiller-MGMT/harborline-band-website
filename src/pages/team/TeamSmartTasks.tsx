import { useCallback, useMemo } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Sparkles, RefreshCw } from "lucide-react";
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
            <Button variant="ghost" size="sm" onClick={refreshAll} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
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
          {SMART_VENTURES.map((venture) => {
            const ventureCards = cardsByVenture.get(venture) ?? [];
            const count = ventureCards.length;
            return (
              <section key={venture} className="space-y-2">
                <header className="flex items-center justify-between border-b border-border pb-1">
                  <h2 className="font-display text-lg tracking-wide-custom text-foreground">
                    {venture}
                  </h2>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {count} {count === 1 ? "card" : "cards"}
                  </span>
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
