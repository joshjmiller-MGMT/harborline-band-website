import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MicButton } from "@/components/dictation/MicButton";
import { appendDictation } from "@/hooks/useDictation";
import {
  Send,
  Loader2,
  CircleDot,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ScrollText,
} from "lucide-react";

// AI Teammates (Josh 2026-07-12): one chat-managed expert agent per field.
// Grid of teammate cards -> click one -> chat + its job queue/history, so Josh
// can bounce field to field and re-acclimate from each agent's own log.

type Teammate = {
  id: string;
  slug: string;
  name: string;
  field: string;
  emoji: string;
  color: string;
  tagline: string;
  status: "idle" | "working" | "waiting_on_josh";
  current_action: string | null;
  updated_at: string;
  sort_order: number;
};

type AgentJob = {
  id: string;
  agent_id: string;
  title: string;
  status: "queued" | "in_progress" | "done" | "blocked" | "cancelled";
  result_md: string | null;
  blocked_reason: string | null;
  created_at: string;
  finished_at: string | null;
};

type AgentMessage = {
  id: string;
  agent_id: string;
  job_id: string | null;
  role: "josh" | "agent" | "system";
  kind: "chat" | "action" | "result" | "ticket";
  body: string;
  ticket_ref: string | null;
  created_at: string;
};

const STATUS_META: Record<
  Teammate["status"],
  { label: string; cls: string }
