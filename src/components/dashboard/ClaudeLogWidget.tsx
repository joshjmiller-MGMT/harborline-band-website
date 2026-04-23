import { useState, useEffect } from "react";
import { Bot, Plus, Download, Upload, RefreshCw, Code } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface ClaudeLogEntry {
  id: string;
  session_id: string;
  date: string;
  title: string;
  type: string;
  topics: string[];
  tools_used: string[];
  files_created: string[];
  summary: string;
  key_decisions: string[];
  loose_ends: string[];
  created_at: string;
}

export default function ClaudeLogWidget() {
  const [entries, setEntries] = useState<ClaudeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [copied, setCopied] = useState<"json" | "md" | null>(null);
  const [form, setForm] = useState({
    title: "",
    date: "",
    summary: "",
    loose_ends: "",
    topics: "",
    type: "Cowork",
  });

  const fetchEntries = async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from("claude_log")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (err) {
      setError(`Could not load from Supabase: ${err.message}`);
    } else {
      setEntries(data as ClaudeLogEntry[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const lastUpdated = entries[0]
    ? new Date(entries[0].created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const addEntry = async () => {
    if (!form.title.trim() || !form.summary.trim()) return;
    const { error: err } = await supabase.from("claude_log").insert({
      session_id: `manual_${Date.now()}`,
      date: form.date || new Date().toISOString().split("T")[0],
      title: form.title,
      type: form.type,
      summary: form.summary,
      topics: form.topics
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      tools_used: [],
      files_created: [],
      key_decisions: [],
      loose_ends: form.loose_ends
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    if (!err) {
      setForm({ title: "", date: "", summary: "", loose_ends: "", topics: "", type: "Cowork" });
      setShowAdd(false);
      fetchEntries();
    }
  };

  const importEntries = async () => {
    try {
      const parsed = JSON.parse(pasteText) as ClaudeLogEntry[];
      if (!Array.isArray(parsed)) throw new Error();
      const existingIds = new Set(entries.map((e) => e.id));
      const toInsert = parsed
        .filter((e) => !existingIds.has(e.id))
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ id: _id, created_at: _ca, ...rest }) => rest);
      if (toInsert.length === 0) {
        setPasteError("No new entries to import.");
        return;
      }
      const { error: err } = await supabase.from("claude_log").insert(toInsert);
      if (err) {
        setPasteError(err.message);
        return;
      }
      setPasteText("");
      setShowPaste(false);
      setPasteError("");
      fetchEntries();
    } catch {
      setPasteError("Invalid JSON — paste the exported log.");
    }
  };

  const exportJson = () => {
    navigator.clipboard.writeText(JSON.stringify(entries, null, 2));
    setCopied("json");
    setTimeout(() => setCopied(null), 2000);
  };

  const exportMd = () => {
    const md = entries
      .map(
        (e) =>
          `## ${e.title}\n**Date:** ${e.date}  **Type:** ${e.type || "Cowork"}\n\n${e.summary}` +
          ((e.loose_ends || []).length ? `\n\n**Loose Ends:** ${e.loose_ends.join(", ")}` : "") +
          ((e.topics || []).length ? `\n**Topics:** ${e.topics.join(", ")}` : "") +
          "\n\n---",
      )
      .join("\n\n");
    navigator.clipboard.writeText(`# Claude Log\n\n${md}`);
    setCopied("md");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold tracking-wide">Claude Log</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Synced across all machines via the cloud.
            {!loading && (
              <>
                {" · "}
                <span className="text-foreground font-medium">
                  {entries.length} {entries.length === 1 ? "entry" : "entries"}
                </span>
                {lastUpdated && (
                  <>
                    {" "}
                    · last updated <span className="text-foreground">{lastUpdated}</span>
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <button
          onClick={fetchEntries}
          className="text-muted-foreground hover:text-foreground transition-colors mt-1"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={exportMd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent transition-colors"
        >
          <Download className="w-3 h-3" />
          {copied === "md" ? "Copied!" : "Export .md"}
        </button>
        <button
          onClick={exportJson}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent transition-colors"
        >
          <Download className="w-3 h-3" />
          {copied === "json" ? "Copied!" : "Export .json"}
        </button>
        <a
          href={`${SUPABASE_URL}/rest/v1/claude_log?select=*&order=date.desc&apikey=${SUPABASE_KEY}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent transition-colors"
        >
          <Code className="w-3 h-3" />
          API
        </a>
        <button
          onClick={() => {
            setShowPaste(!showPaste);
            setShowAdd(false);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent transition-colors"
        >
          <Upload className="w-3 h-3" />
          Paste JSON
        </button>
        <button
          onClick={() => {
            setShowAdd(!showAdd);
            setShowPaste(false);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchEntries} className="underline ml-2 shrink-0">
            Retry
          </button>
        </div>
      )}

      {/* Paste JSON panel */}
      {showPaste && (
        <div className="border border-border rounded-lg p-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">Paste exported JSON to merge entries:</p>
          <textarea
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              setPasteError("");
            }}
            rows={5}
            placeholder='[{"id":"...","date":"...","title":"...","summary":"..."}]'
            className="w-full text-xs font-mono bg-background border border-border rounded-md p-2 resize-y focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {pasteError && <p className="text-xs text-destructive">{pasteError}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowPaste(false);
                setPasteError("");
              }}
              className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={importEntries}
              className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
            >
              Merge Entries
            </button>
          </div>
        </div>
      )}

      {/* Add entry panel */}
      {showAdd && (
        <div className="border border-primary/30 rounded-lg p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">New Entry</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Session title"
                className="text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option>Cowork</option>
                <option>Manual</option>
                <option>Note</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Topics</label>
              <input
                value={form.topics}
                onChange={(e) => setForm((f) => ({ ...f, topics: e.target.value }))}
                placeholder="github, admin, ..."
                className="text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">Summary</label>
            <textarea
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              rows={3}
              placeholder="What was worked on..."
              className="text-xs bg-background border border-border rounded-md px-2 py-1.5 resize-y focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">Loose Ends</label>
            <input
              value={form.loose_ends}
              onChange={(e) => setForm((f) => ({ ...f, loose_ends: e.target.value }))}
              placeholder="What to pick up next time..."
              className="text-xs bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={addEntry}
              className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
            >
              Save Entry
            </button>
          </div>
        </div>
      )}

      {/* Entry list */}
      <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto pr-1">
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-8">Loading from Supabase...</p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No log entries yet.</p>
        ) : (
          entries.map((entry) => {
            const isOpen = expanded === entry.id;
            const looseEnds = entry.loose_ends || [];
            const topics = entry.topics || [];
            return (
              <div
                key={entry.id}
                onClick={() => setExpanded(isOpen ? null : entry.id)}
                className={`border rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                  isOpen ? "border-primary/50 bg-primary/5" : "border-border hover:border-border/80 hover:bg-accent/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {entry.type || "Cowork"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{entry.date}</span>
                    </div>
                    <p className={`text-sm font-medium text-foreground ${isOpen ? "" : "truncate"}`}>{entry.title}</p>
                    <p className={`text-xs text-muted-foreground mt-0.5 ${isOpen ? "" : "truncate"}`}>
                      {isOpen ? entry.summary : entry.summary?.slice(0, 100)}
                    </p>
                  </div>
                  {looseEnds.length > 0 && !isOpen && (
                    <span className="shrink-0 text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-medium">
                      {looseEnds.length} loose end{looseEnds.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2">
                    {looseEnds.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">
                          Loose Ends
                        </p>
                        <ul className="flex flex-col gap-0.5">
                          {looseEnds.map((s, i) => (
                            <li key={i} className="text-xs text-muted-foreground">
                              → {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {topics.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {topics.map((t, i) => (
                          <span key={i} className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {(entry.tools_used || []).length > 0 && (
                      <p className="text-[10px] text-muted-foreground">Tools: {entry.tools_used.join(", ")}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
