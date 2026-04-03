import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Download, Loader2, ExternalLink, AlertCircle, Music, Clock, Users, MapPin, CalendarDays, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import logoCircle from "@/assets/logo-circle.png";
import logoText from "@/assets/logo-text.png";

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

  useEffect(() => {
    Promise.all([imageToBase64(logoCircle), imageToBase64(logoText)])
      .then(([circle, text]) => setLogosBase64({ circle, text }))
      .catch(() => console.warn("Failed to preload logos"));
  }, []);

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

  const fetchData = async () => {
    if (!inputUrl.trim()) {
      toast({ title: "Missing URL", description: "Please paste a URL to import.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setParsedData(null);
    setSourceType(detectUrlType(inputUrl));
    try {
      // For Google Sheets, also send sheetId for backward compatibility
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

      // Parse to show preview
      const { data: genData, error: genError } = await supabase.functions.invoke("generate-run-of-show", {
        body: { sheetData: data, template, format: "html", logos: logosBase64 },
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

  const generateDocument = async (format: "html" | "print") => {
    if (!sheetData) return;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-run-of-show", {
        body: { sheetData, template, format: "html", logos: logosBase64 },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.file) throw new Error("No document was returned.");

      const html = decodeBase64Utf8(data.file);

      if (format === "print") {
        // Extract the original <style> and <head> content, then wrap body in dark background
        const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
        const originalStyles = styleMatch ? styleMatch[1] : '';
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
        const bodyContent = bodyMatch ? bodyMatch[1] : html;
        
        const wrappedHtml = `<!DOCTYPE html><html lang="en"><head>
          <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            ${originalStyles}
            html, body { margin: 0; padding: 0; background: #1a1a1a; min-height: 100vh; }
            .page-shell { max-width: 780px; margin: 40px auto; background: white; box-shadow: 0 4px 40px rgba(0,0,0,0.5); border-radius: 4px; overflow: hidden; padding: 0; }
            @media print { html, body { background: white; } .page-shell { margin: 0; box-shadow: none; border-radius: 0; max-width: none; } }
          </style>
        </head><body><div class="page-shell">${bodyContent}</div></body></html>`;
        const newWindow = window.open("", "_blank");
        if (newWindow) {
          newWindow.document.write(wrappedHtml);
          newWindow.document.close();
        }
      } else {
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${data.filename || "run-of-show"}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast({ title: "Document generated!", description: format === "print" ? "Opened in new tab." : "HTML file downloaded." });
    } catch (err: any) {
      toast({
        title: "Generation failed",
        description: err.message || "Something went wrong generating the document.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const totalSongs = parsedData?.songSections.reduce((sum, s) => sum + s.songs.length, 0) || 0;

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

      {/* Step 1: Google Sheet URL */}
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

          {/* Parsed data preview */}
          {parsedData && (
            <div className="mt-4 space-y-3">
              {/* Event Name */}
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span className="text-foreground font-medium text-sm">
                    Sheet loaded: {sheetData?.sheetTitle || "Untitled"}
                  </span>
                </div>

                {/* Key Details Grid */}
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

                {/* Summary stats */}
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

      {/* Step 3: Export */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl font-display tracking-wide-custom flex items-center gap-2">
            <span className="text-primary">3.</span> Export Document
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!sheetData ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertCircle className="w-4 h-4" />
              Import a Google Sheet first to enable export.
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                onClick={() => generateDocument("html")}
                disabled={generating}
                className="flex-1"
                variant="hero"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download HTML
              </Button>
              <Button
                onClick={() => generateDocument("print")}
                disabled={generating}
                className="flex-1"
                variant="heroOutline"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Print / Save as PDF
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
