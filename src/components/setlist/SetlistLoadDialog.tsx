import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { orgLabel, type SetlistOrg } from "@/lib/songFilters";
import { Loader2, Trash2, ListMusic } from "lucide-react";
import { toast } from "sonner";

export type SavedSetlist = {
  id: string;
  name: string;
  org: SetlistOrg;
  event_name: string | null;
  event_date: string | null;
  venue: string | null;
  song_ids: string[];
  song_snapshot: unknown;
  notes: string | null;
  updated_at: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoad: (setlist: SavedSetlist) => void;
};

const SetlistLoadDialog = ({ open, onOpenChange, onLoad }: Props) => {
  const [rows, setRows] = useState<SavedSetlist[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("setlists")
      .select("id, name, org, event_name, event_date, venue, song_ids, song_snapshot, notes, updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Couldn't load your setlists");
        else setRows((data ?? []) as SavedSetlist[]);
        setLoading(false);
      });
  }, [open]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("setlists").delete().eq("id", id);
    if (error) {
      toast.error("Delete failed");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("Setlist deleted");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Load a setlist</DialogTitle>
          <DialogDescription>Open a saved setlist to keep editing it.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No saved setlists yet.
          </p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {rows.map((r) => {
              const count = Array.isArray(r.song_snapshot)
                ? r.song_snapshot.length
                : r.song_ids?.length ?? 0;
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:border-primary/50 transition-colors"
                >
                  <ListMusic className="w-4 h-4 text-primary flex-shrink-0" />
                  <button
                    className="flex-1 min-w-0 text-left"
                    onClick={() => {
                      onLoad(r);
                      onOpenChange(false);
                    }}
                  >
                    <p className="font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {orgLabel(r.org)} · {count} songs
                      {r.event_name ? ` · ${r.event_name}` : ""}
                    </p>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => handleDelete(r.id)}
                    aria-label="Delete setlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SetlistLoadDialog;
