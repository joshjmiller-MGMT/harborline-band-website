import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, ExternalLink } from "lucide-react";

type ThreadEntry = {
  threadId: string;
  subject: string;
  sender: string;
  age_days: number;
  web_url: string;
};

type AccountResult = {
  email: string;
  count: number;
  top3: ThreadEntry[];
  error?: string;
};

type Response = {
  connected: boolean;
  accounts: AccountResult[];
};

function shortSender(from: string): string {
  // "Name <email@x.com>" → "Name"; bare "email@x.com" → "email@x.com"
  const m = from.match(/^([^<]+?)\s*<.+>$/);
  return (m ? m[1] : from).trim();
}

export function EmailNeedsAction() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: resp } = await supabase.functions.invoke("gmail-needs-action", {
          method: "POST",
          body: {},
        });
        if (!cancelled) setData(resp as Response);
      } catch {
        // Hide silently on error.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;
  if (!data || !data.connected) return null;

  const accountsWithUnread = (data.accounts || []).filter((a) => a.count > 0);
  const total = accountsWithUnread.reduce((sum, a) => sum + a.count, 0);
  if (total === 0) return null;

  // Flatten top picks across accounts, oldest-first via age_days desc, cap at 3.
  const flat = accountsWithUnread
    .flatMap((a) => a.top3.map((t) => ({ ...t, account: a.email })))
    .sort((a, b) => b.age_days - a.age_days)
    .slice(0, 3);

  return (
    <div className="border border-destructive/40 rounded-lg p-3 bg-destructive/5">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-destructive shrink-0" />
        <span className="text-sm font-medium">
          {total} unread &gt; 3 days across {accountsWithUnread.length} account
          {accountsWithUnread.length === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground pl-6">
        {flat.map((t) => (
          <li key={t.threadId} className="flex items-center gap-2">
            <a
              href={t.web_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 min-w-0 flex-1 hover:text-foreground group"
            >
              <span className="truncate">
                <span className="text-foreground/70">{t.account}</span>
                {" · "}
                <span className="text-foreground">{t.subject}</span>
                {" · "}
                <span>{shortSender(t.sender)}</span>
              </span>
              <span className="ml-auto shrink-0 tabular-nums">{t.age_days}d</span>
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
