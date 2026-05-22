import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import TeamLayout from "@/components/TeamLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Loader2,
  Music,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ListMusic,
  FolderPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type ChartCandidate = {
  id: string;
  title: string;
  composer: string | null;
  folder_path: string;
  filename: string;
  reference: string | null;
};

type MatchedLine = {
  input: string;
  match_type: "exact" | "fuzzy";
  candidates: ChartCandidate[];
};

type BuildResult = {
  build_id: string;
  gig_slug: string;
  created_at: string;
  matched: MatchedLine[];
  unmatched: string[];
  stats: {
    total_lines: number;
    matched: number;
    unmatched: number;
    total_charts: number;
  };
};

type PrefillState = {
  eventName?: string;
  eventDate?: string;
  venue?: string;
  rawInput?: string;
};

export default function TeamSetlistBuilder() {
  const location = useLocation();
  const prefill = (location.state ?? {}) as PrefillState;
  const [eventName, setEventName] = useState(prefill.eventName ?? "");
  const [eventDate, setEventDate] = useState(prefill.eventDate ?? "");
  const [venue, setVenue] = useState(prefill.venue ?? "");
  const [rawInput, setRawInput] = useState(prefill.rawInput ?? "");
  const [building, setBuilding] = useState(false);
  const [result, setResult] = useState<BuildResult | null>(null);

  useEffect(() => {
    if (prefill.rawInput) {
      window.history.replaceState({}, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBuild() {
    if (!eventName.trim() || !rawInput.trim()) {
      toast({
        title: "Missing required fields",
        description: "Event name + at least one song line.",
        variant: "destructive",
      });
      return;
    }
    setBuilding(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "setlist-resolve",
        {
          body: {
            action: "create",
            raw_input: rawInput,
            event_name: eventName.trim(),
            event_date: eventDate || null,
            venue: venue.trim() || null,
          },
        },
      );
      if (error) {
        let detail = error.message;
        try {
          const body = await error.context?.json?.();
          if (body?.error) detail = `${body.error}: ${body.reason ?? ""}`;
        } catch (_e) {
          /* fall through */
        }
        throw new Error(detail);
      }
      if (!data?.build_id) {
        throw new Error("No build_id returned from setlist-resolve");
      }
      setResult(data as BuildResult);
      toast({
        title: "Manifest built",
        description: `${data.stats.matched}/${data.stats.total_lines} matched · gig slug \`${data.gig_slug}\``,
      });
    } catch (err) {
      toast({
        title: "Build failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setBuilding(false);
    }
  }

  function copyShellCmd() {
    if (!result) return;
    const cmd = `python3 scripts/phase7_stage_setlist.py --from-manifest ${result.build_id}`;
    navigator.clipboard.writeText(cmd);
    toast({ title: "Copied", description: "Paste in chart-library/ shell." });
  }

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-display tracking-wide-custom flex items-center gap-3">
            <ListMusic className="w-8 h-8 text-primary" />
            Setlist Builder
          </h1>
          <p className="text-muted-foreground mt-2">
            Turn a raw song list into a gig folder under
            <code className="mx-1 text-xs bg-muted px-1.5 py-0.5 rounded">
              ~/Dropbox/forScore-import/
            </code>
            with all matched charts + a merged{" "}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
              setlist.pdf
            </code>
            .
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Event details</CardTitle>
            <CardDescription>
              Gig folder is named{" "}
              <code>&lt;date&gt;-&lt;event&gt;-&lt;venue&gt;</code>; date and
              venue are optional but help with chronological sort.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="event-name">Event name *</Label>
                <Input
                  id="event-name"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Buster + Lila wedding"
                />
              </div>
              <div>
                <Label htmlFor="event-date">Date</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              <div className="sm:col-span-3">
                <Label htmlFor="venue">Venue</Label>
                <Input
                  id="venue"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Cylburn Arboretum"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="raw-input">Song list (one per line) *</Label>
              <Textarea
                id="raw-input"
                rows={12}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder={`Body and Soul\nAll The Things You Are\nAutumn Leaves\nGiant Steps\n...`}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Numbering (<code>1. Foo</code>, <code>- Foo</code>) is stripped
                automatically. Each line resolves to the best chart match in{" "}
                <code>chart_index</code> (
                {/* prettier-ignore */}4,449 rows).
              </p>
            </div>

            <Button
              onClick={handleBuild}
              disabled={building || !eventName.trim() || !rawInput.trim()}
              size="lg"
              className="w-full sm:w-auto"
            >
              {building ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resolving…
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Generate manifest
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <>
            <Card className="mb-6 border-primary/40">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Manifest ready
                </CardTitle>
                <CardDescription>
                  Gig slug{" "}
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {result.gig_slug}
                  </code>{" "}
                  · {result.stats.matched}/{result.stats.total_lines} lines
                  matched · {result.stats.total_charts} chart files queued
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/40 rounded-lg p-4 border">
                  <p className="text-sm font-medium mb-2">
                    Materialize on your Mac:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-background px-3 py-2 rounded border font-mono break-all">
                      cd ~/Documents/Claude/Projects/Harborline\ Website/chart-library
                      && python3 scripts/phase7_stage_setlist.py --from-manifest{" "}
                      {result.build_id}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyShellCmd}
                      title="Copy --from-manifest command"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    The script reads this manifest from Supabase, copies each
                    chart from <code>chart-library/output/</code> →{" "}
                    <code>~/Dropbox/forScore-import/{result.gig_slug}/</code>,
                    concatenates them into <code>setlist.pdf</code>, and marks
                    this build materialized. Second run with the same slug
                    suffixes <code>-v2</code>.
                  </p>
                </div>

                {result.unmatched.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
                    <p className="text-sm font-medium mb-2 flex items-center gap-2 text-amber-900 dark:text-amber-200">
                      <AlertTriangle className="w-4 h-4" />
                      {result.unmatched.length} unmatched{" "}
                      {result.unmatched.length === 1 ? "song" : "songs"}
                    </p>
                    <ul className="text-sm space-y-1 list-disc list-inside text-amber-900 dark:text-amber-200">
                      {result.unmatched.map((u, i) => (
                        <li key={i}>
                          <code className="text-xs">{u}</code>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs mt-2 text-amber-800/80 dark:text-amber-300/80">
                      These are skipped in the gig folder. Edit the song list
                      above (try the canonical title) and re-run if you want
                      them included.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Music className="w-5 h-5" />
                  Matched charts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.matched.map((line, i) => (
                    <div
                      key={i}
                      className="border rounded-lg p-3 text-sm bg-card"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{line.input}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            line.match_type === "exact"
                              ? "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200"
                              : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200"
                          }`}
                        >
                          {line.match_type}
                          {line.candidates.length > 1
                            ? ` · ${line.candidates.length} versions`
                            : ""}
                        </span>
                      </div>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {line.candidates.map((c) => (
                          <li key={c.id} className="font-mono">
                            <span className="text-foreground">{c.title}</span>
                            {c.composer ? ` — ${c.composer}` : ""} ·{" "}
                            <span className="opacity-70">
                              {c.folder_path}/{c.filename}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </TeamLayout>
  );
}