> = {
  idle: { label: "Idle", cls: "bg-muted text-muted-foreground border-border" },
  working: {
    label: "Working",
    cls: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
  },
  waiting_on_josh: {
    label: "Waiting on you",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
};

const JOB_STATUS_META: Record<
  AgentJob["status"],
  { label: string; cls: string }
> = {
  queued: { label: "Queued", cls: "text-muted-foreground border-border" },
  in_progress: { label: "In progress", cls: "text-green-600 border-green-500/40" },
  done: { label: "Done", cls: "text-green-600 border-green-500/30 bg-green-500/10" },
  blocked: { label: "Blocked", cls: "text-amber-600 border-amber-500/40" },
  cancelled: { label: "Cancelled", cls: "text-muted-foreground border-border line-through" },
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AgentTeammates() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Teammate[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  // Per-ticket history filter (Josh 2026-07-19): click any ticket chip to see
  // ONLY that ticket's events across this agent's whole log.
  const [ticketFilter, setTicketFilter] = useState<string | null>(null);
  const [ticketMsgs, setTicketMsgs] = useState<AgentMessage[]>([]);
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => agents.find((a) => a.slug === selectedSlug) || null,
    [agents, selectedSlug],
  );

  const loadAgents = useCallback(async () => {
    const { data } = await supabase
      .from("agent_teammates")
      .select("*")
      .order("sort_order");
    if (data) {
      setAgents(data as Teammate[]);
      // Sidebar layout: always have a conversation open. Restore the last one
      // Josh was in (so he re-acclimates where he left off), else the first.
      setSelectedSlug((cur) => {
        if (cur && (data as Teammate[]).some((a) => a.slug === cur)) return cur;
        const remembered = window.localStorage.getItem("aiteam.lastAgent");
        if (remembered && (data as Teammate[]).some((a) => a.slug === remembered))
          return remembered;
        return (data as Teammate[])[0]?.slug ?? null;
      });
    }
  }, []);

  const loadChat = useCallback(async (agentId: string) => {
    setLoadingChat(true);
    const [msgs, jbs] = await Promise.all([
      supabase
        .from("agent_messages")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("agent_jobs")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    setMessages(((msgs.data as AgentMessage[]) || []).reverse());
    setJobs((jbs.data as AgentJob[]) || []);
    setLoadingChat(false);
  }, []);

  useEffect(() => {
    setTicketFilter(null);
  }, [selectedSlug]);

  useEffect(() => {
    if (!ticketFilter) { setTicketMsgs([]); return; }
    supabase
      .from("agent_messages")
      .select("*")
      .eq("ticket_ref", ticketFilter)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => setTicketMsgs((data as AgentMessage[]) || []));
  }, [ticketFilter]);

  // Agents list + live status updates.
  useEffect(() => {
    loadAgents();
    const ch = supabase
      .channel("agent_teammates_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_teammates" },
        loadAgents,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [loadAgents]);

  // Selected agent: chat + jobs, live.
  useEffect(() => {
    if (!selected) return;
    loadChat(selected.id);
    const ch = supabase
      .channel(`agent_chat_${selected.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_messages",
          filter: `agent_id=eq.${selected.id}`,
        },
        (payload) => {
          const row = payload.new as AgentMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row],
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_jobs",
          filter: `agent_id=eq.${selected.id}`,
        },
        () => loadChat(selected.id),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    if (!selected || !input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    // Optimistic append; realtime will bring the canonical row (deduped by id).
    setMessages((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}`,
        agent_id: selected.id,
        job_id: null,
        role: "josh",
        kind: "chat",
        body: text,
        created_at: new Date().toISOString(),
      },
    ]);
    try {
      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: { agent_slug: selected.slug, message: text },
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        let msg = error.message;
        if (ctx) {
          try {
            const body = await ctx.json();
            msg = body.message || body.error || msg;
          } catch {
            /* keep original */
          }
        }
        throw new Error(msg);
      }
      const payload = data as {
        reply: string;
        jobs: { id: string; title: string }[];
      };
      if (payload?.jobs?.length) {
        toast({
          title: `${selected.name} queued ${payload.jobs.length} job${payload.jobs.length > 1 ? "s" : ""}`,
          description: payload.jobs.map((j) => j.title).join(" · "),
        });
      }
      // Reply + job rows arrive via realtime; refresh as a fallback.
      loadChat(selected.id);
      loadAgents();
    } catch (e) {
      toast({
        title: "Message failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // ---------- Sidebar + conversation (Claude-style, Josh 2026-07-14) ----------
  const pickAgent = (slug: string) => {
    setSelectedSlug(slug);
    window.localStorage.setItem("aiteam.lastAgent", slug);
  };

  const st = selected ? STATUS_META[selected.status] || STATUS_META.idle : STATUS_META.idle;
  const activeJobs = jobs.filter((j) =>
    ["queued", "in_progress", "blocked"].includes(j.status),
  );
  const pastJobs = jobs.filter((j) => ["done", "cancelled"].includes(j.status));

  const sidebarRow = (a: Teammate) => {
    const active = a.slug === selectedSlug;
    const dot =
      a.status === "working"
        ? "bg-green-500"
        : a.status === "waiting_on_josh"
          ? "bg-amber-500"
          : "bg-muted-foreground/40";
    return (
      <button
        key={a.slug}
        type="button"
        onClick={() => pickAgent(a.slug)}
        className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors flex items-center gap-2.5 ${
          active ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/60 border border-transparent"
        }`}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 relative"
          style={{ backgroundColor: `${a.color}22`, border: `2px solid ${a.color}` }}
        >
          {a.emoji}
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${dot}`} />
        </div>
        <div className="min-w-0 flex-1 hidden md:block">
          <p className={`text-sm leading-tight truncate ${active ? "text-foreground font-medium" : "text-foreground"}`}>
            {a.name}
          </p>
          <p className="text-[11px] text-muted-foreground truncate leading-tight">
            {a.current_action || a.field}
          </p>
        </div>
      </button>
    );
  };

  return (
    <div className="py-6 flex gap-4">
      {/* Sidebar — every teammate one click away */}
      <aside className="w-14 md:w-56 flex-shrink-0">
        <div className="sticky top-24 space-y-1">
          {agents.map(sidebarRow)}
          {agents.length === 0 && (
            <p className="text-xs text-muted-foreground p-2">No teammates yet.</p>
          )}
        </div>
      </aside>

      {/* Conversation + log */}
      <div className="flex-1 min-w-0">
        {selected && (
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
              style={{ backgroundColor: `${selected.color}22`, border: `2px solid ${selected.color}` }}
            >
              {selected.emoji}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-medium text-foreground">{selected.name}</h2>
                <Badge variant="outline" className={`text-[10px] ${st.cls}`}>
                  {st.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {selected.field}
                {selected.current_action ? ` · ${selected.current_action}` : ""}
              </p>
            </div>
          </div>
        )}

        {!selected ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Pick a teammate to start.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chat */}
        <Card className="lg:col-span-2 border-border">
          <CardContent className="p-0 flex flex-col h-[600px]">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingChat && messages.length === 0 && (
                <div className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                </div>
              )}
              {!loadingChat && messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Say hi — give {selected.name} a job or ask where things stand.
                </p>
              )}
              {ticketFilter && (
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs">
                  <span className="truncate">Ticket history: <span className="font-mono">{ticketFilter}</span> ({ticketMsgs.length} events)</span>
                  <button type="button" className="text-primary hover:underline flex-shrink-0" onClick={() => setTicketFilter(null)}>
                    Show all
                  </button>
                </div>
              )}
              {(ticketFilter ? ticketMsgs : messages).map((m) =>
                m.kind !== "chat" ? (
                  <div key={m.id} className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => m.ticket_ref && setTicketFilter(m.ticket_ref)}
                      disabled={!m.ticket_ref}
                      className={`text-[11px] text-muted-foreground bg-muted/40 rounded-full px-3 py-1 flex items-center gap-1.5 max-w-[90%] text-left ${m.ticket_ref ? "hover:bg-primary/15 hover:text-foreground cursor-pointer" : "cursor-default"}`}
                      title={m.ticket_ref ? "Show this ticket's full history" : undefined}
                    >
                      <ScrollText className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{m.body}</span>
                      {m.ticket_ref && <span className="font-mono text-[9px] opacity-60 flex-shrink-0">{m.ticket_ref.slice(0, 18)}</span>}
                    </button>
                  </div>
                ) : (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "josh" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                        m.role === "josh"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {m.body}
                      <div
                        className={`text-[10px] mt-1 ${
                          m.role === "josh"
                            ? "text-primary-foreground/60"
                            : "text-muted-foreground/60"
                        }`}
                      >
                        {timeAgo(m.created_at)}
                      </div>
                    </div>
                  </div>
                ),
              )}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-border p-3">
              <div className="relative">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={`Message ${selected.name} — assign a job or ask a question…`}
                  rows={2}
                  className="pr-20 resize-none"
                />
                <div className="absolute right-2 bottom-2 flex items-center gap-1">
                  <MicButton
                    onText={(t) => setInput((p) => appendDictation(p, t))}
                  />
                  <Button
                    size="icon"
                    className="h-8 w-8"
                    onClick={send}
                    disabled={sending || !input.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Job queue + history = the agent's own log */}
        <div className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Working on
              </h4>
              {activeJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing in flight.</p>
              ) : (
                <ul className="space-y-2">
                  {activeJobs.map((j) => {
                    const jm = JOB_STATUS_META[j.status];
                    return (
                      <li key={j.id} className="text-sm">
                        <div className="flex items-start gap-2">
                          {j.status === "blocked" ? (
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                          ) : (
                            <CircleDot className="w-3.5 h-3.5 mt-0.5 text-green-500 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="text-foreground">{j.title}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant="outline" className={`text-[10px] ${jm.cls}`}>
                                {jm.label}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {timeAgo(j.created_at)}
                              </span>
                            </div>
                            {j.blocked_reason && (
                              <p className="text-[11px] text-amber-600 mt-0.5">
                                {j.blocked_reason}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Done ({pastJobs.length})
              </h4>
              {pastJobs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No completed jobs yet.</p>
              ) : (
                <ul className="space-y-2 max-h-[300px] overflow-y-auto">
                  {pastJobs.map((j) => (
                    <li key={j.id} className="text-sm border-b border-border/40 pb-2 last:border-0">
                      <span className="text-foreground">{j.title}</span>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {j.finished_at ? timeAgo(j.finished_at) : ""}
                      </div>
                      {j.result_md && (
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
                          {j.result_md}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
          </div>
        )}
      </div>
    </div>
  );
}
