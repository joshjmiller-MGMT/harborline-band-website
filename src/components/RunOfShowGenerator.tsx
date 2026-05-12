import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Download, Loader2, ExternalLink, AlertCircle, Music, Clock, Users, MapPin, CalendarDays, CheckCircle2, AlertTriangle, CircleCheck, Eye, Printer, Upload, ChevronDown, File, Copy, Table, Search, Hash, Sparkles, ArrowRight, X, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { generateDocx, generateDocxBlob } from "@/utils/docxGenerator";
import { useGoogleDriveUpload } from "@/hooks/useGoogleDriveUpload";
import logoCircle from "@/assets/logo-harborline-doc.png";
import logoTextHarborline from "@/assets/logo-harborline-doc.png";
import logoTextBSE from "@/assets/logo-bse-dark.png";
import logoTextTSB from "@/assets/logo-tsb.webp";

type OrgKey = "harborline" | "bse" | "tsb";

const ORG_INFO: Record<OrgKey, { name: string; logoText: string }> = {
  harborline: { name: "Harborline", logoText: logoTextHarborline },
  bse: { name: "Baltimore Sound Entertainment", logoText: logoTextBSE },
  tsb: { name: "Tom Starr Band", logoText: logoTextTSB },
};

type TemplateType = "wedding-ros" | "client-planner" | "corporate-ros" | "party-runsheet";

const TEMPLATE_INFO: Record<TemplateType, { name: string; description: string; audience: "internal" | "client" }> = {
  "wedding-ros": {
    name: "Wedding Ceremony",
    description: "Formal run of show with event details header, timeline sections, and song lists.",
    audience: "internal",
  },
  "client-planner": {
    name: "Client Planner",
    description: "Client-facing template for organizing ceremony music choices and event details.",
    audience: "client",
  },
  "corporate-ros": {
    name: "Corporate Event",
    description: "Multi-day scheduling, sound/production notes, and logistics.",
    audience: "internal",
  },
  "party-runsheet": {
    name: "Party Run Sheet",
    description: "Day-of run sheet with event details, timeline, team, songlist, and logistics.",
    audience: "internal",
  },
};

// Required fields per template type
const TEMPLATE_FIELDS: Record<TemplateType, { label: string; key: string }[]> = {
  "wedding-ros": [
    { label: "Event Name", key: "event name" },
    { label: "Event Date", key: "event date" },
    { label: "Setup Time", key: "setup time" },
    { label: "Start / End", key: "start / end" },
    { label: "Client", key: "client" },
    { label: "Event Type", key: "event type" },
    { label: "Venue", key: "venue" },
    { label: "Venue Address", key: "venue address" },
    { label: "Venue Type", key: "venue type" },
    { label: "Ensemble", key: "ensemble" },
    { label: "Musicians", key: "musicians" },
    { label: "Other Staff Members", key: "other staff members" },
    { label: "Guest Count", key: "guest count" },
    { label: "Attire", key: "attire" },
    { label: "Officiant", key: "officiant" },
    { label: "Coordinator", key: "coordinator" },
    { label: "Musician Food & Bev", key: "musician food & bev" },
    { label: "Audio Reinforcement", key: "audio reinforcement" },
    { label: "Project Lead", key: "project lead" },
    { label: "Musician POS", key: "musician pos" },
  ],
  "client-planner": [
    { label: "Event Name", key: "event name" },
    { label: "Event Date", key: "event date" },
    { label: "Event Type", key: "event type" },
    { label: "Venue", key: "venue" },
    { label: "Musicians", key: "musicians" },
    { label: "Ensemble", key: "ensemble" },
    { label: "Guest Count", key: "guest count" },
    { label: "Musician Salesperson", key: "musician salesperson" },
    { label: "Coordinator", key: "coordinator" },
  ],
  "corporate-ros": [
    { label: "Event Name", key: "event name" },
    { label: "Event Date", key: "event date" },
    { label: "Event Type", key: "event type" },
    { label: "Client", key: "client" },
    { label: "Organization", key: "organization" },
    { label: "Venue", key: "venue" },
    { label: "Venue Address", key: "venue address" },
    { label: "Guest Count", key: "guest count" },
    { label: "Setup Time", key: "setup time" },
    { label: "Start / End", key: "start / end" },
    { label: "Load-in Time", key: "load-in time" },
    { label: "Soundcheck", key: "soundcheck" },
    { label: "Parking", key: "parking" },
    { label: "Attire", key: "attire" },
    { label: "Audio Reinforcement", key: "audio reinforcement" },
    { label: "Project Lead", key: "project lead" },
    { label: "Musician POS", key: "musician pos" },
  ],
  "party-runsheet": [
    { label: "Event Name", key: "event name" },
    { label: "Event Date", key: "event date" },
    { label: "Event Type", key: "event type" },
    { label: "Client", key: "client" },
    { label: "Venue", key: "venue" },
    { label: "Venue Address", key: "venue address" },
    { label: "Ensemble", key: "ensemble" },
    { label: "Guest Count", key: "guest count" },
    { label: "Setup Time", key: "setup time" },
    { label: "Start / End", key: "start / end" },
    { label: "Load-in Time", key: "load-in time" },
    { label: "Soundcheck", key: "soundcheck" },
    { label: "Parking", key: "parking" },
    { label: "Entrance", key: "entrance" },
    { label: "Officiant", key: "officiant" },
    { label: "Coordinator", key: "coordinator" },
    { label: "Project Lead", key: "project lead" },
    { label: "Musician POS", key: "musician pos" },
    { label: "Green Room", key: "green room" },
    { label: "Attire", key: "attire" },
    { label: "Posting", key: "posting" },
    { label: "Musician Food & Bev", key: "musician food & bev" },
    { label: "Audio Reinforcement", key: "audio reinforcement" },
  ],
};

