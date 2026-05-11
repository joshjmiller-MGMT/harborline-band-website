import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleDriveUpload } from "@/hooks/useGoogleDriveUpload";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Search, Link2, ClipboardPaste, Download, FileText, ExternalLink,
  Sparkles, AlertCircle, CheckCircle2, Eye, Printer, Upload, AlertTriangle,
  CircleCheck, Pencil, Save, X as XIcon, FilePlus2, PartyPopper,
} from "lucide-react";

type Mode = "search" | "url" | "paste" | "manual";
type Organization = "harborline" | "bse" | "tsb";
type OutputType = "auto" | "X" | "X-prime" | "Z" | "C-client";
type ConcreteOutput = Exclude<OutputType, "auto">;

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

type PersonnelEntry = { role: string; name: string; phone?: string; email?: string };
type VendorEntry = { company: string; type?: string; contact?: string; ig_handle?: string };
type TimelineEntry = { time: string; description: string; location?: string; notes?: string };
type SongEntry = { order?: string; title?: string; artist?: string; key?: string; bpm?: string; singer?: string; patches?: string; notes?: string };
type SongSection = { title: string; time?: string; vibe?: string; tempo_arc?: string; songs: SongEntry[] };

type CanonicalEventRow = {
  id: string;
  event_date: string;
  name: string;
  organization: string | null;
  event_type: string | null;
  attire: string | null;
  venue: { name?: string; address?: string; type?: "indoor" | "outdoor" | "both" } | null;
  client: { primary?: string; secondary?: string; titles?: string[] } | null;
  contact: { phone?: string; email?: string } | null;
  guests: { count?: number; arrival_time?: string; party_arrival_time?: string } | null;
  logistics: {
    load_in?: string; soundcheck?: string; setup_time?: string; parking?: string;
    green_room?: string; entrance?: string; meals?: string; audio_reinforcement?: string;
  } | null;
  personnel: PersonnelEntry[] | null;
  timeline: TimelineEntry[] | null;
  song_sections: SongSection[] | null;
  vendors: VendorEntry[] | null;
  preferences: { line_dances?: Record<string, "yes" | "no" | "maybe">; must_play?: string[]; do_not_play?: string[]; style_notes?: string } | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const ORG_LABELS: Record<Organization, string> = {
  harborline: "Harborline",
  bse: "Baltimore Sound Entertainment (BSE)",
  tsb: "Tom Starr Band (TSB)",
};

const OUTPUT_META: Record<OutputType, { label: string; short: string; audience: "internal" | "client" | "auto" }> = {
  auto:        { label: "Auto-select",                  short: "Best fit",                audience: "auto" },
  "X-prime":   { label: "X′ — Harborline / TSB Musicians", short: "Musicians, party / reception", audience: "internal" },
  X:          { label: "X — BSE Musicians",            short: "Musicians, BSE",          audience: "internal" },
  Z:          { label: "Z — DJ-facing",                 short: "DJ pre-flight",           audience: "internal" },
  "C-client": { label: "C-client — Client planner",     short: "Send to the client",      audience: "client" },
};

function describeShape(shape: string): string {
  return ({ A: "Shape A — TSB Narrative", B: "Shape B — DJ Q&A", C: "Shape C — Ceremony", D: "Shape D — Harborline Spreadsheet", W: "Shape W — Wild (LLM-extracted)" } as Record<string, string>)[shape] || shape;
}

function extractDriveIdFromUrl(url: string): string | null {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function isLikelyDriveUrl(url: string): boolean {
  return /drive\.google\.com|docs\.google\.com/.test(url);
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

// Required-fields per renderer. Each entry: a label + a predicate over the canonical row.
type FieldCheck = { label: string; ok: (e: CanonicalEventRow) => boolean };

const COMMON_FIELDS: FieldCheck[] = [
  { label: "Event name",  ok: (e) => !!e.name?.trim() },
  { label: "Event date",  ok: (e) => !!e.event_date },
  { label: "Venue",       ok: (e) => !!e.venue?.name },
  { label: "Organization", ok: (e) => !!e.organization },
];

const REQUIRED_BY_RENDERER: Record<ConcreteOutput, FieldCheck[]> = {
  "X-prime": [
    ...COMMON_FIELDS,
    { label: "Personnel (≥1)", ok: (e) => (e.personnel || []).length > 0 },
    { label: "Timeline (≥1)",  ok: (e) => (e.timeline || []).length > 0 },
  ],
  "X": [
    ...COMMON_FIELDS,
    { label: "Personnel (≥1)", ok: (e) => (e.personnel || []).length > 0 },
    { label: "Timeline (≥1)",  ok: (e) => (e.timeline || []).length > 0 },
  ],
  "Z": [
    ...COMMON_FIELDS,
    { label: "Line dances",    ok: (e) => !!e.preferences?.line_dances && Object.keys(e.preferences.line_dances).length > 0 },
  ],
  "C-client": [
    ...COMMON_FIELDS,
    { label: "Client name",    ok: (e) => !!e.client?.primary },
  ],
};

function pickAutoSelectedRenderer(e: CanonicalEventRow): ConcreteOutput {
  const type = (e.event_type || "").toLowerCase();
  const org = (e.organization || "").toLowerCase();
  if (type.includes("client-planner")) return "C-client";
  if (org === "harborline" || org === "tsb") return "X-prime";
  if (type.includes("country-club") || type.includes("corporate")) return "X-prime";
  const hasLineDances = !!(e.preferences?.line_dances && Object.keys(e.preferences.line_dances).length > 0);
  if (hasLineDances) return "Z";
  return "X";
}

function buildWrappedHtml(html: string, title: string, mode: "preview" | "print"): string {
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  const originalStyles = styleMatch ? styleMatch[1] : "";
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;

  return `<!DOCTYPE html><html lang="en"><head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      ${originalStyles}
      html, body { margin: 0; padding: 0; background: #1a1a1a; min-height: 100vh; }
      .page-shell { max-width: 780px; margin: 40px auto; background: white; box-shadow: 0 4px 40px rgba(0,0,0,0.5); border-radius: 4px; overflow: hidden; padding: 0; }
      @media print { html, body { background: white; } .page-shell { margin: 0; box-shadow: none; border-radius: 0; max-width: none; } }
    </style>
    ${mode === "print" ? `<script>
      window.addEventListener("load", () => {
        const runPrint = () => { window.focus(); window.print(); };
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => setTimeout(runPrint, 150));
        } else {
          setTimeout(runPrint, 300);
        }
      });
    <\/script>` : ""}
  </head><body><div class="page-shell">${bodyContent}</div></body></html>`;
}

function writePreviewWindow(win: Window, html: string) {
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function writeLoadingPreview(win: Window, mode: "preview" | "print") {
  writePreviewWindow(
    win,
    `<!DOCTYPE html><html lang="en"><head>
      <meta charset="UTF-8"><title>Preparing ${mode === "print" ? "print view" : "preview"}…</title>
      <style>
        html, body { margin: 0; min-height: 100%; font-family: system-ui, sans-serif; background: #111827; color: white; }
        body { display: grid; place-items: center; padding: 24px; }
        .shell { text-align: center; max-width: 420px; }
        .spinner { width: 32px; height: 32px; margin: 0 auto 16px; border: 3px solid rgba(255,255,255,0.2); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    </head><body>
      <div class="shell">
        <div class="spinner"></div>
        <h1 style="margin:0 0 10px;font-size:20px;font-weight:600;">Preparing ${mode === "print" ? "print view" : "preview"}…</h1>
        <div style="color:rgba(255,255,255,0.72);font-size:14px;line-height:1.5;">This tab was opened early so Safari allows the document to load correctly.</div>
      </div>
    </body></html>`,
  );
}

export default function RunOfShowGeneratorV2() {
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
  const [lastRender, setLastRender] = useState<{ html: string; filename: string; output_type: string; auto_selected: boolean } | null>(null);
  const [creatingManual, setCreatingManual] = useState(false);

  const { uploadToDrive, uploading: driveUploading } = useGoogleDriveUpload();

  const reset = () => {
    setIngestResult(null);
    setCanonicalRow(null);
    setSearchResults(null);
    setLastRender(null);
  };

  const validateNameDate = (): boolean => {
    if (!eventName.trim()) { toast({ title: "Event name required", variant: "destructive" }); return false; }
    if (!eventDate.trim()) { toast({ title: "Event date required", variant: "destructive" }); return false; }
    return true;
  };

  const loadCanonicalRow = async (id: string) => {
    const { data, error } = await supabase
      .from("canonical_events")
      .select("id, event_date, name, organization, event_type, attire, venue, client, contact, guests, logistics, personnel, timeline, song_sections, vendors, preferences")
      .eq("id", id)
      .single();
    if (error) {
      toast({ title: "Couldn't load canonical event", description: error.message, variant: "destructive" });
      return;
    }
    setCanonicalRow(data as unknown as CanonicalEventRow);
  };

  const callIngest = async (body: Record<string, unknown>) => {
    setIngesting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ingest-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Ingest failed", description: data?.error || data?.message || `HTTP ${res.status}`, variant: "destructive" });
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
    if (!pasteText.trim()) { toast({ title: "Paste some text first", variant: "destructive" }); return; }
    callIngest({ route: "paste", name: eventName, eventDate, organization, payload: { text: pasteText } });
  };

  const handleSearch = async () => {
    if (!validateNameDate()) return;
    setSearching(true);
    setSearchResults(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/drive-search-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON}` },
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
        toast({ title: "Drive API not enabled", description: "Click Enable in the Cloud Console, then retry.", variant: "destructive" });
        return;
      }
      const files = (data.files || []) as DriveFile[];
      setSearchResults(files);
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
      route: "drive-url", name: eventName, eventDate, organization,
      payload: { driveId: file.id, mimeType: file.mime_type, url: file.web_view_link, fileName: file.name },
    });
  };

  const handleUrl = () => {
    if (!validateNameDate()) return;
    if (!isLikelyDriveUrl(driveUrl)) {
      toast({
        title: "Drive-only import",
        description: "v2 supports Google Drive URLs only. For arbitrary webpages / CSVs, use v1 at /team/run-of-show.",
        variant: "destructive",
      });
      return;
    }
    const id = extractDriveIdFromUrl(driveUrl);
    if (!id) {
      toast({ title: "Couldn't extract Drive file ID", description: "Paste a URL like https://docs.google.com/spreadsheets/d/{ID}/edit", variant: "destructive" });
      return;
    }
    callIngest({ route: "drive-url", name: eventName, eventDate, organization, payload: { driveId: id, url: driveUrl } });
  };

  const handleManualStart = async () => {
    if (!validateNameDate()) return;
    setCreatingManual(true);
    try {
      const normalizedName = eventName.trim().toLowerCase();
      const { data: existing } = await supabase
        .from("canonical_events")
        .select("id")
        .eq("event_date", eventDate)
        .ilike("name", eventName.trim())
        .maybeSingle();

      let id: string;
      if (existing?.id) {
        id = existing.id;
        toast({ title: "Found existing canonical event", description: "Opening it for editing." });
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("canonical_events")
          .insert({
            event_date: eventDate,
            name: eventName.trim(),
            normalized_name: normalizedName,
            organization,
            client: {},
            venue: {},
            contact: {},
            guests: {},
            logistics: {},
            personnel: [],
            vendors: [],
            timeline: [],
            song_sections: [],
            preferences: {},
            source_files: [{ source_type: "manual", created_at: new Date().toISOString() }],
            extractor_version: "manual",
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        id = inserted!.id;
        toast({ title: "Manual event started", description: "Fill in fields below, then render." });
      }

      setIngestResult({
        id, route: "manual", merged: !!existing,
        sourceFile: { source_type: "manual", detected_shape: null, extracted_excerpt: "", is_blank_starter: false },
        extractor_version: "manual", shape: "W", confidence: null, is_blank_starter: false,
        llm_ran: false, llm_skipped_reason: "manual", warnings: [], fields_extracted: 0,
      });
      await loadCanonicalRow(id);
    } catch (err) {
      toast({ title: "Couldn't start manual event", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setCreatingManual(false);
    }
  };

  const handleRender = async (output: OutputType) => {
    if (!ingestResult) return;
    setRendering(output);
    setLastRender(null);
    try {
      const body: Record<string, unknown> = { canonical_event_id: ingestResult.id };
      if (output !== "auto") body.output_type = output;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/render-canonical-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Render failed", description: data?.error || `HTTP ${res.status}`, variant: "destructive" });
        return;
      }

      setLastRender({ html: data.html, filename: data.filename, output_type: data.output_type, auto_selected: !!data.auto_selected });
      toast({ title: `Rendered ${data.output_type}${data.auto_selected ? " (auto)" : ""}`, description: data.filename });
    } catch (err) {
      toast({ title: "Network error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setRendering(null);
    }
  };

  const handleDownload = (kind: "html" | "preview" | "print" | "drive") => {
    if (!lastRender) return;
    const { html, filename } = lastRender;

    if (kind === "html") {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${filename}.html`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: `${filename}.html` });
      return;
    }

    if (kind === "drive") {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      uploadToDrive({ fileName: `${filename}.html`, fileBlob: blob, mimeType: "text/html" });
      return;
    }

    // preview / print: open a window, write loading state, then swap to wrapped html
    const win = window.open("", "_blank");
    if (!win) {
      toast({ title: "Popup blocked", description: "Allow pop-ups for this site and try again.", variant: "destructive" });
      return;
    }
    writeLoadingPreview(win, kind);
    const wrapped = buildWrappedHtml(html, filename, kind);
    writePreviewWindow(win, wrapped);
    win.focus();
    toast({ title: kind === "print" ? "Print dialog opening" : "Preview opened", description: "New tab." });
  };

  const eventFieldsSection = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <div>
        <Label htmlFor="event-name">Event name</Label>
        <Input id="event-name" placeholder="e.g. Hoffman Wedding" value={eventName} onChange={(e) => setEventName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="event-date">Event date</Label>
        <Input id="event-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
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
          Ingest an event from a paste, a Drive search, a Drive URL, or start fresh. The canonical event lands in <code className="text-xs">canonical_events</code> and renders to X / X′ / Z / C-client.
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
                <TabsTrigger value="search" className="gap-1.5"><Search className="w-3.5 h-3.5" /> Drive search</TabsTrigger>
                <TabsTrigger value="url" className="gap-1.5"><Link2 className="w-3.5 h-3.5" /> Drive URL</TabsTrigger>
                <TabsTrigger value="paste" className="gap-1.5"><ClipboardPaste className="w-3.5 h-3.5" /> Paste</TabsTrigger>
                <TabsTrigger value="manual" className="gap-1.5"><FilePlus2 className="w-3.5 h-3.5" /> Manual</TabsTrigger>
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
                      <p className="text-muted-foreground mt-1">Try Drive URL, Paste, or start a Manual event.</p>
                    </div>
                  </div>
                )}

                {searchResults && searchResults.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {searchResults.length} match{searchResults.length === 1 ? "" : "es"}. Click Ingest to pull a file.
                    </p>
                    {searchResults.map((f) => (
                      <div key={f.id} className="flex items-start justify-between p-3 gap-2 rounded-md border border-border bg-card/40">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate">{f.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{fmtMime(f.mime_type)}</span>
                            {f.size != null && <span className="text-xs text-muted-foreground shrink-0">· {fmtBytes(f.size)}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            Modified {new Date(f.modified_time).toLocaleDateString()} · Owner {f.owners[0] || "—"}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <a href={f.web_view_link} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center h-8 px-2 rounded-md hover:bg-accent" title="Open in Drive">
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          </a>
                          <Button size="sm" onClick={() => selectDriveFile(f)} disabled={ingesting || f.mime_type.includes("folder")} title={f.mime_type.includes("folder") ? "Folders can't be ingested directly" : "Ingest this file"}>
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
                  Paste a Google Drive URL. Docs and Sheets fetch directly; other formats need pre-fetched text via Paste mode. Non-Drive URLs aren't supported here — use v1 for those.
                </p>
                <div>
                  <Label htmlFor="drive-url">Drive URL</Label>
                  <Input id="drive-url" placeholder="https://docs.google.com/spreadsheets/d/.../edit" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)} />
                  {driveUrl && !isLikelyDriveUrl(driveUrl) && (
                    <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Not a Drive URL — v2 is Drive-only. Use v1 for arbitrary webpages / CSVs.
                    </p>
                  )}
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
                <Textarea placeholder="Paste event details, ROS, planner answers, etc..." value={pasteText} onChange={(e) => setPasteText(e.target.value)} className="min-h-[240px] font-mono text-xs" />
                <Button onClick={handlePaste} disabled={ingesting || !pasteText.trim()}>
                  {ingesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ClipboardPaste className="w-4 h-4 mr-2" />}
                  Ingest paste
                </Button>
              </TabsContent>

              <TabsContent value="manual" className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Start a blank canonical event for this name + date. You'll fill in fields with the inline editor, then render.
                </p>
                <Button onClick={handleManualStart} disabled={creatingManual}>
                  {creatingManual ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PartyPopper className="w-4 h-4 mr-2" />}
                  Start blank event
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
          onReset={reset}
          onRowUpdated={(row) => setCanonicalRow(row)}
          lastRender={lastRender}
          onDownload={handleDownload}
          driveUploading={driveUploading}
        />
      )}
    </div>
  );
}

