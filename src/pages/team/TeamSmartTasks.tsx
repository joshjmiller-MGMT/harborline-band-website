import { useCallback, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Sparkles, RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import SmartTaskWidget from "@/components/dashboard/SmartTaskWidget";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrumBoard } from "@/components/board/ScrumBoard";
import {
  SMART_BUCKET_COLUMNS,
  SMART_VENTURES,
  VENTURE_COLORS,
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

  // Review↔smartify loop: send a card that needs smartifying to the review board
  // so Josh can add context. On resolve there, the context flows back to Needs SMART.
  const handleSendToReview = useCallback(async (card: SmartTaskCardData) => {
    try {
      const { error } = await supabase.from("waiting_on_josh").insert({
        title: card.title,
        prompt: "Add what you know about this so it can be turned into a SMART action.",
        item_type: "smartify-context",
        priority: "normal",
        source_session: "smart-board",
        source_ref: card.source === "trello" ? card.externalUrl : card.id,
      });
      if (error) throw error;
      toast.success("Sent to Review for context");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send to review");
    }
  }, []);

  const cardsByVenture = useMemo(() => {
    const map = new Map<SmartVenture, SmartTaskCardData[]>();
    for (const v of SMART_VENTURES) map.set(v, []);
    for (const card of cards) {
      const arr = map.get(card.venture);
      if (arr) arr.push(card);
    }
    return map;
  }, [cards]);

  // Per-venture, per-bucket counts — powers the overview matrix + the header chips.
  const bucketCountsByVenture = useMemo(() => {
    const m = new Map<SmartVenture, Record<string, number>>();
    for (const v of SMART_VENTURES) {
      const rec: Record<string, number> = {};
      for (const col of SMART_BUCKET_COLUMNS) rec[col.id] = 0;
      m.set(v, rec);
    }
    for (const card of cards) {
      const rec = m.get(card.venture);
      if (rec) rec[card.columnId] = (rec[card.columnId] ?? 0) + 1;
    }
    return m;
  }, [cards]);

  // Venture sections default OPEN when they have cards; the user can override
  // either way (collapse what you're not working on — kanban best practice).
  const [openOverrides, setOpenOverrides] = useState<
    Partial<Record<SmartVenture, boolean>>
  >({});
  const isVentureOpen = (v: SmartVenture, count: number) =>
    openOverrides[v] ?? count > 0;
  const toggleVenture = (v: SmartVenture, count: number) =>
    setOpenOverrides((prev) => ({ ...prev, [v]: !(prev[v] ?? count > 0) }));
  const expandVenture = (v: SmartVenture) => {
    setOpenOverrides((prev) => ({ ...prev, [v]: true }));
    setTimeout(
      () =>
        document
          .getElementById(`venture-${v}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  };
  const setAllVentures = (open: boolean) =>
    setOpenOverrides(
      Object.fromEntries(
        SMART_VENTURES.map((v) => [v, open]),
      ) as Partial<Record<SmartVenture, boolean>>,
    );

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
            <Button variant="ghost" size="sm" onClick={() => setAllVentures(true)}>
              Expand all
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAllVentures(false)}>
              Collapse all
            </Button>
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

        {/* At-a-glance overview — venture × bucket counts. Click a row to jump. */}
        <div className="mb-6 overflow-x-auto rounded-lg border border-border bg-card/40">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left font-medium px-3 py-2">Venture</th>
                {SMART_BUCKET_COLUMNS.map((col) => (
                  <th
                    key={col.id}
                    className={`px-2 py-2 font-medium text-center ${col.accent}`}
                  >
                    {col.title}
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-medium text-foreground">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {SMART_VENTURES.map((v) => {
                const counts = bucketCountsByVenture.get(v)!;
                const total = cardsByVenture.get(v)?.length ?? 0;
                return (
                  <tr
                    key={v}
                    className="border-b border-border/40 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => expandVenture(v)}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${VENTURE_COLORS[v]}`}
                        />
                        <span className="font-medium text-foreground">{v}</span>
                      </span>
                    </td>
                    {SMART_BUCKET_COLUMNS.map((col) => {
                      const n = counts[col.id] ?? 0;
                      return (
                        <td
                          key={col.id}
                          className="px-2 py-2 text-center tabular-nums"
                        >
                          {n > 0 ? (
                            <span className="inline-block min-w-[1.6rem] rounded bg-muted/70 px-1.5 py-0.5 text-xs font-semibold text-foreground">
                              {n}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30">·</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center tabular-nums font-semibold text-foreground">
                      {total || <span className="text-muted-foreground/30">·</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Collapsible, color-coded venture boards — collapse what you're not working on. */}
        <div className="space-y-3">
          {SMART_VENTURES.map((venture) => {
            const ventureCards = cardsByVenture.get(venture) ?? [];
            const count = ventureCards.length;
            const counts = bucketCountsByVenture.get(venture)!;
            const open = isVentureOpen(venture, count);
            return (
              <Collapsible
                key={venture}
                open={open}
                onOpenChange={() => toggleVenture(venture, count)}
                className="rounded-lg border border-border bg-card/40"
              >
                <CollapsibleTrigger asChild>
                  <button
                    id={`venture-${venture}`}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/30 rounded-lg text-left scroll-mt-20"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-3 h-3 rounded-full shrink-0 ${VENTURE_COLORS[venture]}`}
                      />
                      <span className="font-display text-lg tracking-wide-custom text-foreground">
                        {venture}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {count} {count === 1 ? "card" : "cards"}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      {SMART_BUCKET_COLUMNS.map((col) =>
                        (counts[col.id] ?? 0) > 0 ? (
                          <span
                            key={col.id}
                            className={`hidden md:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted/50 ${col.accent}`}
                          >
                            {col.title.split(" ")[0]} {counts[col.id]}
                          </span>
                        ) : null,
                      )}
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                      />
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3">
                  {count === 0 ? (
                    <p className="text-xs text-muted-foreground py-3 text-center">
                      No cards in this venture.
                    </p>
                  ) : (
                    <ScrumBoard
                      columns={SMART_BUCKET_COLUMNS}
                      cards={ventureCards}
                      onCardMove={handleCardMove}
                      renderCard={(card) => (
                        <SmartTaskCard
                          card={card}
                          onChangeVenture={handleChangeVenture}
                          onSendToReview={handleSendToReview}
                        />
                      )}
                      emptyColumnLabel="—"
                    />
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </div>
    </TeamLayout>
  );
}
