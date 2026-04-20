import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Building2,
  RefreshCw,
  ExternalLink,
  Settings as SettingsIcon,
  Save,
  Search,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Info,
} from "lucide-react";
import { toast } from "sonner";

type VenueRow = { id: string; rowIndex: number; fields: Record<string, string> };

type Config = {
  id: string;
  sheet_id: string;
  sheet_url: string;
  venue_tab_gid: string;
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// Canonical columns shown in the table. Matched case-insensitively against headers.
const COMM_COLUMNS = [
  { key: "venue", label: "Venue / Festival", aliases: ["venue", "venue / festival", "venue/festival", "name", "festival", "place"] },
  { key: "responded", label: "Responded?", aliases: ["responded?", "responded", "response", "reply"] },
  { key: "status", label: "Contact Status", aliases: ["contact status", "status"] },
  { key: "lastContacted", label: "Last Contacted", aliases: ["last contacted", "last contact", "last reached"] },
  { key: "nextAction", label: "Next Action", aliases: ["next action", "next step", "follow-up", "followup"] },
  { key: "nextActionDate", label: "Next Action Date", aliases: ["next action date", "next followup date", "next follow-up date", "follow up date", "due"] },
] as const;

type CommKey = typeof COMM_COLUMNS[number]["key"];

function matchHeader(headers: string[], aliases: readonly string[]): string | null {
  const lowerMap = headers.map((h) => (h || "").trim().toLowerCase());
  for (const alias of aliases) {
    const i = lowerMap.indexOf(alias);
    if (i >= 0) return headers[i];
  }
  return null;
}

function statusTone(status: string): { bg: string; text: string; icon: typeof Circle } {
  const s = status.trim().toLowerCase();
  if (!s) return { bg: "bg-muted/40", text: "text-muted-foreground", icon: Circle };
  if (s.includes("book")) return { bg: "bg-emerald-500/15", text: "text-emerald-400", icon: CheckCircle2 };
  if (s.includes("submit") || s.includes("applied")) return { bg: "bg-blue-500/15", text: "text-blue-400", icon: Clock };
  if (s.includes("wait") || s.includes("pending")) return { bg: "bg-amber-500/15", text: "text-amber-400", icon: Clock };
  if (s.includes("reject") || s.includes("declin") || s.includes("pass")) return { bg: "bg-destructive/15", text: "text-destructive", icon: AlertTriangle };
  return { bg: "bg-primary/15", text: "text-primary", icon: Circle };
}

function respondedTone(value: string): { label: string; cls: string } {
  const v = value.trim().toLowerCase();
  if (!v) return { label: "—", cls: "text-muted-foreground" };
  if (["yes", "y", "true", "✓", "x"].includes(v)) return { label: "Yes", cls: "text-emerald-400" };
  if (["no", "n", "false"].includes(v)) return { label: "No", cls: "text-destructive" };
  return { label: value, cls: "text-foreground/80" };
}

export default function VenueFestivalTrackerWidget() {
  const [rows, setRows] = useState<VenueRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sheetUrl, setSheetUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [detailRow, setDetailRow] = useState<VenueRow | null>(null);

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

  // Map our canonical columns to actual header strings present on the sheet
  const headerMap = useMemo(() => {
    const map: Partial<Record<CommKey, string>> = {};
    for (const c of COMM_COLUMNS) {
      const m = matchHeader(headers, c.aliases);
      if (m) map[c.key] = m;
    }
    return map;
  }, [headers]);

  // First non-empty header — used as a fallback "venue" label so we always
  // have *something* to show even if header naming is unusual.
  const firstHeader = useMemo(() => headers.find((h) => (h || "").trim()) || "", [headers]);

  const get = (r: VenueRow, key: CommKey): string => {
    const h = headerMap[key];
    if (h) return (r.fields[h] || "").trim();
    if (key === "venue" && firstHeader) {
      return (r.fields[firstHeader] || "").trim();
    }
    return "";
  };

  // Show every row from the sheet — do NOT filter by date/status/etc.
  const allRows = rows;

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => {
      const s = get(r, "status");
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [allRows, headerMap]);

  const filtered = useMemo(() => {
    let list = allRows;
    if (statusFilter !== "all") {
      list = list.filter((r) => get(r, "status").toLowerCase() === statusFilter.toLowerCase());
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        Object.values(r.fields).join(" ").toLowerCase().includes(q),
      );
    }
    return list;
  }, [allRows, statusFilter, search, headerMap]);

  // Headers shown inside the popout card as "other details" (everything that
  // isn't already one of the 6 main columns and isn't empty for that row).
  const mainHeaderSet = useMemo(() => {
    const s = new Set<string>();
    Object.values(headerMap).forEach((h) => h && s.add(h));
    return s;
  }, [headerMap]);

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="font-display text-lg tracking-wide-custom flex items-center gap-2 text-foreground">
          <Building2 className="w-5 h-5 text-primary" />
          Venue &amp; Festival Tracker
          {allRows.length > 0 && <Badge variant="outline" className="ml-1">{allRows.length}</Badge>}
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
            Mirroring the <strong>Venue &amp; Festival Tracker</strong> tab · Updated{" "}
            {refreshedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            {config?.venue_tab_gid && <> · gid {config.venue_tab_gid}</>}
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
            {headers.length > 0 && (
              <div className="pt-2 border-t border-border/40">
                <p className="text-[11px] text-muted-foreground mb-1">Detected headers on this tab:</p>
                <div className="flex flex-wrap gap-1">
                  {headers.filter(Boolean).map((h) => (
                    <Badge key={h} variant="outline" className="text-[10px]">{h}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {allRows.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search venues, notes…"
                className="pl-8 h-9"
              />
            </div>
            {statusOptions.length > 0 && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="all">All statuses</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {loading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {allRows.length === 0
              ? "No venues yet. Configure the Venue & Festival Tracker tab gid in Settings."
              : "No matches for that filter."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-border/40">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {COMM_COLUMNS.map((c) => (
                    <th key={c.key} className="text-left px-3 py-2 font-display tracking-wide-custom text-xs text-muted-foreground whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const status = get(r, "status");
                  const tone = statusTone(status);
                  const StatusIcon = tone.icon;
                  const responded = respondedTone(get(r, "responded"));
                  const nextDate = get(r, "nextActionDate");
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-border/30 hover:bg-muted/20 align-top cursor-pointer"
                      onClick={() => setDetailRow(r)}
                    >
                      <td className="px-3 py-2 text-foreground font-medium">
                        {get(r, "venue") || <span className="text-muted-foreground italic">(unnamed row {r.rowIndex})</span>}
                      </td>
                      <td className={`px-3 py-2 text-xs ${responded.cls}`}>
                        {responded.label}
                      </td>
                      <td className="px-3 py-2">
                        {status ? (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs ${tone.bg} ${tone.text}`}>
                            <StatusIcon className="w-3 h-3" />
                            {status}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-foreground/80 text-xs whitespace-nowrap">
                        {get(r, "lastContacted") || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2 text-foreground/90">
                        <span className="line-clamp-2">{get(r, "nextAction") || <span className="text-muted-foreground">—</span>}</span>
                      </td>
                      <td className="px-3 py-2 text-foreground/80 text-xs whitespace-nowrap">
                        {nextDate ? (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-primary" />
                            {nextDate}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <Info className="w-4 h-4" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Popout details card */}
        <Dialog open={!!detailRow} onOpenChange={(open) => !open && setDetailRow(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {detailRow && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    {get(detailRow, "venue") || `Row ${detailRow.rowIndex}`}
                  </DialogTitle>
                  <DialogDescription>
                    All fields from the Venue &amp; Festival Tracker · row {detailRow.rowIndex}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                  {/* Main 6 columns */}
                  <div className="grid grid-cols-2 gap-3">
                    {COMM_COLUMNS.filter((c) => c.key !== "venue").map((c) => {
                      const val = get(detailRow, c.key);
                      return (
                        <div key={c.key} className="p-2 rounded border border-border/40 bg-muted/20">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{c.label}</div>
                          <div className="text-sm text-foreground">{val || <span className="text-muted-foreground">—</span>}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* All other columns */}
                  {headers.filter((h) => h && !mainHeaderSet.has(h) && h !== firstHeader).length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2">Other details</div>
                      <div className="space-y-2">
                        {headers
                          .filter((h) => h && !mainHeaderSet.has(h) && h !== firstHeader)
                          .map((h) => {
                            const val = (detailRow.fields[h] || "").trim();
                            return (
                              <div key={h} className="flex gap-3 text-sm border-b border-border/20 pb-1.5">
                                <div className="w-1/3 text-muted-foreground text-xs pt-0.5">{h}</div>
                                <div className="flex-1 text-foreground/90 whitespace-pre-wrap break-words">
                                  {val || <span className="text-muted-foreground italic">empty</span>}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {sheetUrl && (
                    <div className="pt-2 border-t border-border/30">
                      <Button variant="outline" size="sm" asChild>
                        <a href={sheetUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-4 h-4 mr-1" /> Open in Google Sheets
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
