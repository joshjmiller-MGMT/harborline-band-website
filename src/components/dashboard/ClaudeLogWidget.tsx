import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, Plus, Trash2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
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
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
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
            <p className="text-xs text-muted-foreground mt-1">Synced across all machines via the cloud.</p>
          </div>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>

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
