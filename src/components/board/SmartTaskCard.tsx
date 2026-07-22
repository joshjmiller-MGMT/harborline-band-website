import { ExternalLink, Calendar, Target, Clock, MessageSquarePlus, Repeat } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SMART_VENTURES,
  type SmartVenture,
} from "./smartTaskBuckets";

export type SmartTaskCardData = {
  id: string;
  columnId: string; // the bucket (e.g. "Pending approval")
  venture: SmartVenture;
  source: "smart" | "trello";
  title: string;
  bucketLabel: string;
  ageDays: number | null;
  dueDate: string | null;
  definitionOfDone: string | null;
  measure: string | null;
  effort: string | null;
  externalUrl: string | null;
  recurringFollowup: boolean;
};

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  const diff = Date.now() - parsed.getTime();
  if (diff < 0) return null;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function ageFromCreatedAt(createdAt: string): number | null {
  return daysSince(createdAt);
}

export function SmartTaskCard({
  card,
  onChangeVenture,
  onSendToReview,
  onToggleFollowup,
}: {
  card: SmartTaskCardData;
  onChangeVenture: (cardId: string, venture: SmartVenture) => void;
  onSendToReview?: (card: SmartTaskCardData) => void;
  onToggleFollowup?: (cardId: string, next: boolean) => void;
}) {
  const ventureChangeable = card.source === "smart";
  // "Add context → Review" appears on cards that still need smartifying — the
  // Trello inbox + the Needs SMART bucket. Sends the card to the review board so
  // Josh can add context, which flows back to Needs SMART (review↔smartify loop).
  const needsContext = card.source === "trello" || card.columnId === "Needs SMART";
  // "Follow up until done" applies to SMART tasks that live on the calendar
  // (Active). Toggling it on tells the daily repin job to keep re-surfacing the
  // task until Josh moves it to Done (the "Caitlyn" pattern).
  const followupToggleable = card.source === "smart" && card.columnId === "Active";

  return (
    <div className="px-3 py-2.5 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground line-clamp-2 flex-1 min-w-0">
          {card.title}
        </p>
        {card.externalUrl && (
          <a
            href={card.externalUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
            aria-label={card.source === "trello" ? "Open in Trello" : "Open calendar event"}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
            card.source === "trello"
              ? "bg-amber-500/15 text-amber-500"
              : "bg-primary/15 text-primary"
          }`}
        >
          {card.bucketLabel}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            asChild
            disabled={!ventureChangeable}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border bg-card/60 hover:bg-muted/60 ${
                ventureChangeable ? "cursor-pointer" : "cursor-not-allowed opacity-70"
              }`}
              aria-label={ventureChangeable ? "Change venture" : "Trello inbox cards can't move venture from the board"}
            >
              {card.venture}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
              Move venture
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SMART_VENTURES.map((v) => (
              <DropdownMenuItem
                key={v}
                disabled={v === card.venture}
                onSelect={() => onChangeVenture(card.id, v)}
                className="text-xs"
              >
                {v}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {card.recurringFollowup && (
          <span
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/15 text-accent"
            title="Recurring follow-up — re-surfaces daily until moved to Done"
          >
            <Repeat className="w-3 h-3" /> follow-up
          </span>
        )}
      </div>

      {(card.definitionOfDone || card.measure || card.effort) && (
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          {card.definitionOfDone && (
            <p className="line-clamp-1">DOD: {card.definitionOfDone}</p>
          )}
          {card.measure && (
            <p className="line-clamp-1 inline-flex items-center gap-1">
              <Target className="w-3 h-3" /> {card.measure}
            </p>
          )}
          {card.effort && (
            <p className="line-clamp-1 inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> {card.effort}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {card.dueDate && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {card.dueDate}
          </span>
        )}
        {card.ageDays !== null && (
          <span>
            {card.ageDays === 0 ? "today" : `${card.ageDays}d`}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {needsContext && onSendToReview && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSendToReview(card);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 hover:underline"
          >
            <MessageSquarePlus className="w-3 h-3" /> Add context → Review
          </button>
        )}
        {followupToggleable && onToggleFollowup && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFollowup(card.id, !card.recurringFollowup);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1 text-[10px] font-medium hover:underline ${
              card.recurringFollowup
                ? "text-accent hover:text-accent/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={
              card.recurringFollowup
                ? "Stop re-surfacing this follow-up"
                : "Keep re-surfacing daily until done"
            }
          >
            <Repeat className="w-3 h-3" />{" "}
            {card.recurringFollowup ? "Stop follow-up" : "Follow up until done"}
          </button>
        )}
      </div>
    </div>
  );
}
