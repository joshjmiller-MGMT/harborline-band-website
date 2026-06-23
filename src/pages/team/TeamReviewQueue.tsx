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
  ExternalLink,
  RefreshCw,
  ChevronRight,
  X,
  ArrowDownToLine,
  Inbox,
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
  | "decision";

type MediaRef = {
  kind: MediaKind;
  // One of storage_path (private review-media bucket, signed URL) or external_url
  // (any absolute URL — public asset, screenshot host, etc.) must be set.
  storage_path?: string;
  external_url?: string;
  label?: string;
};
type TriLoop = { label: string; description: string };

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
  queued_at: string;
  resolved_at: string | null;
}

const TYPE_LABELS: Record<ItemType, string> = {
  general: "General",
  sidecar_classification: "Asset",
  brand_voice: "Voice",
  visual_review: "Visual",
  decision: "Decision",
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

export default function TeamReviewQueue() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ItemType>("all");
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [resolution, setResolution] = useState("");
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("waiting_on_josh")
      .select(
        "id, title, prompt, detail, context_md, media_refs, triangulation_loops, source_ref, source_session, priority, item_type, queued_at, resolved_at",
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
    setResolving(true);
    try {
      const note =
        resolution.trim() ||
        (action === "rejected" ? "Marked non-actionable" : "");
      const { error } = await supabase
        .from("waiting_on_josh")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: "josh",
          resolution_note: note,
        })
        .eq("id", current.id);
      if (error) throw error;
      toast({
        title: action === "resolved" ? "Resolved" : "Rejected",
        description:
          current.source_ref
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
                        className={`w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors ${
                          isSelected ? "bg-primary/10" : ""
                        }`}
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
                    <Button
                      variant="outline"
                      onClick={deferItem}
                      disabled={resolving}
                    >
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
                    {current.source_ref && current.source_ref.startsWith("wiki/") && (
                      <span className="text-[11px] text-muted-foreground ml-auto inline-flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        write-back via next Claude session
                      </span>
                    )}
                  </div>
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
