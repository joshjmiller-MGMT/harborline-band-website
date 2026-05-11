import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Search, Link2, ClipboardPaste, Download, FileText, ExternalLink,
  Sparkles, AlertCircle, CheckCircle2,
} from "lucide-react";

type Mode = "paste" | "search" | "url";
type Organization = "harborline" | "bse" | "tsb";
type OutputType = "auto" | "X" | "X-prime" | "Z";

type DriveFile = {
  id: string;
  name: string;
  mime_type: string;
  modified_time: string;
  owners: string[];
  web_view_link: string;
  size: number | null;
};

type IngestResponse = {
  id: string;
  route: string;
  merged: boolean;
  sourceFile: {
    source_type: string;
    detected_shape: string | null;
    extracted_excerpt: string;
    drive_id?: string;
    url?: string;
    is_blank_starter: boolean;
  };
  extractor_version: string;
  shape: string;
  confidence: number | null;
  is_blank_starter: boolean;
  llm_ran: boolean;
  llm_skipped_reason: string | null;
  warnings: string[];
  fields_extracted: number;
};

type CanonicalEventRow = {
  id: string;
  event_date: string;
  name: string;
  organization: string | null;
  event_type: string | null;
  venue: any;
  client: any;
  personnel: any[] | null;
  timeline: any[] | null;
  song_sections: any[] | null;
  vendors: any[] | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const ORG_LABELS: Record<Organization, string> = {
  harborline: "Harborline",
  bse: "Baltimore Sound Entertainment (BSE)",
  tsb: "Tom Starr Band (TSB)",
};

const OUTPUT_LABELS: Record<OutputType, string> = {
  auto: "Auto-select",
  X: "X — BSE Musicians",
  "X-prime": "X′ — Harborline / TSB Musicians",
  Z: "Z — DJ-facing",
};

function extractDriveIdFromUrl(url: string): string | null {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function fmtBytes(b: number | null): string {
  if (!b) return "";
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / 1024 / 1024).toFixed(1)}MB`;
}

function fmtMime(m: string): string {
  if (m.includes("spreadsheet")) return "Sheet";
  if (m.includes("document")) return "Doc";
  if (m.includes("folder")) return "Folder";
  if (m.includes("pdf")) return "PDF";
  return m.split(".").pop() || m;
}

function describeShape(shape: string): string {
  return ({ A: "Shape A — TSB Narrative", B: "Shape B — DJ Q&A", C: "Shape C — Ceremony", D: "Shape D — Harborline Spreadsheet", W: "Shape W — Wild (LLM-extracted)" } as Record<string, string>)[shape] || shape;
}

export default function RunOfShowGenerator() {
  const [mode, setMode] = useState<Mode>("search");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [organization, setOrganization] = useState<Organization>("harborline");

  const [pasteText, setPasteText] = useState("");
  const [driveUrl, setDriveUrl] = useState("");

  const [searchResults, setSearchResults] = useState<DriveFile[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResponse | null>(null);
  const [canonicalRow, setCanonicalRow] = useState<CanonicalEventRow | null>(null);

  const [rendering, setRendering] = useState<OutputType | null>(null);

  const reset = () => {
    setIngestResult(null);
    setCanonicalRow(null);
    setSearchResults(null);
  };

  const validateNameDate = (): boolean => {
    if (!eventName.trim()) {
      toast({ title: "Event name required", variant: "destructive" });
      return false;
    }
    if (!eventDate.trim()) {
      toast({ title: "Event date required", variant: "destructive" });
      return false;
    }
    return true;
  };

  const loadCanonicalRow = async (id: string) => {
    const { data, error } = await supabase
      .from("canonical_events")
      .select("id, event_date, name, organization, event_type, venue, client, personnel, timeline, song_sections, vendors")
      .eq("id", id)
      .single();
    if (error) {
      toast({ title: "Couldn't load canonical event", description: error.message, variant: "destructive" });
      return;
    }
    setCanonicalRow(data as CanonicalEventRow);
  };

  const callIngest = async (body: Record<string, unknown>) => {
    setIngesting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ingest-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Ingest failed",
          description: data?.error || data?.message || `HTTP ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      setIngestResult(data);
      await loadCanonicalRow(data.id);
      toast({
        title: data.merged ? "Merged into existing event" : "Event ingested",
        description: `${data.fields_extracted} fields · ${describeShape(data.shape)}`,
      });
    } catch (err) {
      toast({ title: "Network error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIngesting(false);
    }
  };

  const handlePaste = () => {
    if (!validateNameDate()) return;
    if (!pasteText.trim()) {
      toast({ title: "Paste some text first", variant: "destructive" });
      return;
    }
    callIngest({
      route: "paste",
      name: eventName,
      eventDate,
      organization,
      payload: { text: pasteText },
    });
  };

  const handleSearch = async () => {
    if (!validateNameDate()) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/drive-search-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({ name: eventName, date: eventDate }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 412) {
        toast({ title: "Drive search failed", description: data?.message || data?.error || `HTTP ${res.status}`, variant: "destructive" });
        return;
      }
      if (data.error === "drive_scope_not_granted") {
        toast({ title: "Drive scope not granted", description: "Re-consent at /team/dashboard Google panel.", variant: "destructive" });
        return;
      }
      if (data.error === "drive_api_not_enabled") {
        toast({
          title: "Drive API not enabled",
          description: "Click Enable in the Cloud Console, then retry.",
          variant: "destructive",
        });
        return;
      }
      const files = (data.files || []) as DriveFile[];
      setSearchResults(files);

      // Auto-confirm rule: exactly 1 file → ingest immediately.
      if (files.length === 1) {
        toast({ title: "1 match — auto-selecting", description: files[0].name });
        await selectDriveFile(files[0]);
      } else if (files.length === 0) {
        toast({ title: "No Drive matches", description: "Try Paste or Drive URL mode instead." });
      } else if (files.length >= 5) {
        toast({ title: `${files.length} matches`, description: "Narrow your search or pick from the list." });
      }
    } catch (err) {
      toast({ title: "Network error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const selectDriveFile = async (file: DriveFile) => {
    callIngest({
      route: "drive-url",
      name: eventName,
      eventDate,
      organization,
      payload: {
        driveId: file.id,
        mimeType: file.mime_type,
        url: file.web_view_link,
        fileName: file.name,
      },
    });
  };

  const handleUrl = () => {
    if (!validateNameDate()) return;
    const id = extractDriveIdFromUrl(driveUrl);
    if (!id) {
      toast({ title: "Couldn't extract Drive file ID", description: "Paste a Google Drive URL like https://docs.google.com/spreadsheets/d/{ID}/edit", variant: "destructive" });
      return;
    }
    callIngest({
      route: "drive-url",
      name: eventName,
      eventDate,
      organization,
      payload: { driveId: id, url: driveUrl },
    });
  };

  const handleRender = async (output: OutputType) => {
    if (!ingestResult) return;
    setRendering(output);
    try {
      const body: Record<string, unknown> = {
        canonical_event_id: ingestResult.id,
      };
      if (output !== "auto") body.output_type = output;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/render-canonical-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Render failed", description: data?.error || `HTTP ${res.status}`, variant: "destructive" });
        return;
      }

      // Trigger download
      const blob = new Blob([data.html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.filename || "run-of-show"}.html`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: `Rendered ${data.output_type}${data.auto_selected ? " (auto)" : ""}`,
        description: data.filename,
      });
    } catch (err) {
      toast({ title: "Network error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setRendering(null);
    }
  };

  const eventFieldsSection = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <div>
        <Label htmlFor="event-name">Event name</Label>
        <Input
          id="event-name"
          placeholder="e.g. Hoffman Wedding"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="event-date">Event date</Label>
        <Input
          id="event-date"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="org">Organization</Label>
        <Select value={organization} onValueChange={(v) => setOrganization(v as Organization)}>
          <SelectTrigger id="org"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(ORG_LABELS) as Organization[]).map((k) => (
              <SelectItem key={k} value={k}>{ORG_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Doc Generator</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ingest an event from a paste, a Drive search, or a Drive URL. The canonical event lands in <code className="text-xs">canonical_events</code>; render to any output (X / X′ / Z).
        </p>
      </div>

      {!ingestResult && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">1. Pick your input</CardTitle>
          </CardHeader>
          <CardContent>
            {eventFieldsSection}

            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="mb-4">
                <TabsTrigger value="search" className="gap-1.5">
                  <Search className="w-3.5 h-3.5" /> Drive search
                </TabsTrigger>
                <TabsTrigger value="url" className="gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Drive URL
                </TabsTrigger>
                <TabsTrigger value="paste" className="gap-1.5">
                  <ClipboardPaste className="w-3.5 h-3.5" /> Paste
                </TabsTrigger>
              </TabsList>

              <TabsContent value="search" className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Search Drive by name + date. We try 13 date variants × name variants. Auto-confirm on 1 match; pick from list otherwise.
                </p>
                <Button onClick={handleSearch} disabled={searching || ingesting}>
                  {searching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  Search Drive
                </Button>

                {searchResults && searchResults.length === 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium">No Drive matches for "{eventName}" on {eventDate}.</p>
                      <p className="text-muted-foreground mt-1">Try the Drive URL tab if you know the file, or paste raw text.</p>
                    </div>
                  </div>
                )}

                {searchResults && searchResults.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {searchResults.length} match{searchResults.length === 1 ? "" : "es"}. Click a row to ingest.
                    </p>
                    {searchResults.map((f) => (
                      <div key={f.id} className="flex items-start justify-between p-3 gap-2 rounded-md border border-border bg-card/40">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate">{f.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {fmtMime(f.mime_type)}
                            </span>
                            {f.size != null && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                · {fmtBytes(f.size)}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            Modified {new Date(f.modified_time).toLocaleDateString()} · Owner {f.owners[0] || "—"}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <a href={f.web_view_link} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-8 px-2 rounded-md hover:bg-accent" title="Open in Drive">
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          </a>
                          <Button
                            size="sm"
                            onClick={() => selectDriveFile(f)}
                            disabled={ingesting || f.mime_type.includes("folder")}
                            title={f.mime_type.includes("folder") ? "Folders can't be ingested directly" : "Ingest this file"}
                          >
                            {ingesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Ingest"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="url" className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Paste a Google Drive URL. Docs and Sheets fetch directly; other formats need pre-fetched text via Paste mode.
                </p>
                <div>
                  <Label htmlFor="drive-url">Drive URL</Label>
                  <Input
                    id="drive-url"
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                  />
                </div>
                <Button onClick={handleUrl} disabled={ingesting || !driveUrl.trim()}>
                  {ingesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                  Ingest from URL
                </Button>
              </TabsContent>

              <TabsContent value="paste" className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Paste the doc body. For PDFs/DOCX, copy text from the file and paste here.
                </p>
                <Textarea
                  placeholder="Paste event details, ROS, planner answers, etc..."
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  className="min-h-[240px] font-mono text-xs"
                />
                <Button onClick={handlePaste} disabled={ingesting || !pasteText.trim()}>
                  {ingesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ClipboardPaste className="w-4 h-4 mr-2" />}
                  Ingest paste
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {ingestResult && canonicalRow && (
        <CanonicalEventResult
          ingestResult={ingestResult}
          canonicalRow={canonicalRow}
          onRender={handleRender}
          rendering={rendering}
          onReset={() => {
            reset();
          }}
        />
      )}
    </div>
  );
}

function CanonicalEventResult({
  ingestResult,
  canonicalRow,
  onRender,
  rendering,
  onReset,
}: {
  ingestResult: IngestResponse;
  canonicalRow: CanonicalEventRow;
  onRender: (output: OutputType) => void;
  rendering: OutputType | null;
  onReset: () => void;
}) {
  const personnelCount = canonicalRow.personnel?.length ?? 0;
  const timelineCount = canonicalRow.timeline?.length ?? 0;
  const songCount = (canonicalRow.song_sections || []).reduce((a, s: any) => a + (s.songs?.length || 0), 0);
  const sectionCount = canonicalRow.song_sections?.length ?? 0;
  const vendorCount = canonicalRow.vendors?.length ?? 0;

  const venue = canonicalRow.venue || {};
  const client = canonicalRow.client || {};

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                {canonicalRow.name}
              </CardTitle>
              <CardDescription>
                {canonicalRow.event_date} · {describeShape(ingestResult.shape)} · {ingestResult.fields_extracted} fields
                {ingestResult.merged && <span className="ml-1 text-amber-600">· merged into existing event</span>}
                {ingestResult.llm_ran && <span className="ml-1 text-blue-600">· LLM enriched</span>}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onReset}>
              Start over
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <FieldStat label="Venue" value={venue.name || "—"} />
            <FieldStat label="Client" value={[client.primary, client.secondary].filter(Boolean).join(" & ") || "—"} />
            <FieldStat label="Org" value={canonicalRow.organization || "—"} />
            <FieldStat label="Type" value={canonicalRow.event_type || "—"} />
            <FieldStat label="Personnel" value={String(personnelCount)} />
            <FieldStat label="Timeline" value={`${timelineCount} entries`} />
            <FieldStat label="Songs" value={`${songCount} in ${sectionCount} section${sectionCount === 1 ? "" : "s"}`} />
            <FieldStat label="Vendors" value={String(vendorCount)} />
          </div>

          {ingestResult.warnings.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Parser warnings:</p>
                <ul className="text-xs mt-1 space-y-0.5">
                  {ingestResult.warnings.map((w, i) => <li key={i}>· {w}</li>)}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">2. Render output</CardTitle>
          <CardDescription>
            Auto picks the right template from organization + content. Click a specific template to override.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(Object.keys(OUTPUT_LABELS) as OutputType[]).map((out) => (
              <Button
                key={out}
                variant={out === "auto" ? "default" : "outline"}
                onClick={() => onRender(out)}
                disabled={rendering !== null}
                className="h-auto py-3 px-3 flex flex-col items-start text-left whitespace-normal"
              >
                <div className="flex items-center gap-1.5 w-full">
                  {rendering === out ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                   out === "auto" ? <Sparkles className="w-3.5 h-3.5" /> :
                   <Download className="w-3.5 h-3.5" />}
                  <span className="text-sm font-medium">{OUTPUT_LABELS[out].split(" — ")[0]}</span>
                </div>
                <span className="text-xs text-muted-foreground mt-1 font-normal">
                  {OUTPUT_LABELS[out].split(" — ")[1] || "Best template for this event"}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function FieldStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm font-medium truncate" title={value}>{value}</div>
    </div>
  );
}
