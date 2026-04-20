import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, RefreshCw, ExternalLink, Settings as SettingsIcon, Save, Search } from "lucide-react";
import { toast } from "sonner";

type VenueRow = { id: string; rowIndex: number; fields: Record<string, string> };

type Config = {
  id: string;
  sheet_id: string;
  sheet_url: string;
  venue_tab_gid: string;
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export default function VenueFestivalTrackerWidget() {
  const [rows, setRows] = useState<VenueRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sheetUrl, setSheetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [config, setConfig] = useState<Config | null>(null);
  const [draftGid, setDraftGid] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const loadConfig = useCallback(async () => {
    const { data } = await supabase
      .from("booking_agent_config")
      .select("id, sheet_id, sheet_url, venue_tab_gid")
      .eq("id", "default")
      .maybeSingle();
    if (data) {
      setConfig(data as Config);
      setDraftGid((data as Config).venue_tab_gid || "");
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNote(null);
    try {
      const { data, error } = await supabase.functions.invoke("booking-agent-rows", {
        body: { tab: "venue" },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.error) setError(d.error);
      if (d?.note) setNote(d.note);
      setRows((d?.rows || []) as VenueRow[]);
      setHeaders((d?.headers || []) as string[]);
      setSheetUrl(d?.sheetUrl || "");
      setRefreshedAt(new Date());
    } catch (e) {
      console.error("VenueFestivalTrackerWidget load error", e);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    load();
    const t = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [loadConfig, load]);

  const saveGid = async () => {
    const { error } = await supabase
      .from("booking_agent_config")
      .update({ venue_tab_gid: draftGid, updated_at: new Date().toISOString() })
      .eq("id", "default");
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Venue tab saved");
    await loadConfig();
    await load();
  };

  // Choose up to 4 most useful columns to display compactly (first non-empty headers)
  const displayHeaders = headers.filter((h) => h && h.trim()).slice(0, 5);

  const filtered = search.trim()
    ? rows.filter((r) =>
        Object.values(r.fields)
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
    : rows;

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="font-display text-lg tracking-wide-custom flex items-center gap-2 text-foreground">
          <Building2 className="w-5 h-5 text-primary" />
          Venue & Festival Tracker
          {rows.length > 0 && <Badge variant="outline" className="ml-1">{rows.length}</Badge>}
        </CardTitle>
        <div className="flex items-center gap-1">
          {sheetUrl && (
            <Button variant="ghost" size="icon" asChild title="Open sheet">
              <a href={sheetUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings((v) => !v)}
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={load} disabled={loading} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {refreshedAt && (
          <p className="text-xs text-muted-foreground mb-3">
            Updated {refreshedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            {config?.sheet_id && (
              <>
                {" · Sheet "}
                <code className="text-[10px]">{config.sheet_id.slice(0, 12)}…</code>
                {config.venue_tab_gid && <> · gid {config.venue_tab_gid}</>}
              </>
            )}
          </p>
        )}

        {error && (
          <div className="mb-3 p-2 rounded text-xs bg-destructive/10 text-destructive border border-destructive/30">
            {error}
          </div>
        )}
        {note && !error && (
          <div className="mb-3 p-2 rounded text-xs bg-muted/40 text-muted-foreground border border-border">
            {note}
          </div>
        )}

        {showSettings && (
          <div className="mb-4 p-3 border rounded space-y-3 bg-muted/20">
            <h4 className="text-sm font-medium">Venue Tab Configuration</h4>
            <p className="text-[11px] text-muted-foreground">
              Open the JJMM contact spreadsheet, click the <strong>Venue &amp; Festival Tracker</strong> tab,
              and copy the <code>gid=…</code> value from the URL.
            </p>
            <div>
              <Label className="text-xs">Venue tab gid</Label>
              <Input
                value={draftGid}
                onChange={(e) => setDraftGid(e.target.value)}
                placeholder="e.g. 1234567890"
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={saveGid}>
                <Save className="w-4 h-4 mr-1" /> Save
              </Button>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search venues…"
              className="pl-8 h-9"
            />
          </div>
        )}

        {loading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {rows.length === 0
              ? "No rows yet. Configure the venue tab gid in Settings."
              : "No matches for that search."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-border/40">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {displayHeaders.map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 font-display tracking-wide-custom text-xs text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border/30 hover:bg-muted/20">
                    {displayHeaders.map((h) => (
                      <td key={h} className="px-3 py-2 align-top text-foreground/90">
                        <span className="line-clamp-2">{r.fields[h] || "—"}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