function CanonicalEventResult({
  ingestResult, canonicalRow, onRender, rendering, onReset, onRowUpdated,
  lastRender, onDownload, driveUploading,
}: {
  ingestResult: IngestResponse;
  canonicalRow: CanonicalEventRow;
  onRender: (output: OutputType) => void;
  rendering: OutputType | null;
  onReset: () => void;
  onRowUpdated: (row: CanonicalEventRow) => void;
  lastRender: { html: string; filename: string; output_type: string; auto_selected: boolean } | null;
  onDownload: (kind: "html" | "preview" | "print" | "drive") => void;
  driveUploading: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const autoOut = useMemo(() => pickAutoSelectedRenderer(canonicalRow), [canonicalRow]);

  const personnelCount = canonicalRow.personnel?.length ?? 0;
  const timelineCount = canonicalRow.timeline?.length ?? 0;
  const songCount = (canonicalRow.song_sections || []).reduce((a, s) => a + (s.songs?.length || 0), 0);
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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
                {editing ? <><XIcon className="w-3.5 h-3.5 mr-1" />Close editor</> : <><Pencil className="w-3.5 h-3.5 mr-1" />Edit fields</>}
              </Button>
              <Button variant="outline" size="sm" onClick={onReset}>Start over</Button>
            </div>
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

      {editing && (
        <InlineEditor row={canonicalRow} onSaved={(updated) => { onRowUpdated(updated); }} />
      )}

      <RequiredFieldsPanel row={canonicalRow} autoSelected={autoOut} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">2. Render output</CardTitle>
          <CardDescription>
            Auto picks the right template from organization + content (currently → <strong>{OUTPUT_META[autoOut].label}</strong>). Click a specific template to override.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {(Object.keys(OUTPUT_META) as OutputType[]).map((out) => {
              const meta = OUTPUT_META[out];
              return (
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
                    <span className="text-sm font-medium">{meta.label.split(" — ")[0]}</span>
                    {meta.audience === "client" && (
                      <span className="text-[10px] uppercase tracking-wider ml-auto bg-accent/20 text-accent-foreground px-1 py-0.5 rounded">client</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1 font-normal">{meta.short}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {lastRender && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Rendered: {lastRender.output_type}{lastRender.auto_selected ? " (auto)" : ""}
            </CardTitle>
            <CardDescription>{lastRender.filename}.html · pick how to use it below.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button variant="outline" onClick={() => onDownload("preview")}>
                <Eye className="w-4 h-4 mr-2" /> Preview
              </Button>
              <Button variant="outline" onClick={() => onDownload("print")}>
                <Printer className="w-4 h-4 mr-2" /> Print / PDF
              </Button>
              <Button variant="outline" onClick={() => onDownload("html")}>
                <FileText className="w-4 h-4 mr-2" /> Download HTML
              </Button>
              <Button variant="outline" onClick={() => onDownload("drive")} disabled={driveUploading}>
                {driveUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Upload to Drive
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
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

function RequiredFieldsPanel({ row, autoSelected }: { row: CanonicalEventRow; autoSelected: ConcreteOutput }) {
  const [showAll, setShowAll] = useState(false);
  const list = showAll
    ? (Object.keys(REQUIRED_BY_RENDERER) as ConcreteOutput[])
    : [autoSelected];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Field check</CardTitle>
            <CardDescription>
              {showAll ? "All renderers." : <>Auto-selected renderer: <strong>{OUTPUT_META[autoSelected].label}</strong>.</>}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show only auto" : "Show all renderers"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {list.map((r) => {
            const checks = REQUIRED_BY_RENDERER[r].map((c) => ({ ...c, found: c.ok(row) }));
            const missing = checks.filter((c) => !c.found);
            return (
              <div key={r}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">{OUTPUT_META[r].label}</span>
                  {missing.length === 0 ? (
                    <span className="text-xs flex items-center gap-1 text-emerald-700">
                      <CircleCheck className="w-3 h-3" /> all set
                    </span>
                  ) : (
                    <span className="text-xs flex items-center gap-1 text-destructive">
                      <AlertTriangle className="w-3 h-3" /> {missing.length} missing
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                  {checks.map((c) => (
                    <div
                      key={c.label}
                      className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${c.found ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-destructive/10 text-destructive"}`}
                    >
                      {c.found ? <CircleCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function InlineEditor({ row, onSaved }: { row: CanonicalEventRow; onSaved: (row: CanonicalEventRow) => void }) {
  const [draft, setDraft] = useState<CanonicalEventRow>(row);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(row); }, [row.id]);

  const set = (patch: Partial<CanonicalEventRow>) => setDraft((d) => ({ ...d, ...patch }));
  const setNested = <K extends keyof CanonicalEventRow>(key: K, patch: Partial<NonNullable<CanonicalEventRow[K]>>) => {
    setDraft((d) => ({ ...d, [key]: { ...(d[key] || {} as object), ...patch } as CanonicalEventRow[K] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Partial<CanonicalEventRow> & { normalized_name?: string } = {
        name: draft.name,
        event_date: draft.event_date,
        organization: draft.organization,
        event_type: draft.event_type,
        attire: draft.attire,
        venue: draft.venue || {},
        client: draft.client || {},
        contact: draft.contact || {},
        guests: draft.guests || {},
        logistics: draft.logistics || {},
      };
      if (draft.name) updates.normalized_name = draft.name.trim().toLowerCase();

      const { data, error } = await supabase
        .from("canonical_events")
        .update(updates)
        .eq("id", row.id)
        .select("id, event_date, name, organization, event_type, attire, venue, client, contact, guests, logistics, personnel, timeline, song_sections, vendors, preferences")
        .single();
      if (error) throw error;
      onSaved(data as unknown as CanonicalEventRow);
      toast({ title: "Saved", description: "Canonical event updated." });
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const venue = draft.venue || {};
  const client = draft.client || {};
  const guests = draft.guests || {};
  const logistics = draft.logistics || {};
  const contact = draft.contact || {};

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Edit fields</CardTitle>
        <CardDescription>
          Scalar + nested fields are editable here. Personnel, timeline, songs, vendors come from the ingest pipeline — re-ingest a corrected paste to change them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Event name</Label>
            <Input value={draft.name || ""} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div>
            <Label>Event date</Label>
            <Input type="date" value={draft.event_date || ""} onChange={(e) => set({ event_date: e.target.value })} />
          </div>
          <div>
            <Label>Organization</Label>
            <Select value={(draft.organization || "harborline") as Organization} onValueChange={(v) => set({ organization: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ORG_LABELS) as Organization[]).map((k) => <SelectItem key={k} value={k}>{ORG_LABELS[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Event type</Label>
            <Input placeholder="wedding / corporate / birthday / …" value={draft.event_type || ""} onChange={(e) => set({ event_type: e.target.value })} />
          </div>

          <div className="md:col-span-2 mt-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Client</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Primary client</Label>
                <Input value={client.primary || ""} onChange={(e) => setNested("client", { primary: e.target.value })} />
              </div>
              <div>
                <Label>Secondary client (spouse / co-host)</Label>
                <Input value={client.secondary || ""} onChange={(e) => setNested("client", { secondary: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="md:col-span-2 mt-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Venue</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Venue name</Label>
                <Input value={venue.name || ""} onChange={(e) => setNested("venue", { name: e.target.value })} />
              </div>
              <div>
                <Label>Venue address</Label>
                <Input value={venue.address || ""} onChange={(e) => setNested("venue", { address: e.target.value })} />
              </div>
              <div>
                <Label>Venue type</Label>
                <Select value={(venue.type || "") as string} onValueChange={(v) => setNested("venue", { type: (v || undefined) as "indoor" | "outdoor" | "both" | undefined })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indoor">Indoor</SelectItem>
                    <SelectItem value="outdoor">Outdoor</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Attire</Label>
                <Input value={draft.attire || ""} onChange={(e) => set({ attire: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="md:col-span-2 mt-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Guests</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Guest count</Label>
                <Input type="number" value={guests.count ?? ""} onChange={(e) => setNested("guests", { count: e.target.value ? parseInt(e.target.value) : undefined })} />
              </div>
              <div>
                <Label>Arrival time</Label>
                <Input placeholder="e.g. 4:30 PM" value={guests.arrival_time || ""} onChange={(e) => setNested("guests", { arrival_time: e.target.value })} />
              </div>
              <div>
                <Label>Wedding-party arrival</Label>
                <Input placeholder="e.g. 3:00 PM" value={guests.party_arrival_time || ""} onChange={(e) => setNested("guests", { party_arrival_time: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="md:col-span-2 mt-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Logistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Setup time</Label><Input value={logistics.setup_time || ""} onChange={(e) => setNested("logistics", { setup_time: e.target.value })} /></div>
              <div><Label>Load-in</Label><Input value={logistics.load_in || ""} onChange={(e) => setNested("logistics", { load_in: e.target.value })} /></div>
              <div><Label>Soundcheck</Label><Input value={logistics.soundcheck || ""} onChange={(e) => setNested("logistics", { soundcheck: e.target.value })} /></div>
              <div><Label>Entrance</Label><Input value={logistics.entrance || ""} onChange={(e) => setNested("logistics", { entrance: e.target.value })} /></div>
              <div><Label>Parking</Label><Input value={logistics.parking || ""} onChange={(e) => setNested("logistics", { parking: e.target.value })} /></div>
              <div><Label>Green room</Label><Input value={logistics.green_room || ""} onChange={(e) => setNested("logistics", { green_room: e.target.value })} /></div>
              <div><Label>Meals / refreshments</Label><Input value={logistics.meals || ""} onChange={(e) => setNested("logistics", { meals: e.target.value })} /></div>
              <div><Label>Audio reinforcement</Label><Input value={logistics.audio_reinforcement || ""} onChange={(e) => setNested("logistics", { audio_reinforcement: e.target.value })} /></div>
            </div>
          </div>

          <div className="md:col-span-2 mt-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={contact.phone || ""} onChange={(e) => setNested("contact", { phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={contact.email || ""} onChange={(e) => setNested("contact", { email: e.target.value })} /></div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => setDraft(row)} disabled={saving}>Reset</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save edits
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
