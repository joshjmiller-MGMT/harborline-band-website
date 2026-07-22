import { useCallback, useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { FolderOpen, RefreshCw, Image as ImageIcon, Film, Music, Search, Copy, ChevronDown, Folder, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Digital Asset Manager (slice 1) — catalogue view over public.media_assets.
// Indexes media in place (Dropbox + gdrive mounts) with no byte reads; this is
// the joint Josh+Claude triage surface. Thumbnails + AI tags land in slice 2.

type MediaRow = {
  id: string;
  filename: string;
  ext: string | null;
  media_type: string;
  venture: string | null;
  venue: string | null;
  description: string | null;
  captured_on: string | null;
  size_bytes: number | null;
  full_path: string;
  location_kind: string | null;
  status: string;
  status_note: string | null;
  thumbnail_path: string | null;
  ai_caption: string | null;
  ai_tags: string[] | null;
  suggested_output: string | null;
};

const VENTURES = ["Harborline", "Economy", "JMJ", "Personal", "BSE", "Brand Studio", "Unknown"];
const TYPES = ["image", "video", "audio", "other"];
const STATUSES = ["new", "keep", "routed", "archive", "junk"];
const LANES = ["harborline-epk", "harborline-social", "economy-social", "joshjmiller", "youtube", "knowledge", "archive", "none"];
const PAGE = 200;

const VENTURE_DOT: Record<string, string> = {
  Harborline: "bg-primary", Economy: "bg-accent", JMJ: "bg-amber-500",
  Personal: "bg-emerald-500", BSE: "bg-rose-500", "Brand Studio": "bg-fuchsia-500",
  Unknown: "bg-muted-foreground",
};
const STATUS_STYLE: Record<string, string> = {
  new: "bg-muted/60 text-muted-foreground",
  keep: "bg-emerald-500/15 text-emerald-400",
  routed: "bg-primary/15 text-primary",
  archive: "bg-amber-500/15 text-amber-400",
  junk: "bg-rose-500/15 text-rose-400",
};

function humanSize(n: number | null): string {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

function TypeIcon({ t }: { t: string }) {
  if (t === "image") return <ImageIcon className="w-4 h-4 text-primary" />;
  if (t === "video") return <Film className="w-4 h-4 text-accent" />;
  if (t === "audio") return <Music className="w-4 h-4 text-amber-400" />;
  return <FolderOpen className="w-4 h-4 text-muted-foreground" />;
}

export default function TeamMedia() {
  const [view, setView] = useState<"files" | "folders">("folders");
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ venture: string; n: number; bytes: number }[]>([]);

  const [venture, setVenture] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [lane, setLane] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [qDebounced, setQDebounced] = useState<string>("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(h);
  }, [q]);

  // Reset to first page when filters change.
  useEffect(() => { setPage(0); }, [venture, type, status, lane, qDebounced]);

  const loadSummary = useCallback(async () => {
    // Per-venture rollup for the header. Small table; fetch venture+size and reduce.
    const { data, error } = await supabase
      .from("media_assets")
      .select("venture, size_bytes");
    if (error) return;
    const m = new Map<string, { n: number; bytes: number }>();
    for (const r of (data ?? []) as { venture: string | null; size_bytes: number | null }[]) {
      const k = r.venture || "Unknown";
      const cur = m.get(k) ?? { n: 0, bytes: 0 };
      cur.n += 1; cur.bytes += r.size_bytes ?? 0;
      m.set(k, cur);
    }
    setSummary([...m.entries()].map(([venture, v]) => ({ venture, ...v })).sort((a, b) => b.n - a.n));
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      let query = supabase
        .from("media_assets")
        .select(
          "id, filename, ext, media_type, venture, venue, description, captured_on, size_bytes, full_path, location_kind, status, status_note, thumbnail_path, ai_caption, ai_tags, suggested_output",
          { count: "exact" },
        )
        .order("captured_on", { ascending: false, nullsFirst: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (venture) query = query.eq("venture", venture);
      if (type) query = query.eq("media_type", type);
      if (status) query = query.eq("status", status);
      if (lane) query = query.eq("suggested_output", lane);
      if (qDebounced) {
        // Search name, description, what's IN the picture (AI caption), and
        // exact AI tag (Josh 2026-07-22: "finds it in the title or tags or
        // within the picture content").
        const ors = [
          `filename.ilike.%${qDebounced}%`,
          `description.ilike.%${qDebounced}%`,
          `ai_caption.ilike.%${qDebounced}%`,
        ];
        if (/^[a-z0-9-]+$/i.test(qDebounced)) ors.push(`ai_tags.cs.["${qDebounced.toLowerCase()}"]`);
        query = query.or(ors.join(","));
      }
      const { data, error, count } = await query;
      if (error) throw error;
      setRows((data ?? []) as MediaRow[]);
      setTotalCount(count ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [venture, type, status, lane, qDebounced, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadSummary(); }, [loadSummary]);

  const setRowStatus = useCallback(async (id: string, next: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));
    const { error } = await supabase.from("media_assets").update({ status: next, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Failed to update"); void load(); }
  }, [load]);

  const grandTotal = useMemo(() => summary.reduce((a, s) => a + s.n, 0), [summary]);
  const grandBytes = useMemo(() => summary.reduce((a, s) => a + s.bytes, 0), [summary]);

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
              <FolderOpen className="w-7 h-7 text-primary" /> Media Library
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {grandTotal
                ? `${grandTotal.toLocaleString()} assets · ${humanSize(grandBytes)} indexed in place (no files moved)`
                : "Catalogue of all reachable photo / video / audio"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setView("folders")}
                className={`inline-flex items-center gap-1.5 px-3 h-9 text-sm ${view === "folders" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40"}`}
              >
                <Folder className="w-4 h-4" /> Folders
              </button>
              <button
                onClick={() => setView("files")}
                className={`inline-flex items-center gap-1.5 px-3 h-9 text-sm border-l border-border ${view === "files" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40"}`}
              >
                <Files className="w-4 h-4" /> Files
              </button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { void load(); void loadSummary(); }} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {view === "folders" && <FoldersView />}

        {view === "files" && (<>
        {/* Per-venture rollup */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {summary.map((s) => (
            <button
              key={s.venture}
              onClick={() => setVenture(venture === s.venture ? "" : s.venture)}
              className={`rounded-lg border p-2.5 text-left transition-colors ${
                venture === s.venture ? "border-primary bg-primary/5" : "border-border bg-card/40 hover:bg-muted/30"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${VENTURE_DOT[s.venture] ?? "bg-muted-foreground"}`} />
                <span className="text-sm font-medium text-foreground truncate">{s.venture}</span>
              </span>
              <span className="block text-xs text-muted-foreground mt-1 tabular-nums">
                {s.n.toLocaleString()} · {humanSize(s.bytes)}
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search filename or description…" className="pl-8 h-9" />
          </div>
          <select value={venture} onChange={(e) => setVenture(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
            <option value="">All ventures</option>
            {VENTURES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
            <option value="">All types</option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={lane} onChange={(e) => setLane(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
            <option value="">All lanes</option>
            {LANES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded text-xs bg-destructive/10 text-destructive border border-destructive/30">{error}</div>
        )}

        {/* Results */}
        <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
          <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground flex items-center justify-between">
            <span>{totalCount !== null ? `${totalCount.toLocaleString()} matching` : "…"}</span>
            <span>Triage: mark keep / route / archive / junk</span>
          </div>
          <div className="divide-y divide-border/50">
            {rows.map((r) => (
              <div key={r.id} className="px-3 py-2 flex items-center gap-3 hover:bg-muted/20">
                {r.thumbnail_path ? (
                  <img src={r.thumbnail_path} alt="" loading="lazy" className="w-12 h-12 rounded object-cover bg-muted shrink-0" />
                ) : (
                  <span className="w-12 h-12 rounded bg-muted/40 flex items-center justify-center shrink-0"><TypeIcon t={r.media_type} /></span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{r.ai_caption || r.description || r.filename}</p>
                  {r.ai_tags && r.ai_tags.length > 0 && (
                    <p className="flex items-center gap-1 flex-wrap mt-0.5">
                      {r.suggested_output && r.suggested_output !== "none" && (
                        <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-primary/15 text-primary">{r.suggested_output}</span>
                      )}
                      {r.ai_tags.slice(0, 5).map((t) => (
                        <span key={t} className="text-[10px] px-1 py-0.5 rounded bg-muted/60 text-muted-foreground">{t}</span>
                      ))}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${VENTURE_DOT[r.venture || "Unknown"] ?? "bg-muted-foreground"}`} />
                      {r.venture || "Unknown"}
                    </span>
                    <span>·</span><span>{r.captured_on || "—"}</span>
                    <span>·</span><span>{humanSize(r.size_bytes)}</span>
                    <span>·</span><span className="uppercase">{r.ext}</span>
                    <button
                      className="inline-flex items-center gap-0.5 hover:text-foreground"
                      title={r.full_path}
                      onClick={() => { void navigator.clipboard.writeText(r.full_path); toast.success("Path copied"); }}
                    >
                      <Copy className="w-3 h-3" /> path
                    </button>
                  </p>
                </div>
                <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLE[r.status] ?? STATUS_STYLE.new}`}>
                  {r.status}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {(["keep", "routed", "archive", "junk"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setRowStatus(r.id, s)}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                    >
                      {s === "routed" ? "route" : s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {!loading && rows.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No assets match these filters.</p>
            )}
          </div>
        </div>

        {/* Pager */}
        {totalCount !== null && totalCount > PAGE && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading}>
              Previous
            </Button>
            <span className="text-muted-foreground tabular-nums">
              {page * PAGE + 1}–{Math.min((page + 1) * PAGE, totalCount)} of {totalCount.toLocaleString()}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * PAGE >= totalCount || loading}>
              Next
            </Button>
          </div>
        )}
        </>)}
      </div>
    </TeamLayout>
  );
}

// ── Folders view — the folder-context layer. Each folder is a self-documenting
// unit (mirrors the _FOLDER-CONTEXT.md sidecar) with its class, stats, generated
// context, and the event→edit→schedule pipeline controls.
type FolderRow = {
  id: string;
  folder_path: string;
  name: string;
  source_root: string | null;
  file_count: number;
  image_count: number;
  video_count: number;
  audio_count: number;
  total_bytes: number | null;
  date_min: string | null;
  date_max: string | null;
  top_venture: string | null;
  folder_class: string;
  sphere: string | null;
  event_name: string | null;
  event_date: string | null;
  context_md: string | null;
  status: string;
  editor: string | null;
};

const CLASS_STYLE: Record<string, string> = {
  event: "bg-primary/15 text-primary",
  shoot: "bg-accent/15 text-accent",
  session: "bg-amber-500/15 text-amber-400",
  reference: "bg-fuchsia-500/15 text-fuchsia-400",
  knowledge: "bg-emerald-500/15 text-emerald-400",
  mixed: "bg-muted/60 text-muted-foreground",
  other: "bg-muted/60 text-muted-foreground",
};
const FOLDER_STATUSES = ["catalogued", "organized", "ported", "editing", "scheduled", "done"];

// Folders view v2 (Josh, 2026-07-07): show the SOURCE (Google Drive / Dropbox…)
// and the folder structure all the way down — no auto-splitting by class.
// Classes + media types are FILTERS. event = date-prefixed + gig-like;
// shoot = date-prefixed content (song name etc); untagged stays untagged.
const CLASS_FILTERS = ["event", "shoot", "session", "reference", "knowledge", "mixed", "other"] as const;
const TYPE_FILTERS = [
  { key: "video", label: "Video" },
  { key: "image", label: "Photos" },
  { key: "audio", label: "Audio" },
] as const;

function FolderCard({ f, open, onOpenChange, updateFolder }: {
  f: FolderRow; open: boolean; onOpenChange: (o: boolean) => void;
  updateFolder: (id: string, patch: Partial<FolderRow>) => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <button className="w-full px-3 py-2 flex items-center gap-3 hover:bg-muted/20 text-left">
          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${CLASS_STYLE[f.folder_class] ?? CLASS_STYLE.other}`}>
            {f.folder_class}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-sm text-foreground truncate block">{f.event_name || f.name}</span>
            <span className="text-[11px] text-muted-foreground truncate block">
              <span className="inline-flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${VENTURE_DOT[f.top_venture || "Unknown"] ?? "bg-muted-foreground"}`} />
                {f.top_venture || "Unknown"}
              </span>
              {" · "}{f.file_count} files ({f.video_count}v/{f.image_count}p/{f.audio_count}a) · {humanSize(f.total_bytes)}
              {f.event_date ? ` · ${f.event_date}` : f.date_min ? ` · ${f.date_min}` : ""}
            </span>
          </span>
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground shrink-0">{f.status}</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-sans bg-background/40 rounded p-2.5 border border-border/50 overflow-x-auto">
          {f.context_md || "(no context generated)"}
        </pre>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => { void updateFolder(f.id, { status: "enrich_requested" }); toast.success("Queued for enrichment (thumbnails + AI tags)"); }}
            className="text-[10px] px-1.5 py-0.5 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            title="Generate thumbnails + EXIF + AI captions for this folder on the next enrich run"
          >
            ⚡ enrich media
          </button>
          <span className="text-[11px] text-muted-foreground ml-1">Pipeline:</span>
          {FOLDER_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => updateFolder(f.id, { status: s })}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${f.status === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/60"}`}
            >
              {s}
            </button>
          ))}
          <Input
            defaultValue={f.editor ?? ""}
            onBlur={(e) => { if (e.target.value !== (f.editor ?? "")) void updateFolder(f.id, { editor: e.target.value || null }); }}
            placeholder="editor…"
            className="h-7 w-32 text-xs ml-auto"
          />
          <button
            onClick={() => { void navigator.clipboard.writeText(f.folder_path); toast.success("Path copied"); }}
            className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Copy className="w-3 h-3" /> path
          </button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Rel-path (minus the drive/source prefix) → breadcrumb + depth for the tree.
function relParts(path: string): string[] {
  const p = path.replace(/\\/g, "/").replace(/^C:\/Users\/joshj\/Dropbox\/?/, "").replace(/^[A-Z]:\/?/, "");
  return p.split("/").filter(Boolean);
}

function FoldersView() {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [venture, setVenture] = useState("");
  const [q, setQ] = useState("");
  const [clsFilter, setClsFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  // Sources start COLLAPSED (Josh 2026-07-21) — the page opens as a compact
  // per-source overview; expand what you're digging into.
  const [openSources, setOpenSources] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("media_folders")
      .select("id, folder_path, name, source_root, file_count, image_count, video_count, audio_count, total_bytes, date_min, date_max, top_venture, folder_class, sphere, event_name, event_date, context_md, status, editor")
      .limit(1000);
    if (venture) query = query.eq("top_venture", venture);
    if (q.trim()) {
      const term = q.trim();
      // Folder search covers name + rolled-up context + event (not just name).
      query = query.or(`name.ilike.%${term}%,context_md.ilike.%${term}%,event_name.ilike.%${term}%`);
    }
    const { data } = await query;
    setFolders((data ?? []) as FolderRow[]);
    setLoading(false);
  }, [venture, q]);

  useEffect(() => { const h = setTimeout(() => void load(), 200); return () => clearTimeout(h); }, [load]);

  const updateFolder = useCallback(async (id: string, patch: Partial<FolderRow>) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    const { error } = await supabase.from("media_folders").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Failed to save"); void load(); }
  }, [load]);

  // Filters (class + media type), then group by SOURCE and sort by full path —
  // the folder structure reads all the way down from each source.
  const bySource = useMemo(() => {
    let v = folders;
    if (clsFilter) v = v.filter((f) => (f.folder_class || "other") === clsFilter);
    if (typeFilter === "video") v = v.filter((f) => f.video_count > 0);
    if (typeFilter === "image") v = v.filter((f) => f.image_count > 0);
    if (typeFilter === "audio") v = v.filter((f) => f.audio_count > 0);
    const m = new Map<string, FolderRow[]>();
    for (const f of v) {
      const s = f.source_root || "Other";
      (m.get(s) ?? m.set(s, []).get(s)!).push(f);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.folder_path.localeCompare(b.folder_path));
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [folders, clsFilter, typeFilter]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search folders — name, event, contents…" className="pl-8 h-9" />
        </div>
        <select value={venture} onChange={(e) => setVenture(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2 text-sm">
          <option value="">All ventures</option>
          {VENTURES.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      {/* Filter chips: media type + class. No auto-sections — just filters. */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {TYPE_FILTERS.map((t) => (
          <button key={t.key} onClick={() => setTypeFilter(typeFilter === t.key ? "" : t.key)}
            className={`text-xs px-2 py-1 rounded border ${typeFilter === t.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
            {t.label}
          </button>
        ))}
        <span className="w-px h-4 bg-border mx-1" />
        {CLASS_FILTERS.map((c) => (
          <button key={c} onClick={() => setClsFilter(clsFilter === c ? "" : c)}
            className={`text-xs px-2 py-1 rounded border capitalize ${clsFilter === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
            {c}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground px-1 py-4">Loading…</p>}
      {!loading && bySource.length === 0 && (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground rounded-lg border border-border bg-card/40">No folders match.</p>
      )}

      <div className="space-y-3">
        {bySource.map(([source, items]) => {
          const open = openSources.has(source);
          const bytes = items.reduce((a, f) => a + (f.total_bytes ?? 0), 0);
          return (
            <Collapsible key={source} open={open}
              onOpenChange={() => setOpenSources((prev) => { const n = new Set(prev); n.has(source) ? n.delete(source) : n.add(source); return n; })}
              className="rounded-lg border border-border bg-card/40 overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/30 text-left">
                  <span className="font-display text-lg tracking-wide-custom text-foreground flex items-center gap-2">
                    <Folder className="w-4 h-4 text-primary" /> {source}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                    {items.length} folders · {humanSize(bytes)}
                    <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="divide-y divide-border/40 border-t border-border/60">
                  {items.map((f) => {
                    const parts = relParts(f.folder_path);
                    const depth = Math.min(parts.length - 1, 6);
                    const crumbs = parts.slice(0, -1).join(" / ");
                    return (
                      <div key={f.id} style={{ paddingLeft: `${depth * 14}px` }}>
                        {crumbs && (
                          <p className="text-[10px] text-muted-foreground/60 px-3 pt-1 truncate">{crumbs} /</p>
                        )}
                        <FolderCard f={f} open={openId === f.id} onOpenChange={(o) => setOpenId(o ? f.id : null)} updateFolder={updateFolder} />
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
