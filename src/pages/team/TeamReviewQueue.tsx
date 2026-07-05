import { useEffect, useState, useCallback, useMemo } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Helmet } from "react-helmet-async";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MicButton } from "@/components/dictation/MicButton";
import { appendDictation } from "@/hooks/useDictation";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Upload,
  Paperclip,
  RefreshCw,
  ChevronRight,
  X,
  ArrowDownToLine,
  Inbox,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import LaneLogWidget from "@/components/team/LaneLogWidget";

type MediaKind = "image" | "video" | "screenshot";
type ItemType =
  | "general"
  | "sidecar_classification"
  | "brand_voice"
  | "visual_review"
  | "decision"
  | "choice"
  | "smartify-context";

// One tappable answer on a multiple-choice escalation. `recommended` flags the
// branch's suggested default (the one mirrored in assumed_default).
type ChoiceOption = { label: string; recommended?: boolean };

type MediaRef = {
  kind: MediaKind;
  // One of storage_path (private review-media bucket, signed URL) or external_url
  // (any absolute URL — public asset, screenshot host, etc.) must be set.
  storage_path?: string;
  external_url?: string;
  label?: string;
};
type TriLoop = { label: string; description: string };

// A file Josh uploaded on a card as part of resolving it (review-uploads bucket).
type UploadRef = {
  path: string;
  name: string;
  size: number;
  mime: string;
  uploaded_at: string;
};

interface ReviewItem {
  id: string;
  title: string;
  prompt: string | null;
  detail: string | null;
  context_md: string | null;
  media_refs: MediaRef[];
  triangulation_loops: TriLoop[];
  source_ref: string | null;
  source_session: string | null;
  priority: string;
  item_type: ItemType;
  // Multiple-choice escalation: one-tap answer options + the non-blocking
  // default the branch already proceeded with (null for plain questions).
  options: ChoiceOption[] | null;
  assumed_default: string | null;
  // Files Josh attached on this card as part of resolving it.
  uploads: UploadRef[] | null;
  queued_at: string;
  resolved_at: string | null;
}

const TYPE_LABELS: Record<ItemType, string> = {
  general: "General",
  sidecar_classification: "Asset",
  brand_voice: "Voice",
  visual_review: "Visual",
  decision: "Decision",
  choice: "Choice",
  "smartify-context": "Add context",
};

const PRIORITY_RANK: Record<string, number> = { high: 0, normal: 1, low: 2 };

