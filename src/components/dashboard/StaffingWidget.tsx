import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  RefreshCw,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";

type StaffEntry = {
  name: string;
  role: string;
  pattern: "explicit" | "prose";
};

type StaffingEvent = {
  id: string;
  accountEmail: string;
  calendarName: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink: string;
  colorId: string;
  expected_headcount: number | null;
  expected_source: string;
  staffed_count: number;
  missing_count: number | null;
  staff_names: string[];
  staff_entries?: StaffEntry[];
  matched_lines: string[];
};

type StaffingResponse = {
  configured: boolean;
  connected: boolean;
  windowDays?: number;
  timeMin?: string;
  timeMax?: string;
  accounts?: { email: string; calendars: number; error?: string }[];
  events: StaffingEvent[];
  error?: string;
};

function parseEventDate(value: string): Date {
  // GCal returns YYYY-MM-DD for all-day events and full ISO for timed events.
  return value.length === 10 ? new Date(`${value}T00:00:00`) : parseISO(value);
}

function eventStatus(ev: StaffingEvent): "complete" | "missing" | "unknown" {
  if (ev.expected_headcount === null) return "unknown";
  if (ev.missing_count === null || ev.missing_count === 0) return "complete";
  return "missing";
}

function EventRow({ ev }: { ev: StaffingEvent }) {
  const [expanded, setExpanded] = useState(false);
  const status = eventStatus(ev);
  const date = ev.start ? parseEventDate(ev.start) : null;

  return (
    <div className="border border-border/50 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{ev.title}</span>
            {status === "missing" && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Needs {ev.missing_count}
              </Badge>
            )}
            {status === "complete" && (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Staffed
              </Badge>
            )}
            {status === "unknown" && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                <HelpCircle className="w-3 h-3 mr-1" />
                Untagged
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            {date && <span>{format(date, "EEE MMM d")}</span>}
            {!ev.allDay && date && <span>· {format(date, "h:mm a")}</span>}
            {ev.location && <span className="truncate">· {ev.location}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground tabular-nums">
            {ev.staffed_count}
            {ev.expected_headcount !== null ? `/${ev.expected_headcount}` : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="text-xs space-y-2 pt-2 border-t border-border/30">
          <div>
            <span className="text-muted-foreground">Expected:</span>{" "}
            {ev.expected_headcount !== null ? (
              <span>
                {ev.expected_headcount} <span className="text-muted-foreground italic">({ev.expected_source})</span>
              </span>
            ) : (
              <span className="text-amber-600 italic">{ev.expected_source}</span>
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Staff parsed:</span>{" "}
            {(() => {
              const entries =
                ev.staff_entries && ev.staff_entries.length > 0
                  ? ev.staff_entries
                  : ev.staff_names.map(
                      (n) => ({ name: n, role: "unknown", pattern: "explicit" as const }),
                    );
              if (entries.length === 0) {
                return (
                  <span className="text-muted-foreground italic">
                    none detected in description
                  </span>
                );
              }
              return (
                <span>
                  {entries.map((entry, i) => (
                    <span key={`${entry.name}-${i}`}>
                      {i > 0 && ", "}
                      {entry.pattern === "prose" ? (
                        <span className="italic text-muted-foreground">
                          {entry.name}
                          <span className="text-[10px] ml-1 not-italic">(via prose)</span>
                        </span>
                      ) : (
                        <span>{entry.name}</span>
                      )}
                    </span>
                  ))}
                </span>
              );
            })()}
          </div>
          {ev.matched_lines.length > 0 && (
            <details className="text-muted-foreground">
              <summary className="cursor-pointer">Matched lines ({ev.matched_lines.length})</summary>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                {ev.matched_lines.map((l, i) => (
                  <li key={i} className="font-mono text-[10px] break-all">
                    {l}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex items-center gap-3 pt-1">
            <a
              href={ev.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Open in Google Calendar <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-muted-foreground">· {ev.accountEmail}</span>
          </div>
        </div>
      )}
    </div>
  );
}

type StaffingWidgetProps = {
  /** Days of forward calendar window. Defaults to 90 (3 months). */
  windowDays?: number;
  /** Hide the "Staffed" rows by default; user can toggle to see them. */
  defaultMissingOnly?: boolean;
};

export default function StaffingWidget({
  windowDays = 90,
  defaultMissingOnly = false,
}: StaffingWidgetProps) {
  const [data, setData] = useState<StaffingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [missingOnly, setMissingOnly] = useState(defaultMissingOnly);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: resp, error: fnErr } = await supabase.functions.invoke(
        "staffing-snapshot",
        { method: "POST", body: { days: windowDays } },
      );
      if (fnErr) throw fnErr;
      const payload = resp as StaffingResponse;
      if (payload?.error) throw new Error(payload.error);
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowDays]);

  const events = data?.events || [];
  const grouped = useMemo(() => {
    const out = { missing: [] as StaffingEvent[], unknown: [] as StaffingEvent[], complete: [] as StaffingEvent[] };
    for (const ev of events) {
      const s = eventStatus(ev);
      out[s].push(ev);
    }
    return out;
  }, [events]);

  const visible = missingOnly ? grouped.missing : [...grouped.missing, ...grouped.unknown, ...grouped.complete];

  const summary = (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
        {grouped.missing.length} need staff
      </Badge>
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
        {grouped.unknown.length} untagged
      </Badge>
      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
        {grouped.complete.length} staffed
      </Badge>
    </div>
  );

  return (
    <Card className="bg-card/50">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="font-display text-lg tracking-wide-custom flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" /> Staffing — next {windowDays} days
                </CardTitle>
                <CardDescription>
                  Green-colored calendar events, parsed for staff coverage.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {data && summary}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant={missingOnly ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setMissingOnly(!missingOnly)}
                >
                  {missingOnly ? "Showing: missing only" : "Show: all events"}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={load}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Refresh
              </Button>
            </div>

            {loading && !data && (
              <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
            )}

            {error && (
              <div className="text-sm text-destructive py-4 text-center">
                {error}
              </div>
            )}

            {data && !data.connected && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No Google Calendar accounts connected. Connect one from the Unified Calendar widget on the dashboard.
              </div>
            )}

            {data && data.connected && visible.length === 0 && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                {missingOnly
                  ? "Nothing missing — every green event in this window is staffed."
                  : "No green-colored events found in this window."}
              </div>
            )}

            <div className="space-y-2">
              {visible.map((ev) => (
                <EventRow key={ev.id} ev={ev} />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/**
 * Compact summary for embedding in NeedsActionWidget — fetches the next 14 days
 * and shows just a one-line "N events missing staff in the next 2 weeks" + a
 * top-3 list. Click jumps to the scheduler page.
 */
export function StaffingNeedsAction() {
  const [data, setData] = useState<StaffingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: resp } = await supabase.functions.invoke("staffing-snapshot", {
          method: "POST",
          body: { days: 14 },
        });
        if (!cancelled) setData(resp as StaffingResponse);
      } catch {
        // Silently swallow; widget just hides if it can't load.
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

  const missing = (data.events || []).filter((e) => eventStatus(e) === "missing");
  if (missing.length === 0) return null;

  const top = missing.slice(0, 3);

  return (
    <div className="border border-destructive/40 rounded-lg p-3 bg-destructive/5">
      <a
        href="/team/scheduler"
        className="flex items-center justify-between gap-2 group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-sm font-medium">
            {missing.length} event{missing.length === 1 ? "" : "s"} missing staff (next 14 days)
          </span>
        </div>
        <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-foreground shrink-0" />
      </a>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground pl-6">
        {top.map((ev) => {
          const date = ev.start ? parseEventDate(ev.start) : null;
          return (
            <li key={ev.id} className="flex items-center gap-2">
              {date && <span className="tabular-nums">{format(date, "MMM d")}</span>}
              <span className="truncate">{ev.title}</span>
              <span className="ml-auto shrink-0">
                needs {ev.missing_count}
              </span>
            </li>
          );
        })}
        {missing.length > top.length && (
          <li className="italic">+ {missing.length - top.length} more…</li>
        )}
      </ul>
    </div>
  );
}
