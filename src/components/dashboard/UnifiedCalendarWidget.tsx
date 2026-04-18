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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  SlidersHorizontal,
} from "lucide-react";
import ColorSwatchPicker from "./ColorSwatchPicker";

const COLOR_OVERRIDES_KEY = "unifiedCalendar.colorOverrides";

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
  source: "google" | "monday" | "social" | "djep";
  color: string;
  accountEmail?: string;
  duplicateAccounts?: string[]; // all accounts (incl primary) sharing this event
  brandId?: string; // for social posts
  meta?: any;
};

// DJEP is a single logical source; we treat it like a one-item group in the
// Sources & Filters panel so it matches the visual pattern of other sources.
const DJEP_SOURCE_ID = "djep-leads";
const DJEP_FILTER_KEY = "unifiedCalendar.hiddenDjepSources";

// Parse event dates safely. Google all-day events use "YYYY-MM-DD" with an
// EXCLUSIVE end date — naive `new Date()` parses these as UTC midnight which
// shifts to the prior/next day in local time, making 1-day events span 2 days.
function parseEventDate(value: string, allDay?: boolean, isEnd = false): Date {
  if (allDay && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split("-").map(Number);
    // Google's end date is exclusive; subtract one day so the event renders
    // on its actual final day rather than spilling into the next.
    const day = isEnd ? d - 1 : d;
    return new Date(y, m - 1, day);
  }
  return new Date(value);
}

const ACCOUNT_FILTER_KEY = "unifiedCalendar.hiddenAccounts";
const MONDAY_FILTER_KEY = "unifiedCalendar.hiddenMondaySources";
const SOCIAL_FILTER_KEY = "unifiedCalendar.hiddenSocialBrands";
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

// Google Calendar's standard per-event color palette (colorId "1".."11").
// We adopt these so events colored inside Google appear consistent here.
const GOOGLE_EVENT_COLORS: Record<string, string> = {
  "1": "#7986cb", // Lavender
  "2": "#33b679", // Sage
  "3": "#8e24aa", // Grape
  "4": "#e67c73", // Flamingo
  "5": "#f6c026", // Banana
  "6": "#f5511d", // Tangerine
  "7": "#039be5", // Peacock
  "8": "#616161", // Graphite
  "9": "#3f51b5", // Blueberry
  "10": "#0b8043", // Basil
  "11": "#d60000", // Tomato
};

const PREFERRED_COLOR_ACCOUNT = "joshmillermanagement@gmail.com";

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
  skip_groups?: string;
};

