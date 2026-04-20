import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Share2, Plus, Sparkles, Repeat, Calendar as CalIcon, Trash2, Wand2, Instagram, Music2, Facebook, ChevronRight, Copy, CheckCircle2,
} from "lucide-react";
import WeekScheduleCalendar from "./WeekScheduleCalendar";

type Brand = {
  id: string; slug: string; name: string; color: string; platforms: string[]; voice_notes: string;
};
type Source = {
  id: string; brand_id: string; title: string; description: string;
  kind: "recurring" | "oneoff"; cadence: "weekly" | "biweekly" | "monthly" | null;
  day_of_week: number | null; event_date: string | null; last_generated_at: string | null; active: boolean;
};
type Post = {
  id: string; brand_id: string; source_id: string | null; title: string; notes: string;
  status: "idea" | "drafting" | "scheduled" | "posted";
  scheduled_for: string | null; posted_at: string | null;
  captions: Record<string, string>;
  platform_status: Record<string, "pending" | "posted">;
  asset_urls: string[]; sort_order: number;
};

const STATUSES: Post["status"][] = ["idea", "drafting", "scheduled", "posted"];
const STATUS_LABEL: Record<Post["status"], string> = {
  idea: "Ideas", drafting: "Drafting", scheduled: "Scheduled", posted: "Posted",
};
const PLATFORM_ICON: Record<string, any> = {
  instagram: Instagram, tiktok: Music2, facebook: Facebook,
};
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SocialManagerWidget() {
  const { toast } = useToast();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeBrandSlug, setActiveBrandSlug] = useState<string>("harborline");
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [postDialog, setPostDialog] = useState<Post | null>(null);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [newSource, setNewSource] = useState<Partial<Source>>({
    kind: "recurring", cadence: "weekly", day_of_week: 5, active: true,
  });

  const activeBrand = brands.find((b) => b.slug === activeBrandSlug);

  const loadAll = async () => {
    const [b, s, p] = await Promise.all([
      supabase.from("social_brands").select("*").order("sort_order"),
      supabase.from("social_sources").select("*").order("created_at", { ascending: false }),
      supabase.from("social_posts").select("*").order("sort_order").order("created_at", { ascending: false }),
    ]);
    if (b.data) setBrands(b.data as Brand[]);
    if (s.data) setSources(s.data as Source[]);
    if (p.data) setPosts(p.data as Post[]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll().then(() => generateRecurringIfDue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-create idea cards for recurring sources whose cadence has elapsed
  const generateRecurringIfDue = async () => {
    const { data: srcs } = await supabase
      .from("social_sources")
      .select("*")
      .eq("kind", "recurring")
      .eq("active", true);
    if (!srcs) return;
    const now = new Date();
    const inserts: any[] = [];
    const updates: { id: string }[] = [];
    for (const s of srcs as Source[]) {
      const last = s.last_generated_at ? new Date(s.last_generated_at) : null;
      const days = s.cadence === "weekly" ? 7 : s.cadence === "biweekly" ? 14 : 30;
      const elapsed = !last || (now.getTime() - last.getTime()) / 86400000 >= days;
      if (!elapsed) continue;
      inserts.push({
        brand_id: s.brand_id,
        source_id: s.id,
        title: `${s.title} — ${now.toLocaleDateString()}`,
        notes: s.description,
        status: "idea",
      });
      updates.push({ id: s.id });
    }
    if (inserts.length) {
      await supabase.from("social_posts").insert(inserts);
      for (const u of updates) {
        await supabase.from("social_sources").update({ last_generated_at: now.toISOString() }).eq("id", u.id);
      }
      loadAll();
    }
  };

  const brandPosts = useMemo(
    () => posts.filter((p) => p.brand_id === activeBrand?.id),
    [posts, activeBrand],
  );
  const brandSources = useMemo(
    () => sources.filter((s) => s.brand_id === activeBrand?.id),
    [sources, activeBrand],
  );

  // Cross-platform consistency: posts that exist but haven't been pushed everywhere
  const consistencyGaps = useMemo(() => {
    if (!activeBrand) return [];
    return brandPosts
      .filter((p) => p.status !== "idea")
      .map((p) => {
        const missing = (activeBrand.platforms || []).filter(
          (pl) => p.platform_status?.[pl] !== "posted",
        );
        return { post: p, missing };
      })
      .filter((x) => x.missing.length > 0 && x.post.status === "posted");
  }, [brandPosts, activeBrand]);

  const createPost = async (status: Post["status"]) => {
    if (!activeBrand) return;
    const { data, error } = await supabase
      .from("social_posts")
      .insert({ brand_id: activeBrand.id, title: "New post", status })
      .select()
      .single();
    if (error) return toast({ title: "Failed to create", description: error.message, variant: "destructive" });
    setPosts((prev) => [data as Post, ...prev]);
    setPostDialog(data as Post);
  };

  const updatePost = async (id: string, patch: Partial<Post>) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const { error } = await supabase.from("social_posts").update(patch).eq("id", id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
  };

  const deletePost = async (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setPostDialog(null);
    await supabase.from("social_posts").delete().eq("id", id);
  };

  const moveStatus = (p: Post, dir: 1 | -1) => {
    const idx = STATUSES.indexOf(p.status);
    const next = STATUSES[Math.max(0, Math.min(STATUSES.length - 1, idx + dir))];
    if (next === p.status) return;
    const patch: Partial<Post> = { status: next };
    if (next === "posted") patch.posted_at = new Date().toISOString();
    updatePost(p.id, patch);
  };

  const togglePlatform = (p: Post, platform: string) => {
    const cur = p.platform_status?.[platform];
    const next = { ...(p.platform_status || {}), [platform]: cur === "posted" ? "pending" : "posted" };
    updatePost(p.id, { platform_status: next as any });
  };

  const addSource = async () => {
    if (!activeBrand || !newSource.title) return;
    const payload: any = {
      brand_id: activeBrand.id,
      title: newSource.title,
      description: newSource.description ?? "",
      kind: newSource.kind ?? "recurring",
      active: true,
    };
    if (payload.kind === "recurring") {
      payload.cadence = newSource.cadence ?? "weekly";
      payload.day_of_week = newSource.day_of_week ?? 5;
    } else {
      payload.event_date = newSource.event_date ?? null;
    }
    const { data, error } = await supabase.from("social_sources").insert(payload).select().single();
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setSources((prev) => [data as Source, ...prev]);
    setSourceDialogOpen(false);
    setNewSource({ kind: "recurring", cadence: "weekly", day_of_week: 5, active: true });
  };

  const deleteSource = async (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    await supabase.from("social_sources").delete().eq("id", id);
  };

  const generateIdeasFromSource = async (s: Source) => {
    if (!activeBrand) return;
    toast({ title: "Generating ideas…" });
    const { data, error } = await supabase.functions.invoke("social-ai", {
      body: {
        mode: "ideas",
        brandSlug: activeBrand.slug,
        sourceTitle: s.title,
        sourceDescription: s.description,
      },
    });
    if (error) return toast({ title: "AI error", description: error.message, variant: "destructive" });
    const ideas: { title: string; angle: string }[] = data?.ideas ?? [];
    if (!ideas.length) return toast({ title: "No ideas returned" });
    const inserts = ideas.map((i) => ({
      brand_id: activeBrand.id,
      source_id: s.id,
      title: i.title,
      notes: i.angle,
      status: "idea" as const,
    }));
    const { data: created } = await supabase.from("social_posts").insert(inserts).select();
    if (created) setPosts((prev) => [...(created as Post[]), ...prev]);
    toast({ title: `Added ${ideas.length} ideas` });
  };

  const generateCaptions = async (p: Post) => {
    if (!activeBrand) return;
    toast({ title: "Drafting captions…" });
    const { data, error } = await supabase.functions.invoke("social-ai", {
      body: {
        mode: "captions",
        brandSlug: activeBrand.slug,
        postTitle: p.title,
        postNotes: p.notes,
        platforms: activeBrand.platforms,
      },
    });
    if (error) return toast({ title: "AI error", description: error.message, variant: "destructive" });
    const captions = data?.captions ?? {};
    await updatePost(p.id, { captions });
    setPostDialog((cur) => (cur && cur.id === p.id ? { ...cur, captions } : cur));
    toast({ title: "Captions drafted" });
  };

  const copyCaption = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied" });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Loading social manager…</CardTitle></CardHeader>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 font-display tracking-wide-custom">
          <Share2 className="w-5 h-5 text-primary" /> Social Media Manager
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSourceDialogOpen(true)}>
            <Plus className="w-4 h-4" /> Source
          </Button>
          <Button size="sm" onClick={() => createPost("idea")}>
            <Plus className="w-4 h-4" /> Post
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeBrandSlug} onValueChange={setActiveBrandSlug}>
          <TabsList className="grid grid-cols-3 mb-4">
            {brands.map((b) => (
              <TabsTrigger key={b.slug} value={b.slug} className="gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: b.color }}
                />
                {b.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {brands.map((b) => (
            <TabsContent key={b.slug} value={b.slug} className="space-y-4">
              {/* Week schedule (drag & drop) */}
              {b.id === activeBrand?.id && (
                <WeekScheduleCalendar
                  brand={b}
                  sources={brandSources}
                  posts={brandPosts}
                  onOpenPost={(p) => setPostDialog(p as Post)}
                  onSchedulePost={async (postId, iso) => {
                    await updatePost(postId, { scheduled_for: iso, status: "scheduled" });
                  }}
                  onUnschedule={async (postId) => {
                    await updatePost(postId, { scheduled_for: null, status: "drafting" });
                  }}
                  onCreatePostFromSource={async (sourceId, iso) => {
                    if (!activeBrand) return;
                    const src = brandSources.find((s) => s.id === sourceId);
                    if (!src) return;
                    const { data, error } = await supabase
                      .from("social_posts")
                      .insert({
                        brand_id: activeBrand.id,
                        source_id: src.id,
                        title: `${src.title} — ${new Date(iso).toLocaleDateString()}`,
                        notes: src.description,
                        status: "scheduled",
                        scheduled_for: iso,
                      })
                      .select()
                      .single();
                    if (error) {
                      toast({ title: "Failed to schedule", description: error.message, variant: "destructive" });
                      return;
                    }
                    setPosts((prev) => [data as Post, ...prev]);
                    toast({ title: "Scheduled", description: src.title });
                  }}
                />
              )}

              {/* Sources sidebar (top) */}
              <div className="grid md:grid-cols-2 gap-3">
                <SourcesPanel
                  title="Recurring"
                  icon={<Repeat className="w-4 h-4" />}
                  sources={brandSources.filter((s) => s.kind === "recurring")}
                  onGenerate={generateIdeasFromSource}
                  onDelete={deleteSource}
                />
                <SourcesPanel
                  title="One-off"
                  icon={<CalIcon className="w-4 h-4" />}
                  sources={brandSources.filter((s) => s.kind === "oneoff")}
                  onGenerate={generateIdeasFromSource}
                  onDelete={deleteSource}
                />
              </div>

              {/* Consistency alerts */}
              {consistencyGaps.length > 0 && (
                <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
                  <div className="font-semibold mb-1 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Consistency gaps
                  </div>
                  <ul className="space-y-1">
                    {consistencyGaps.map(({ post, missing }) => (
                      <li key={post.id}>
                        <button
                          className="underline-offset-2 hover:underline text-left"
                          onClick={() => setPostDialog(post)}
                        >
                          {post.title}
                        </button>{" "}
                        — missing on {missing.join(", ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Kanban */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {STATUSES.map((status) => {
                  const items = brandPosts.filter((p) => p.status === status);
                  return (
                    <div key={status} className="rounded-lg border bg-muted/30 p-2 min-h-[200px]">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {STATUS_LABEL[status]} <span className="ml-1 opacity-60">{items.length}</span>
                        </h4>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => createPost(status)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {items.map((p) => (
                          <PostCard
                            key={p.id}
                            post={p}
                            brand={b}
                            onOpen={() => setPostDialog(p)}
                            onMove={(dir) => moveStatus(p, dir)}
                            onTogglePlatform={(pl) => togglePlatform(p, pl)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      {/* Post editor dialog */}
      <Dialog open={!!postDialog} onOpenChange={(o) => !o && setPostDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {postDialog && activeBrand && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeBrand.color }} />
                  Edit Post
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  value={postDialog.title}
                  onChange={(e) => setPostDialog({ ...postDialog, title: e.target.value })}
                  onBlur={() => updatePost(postDialog.id, { title: postDialog.title })}
                  placeholder="Post title"
                />
                <Textarea
                  value={postDialog.notes}
                  onChange={(e) => setPostDialog({ ...postDialog, notes: e.target.value })}
                  onBlur={() => updatePost(postDialog.id, { notes: postDialog.notes })}
                  placeholder="Notes / angle / context"
                  rows={3}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    value={postDialog.status}
                    onValueChange={(v) => {
                      const patch: Partial<Post> = { status: v as Post["status"] };
                      if (v === "posted") patch.posted_at = new Date().toISOString();
                      setPostDialog({ ...postDialog, ...patch });
                      updatePost(postDialog.id, patch);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    type="datetime-local"
                    value={postDialog.scheduled_for ? postDialog.scheduled_for.slice(0, 16) : ""}
                    onChange={(e) => {
                      const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                      setPostDialog({ ...postDialog, scheduled_for: v });
                      updatePost(postDialog.id, { scheduled_for: v });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Captions per platform</h4>
                  <Button size="sm" variant="outline" onClick={() => generateCaptions(postDialog)}>
                    <Wand2 className="w-4 h-4" /> AI draft
                  </Button>
                </div>
                <div className="space-y-3">
                  {(activeBrand.platforms || []).map((pl) => {
                    const Icon = PLATFORM_ICON[pl] ?? Share2;
                    const posted = postDialog.platform_status?.[pl] === "posted";
                    return (
                      <div key={pl} className="rounded-md border p-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 text-sm font-medium capitalize">
                            <Icon className="w-4 h-4" /> {pl}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyCaption(postDialog.captions?.[pl] || "")}
                              disabled={!postDialog.captions?.[pl]}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                            <label className="flex items-center gap-1 text-xs cursor-pointer">
                              <Checkbox
                                checked={posted}
                                onCheckedChange={() => togglePlatform(postDialog, pl)}
                              />
                              Posted
                            </label>
                          </div>
                        </div>
                        <Textarea
                          rows={4}
                          value={postDialog.captions?.[pl] || ""}
                          onChange={(e) => {
                            const captions = { ...(postDialog.captions || {}), [pl]: e.target.value };
                            setPostDialog({ ...postDialog, captions });
                          }}
                          onBlur={() =>
                            updatePost(postDialog.id, { captions: postDialog.captions })
                          }
                          placeholder={`Caption for ${pl}…`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <DialogFooter className="justify-between">
                <Button variant="destructive" size="sm" onClick={() => deletePost(postDialog.id)}>
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
                <Button onClick={() => setPostDialog(null)}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New source dialog */}
      <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New source for {activeBrand?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Title (e.g., Friday gig recap)"
              value={newSource.title || ""}
              onChange={(e) => setNewSource({ ...newSource, title: e.target.value })}
            />
            <Textarea
              placeholder="Description / brief"
              rows={3}
              value={newSource.description || ""}
              onChange={(e) => setNewSource({ ...newSource, description: e.target.value })}
            />
            <Select
              value={newSource.kind}
              onValueChange={(v) => setNewSource({ ...newSource, kind: v as "recurring" | "oneoff" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recurring">Recurring</SelectItem>
                <SelectItem value="oneoff">One-off</SelectItem>
              </SelectContent>
            </Select>
            {newSource.kind === "recurring" ? (
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={newSource.cadence ?? "weekly"}
                  onValueChange={(v) => setNewSource({ ...newSource, cadence: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={String(newSource.day_of_week ?? 5)}
                  onValueChange={(v) => setNewSource({ ...newSource, day_of_week: Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <Input
                type="date"
                value={newSource.event_date || ""}
                onChange={(e) => setNewSource({ ...newSource, event_date: e.target.value })}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSourceDialogOpen(false)}>Cancel</Button>
            <Button onClick={addSource}>Add Source</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SourcesPanel({
  title, icon, sources, onGenerate, onDelete,
}: {
  title: string;
  icon: React.ReactNode;
  sources: Source[];
  onGenerate: (s: Source) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border p-3">
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">{icon} {title} sources</h4>
      {sources.length === 0 ? (
        <p className="text-xs text-muted-foreground">No sources yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{s.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {s.kind === "recurring" ? `${s.cadence} · ${DAYS[s.day_of_week ?? 0]}` : s.event_date || "no date"}
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onGenerate(s)} title="Generate ideas">
                <Sparkles className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(s.id)} title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PostCard({
  post, brand, onOpen, onMove, onTogglePlatform,
}: {
  post: Post;
  brand: Brand;
  onOpen: () => void;
  onMove: (dir: 1 | -1) => void;
  onTogglePlatform: (platform: string) => void;
}) {
  return (
    <div className="rounded-md border bg-background p-2 hover:border-primary transition-colors">
      <button onClick={onOpen} className="text-left w-full">
        <div className="flex items-start gap-2">
          <span
            className="w-1 self-stretch rounded-full"
            style={{ backgroundColor: brand.color, minHeight: "1.25rem" }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{post.title}</div>
            {post.notes && <div className="text-xs text-muted-foreground line-clamp-2">{post.notes}</div>}
          </div>
        </div>
      </button>
      <div className="flex items-center justify-between mt-2">
        <div className="flex gap-1">
          {(brand.platforms || []).map((pl) => {
            const Icon = PLATFORM_ICON[pl] ?? Share2;
            const posted = post.platform_status?.[pl] === "posted";
            return (
              <button
                key={pl}
                onClick={() => onTogglePlatform(pl)}
                title={`${pl}: ${posted ? "posted" : "pending"}`}
                className={`p-1 rounded ${posted ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {posted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
        <div className="flex gap-0.5">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onMove(-1)}>
            <ChevronRight className="w-3 h-3 rotate-180" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onMove(1)}>
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>
      {post.scheduled_for && (
        <Badge variant="outline" className="mt-1 text-[10px]">
          {new Date(post.scheduled_for).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
        </Badge>
      )}
    </div>
  );
}
