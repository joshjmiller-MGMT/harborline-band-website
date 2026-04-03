import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type TemplateType = "wedding-ros" | "wedding-planner" | "corporate-ros" | "party-runsheet";

const TEMPLATE_INFO: Record<TemplateType, { name: string; description: string }> = {
  "wedding-ros": {
    name: "Wedding Ceremony Run of Show",
    description: "Formal run of show with event details header, timeline sections, and song lists. Best for day-of musician documents.",
  },
  "wedding-planner": {
    name: "Wedding Ceremony Planner",
    description: "Client-facing template for organizing ceremony music choices. Includes suggested songs and fill-in sections.",
  },
  "corporate-ros": {
    name: "Corporate / Multi-Day Event Run of Show",
    description: "Detailed production run of show with multi-day scheduling, sound/production notes, and logistics.",
  },
  "party-runsheet": {
    name: "Party / Event Run Sheet",
    description: "Comprehensive day-of run sheet with event details, timeline, team roster, songlist by set, and logistics (load-in, parking, arrival).",
  },
};

interface SheetData {
  headers: string[];
  rows: string[][];
  sheetTitle: string;
}

export default function RunOfShowGenerator() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [template, setTemplate] = useState<TemplateType>("wedding-ros");
  const [loading, setLoading] = useState(false);
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [generating, setGenerating] = useState(false);

  const extractSheetId = (url: string): string | null => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  const fetchSheet = async () => {
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      toast({ title: "Invalid URL", description: "Please paste a valid Google Sheets URL.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-google-sheet", {
        body: { sheetId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSheetData(data);
      toast({ title: "Sheet loaded", description: `Found ${data.rows.length} rows of data.` });
    } catch (err: any) {
      toast({
        title: "Failed to fetch sheet",
        description: err.message || "Make sure the sheet is set to 'Anyone with the link can view'.",
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
        body: { sheetData, template, format: "html" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Decode base64 HTML
      const html = atob(data.file);

      if (format === "print") {
        // Open in new tab for viewing / manual print
        const newWindow = window.open("", "_blank");
        if (newWindow) {
          newWindow.document.write(html);
          newWindow.document.close();
        }
      } else {
        // Download as HTML file
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${data.filename || "run-of-show"}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast({ title: "Document generated!", description: format === "print" ? "Print dialog opened in new tab." : "HTML file downloaded." });
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

  return (
    <div className="container mx-auto px-6 py-10 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display tracking-display text-foreground mb-2">
          Run of Show Generator
        </h1>
        <p className="text-muted-foreground">
          Import event data from a Google Sheet and export a branded run of show document.
        </p>
      </div>

      {/* Step 1: Google Sheet URL */}
      <Card className="mb-6 bg-card border-border">
        <CardHeader>
          <CardTitle className="text-xl font-display tracking-wide-custom flex items-center gap-2">
            <span className="text-primary">1.</span> Import Google Sheet
          </CardTitle>
          <CardDescription>
            Paste the URL of your Google Sheet. It must be set to "Anyone with the link can view."
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              className="flex-1 bg-secondary/50 border-border"
            />
            <Button onClick={fetchSheet} disabled={loading || !sheetUrl}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              {loading ? "Fetching..." : "Fetch"}
            </Button>
          </div>

          {sheetData && (
            <div className="mt-4 p-4 rounded-lg bg-secondary/30 border border-border">
              <p className="text-sm text-foreground font-medium mb-1">
                ✅ Sheet loaded: {sheetData.sheetTitle || "Untitled"}
              </p>
              <p className="text-xs text-muted-foreground">
                {sheetData.headers.length} columns · {sheetData.rows.length} rows
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {sheetData.headers.map((h, i) => (
                        <th key={i} className="text-left px-2 py-1 text-muted-foreground font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheetData.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-1 text-foreground/80 truncate max-w-[200px]">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sheetData.rows.length > 5 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Showing first 5 of {sheetData.rows.length} rows
                  </p>
                )}
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
          <Tabs value={template} onValueChange={(v) => setTemplate(v as TemplateType)}>
            <TabsList className="w-full bg-secondary/50 h-auto flex-wrap">
              {Object.entries(TEMPLATE_INFO).map(([key, info]) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="flex-1 min-w-[140px] text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
                >
                  {info.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {Object.entries(TEMPLATE_INFO).map(([key, info]) => (
              <TabsContent key={key} value={key}>
                <div className="p-4 rounded-lg bg-secondary/20 border border-border mt-3">
                  <p className="text-sm text-muted-foreground">{info.description}</p>
                </div>
              </TabsContent>
            ))}
          </Tabs>
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
