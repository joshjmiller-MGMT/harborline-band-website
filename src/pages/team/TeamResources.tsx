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
                : query
                  ? `${total} match${total === 1 ? "" : "es"} for "${query}"${folderPath ? ` in ${folderPath}` : ""}`
                  : `${total} charts${folderPath ? ` in ${folderPath}` : ""}`}
              {total > PAGE_SIZE && ` — showing first ${PAGE_SIZE}`}
            </div>

            <div className="space-y-2">
              {results.map((r) => {
                const openUrl =
                  (r.storage_path && signedUrls[r.storage_path]) ||
                  r.drive_web_view_link;
                return (
                <Card
                  key={r.id}
                  className="border-border bg-card hover:border-primary/30 transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <a
                        href={openUrl || undefined}
                        target={openUrl ? "_blank" : undefined}
                        rel={openUrl ? "noopener noreferrer" : undefined}
                        aria-disabled={!openUrl}
                        className={
                          openUrl
                            ? "flex-1 min-w-0 hover:opacity-80 transition-opacity cursor-pointer"
                            : "flex-1 min-w-0 pointer-events-none"
                        }
                      >
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <h3 className="font-medium text-foreground truncate">
                            {r.title}
                          </h3>
                          {r.composer && (
                            <span className="text-sm text-muted-foreground truncate">
                              {r.composer}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{r.folder_path}/</span>
                          <span className="opacity-60">·</span>
                          <span className="truncate">{r.filename}</span>
                          {r.reference && (
                            <>
                              <span className="opacity-60">·</span>
                              <span className="truncate">{r.reference}</span>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {r.genre && (
                            <Badge variant="outline" className="text-xs">
                              {r.genre}
                            </Badge>
                          )}
                          {r.key_signature && (
                            <Badge variant="outline" className="text-xs">
                              Key: {r.key_signature}
                            </Badge>
                          )}
                          {r.time_signature && (
                            <Badge variant="outline" className="text-xs">
                              Time: {r.time_signature}
                            </Badge>
                          )}
                          {(r.setlists || []).slice(0, 3).map((s) => (
                            <Badge
                              key={`sl-${s}`}
                              variant="secondary"
                              className="text-xs"
                            >
                              {s}
                            </Badge>
                          ))}
                          {(r.ireal_pro || []).slice(0, 3).map((p) => (
                            <Badge
                              key={`ir-${p}`}
                              variant="secondary"
                              className="text-xs opacity-80"
                            >
                              iReal: {p}
                            </Badge>
                          ))}
                          {(r.tags || [])
                            .filter(
                              (t) =>
                                !t.startsWith("realbook") && t !== "fake-book",
                            )
                            .slice(0, 3)
                            .map((t) => (
                              <Badge
                                key={`tag-${t}`}
                                variant="outline"
                                className="text-xs opacity-70"
                              >
                                {t}
                              </Badge>
                            ))}
                        </div>
                      </a>
                      <div className="flex-shrink-0">
                        {openUrl ? (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={openUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                              Open
                            </a>
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-xs opacity-60">
                            unavailable
                          </Badge>
                        )}
                      </div>
                    </div>
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
