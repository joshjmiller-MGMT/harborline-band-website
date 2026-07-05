import { useCallback, useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { FolderOpen, RefreshCw, Image as ImageIcon, Film, Music, Search, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
};

const VENTURES = ["Harborline", "Economy", "JMJ", "Personal", "BSE", "Brand Studio", "Unknown"];
const TYPES = ["image", "video", "audio", "other"];
const STATUSES = ["new", "keep", "routed", "archive", "junk"];
const PAGE = 200;

const VENTURE_DOT: Record<string, string> = {
  Harborline: "bg-sky-500", Economy: "bg-violet-500", JMJ: "bg-amber-500",
  Personal: "bg-emerald-500", BSE: "bg-rose-500", "Brand Studio": "bg-fuchsia-500",
  Unknown: "bg-muted-foreground",
};
const STATUS_STYLE: Record<string, string> = {
  new: "bg-muted/60 text-muted-foreground",
  keep: "bg-emerald-500/15 text-emerald-400",
  routed: "bg-sky-500/15 text-sky-400",
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
  if (t === "image") return <ImageIcon className="w-4 h-4 text-sky-400" />;
  if (t === "video") return <Film className="w-4 h-4 text-violet-400" />;
  if (t === "audio") return <Music className="w-4 h-4 text-amber-400" />;
  return <FolderOpen className="w-4 h-4 text-muted-foreground" />;
}

export default function TeamMedia() {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ venture: string; n: number; bytes: number }[]>([]);

  const [venture, setVenture] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [qDebounced, setQDebounced] = useState<string>("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(h);
  }, [q]);

  // Reset to first page when filters change.
  useEffect(() => { setPage(0); }, [venture, type, status, qDebounced]);

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
          "id, filename, ext, media_type, venture, venue, description, captured_on, size_bytes, full_path, location_kind, status, status_note",
          { count: "exact" },
        )
        .order("captured_on", { ascending: false, nullsFirst: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (venture) query = query.eq("venture", venture);
      if (type) query = query.eq("media_type", type);
      if (status) query = query.eq("status", status);
      if (qDebounced) query = query.or(`filename.ilike.%${qDebounced}%,description.ilike.%${qDebounced}%`);
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
  }, [venture, type, status, qDebounced, page]);

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
          <Button variant="ghost" size="sm" onClick={() => { void load(); void loadSummary(); }} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

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
                <TypeIcon t={r.media_type} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{r.description || r.filename}</p>
                  <p className="text-[11px] text-muted-foreground truncate flex items-center gap-2">
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
      </div>
    </TeamLayout>
  );
}
