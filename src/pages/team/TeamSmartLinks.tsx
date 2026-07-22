import { useEffect, useMemo, useRef, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Plus, Trash2, Copy, ExternalLink, Eye, MousePointerClick, Loader2, Check, X, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PLATFORMS, platformMeta, type SmartLinkRow, type PlatformLink } from "@/lib/smartlink";
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis, CartesianGrid } from "recharts";

// Manager for the personal smart-link tool. Create one shareable /l/:slug per
// release, set a destination URL per DSP, and watch views + clicks roll in.
const db = supabase as unknown as { from: (t: string) => any };

type EventRow = { slug: string; kind: string; platform: string | null; created_at: string; referrer: string | null };

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
  // Auto-source discovery (Josh 2026-07-22): one known link in → every other
  // platform's link out (Odesli via the smartlink-sources edge fn); Josh picks
  // which to add from the checklist.
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState<PlatformLink[] | null>(null);
  const [foundSel, setFoundSel] = useState<Set<string>>(new Set());

  const findSources = async () => {
    if (!editing) return;
    const seed = editing.platforms.find((p) => p.url)?.url;
    if (!seed) {
      toast({ title: "Add one link first", description: "Paste any one platform URL (e.g. Spotify), then I can find the rest.", variant: "destructive" });
      return;
    }
    setFinding(true);
    setFound(null);
    try {
      const { data, error } = await (supabase as unknown as {
        functions: { invoke: (n: string, o: object) => Promise<{ data: unknown; error: { message: string } | null }> };
      }).functions.invoke("smartlink-sources", { body: { url: seed, title: editing.title, artist: editing.artist } });
      if (error) throw new Error(error.message);
      const res = data as { sources?: PlatformLink[]; matched?: { title?: string; artist?: string } };
      const have = new Set(editing.platforms.map((p) => p.platform));
      const fresh = (res.sources ?? []).filter((s) => !have.has(s.platform));
      setFound(fresh);
      setFoundSel(new Set(fresh.map((f) => f.platform)));
      toast({
        title: fresh.length ? `Found ${fresh.length} new source${fresh.length > 1 ? "s" : ""}` : "No new sources yet",
        description: res.matched?.title
          ? `Matched: ${res.matched.title} — ${res.matched.artist ?? ""}${fresh.length ? "" : " · DSPs still propagating; try again tomorrow"}`
          : undefined,
      });
    } catch (e) {
      toast({ title: "Source lookup failed", description: e instanceof Error ? e.message : "unknown", variant: "destructive" });
    } finally {
      setFinding(false);
    }
  };

  const addFound = () => {
    if (!editing || !found) return;
    const picked = found.filter((f) => foundSel.has(f.platform));
    setEditing({ ...editing, platforms: [...editing.platforms, ...picked] });
    setFound(null);
  };

  // ---- Artwork: upload / pick from Media Library (Josh 2026-07-22) ----
  const [uploadingArt, setUploadingArt] = useState(false);
  const artFileRef = useRef<HTMLInputElement | null>(null);
  const [artSearchOpen, setArtSearchOpen] = useState(false);
  const [artQuery, setArtQuery] = useState("");
  const [artResults, setArtResults] = useState<{ id: string; filename: string; thumbnail_path: string; ai_caption: string | null }[]>([]);

  const uploadArtwork = async (file: File) => {
    if (!editing) return;
    setUploadingArt(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `smartlink/${slugify(editing.slug || editing.title || "art")}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("visual-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("visual-assets").getPublicUrl(path);
      setEditing((prev) => (prev ? { ...prev, artwork_url: data.publicUrl } : prev));
      toast({ title: "Artwork uploaded" });
    } catch (e) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "unknown", variant: "destructive" });
    } finally {
      setUploadingArt(false);
    }
  };

  // Debounced library search: filename + description + AI caption (what's IN
  // the picture) + exact AI tag. Only thumbnail-backed rows are pickable —
  // they're the ones with a web-servable image.
  useEffect(() => {
    if (!artSearchOpen) return;
    const q = artQuery.trim();
    if (q.length < 2) { setArtResults([]); return; }
    const h = setTimeout(async () => {
      let query = db.from("media_assets")
        .select("id, filename, thumbnail_path, ai_caption")
        .eq("media_type", "image")
        .not("thumbnail_path", "is", null)
        .limit(18);
      const ors = [`filename.ilike.%${q}%`, `description.ilike.%${q}%`, `ai_caption.ilike.%${q}%`];
      if (/^[a-z0-9-]+$/i.test(q)) ors.push(`ai_tags.cs.["${q.toLowerCase()}"]`);
      query = query.or(ors.join(","));
      const { data } = await query;
      setArtResults((data as typeof artResults) || []);
    }, 300);
    return () => clearTimeout(h);
  }, [artQuery, artSearchOpen]);

  const load = async () => {
    const [l, e] = await Promise.all([
      db.from("smart_links").select("*").order("created_at", { ascending: false }),
      db.from("smart_link_events").select("slug,kind,platform,created_at,referrer"),
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

  // Full analytics (Josh 2026-07-22, Artist-Hub parity): per-link expandable
  // panel — stat tiles, 30-day time graph, platform clickthroughs, referrers.
  // Series colors are palette-validated for CVD on the dark surface
  // (views #3987e5 / clicks #d95926) — data encoding, not brand decoration.
  const [analyticsSlug, setAnalyticsSlug] = useState<string | null>(null);

  const seriesFor = (slug: string) => {
    const days: { day: string; views: number; clicks: number }[] = [];
    const idx = new Map<string, number>();
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      idx.set(key, days.length);
      days.push({ day: `${d.getMonth() + 1}/${d.getDate()}`, views: 0, clicks: 0 });
    }
    for (const e of events) {
      if (e.slug !== slug) continue;
      const key = (e.created_at || "").slice(0, 10);
      const i = idx.get(key);
      if (i === undefined) continue;
      if (e.kind === "view") days[i].views++; else days[i].clicks++;
    }
    return days;
  };

  const referrersFor = (slug: string) => {
    const m = new Map<string, number>();
    for (const e of events) {
      if (e.slug !== slug || e.kind !== "view") continue;
      let host = "direct / none";
      try { if (e.referrer) host = new URL(e.referrer).hostname.replace(/^www\./, ""); } catch { /* keep */ }
      m.set(host, (m.get(host) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  };

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
                <Input type="date" value={editing.release_date || ""} onChange={(ev) => setEditing({ ...editing, release_date: ev.target.value })} />
              </div>

              {/* Artwork: upload a file, pick from the Media Library (search by
                  name, tags, or what's IN the picture via AI captions), or
                  paste a URL. Josh 2026-07-22. */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Artwork</span>
                  <div className="flex items-center gap-1.5">
                    <input ref={artFileRef} type="file" accept="image/*" className="hidden"
                      onChange={(ev) => { const f = ev.target.files?.[0]; if (f) void uploadArtwork(f); ev.target.value = ""; }} />
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => artFileRef.current?.click()} disabled={uploadingArt}>
                      {uploadingArt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Upload
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => setArtSearchOpen((v) => !v)}>
                      <Sparkles className="w-3 h-3" /> From library
                    </Button>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  {editing.artwork_url ? (
                    <img src={editing.artwork_url} alt="artwork" className="w-20 h-20 rounded-md object-cover border border-border shrink-0" />
                  ) : (
                    <div className="w-20 h-20 rounded-md border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground shrink-0">no art</div>
                  )}
                  <div className="flex-1 space-y-2 min-w-0">
                    <Input placeholder="…or paste an image URL" value={editing.artwork_url || ""} onChange={(ev) => setEditing({ ...editing, artwork_url: ev.target.value })} />
                    {artSearchOpen && (
                      <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
                        <Input autoFocus placeholder="Search the library — name, tags, or what's in the picture…"
                          value={artQuery} onChange={(ev) => setArtQuery(ev.target.value)} />
                        {artResults.length > 0 && (
                          <div className="mt-2 grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {artResults.map((a) => (
                              <button key={a.id} type="button" title={a.ai_caption ?? a.filename}
                                onClick={() => { setEditing((prev) => prev ? { ...prev, artwork_url: a.thumbnail_path } : prev); setArtSearchOpen(false); }}
                                className="aspect-square rounded-md overflow-hidden border border-border hover:ring-2 hover:ring-primary transition">
                                <img src={a.thumbnail_path} alt={a.filename} className="w-full h-full object-cover" loading="lazy" />
                              </button>
                            ))}
                          </div>
                        )}
                        {artQuery.trim().length > 1 && artResults.length === 0 && (
                          <p className="mt-2 text-xs text-muted-foreground">Nothing enriched matches — only library items with thumbnails are pickable (2,258 and growing nightly).</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platforms</span>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={findSources} disabled={finding}>
                      {finding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Find sources
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addPlat}>
                      <Plus className="w-3 h-3" /> Add platform
                    </Button>
                  </div>
                </div>
                {found && found.length > 0 && (
                  <div className="mb-2 rounded-md border border-primary/30 bg-primary/5 p-2 space-y-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Found — pick what to add</p>
                    {found.map((f) => (
                      <label key={f.platform} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={foundSel.has(f.platform)}
                          onChange={() => setFoundSel((prev) => { const n = new Set(prev); n.has(f.platform) ? n.delete(f.platform) : n.add(f.platform); return n; })}
                        />
                        <span className="font-medium">{platformMeta(f.platform).label}</span>
                        <span className="text-xs text-muted-foreground truncate">{f.url}</span>
                      </label>
                    ))}
                    <div className="pt-1">
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={addFound} disabled={foundSel.size === 0}>
                        <Check className="w-3 h-3" /> Add selected ({foundSel.size})
                      </Button>
                    </div>
                  </div>
                )}
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
                        {analyticsSlug === r.slug && (() => {
                          const days = seriesFor(r.slug);
                          const totalViews = s?.views ?? 0;
                          const totalClicks = s?.clicks ?? 0;
                          const ctr = totalViews ? Math.round((totalClicks / totalViews) * 1000) / 10 : 0;
                          const refs = referrersFor(r.slug);
                          const maxPlat = Math.max(1, ...Object.values(s?.byPlatform ?? {}));
                          return (
                            <div className="mt-3 rounded-lg border border-border bg-background/40 p-3 space-y-4">
                              {/* Stat tiles */}
                              <div className="grid grid-cols-3 gap-2 max-w-sm">
                                {[["Views", totalViews], ["Clicks", totalClicks], ["CTR", `${ctr}%`]].map(([label, val]) => (
                                  <div key={String(label)} className="rounded-md border border-border bg-card/60 px-3 py-2">
                                    <div className="text-xl font-semibold tabular-nums text-foreground">{val}</div>
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                                  </div>
                                ))}
                              </div>
                              {/* 30-day engagement — views (area) + clicks (line), one axis */}
                              <div>
                                <div className="flex items-center gap-3 mb-1 text-[11px] text-muted-foreground">
                                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#3987e5" }} /> Views</span>
                                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#d95926" }} /> Clicks</span>
                                  <span className="ml-auto">last 30 days</span>
                                </div>
                                <div className="h-44">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={days} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                                      <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.35} vertical={false} />
                                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={4} />
                                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                                      <ChartTooltip
                                        cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3" }}
                                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                                        labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                                      />
                                      <Area type="monotone" dataKey="views" stroke="#3987e5" strokeWidth={2} fill="#3987e5" fillOpacity={0.18} dot={false} />
                                      <Line type="monotone" dataKey="clicks" stroke="#d95926" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                    </ComposedChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                              {/* Destination clickthroughs */}
                              {s && Object.keys(s.byPlatform).length > 0 && (
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Destination clicks</p>
                                  <div className="space-y-1">
                                    {Object.entries(s.byPlatform).sort((a, b) => b[1] - a[1]).map(([plat, n]) => (
                                      <div key={plat} className="flex items-center gap-2 text-xs">
                                        <span className="w-24 shrink-0 text-foreground">{platformMeta(plat).label}</span>
                                        <div className="flex-1 h-3 rounded-sm bg-muted/40 overflow-hidden">
                                          <div className="h-full rounded-sm" style={{ width: `${(n / maxPlat) * 100}%`, background: "hsl(var(--primary))" }} />
                                        </div>
                                        <span className="w-8 text-right tabular-nums text-muted-foreground">{n}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Top sources */}
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Top sources</p>
                                {refs.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">No referrer data yet.</p>
                                ) : (
                                  <div className="space-y-0.5">
                                    {refs.map(([host, n]) => (
                                      <div key={host} className="flex items-center justify-between text-xs">
                                        <span className="text-foreground">{host}</span>
                                        <span className="tabular-nums text-muted-foreground">{n}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant={analyticsSlug === r.slug ? "default" : "outline"} className="h-8 text-xs gap-1"
                          onClick={() => setAnalyticsSlug(analyticsSlug === r.slug ? null : r.slug)}>
                          <Eye className="w-3.5 h-3.5" /> Analytics
                        </Button>
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
