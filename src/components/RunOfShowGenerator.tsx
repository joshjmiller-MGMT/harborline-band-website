import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Download, Loader2, ExternalLink, AlertCircle, Music, Clock, Users, MapPin, CalendarDays, CheckCircle2, AlertTriangle, CircleCheck, Eye, Printer, FileDown, Upload } from "lucide-react";
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
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Add or override fields manually
            </label>
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
              onChange={(e) => setManualOverrides(e.target.value)}
              className="bg-secondary/50 border-border font-mono text-sm min-h-[100px]"
            />
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
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={() => generateDocument("preview")}
              disabled={generating}
              className="flex-1 min-w-[120px]"
              variant="hero"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Preview
            </Button>
            <Button
              onClick={() => generateDocument("print")}
              disabled={generating}
              className="flex-1 min-w-[120px]"
              variant="heroOutline"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Print / PDF
            </Button>
            <Button
              onClick={() => generateDocument("docx")}
              disabled={generating}
              className="flex-1 min-w-[120px]"
              variant="heroOutline"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Download DOCX
            </Button>
            <Button
              onClick={handleDriveUpload}
              disabled={generating || driveUploading}
              className="flex-1 min-w-[120px]"
              variant="heroOutline"
            >
              {driveUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload to Drive
            </Button>
            <Button
              onClick={() => generateDocument("download")}
              disabled={generating}
              className="flex-1 min-w-[120px]"
              variant="outline"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download HTML
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
