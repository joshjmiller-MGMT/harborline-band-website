import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LogEntry {
  id: string;
  timestamp: string;
  machine: string;
  context: string;
  summary: string;
  next_steps: string;
  tags: string[];
}

const TeamClaudeLog = () => {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLog = async () => {
      const { data, error } = await supabase
        .from("claude_log")
        .select("*")
        .order("timestamp", { ascending: false });
      if (error) setError(error.message);
      else setEntries((data || []) as LogEntry[]);
      setLoading(false);
    };
    fetchLog();

    const channel = supabase
      .channel("claude_log_page")
      .on("postgres_changes", { event: "*", schema: "public", table: "claude_log" }, () => fetchLog())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading Claude log...</div>;
  if (error) return <div className="p-8 text-center text-destructive">Error: {error}</div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Claude Activity Log</h1>
        <p className="text-muted-foreground mt-1">{entries.length} sessions logged · Live from Lovable Cloud</p>
      </div>
      <div className="space-y-6">
        {entries.map((entry) => {
          const dt = new Date(entry.timestamp);
          return (
            <div key={entry.id} className="border border-border rounded-xl p-6 bg-card shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h2 className="text-lg font-semibold text-foreground">
                  {entry.machine}{entry.context ? ` — ${entry.context}` : ""}
                </h2>
                <span className="text-sm text-muted-foreground whitespace-nowrap">{dt.toLocaleString()}</span>
              </div>
              {entry.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {entry.tags.map((t) => (
                    <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              )}
              <p className="text-foreground text-sm leading-relaxed mb-4 whitespace-pre-wrap">{entry.summary}</p>
              {entry.next_steps && (
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Next Steps</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.next_steps}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeamClaudeLog;
