import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarSearch, CalendarIcon, Loader2, Mail, CalendarDays, ExternalLink, AlertCircle, RefreshCw, Plug, Phone, Music2, Megaphone } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Verdict = "confirmed_busy" | "tentative" | "mention_only" | "clear";

type TokenHealth = {
  account_email: string | null;
  needs_reconnect: boolean;
  last_refresh_at: string | null;
  last_refresh_error: string | null;
  gmail_scope_granted: boolean;
};

interface Report {
  date: string;
  verdict: Verdict;
  googleCalendar: { connected: boolean; accounts: any[]; events: any[] };
  gmail: { connected: boolean; accounts: any[]; messages: any[] };
  monday: { events: any[] };
  djep: { events: any[] };
  booking?: { events: any[]; sheetUrl?: string | null };
  practice?: { sessions: any[] };
  social?: { posts: any[] };
  cached?: boolean;
  refreshed_at?: string;
}

const verdictMeta: Record<Verdict, { label: string; className: string }> = {
  confirmed_busy: { label: "Confirmed Booking", className: "bg-destructive/20 text-destructive border-destructive/40" },
  tentative: { label: "Tentative", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" },
  mention_only: { label: "Mentioned in Email", className: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
  clear: { label: "Clear", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
};

export default function AvailabilityCheckerWidget() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [tokens, setTokens] = useState<TokenHealth[]>([]);
  const { toast } = useToast();

  const loadTokenHealth = async () => {
    const { data } = await supabase
      .from("google_calendar_tokens")
      .select("account_email, needs_reconnect, last_refresh_at, last_refresh_error, gmail_scope_granted")
      .order("created_at", { ascending: true });
    setTokens((data || []) as TokenHealth[]);
  };

  useEffect(() => {
    loadTokenHealth();
    const t = setInterval(loadTokenHealth, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const run = async (force = false) => {
    if (!date) return;
    setLoading(true);
    if (!force) setReport(null);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const { data, error } = await supabase.functions.invoke("availability-checker", {
        body: { date: dateStr, force },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setReport(data as Report);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Check failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
      loadTokenHealth();
    }
  };

  const [reconnecting, setReconnecting] = useState<string | null>(null);
  const v = report ? verdictMeta[report.verdict] : null;

  // Persistent connection state from the DB (survives refreshes, no need to run a check)
  const noTokens = tokens.length === 0;
  const accountsNeedingReconnect = tokens.filter((t) => t.needs_reconnect).map((t) => t.account_email).filter(Boolean) as string[];
  const accountsMissingGmailScope = tokens.filter((t) => !t.gmail_scope_granted && !t.needs_reconnect).map((t) => t.account_email).filter(Boolean) as string[];
  const allHealthy = tokens.length > 0 && accountsNeedingReconnect.length === 0 && accountsMissingGmailScope.length === 0;

  const reconnect = async (email?: string) => {
    setReconnecting(email || "all");
    try {
      const params = new URLSearchParams({ action: "start", return_to: "/team/dashboard" });
      if (email) params.set("login_hint", email);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-oauth?${params}`,
      );
      const data = await res.json();
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      } else {
        throw new Error(data?.error || "Could not start OAuth flow");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Reconnect failed", description: msg, variant: "destructive" });
      setReconnecting(null);
    }
  };

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg tracking-wide-custom flex items-center gap-2">
          <CalendarSearch className="w-5 h-5 text-primary" />
          Availability Checker
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
                {date ? format(date, "EEE, MMM d, yyyy") : "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={setDate} autoFocus className="pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Button onClick={() => run(false)} disabled={loading || !date} size="sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
          </Button>
          {report && (
            <Button onClick={() => run(true)} disabled={loading} size="sm" variant="outline" className="gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          )}
          {report?.cached && report.refreshed_at && (
            <span className="text-xs text-muted-foreground">
              Cached · {formatDistanceToNow(new Date(report.refreshed_at), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Persistent connection state — visible without running a check */}
        {noTokens && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 border border-border rounded-md p-2">
            <Plug className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <span>No Google account connected. Connect to enable calendar + email availability checks.</span>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" disabled={reconnecting === "all"} onClick={() => reconnect()}>
                {reconnecting === "all" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plug className="w-3 h-3" />}
                Connect Google
              </Button>
            </div>
          </div>
        )}

        {accountsNeedingReconnect.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md p-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <span>
                {accountsNeedingReconnect.length === 1 ? "Google connection has expired or been revoked. Reconnect to restore." : "Multiple Google connections have expired or been revoked. Reconnect each to restore."}
              </span>
              <div className="flex flex-wrap gap-2">
                {accountsNeedingReconnect.map((email) => (
                  <Button
                    key={email}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    disabled={reconnecting === email || reconnecting === "all"}
                    onClick={() => reconnect(email)}
                  >
                    {reconnecting === email ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plug className="w-3 h-3" />}
                    Reconnect {email}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {accountsMissingGmailScope.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-md p-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <span>
                {accountsMissingGmailScope.length === 1 ? "This Google account hasn't" : "These Google accounts haven't"} granted Gmail access. Reconnect to enable email scanning.
              </span>
              <div className="flex flex-wrap gap-2">
                {accountsMissingGmailScope.map((email) => (
                  <Button
                    key={email}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    disabled={reconnecting === email || reconnecting === "all"}
                    onClick={() => reconnect(email)}
                  >
                    {reconnecting === email ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                    Reconnect {email}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {allHealthy && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Google connected · {tokens.length === 1 ? tokens[0].account_email : `${tokens.length} accounts`}
          </div>
        )}

        {report && v && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Verdict for {format(new Date(report.date + "T12:00:00"), "EEEE, MMMM d, yyyy")}</p>
                <Badge variant="outline" className={`mt-1 ${v.className}`}>{v.label}</Badge>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{report.googleCalendar.events.length} cal · {report.gmail.messages.length} email · {report.booking?.events.length ?? 0} booking</div>
                <div>{report.monday.events.length} Monday · {report.djep.events.length} DJEP · {report.practice?.sessions.length ?? 0} practice · {report.social?.posts.length ?? 0} social</div>
              </div>
            </div>

            {report.googleCalendar.events.length > 0 && (
              <Section icon={<CalendarDays className="w-4 h-4" />} title={`Google Calendar (${report.googleCalendar.events.length})`}>
                {report.googleCalendar.events.map((e: any, i: number) => (
                  <Row key={`gc-${i}`} title={e.title} subtitle={`${e.account} · ${e.calendar} · ${e.status || ""}`} link={e.htmlLink} />
                ))}
              </Section>
            )}

            {report.monday.events.length > 0 && (
              <Section icon={<CalendarDays className="w-4 h-4" />} title={`Monday.com (${report.monday.events.length})`}>
                {report.monday.events.map((e: any, i: number) => (
                  <Row key={`mo-${i}`} title={e.title || e.name || "(untitled)"} subtitle={e.boardName || e.label || ""} />
                ))}
              </Section>
            )}

            {report.djep.events.length > 0 && (
              <Section icon={<CalendarDays className="w-4 h-4" />} title={`DJEP (${report.djep.events.length})`}>
                {report.djep.events.map((e: any, i: number) => (
                  <Row key={`dj-${i}`} title={e.title || e.name || "(untitled)"} subtitle={e.venue || e.location || ""} />
                ))}
              </Section>
            )}

            {(report.booking?.events?.length ?? 0) > 0 && (
              <Section icon={<Phone className="w-4 h-4" />} title={`Booking Sheet (${report.booking!.events.length})`}>
                {report.booking!.events.map((e: any, i: number) => (
                  <Row key={`bk-${i}`} title={e.title || e.name || "(untitled)"} subtitle={`${e.kind ? e.kind + " · " : ""}${e.sourceLabel || "Booking Agent"}`} link={e.itemUrl || report.booking?.sheetUrl || undefined} />
                ))}
              </Section>
            )}

            {(report.practice?.sessions?.length ?? 0) > 0 && (
              <Section icon={<Music2 className="w-4 h-4" />} title={`Practice (${report.practice!.sessions.length})`}>
                {report.practice!.sessions.map((s: any) => (
                  <Row
                    key={`pr-${s.id}`}
                    title={s.preset_name || "Practice session"}
                    subtitle={`${s.total_minutes || 0} min${s.song_of_the_day ? ` · ${s.song_of_the_day}` : ""}`}
                  />
                ))}
              </Section>
            )}

            {(report.social?.posts?.length ?? 0) > 0 && (
              <Section icon={<Megaphone className="w-4 h-4" />} title={`Social posts (${report.social!.posts.length})`}>
                {report.social!.posts.map((p: any) => {
                  const brand = p.social_brands?.name || "";
                  const when = p.posted_at ? "posted" : "scheduled";
                  return (
                    <Row
                      key={`so-${p.id}`}
                      title={p.title || "(untitled)"}
                      subtitle={`${brand}${brand ? " · " : ""}${when} · ${p.status || ""}`}
                    />
                  );
                })}
              </Section>
            )}

            {report.gmail.messages.length > 0 && (
              <Section icon={<Mail className="w-4 h-4" />} title={`Gmail (${report.gmail.messages.length})`}>
                {report.gmail.messages.map((m: any) => (
                  <Row
                    key={m.id}
                    title={m.subject || "(no subject)"}
                    subtitle={`${m.from} · ${m.matchType === "mention" ? "mentions date" : "received that day"}`}
                    link={m.link}
                    snippet={m.snippet}
                  />
                ))}
              </Section>
            )}

            {report.verdict === "clear" && (
              <p className="text-sm text-muted-foreground italic">No conflicts found across calendars or email.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-display tracking-wide-custom text-muted-foreground mb-2">
        {icon} {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ title, subtitle, link, snippet }: { title: string; subtitle?: string; link?: string; snippet?: string }) {
  return (
    <div className="text-sm bg-muted/30 rounded-md p-2 border border-border/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
          {snippet && <div className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">{snippet}</div>}
        </div>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 flex-shrink-0">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