const DETAIL_KEY_ALIASES: Record<string, string> = {
  "musicians salesperson": "musician salesperson",
  "musicians sales person": "musician salesperson",
  "musician sales person": "musician salesperson",
  salesperson: "musician salesperson",
  "sales person": "musician salesperson",
  "sales rep": "musician salesperson",
  "coordinator or on-site point of contact": "coordinator",
  "coordinator or on site point of contact": "coordinator",
  "on-site point of contact": "coordinator",
  "on site point of contact": "coordinator",
  "event coordinator": "coordinator",
  "day-of coordinator": "coordinator",
  "day of coordinator": "coordinator",
  "wedding coordinator": "coordinator",
  "band project lead": "project lead",
  "music project lead": "project lead",
  "musician project lead": "project lead",
  "on site poc": "musician pos",
  "on-site poc": "musician pos",
  onsite: "musician pos",
  "musician p o s": "musician pos",
  "musician poc": "musician pos",
  "musician point of contact": "musician pos",
  "musician on-site point of contact": "musician pos",
  "musician on site point of contact": "musician pos",
  "musician on-site poc": "musician pos",
  "musician on site poc": "musician pos",
  "musician onsite poc": "musician pos",
  "musician point person": "musician pos",
};

const normalizeDetailKey = (rawKey: string): string => {
  const cleaned = rawKey
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[.]/g, " ")
    .replace(/:$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (DETAIL_KEY_ALIASES[cleaned]) return DETAIL_KEY_ALIASES[cleaned];
  if (cleaned.includes("musician") && (cleaned.includes("salesperson") || cleaned.includes("sales person") || cleaned.includes("sales rep"))) {
    return "musician salesperson";
  }
  if (cleaned.includes("coordinator")) return "coordinator";
  if (cleaned.includes("project") && cleaned.includes("lead")) return "project lead";
  if (cleaned.includes("musician") && (cleaned.includes("pos") || cleaned.includes("poc") || cleaned.includes("point of contact") || cleaned.includes("point person"))) {
    return "musician pos";
  }

  return cleaned;
};

const normalizeDetails = (details: Record<string, string>): Record<string, string> => {
  return Object.entries(details).reduce<Record<string, string>>((acc, [key, value]) => {
    const normalizedKey = normalizeDetailKey(key);
    if (!value) return acc;
    if (!acc[normalizedKey] || value.length > acc[normalizedKey].length) {
      acc[normalizedKey] = value;
    }
    return acc;
  }, {});
};

interface SheetData {
  headers: string[];
  rows: string[][];
  sheetTitle: string;
}

interface ParsedEventData {
  eventName: string;
  details: Record<string, string>;
  personnel: { role: string; name: string }[];
  timeline: { time: string; description: string }[];
  songSections: { title: string; time: string; songs: any[] }[];
}

interface DjepMatch {
  djep_id: string;
  title: string;
  event_date: string | null;
  fields: { label: string; value: string }[];
  source_url: string;
  match_score: number;
}

interface AutocorrectCorrection {
  line_index: number;
  original_label: string;
  original_value: string;
  corrected_label: string;
  corrected_value: string;
  reason: string;
}

const imageToBase64 = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
};

