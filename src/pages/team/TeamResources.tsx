import { useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ExternalLink,
  FolderOpen,
  Music,
  FileText,
  ChevronRight,
  Loader2,
  Eye,
  X,
  Layers,
} from "lucide-react";

type ChartRow = {
  id: string;
  title: string;
  composer: string | null;
  genre: string | null;
  folder_path: string;
  filename: string;
  reference: string | null;
  drive_web_view_link: string | null;
  storage_path: string | null;
  setlists: string[] | null;
  ireal_pro: string[] | null;
  tags: string[] | null;
  key_signature: string | null;
  time_signature: string | null;
};

type FolderCount = { folder_top: string; total: number };

// One song, with all its book/edition versions folded together.
type SongGroup = {
  key: string;
  title: string;
  composer: string | null;
  genre: string | null;
  versions: ChartRow[];
};

const TOP_FOLDERS = [
  { slug: "fake-books", label: "Fake Books", icon: Music },
  { slug: "Bb-charts", label: "B♭ Charts", icon: Music },
  { slug: "Eb-charts", label: "E♭ Charts", icon: Music },
  { slug: "single-charts", label: "Single Charts", icon: FileText },
  { slug: "chord-charts", label: "Chord Charts", icon: FileText },
  { slug: "originals", label: "Originals", icon: Music },
  { slug: "parts", label: "Parts", icon: FileText },
  { slug: "setlists", label: "Setlists", icon: FolderOpen },
];

// Transposition editions, derived from the top-level folder server-side.
const EDITIONS = [
  { value: "C", label: "Concert (C)" },
  { value: "Bb", label: "B♭" },
  { value: "Eb", label: "E♭" },
] as const;
type Edition = (typeof EDITIONS)[number]["value"];

const CHARTS_BUCKET = "charts";
const SIGNED_URL_TTL = 3600; // 1 hour

const PAGE_SIZE = 50;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Titles carry a "[BookCode]" suffix (e.g. "Autumn Leaves [RB6]", and sometimes
// a trailing composer like "Autumn Leaves [CCB] - Johnny Mercer"). The song name
// always comes FIRST, so we key on the text before the first "[" — that folds
// every book version + any composer annotation into ONE "Autumn Leaves" group.
// Titles with no book tag (some originals) group on their whole name.
function cleanSongTitle(title: string): string {
  let t = (title || "").replace(/\.pdf$/i, "");
  const br = t.indexOf("[");
  if (br >= 0) t = t.slice(0, br); // drop the [BookCode] and anything after it
  return t
    .replace(/\s*\(\d+\)\s*$/, "") // trailing " (2)" dup marker
    .replace(/\s+/g, " ")
    .trim();
}

// Short label that distinguishes one version from another inside a song group:
// prefer the [BookCode] tag, then the reference, then the leaf folder.
function versionLabel(r: ChartRow): string {
  const m = (r.title || "").match(/\[([^\]]+)\]/);
  if (m) return m[1];
  if (r.reference) return r.reference;
  const parts = (r.folder_path || "").split("/").filter(Boolean);
  return parts[parts.length - 1] || "version";
}

// Fold a flat result list into one entry per song, preserving result order.
function groupBySong(rows: ChartRow[]): SongGroup[] {
  const map = new Map<string, SongGroup>();
  for (const r of rows) {
    const clean = cleanSongTitle(r.title) || r.title || r.filename;
    const key = clean.toLowerCase();
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        title: clean,
        composer: r.composer,
        genre: r.genre,
        versions: [],
      };
      map.set(key, g);
    }
    g.versions.push(r);
    if (!g.composer && r.composer) g.composer = r.composer;
    if (!g.genre && r.genre) g.genre = r.genre;
  }
  return Array.from(map.values());
}