type SocialBrand = {
  id: string;
  slug: string;
  name: string;
  color: string;
};

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export default function UnifiedCalendarWidget() {
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [djepLoading, setDjepLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
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
  const [hiddenSocialBrands, setHiddenSocialBrands] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(SOCIAL_FILTER_KEY);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  });
  const [hiddenDjepSources, setHiddenDjepSources] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(DJEP_FILTER_KEY);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  });
  const [djepRefreshedAt, setDjepRefreshedAt] = useState<string | null>(null);

  // Color overrides keyed by `${kind}:${id}` — e.g. "google:foo@bar.com",
  // "monday:<sourceId>", "social:<brandId>", "djep:default".
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(COLOR_OVERRIDES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const setColorOverride = (key: string, color: string) => {
    setColorOverrides((prev) => {
      const next = { ...prev, [key]: color };
      try { localStorage.setItem(COLOR_OVERRIDES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const resetColorOverride = (key: string) => {
    setColorOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      try { localStorage.setItem(COLOR_OVERRIDES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const [openPanels, setOpenPanels] = useState<{ google: boolean; monday: boolean; social: boolean; djep: boolean }>(() => {
    try {
      const raw = localStorage.getItem(PANELS_OPEN_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { google: !!parsed.google, monday: !!parsed.monday, social: !!parsed.social, djep: !!parsed.djep };
      }
    } catch {}
    return { google: false, monday: false, social: false, djep: false };
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
  const [socialBrands, setSocialBrands] = useState<SocialBrand[]>([]);
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
    skip_groups: "",
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
      const [gRes, mRes, dRes] = await Promise.all([
        fetch(`${FUNCTIONS_BASE}/google-calendar-events`, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        }).then((r) => r.json()),
        fetch(`${FUNCTIONS_BASE}/monday-calendar-events`, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        }).then((r) => r.json()),
        fetch(`${FUNCTIONS_BASE}/djep-calendar-events`, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        }).then((r) => r.json()).catch(() => ({ events: [] })),
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
            start: parseEventDate(e.start, e.allDay),
            end: parseEventDate(e.end, e.allDay, true),
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
            start: parseEventDate(e.start, e.allDay),
            end: parseEventDate(e.end, e.allDay, true),
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

      // DJEP leads — cached server-side; failures are silent so the rest
      // of the calendar still loads.
      if (dRes?.refreshed_at) setDjepRefreshedAt(dRes.refreshed_at);
      for (const e of dRes?.events || []) {
        merged.push({
          id: e.id,
          title: e.title,
          start: parseEventDate(e.start, e.allDay),
          end: parseEventDate(e.end, e.allDay, true),
          allDay: e.allDay,
          source: "djep",
          color: e.color || "#10b981",
          meta: e,
        });
      }

      // Preserve any social events already loaded by loadSocial
      setEvents((prev) => [...merged, ...prev.filter((e) => e.source === "social")]);
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

  const loadSocial = async () => {
    const [brandsRes, postsRes] = await Promise.all([
      supabase.from("social_brands").select("id,slug,name,color").order("sort_order"),
      // Pull every post — we'll show any with a date (scheduled OR posted)
      supabase
        .from("social_posts")
        .select("id,brand_id,title,scheduled_for,posted_at,status,captions,asset_urls,notes"),
    ]);
    const brands = (brandsRes.data || []) as SocialBrand[];
    setSocialBrands(brands);
    const brandById = new Map(brands.map((b) => [b.id, b]));
    const socialEvents: UnifiedEvent[] = [];
    for (const p of (postsRes.data || []) as any[]) {
      const brand = brandById.get(p.brand_id as string);
      if (!brand) continue;
      // Use scheduled_for if present, else posted_at — any date on the card
      const dateStr: string | null = p.scheduled_for || p.posted_at || null;
      if (!dateStr) continue;
      const start = new Date(dateStr);
      if (isNaN(start.getTime())) continue;
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      const statusEmoji = p.status === "posted" ? "✅ " : p.status === "scheduled" ? "📅 " : "✏️ ";
      socialEvents.push({
        id: `social-${p.id}`,
        title: `${statusEmoji}${brand.name} · ${p.title}`,
        start,
        end,
        allDay: false,
        source: "social",
        color: brand.color || "#8b5cf6",
        brandId: brand.id,
        meta: { ...p, brandName: brand.name, brandSlug: brand.slug },
      });
    }
    console.log("[UnifiedCalendar] social events loaded:", socialEvents.length, socialEvents);
    // Merge: replace any existing social events
    setEvents((prev) => [...prev.filter((e) => e.source !== "social"), ...socialEvents]);
  };

  useEffect(() => {
    loadAll();
    loadSources();
    loadSocial();
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
    setNewSource({ board_id: "", date_column_id: "", label: "", color: "#8b5cf6", person_column_id: "", person_id: "", skip_groups: "" });
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

  const refreshDjep = async () => {
    setDjepLoading(true);
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/djep-calendar-events?refresh=1`, {
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      });
      const data = await res.json();
      if (data.error) {
        toast.error(`DJEP refresh failed: ${data.error}`);
        return;
      }
      const count = Array.isArray(data.events) ? data.events.length : 0;
      toast.success(`DJEP refreshed — ${count} event${count === 1 ? "" : "s"}`);
      await loadAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "DJEP refresh failed");
    } finally {
      setDjepLoading(false);
    }
  };

  const refreshSocial = async () => {
    setSocialLoading(true);
    try {
      await loadSocial();
      toast.success("Social posts refreshed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Social refresh failed");
    } finally {
      setSocialLoading(false);
    }
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

  // Returns { body, stripe } where:
  //   body  = main fill (adopts Google per-event color when available, with
  //           preference for the joshmillermanagement view of that event)
  //   stripe = thin top stripe showing which calendar/source it belongs to
  const colorsForEvent = (event: UnifiedEvent) => {
    // Resolve override key per source so users can recolor calendar stripes.
    let overrideKey: string | null = null;
    if (event.source === "google" && event.accountEmail) overrideKey = `google:${event.accountEmail}`;
    else if (event.source === "monday") {
      const src = mondaySources.find((s) => s.label === event.meta?.sourceLabel);
      if (src) overrideKey = `monday:${src.id}`;
    } else if (event.source === "social" && event.brandId) overrideKey = `social:${event.brandId}`;
    else if (event.source === "djep") overrideKey = `djep:default`;

    const naturalStripe =
      event.source === "google"
        ? colorForAccount(event.accountEmail, googleAccounts)
        : event.color;
    const stripe = (overrideKey && colorOverrides[overrideKey]) || naturalStripe;

    let body = stripe;
    if (event.source === "google") {
      const m = event.meta || {};
      const colorId = m.preferredColorId || m.eventColorId;
      if (colorId && GOOGLE_EVENT_COLORS[colorId]) {
        body = GOOGLE_EVENT_COLORS[colorId];
      }
    }
    return { body, stripe };
  };

  const eventStyleGetter = (event: UnifiedEvent) => {
    const { body, stripe } = colorsForEvent(event);
    return {
      style: {
        backgroundColor: `${body}66`, // ~40% opacity for contrast
        borderTop: `3px solid ${stripe}`,
        borderLeft: "none",
        borderRight: "none",
        borderBottom: "none",
        color: "#ffffff",
        textShadow: "0 1px 2px rgba(0,0,0,0.6)",
        borderRadius: 4,
        fontSize: "0.72rem",
        fontWeight: 500,
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

  const toggleSocialBrand = (id: string) => {
    setHiddenSocialBrands((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(SOCIAL_FILTER_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const setAllSocialBrands = (visible: boolean) => {
    const next = visible
      ? new Set<string>()
      : new Set<string>(socialBrands.map((b) => b.id));
    setHiddenSocialBrands(next);
    try {
      localStorage.setItem(SOCIAL_FILTER_KEY, JSON.stringify([...next]));
    } catch {}
  };

  const toggleDjepSource = () => {
    setHiddenDjepSources((prev) => {
      const next = new Set(prev);
      if (next.has(DJEP_SOURCE_ID)) next.delete(DJEP_SOURCE_ID);
      else next.add(DJEP_SOURCE_ID);
      try {
        localStorage.setItem(DJEP_FILTER_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const togglePanel = (key: "google" | "monday" | "social" | "djep") => {
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
      if (e.source === "social") {
        return !e.brandId || !hiddenSocialBrands.has(e.brandId);
      }
      if (e.source === "djep") {
        return !hiddenDjepSources.has(DJEP_SOURCE_ID);
      }
      return true;
    });

    // 2. Dedup Google events sharing identity across accounts.
    //    Fingerprint = title|YYYY-MM-DD(start day) — looser than exact times so
    //    that the same event mirrored across calendars with slightly different
    //    timing or all-day vs timed still collapses into a single chip.
    if (!hideDuplicates) return filtered;

    const dayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const groups = new Map<string, UnifiedEvent[]>();
    const passthrough: UnifiedEvent[] = [];
    for (const e of filtered) {
      if (e.source !== "google") {
        passthrough.push(e);
        continue;
      }
      const fp = `${(e.title || "").toLowerCase().trim()}|${dayKey(e.start)}`;
      const arr = groups.get(fp) || [];
      arr.push(e);
      groups.set(fp, arr);
    }
    const deduped: UnifiedEvent[] = [...passthrough];
    for (const arr of groups.values()) {
      // Pick the OWNER as primary so chip color/account reflects who created
      // the event, not whichever calendar happened to load first.
      // Priority:
      //   1. Account where this user is the organizer of the event
      //   2. Account where this user is the creator
      //   3. Account whose primary calendar holds the event
      //   4. First event (stable fallback)
      const score = (e: UnifiedEvent) => {
        const m = e.meta || {};
        if (m.organizerSelf || m.organizerEmail === e.accountEmail) return 4;
        if (m.creatorSelf || m.creatorEmail === e.accountEmail) return 3;
        if (m.isPrimaryCalendar) return 2;
        return 1;
      };
      const primary = [...arr].sort((a, b) => score(b) - score(a))[0];
      const accounts = Array.from(
        new Set(arr.map((x) => x.accountEmail).filter(Boolean) as string[]),
      );
      // Move primary's account to the front of the shared list
      if (primary.accountEmail) {
        const i = accounts.indexOf(primary.accountEmail);
        if (i > 0) {
          accounts.splice(i, 1);
          accounts.unshift(primary.accountEmail);
        }
      }
      // Find the joshmillermanagement instance (if any) for color preference.
      const preferred = arr.find((x) => x.accountEmail === PREFERRED_COLOR_ACCOUNT);
      const preferredColorId = preferred?.meta?.eventColorId || null;
      deduped.push({
        ...primary,
        duplicateAccounts: accounts,
        meta: { ...(primary.meta || {}), preferredColorId },
      });
    }
    return deduped;
  }, [events, hiddenAccounts, hiddenMondaySources, hiddenSocialBrands, hiddenDjepSources, mondaySourceByLabel, hideDuplicates]);

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

        {/* Source filter dropdowns — collapsed into a popover to save space */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="mb-4 gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Sources & Filters
              <span className="text-[10px] text-muted-foreground normal-case">
                ({googleAccounts.length + mondaySources.length + socialBrands.length} configured)
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[min(95vw,520px)] max-h-[70vh] overflow-y-auto p-3 space-y-2"
          >
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
              <div className="w-full flex items-center justify-between pl-3 pr-2 py-1.5 hover:bg-card/60 transition-colors">
                <button
                  type="button"
                  onClick={() => togglePanel("google")}
                  className="flex-1 flex items-center justify-between text-left"
                >
                  <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Google Accounts
                    <span className="text-[10px] normal-case tracking-normal text-muted-foreground/70">
                      ({googleAccounts.length - hiddenAccounts.size}/{googleAccounts.length} visible)
                    </span>
                  </span>
                </button>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); loadAll(); }}
                    disabled={loading}
                    title="Refresh Google Calendar"
                    className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePanel("google")}
                    className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${openPanels.google ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>
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
                      const overrideKey = `google:${email}`;
                      const naturalColor = colorForAccount(email, googleAccounts);
                      const color = colorOverrides[overrideKey] || naturalColor;
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
                            <ColorSwatchPicker
                              color={color}
                              hasOverride={!!colorOverrides[overrideKey]}
                              onChange={(c) => setColorOverride(overrideKey, c)}
                              onReset={() => resetColorOverride(overrideKey)}
                              dimmed={!checked}
                              title={email}
                            >
                              {initialsForEmail(email)}
                            </ColorSwatchPicker>
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
              <div className="w-full flex items-center justify-between pl-3 pr-2 py-1.5 hover:bg-card/60 transition-colors">
                <button
                  type="button"
                  onClick={() => togglePanel("monday")}
                  className="flex-1 flex items-center justify-between text-left"
                >
                  <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Monday Views
                    <span className="text-[10px] normal-case tracking-normal text-muted-foreground/70">
                      ({mondaySources.length - hiddenMondaySources.size}/{mondaySources.length} visible)
                    </span>
                  </span>
                </button>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); loadAll(); }}
                    disabled={loading}
                    title="Refresh Monday views"
                    className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePanel("monday")}
                    className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${openPanels.monday ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>
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
                      const overrideKey = `monday:${s.id}`;
                      const color = colorOverrides[overrideKey] || s.color;
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
                          <ColorSwatchPicker
                            color={color}
                            hasOverride={!!colorOverrides[overrideKey]}
                            onChange={(c) => setColorOverride(overrideKey, c)}
                            onReset={() => resetColorOverride(overrideKey)}
                            dimmed={!checked}
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

          {/* Social Brands dropdown */}
          {socialBrands.length > 0 && (
            <div className="rounded-md border border-border bg-card/40">
              <div className="w-full flex items-center justify-between pl-3 pr-2 py-1.5 hover:bg-card/60 transition-colors">
                <button
                  type="button"
                  onClick={() => togglePanel("social")}
                  className="flex-1 flex items-center justify-between text-left"
                >
                  <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Social Brands
                    <span className="text-[10px] normal-case tracking-normal text-muted-foreground/70">
                      ({socialBrands.length - hiddenSocialBrands.size}/{socialBrands.length} visible)
                    </span>
                  </span>
                </button>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); refreshSocial(); }}
                    disabled={socialLoading}
                    title="Refresh social posts"
                    className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${socialLoading ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePanel("social")}
                    className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${openPanels.social ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>
              {openPanels.social && (
                <div className="px-3 pb-3 pt-1 border-t border-border">
                  <div className="flex justify-end gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setAllSocialBrands(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Show all
                    </button>
                    <span className="text-xs text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={() => setAllSocialBrands(false)}
                      className="text-xs text-primary hover:underline"
                    >
                      Hide all
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {socialBrands.map((b) => {
                      const checked = !hiddenSocialBrands.has(b.id);
                      const overrideKey = `social:${b.id}`;
                      const color = colorOverrides[overrideKey] || b.color;
                      return (
                        <label
                          key={b.id}
                          className="flex items-center gap-2 text-sm cursor-pointer select-none min-w-0"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSocialBrand(b.id)}
                            className="w-4 h-4 rounded accent-primary"
                          />
                          <ColorSwatchPicker
                            color={color}
                            hasOverride={!!colorOverrides[overrideKey]}
                            onChange={(c) => setColorOverride(overrideKey, c)}
                            onReset={() => resetColorOverride(overrideKey)}
                            dimmed={!checked}
                            title={b.name}
                          />
                          <span className={`truncate ${checked ? "" : "text-muted-foreground line-through"}`}>
                            {b.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DJEP Leads — single-source toggle plus refresh button */}
          <div className="rounded-md border border-border bg-card/40">
            <div className="w-full flex items-center justify-between pl-3 pr-2 py-1.5 hover:bg-card/60 transition-colors">
              <button
                type="button"
                onClick={() => togglePanel("djep")}
                className="flex-1 flex items-center justify-between text-left"
              >
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  DJEP Leads
                  <span className="text-[10px] normal-case tracking-normal text-muted-foreground/70">
                    ({hiddenDjepSources.has(DJEP_SOURCE_ID) ? 0 : 1}/1 visible)
                  </span>
                </span>
              </button>
              <div className="flex items-center gap-1 ml-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); refreshDjep(); }}
                  disabled={djepLoading}
                  title="Re-scrape DJEP (30–60s)"
                  className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${djepLoading ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => togglePanel("djep")}
                  className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${openPanels.djep ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
            </div>
            {openPanels.djep && (
              <div className="px-3 pb-3 pt-1 border-t border-border space-y-2">
                {(() => {
                  const checked = !hiddenDjepSources.has(DJEP_SOURCE_ID);
                  const count = events.filter((e) => e.source === "djep").length;
                  const overrideKey = `djep:default`;
                  const color = colorOverrides[overrideKey] || "#10b981";
                  return (
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={toggleDjepSource}
                        className="w-4 h-4 rounded accent-primary"
                      />
                      <ColorSwatchPicker
                        color={color}
                        hasOverride={!!colorOverrides[overrideKey]}
                        onChange={(c) => setColorOverride(overrideKey, c)}
                        onReset={() => resetColorOverride(overrideKey)}
                        dimmed={!checked}
                        title="DJEP Leads"
                      />
                      <span className={`truncate ${checked ? "" : "text-muted-foreground line-through"}`}>
                        SALES - MILLER
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                        {count} event{count === 1 ? "" : "s"}
                      </span>
                    </label>
                  );
                })()}
                {djepRefreshedAt && (
                  <p className="text-[10px] text-muted-foreground/70 pl-6">
                    Last refreshed{" "}
                    {new Date(djepRefreshedAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
          </PopoverContent>
        </Popover>


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
                  onClick={() => setSelectedEvent(e)}
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
          <div className="unified-cal bg-background rounded-lg border border-border/60 p-2" style={{ height: 900 }}>
            <TooltipProvider delayDuration={150}>
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
                onSelectEvent={(e: UnifiedEvent) => setSelectedEvent(e)}
                selected={selectedEvent}
              />
            </TooltipProvider>
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
                          <div className="col-span-2">
                            <Label className="text-xs">Skip Groups <span className="text-muted-foreground">(comma-separated, case-insensitive)</span></Label>
                            <Input
                              value={editDraft.skip_groups ?? ""}
                              onChange={(e) => setEditDraft({ ...editDraft, skip_groups: e.target.value })}
                              placeholder="e.g. completed, archived"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">Items in groups whose title contains any of these keywords will be hidden. "Lost Sale" is always skipped.</p>
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

      {/* Unified event detail dialog (Google + Monday) */}
      <Dialog open={!!selectedEvent} onOpenChange={(o) => !o && setSelectedEvent(null)}>
        <DialogContent className="max-w-lg">
          {selectedEvent && (() => {
            const ev = selectedEvent;
            const accent =
              ev.source === "google"
                ? colorForAccount(ev.accountEmail, googleAccounts)
                : ev.color;
            const dupes =
              ev.duplicateAccounts || (ev.accountEmail ? [ev.accountEmail] : []);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-start gap-2 pr-6">
                    <span
                      className="w-1 self-stretch rounded shrink-0 mt-1"
                      style={{ backgroundColor: accent }}
                    />
                    <span className="leading-tight">
                      {ev.meta?.title || ev.title}
                    </span>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span
                      className="px-2 py-0.5 rounded text-white"
                      style={{ backgroundColor: accent }}
                    >
                      {ev.source === "monday"
                        ? ev.meta?.sourceLabel || "Monday"
                        : "Google Calendar"}
                    </span>
                    {ev.meta?.boardName && (
                      <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {ev.meta.boardName}
                      </span>
                    )}
                    {ev.meta?.groupTitle && (
                      <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {ev.meta.groupTitle}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    📅 {format(ev.start, "EEEE, MMMM d, yyyy")}
                    {!ev.allDay && (
                      <> · {format(ev.start, "h:mm a")} – {format(ev.end, "h:mm a")}</>
                    )}
                  </div>
                  {ev.meta?.location && (
                    <div className="text-sm">📍 {ev.meta.location}</div>
                  )}
                  {ev.meta?.description && (
                    <div className="text-sm whitespace-pre-wrap text-foreground/90 border-t border-border pt-3">
                      {ev.meta.description}
                    </div>
                  )}
                  {ev.source === "google" && dupes.length > 0 && (
                    <div className="border-t border-border pt-3">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                        Shared on {dupes.length} account{dupes.length === 1 ? "" : "s"}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {dupes.map((email) => (
                          <div key={email} className="flex items-center gap-2 text-sm">
                            <span
                              className="inline-flex items-center justify-center text-[10px] font-bold w-5 h-5 rounded-full text-white shrink-0"
                              style={{ backgroundColor: colorForAccount(email, googleAccounts) }}
                            >
                              {initialsForEmail(email)}
                            </span>
                            <span className="truncate">{email}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {ev.source === "monday" && ev.meta?.fields?.length > 0 && (
                    <div className="border-t border-border pt-3">
                      <div className="grid grid-cols-1 gap-2">
                        {ev.meta.fields.map((f: any) => (
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
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedEvent(null)}>
                    Close
                  </Button>
                  {ev.source === "monday" && ev.meta?.itemUrl && (
                    <Button onClick={() => window.open(ev.meta.itemUrl, "_blank")}>
                      <LinkIcon className="w-4 h-4 mr-1" /> Open in Monday
                    </Button>
                  )}
                  {ev.source === "google" && ev.meta?.htmlLink && (
                    <Button onClick={() => window.open(ev.meta.htmlLink, "_blank")}>
                      <LinkIcon className="w-4 h-4 mr-1" /> Open in Google
                    </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
