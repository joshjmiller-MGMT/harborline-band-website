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
  Pencil,
  Save,
  X,
  CalendarClock,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { CalendarColorLegend } from "./CalendarColorLegend";
import {
  HOLD_COLOR_ID,
  NEEDS_STAFFING_COLOR_ID,
  GIG_COLOR_ID,
} from "@/lib/calendar-color-scheme";

// Josh 2026-06-22: the staffing board surfaces ONLY needs-staffing items =
// red (Tomato/11) + orange (Tangerine/6). Everything else (warehouse dark-green,
// gig light-green, yellow holds) is excluded. NB: the staffing-snapshot edge fn
// currently only fetches {2, 11, 5}, so orange(6) won't appear on the board until
// that fn is extended to include it — flagged to JARSH in the handoff.
const NEEDS_STAFFING_BOARD_COLOR_IDS = new Set([NEEDS_STAFFING_COLOR_ID, "6"]);

type StaffEntry = {
  name: string;
  role: string;
  pattern: "explicit" | "prose";
};

type StaffingEvent = {
  id: string;
  accountEmail: string;
  calendarId: string;
  calendarName: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink: string;
  colorId: string;
  is_hold?: boolean;
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

// Binary: matches what staffing-color-write writes to GCal. No "untagged"
// middle state — Josh's mental model is staffed (green) or not (yellow);
// "no headcount rule matched" is a system artifact, not a meaningful state.
//   - expected known  → staffed when staffed_count >= expected
//   - expected unknown → staffed when there's at least one name (trust the
//     user's manual list)
function eventStatus(ev: StaffingEvent): "staffed" | "unstaffed" {
  if (ev.expected_headcount === null) {
    return ev.staff_names.length > 0 ? "staffed" : "unstaffed";
  }
  return (ev.missing_count ?? 0) === 0 ? "staffed" : "unstaffed";
}

function EventRow({ ev, onSaved }: { ev: StaffingEvent; onSaved: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftNames, setDraftNames] = useState<string>(ev.staff_names.join("\n"));
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const status = eventStatus(ev);
  const date = ev.start ? parseEventDate(ev.start) : null;

  // Extract the raw GCal eventId from the prefixed id "<account>:<gcal-id>".
  const eventId = ev.id.startsWith(`${ev.accountEmail}:`)
    ? ev.id.slice(ev.accountEmail.length + 1)
    : ev.id;

  async function saveStaffing() {
    setSaving(true);
    setSaveErr(null);
    const names = draftNames
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    try {
      const { data, error } = await supabase.functions.invoke("staffing-color-write", {
        method: "POST",
        body: {
          accountEmail: ev.accountEmail,
          calendarId: ev.calendarId,
          eventId,
          newStaffNames: names,
          expected: ev.expected_headcount,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setEditing(false);
      onSaved();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setDraftNames(ev.staff_names.join("\n"));
    setEditing(false);
    setSaveErr(null);
  }

  return (
    <div className="border border-border/50 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{ev.title}</span>
            {status === "staffed" && (
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Staffed
              </Badge>
            )}
            {status === "unstaffed" && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {ev.expected_headcount !== null && ev.missing_count
                  ? `Needs ${ev.missing_count}`
                  : "Needs staff"}
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
            onClick={() => {
              if (!expanded) setExpanded(true);
              setEditing(true);
            }}
            disabled={editing}
            aria-label="Edit staffing"
          >
            <Pencil className="w-3 h-3" />
          </Button>
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

      {editing && (
        <div className="text-xs space-y-2 pt-2 border-t border-border/30">
          <p className="text-muted-foreground">
            One name per line. Save writes the staff list back to the GCal event
            description and flips the event color: <span className="inline-block w-2 h-2 rounded-full bg-green-500 align-middle" /> sage if staffed_count ≥ expected ({ev.expected_headcount ?? "?"}), <span className="inline-block w-2 h-2 rounded-full bg-amber-500 align-middle" /> yellow otherwise.
          </p>
          <textarea
            className="w-full min-h-[6em] px-2 py-1 text-xs font-mono bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
            value={draftNames}
            onChange={(e) => setDraftNames(e.target.value)}
            disabled={saving}
            placeholder="Sean Sidley&#10;Colin Sidley&#10;Ian Hoke"
          />
          {saveErr && (
            <p className="text-destructive">Couldn't save: {saveErr}</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" className="h-7 px-3" onClick={saveStaffing} disabled={saving}>
              {saving ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Save className="w-3 h-3 mr-1" />
              )}
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-3"
              onClick={cancelEdit}
              disabled={saving}
            >
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {expanded && !editing && (
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
  /** Days of forward calendar window. Defaults to 730 (2 years — the
   * staffing-snapshot edge fn cap) so every future unstaffed gig surfaces. */
  windowDays?: number;
};

export default function StaffingWidget({
  windowDays = 730,
}: StaffingWidgetProps) {
  const [data, setData] = useState<StaffingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

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
  // The board shows ONLY needs-staffing items (red + orange). Holds (yellow),
  // staffed gigs (light-green), and warehouse/admin (dark-green) are excluded
  // — holds still surface on the dashboard via HoldsNeedsAction.
  const visible = useMemo(
    () => events.filter((ev) => NEEDS_STAFFING_BOARD_COLOR_IDS.has(ev.colorId)),
    [events],
  );

  const summary = (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
        {visible.length} need{visible.length === 1 ? "s" : ""} staffing
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
                  <Users className="w-5 h-5 text-primary" /> Staffing — needs attention
                </CardTitle>
                <CardDescription>
                  Calendar items that need staffing (red + orange), going forward. Holds and staffed gigs are excluded.
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
            <div className="flex items-center justify-end gap-2">
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
                Nothing needs staffing (red / orange) in this window.
              </div>
            )}

            <div className="space-y-2">
              {visible.map((ev) => (
                <EventRow key={ev.id} ev={ev} onSaved={load} />
              ))}
            </div>

            {data && data.connected && (
              <div className="pt-3 mt-1 border-t border-border/40 space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Staffing statuses
                </p>
                {/* Just the 3 staffing-lifecycle colors — NOT the whole calendar
                    scheme (that legend lives on the unified calendar). Josh 2026-07: the
                    scheduler's staffing section should show only staffing statuses. */}
                <CalendarColorLegend
                  colorIds={[HOLD_COLOR_ID, NEEDS_STAFFING_COLOR_ID, GIG_COLOR_ID]}
                />
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/**
 * Compact summary for embedding in NeedsActionWidget — fetches the next 14 days
 * and shows a one-line "N events need staff" + a top-3 list. Surfaces every
 * unstaffed event (the binary unstaffed = staff list empty OR known headcount
 * not met). Click jumps to the scheduler page.
 */
export function StaffingNeedsAction() {
  const [data, setData] = useState<StaffingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 730 days = max the staffing-snapshot edge fn allows. Surfaces every
        // future unstaffed gig, not just a near-term slice.
        const { data: resp } = await supabase.functions.invoke("staffing-snapshot", {
          method: "POST",
          body: { days: 730 },
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

  const unstaffed = (data.events || []).filter((e) => eventStatus(e) === "unstaffed");
  if (unstaffed.length === 0) return null;

  const top = unstaffed.slice(0, 3);

  return (
    <div className="border border-amber-500/40 rounded-lg p-3 bg-amber-500/5">
      <a
        href="/team/scheduler"
        className="flex items-center justify-between gap-2 group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-sm font-medium">
            {unstaffed.length} upcoming event{unstaffed.length === 1 ? "" : "s"} need{unstaffed.length === 1 ? "s" : ""} staff
          </span>
        </div>
        <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-foreground shrink-0" />
      </a>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground pl-6">
        {top.map((ev) => {
          const date = ev.start ? parseEventDate(ev.start) : null;
          const label =
            ev.expected_headcount !== null && ev.missing_count
              ? `needs ${ev.missing_count}`
              : "needs staff";
          return (
            <li key={ev.id} className="flex items-center gap-2">
              {date && <span className="tabular-nums">{format(date, "MMM d")}</span>}
              <span className="truncate">{ev.title}</span>
              <span className="ml-auto shrink-0">{label}</span>
            </li>
          );
        })}
        {unstaffed.length > top.length && (
          <li className="italic">+ {unstaffed.length - top.length} more…</li>
        )}
      </ul>
    </div>
  );
}

/**
 * Compact "holds need a confirm" alert for NeedsActionWidget. A hold (Banana/5)
 * is a tentative gig that hasn't been confirmed yet — distinct from the
 * needs-staffing alert above. Reuses the staffing-snapshot feed (which returns
 * the booked green/yellow events with their colorId) and filters for holds.
 */
export function HoldsNeedsAction() {
  const [data, setData] = useState<StaffingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: resp } = await supabase.functions.invoke("staffing-snapshot", {
          method: "POST",
          body: { days: 730 },
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

  const holds = (data.events || []).filter((e) => e.colorId === HOLD_COLOR_ID);
  if (holds.length === 0) return null;

  const top = holds.slice(0, 3);

  return (
    <div className="border border-yellow-500/40 rounded-lg p-3 bg-yellow-500/5">
      <a
        href="/team/scheduler"
        className="flex items-center justify-between gap-2 group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock className="w-4 h-4 text-yellow-600 shrink-0" />
          <span className="text-sm font-medium">
            {holds.length} gig hold{holds.length === 1 ? "" : "s"} need{holds.length === 1 ? "s" : ""} a confirm
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
              <span className="ml-auto shrink-0">tentative</span>
            </li>
          );
        })}
        {holds.length > top.length && (
          <li className="italic">+ {holds.length - top.length} more…</li>
        )}
      </ul>
    </div>
  );
}