function ageLabel(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const MAX_UPLOAD_BYTES = 104857600; // 100 MB — matches the review-uploads bucket limit.

export default function TeamReviewQueue() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ItemType>("all");
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [resolution, setResolution] = useState("");
  const [resolving, setResolving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("waiting_on_josh")
      .select(
        "id, title, prompt, detail, context_md, media_refs, triangulation_loops, source_ref, source_session, priority, item_type, options, assumed_default, uploads, queued_at, resolved_at",
      )
      .is("resolved_at", null);
    if (error) {
      toast({
        title: "Load failed",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    const rows = ((data || []) as unknown as ReviewItem[]).slice().sort((a, b) => {
      const pr = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
      if (pr !== 0) return pr;
      return new Date(b.queued_at).getTime() - new Date(a.queued_at).getTime();
    });
    setItems(rows);
    if (rows.length && !rows.find((r) => r.id === selectedId)) {
      setSelectedId(rows[0].id);
    }
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.item_type === filter)),
    [items, filter],
  );

  const current = items.find((i) => i.id === selectedId) || null;

  // Clear the typed answer when switching cards (fix: the typed answer used to carry from card to card).
  useEffect(() => {
    setResolution("");
  }, [selectedId]);

  // Resolve a stable key for each ref + populate URLs (signed for storage_path, passthrough for external_url).
  useEffect(() => {
    if (!current || !current.media_refs?.length) {
      setSignedUrls({});
      return;
    }
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const ref of current.media_refs) {
        if (ref.external_url) {
          next[ref.external_url] = ref.external_url;
          continue;
        }
        if (!ref.storage_path) continue;
        const { data, error } = await supabase.storage
          .from("review-media")
          .createSignedUrl(ref.storage_path, 3600);
        if (error) {
          console.error("createSignedUrl error", ref.storage_path, error);
          continue;
        }
        if (data?.signedUrl) next[ref.storage_path] = data.signedUrl;
      }
      if (!cancelled) setSignedUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [current]);

  function refKey(ref: MediaRef): string {
    return ref.external_url ?? ref.storage_path ?? "";
  }

  // Per-type counts for tab badges.
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const i of items) {
      counts[i.item_type] = (counts[i.item_type] || 0) + 1;
    }
    return counts;
  }, [items]);

  // Shared close-out: stamp the row resolved with `note`, advance selection,
  // reload. `toastTitle` distinguishes Resolve / Reject / a tapped choice.
  async function commitResolution(note: string, toastTitle: string) {
    if (!current) return;
    setResolving(true);
    try {
      const { error } = await supabase
        .from("waiting_on_josh")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: "josh",
          resolution_note: note,
        })
        .eq("id", current.id);
      if (error) throw error;
      // Review↔smartify loop: a resolved 'smartify-context' item flows back to the
      // SMART board's Needs SMART bucket, now carrying Josh's context (skip rejects).
      if (
        current.item_type === "smartify-context" &&
        note.trim() &&
        note.trim() !== "Marked non-actionable"
      ) {
        await supabase.from("smart_task_enrichments").insert({
          raw_input: `${current.title}\n\nContext from Josh: ${note.trim()}`,
          board_bucket: "Needs SMART",
        });
      }
      toast({
        title: toastTitle,
        description: current.source_ref
          ? `Lock answer into ${current.source_ref} in the next Claude session — the row is now closed.`
          : "Row closed.",
      });
      setResolution("");
      const remaining = items.filter((i) => i.id !== current.id);
      setSelectedId(remaining[0]?.id ?? null);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed", description: msg, variant: "destructive" });
    } finally {
      setResolving(false);
    }
  }

  async function resolveItem(action: "resolved" | "rejected") {
    if (!current) return;
    if (!resolution.trim() && action === "resolved") {
      toast({
        title: "Need a resolution note",
        description: "Enter a brief answer or context line before resolving.",
        variant: "destructive",
      });
      return;
    }
    const note =
      resolution.trim() || (action === "rejected" ? "Marked non-actionable" : "");
    await commitResolution(note, action === "resolved" ? "Resolved" : "Rejected");
  }

  // One-tap multiple-choice answer: resolve the row with the chosen option's
  // label as the resolution note.
  async function resolveChoice(label: string) {
    await commitResolution(label, "Answered");
  }

  async function deferItem() {
    if (!current) return;
    setResolving(true);
    try {
      const { error } = await supabase
        .from("waiting_on_josh")
        .update({
          priority: "low",
          queued_at: new Date().toISOString(),
        })
        .eq("id", current.id);
      if (error) throw error;
      toast({ title: "Deferred", description: "Pushed to bottom of queue." });
      const remaining = items.filter((i) => i.id !== current.id);
      setSelectedId(remaining[0]?.id ?? null);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed", description: msg, variant: "destructive" });
    } finally {
      setResolving(false);
    }
  }

  // Upload one or more files as part of resolving a card (e.g. an iReal HTML
  // export, a bank statement). Stored in the private review-uploads bucket;
  // metadata recorded on the card's uploads[] so a Claude session can pull it.
  async function handleUpload(files: FileList | null) {
    if (!current || !files || files.length === 0) return;
    setUploading(true);
    try {
      const added: UploadRef[] = [];
      for (const file of Array.from(files)) {
        if (file.size > MAX_UPLOAD_BYTES) {
          toast({
            title: "File too large",
            description: `${file.name} is ${humanSize(file.size)} — the limit is 100 MB.`,
            variant: "destructive",
          });
          continue;
        }
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${current.id}/${Date.now()}-${safe}`;
        const { error } = await supabase.storage
          .from("review-uploads")
          .upload(path, file, { upsert: false });
        if (error) {
          toast({ title: "Upload failed", description: error.message, variant: "destructive" });
          continue;
        }
        added.push({
          path,
          name: file.name,
          size: file.size,
          mime: file.type || "application/octet-stream",
          uploaded_at: new Date().toISOString(),
        });
      }
      if (added.length) {
        const next = [...(current.uploads ?? []), ...added];
        const { error } = await supabase
          .from("waiting_on_josh")
          .update({ uploads: next })
          .eq("id", current.id);
        if (error) throw error;
        toast({ title: "Uploaded", description: `${added.length} file(s) attached to this card.` });
        await load();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function downloadUpload(path: string) {
    const { data, error } = await supabase.storage
      .from("review-uploads")
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast({ title: "Couldn't open file", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function removeUpload(path: string) {
    if (!current) return;
    try {
      await supabase.storage.from("review-uploads").remove([path]);
      const next = (current.uploads ?? []).filter((u) => u.path !== path);
      const { error } = await supabase
        .from("waiting_on_josh")
        .update({ uploads: next })
        .eq("id", current.id);
      if (error) throw error;
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed", description: msg, variant: "destructive" });
    }
  }

  return (
    <TeamLayout>
      <Helmet>
        <title>Review Queue — Harborline</title>
      </Helmet>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Inbox className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-display tracking-wide-custom">
              Review Queue
            </h1>
            <Badge variant="outline">{items.length} pending</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-4 max-w-3xl">
          Questions and decisions Claude is waiting on you for, with visual
          context where it matters. Resolve a row to lock the answer into the
          source artifact on the next Claude session — defer to push to the
          bottom; reject if non-actionable.
        </p>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">
              All <Badge variant="outline" className="ml-2 text-[10px]">{typeCounts.all || 0}</Badge>
            </TabsTrigger>
            {(Object.keys(TYPE_LABELS) as ItemType[]).map((t) => (
              <TabsTrigger key={t} value={t}>
                {TYPE_LABELS[t]}
                <Badge variant="outline" className="ml-2 text-[10px]">
                  {typeCounts[t] || 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-4">
          {/* Left: list */}
          <Card className="p-2 max-h-[calc(100vh-220px)] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-primary" />
                Nothing pending in this filter.
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {filtered.map((item) => {
                  const isSelected = item.id === selectedId;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-l-2 ${
                          item.priority === "high"
                            ? "border-l-red-500"
                            : item.priority === "low"
                              ? "border-l-border/40"
                              : "border-l-sky-500/50"
                        } ${isSelected ? "bg-primary/10" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              {item.priority === "high" && (
                                <Badge variant="destructive" className="text-[10px] uppercase tracking-wider">
                                  High
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                                {TYPE_LABELS[item.item_type]}
                              </Badge>
                              {item.media_refs?.length > 0 && (
                                <ImageIcon className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>
                            <p className="text-sm leading-snug">{item.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              {ageLabel(item.queued_at)}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Right: detail */}
          <Card className="p-6 max-h-[calc(100vh-220px)] overflow-y-auto">
            {!current ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 mb-3 text-primary" />
                <p className="text-sm">No item selected.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                      {TYPE_LABELS[current.item_type]}
                    </Badge>
                    {current.priority === "high" && (
                      <Badge variant="destructive" className="text-[10px] uppercase tracking-wider">
                        High
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      queued {ageLabel(current.queued_at)}
                    </span>
                  </div>
                  <h2 className="text-xl font-display tracking-wide-custom mb-2">
                    {current.title}
                  </h2>
                  {current.prompt && (
                    <p className="text-base text-foreground">{current.prompt}</p>
                  )}
                  {current.assumed_default && (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                      <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-foreground/90">
                        <span className="font-medium">Non-blocking —</span>{" "}
                        Claude is proceeding with:{" "}
                        <span className="font-medium">{current.assumed_default}</span>.
                        Your answer below confirms or overrides it.
                      </p>
                    </div>
                  )}
                </div>

                {current.context_md && (
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Context
                    </h3>
                    <pre className="text-sm whitespace-pre-wrap leading-relaxed bg-muted/30 rounded p-3 font-sans">
                      {current.context_md}
                    </pre>
                  </div>
                )}

                {current.media_refs && current.media_refs.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      Reference media ({current.media_refs.length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {current.media_refs.map((ref) => {
                        const key = refKey(ref);
                        const url = signedUrls[key];
                        return (
                          <div
                            key={key}
                            className="rounded border border-border/40 overflow-hidden bg-muted/20"
                          >
                            {!url ? (
                              <div className="aspect-video flex items-center justify-center text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                              </div>
                            ) : ref.kind === "video" ? (
                              <video
                                src={url}
                                controls
                                preload="metadata"
                                className="w-full aspect-video bg-black"
                              />
                            ) : (
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={url}
                                  alt={ref.label ?? key}
                                  className="w-full aspect-video object-cover"
                                  loading="lazy"
                                />
                              </a>
                            )}
                            {ref.label && (
                              <p className="px-2 py-1.5 text-xs text-muted-foreground border-t border-border/40">
                                {ref.label}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {current.triangulation_loops &&
                  current.triangulation_loops.length > 0 && (
                    <div>
                      <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Triangulation loops (Claude can run these)
                      </h3>
                      <ul className="space-y-2">
                        {current.triangulation_loops.map((loop, i) => (
                          <li
                            key={i}
                            className="text-sm bg-muted/20 rounded p-2.5 border border-border/30"
                          >
                            <p className="font-medium">{loop.label}</p>
                            {loop.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {loop.description}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {current.source_ref && (
                  <div className="text-xs text-muted-foreground">
                    Source:{" "}
                    <code className="bg-muted/30 px-1.5 py-0.5 rounded">
                      {current.source_ref}
                    </code>
                  </div>
                )}

                {/* Resolution */}
                <div className="border-t border-border/40 pt-4">
                  {/* Attach a file as part of resolving — any type, ≤100 MB
                      (e.g. an iReal HTML export, a bank statement, a doc). */}
                  <div className="mb-4">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5" />
                      Attach a file
                    </h3>
                    {current.uploads && current.uploads.length > 0 && (
                      <ul className="mb-2 space-y-1">
                        {current.uploads.map((u) => (
                          <li
                            key={u.path}
                            className="flex items-center gap-2 text-sm bg-muted/20 rounded px-2 py-1.5 border border-border/30"
                          >
                            <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <button
                              onClick={() => downloadUpload(u.path)}
                              className="truncate hover:underline text-left flex-1"
                              title={`Open ${u.name}`}
                            >
                              {u.name}
                            </button>
                            <span className="text-[11px] text-muted-foreground flex-shrink-0">
                              {humanSize(u.size)}
                            </span>
                            <button
                              onClick={() => removeUpload(u.path)}
                              title="Remove file"
                              className="text-muted-foreground hover:text-destructive flex-shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm rounded-md border border-border/50 px-3 py-2 hover:bg-muted/50 transition-colors">
                      {uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span>{uploading ? "Uploading…" : "Choose file"}</span>
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          handleUpload(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Any file type, up to 100 MB. Stored privately.
                    </p>
                  </div>

                  {current.options && current.options.length > 0 ? (
                    // Multiple-choice: one tap per option resolves the row with
                    // that label. The recommended option is visually primary.
                    <>
                      <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Pick an answer
                      </h3>
                      <div className="flex flex-col gap-2 mb-3">
                        {current.options.map((opt, i) => (
                          <Button
                            key={`${opt.label}-${i}`}
                            variant={opt.recommended ? "default" : "outline"}
                            onClick={() => resolveChoice(opt.label)}
                            disabled={resolving}
                            className="justify-start h-auto py-2.5 text-left whitespace-normal"
                          >
                            {resolving ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
                            )}
                            <span>{opt.label}</span>
                            {opt.recommended && (
                              <Badge
                                variant="secondary"
                                className="ml-2 text-[10px] uppercase tracking-wider"
                              >
                                Recommended
                              </Badge>
                            )}
                          </Button>
                        ))}
                      </div>
                      {/* "Other" — type a custom answer instead of picking an option. */}
                      <details className="mb-3 rounded-md border border-border p-2">
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                          Other — type your own answer
                        </summary>
                        <div className="mt-2 flex items-center justify-between mb-1">
                          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Your answer</span>
                          <MicButton label title="Dictate your answer" onText={(t) => setResolution((p) => appendDictation(p, t))} />
                        </div>
                        <Textarea
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value)}
                          placeholder="Type a custom answer (used instead of the options above)…"
                          rows={3}
                          className="mb-2"
                        />
                        <Button size="sm" onClick={() => resolveItem("resolved")} disabled={resolving || !resolution.trim()}>
                          {resolving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                          Submit answer
                        </Button>
                      </details>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" onClick={deferItem} disabled={resolving}>
                          <ArrowDownToLine className="w-4 h-4 mr-1" />
                          Defer
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => resolveItem("rejected")}
                          disabled={resolving}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </>
                  ) : (
                    // Free-text fallback (no options on this row).
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
                          Your answer
                        </h3>
                        <MicButton
                          label
                          title="Dictate your answer"
                          onText={(t) => setResolution((p) => appendDictation(p, t))}
                        />
                      </div>
                      <Textarea
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        placeholder="Lock the answer into the source artifact. E.g. 'Erica Hoffman wedding cocktail hour — Gramercy, A1 role.' — or tap Dictate and talk."
                        rows={4}
                        className="mb-3"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          onClick={() => resolveItem("resolved")}
                          disabled={resolving || !resolution.trim()}
                        >
                          {resolving ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                          )}
                          Resolve
                        </Button>
                        <Button variant="outline" onClick={deferItem} disabled={resolving}>
                          <ArrowDownToLine className="w-4 h-4 mr-1" />
                          Defer
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => resolveItem("rejected")}
                          disabled={resolving}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Orchestration lane log — live view of what every Claude branch is
            claiming / working / done (reads the work_claims lease table). */}
        <div className="mt-8">
          <LaneLogWidget />
        </div>
      </div>
    </TeamLayout>
  );
}
