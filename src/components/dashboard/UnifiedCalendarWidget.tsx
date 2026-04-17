import { useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, View, EventProps } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  CalendarDays,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  Link as LinkIcon,
  Trash2,
  KeyRound,
  Pencil,
  Check,
  X,
  HelpCircle,
  ChevronDown,
} from "lucide-react";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

type UnifiedEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  source: "google" | "monday";
  color: string;
  accountEmail?: string;
  duplicateAccounts?: string[]; // all accounts (incl primary) sharing this event
  meta?: any;
};

const ACCOUNT_FILTER_KEY = "unifiedCalendar.hiddenAccounts";
const MONDAY_FILTER_KEY = "unifiedCalendar.hiddenMondaySources";
const PANELS_OPEN_KEY = "unifiedCalendar.panelsOpen";
const HIDE_DUPLICATES_KEY = "unifiedCalendar.hideDuplicates";

// Distinct, accessible palette for per-account coloring
const ACCOUNT_PALETTE = [
  "#4285f4", // google blue
  "#ea4335", // red
  "#34a853", // green
  "#fbbc04", // amber
  "#a142f4", // purple
  "#ff6d01", // orange
  "#24c1e0", // cyan
  "#e91e63", // pink
];

function colorForAccount(email: string | undefined, accounts: string[]): string {
  if (!email) return ACCOUNT_PALETTE[0];
  const idx = accounts.indexOf(email);
  if (idx >= 0) return ACCOUNT_PALETTE[idx % ACCOUNT_PALETTE.length];
  // Fallback: stable hash
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) | 0;
  return ACCOUNT_PALETTE[Math.abs(h) % ACCOUNT_PALETTE.length];
}

