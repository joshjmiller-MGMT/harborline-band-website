import { useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, Plus, Download, Upload, Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: string;
  machine: string;
  context: string;
  summary: string;
  nextSteps: string;
  tags: string[];
}

const LOG_KEY = "harborline_claude_log";

export default function TeamClaudeLog() {
  const [entries, setEntries] = useState<LogEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch { return []; }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ machine: "", context: "", summary: "", nextSteps: "", tags: "" });

  const save = (next: LogEntry[]) => {
    setEntries(next);
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
  };

  const addEntry = () => {
    if (!form.summary.trim()) return;
    save([{
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      machine: form.machine || "Unknown Machine",
      context: form.context,
      summary: form.summary,
      nextSteps: form.nextSteps,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
    }, ...entries]);
    setForm({ machine: "", context: "", summary: "", nextSteps: "", tags: "" });
    setShowAdd(false);
  };

  const exportAll = () => {
    navigator.clipboard.writeText(JSON.stringify(entries, null, 2));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const importEntries = () => {
    try {
      const parsed = JSON.parse(importText) as LogEntry[];
      if (!Array.isArray(parsed)) throw new Error();
      const ids = new Set(entries.map(e => e.id));
      const merged = [...parsed.filter(e => !ids.has(e.id)), ...entries];
      merged.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      save(merged);
      setImportText(""); setShowImport(false); setImportError("");
    } catch { setImportError("Invalid JSON — paste the exported log from another machine."); }
  };

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
              <Bot className="w-7 h-7 text-primary" /> Claude Log
            </h1>
            <p className="text-muted-foreground mt-2">Track sessions across machines. Export JSON to sync.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImport(!showImport)}>
              <Upload className="w-4 h-4 mr-1" /> Import
            </Button>
            <Button variant="outline" size="sm" onClick={exportAll}>
              <Download className="w-4 h-4 mr-1" /> {copied ? "Copied!" : "Export JSON"}
            </Button>
            <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="w-4 h-4 mr-1" /> Add Entry
            </Button>
          </div>
        </div>

        {showImport && (
          <Card className="mb-6 border-border">
            <CardContent className="pt-6">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Paste exported JSON from another machine</Label>
              <Textarea value={importText} onChange={e => { setImportText(e.target.value); setImportError(""); }} rows={5} className="font-mono text-sm mb-3" placeholder='[{"id":"..."}]' />
              {importError && <p className="text-destructive text-sm mb-2">{importError}</p>}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setShowImport(false); setImportError(""); }}>Cancel</Button>
                <Button size="sm" onClick={importEntries}>Merge Entries</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {showAdd && (
          <Card className="mb-6 border-primary/40">
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-widest text-primary mb-4">New Log Entry</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><Label className="text-xs text-muted-foreground mb-1 block">Machine / Location</Label><Input value={form.machine} onChange={e => setForm(f => ({...f, machine: e.target.value}))} placeholder="e.g. Home iMac, Work Laptop" /></div>
                <div><Label className="text-xs text-muted-foreground mb-1 block">Project / Context</Label><Input value={form.context} onChange={e => setForm(f => ({...f, context: e.target.value}))} placeholder="e.g. Admin build, site fixes" /></div>
              </div>
              <div className="mb-4"><Label className="text-xs text-muted-foreground mb-1 block">What was worked on</Label><Textarea rows={3} value={form.summary} onChange={e => setForm(f => ({...f, summary: e.target.value}))} placeholder="Summarize what Claude helped with..." /></div>
              <div className="mb-4"><Label className="text-xs text-muted-foreground mb-1 block">Next Steps</Label><Textarea rows={2} value={form.nextSteps} onChange={e => setForm(f => ({...f, nextSteps: e.target.value}))} placeholder="What to pick up next session..." /></div>
              <div className="mb-4"><Label className="text-xs text-muted-foreground mb-1 block">Tags (comma separated)</Label><Input value={form.tags} onChange={e => setForm(f => ({...f, tags: e.target.value}))} placeholder="website, admin, github" /></div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button size="sm" onClick={addEntry}>Save Entry</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {entries.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Bot className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No log entries yet. Add one after each session.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map(entry => {
              const isOpen = expanded === entry.id;
              const dt = new Date(entry.timestamp);
              return (
                <Card key={entry.id} className={`cursor-pointer transition-colors ${isOpen ? "border-primary/50" : "border-border"}`} onClick={() => setExpanded(isOpen ? null : entry.id)}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
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
                      <div className="mt-4 pt-4 border-t border-border space-y-3">
                        {entry.nextSteps && (
                          <div>
                            <p className="text-xs uppercase tracking-widest text-primary mb-1">Next Steps</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{entry.nextSteps}</p>
                          </div>
                        )}
                        {entry.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {entry.tags.map((t, i) => <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{t}</span>)}
                          </div>
                        )}
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive text-xs" onClick={e => { e.stopPropagation(); save(entries.filter(x => x.id !== entry.id)); setExpanded(null); }}>
                          <Trash2 className="w-3 h-3 mr-1" /> Delete Entry
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </TeamLayout>
  );
}
