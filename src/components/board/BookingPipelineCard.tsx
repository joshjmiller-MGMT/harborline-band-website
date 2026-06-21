import { ExternalLink, Calendar, MessageSquare, CheckCircle2 } from "lucide-react";

export type BookingPipelineCardData = {
  id: string;
  columnId: string;
  rowIndex: number;
  name: string;
  status: string;
  type: string;
  notes: string;
  link: string;
  lastContact: string;
  nextFollowup: string;
  nextFollowupDate: string | null;
};

function daysSince(dateStr: string): number | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  const diff = Date.now() - parsed.getTime();
  if (diff < 0) return null;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function BookingPipelineCard({
  card,
  sheetFallbackUrl,
}: {
  card: BookingPipelineCardData;
  sheetFallbackUrl: string;
}) {
  const age = daysSince(card.lastContact);
  const isDone = card.columnId === "Done";
  return (
    <div className={`px-3 py-2.5 space-y-1.5 ${isDone ? "bg-emerald-500/5" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 flex-1 min-w-0">
          {isDone && (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" aria-label="Done" />
          )}
          <p className="text-sm font-medium text-foreground truncate flex-1 min-w-0">
            {card.name}
          </p>
        </div>
        <a
          href={card.link || sheetFallbackUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground flex-shrink-0"
          aria-label="Open in sheet"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {(card.type || card.status) && (
        <p className="text-xs text-muted-foreground truncate">
          {card.type}
          {card.type && card.status ? " · " : ""}
          {card.status}
        </p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {card.nextFollowupDate && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Next: {card.nextFollowupDate}
          </span>
        )}
        {age !== null && (
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {age === 0 ? "today" : `${age}d ago`}
          </span>
        )}
      </div>
    </div>
  );
}