function initialsForEmail(email: string | undefined): string {
  if (!email) return "?";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type MondaySource = {
  id: string;
  board_id: string;
  date_column_id: string;
  label: string;
  color: string;
  enabled: boolean;
  person_column_id?: string | null;
  person_id?: string | null;
};

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export default function UnifiedCalendarWidget() {
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [googleAccounts, setGoogleAccounts] = useState<string[]>([]);
  const [googleAccountInfo, setGoogleAccountInfo] = useState<
    { email: string; calendars: number; error?: string; needsReconnect?: boolean }[]
  >([]);
  const [hiddenAccounts, setHiddenAccounts] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(ACCOUNT_FILTER_KEY);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  });
  const [hiddenMondaySources, setHiddenMondaySources] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(MONDAY_FILTER_KEY);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  });
  const [openPanels, setOpenPanels] = useState<{ google: boolean; monday: boolean }>(() => {
    try {
      const raw = localStorage.getItem(PANELS_OPEN_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { google: false, monday: false };
  });
  const [hideDuplicates, setHideDuplicates] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(HIDE_DUPLICATES_KEY);
      return raw === null ? true : raw === "true";
    } catch {
      return true;
    }
  });
  const [mondayConfigured, setMondayConfigured] = useState(false);
  const [mondayError, setMondayError] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [mondaySources, setMondaySources] = useState<MondaySource[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<MondaySource>>({});
  const [showHelp, setShowHelp] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<UnifiedEvent | null>(null);
  const [newSource, setNewSource] = useState({
    board_id: "",
    date_column_id: "",
    label: "",
    color: "#8b5cf6",
    person_column_id: "",
    person_id: "",
  });

  const [newEvent, setNewEvent] = useState({
    summary: "",
    description: "",
    location: "",
    start: "",
    end: "",
    allDay: false,
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [gRes, mRes] = await Promise.all([
        fetch(`${FUNCTIONS_BASE}/google-calendar-events`, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        }).then((r) => r.json()),
        fetch(`${FUNCTIONS_BASE}/monday-calendar-events`, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        }).then((r) => r.json()),
      ]);

      const merged: UnifiedEvent[] = [];

      if (gRes?.connected) {
        setGoogleConnected(true);
        setGoogleEmail(gRes.email || null);
        const accounts: string[] = (gRes.accounts || [])
          .map((a: any) => a.email)
          .filter(Boolean);
        setGoogleAccounts(accounts);
        setGoogleAccountInfo(gRes.accounts || []);
        for (const e of gRes.events || []) {
          merged.push({
            id: e.id,
            title: e.title,
            start: new Date(e.start),
            end: new Date(e.end),
            allDay: e.allDay,
            source: "google",
            color: e.calendarColor || "#4285f4",
            accountEmail: e.accountEmail,
            meta: e,
          });
        }
      } else {
        setGoogleConnected(false);
        setGoogleAccounts([]);
        setGoogleAccountInfo([]);
      }

      if (mRes?.configured) {
        setMondayConfigured(true);
        setMondayError(null);
        for (const e of mRes.events || []) {
          // Surface the most useful field in the title (e.g. "Next Action Step")
          // Falls back to plain item name when no extra context is available.
          const actionField = (e.fields || []).find((f: any) =>
            /next action step|action step|status/i.test(f.label),
          );
          const titlePrefix = actionField ? `${actionField.value} · ` : "";
          merged.push({
            id: e.id,
            title: `${titlePrefix}${e.title}`,
            start: new Date(e.start),
            end: new Date(e.end),
            allDay: e.allDay,
            source: "monday",
            color: e.color || "#8b5cf6",
            meta: e,
          });
        }
      } else {
        setMondayConfigured(false);
        setMondayError(mRes?.error || null);
      }

      setEvents(merged);
    } catch (err) {
      console.error("Calendar load error", err);
      toast.error("Failed to load calendar events");
    } finally {
      setLoading(false);
    }
  };

  const loadSources = async () => {
    const { data } = await supabase
      .from("monday_calendar_sources")
      .select("*")
      .order("created_at", { ascending: false });
    setMondaySources((data || []) as MondaySource[]);
  };

  useEffect(() => {
    loadAll();
    loadSources();
    // Detect google_connected redirect
    if (new URLSearchParams(window.location.search).get("google_connected") === "1") {
      toast.success("Google Calendar connected");
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(loadAll, 500);
    }
  }, []);

  const connectGoogle = async (loginHint?: string) => {
    const popup = window.open("", "_blank");

    if (popup) {
      popup.document.title = "Connecting Google Calendar";
      popup.document.body.innerHTML = `
        <div style="font-family: system-ui, sans-serif; padding: 24px; color: #111827;">
          <p style="margin: 0; font-size: 14px;">Opening Google sign-in…</p>
        </div>
      `;
    }

    try {
      const params = new URLSearchParams({
        action: "start",
        return_to: window.location.pathname,
      });
      if (loginHint) params.set("login_hint", loginHint);
      const res = await fetch(`${FUNCTIONS_BASE}/google-calendar-oauth?${params.toString()}`, {
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      });
      const data = await res.json();
      if (data.error) {
        popup?.close();
        toast.error(data.error);
        return;
      }

      if (!data.auth_url) {
        popup?.close();
        toast.error("Missing Google OAuth URL");
        return;
      }

      if (popup) {
        popup.location.href = data.auth_url;
        return;
      }

      if (window.top && window.top !== window) {
        window.top.location.href = data.auth_url;
        return;
      }

      window.location.href = data.auth_url;
    } catch (err) {
      popup?.close();
      toast.error("Failed to start Google OAuth");
    }
  };

  const addMondaySource = async () => {
    if (!newSource.board_id || !newSource.date_column_id || !newSource.label) {
      toast.error("Board ID, date column ID, and label are required");
      return;
    }
    const payload = {
      ...newSource,
      person_column_id: newSource.person_column_id || null,
      person_id: newSource.person_id || null,
    };
    const { error } = await supabase.from("monday_calendar_sources").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewSource({ board_id: "", date_column_id: "", label: "", color: "#8b5cf6", person_column_id: "", person_id: "" });
    await loadSources();
    await loadAll();
    toast.success("Monday source added");
  };

  const deleteSource = async (id: string) => {
    if (!confirm("Delete this Monday source? Events from this board will disappear from the calendar.")) return;
    await supabase.from("monday_calendar_sources").delete().eq("id", id);
    await loadSources();
    await loadAll();
    toast.success("Source removed");
  };

  const updateSource = async (id: string, patch: Partial<MondaySource>) => {
    const { error } = await supabase.from("monday_calendar_sources").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    await loadSources();
    await loadAll();
    return true;
  };

  const toggleEnabled = async (s: MondaySource) => {
    await updateSource(s.id, { enabled: !s.enabled });
  };

  const createGoogleEvent = async () => {
    if (!newEvent.summary || !newEvent.start || !newEvent.end) {
      toast.error("Title, start, and end are required");
      return;
    }
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/google-calendar-events?action=create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: newEvent.summary,
          description: newEvent.description,
          location: newEvent.location,
          start: new Date(newEvent.start).toISOString(),
          end: new Date(newEvent.end).toISOString(),
          allDay: newEvent.allDay,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Event created in Google Calendar");
      setShowCreate(false);
      setNewEvent({ summary: "", description: "", location: "", start: "", end: "", allDay: false });
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create event");
    }
  };

  const eventStyleGetter = (event: UnifiedEvent) => {
    const accent =
      event.source === "google"
        ? colorForAccount(event.accountEmail, googleAccounts)
        : event.color;
    return {
      style: {
        backgroundColor: `${accent}26`, // ~15% opacity tint
        borderLeft: `3px solid ${accent}`,
        borderTop: "none",
        borderRight: "none",
        borderBottom: "none",
        color: "hsl(var(--foreground))",
        borderRadius: 4,
        fontSize: "0.72rem",
        padding: "1px 6px",
        boxShadow: "none",
      },
    };
  };

  const EventBlock = ({ event }: EventProps<UnifiedEvent>) => {
    const dupes = event.duplicateAccounts || (event.accountEmail ? [event.accountEmail] : []);
    const shown = dupes.slice(0, 3);
    const extra = dupes.length - shown.length;
    const timeLabel = event.allDay
      ? "All day"
      : `${format(event.start, "h:mm a")} – ${format(event.end, "h:mm a")}`;
    const dateLabel = format(event.start, "EEE, MMM d");
    return (
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 overflow-hidden cursor-pointer">
            {event.source === "google" && shown.length > 0 && (
              <span className="flex items-center -space-x-1 shrink-0">
                {shown.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center justify-center text-[8px] font-bold leading-none w-3.5 h-3.5 rounded-full text-white ring-1 ring-background"
                    style={{ backgroundColor: colorForAccount(email, googleAccounts) }}
                  >
                    {initialsForEmail(email)}
                  </span>
                ))}
                {extra > 0 && (
                  <span className="inline-flex items-center justify-center text-[8px] font-bold leading-none w-3.5 h-3.5 rounded-full bg-muted text-muted-foreground ring-1 ring-background">
                    +{extra}
                  </span>
                )}
              </span>
            )}
            <span className="truncate font-medium">{event.title}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1.5">
            <div className="font-semibold text-sm leading-tight">
              {event.meta?.title || event.title}
            </div>
            <div className="text-xs text-muted-foreground">
              {dateLabel} · {timeLabel}
            </div>
            {event.meta?.location && (
              <div className="text-xs">📍 {event.meta.location}</div>
            )}
            {event.source === "google" && dupes.length > 0 && (
              <div className="text-xs pt-1 border-t border-border/40">
                <div className="text-muted-foreground mb-0.5">
                  Shared on {dupes.length} account{dupes.length === 1 ? "" : "s"}:
                </div>
                {dupes.map((email) => (
                  <div key={email} className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: colorForAccount(email, googleAccounts) }}
                    />
                    <span className="truncate">{email}</span>
                  </div>
                ))}
              </div>
            )}
            {event.source === "monday" && event.meta?.sourceLabel && (
              <div className="text-xs pt-1 border-t border-border/40 text-muted-foreground">
                {event.meta.sourceLabel}
                {event.meta?.boardName && ` · ${event.meta.boardName}`}
              </div>
            )}
            <div className="text-[10px] text-muted-foreground/70 pt-1 italic">
              Click to expand
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  const toggleAccount = (email: string) => {
    setHiddenAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      try {
        localStorage.setItem(ACCOUNT_FILTER_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const setAllAccounts = (visible: boolean) => {
    const next = visible ? new Set<string>() : new Set<string>(googleAccounts);
    setHiddenAccounts(next);
    try {
      localStorage.setItem(ACCOUNT_FILTER_KEY, JSON.stringify([...next]));
    } catch {}
  };

  const toggleMondaySource = (id: string) => {
    setHiddenMondaySources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(MONDAY_FILTER_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const setAllMondaySources = (visible: boolean) => {
    const next = visible
      ? new Set<string>()
      : new Set<string>(mondaySources.map((s) => s.id));
    setHiddenMondaySources(next);
    try {
      localStorage.setItem(MONDAY_FILTER_KEY, JSON.stringify([...next]));
    } catch {}
  };

  const togglePanel = (key: "google" | "monday") => {
    setOpenPanels((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(PANELS_OPEN_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Map Monday event id -> source id (events carry sourceLabel; we match by label)
  const mondaySourceByLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of mondaySources) m.set(s.label, s.id);
    return m;
  }, [mondaySources]);

  const visibleEvents = useMemo(() => {
    // 1. Filter by account/source toggles
    const filtered = events.filter((e) => {
      if (e.source === "google") {
        return !e.accountEmail || !hiddenAccounts.has(e.accountEmail);
      }
      if (e.source === "monday") {
        const srcId = mondaySourceByLabel.get(e.meta?.sourceLabel);
        return !srcId || !hiddenMondaySources.has(srcId);
      }
      return true;
    });

    // 2. Dedup Google events sharing identity across accounts.
    //    Fingerprint = title|start|end|allDay (case-insensitive title).
    if (!hideDuplicates) return filtered;

    const groups = new Map<string, UnifiedEvent[]>();
    const passthrough: UnifiedEvent[] = [];
    for (const e of filtered) {
      if (e.source !== "google") {
        passthrough.push(e);
        continue;
      }
      const fp = `${(e.title || "").toLowerCase().trim()}|${e.start.getTime()}|${e.end.getTime()}|${e.allDay ? 1 : 0}`;
      const arr = groups.get(fp) || [];
      arr.push(e);
      groups.set(fp, arr);
    }
    const deduped: UnifiedEvent[] = [...passthrough];
    for (const arr of groups.values()) {
      const primary = arr[0];
      const accounts = Array.from(
        new Set(arr.map((x) => x.accountEmail).filter(Boolean) as string[]),
      );
      deduped.push({ ...primary, duplicateAccounts: accounts });
    }
    return deduped;
  }, [events, hiddenAccounts, hiddenMondaySources, mondaySourceByLabel, hideDuplicates]);

  const totalGoogleCount = useMemo(
    () =>
      events.filter(
        (e) => e.source === "google" && (!e.accountEmail || !hiddenAccounts.has(e.accountEmail)),
      ).length,
    [events, hiddenAccounts],
  );
  const visibleGoogleCount = useMemo(
    () => visibleEvents.filter((e) => e.source === "google").length,
    [visibleEvents],
  );
  const duplicatesHiddenCount = Math.max(0, totalGoogleCount - visibleGoogleCount);

  const toggleHideDuplicates = () => {
    setHideDuplicates((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HIDE_DUPLICATES_KEY, String(next));
      } catch {}
      return next;
    });
  };

  const upcoming = useMemo(
    () =>
      [...visibleEvents]
        .filter((e) => e.start >= new Date(Date.now() - 24 * 60 * 60 * 1000))
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .slice(0, 30),
    [visibleEvents],
  );

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="w-5 h-5 text-primary" /> Unified Calendar
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowSettings(true)}>
            <SettingsIcon className="w-4 h-4" />
          </Button>
          {googleConnected && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> New Event
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Status pills */}
        <div className="flex flex-wrap gap-2 mb-4 text-xs">
          <span
            className={`px-2 py-1 rounded ${
              googleConnected
                ? "bg-green-500/20 text-green-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            Google: {googleConnected ? googleEmail || "connected" : "not connected"}
          </span>
          <span
            className={`px-2 py-1 rounded ${
              mondayError
                ? "bg-destructive/20 text-destructive"
                : mondayConfigured && mondaySources.length > 0
                ? "bg-green-500/20 text-green-400"
                : "bg-muted text-muted-foreground"
            }`}
            title={mondayError || ""}
          >
            Monday: {mondayError ? "token missing" : mondaySources.length > 0 ? `${mondaySources.length} board(s)` : "no sources"}
          </span>
          {!googleConnected && (
            <Button size="sm" variant="outline" onClick={() => connectGoogle()}>
              <LinkIcon className="w-3 h-3 mr-1" /> Connect Google
            </Button>
          )}
          {googleConnected && (
            <Button size="sm" variant="outline" onClick={() => connectGoogle()}>
              <LinkIcon className="w-3 h-3 mr-1" /> Add Account
            </Button>
          )}
        </div>

        {/* Source filter dropdowns */}
        <div className="mb-4 space-y-2">
          {/* Dedup toggle */}
          {googleAccounts.length > 1 && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card/40 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Hide duplicates
                </span>
                <span className="text-[11px] text-muted-foreground/80 truncate">
                  Same event on multiple Google calendars
                  {hideDuplicates && duplicatesHiddenCount > 0 && (
                    <> · <span className="text-primary">{duplicatesHiddenCount} hidden</span></>
                  )}
                </span>
              </div>
              <Switch checked={hideDuplicates} onCheckedChange={toggleHideDuplicates} />
            </div>
          )}

          {/* Google Accounts dropdown */}
          {googleAccounts.length > 0 && (
            <div className="rounded-md border border-border bg-card/40">
              <button
                type="button"
                onClick={() => togglePanel("google")}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-card/60 transition-colors"
              >
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Google Accounts
                  <span className="text-[10px] normal-case tracking-normal text-muted-foreground/70">
                    ({googleAccounts.length - hiddenAccounts.size}/{googleAccounts.length} visible)
                  </span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${
                    openPanels.google ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openPanels.google && (
                <div className="px-3 pb-3 pt-1 border-t border-border">
                  <div className="flex justify-end gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setAllAccounts(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Show all
                    </button>
                    <span className="text-xs text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={() => setAllAccounts(false)}
                      className="text-xs text-primary hover:underline"
                    >
                      Hide all
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {googleAccounts.map((email) => {
                      const checked = !hiddenAccounts.has(email);
                      const color = colorForAccount(email, googleAccounts);
                      const info = googleAccountInfo.find((a) => a.email === email);
                      const broken = !!info?.needsReconnect || (info?.calendars ?? 0) === 0;
                      return (
                        <div key={email} className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-sm cursor-pointer select-none min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAccount(email)}
                              className="w-4 h-4 rounded accent-primary"
                            />
                            <span
                              className="inline-flex items-center justify-center text-[10px] font-bold w-5 h-5 rounded text-white shrink-0"
                              style={{ backgroundColor: color, opacity: checked ? 1 : 0.4 }}
                              title={email}
                            >
                              {initialsForEmail(email)}
                            </span>
                            <span className={`truncate ${checked ? "" : "text-muted-foreground line-through"}`}>
                              {email}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              · {info?.calendars ?? 0} cal{(info?.calendars ?? 0) === 1 ? "" : "s"}
                            </span>
                            {broken && (
                              <span className="text-xs text-destructive shrink-0" title={info?.error || ""}>
                                ⚠ {info?.error ? "error" : "no calendars"}
                              </span>
                            )}
                          </label>
                          {broken && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs shrink-0"
                              onClick={() => connectGoogle(email)}
                            >
                              <LinkIcon className="w-3 h-3 mr-1" /> Reconnect
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Monday Sources dropdown */}
          {mondaySources.length > 0 && (
            <div className="rounded-md border border-border bg-card/40">
              <button
                type="button"
                onClick={() => togglePanel("monday")}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-card/60 transition-colors"
              >
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Monday Views
                  <span className="text-[10px] normal-case tracking-normal text-muted-foreground/70">
                    ({mondaySources.length - hiddenMondaySources.size}/{mondaySources.length} visible)
                  </span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground transition-transform ${
                    openPanels.monday ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openPanels.monday && (
                <div className="px-3 pb-3 pt-1 border-t border-border">
                  <div className="flex justify-end gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setAllMondaySources(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Show all
                    </button>
                    <span className="text-xs text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={() => setAllMondaySources(false)}
                      className="text-xs text-primary hover:underline"
                    >
                      Hide all
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {mondaySources.map((s) => {
                      const checked = !hiddenMondaySources.has(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 text-sm cursor-pointer select-none min-w-0"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMondaySource(s.id)}
                            className="w-4 h-4 rounded accent-primary"
                          />
                          <span
                            className="inline-block w-5 h-5 rounded shrink-0"
                            style={{ backgroundColor: s.color, opacity: checked ? 1 : 0.4 }}
                            title={s.label}
                          />
                          <span className={`truncate ${checked ? "" : "text-muted-foreground line-through"}`}>
                            {s.label}
                          </span>
                          {!s.enabled && (
                            <span className="text-[10px] text-muted-foreground shrink-0">(disabled)</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>


        {/* View toggle */}
        <Tabs value={view} onValueChange={(v) => setView(v as View)} className="mb-3">
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="agenda">Upcoming</TabsTrigger>
          </TabsList>
        </Tabs>

        {view === "agenda" ? (
          <div className="max-h-[500px] overflow-y-auto space-y-2">
            {upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No upcoming events.
              </p>
            )}
            {upcoming.map((e) => {
              const accentColor =
                e.source === "google"
                  ? colorForAccount(e.accountEmail, googleAccounts)
                  : e.color;
              const dupes = e.duplicateAccounts || (e.accountEmail ? [e.accountEmail] : []);
              const shown = dupes.slice(0, 4);
              const extra = dupes.length - shown.length;
              return (
                <div
                  key={e.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-card/50 hover:bg-card/80 hover:border-border transition-colors cursor-pointer"
                  onClick={() => {
                    if (e.source === "monday") setSelectedMondayEvent(e);
                    else if (e.meta?.htmlLink) window.open(e.meta.htmlLink, "_blank");
                  }}
                >
                  <div
                    className="w-1 self-stretch rounded"
                    style={{ backgroundColor: accentColor }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {e.source === "google" && shown.length > 0 && (
                        <span className="flex items-center -space-x-1 shrink-0">
                          {shown.map((email) => (
                            <span
                              key={email}
                              className="inline-flex items-center justify-center text-[9px] font-bold w-5 h-5 rounded-full text-white ring-2 ring-card"
                              style={{ backgroundColor: colorForAccount(email, googleAccounts) }}
                              title={email}
                            >
                              {initialsForEmail(email)}
                            </span>
                          ))}
                          {extra > 0 && (
                            <span
                              className="inline-flex items-center justify-center text-[9px] font-bold w-5 h-5 rounded-full bg-muted text-muted-foreground ring-2 ring-card"
                              title={`+${extra} more accounts`}
                            >
                              +{extra}
                            </span>
                          )}
                        </span>
                      )}
                      <div className="font-medium text-sm truncate">{e.title}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(e.start, "EEE MMM d, h:mm a")}
                      {!e.allDay && ` – ${format(e.end, "h:mm a")}`}
                    </div>
                    {dupes.length > 1 ? (
                      <div className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">
                        Shared across {dupes.length} accounts
                      </div>
                    ) : e.accountEmail ? (
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {e.accountEmail}
                      </div>
                    ) : null}
                    {e.meta?.location && (
                      <div className="text-xs text-muted-foreground mt-1">
                        📍 {e.meta.location}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] uppercase text-muted-foreground shrink-0">
                    {e.source}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="unified-cal bg-background rounded-lg border border-border/60 p-2" style={{ height: 600 }}>
            <Calendar
              localizer={localizer}
              events={visibleEvents}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              views={["month", "week", "day"]}
              eventPropGetter={eventStyleGetter}
              components={{ event: EventBlock }}
              style={{ height: "100%" }}
              popup
              onSelectEvent={(e: UnifiedEvent) => {
                if (e.source === "monday") {
                  setSelectedMondayEvent(e);
                } else if (e.meta?.htmlLink) {
                  window.open(e.meta.htmlLink, "_blank");
                }
              }}
            />
          </div>
        )}
      </CardContent>

      {/* Settings dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Calendar Sources</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <section>
              <h3 className="font-medium mb-2">Google Calendar</h3>
              {googleConnected ? (
                <p className="text-sm text-muted-foreground">
                  Connected as <span className="text-foreground">{googleEmail}</span>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => connectGoogle()} size="sm">
                    <LinkIcon className="w-4 h-4 mr-1" /> Connect Google Calendar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      toast.info(
                        'In the Lovable chat, send: "add secrets GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET"',
                        { duration: 8000 },
                      )
                    }
                  >
                    <KeyRound className="w-4 h-4 mr-1" /> Add Google Secrets
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Need GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET configured before connecting.
              </p>
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Monday.com Boards</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast.info(
                      'In the Lovable chat, send: "add secret MONDAY_API_TOKEN"',
                      { duration: 8000 },
                    )
                  }
                >
                  <KeyRound className="w-4 h-4 mr-1" /> Add Monday Token
                </Button>
              </div>
              <div className="space-y-2 mb-4">
                {mondaySources.map((s) => {
                  const isEditing = editingId === s.id;
                  if (isEditing) {
                    return (
                      <div key={s.id} className="p-3 border rounded space-y-2 bg-muted/30">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Label</Label>
                            <Input
                              value={editDraft.label ?? ""}
                              onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Color</Label>
                            <Input
                              type="color"
                              value={editDraft.color ?? "#8b5cf6"}
                              onChange={(e) => setEditDraft({ ...editDraft, color: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Board ID</Label>
                            <Input
                              value={editDraft.board_id ?? ""}
                              onChange={(e) => setEditDraft({ ...editDraft, board_id: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Date Column ID</Label>
                            <Input
                              value={editDraft.date_column_id ?? ""}
                              onChange={(e) => setEditDraft({ ...editDraft, date_column_id: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Person Column ID <span className="text-muted-foreground">(optional filter)</span></Label>
                            <Input
                              value={editDraft.person_column_id ?? ""}
                              onChange={(e) => setEditDraft({ ...editDraft, person_column_id: e.target.value })}
                              placeholder="e.g. lead_owner"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Person ID <span className="text-muted-foreground">(Monday user ID)</span></Label>
                            <Input
                              value={editDraft.person_id ?? ""}
                              onChange={(e) => setEditDraft({ ...editDraft, person_id: e.target.value })}
                              placeholder="e.g. 54492562"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditDraft({}); }}>
                            <X className="w-4 h-4 mr-1" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={async () => {
                              if (!editDraft.label || !editDraft.board_id || !editDraft.date_column_id) {
                                toast.error("Label, board ID, and date column ID are required");
                                return;
                              }
                              const ok = await updateSource(s.id, editDraft);
                              if (ok) {
                                setEditingId(null);
                                setEditDraft({});
                                toast.success("Source updated");
                              }
                            }}
                          >
                            <Check className="w-4 h-4 mr-1" /> Save
                          </Button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-2 p-2 border rounded ${s.enabled ? "" : "opacity-50"}`}
                    >
                      <div
                        className="w-3 h-3 rounded shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <div className="flex-1 text-sm min-w-0">
                        <div className="font-medium truncate">{s.label}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          Board {s.board_id} · col {s.date_column_id}
                        </div>
                      </div>
                      <Switch
                        checked={s.enabled}
                        onCheckedChange={() => toggleEnabled(s)}
                        title={s.enabled ? "Enabled — click to hide" : "Disabled — click to show"}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(s.id);
                          setEditDraft({
                            label: s.label,
                            color: s.color,
                            board_id: s.board_id,
                            date_column_id: s.date_column_id,
                            person_column_id: s.person_column_id ?? "",
                            person_id: s.person_id ?? "",
                          });
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteSource(s.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
                {mondaySources.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No Monday boards configured yet. Add one below.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 border rounded">
                <div className="col-span-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Add a new board</span>
                  <button
                    type="button"
                    onClick={() => setShowHelp((v) => !v)}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <HelpCircle className="w-3 h-3" /> {showHelp ? "Hide" : "How do I find these?"}
                  </button>
                </div>
                {showHelp && (
                  <div className="col-span-2 text-xs text-muted-foreground bg-muted/40 p-2 rounded space-y-1">
                    <p><strong>Board ID:</strong> open the board in Monday → look at the URL: <code>monday.com/boards/<b>123456789</b></code> — the number is the board ID.</p>
                    <p><strong>Date Column ID:</strong> on the board, click the <strong>⋯</strong> menu next to the date column → <strong>Customize column</strong> → the ID appears (e.g. <code>date4</code>, <code>date_1</code>). Or board menu → <strong>Developers → Column IDs</strong>.</p>
                    <p><strong>Label:</strong> a friendly name shown next to events on the calendar (e.g. "Gigs", "Holds", "Inquiries").</p>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={newSource.label}
                    onChange={(e) =>
                      setNewSource({ ...newSource, label: e.target.value })
                    }
                    placeholder="e.g. Gigs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Color</Label>
                  <Input
                    type="color"
                    value={newSource.color}
                    onChange={(e) =>
                      setNewSource({ ...newSource, color: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Board ID</Label>
                  <Input
                    value={newSource.board_id}
                    onChange={(e) =>
                      setNewSource({ ...newSource, board_id: e.target.value })
                    }
                    placeholder="123456789"
                  />
                </div>
                <div>
                  <Label className="text-xs">Date Column ID</Label>
                  <Input
                    value={newSource.date_column_id}
                    onChange={(e) =>
                      setNewSource({ ...newSource, date_column_id: e.target.value })
                    }
                    placeholder="date4"
                  />
                </div>
                <div>
                  <Label className="text-xs">Person Column ID <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    value={newSource.person_column_id}
                    onChange={(e) => setNewSource({ ...newSource, person_column_id: e.target.value })}
                    placeholder="e.g. lead_owner"
                  />
                </div>
                <div>
                  <Label className="text-xs">Person ID <span className="text-muted-foreground">(Monday user ID)</span></Label>
                  <Input
                    value={newSource.person_id}
                    onChange={(e) => setNewSource({ ...newSource, person_id: e.target.value })}
                    placeholder="e.g. 54492562"
                  />
                </div>
                <Button onClick={addMondaySource} className="col-span-2" size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Add Source
                </Button>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create event dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Google Calendar Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={newEvent.summary}
                onChange={(e) => setNewEvent({ ...newEvent, summary: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Start</Label>
                <Input
                  type="datetime-local"
                  value={newEvent.start}
                  onChange={(e) => setNewEvent({ ...newEvent, start: e.target.value })}
                />
              </div>
              <div>
                <Label>End</Label>
                <Input
                  type="datetime-local"
                  value={newEvent.end}
                  onChange={(e) => setNewEvent({ ...newEvent, end: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <Input
                value={newEvent.location}
                onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newEvent.description}
                onChange={(e) =>
                  setNewEvent({ ...newEvent, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={createGoogleEvent}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Monday item detail dialog */}
      <Dialog open={!!selectedMondayEvent} onOpenChange={(o) => !o && setSelectedMondayEvent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2 pr-6">
              <span
                className="w-1 self-stretch rounded shrink-0 mt-1"
                style={{ backgroundColor: selectedMondayEvent?.color }}
              />
              <span>{selectedMondayEvent?.meta?.title || selectedMondayEvent?.title}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedMondayEvent && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <span
                  className="px-2 py-0.5 rounded text-white"
                  style={{ backgroundColor: selectedMondayEvent.color }}
                >
                  {selectedMondayEvent.meta?.sourceLabel}
                </span>
                {selectedMondayEvent.meta?.boardName && (
                  <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {selectedMondayEvent.meta.boardName}
                  </span>
                )}
                {selectedMondayEvent.meta?.groupTitle && (
                  <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {selectedMondayEvent.meta.groupTitle}
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                📅 {format(selectedMondayEvent.start, "EEEE, MMMM d, yyyy")}
                {!selectedMondayEvent.allDay &&
                  ` at ${format(selectedMondayEvent.start, "h:mm a")}`}
              </div>
              {selectedMondayEvent.meta?.fields?.length > 0 && (
                <div className="border-t border-border pt-3">
                  <div className="grid grid-cols-1 gap-2">
                    {selectedMondayEvent.meta.fields.map((f: any) => (
                      <div
                        key={f.columnId}
                        className="flex items-start justify-between gap-3 text-sm py-1 border-b border-border/40 last:border-0"
                      >
                        <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0 w-1/3">
                          {f.label}
                        </span>
                        <span className="text-foreground text-right break-words flex-1">
                          {f.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMondayEvent(null)}>
              Close
            </Button>
            {selectedMondayEvent?.meta?.itemUrl && (
              <Button onClick={() => window.open(selectedMondayEvent.meta.itemUrl, "_blank")}>
                <LinkIcon className="w-4 h-4 mr-1" /> Open in Monday
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