export default function TeamResources() {
  const [rawQuery, setRawQuery] = useState("");
  const query = useDebounced(rawQuery, 200);

  const [topFolder, setTopFolder] = useState<string | null>(null);
  const [subFolder, setSubFolder] = useState<string | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [edition, setEdition] = useState<Edition | null>(null);

  const [results, setResults] = useState<ChartRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [folderCounts, setFolderCounts] = useState<FolderCount[]>([]);
  const [subFolderOptions, setSubFolderOptions] = useState<
    { sub: string; count: number }[]
  >([]);
  const [genres, setGenres] = useState<string[]>([]);
  // storage_path -> signed URL, populated after each result page loads.
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  // Which song groups are expanded, and which individual versions are previewed.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [previews, setPreviews] = useState<Set<string>>(new Set());

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  const togglePreview = (id: string) =>
    setPreviews((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const folderPath = useMemo(() => {
    if (subFolder && topFolder) return `${topFolder}/${subFolder}`;
    if (topFolder) return topFolder;
    return "";
  }, [topFolder, subFolder]);

  useEffect(() => {
    (async () => {
      const counts: FolderCount[] = [];
      for (const top of TOP_FOLDERS) {
        const { count } = await supabase
          .from("chart_index")
          .select("id", { count: "exact", head: true })
          .like("folder_path", `${top.slug}%`);
        counts.push({ folder_top: top.slug, total: count || 0 });
      }
      setFolderCounts(counts);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("chart_index_genres");
      if (error) return;
      setGenres(
        ((data as { genre: string }[] | null) || [])
          .map((r) => r.genre)
          .filter(Boolean),
      );
    })();
  }, []);

  useEffect(() => {
    if (!topFolder) {
      setSubFolderOptions([]);
      setSubFolder(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("chart_index")
        .select("folder_path")
        .like("folder_path", `${topFolder}/%`);
      const subCounts = new Map<string, number>();
      for (const row of data || []) {
        const fp = (row as { folder_path: string }).folder_path;
        const rest = fp.slice(topFolder.length + 1);
        const sub = rest.split("/")[0];
        if (!sub) continue;
        subCounts.set(sub, (subCounts.get(sub) || 0) + 1);
      }
      const opts = Array.from(subCounts.entries())
        .map(([sub, count]) => ({ sub, count }))
        .sort((a, b) => a.sub.localeCompare(b.sub));
      setSubFolderOptions(opts);
    })();
  }, [topFolder]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.functions.invoke("chart-search", {
          body: {
            query: query || undefined,
            folder_path: folderPath || undefined,
            genre: genre || undefined,
            edition: edition || undefined,
            limit: PAGE_SIZE,
            offset: 0,
          },
        });
        if (cancelled) return;
        if (error) throw error;
        const payload = data as {
          results: ChartRow[];
          total: number;
        };
        const rows = payload.results || [];
        setResults(rows);
        setTotal(payload.total || 0);

        // Batch-sign the storage objects for this page (copyright-gated bucket).
        const paths = rows
          .map((r) => r.storage_path)
          .filter((p): p is string => !!p);
        if (paths.length) {
          const { data: signed } = await supabase.storage
            .from(CHARTS_BUCKET)
            .createSignedUrls(paths, SIGNED_URL_TTL);
          if (!cancelled && signed) {
            setSignedUrls((prev) => {
              const next = { ...prev };
              for (const s of signed) {
                if (s.path && s.signedUrl) next[s.path] = s.signedUrl;
              }
              return next;
            });
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, folderPath, genre, edition]);

  const isEmptyLibrary =
    folderCounts.length > 0 && folderCounts.every((f) => f.total === 0);

  // Collapse the flat result page into one row per song.
  const groups = useMemo(() => groupBySong(results), [results]);

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl tracking-wide-custom text-foreground">
            Resources
          </h1>
          <p className="text-muted-foreground mt-2">
            Sheet music library — fake books (concert, B♭, E♭), single charts,
            originals, parts, setlists. Team-only, served from secure storage.
          </p>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder='Search title, composer, book, setlist, iReal Pro playlist… (try "coltrane" or "wedding")'
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {loading && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button
            variant={topFolder === null ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTopFolder(null);
              setSubFolder(null);
            }}
          >
            All
            <span className="ml-2 text-xs opacity-70">
              {folderCounts.reduce((acc, f) => acc + f.total, 0)}
            </span>
          </Button>
          {TOP_FOLDERS.map((tf) => {
            const count =
              folderCounts.find((c) => c.folder_top === tf.slug)?.total || 0;
            const Icon = tf.icon;
            return (
              <Button
                key={tf.slug}
                variant={topFolder === tf.slug ? "default" : "outline"}
                size="sm"
                disabled={count === 0}
                onClick={() => {
                  setTopFolder(tf.slug);
                  setSubFolder(null);
                }}
              >
                <Icon className="w-3.5 h-3.5 mr-1.5" />
                {tf.label}
                <span className="ml-2 text-xs opacity-70">{count}</span>
              </Button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-medium text-muted-foreground mr-1">
            Edition
          </span>
          <Button
            variant={edition === null ? "default" : "outline"}
            size="sm"
            onClick={() => setEdition(null)}
          >
            All
          </Button>
          {EDITIONS.map((ed) => (
            <Button
              key={ed.value}
              variant={edition === ed.value ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setEdition(edition === ed.value ? null : ed.value)
              }
            >
              {ed.label}
            </Button>
          ))}

          {genres.length > 0 && (
            <>
              <span className="text-xs font-medium text-muted-foreground ml-3 mr-1">
                Genre
              </span>
              <Button
                variant={genre === null ? "default" : "outline"}
                size="sm"
                onClick={() => setGenre(null)}
              >
                All
              </Button>
              {genres.map((g) => (
                <Button
                  key={g}
                  variant={genre === g ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGenre(genre === g ? null : g)}
                >
                  {g}
                </Button>
              ))}
            </>
          )}
        </div>

        {topFolder && subFolderOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6 pl-1 border-l-2 border-primary/30">
            <ChevronRight className="w-4 h-4 text-muted-foreground ml-2" />
            <Button
              variant={subFolder === null ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSubFolder(null)}
            >
              All
            </Button>
            {subFolderOptions.map((opt) => (
              <Button
                key={opt.sub}
                variant={subFolder === opt.sub ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSubFolder(opt.sub)}
              >
                {opt.sub.replace(/-/g, " ")}
                <span className="ml-2 text-xs opacity-70">{opt.count}</span>
              </Button>
            ))}
          </div>
        )}

        {error && (
          <Card className="mb-4 border-destructive/40 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {isEmptyLibrary && !error && (
          <Card className="border-border bg-card">
            <CardContent className="p-8 text-center">
              <FolderOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-medium text-foreground mb-1">
                Library not yet populated
              </h3>
              <p className="text-sm text-muted-foreground">
                Run{" "}
                <code className="px-1.5 py-0.5 rounded bg-muted text-xs">
                  scripts/chart-library-drive-sync.mjs
                </code>{" "}
                to push chart-library/output/ to Drive and populate the index.
              </p>
            </CardContent>
          </Card>
        )}

        {!isEmptyLibrary && !error && (
          <>
            <div className="text-xs text-muted-foreground mb-3">
              {loading
                ? "Searching…"
                : `${groups.length} song${groups.length === 1 ? "" : "s"} · ${total} chart${total === 1 ? "" : "s"}${query ? ` for "${query}"` : ""}${folderPath ? ` in ${folderPath}` : ""}`}
              {total > PAGE_SIZE &&
                ` — showing first ${PAGE_SIZE} charts, grouped`}
            </div>

            <div className="space-y-2">
              {groups.map((g) => {
                const multi = g.versions.length > 1;
                const isOpen = expanded.has(g.key);
                const only = g.versions[0];
                const onlyUrl =
                  (only.storage_path && signedUrls[only.storage_path]) ||
                  only.drive_web_view_link;
                const openPreviews = g.versions.filter(
                  (v) =>
                    previews.has(v.id) &&
                    ((v.storage_path && signedUrls[v.storage_path]) ||
                      v.drive_web_view_link),
                );
                return (
                  <Card
                    key={g.key}
                    className="border-border bg-card hover:border-primary/30 transition-colors"
                  >
                    <CardContent className="p-4">
                      {/* Header: one row per song */}
                      <div className="flex items-start justify-between gap-4">
                        <button
                          type="button"
                          onClick={
                            multi ? () => toggleExpanded(g.key) : undefined
                          }
                          className={`flex-1 min-w-0 text-left ${multi ? "cursor-pointer" : "cursor-default"}`}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            {multi && (
                              <ChevronRight
                                className={`w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
                              />
                            )}
                            <h3 className="font-medium text-foreground">
                              {g.title}
                            </h3>
                            {g.composer && (
                              <span className="text-sm text-muted-foreground truncate">
                                {g.composer}
                              </span>
                            )}
                            {multi && (
                              <Badge
                                variant="secondary"
                                className="text-xs gap-1"
                              >
                                <Layers className="w-3 h-3" />
                                {g.versions.length} versions
                              </Badge>
                            )}
                          </div>
                          {!multi && (
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="truncate">
                                {only.folder_path}/
                              </span>
                              <span className="opacity-60">·</span>
                              <span className="truncate">{only.filename}</span>
                              {only.reference && (
                                <>
                                  <span className="opacity-60">·</span>
                                  <span className="truncate">
                                    {only.reference}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {g.genre && (
                              <Badge variant="outline" className="text-xs">
                                {g.genre}
                              </Badge>
                            )}
                            {!multi && only.key_signature && (
                              <Badge variant="outline" className="text-xs">
                                Key: {only.key_signature}
                              </Badge>
                            )}
                            {!multi &&
                              (only.setlists || []).slice(0, 3).map((s) => (
                                <Badge
                                  key={`sl-${s}`}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {s}
                                </Badge>
                              ))}
                            {multi &&
                              g.versions.slice(0, 6).map((v) => (
                                <Badge
                                  key={`vl-${v.id}`}
                                  variant="outline"
                                  className="text-xs opacity-70"
                                >
                                  {versionLabel(v)}
                                </Badge>
                              ))}
                          </div>
                        </button>
                        <div className="flex-shrink-0">
                          {multi ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleExpanded(g.key)}
                            >
                              <Layers className="w-3.5 h-3.5 mr-1.5" />
                              {isOpen ? "Hide" : "Versions"}
                            </Button>
                          ) : onlyUrl ? (
                            <Button variant="outline" size="sm" asChild>
                              <a
                                href={onlyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                Open
                              </a>
                            </Button>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs opacity-60"
                            >
                              unavailable
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Expanded: the versions + inline compare */}
                      {multi && isOpen && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="space-y-1.5">
                            {g.versions.map((v) => {
                              const url =
                                (v.storage_path && signedUrls[v.storage_path]) ||
                                v.drive_web_view_link;
                              const on = previews.has(v.id);
                              return (
                                <div
                                  key={v.id}
                                  className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge
                                        variant="outline"
                                        className="text-xs font-medium"
                                      >
                                        {versionLabel(v)}
                                      </Badge>
                                      {v.key_signature && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          Key: {v.key_signature}
                                        </Badge>
                                      )}
                                      {v.reference && (
                                        <span className="text-xs text-muted-foreground truncate">
                                          {v.reference}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                      {v.folder_path}/{v.filename}
                                    </div>
                                  </div>
                                  <div className="flex-shrink-0 flex items-center gap-1.5">
                                    {url && (
                                      <Button
                                        variant={on ? "secondary" : "ghost"}
                                        size="sm"
                                        onClick={() => togglePreview(v.id)}
                                      >
                                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                                        {on ? "Hide" : "Preview"}
                                      </Button>
                                    )}
                                    {url ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                      >
                                        <a
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                                          Open
                                        </a>
                                      </Button>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="text-xs opacity-60"
                                      >
                                        unavailable
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Side-by-side previews of whichever versions are toggled on */}
                          {openPreviews.length > 0 && (
                            <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                              {openPreviews.map((v) => {
                                const url =
                                  (v.storage_path &&
                                    signedUrls[v.storage_path]) ||
                                  v.drive_web_view_link!;
                                return (
                                  <div
                                    key={`pv-${v.id}`}
                                    className="rounded border border-border overflow-hidden"
                                  >
                                    <div className="flex items-center justify-between px-2 py-1 bg-muted/40 text-xs">
                                      <span className="font-medium truncate">
                                        {versionLabel(v)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => togglePreview(v.id)}
                                        className="text-muted-foreground hover:text-foreground"
                                        aria-label="Close preview"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <iframe
                                      src={url}
                                      title={`${g.title} — ${versionLabel(v)}`}
                                      className="w-full h-[520px] bg-white"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-2">
                            Tip: preview two versions to compare them side by
                            side.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {!loading && results.length === 0 && (
              <Card className="border-border bg-card">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No matches.
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </TeamLayout>
  );
}