export default function RunOfShowGenerator() {
  const [inputUrl, setInputUrl] = useState("");
  const [template, setTemplate] = useState<TemplateType>("party-runsheet");
  const [loading, setLoading] = useState(false);
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [parsedData, setParsedData] = useState<ParsedEventData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sourceType, setSourceType] = useState<string>("");
  const [logosBase64, setLogosBase64] = useState<{ circle: string; text: string } | null>(null);
  const [organization, setOrganization] = useState<OrgKey>("harborline");
  const [manualOverrides, setManualOverrides] = useState("");
  const manualOverridesRef = useRef<HTMLTextAreaElement>(null);

  // Autocorrect state (P6)
  const [autocorrectLoading, setAutocorrectLoading] = useState(false);
  const [autocorrectSuggestions, setAutocorrectSuggestions] = useState<AutocorrectCorrection[] | null>(null);

  // DJEP lookup state
  const [djepMode, setDjepMode] = useState<"search" | "id">("search");
  const [djepName, setDjepName] = useState("");
  const [djepDate, setDjepDate] = useState("");
  const [djepIdInput, setDjepIdInput] = useState("");
  const [djepLoading, setDjepLoading] = useState(false);
  const [djepMatches, setDjepMatches] = useState<DjepMatch[] | null>(null);
  const [djepNote, setDjepNote] = useState<string | null>(null);

  const { uploadToDrive, uploading: driveUploading } = useGoogleDriveUpload();
  const currentLogoText = ORG_INFO[organization].logoText;

  useEffect(() => {
    Promise.all([imageToBase64(logoCircle), imageToBase64(currentLogoText)])
      .then(([circle, text]) => setLogosBase64({ circle, text }))
      .catch(() => console.warn("Failed to preload logos"));
  }, [currentLogoText]);

  const detectUrlType = (url: string): string => {
    if (url.includes('docs.google.com/spreadsheets')) return 'Google Sheet';
    if (url.includes('docs.google.com/document')) return 'Google Doc';
    if (url.includes('.csv')) return 'CSV';
    return 'Webpage';
  };

  const decodeBase64Utf8 = (base64: string): string => {
    const binary = window.atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  };

  // Parse manual overrides text into key-value pairs
  const parseManualOverrides = (): Record<string, string> => {
    const overrides: Record<string, string> = {};
    if (!manualOverrides.trim()) return overrides;
    const lines = manualOverrides.split("\n");
    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = normalizeDetailKey(line.substring(0, colonIdx).trim());
        const value = line.substring(colonIdx + 1).trim();
        if (key && value) {
          overrides[key] = value;
        }
      }
    }
    return overrides;
  };

  // Get merged details (parsed + overrides)
  const getMergedDetails = (): Record<string, string> => {
    const base = normalizeDetails(parsedData?.details || {});
    const overrides = parseManualOverrides();
    const merged = { ...base, ...overrides };

    // Apply org-specific defaults for project lead
    if (!merged['project lead'] && !merged['bandleader']) {
      if (organization === 'tsb') merged['project lead'] = 'Tom Starr';
      else if (organization === 'harborline') merged['project lead'] = 'Josh Miller';
    }
    // Default musician POS to project lead / bandleader
    if (!merged['musician pos']) {
      if (merged['project lead']) merged['musician pos'] = merged['project lead'];
      else if (merged['bandleader']) merged['musician pos'] = merged['bandleader'];
    }

    return merged;
  };

  // Get the list of fields for the current template and their status
  const getFieldStatus = () => {
    const fields = TEMPLATE_FIELDS[template] || [];
    const merged = getMergedDetails();
    return fields.map(f => ({
      ...f,
      value: merged[f.key] || "",
      found: !!merged[f.key],
    }));
  };

  // DJEP URLs all share one root, but a per-event link Josh pastes in may carry
  // the eventId as a query param (`event=`, `id=`, `eventid=`). If the user
  // just types or pastes a bare number, treat that as the id directly.
  const extractDjepEventId = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (/^\d+$/.test(trimmed)) return trimmed;
    try {
      const url = new URL(trimmed);
      for (const key of ["event", "eventid", "event_id", "id"]) {
        const v = url.searchParams.get(key);
        if (v && /^\d+$/.test(v)) return v;
      }
    } catch {
      // not a URL — fall through
    }
    const m = trimmed.match(/(\d{3,})/);
    return m ? m[1] : trimmed;
  };

  const runDjepLookup = async () => {
    const payload: { name?: string; date?: string; eventId?: string } = {};
    if (djepMode === "search") {
      if (!djepName.trim() && !djepDate.trim()) {
        toast({
          title: "Add a name or date",
          description: "Type at least an event name or pick a date to search DJEP.",
          variant: "destructive",
        });
        return;
      }
      if (djepName.trim()) payload.name = djepName.trim();
      if (djepDate.trim()) payload.date = djepDate.trim();
      // edge function requires `name` when there's no eventId; if Josh only
      // typed a date, send a wildcard token so server-side validation passes.
      if (!payload.name) payload.name = "_";
    } else {
      const id = extractDjepEventId(djepIdInput);
      if (!id) {
        toast({
          title: "Missing Event ID",
          description: "Paste a DJEP Event ID or URL containing one.",
          variant: "destructive",
        });
        return;
      }
      payload.eventId = id;
    }

    setDjepLoading(true);
    setDjepMatches(null);
    setDjepNote(null);
    try {
      const { data, error } = await supabase.functions.invoke("djep-event-lookup", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const matches: DjepMatch[] = Array.isArray(data?.matches) ? data.matches : [];
      setDjepMatches(matches);
      if (data?.note) setDjepNote(String(data.note));
      if (matches.length === 0) {
        toast({
          title: "No DJEP matches",
          description: data?.note || "Try different terms or refresh the DJEP cache.",
        });
      }
    } catch (err: any) {
      toast({
        title: "DJEP lookup failed",
        description: err.message || "Could not reach DJEP cache.",
        variant: "destructive",
      });
    } finally {
      setDjepLoading(false);
    }
  };

  // Translate a DJEP cache match into the (headers, rows) shape v1's
  // generate-run-of-show already understands. Labels get a trailing colon so
  // parseSheetToEvent picks them up via its `cell.endsWith(':') && nextCell`
  // branch. We also synthesize a Client + Event Name from `match.title`
  // ("<next action> · <client>") because DJEP's SALES-MILLER scrape doesn't
  // store a dedicated event-name field.
  const djepMatchToSheetData = (match: DjepMatch): SheetData => {
    const rows: string[][] = [];
    const parts = match.title.split(" · ");
    const client = parts.length >= 2 ? parts.slice(1).join(" · ").trim() : match.title.trim();
    if (client) {
      rows.push(["Event Name:", client]);
      rows.push(["Client:", client]);
    }
    for (const f of match.fields) {
      const label = f.label.trim();
      const value = (f.value || "").trim();
      if (!label || !value) continue;
      // Skip Status / Next Action / Next Action Date — those describe the
      // lead pipeline, not the run-of-show. They live in DJEP for sales ops,
      // not document generation. Event ID is kept for traceability.
      if (/^(status|next action|next action date)$/i.test(label)) continue;
      rows.push([`${label}:`, value]);
    }
    return {
      headers: ["Field", "Value"],
      rows,
      sheetTitle: `DJEP — ${client || match.djep_id}`,
    };
  };

  const applyDjepMatch = async (match: DjepMatch) => {
    setLoading(true);
    setParsedData(null);
    setSourceType("DJEP");
    setInputUrl("");
    try {
      const synthesized = djepMatchToSheetData(match);
      setSheetData(synthesized);

      const { data: genData, error: genError } = await supabase.functions.invoke(
        "generate-run-of-show",
        { body: { sheetData: synthesized, template, format: "html", logos: logosBase64, organization } },
      );
      if (!genError && genData?.parsedData) {
        setParsedData(genData.parsedData);
      }
      toast({ title: "DJEP event loaded", description: synthesized.sheetTitle });
    } catch (err: any) {
      toast({
        title: "Failed to apply DJEP match",
        description: err.message || "Something went wrong loading that event.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    if (!inputUrl.trim()) {
      toast({ title: "Missing URL", description: "Please paste a URL to import.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setParsedData(null);
    setSourceType(detectUrlType(inputUrl));
    try {
      const isSheet = inputUrl.includes('docs.google.com/spreadsheets');
      const sheetIdMatch = inputUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);

      const { data, error } = await supabase.functions.invoke("fetch-google-sheet", {
        body: isSheet && sheetIdMatch
          ? { sheetId: sheetIdMatch[1], url: inputUrl }
          : { url: inputUrl },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSheetData(data);
      setSourceType(data.sourceType || detectUrlType(inputUrl));

      const { data: genData, error: genError } = await supabase.functions.invoke("generate-run-of-show", {
        body: { sheetData: data, template, format: "html", logos: logosBase64, organization },
      });

      if (!genError && genData?.parsedData) {
        setParsedData(genData.parsedData);
      }

      toast({ title: "Data loaded", description: `Imported from ${detectUrlType(inputUrl)}.` });
    } catch (err: any) {
      toast({
        title: "Failed to fetch",
        description: err.message || "Make sure the link is publicly accessible.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const buildWrappedHtml = (html: string, title: string, mode: "preview" | "print") => {
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
          const runPrint = () => {
            window.focus();
            window.print();
          };

          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => setTimeout(runPrint, 150));
          } else {
            setTimeout(runPrint, 300);
          }
        });
      <\/script>` : ""}
    </head><body><div class="page-shell">${bodyContent}</div></body></html>`;
  };

  const writePreviewWindow = (previewWindow: Window, html: string) => {
    previewWindow.document.open();
    previewWindow.document.write(html);
    previewWindow.document.close();
  };

  const writeLoadingPreview = (previewWindow: Window, mode: "preview" | "print") => {
    writePreviewWindow(
      previewWindow,
      `<!DOCTYPE html><html lang="en"><head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Preparing ${mode === "print" ? "print view" : "preview"}...</title>
        <style>
          html, body { margin: 0; min-height: 100%; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #111827; color: white; }
          body { display: grid; place-items: center; padding: 24px; }
          .shell { text-align: center; max-width: 420px; }
          .spinner { width: 32px; height: 32px; margin: 0 auto 16px; border: 3px solid rgba(255,255,255,0.2); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
          .copy { color: rgba(255,255,255,0.72); font-size: 14px; line-height: 1.5; }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head><body>
        <div class="shell">
          <div class="spinner"></div>
          <h1 style="margin: 0 0 10px; font-size: 20px; font-weight: 600;">Preparing ${mode === "print" ? "print view" : "preview"}…</h1>
          <div class="copy">This tab was opened early so Safari allows the document to load correctly.</div>
        </div>
      </body></html>`,
    );
  };

  const generateDocument = async (mode: "download" | "preview" | "print" | "docx") => {
    const needsPreviewWindow = mode === "preview" || mode === "print";
    const previewWindow = needsPreviewWindow ? window.open("", "_blank") : null;

    if (needsPreviewWindow && !previewWindow) {
      toast({
        title: "Popup blocked",
        description: "Safari blocked the preview tab. Please allow pop-ups for this site and try again.",
        variant: "destructive",
      });
      return;
    }

    if (previewWindow && (mode === "preview" || mode === "print")) {
      writeLoadingPreview(previewWindow, mode);
    }

    setGenerating(true);
    try {
      const overrides = parseManualOverrides();
      const mergedSheetData = sheetData || { headers: [], rows: [], sheetTitle: "Untitled" };

      if (mode === "docx") {
        const { data, error } = await supabase.functions.invoke("generate-run-of-show", {
          body: {
            sheetData: mergedSheetData,
            template,
            format: "html",
            logos: logosBase64,
            overrides,
            organization,
            requiredFields: TEMPLATE_FIELDS[template].map(f => ({ label: f.label, key: f.key })),
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const eventData = data?.parsedData || parsedData;
        if (!eventData) throw new Error("No parsed data available for DOCX export.");

        if (overrides && typeof overrides === "object") {
          for (const [key, value] of Object.entries(overrides)) {
            if (value.trim()) {
              eventData.details[key.toLowerCase()] = value.trim();
              if (key.toLowerCase() === "event name") eventData.eventName = value.trim();
            }
          }
        }

        await generateDocx(
          eventData,
          template,
          organization,
          TEMPLATE_FIELDS[template],
          currentLogoText,
        );
        toast({ title: "Downloaded!", description: "DOCX file saved — ready for Google Drive." });
        return;
      }

      const { data, error } = await supabase.functions.invoke("generate-run-of-show", {
        body: {
          sheetData: mergedSheetData,
          template,
          format: "html",
          logos: logosBase64,
          overrides,
          organization,
          requiredFields: TEMPLATE_FIELDS[template].map(f => ({ label: f.label, key: f.key })),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.file) throw new Error("No document was returned.");

      const html = decodeBase64Utf8(data.file);

      if (mode === "download") {
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${data.filename || "run-of-show"}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Downloaded!", description: "HTML file saved." });
        return;
      }

      if (!previewWindow || (mode !== "preview" && mode !== "print")) {
        throw new Error("Preview window was unavailable.");
      }

      const wrappedHtml = buildWrappedHtml(html, data.filename || "Document", mode);
      writePreviewWindow(previewWindow, wrappedHtml);
      previewWindow.focus();

      toast({ title: mode === "print" ? "Print dialog opened" : "Preview opened", description: "Opened in a new tab." });
    } catch (err: any) {
      if (previewWindow && !previewWindow.closed) {
        writePreviewWindow(
          previewWindow,
          `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Preview failed</title></head><body style="font-family: system-ui, sans-serif; padding: 24px; line-height: 1.5;"><h1 style="margin-top: 0;">Preview failed</h1><p>${(err?.message || "Something went wrong generating the document.").replace(/[<>&]/g, "")}</p></body></html>`,
        );
      }

      toast({
        title: "Generation failed",
        description: err.message || "Something went wrong generating the document.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDriveUpload = async () => {
    setGenerating(true);
    try {
      const overrides = parseManualOverrides();
      const mergedSheetData = sheetData || { headers: [], rows: [], sheetTitle: "Untitled" };

      const { data, error } = await supabase.functions.invoke("generate-run-of-show", {
        body: {
          sheetData: mergedSheetData,
          template,
          format: "html",
          logos: logosBase64,
          overrides,
          organization,
          requiredFields: TEMPLATE_FIELDS[template].map(f => ({ label: f.label, key: f.key })),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const eventData = data?.parsedData || parsedData;
      if (!eventData) throw new Error("No parsed data available for DOCX export.");

      if (overrides && typeof overrides === "object") {
        for (const [key, value] of Object.entries(overrides)) {
          if (value.trim()) {
            eventData.details[key.toLowerCase()] = value.trim();
            if (key.toLowerCase() === "event name") eventData.eventName = value.trim();
          }
        }
      }

      const { blob, filename } = await generateDocxBlob(
        eventData,
        template,
        organization,
        TEMPLATE_FIELDS[template],
        currentLogoText,
      );

      uploadToDrive({ fileName: filename, fileBlob: blob });
    } catch (err: any) {
      toast({ title: "Error preparing document", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const getExportData = () => parsedData || null;

  const exportAsPlainText = () => {
    const data = getExportData();
    if (!data) { toast({ title: "No data", description: "Import a sheet first.", variant: "destructive" }); return; }
    let text = `${data.eventName || "Run of Show"}\n${"=".repeat(40)}\n\n`;
    const details = data.details || {};
    for (const [key, value] of Object.entries(details)) { if (value) text += `${key}: ${value}\n`; }
    if (Object.keys(details).length > 0) text += "\n";
    for (const section of data.songSections || []) {
      text += `--- ${section.title} ---\n`;
      for (const song of section.songs) {
        text += `  ${song.time || ""} ${song.title}${song.artist ? ` - ${song.artist}` : ""}${song.notes ? ` (${song.notes})` : ""}\n`;
      }
      text += "\n";
    }
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${data.eventName || "run-of-show"}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: "Downloaded!", description: "TXT file saved." });
  };

  const exportAsCsv = () => {
    const data = getExportData();
    if (!data) { toast({ title: "No data", description: "Import a sheet first.", variant: "destructive" }); return; }
    const rows: string[][] = [["Section", "Time", "Song", "Artist", "Notes"]];
    for (const section of data.songSections || []) {
      for (const song of section.songs) {
        rows.push([section.title, song.time || "", song.title || "", song.artist || "", song.notes || ""]);
      }
    }
    const csv = rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${data.eventName || "run-of-show"}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: "Downloaded!", description: "CSV file saved." });
  };

  const copyToClipboard = () => {
    const data = getExportData();
    if (!data) { toast({ title: "No data", description: "Import a sheet first.", variant: "destructive" }); return; }
    let text = "";
    for (const section of data.songSections || []) {
      for (const song of section.songs) { text += `• ${song.title}${song.artist ? ` - ${song.artist}` : ""}\n`; }
    }
    navigator.clipboard.writeText(text.trim()).then(() => {
      toast({ title: "Copied!", description: "Song list copied to clipboard." });
    });
  };

  const totalSongs = parsedData?.songSections.reduce((sum, s) => sum + s.songs.length, 0) || 0;
  const fieldStatus = getFieldStatus();
  const missingFields = fieldStatus.filter(f => !f.found);
  const foundFields = fieldStatus.filter(f => f.found);

  const focusManualOverrides = () => {
    window.requestAnimationFrame(() => {
      const textarea = manualOverridesRef.current;
      if (!textarea) return;
      textarea.focus();
      const cursor = textarea.value.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const addManualEntry = () => {
    setManualOverrides((prev) => {
      const existingKeys = new Set(
        prev
          .split("\n")
          .map((line) => line.split(":")[0]?.trim())
          .filter(Boolean)
          .map((key) => normalizeDetailKey(key)),
      );

      const linesToAdd = missingFields
        .filter((field) => !existingKeys.has(field.key))
        .map((field) => `${field.label}: `);

      if (linesToAdd.length === 0) return prev;
      return prev.trimEnd() ? `${prev.trimEnd()}\n${linesToAdd.join("\n")}` : linesToAdd.join("\n");
    });

    focusManualOverrides();
  };

  // P6: LLM autocorrect for the manual-overrides textarea.
  // Rewrites a single line at a given index without disturbing other lines,
  // so applying one suggestion doesn't invalidate the others' line_index.
  const replaceLineAt = (text: string, idx: number, replacement: string): string => {
    const lines = text.split("\n");
    if (idx < 0 || idx >= lines.length) return text;
    lines[idx] = replacement;
    return lines.join("\n");
  };

  const runAutocorrect = async () => {
    if (!manualOverrides.trim()) {
      toast({
        title: "Nothing to clean up",
        description: "Add some manual entries first.",
      });
      return;
    }
    setAutocorrectLoading(true);
    setAutocorrectSuggestions(null);
    try {
      const { data, error } = await supabase.functions.invoke("manual-overrides-autocorrect", {
        body: {
          overrides: manualOverrides,
          template_fields: TEMPLATE_FIELDS[template],
          template_label: template,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const corrections: AutocorrectCorrection[] = Array.isArray(data?.corrections) ? data.corrections : [];
      if (corrections.length === 0) {
        toast({
          title: "Looks clean",
          description: "No fixes suggested for your manual entries.",
        });
        setAutocorrectSuggestions(null);
        return;
      }
      setAutocorrectSuggestions(corrections);
    } catch (err: any) {
      console.error("autocorrect failed", err);
      toast({
        title: "Autocorrect failed",
        description: err?.message || "Could not reach the autocorrect service.",
        variant: "destructive",
      });
    } finally {
      setAutocorrectLoading(false);
    }
  };

  const applyCorrection = (correction: AutocorrectCorrection) => {
    const replacement = `${correction.corrected_label}: ${correction.corrected_value}`;
    setManualOverrides((prev) => replaceLineAt(prev, correction.line_index, replacement));
    setAutocorrectSuggestions((prev) => {
      if (!prev) return prev;
      const next = prev.filter((c) => c.line_index !== correction.line_index);
      return next.length === 0 ? null : next;
    });
  };

  const applyAllCorrections = () => {
    if (!autocorrectSuggestions || autocorrectSuggestions.length === 0) return;
    setManualOverrides((prev) => {
      let next = prev;
      for (const c of autocorrectSuggestions) {
        next = replaceLineAt(next, c.line_index, `${c.corrected_label}: ${c.corrected_value}`);
      }
      return next;
    });
    setAutocorrectSuggestions(null);
  };

  const dismissCorrection = (lineIndex: number) => {
    setAutocorrectSuggestions((prev) => {
      if (!prev) return prev;
      const next = prev.filter((c) => c.line_index !== lineIndex);
      return next.length === 0 ? null : next;
    });
  };

  const dismissAllCorrections = () => setAutocorrectSuggestions(null);

  return (
    <div className="container mx-auto px-6 py-10 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display tracking-display text-foreground mb-2">
          Doc Generator
        </h1>
        <p className="text-muted-foreground">
          Import event data and export branded documents — internal run sheets or client-facing planners.
        </p>
      </div>

      {/* Step 1: Import Data */}
      <Card className="mb-6 bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl font-display tracking-wide-custom flex items-center gap-2">
            <span className="text-primary">1.</span> Import Data
          </CardTitle>
          <CardDescription>
            Paste a URL to import — Google Sheets, Google Docs, CSV files, or any public webpage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/... or any URL"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="flex-1 bg-secondary/50 border-border"
            />
            <Button onClick={fetchData} disabled={loading || !inputUrl}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              {loading ? "Fetching..." : "Fetch"}
            </Button>
          </div>
          {inputUrl && !loading && !sheetData && (
            <p className="text-xs text-muted-foreground mt-2">
              Detected: {detectUrlType(inputUrl)}
            </p>
          )}

          {parsedData && (
            <div className="mt-4 space-y-3">
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span className="text-foreground font-medium text-sm">
                    Sheet loaded: {sheetData?.sheetTitle || "Untitled"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {parsedData.eventName && (
                    <div className="flex items-start gap-2">
                      <CalendarDays className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <span className="text-muted-foreground text-xs">Event</span>
                        <p className="text-foreground">{parsedData.eventName}</p>
                      </div>
                    </div>
                  )}
                  {parsedData.details['venue'] && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <span className="text-muted-foreground text-xs">Venue</span>
                        <p className="text-foreground">{parsedData.details['venue']}</p>
                      </div>
                    </div>
                  )}
                  {parsedData.details['event date'] && (
                    <div className="flex items-start gap-2">
                      <CalendarDays className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <span className="text-muted-foreground text-xs">Date</span>
                        <p className="text-foreground">{parsedData.details['event date']}</p>
                      </div>
                    </div>
                  )}
                  {parsedData.details['client'] && (
                    <div className="flex items-start gap-2">
                      <Users className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <span className="text-muted-foreground text-xs">Client</span>
                        <p className="text-foreground">{parsedData.details['client']}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                  {Object.keys(parsedData.details).length > 0 && (
                    <span>{Object.keys(parsedData.details).length} detail fields</span>
                  )}
                  {parsedData.personnel.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {parsedData.personnel.length} personnel
                    </span>
                  )}
                  {parsedData.timeline.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {parsedData.timeline.length} timeline events
                    </span>
                  )}
                  {totalSongs > 0 && (
                    <span className="flex items-center gap-1">
                      <Music className="w-3 h-3" />
                      {totalSongs} songs in {parsedData.songSections.length} set{parsedData.songSections.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optional: Import from DJEP (alternative to Step 1) */}
      <Card className="mb-6 bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl font-display tracking-wide-custom flex items-center gap-2">
            <span className="text-muted-foreground">or</span> Import from DJEP
          </CardTitle>
          <CardDescription>
            Pull an event from the DJEP SALES-MILLER cache by name + date, or by Event ID / URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Button
              type="button"
              variant={djepMode === "search" ? "default" : "outline"}
              size="sm"
              onClick={() => { setDjepMode("search"); setDjepMatches(null); setDjepNote(null); }}
            >
              <Search className="w-3.5 h-3.5 mr-1.5" /> Search
            </Button>
            <Button
              type="button"
              variant={djepMode === "id" ? "default" : "outline"}
              size="sm"
              onClick={() => { setDjepMode("id"); setDjepMatches(null); setDjepNote(null); }}
            >
              <Hash className="w-3.5 h-3.5 mr-1.5" /> Event ID / URL
            </Button>
          </div>

          {djepMode === "search" ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Event or client name (e.g. Hoffman)"
                value={djepName}
                onChange={(e) => setDjepName(e.target.value)}
                className="flex-1 bg-secondary/50 border-border"
              />
              <Input
                type="date"
                value={djepDate}
                onChange={(e) => setDjepDate(e.target.value)}
                className="sm:w-44 bg-secondary/50 border-border"
              />
              <Button onClick={runDjepLookup} disabled={djepLoading}>
                {djepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {djepLoading ? "Searching..." : "Search DJEP"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="DJEP Event ID or paste DJEP URL"
                value={djepIdInput}
                onChange={(e) => setDjepIdInput(e.target.value)}
                className="flex-1 bg-secondary/50 border-border"
              />
              <Button onClick={runDjepLookup} disabled={djepLoading}>
                {djepLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hash className="w-4 h-4" />}
                {djepLoading ? "Fetching..." : "Fetch"}
              </Button>
            </div>
          )}

          {djepNote && (
            <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {djepNote}
            </p>
          )}

          {djepMatches && djepMatches.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                {djepMatches.length} match{djepMatches.length !== 1 ? "es" : ""} — click to load
              </p>
              {djepMatches.map((m) => {
                const eventDateField = m.fields.find((f) => f.label.toLowerCase() === "event date");
                const venueField = m.fields.find((f) => f.label.toLowerCase() === "venue");
                return (
                  <button
                    key={m.djep_id}
                    onClick={() => applyDjepMatch(m)}
                    disabled={loading}
                    className="w-full text-left p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 hover:border-muted-foreground/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-foreground font-medium truncate">{m.title}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                          {eventDateField && <span>Event: {eventDateField.value}</span>}
                          {venueField && <span>Venue: {venueField.value}</span>}
                          <span className="opacity-70">{m.djep_id}</span>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground shrink-0">
                        {Math.round(m.match_score * 100)}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Choose Template */}
      <Card className="mb-6 bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl font-display tracking-wide-custom flex items-center gap-2">
            <span className="text-primary">2.</span> Choose Template
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(TEMPLATE_INFO) as [TemplateType, { name: string; description: string; audience: "internal" | "client" }][]).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setTemplate(key)}
                className={`text-left p-4 rounded-lg border-2 transition-all ${
                  template === key
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary/20 hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <p className={`font-medium text-sm ${template === key ? "text-primary" : "text-foreground"}`}>
                    {info.name}
                  </p>
                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                    info.audience === "client"
                      ? "bg-accent/20 text-accent-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {info.audience === "client" ? "Client-Facing" : "Internal"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{info.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Organization / Brand */}
      <Card className="mb-6 bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl font-display tracking-wide-custom flex items-center gap-2">
            <span className="text-primary">3.</span> Organization
          </CardTitle>
          <CardDescription>
            Choose which brand logo appears on the generated document.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={organization} onValueChange={(v) => setOrganization(v as OrgKey)}>
            <SelectTrigger className="w-full bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(ORG_INFO) as [OrgKey, { name: string }][]).map(([key, info]) => (
                <SelectItem key={key} value={key}>{info.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Step 4: Review */}
      <Card className="mb-6 bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl font-display tracking-wide-custom flex items-center gap-2">
            <span className="text-primary">4.</span> Review Fields
          </CardTitle>
          <CardDescription>
            Check which fields were found in the imported data. Missing fields will export as blanks unless you add them with Manual entry below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Field status report */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {fieldStatus.map((field) => (
              <div
                key={field.key}
                className={`flex items-center gap-2 text-sm px-3 py-2 rounded-md ${
                  field.found
                    ? "bg-primary/5 text-foreground"
                    : "bg-destructive/5 text-muted-foreground"
                }`}
              >
                {field.found ? (
                  <CircleCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                )}
                <span className="font-medium text-xs">{field.label}</span>
                {field.found && (
                  <span className="text-xs text-muted-foreground truncate ml-auto max-w-[140px]">
                    {field.value}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="flex flex-col gap-3 pt-2 border-t border-border/50 sm:flex-row sm:items-center sm:justify-between">
            {missingFields.length === 0 ? (
              <span className="text-primary flex items-center gap-1 text-xs">
                <CircleCheck className="w-3.5 h-3.5" />
                All {fieldStatus.length} fields populated
              </span>
            ) : (
              <span className="text-destructive flex items-center gap-1 text-xs">
                <AlertTriangle className="w-3.5 h-3.5" />
                {missingFields.length} of {fieldStatus.length} fields missing — will appear as blank lines
              </span>
            )}

            {missingFields.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={addManualEntry}>
                Manual entry
              </Button>
            )}
          </div>

          {/* Manual overrides */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-foreground">
                Add or override fields manually
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={runAutocorrect}
                disabled={autocorrectLoading || !manualOverrides.trim()}
              >
                {autocorrectLoading ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                )}
                Clean up entries
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Enter one field per line as <code className="bg-secondary/50 px-1 py-0.5 rounded text-[11px]">Label: Value</code>.
              {missingFields.length > 0 && (
                <> Missing: {missingFields.map(f => f.label).join(", ")}</>
              )}
            </p>
            <Textarea
              ref={manualOverridesRef}
              placeholder={`Event Name: Smith Wedding\nVenue: Baltimore Country Club\nEvent Date: April 24, 2026\nClient: John Smith`}
              value={manualOverrides}
              onChange={(e) => {
                setManualOverrides(e.target.value);
                // Pending corrections reference line indices that may shift on edit.
                if (autocorrectSuggestions) setAutocorrectSuggestions(null);
              }}
              className="bg-secondary/50 border-border font-mono text-sm min-h-[100px]"
            />

            {autocorrectSuggestions && autocorrectSuggestions.length > 0 && (
              <div className="mt-3 border border-border rounded-md bg-secondary/30">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium">
                      {autocorrectSuggestions.length} suggested {autocorrectSuggestions.length === 1 ? "fix" : "fixes"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={dismissAllCorrections}>
                      Dismiss all
                    </Button>
                    <Button type="button" variant="default" size="sm" onClick={applyAllCorrections}>
                      <Check className="w-3.5 h-3.5 mr-1.5" />
                      Apply all
                    </Button>
                  </div>
                </div>
                <ul className="divide-y divide-border">
                  {autocorrectSuggestions.map((c) => (
                    <li key={c.line_index} className="px-3 py-2 flex items-center gap-3">
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-1 font-mono text-xs">
                        <span className="text-muted-foreground line-through truncate">
                          {c.original_label}: {c.original_value}
                        </span>
                        <ArrowRight className="hidden sm:block w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-foreground truncate">
                          {c.corrected_label}: {c.corrected_value}
                        </span>
                      </div>
                      <span className="hidden md:inline text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                        {c.reason}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Dismiss this suggestion"
                          onClick={() => dismissCorrection(c.line_index)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="Apply this suggestion"
                          onClick={() => applyCorrection(c)}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 5: Export */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl font-display tracking-wide-custom flex items-center gap-2">
            <span className="text-primary">5.</span> Export Document
          </CardTitle>
          {missingFields.length > 0 && !sheetData && (
            <CardDescription className="flex items-center gap-1 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
              No data imported — document will have blank fields. You can still export.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="hero" size="sm">
                  {(generating || driveUploading) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                  Export
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-52">
                <DropdownMenuItem onClick={() => generateDocument("preview")}>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateDocument("print")}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print / Save as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateDocument("docx")}>
                  <File className="w-4 h-4 mr-2" />
                  Download DOCX
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateDocument("download")}>
                  <FileText className="w-4 h-4 mr-2" />
                  Download HTML
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportAsPlainText}>
                  <FileText className="w-4 h-4 mr-2" />
                  Download TXT
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportAsCsv}>
                  <Table className="w-4 h-4 mr-2" />
                  Download CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyToClipboard}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy to Clipboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDriveUpload}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload to Google Drive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </CardContent>
      </Card>
    </div>
  );
}
