import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ClipboardCopy, Loader2, Plus, RefreshCw } from "lucide-react";
import {
  ContentQueueItem,
  SLOT_LABEL,
  SocialQueueItem,
} from "./ContentQueueItem";

const ACCOUNTS = [
  { id: "personal", label: "Personal" },
  { id: "harborline", label: "Harborline" },
  { id: "economy", label: "Economy" },
];

const SLOTS = Object.keys(SLOT_LABEL);

type EditState = {
  open: boolean;
  id: string | null;
  caption: string;
  scheduled_for: string;
  slot: string;
  accounts: string[];
  assigned_to: string;
  notes: string;
  media_paths_text: string;
};

const EMPTY_EDIT: EditState = {
  open: false,
  id: null,
  caption: "",
  scheduled_for: "",
  slot: "",
  accounts: [],
  assigned_to: "",
  notes: "",
  media_paths_text: "",
};

function isoWeekOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

async function callMutate<T = unknown>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("social-queue-mutate", {
    body: payload,
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      try {
        const body = await ctx.json();
        throw new Error(body.error || body.message || error.message);
      } catch {
        /* fall through */
      }
    }
    throw error;
  }
  return data as T;
}

export default function SocialContentQueueManager() {
  const { toast } = useToast();
  const [items, setItems] = useState<SocialQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<EditState>(EMPTY_EDIT);
  const [saving, setSaving] = useState(false);
  const [week, setWeek] = useState(isoWeekOf(new Date()));
  const [shareLoading, setShareLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callMutate<{ items: SocialQueueItem[] }>({ op: "list" });
      setItems(data.items ?? []);
    } catch (e) {
      console.error("social queue list failed", e);
      toast({
        title: "Queue load failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () =>
    setEdit({
      ...EMPTY_EDIT,
      open: true,
    });

  const openEdit = (item: SocialQueueItem) =>
    setEdit({
      open: true,
      id: item.id,
      caption: item.caption,
      scheduled_for: item.scheduled_for ?? "",
      slot: item.slot ?? "",
      accounts: [...item.accounts],
      assigned_to: item.assigned_to,
      notes: item.notes,
      media_paths_text: item.media_paths.join("\n"),
    });

  const closeEdit = () => setEdit(EMPTY_EDIT);

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        op: edit.id ? "update" : "insert",
        caption: edit.caption,
        scheduled_for: edit.scheduled_for || null,
        slot: edit.slot || null,
        accounts: edit.accounts,
        assigned_to: edit.assigned_to,
        notes: edit.notes,
        media_paths: edit.media_paths_text
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (edit.id) payload.id = edit.id;
      await callMutate(payload);
      toast({ title: edit.id ? "Updated" : "Added", description: "Queue refreshed." });
      closeEdit();
      load();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const markStatus = async (item: SocialQueueItem, status: SocialQueueItem["status"]) => {
    try {
      await callMutate({ op: "update", id: item.id, status });
      toast({ title: `Marked ${status}` });
      load();
    } catch (e) {
      toast({
        title: "Update failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const remove = async (item: SocialQueueItem) => {
    if (!window.confirm("Delete this queue item?")) return;
    try {
      await callMutate({ op: "delete", id: item.id });
      toast({ title: "Deleted" });
      load();
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const copyHandoffLink = async () => {
    setShareLoading(true);
    try {
      const data = await callMutate<{ week: string; token: string; path: string }>({
        op: "mint_handoff_url",
        week,
      });
      const url = `${window.location.origin}${data.path}`;
      await navigator.clipboard.writeText(url);
      toast({
        title: "Des handoff link copied",
        description: url,
      });
    } catch (e) {
      toast({
        title: "Could not mint link",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setShareLoading(false);
    }
  };

  const toggleAccount = (acct: string) => {
    setEdit((prev) => ({
      ...prev,
      accounts: prev.accounts.includes(acct)
        ? prev.accounts.filter((a) => a !== acct)
        : [...prev.accounts, acct],
    }));
  };

  const grouped = useMemo(() => {
    const buckets = new Map<string, SocialQueueItem[]>();
    for (const item of items) {
      const key = item.scheduled_for ?? "unscheduled";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(item);
    }
    return [...buckets.entries()].sort(([a], [b]) => {
      if (a === "unscheduled") return 1;
      if (b === "unscheduled") return -1;
      return a.localeCompare(b);
    });
  }, [items]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Content Queue
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Mon prep / Tue post + stories / Wed stories / Thu post / Fri stories. Tracker
            layer — posting stays manual.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} aria-label="Refresh">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2 p-3 rounded-md border border-border bg-muted/30">
          <div className="flex flex-col">
            <Label className="text-xs mb-1">Share week with Des</Label>
            <Input
              value={week}
              onChange={(e) => setWeek(e.target.value.trim())}
              placeholder="2026-W20"
              className="w-32 font-mono text-sm"
            />
          </div>
          <Button onClick={copyHandoffLink} disabled={shareLoading} variant="secondary" size="sm">
            {shareLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ClipboardCopy className="w-4 h-4 mr-2" />
            )}
            Copy handoff link
          </Button>
          <p className="text-xs text-muted-foreground self-center">
            Generates a read-only `/team/social-handoff/{`<week>`}` URL Des can open without
            signing in.
          </p>
        </div>

        {loading && items.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No queued content yet. Click "Add" to start.
          </p>
        ) : (
          <div className="space-y-5">
            {grouped.map(([day, dayItems]) => (
              <div key={day}>
                <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  {day} · {dayItems.length} item{dayItems.length === 1 ? "" : "s"}
                </h4>
                <div className="space-y-2">
                  {dayItems.map((item) => (
                    <ContentQueueItem
                      key={item.id}
                      item={item}
                      onEdit={openEdit}
                      onDelete={remove}
                      onMarkReady={(it) => markStatus(it, "ready")}
                      onMarkPublished={(it) => markStatus(it, "published")}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={edit.open} onOpenChange={(open) => (open ? null : closeEdit())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit.id ? "Edit queue item" : "Add queue item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Caption</Label>
              <Textarea
                value={edit.caption}
                onChange={(e) => setEdit((p) => ({ ...p, caption: e.target.value }))}
                placeholder="Caption / post body"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Scheduled date</Label>
                <Input
                  type="date"
                  value={edit.scheduled_for}
                  onChange={(e) => setEdit((p) => ({ ...p, scheduled_for: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Slot</Label>
                <Select
                  value={edit.slot}
                  onValueChange={(v) => setEdit((p) => ({ ...p, slot: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {SLOTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SLOT_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Accounts</Label>
              <div className="flex gap-3 mt-1">
                {ACCOUNTS.map((acct) => (
                  <label key={acct.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={edit.accounts.includes(acct.id)}
                      onCheckedChange={() => toggleAccount(acct.id)}
                    />
                    {acct.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Assigned to</Label>
                <Input
                  value={edit.assigned_to}
                  onChange={(e) => setEdit((p) => ({ ...p, assigned_to: e.target.value }))}
                  placeholder="josh / des / ..."
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Media storage paths (one per line)</Label>
              <Textarea
                value={edit.media_paths_text}
                onChange={(e) => setEdit((p) => ({ ...p, media_paths_text: e.target.value }))}
                placeholder="social-queue/2026-W20/clip.mp4"
                rows={3}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Paths inside the `visual-assets` Storage bucket (e.g. uploaded via
                /team/visual-assets).
              </p>
            </div>
            <div>
              <Label className="text-xs">Internal notes</Label>
              <Textarea
                value={edit.notes}
                onChange={(e) => setEdit((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Anything Des should know"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeEdit} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {edit.id ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
