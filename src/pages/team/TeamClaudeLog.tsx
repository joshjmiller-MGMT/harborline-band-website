TEST_INJECTIONimport { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://uqrpshzgonoopcwjglzl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxcnBzaHpnb25vb3Bjd2pnbHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NTc5NDUsImV4cCI6MjA5MjAzMzk0NX0.MI0M8Cwz3gdnePHxnAJHoeBV1gxfvP0LOwhCRcY8sm8";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface LogEntry {
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
        .order("date", { ascending: false });
      if (error) setError(error.message);
      else setEntries(data || []);
      setLoading(false);
    };
    fetchLog();
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Claude log...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Claude Activity Log</h1>
        <p className="text-gray-500 mt-1">{entries.length} sessions logged · Auto-synced via Cowork</p>
      </div>
      <div className="space-y-6">
        {entries.map((entry) => (
          <div key={entry.id} className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h2 className="text-lg font-semibold text-gray-800">{entry.title}</h2>
              <span className="text-sm text-gray-400 whitespace-nowrap">{entry.date}</span>
            </div>
            {entry.topics?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {entry.topics.map((t) => (
                  <span key={t} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            )}
            <p className="text-gray-600 text-sm leading-relaxed mb-4">{entry.summary}</p>
            {entry.key_decisions?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Key Outcomes</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {entry.key_decisions.map((d, i) => (
                    <li key={i} className="text-sm text-gray-600">{d}</li>
                  ))}
                </ul>
              </div>
            )}
            {entry.loose_ends?.filter((l) => l && l !== "None").length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Follow-ups</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {entry.loose_ends.filter((l) => l && l !== "None").map((l, i) => (
                    <li key={i} className="text-sm text-amber-700">{l}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeamClaudeLog;
