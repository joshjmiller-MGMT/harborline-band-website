import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Phone,
  RefreshCw,
  ExternalLink,
  Settings as SettingsIcon,
  ChevronDown,
  Save,
} from "lucide-react";
import { toast } from "sonner";

type Item = {
  id: string;
  rowIndex: number;
  name: string;
  status: string;
  type: string;
  notes: string;
  link: string;
  lastContact: string;
  nextFollowup: string;
  nextFollowupDate: string | null;
  kind: "reachout" | "followup" | "unknown";
};

type Config = {
  id: string;
  enabled: boolean;
  sheet_id: string;
  tab_gid: string;
  sheet_url: string;
  status_col: string;
  name_col: string;
  next_followup_col: string;
  last_contact_col: string;
  notes_col: string;
  link_col: string;
  type_col: string;
  reachout_values: string;
  followup_values: string;
  color: string;
};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function ItemList({ items, sheetFallbackUrl }: { items: Item[]; sheetFallbackUrl: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing here yet.</p>;
  }
  return (
    <ul className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
      {items.map((it) => (
        <li key={it.id}>
          <a
            href={it.link || sheetFallbackUrl}
            target="_blank"
            rel="noreferrer"
            className="group flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 mt-0.5 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground truncate">
                {it.name}
                {it.type && <span className="text-muted-foreground"> · {it.type}</span>}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {it.status && <span>{it.status}</span>}
                {it.nextFollowupDate && (
                  <>
                    {it.status ? " · " : ""}
                    Next: {it.nextFollowupDate}
                  </>
                )}
                {!it.nextFollowupDate && it.lastContact && (
                  <>
                    {it.status ? " · " : ""}
                    Last: {it.lastContact}
                  </>
                )}
              </p>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function BookingAgentWidget() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [reachouts, setReachouts] = useState<Item[]>([]);
  const [followups, setFollowups] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("reachouts");

  const loadConfig = useCallback(async () => {
    const { data } = await supabase
      .from("booking_agent_config")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    if (data) {
      setConfig(data as Config);
      setDraft(data as Config);
    }
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("booking-agent-rows");
      if (error) throw error;
      const d = data as any;
      if (d?.error) setError(d.error);
      setReachouts((d?.reachouts || []) as Item[]);
      setFollowups((d?.followups || []) as Item[]);
      setRefreshedAt(new Date());
    } catch (e) {
      console.error("BookingAgentWidget load error", e);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadRows();
    const t = setInterval(loadRows, REFRESH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [loadConfig, loadRows]);

  const saveConfig = async () => {
    if (!draft) return;
    const { id, ...patch } = draft;
    const { error } = await supabase
      .from("booking_agent_config")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", "default");
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Booking Agent config saved");
    await loadConfig();
    await loadRows();
  };

  const total = reachouts.length + followups.length;
  const sheetFallbackUrl = config?.sheet_url || "";

  return (
    <Card className="bg-card/50 border-border">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <CardTitle className="font-display text-lg tracking-wide-custom flex items-center gap-2 text-foreground">
              <Phone className="w-5 h-5 text-amber-500" />
              Booking Agent
              {total > 0 && (
                <Badge variant="outline" className="ml-1">{total}</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={(ev) => { ev.stopPropagation(); setShowSettings((v) => !v); }}
                title="Settings"
              >
                <SettingsIcon className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(ev) => { ev.stopPropagation(); loadRows(); }}
                disabled={loading}
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            {refreshedAt && (
              <p className="text-xs text-muted-foreground mb-3">
                Updated {refreshedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
            )}

            {error && (
              <div className="mb-3 p-2 rounded text-xs bg-destructive/10 text-destructive border border-destructive/30">
                {error}
              </div>
            )}

            {showSettings && draft && (
              <div className="mb-4 p-3 border rounded space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Sheet Configuration</h4>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Enabled</Label>
                    <Switch
                      checked={draft.enabled}
                      onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Sheet must be set to <strong>Anyone with the link can view</strong>. Column refs
                  accept either a letter (e.g. <code>C</code>) or a header name (e.g. <code>Status</code>).
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs">Sheet ID</Label>
                    <Input
                      value={draft.sheet_id}
                      onChange={(e) => setDraft({ ...draft, sheet_id: e.target.value })}
                      placeholder="1ljSJ-58Wq…"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Tab gid <span className="text-muted-foreground">(optional)</span></Label>
                    <Input
                      value={draft.tab_gid}
                      onChange={(e) => setDraft({ ...draft, tab_gid: e.target.value })}
                      placeholder="2099086399"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Color</Label>
                    <Input
                      type="color"
                      value={draft.color}
                      onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Name column *</Label>
                    <Input
                      value={draft.name_col}
                      onChange={(e) => setDraft({ ...draft, name_col: e.target.value })}
                      placeholder="A or 'Contact Name'"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Status column</Label>
                    <Input
                      value={draft.status_col}
                      onChange={(e) => setDraft({ ...draft, status_col: e.target.value })}
                      placeholder="C or 'Status'"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Next Followup Date *</Label>
                    <Input
                      value={draft.next_followup_col}
                      onChange={(e) => setDraft({ ...draft, next_followup_col: e.target.value })}
                      placeholder="E or 'Next Followup'"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Last Contact</Label>
                    <Input
                      value={draft.last_contact_col}
                      onChange={(e) => setDraft({ ...draft, last_contact_col: e.target.value })}
                      placeholder="D or 'Last Contact'"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Type column</Label>
                    <Input
                      value={draft.type_col}
                      onChange={(e) => setDraft({ ...draft, type_col: e.target.value })}
                      placeholder="B or 'Type'"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Link column</Label>
                    <Input
                      value={draft.link_col}
                      onChange={(e) => setDraft({ ...draft, link_col: e.target.value })}
                      placeholder="F or 'Link'"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Notes column</Label>
                    <Input
                      value={draft.notes_col}
                      onChange={(e) => setDraft({ ...draft, notes_col: e.target.value })}
                      placeholder="G or 'Notes'"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Reachout statuses <span className="text-muted-foreground">(comma-sep)</span></Label>
                    <Input
                      value={draft.reachout_values}
                      onChange={(e) => setDraft({ ...draft, reachout_values: e.target.value })}
                      placeholder="cold, new, no reply"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Follow-up statuses <span className="text-muted-foreground">(comma-sep)</span></Label>
                    <Input
                      value={draft.followup_values}
                      onChange={(e) => setDraft({ ...draft, followup_values: e.target.value })}
                      placeholder="awaiting reply, in convo"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={saveConfig}>
                    <Save className="w-4 h-4 mr-1" /> Save
                  </Button>
                </div>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="reachouts" className="text-xs">
                  Reachouts
                  {reachouts.length > 0 && (
                    <Badge variant="outline" className="ml-1.5 h-4 px-1.5 text-[10px]">
                      {reachouts.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="followups" className="text-xs">
                  Follow-ups
                  {followups.length > 0 && (
                    <Badge variant="outline" className="ml-1.5 h-4 px-1.5 text-[10px]">
                      {followups.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="reachouts" className="mt-4">
                {loading && reachouts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <ItemList items={reachouts} sheetFallbackUrl={sheetFallbackUrl} />
                )}
              </TabsContent>
              <TabsContent value="followups" className="mt-4">
                {loading && followups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <ItemList items={followups} sheetFallbackUrl={sheetFallbackUrl} />
                )}
              </TabsContent>
            </Tabs>

            {!config?.enabled && (
              <p className="mt-3 text-xs text-muted-foreground">
                Booking Agent is disabled. Open Settings to enable and configure your sheet.
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
