import { useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Search, ExternalLink, AlertTriangle, Loader2, FolderOpen } from "lucide-react";

// Gig Pack Builder v1 (Josh spec 2026-07-18): setlist in (paste text or import
// a saved setlist) → every matching chart in the library, grouped per song with
// all variations → open/download via signed URLs. Songs with no chart get
// ranked source/purchase links. Phase 2 (specced, Libby's board): export the
// whole pack to a dated Google Drive folder with per-variation sub-folders.

type ChartHit = {
  id: string;
  title: string;
  folder_path: string;
  filename: string;
  storage_path: string | null;
};
type SetlistRow = {
  id: string;
  name: string;
  event_date: string | null;
  song_snapshot: { title?: string; name?: string }[] | null;
};
type SongResult = { song: string; hits: ChartHit[] };

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/ +/g, " ").trim();

// Variation class from the top-level folder — mirrors the library shards.
const variationOf = (fp: string) => {
  const top = fp.split("/")[0];
  if (top === "Bb-charts") return "B♭";
  if (top === "Eb-charts") return "E♭";
  if (top === "horn-charts") return "Horns";
  if (top === "chord-charts") return "Chords";
  if (top === "parts") return "Part";
  if (top === "originals") return "Original";
  return "C";
};

const sourceLinks = (song: string) => {
  const q = encodeURIComponent(song);
  return [
    { label: "Musicnotes", url: `https://www.musicnotes.com/search/go?w=${q}` },
    { label: "SheetMusicPlus", url: `https://www.sheetmusicplus.com/en/search?Ntt=${q}` },
    { label: "FreeHornCharts", url: `https://www.freehorncharts.com/?s=${q}` },
    { label: "Google", url: `https://www.google.com/search?q=${q}+sheet+music+pdf` },
  ];
};

export default function TeamGigPack() {
  const [mode, setMode] = useState<"paste" | "import">("paste");
  const [text, setText] = useState("");
  const [setlists, setSetlists] = useState<SetlistRow[]>([]);
  const [setlistId, setSetlistId] = useState("");
  const [gigDate, setGigDate] = useState(new Date().toISOString().slice(0, 10));
  const [results, setResults] = useState<SongResult[] | null>(null);
  const [resolving, setResolving] = useState(false);
  const [signed, setSigned] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .from("setlists")
      .select("id, name, event_date, song_snapshot")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => data && setSetlists(data as SetlistRow[]));
  }, []);

  const songLines = useMemo(() => {
    if (mode === "import") {
      const sl = setlists.find((s) => s.id === setlistId);
      return (sl?.song_snapshot || [])
        .map((s) => s.title || s.name || "")
        .filter(Boolean);
    }
    return text
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*\d+[.)]?\s*/, "").replace(/^\*/, "").trim())
      .filter((l) => l.length > 1);
  }, [mode, text, setlists, setlistId]);

  const resolve = async () => {
    if (!songLines.length) return;
    setResolving(true);
    const out: SongResult[] = [];
    for (const song of songLines) {
      const terms = norm(song).split(" ").filter(Boolean);
      let q = supabase
        .from("chart_index")
        .select("id, title, folder_path, filename, storage_path")
        .order("folder_path")
        .limit(40);
      for (const t of terms) q = q.ilike("title_search", `%${t}%`);
      const { data } = await q;
      out.push({ song, hits: (data as ChartHit[]) || [] });
    }
    setResults(out);
    // Batch-sign everything found so Open works immediately.
    const paths = out.flatMap((r) => r.hits.map((h) => h.storage_path)).filter(Boolean) as string[];
    if (paths.length) {
      const { data: s } = await supabase.storage.from("charts").createSignedUrls(paths, 3600);
      const map: Record<string, string> = {};
      for (const x of s || []) if (x.path && x.signedUrl) map[x.path] = x.signedUrl;
      setSigned(map);
    }
    setResolving(false);
  };

  const found = results?.filter((r) => r.hits.length) || [];
  const missing = results?.filter((r) => !r.hits.length) || [];

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12">
        <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
          <Package className="w-7 h-7 text-primary" /> Gig Pack
        </h1>
        <p className="text-muted-foreground mt-2 mb-6">
          Setlist in → every chart we have (all variations) + sources for what we don't.
          Drive-folder export is phase 2 — for now every chart opens/saves directly.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Button size="sm" variant={mode === "paste" ? "default" : "outline"} onClick={() => setMode("paste")}>
            Paste text
          </Button>
          <Button size="sm" variant={mode === "import" ? "default" : "outline"} onClick={() => setMode("import")}>
            Import saved setlist
          </Button>
          <span className="text-xs text-muted-foreground ml-2">Gig date</span>
          <input
            type="date"
            value={gigDate}
            onChange={(e) => setGigDate(e.target.value)}
            className="h-8 rounded border border-border bg-card px-2 text-sm"
          />
        </div>

        {mode === "paste" ? (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"One song per line — numbering is fine:\n1. Autumn Leaves\n2. All of Me\n3. Don't Get Around Much Anymore"}
            rows={7}
            className="mb-3 font-mono text-sm"
          />
        ) : (
          <Select value={setlistId} onValueChange={setSetlistId}>
            <SelectTrigger className="mb-3 max-w-md"><SelectValue placeholder="Pick a saved setlist…" /></SelectTrigger>
            <SelectContent>
              {setlists.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}{s.event_date ? ` · ${s.event_date}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button onClick={resolve} disabled={resolving || !songLines.length} className="gap-1.5 mb-8">
          {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Find charts for {songLines.length} song{songLines.length === 1 ? "" : "s"}
        </Button>

        {results && (
          <>
            <div className="text-sm text-muted-foreground mb-4">
              Pack <span className="font-medium text-foreground">{gigDate}</span> · {found.length} of {results.length} songs covered · {found.reduce((a, r) => a + r.hits.length, 0)} charts
            </div>

            {missing.length > 0 && (
              <Card className="border-amber-500/40 bg-amber-500/5 mb-4">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Missing ({missing.length}) — best sources
                  </h3>
                  {missing.map((m) => (
                    <div key={m.song} className="flex items-center gap-2 flex-wrap py-1 text-sm">
                      <span className="font-medium">{m.song}</span>
                      {sourceLinks(m.song).map((l) => (
                        <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-0.5">
                          <ExternalLink className="w-3 h-3" />{l.label}
                        </a>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              {found.map((r) => (
                <Card key={r.song} className="border-border">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <FolderOpen className="w-4 h-4 text-primary" />
                      <span className="font-medium">{r.song}</span>
                      <Badge variant="secondary" className="text-xs">{r.hits.length}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.hits.map((h) => {
                        const url = h.storage_path ? signed[h.storage_path] : null;
                        return url ? (
                          <a key={h.id} href={url} target="_blank" rel="noopener noreferrer"
                            className="text-xs rounded border border-border px-2 py-1 hover:border-primary/50 inline-flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px] px-1">{variationOf(h.folder_path)}</Badge>
                            {h.title}
                          </a>
                        ) : (
                          <span key={h.id} className="text-xs rounded border border-border/50 px-2 py-1 opacity-60">{h.title}</span>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </TeamLayout>
  );
}
