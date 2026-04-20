import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, Plus, Trash2, ChevronDown, ChevronUp, Loader2, ClipboardPaste, Code2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LogEntry {
  id: string;
  timestamp: string;
  machine: string;
  context: string;
  summary: string;
  next_steps: string;
  tags: string[];
}

export default function ClaudeLogWidget() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [showApi, setShowApi] = useState(false);
  const [pasteJson, setPasteJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [form, setForm] = useState({ machine: "", context: "", summary: "", nextSteps: "", tags: "" });

  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from("claude_log")
      .select("*")
      .order("timestamp", { ascending: false });
    if (error) {
      toast.error("Failed to load log");
    } else {
      setEntries((data || []) as LogEntry[]);
      setLastUpdated(new Date());
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
    const channel = supabase
      .channel("claude_log_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "claude_log" }, () => fetchEntries())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const addEntry = async () => {
    if (!form.summary.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("claude_log").insert({
      machine: form.machine || "Unknown Machine",
      context: form.context,
      summary: form.summary,
      next_steps: form.nextSteps,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
    });
    setSaving(false);
    if (error) {
      toast.error("Failed to save entry");
    } else {
      toast.success("Entry saved");
      setForm({ machine: "", context: "", summary: "", nextSteps: "", tags: "" });
      setShowAdd(false);
    }
  };

  const importJson = async () => {
    if (!pasteJson.trim()) return;
    setSaving(true);
    try {
      const parsed = JSON.parse(pasteJson);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const rows = items.map((it: any) => ({
        machine: it.machine || "Unknown Machine",
        context: it.context || "",
        summary: it.summary || "",
        next_steps: it.next_steps || it.nextSteps || "",
        tags: Array.isArray(it.tags) ? it.tags : (typeof it.tags === "string" ? it.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : []),
        ...(it.timestamp ? { timestamp: it.timestamp } : {}),
      })).filter(r => r.summary);
      if (rows.length === 0) throw new Error("No valid entries found (need at least 'summary')");
      const { error } = await supabase.from("claude_log").insert(rows);
      if (error) throw error;
      toast.success(`Imported ${rows.length} entr${rows.length === 1 ? "y" : "ies"}`);
      setPasteJson("");
      setShowPaste(false);
    } catch (e: any) {
      toast.error(e.message || "Invalid JSON");
    } finally {
      setSaving(false);
    }
  };

  const exportLog = (format: "json" | "md") => {
    if (entries.length === 0) {
      toast.error("No entries to export");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    let blob: Blob;
    let filename: string;
    if (format === "json") {
      blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
      filename = `claude-log-${stamp}.json`;
    } else {
      const md = [
        `# Claude Log Export`,
        `_Exported ${new Date().toLocaleString()} — ${entries.length} entries_`,
        `\nUse this file to update Claude's memory of prior work on the Harborline website.\n`,
        ...entries.map(e => {
          const dt = new Date(e.timestamp);
          return [
            `## ${dt.toLocaleString()} — ${e.machine}${e.context ? ` (${e.context})` : ""}`,
            `**Summary:** ${e.summary}`,
            e.next_steps ? `\n**Next Steps:** ${e.next_steps}` : "",
            e.tags?.length ? `\n**Tags:** ${e.tags.join(", ")}` : "",
          ].filter(Boolean).join("\n");
        }),
      ].join("\n\n");
      blob = new Blob([md], { type: "text/markdown" });
      filename = `claude-log-${stamp}.md`;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${entries.length} entries as ${format.toUpperCase()}`);
  };

  const deleteEntry = async (id: string) => {
    const { error } = await supabase.from("claude_log").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else setExpanded(null);
  };

  return (
    <Card className="border-border">
      <CardContent className="pt-6">
        <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-display text-xl tracking-wide-custom text-foreground flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" /> Claude Log
            </h2>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
              <span>Synced across all machines via the cloud.</span>
              <span className="text-foreground/80">
                · {entries.length} {entries.length === 1 ? "entry" : "entries"}
              </span>
              {lastUpdated && (
                <span className="inline-flex items-center gap-1">
                  ·
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  last updated {lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => exportLog("md")} disabled={entries.length === 0} title="Download as Markdown (best for feeding to Claude)">
              <Download className="w-4 h-4 mr-1" /> Export .md
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportLog("json")} disabled={entries.length === 0} title="Download as JSON (re-importable)">
              <Download className="w-4 h-4 mr-1" /> Export .json
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowApi(!showApi); setShowAdd(false); setShowPaste(false); }}>
              <Code2 className="w-4 h-4 mr-1" /> API
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowPaste(!showPaste); setShowAdd(false); setShowApi(false); }}>
              <ClipboardPaste className="w-4 h-4 mr-1" /> Paste JSON
            </Button>
            <Button size="sm" onClick={() => { setShowAdd(!showAdd); setShowPaste(false); setShowApi(false); }}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </div>

        {showApi && (
          <Card className="mb-4 border-primary/40">
            <CardContent className="pt-4">
              <p className="text-xs uppercase tracking-widest text-primary mb-2">Auto-Update via API</p>
              <p className="text-xs text-muted-foreground mb-3">
                Claude (or any script) can POST entries directly to the log. No auth header needed — the table allows public inserts within the team portal pattern.
              </p>
              <pre className="text-xs bg-muted text-foreground p-3 rounded overflow-x-auto whitespace-pre">{`curl -X POST '${import.meta.env.VITE_SUPABASE_URL}/rest/v1/claude_log' \\
  -H 'apikey: ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}' \\
  -H 'Authorization: Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}' \\
  -H 'Content-Type: application/json' \\
  -H 'Prefer: return=minimal' \\
  -d '{
    "machine": "Claude Code CLI",
    "context": "Harborline website",
    "summary": "What was worked on...",
    "next_steps": "Pick up here next...",
    "tags": ["claude", "auto"]
  }'`}</pre>
              <p className="text-xs text-muted-foreground mt-3">
                Tell Claude: "After each session, POST a summary entry to my Claude Log using the curl above." Realtime sync means it appears here instantly.
              </p>
              <div className="flex justify-end mt-3">
                <Button variant="outline" size="sm" onClick={() => setShowApi(false)}>Close</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {showPaste && (
          <Card className="mb-4 border-primary/40">
            <CardContent className="pt-4">
              <p className="text-xs uppercase tracking-widest text-primary mb-2">Import JSON</p>
              <p className="text-xs text-muted-foreground mb-3">
                Paste a single entry or an array. Required: <code className="text-foreground">summary</code>. Optional: <code className="text-foreground">machine, context, next_steps, tags, timestamp</code>.
              </p>
              <Textarea
                rows={10}
                value={pasteJson}
                onChange={e => setPasteJson(e.target.value)}
                placeholder={`{\n  "machine": "Claude Code CLI",\n  "context": "Harborline website",\n  "summary": "Refactored Claude Log into dashboard widget",\n  "next_steps": "Add teammate view mode",\n  "tags": ["claude", "dashboard"]\n}`}
                className="font-mono text-xs"
              />
              <div className="flex gap-2 justify-end mt-3">
                <Button variant="outline" size="sm" onClick={() => { setShowPaste(false); setPasteJson(""); }}>Cancel</Button>
                <Button size="sm" onClick={importJson} disabled={saving || !pasteJson.trim()}>
                  {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Import
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {showAdd && (
          <Card className="mb-4 border-primary/40">
            <CardContent className="pt-4">
              <p className="text-xs uppercase tracking-widest text-primary mb-3">New Entry</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><Label className="text-xs text-muted-foreground mb-1 block">Machine</Label><Input value={form.machine} onChange={e => setForm(f => ({...f, machine: e.target.value}))} placeholder="e.g. Home iMac" /></div>
                <div><Label className="text-xs text-muted-foreground mb-1 block">Context</Label><Input value={form.context} onChange={e => setForm(f => ({...f, context: e.target.value}))} placeholder="e.g. Admin build" /></div>
              </div>
              <div className="mb-3"><Label className="text-xs text-muted-foreground mb-1 block">Summary</Label><Textarea rows={3} value={form.summary} onChange={e => setForm(f => ({...f, summary: e.target.value}))} placeholder="What was worked on..." /></div>
              <div className="mb-3"><Label className="text-xs text-muted-foreground mb-1 block">Next Steps</Label><Textarea rows={2} value={form.nextSteps} onChange={e => setForm(f => ({...f, nextSteps: e.target.value}))} placeholder="What to pick up next..." /></div>
              <div className="mb-3"><Label className="text-xs text-muted-foreground mb-1 block">Tags</Label><Input value={form.tags} onChange={e => setForm(f => ({...f, tags: e.target.value}))} placeholder="website, admin" /></div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button size="sm" onClick={addEntry} disabled={saving}>
                  {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-10 text-muted-foreground">
            <Loader2 className="w-6 h-6 mx-auto animate-spin opacity-50" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No log entries yet.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {entries.map(entry => {
              const isOpen = expanded === entry.id;
              const dt = new Date(entry.timestamp);
              return (
                <Card key={entry.id} className={`cursor-pointer transition-colors ${isOpen ? "border-primary/50" : "border-border"}`} onClick={() => setExpanded(isOpen ? null : entry.id)}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{entry.machine}</span>
                          {entry.context && <span className="text-xs text-muted-foreground">{entry.context}</span>}
                          <span className="text-xs text-muted-foreground ml-auto">{dt.toLocaleDateString()} {dt.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span>
                        </div>
                        <p className={`text-sm text-foreground ${isOpen ? "" : "truncate"}`}>{entry.summary}</p>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    </div>
                    {isOpen && (
                      <div className="mt-3 pt-3 border-t border-border space-y-3">
                        {entry.next_steps && (
                          <div>
                            <p className="text-xs uppercase tracking-widest text-primary mb-1">Next Steps</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{entry.next_steps}</p>
                          </div>
                        )}
                        {entry.tags && entry.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {entry.tags.map((t, i) => <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{t}</span>)}
                          </div>
                        )}
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive text-xs" onClick={e => { e.stopPropagation(); deleteEntry(entry.id); }}>
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
