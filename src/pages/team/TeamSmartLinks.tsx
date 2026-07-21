import { useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Plus, Trash2, Copy, ExternalLink, Eye, MousePointerClick, Loader2, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PLATFORMS, platformMeta, type SmartLinkRow, type PlatformLink } from "@/lib/smartlink";

// Manager for the personal smart-link tool. Create one shareable /l/:slug per
// release, set a destination URL per DSP, and watch views + clicks roll in.
const db = supabase as unknown as { from: (t: string) => any };

type EventRow = { slug: string; kind: string; platform: string | null };

const blank = (): SmartLinkRow => ({
  slug: "",
  title: "",
  artist: "Joshua J Miller",
  subtitle: "Out now",
  artwork_url: "",
  release_date: "",
  platforms: [],
  is_active: true,
});

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function TeamSmartLinks() {
  const [rows, setRows] = useState<SmartLinkRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SmartLinkRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [l, e] = await Promise.all([
      db.from("smart_links").select("*").order("created_at", { ascending: false }),
      db.from("smart_link_events").select("slug,kind,platform"),
    ]);
    setRows((l.data as SmartLinkRow[]) || []);
    setEvents((e.data as EventRow[]) || []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const m: Record<string, { views: number; clicks: number; byPlatform: Record<string, number> }> = {};
    for (const e of events) {
      const c = (m[e.slug] ??= { views: 0, clicks: 0, byPlatform: {} });
      if (e.kind === "view") c.views++;
      else {
        c.clicks++;
        if (e.platform) c.byPlatform[e.platform] = (c.byPlatform[e.platform] || 0) + 1;
      }
    }
    return m;
  }, [events]);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://harborlineband.com";

  const copyUrl = (slug: string) => {
    navigator.clipboard?.writeText(`${origin}/l/${slug}`);
    toast({ title: "Link copied", description: `${origin}/l/${slug}` });
  };

  const toggleActive = async (r: SmartLinkRow) => {
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_active: !x.is_active } : x)));
    await db.from("smart_links").update({ is_active: !r.is_active }).eq("id", r.id);
  };

  const remove = async (r: SmartLinkRow) => {
    if (!confirm(`Delete "${r.title}"? This can't be undone.`)) return;
    await db.from("smart_links").delete().eq("id", r.id);
    load();
  };

  const save = async () => {
    if (!editing) return;
    const e = editing;
    if (!e.slug || !e.title) {
      toast({ title: "Slug and title are required", variant: "destructive" });
      return;
    }
    const clean = e.platforms.filter((p) => p.platform && p.url);
    const payload = {
      slug: slugify(e.slug),
      title: e.title,
      artist: e.artist || "Joshua J Miller",
      subtitle: e.subtitle || null,
      artwork_url: e.artwork_url || null,
      release_date: e.release_date || null,
      platforms: clean,
      is_active: e.is_active,
    };
    setSaving(true);
    const res = e.id
      ? await db.from("smart_links").update(payload).eq("id", e.id)
      : await db.from("smart_links").insert(payload);
    setSaving(false);
    if (res.error) {
      toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
      return;
    }
    setEditing(null);
    load();
    toast({ title: e.id ? "Saved" : "Link created", description: `${origin}/l/${slugify(e.slug)}` });
  };

  // --- platform-row helpers for the editor ---
  const setPlat = (i: number, patch: Partial<PlatformLink>) =>
    setEditing((prev) =>
      prev ? { ...prev, platforms: prev.platforms.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) } : prev,
    );
  const addPlat = () =>
    setEditing((prev) => (prev ? { ...prev, platforms: [...prev.platforms, { platform: "spotify", url: "" }] } : prev));
  const delPlat = (i: number) =>
    setEditing((prev) => (prev ? { ...prev, platforms: prev.platforms.filter((_, idx) => idx !== i) } : prev));

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
              <Link2 className="w-7 h-7 text-primary" /> Smart Links
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Your own Artist Hub. One <span className="font-mono text-xs">/l/slug</span> per release — deep-links to
              every DSP, with click tracking. Promote the one link everywhere.
            </p>
          </div>
          <Button onClick={() => setEditing(blank())} className="gap-1.5">
            <Plus className="w-4 h-4" /> New link
          </Button>
        </div>

        {/* Editor */}
        {editing && (
          <Card className="mb-6 border-primary/30">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input
                  placeholder="Title (e.g. Blue House Sessions)"
                  value={editing.title}
                  onChange={(ev) =>
                    setEditing({
                      ...editing,
                      title: ev.target.value,
                      slug: editing.slug || slugify(ev.target.value),
                    })
                  }
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0">/l/</span>
                  <Input placeholder="slug" value={editing.slug} onChange={(ev) => setEditing({ ...editing, slug: ev.target.value })} />
                </div>
                <Input placeholder="Artist" value={editing.artist} onChange={(ev) => setEditing({ ...editing, artist: ev.target.value })} />
                <Input placeholder='Badge (e.g. "Out now", "Pre-save")' value={editing.subtitle || ""} onChange={(ev) => setEditing({ ...editing, subtitle: ev.target.value })} />
                <Input placeholder="Artwork image URL" value={editing.artwork_url || ""} onChange={(ev) => setEditing({ ...editing, artwork_url: ev.target.value })} />
                <Input type="date" value={editing.release_date || ""} onChange={(ev) => setEditing({ ...editing, release_date: ev.target.value })} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platforms</span>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addPlat}>
                    <Plus className="w-3 h-3" /> Add platform
                  </Button>
                </div>
                <div className="space-y-2">
                  {editing.platforms.length === 0 && (
                    <p className="text-xs text-muted-foreground">Add the DSP links a fan should see (Spotify, Apple Music, …).</p>
                  )}
                  {editing.platforms.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Select value={p.platform} onValueChange={(v) => setPlat(i, { platform: v })}>
                        <SelectTrigger className="w-[150px] h-9 shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map((pf) => <SelectItem key={pf.key} value={pf.key}>{pf.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input placeholder="Destination URL (canonical https link)" value={p.url} onChange={(ev) => setPlat(i, { url: ev.target.value })} />
                      <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => delPlat(i)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button onClick={save} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
                </Button>
                <Button variant="ghost" onClick={() => setEditing(null)} className="gap-1.5">
                  <X className="w-4 h-4" /> Cancel
                </Button>
                {editing.slug && (
                  <a href={`/l/${slugify(editing.slug)}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground ml-auto flex items-center gap-1">
                    Preview <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* List */}
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No smart links yet. Create one for your release.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const s = r.id ? stats[r.slug] : undefined;
              return (
                <Card key={r.id} className={`border-border ${!r.is_active ? "opacity-60" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{r.title}</span>
                          {r.subtitle && <Badge variant="outline" className="text-[10px]">{r.subtitle}</Badge>}
                          {!r.is_active && <Badge variant="outline" className="text-[10px] text-muted-foreground">hidden</Badge>}
                        </div>
                        <button onClick={() => copyUrl(r.slug)} className="mt-1 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-mono">
                          {origin.replace(/^https?:\/\//, "")}/l/{r.slug} <Copy className="w-3 h-3" />
                        </button>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {s?.views ?? 0} views</span>
                          <span className="flex items-center gap-1"><MousePointerClick className="w-3.5 h-3.5" /> {s?.clicks ?? 0} clicks</span>
                          <span>{r.platforms?.length ?? 0} platforms</span>
                        </div>
                        {s && Object.keys(s.byPlatform).length > 0 && (
                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            {Object.entries(s.byPlatform).sort((a, b) => b[1] - a[1]).map(([plat, n]) => (
                              <span key={plat} className="text-[10px] px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: platformMeta(plat).color }}>
                                {platformMeta(plat).label} {n}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a href={`/l/${r.slug}`} target="_blank" rel="noreferrer">
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Open"><ExternalLink className="w-4 h-4" /></Button>
                        </a>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditing({ ...r, platforms: r.platforms || [], subtitle: r.subtitle || "", artwork_url: r.artwork_url || "", release_date: r.release_date || "" })}>Edit</Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => toggleActive(r)}>{r.is_active ? "Hide" : "Show"}</Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(r)} title="Delete"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </TeamLayout>
  );
}
