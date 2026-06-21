import { useMemo, useState, useCallback } from "react";
import type { ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

export type ScrumColumn = {
  id: string;
  title: string;
  /** Optional accent class — e.g. "text-amber-500" — used on the column header pill. */
  accent?: string;
};

export type ScrumCard = {
  id: string;
  columnId: string;
};

export interface ScrumBoardProps<C extends ScrumCard> {
  columns: ScrumColumn[];
  cards: C[];
  onCardMove: (cardId: string, fromColumn: string, toColumn: string) => void;
  renderCard: (card: C, opts: { isSelected: boolean }) => ReactNode;
  emptyColumnLabel?: string;
}

/**
 * Generic scrum-bucket board with drag-and-drop (desktop) and tap-pick-then-
 * tap-destination (mobile fallback). Cards are grouped into columns by
 * `card.columnId`; calls `onCardMove(cardId, from, to)` when a card lands in
 * a different column. Built for P311 (booking pipeline) and reused by P312.
 */
export function ScrumBoard<C extends ScrumCard>({
  columns,
  cards,
  onCardMove,
  renderCard,
  emptyColumnLabel = "Empty",
}: ScrumBoardProps<C>) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, C[]>();
    for (const col of columns) map.set(col.id, []);
    for (const card of cards) {
      const arr = map.get(card.columnId);
      if (arr) arr.push(card);
    }
    return map;
  }, [columns, cards]);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveCardId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveCardId(null);
      const cardId = String(e.active.id);
      const toColumn = e.over ? String(e.over.id) : null;
      if (!toColumn) return;
      const card = cards.find((c) => c.id === cardId);
      if (!card || card.columnId === toColumn) return;
      onCardMove(cardId, card.columnId, toColumn);
    },
    [cards, onCardMove],
  );

  const activeCard = activeCardId
    ? cards.find((c) => c.id === activeCardId) ?? null
    : null;

  const handleTapColumn = useCallback(
    (columnId: string) => {
      if (!selectedCardId) return;
      const card = cards.find((c) => c.id === selectedCardId);
      if (!card) {
        setSelectedCardId(null);
        return;
      }
      if (card.columnId !== columnId) {
        onCardMove(card.id, card.columnId, columnId);
      }
      setSelectedCardId(null);
    },
    [selectedCardId, cards, onCardMove],
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveCardId(null)}
    >
      {selectedCardId && (
        <div className="md:hidden mb-3 px-3 py-2 rounded-md bg-primary/10 border border-primary/30 text-xs flex items-center justify-between gap-3">
          <span className="text-foreground">Tap a column to move the selected card.</span>
          <button
            onClick={() => setSelectedCardId(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cancel move"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x">
        {columns.map((col) => {
          const colCards = cardsByColumn.get(col.id) ?? [];
          return (
            <BoardColumn
              key={col.id}
              column={col}
              count={colCards.length}
              isTapTarget={!!selectedCardId}
              onTap={() => handleTapColumn(col.id)}
            >
              {colCards.length === 0 ? (
                <p className="text-xs text-muted-foreground italic px-2 py-3">
                  {emptyColumnLabel}
                </p>
              ) : (
                <ul className="space-y-2">
                  {colCards.map((card) => (
                    <BoardCard
                      key={card.id}
                      cardId={card.id}
                      isSelected={selectedCardId === card.id}
                      onTapSelect={(id) =>
                        setSelectedCardId((prev) => (prev === id ? null : id))
                      }
                    >
                      {renderCard(card, { isSelected: selectedCardId === card.id })}
                    </BoardCard>
                  ))}
                </ul>
              )}
            </BoardColumn>
          );
        })}
      </div>

      {/* Portal overlay: the dragged card renders here so it escapes the
          columns' overflow-y / row's overflow-x clipping (otherwise the card
          can't visually cross into another column). */}
      <DragOverlay dropAnimation={null}>
        {activeCard ? (
          <div className="rounded-md border bg-card text-card-foreground shadow-lg ring-2 ring-primary rotate-1 cursor-grabbing w-72 md:w-80">
            {renderCard(activeCard, { isSelected: false })}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  column,
  count,
  isTapTarget,
  onTap,
  children,
}: {
  column: ScrumColumn;
  count: number;
  isTapTarget: boolean;
  onTap: () => void;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section
      ref={setNodeRef}
      onClick={isTapTarget ? onTap : undefined}
      className={cn(
        "flex-shrink-0 w-72 md:w-80 snap-start rounded-lg border bg-card/40 flex flex-col",
        "transition-colors",
        isOver && "border-primary bg-primary/5",
        isTapTarget && "ring-2 ring-primary/40 cursor-pointer",
      )}
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3
          className={cn(
            "text-sm font-display tracking-wide-custom",
            column.accent || "text-foreground",
          )}
        >
          {column.title}
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      </header>
      <div className="flex-1 p-2 overflow-y-auto max-h-[70vh]">{children}</div>
      {isTapTarget && (
        <footer className="px-3 py-1.5 border-t border-primary/30 bg-primary/5 text-[11px] text-primary flex items-center gap-1.5">
          <Check className="w-3 h-3" /> Tap to drop here
        </footer>
      )}
    </section>
  );
}

function BoardCard({
  cardId,
  isSelected,
  onTapSelect,
  children,
}: {
  cardId: string;
  isSelected: boolean;
  onTapSelect: (id: string) => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: cardId,
  });

  // No transform on the source: the moving copy is rendered in <DragOverlay>,
  // which lives in a portal and isn't clipped by the column's overflow. The
  // source just dims in place to show it's being dragged.
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Tap-pick on mobile. We only fire if the user wasn't mid-drag.
        if (isDragging) return;
        e.stopPropagation();
        onTapSelect(cardId);
      }}
      className={cn(
        "rounded-md border bg-card text-card-foreground shadow-sm cursor-grab active:cursor-grabbing touch-none",
        isDragging && "opacity-60",
        isSelected && "ring-2 ring-primary",
      )}
    >
      {children}
    </li>
  );
}
