import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Check, CircleDot, Pencil, Trash2 } from "lucide-react";

export type SocialQueueItem = {
  id: string;
  media_paths: string[];
  caption: string;
  scheduled_for: string | null;
  slot: string | null;
  accounts: string[];
  status: "queued" | "ready" | "published" | "skipped";
  assigned_to: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
};

const SLOT_LABEL: Record<string, string> = {
  tue_post: "Tue Post",
  thu_post: "Thu Post",
  tue_stories: "Tue Stories",
  wed_stories: "Wed Stories",
  thu_stories: "Thu Stories",
  fri_stories: "Fri Stories",
};

const STATUS_STYLE: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  ready: "bg-primary/15 text-primary",
  published: "bg-emerald-500/15 text-emerald-300",
  skipped: "bg-muted/50 text-muted-foreground line-through",
};

export const VISUAL_ASSETS_PUBLIC_BASE = (() => {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${url}/storage/v1/object/public/visual-assets/`;
})();

export function ContentQueueItem({
  item,
  publicUrlBase = VISUAL_ASSETS_PUBLIC_BASE,
  onEdit,
  onDelete,
  onMarkReady,
  onMarkPublished,
  readOnly = false,
}: {
  item: SocialQueueItem;
  publicUrlBase?: string;
  onEdit?: (item: SocialQueueItem) => void;
  onDelete?: (item: SocialQueueItem) => void;
  onMarkReady?: (item: SocialQueueItem) => void;
  onMarkPublished?: (item: SocialQueueItem) => void;
  readOnly?: boolean;
}) {
  const dateLabel = item.scheduled_for ?? "unscheduled";
  const slotLabel = item.slot ? SLOT_LABEL[item.slot] ?? item.slot : "no slot";
  const statusStyle = STATUS_STYLE[item.status] ?? STATUS_STYLE.queued;

  return (
    <div className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline" className={`text-xs ${statusStyle}`}>
              {item.status}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Calendar className="w-3 h-3 mr-1" />
              {dateLabel} · {slotLabel}
            </Badge>
            {item.accounts.map((acct) => (
              <Badge key={acct} variant="secondary" className="text-xs capitalize">
                {acct}
              </Badge>
            ))}
            {item.assigned_to ? (
              <Badge variant="outline" className="text-xs">
                <CircleDot className="w-3 h-3 mr-1" /> {item.assigned_to}
              </Badge>
            ) : null}
          </div>
          {item.caption ? (
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
              {item.caption}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground">No caption.</p>
          )}
          {item.notes ? (
            <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
              Notes: {item.notes}
            </p>
          ) : null}
        </div>

        {!readOnly ? (
          <div className="flex flex-col gap-1 shrink-0">
            {onEdit ? (
              <Button size="sm" variant="ghost" onClick={() => onEdit(item)} aria-label="Edit">
                <Pencil className="w-4 h-4" />
              </Button>
            ) : null}
            {onMarkReady && item.status === "queued" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onMarkReady(item)}
                aria-label="Mark ready"
                title="Mark ready"
              >
                <Check className="w-4 h-4" />
              </Button>
            ) : null}
            {onMarkPublished && item.status === "ready" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onMarkPublished(item)}
                aria-label="Mark published"
                title="Mark published"
              >
                <Check className="w-4 h-4 text-emerald-500" />
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(item)}
                aria-label="Delete"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {item.media_paths.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {item.media_paths.map((path) => {
            const url = `${publicUrlBase}${path.replace(/^\//, "")}`;
            const isVideo = /\.(mp4|mov|webm)$/i.test(path);
            return (
              <a
                key={path}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block relative aspect-square rounded overflow-hidden border border-border bg-muted"
              >
                {isVideo ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    🎬 video
                  </div>
                ) : (
                  <img
                    src={url}
                    alt={path}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export { SLOT_LABEL };
