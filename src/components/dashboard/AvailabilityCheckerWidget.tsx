import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarSearch, CalendarIcon, Loader2, Mail, CalendarDays, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Verdict = "confirmed_busy" | "tentative" | "mention_only" | "clear";

interface Report {
  date: string;
  verdict: Verdict;
  googleCalendar: { connected: boolean; accounts: any[]; events: any[] };
  gmail: { connected: boolean; accounts: any[]; messages: any[] };
  monday: { events: any[] };
  djep: { events: any[] };
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
  const { toast } = useToast();

  const run = async () => {
    if (!date) return;
    setLoading(true);
    setReport(null);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const { data, error } = await supabase.functions.invoke("availability-checker", {
        body: { date: dateStr },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setReport(data as Report);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Check failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const [reconnecting, setReconnecting] = useState<string | null>(null);
  const v = report ? verdictMeta[report.verdict] : null;
  const accountsNeedingGmail: string[] = (report?.gmail.accounts || [])
    .filter((a: any) => a.needsReconnect)
    .map((a: any) => a.email)
    .filter(Boolean);
  const needsGmailReconnect = accountsNeedingGmail.length > 0;

  const reconnect = async (email?: string) => {
    setReconnecting(email || "all");
    try {
      const params = new URLSearchParams({ action: "start", return_to: "/team/dashboard" });
      if (email) params.set("login_hint", email);
      const res = await fetch(
        `https://zsfkgncdenqzctdzxedl.supabase.co/functions/v1/google-calendar-oauth?${params}`,
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
              <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className="pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Button onClick={run} disabled={loading || !date} size="sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
          </Button>
        </div>

        {needsGmailReconnect && (
          <div className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-md p-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <span>
                {accountsNeedingGmail.length === 1 ? "This Google account hasn't" : "These Google accounts haven't"} granted Gmail access. Reconnect to enable email scanning.
              </span>
              <div className="flex flex-wrap gap-2">
                {accountsNeedingGmail.map((email) => (
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

        {report && v && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Verdict for {format(new Date(report.date + "T12:00:00"), "EEEE, MMMM d, yyyy")}</p>
                <Badge variant="outline" className={`mt-1 ${v.className}`}>{v.label}</Badge>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{report.googleCalendar.events.length} cal · {report.gmail.messages.length} email</div>
                <div>{report.monday.events.length} Monday · {report.djep.events.length} DJEP</div>
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
