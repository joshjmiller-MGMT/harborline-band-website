import { useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  CalendarDays,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  Link as LinkIcon,
  Trash2,
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
  meta?: any;
};

type MondaySource = {
  id: string;
  board_id: string;
  date_column_id: string;
  label: string;
  color: string;
  enabled: boolean;
};

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export default function UnifiedCalendarWidget() {
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [mondayConfigured, setMondayConfigured] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [mondaySources, setMondaySources] = useState<MondaySource[]>([]);
  const [newSource, setNewSource] = useState({
    board_id: "",
    date_column_id: "",
    label: "",
    color: "#8b5cf6",
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
        for (const e of gRes.events || []) {
          merged.push({
            id: e.id,
            title: e.title,
            start: new Date(e.start),
            end: new Date(e.end),
            allDay: e.allDay,
            source: "google",
            color: e.calendarColor || "#4285f4",
            meta: e,
          });
        }
      } else {
        setGoogleConnected(false);
      }

      if (mRes?.configured) {
        setMondayConfigured(true);
        for (const e of mRes.events || []) {
          merged.push({
            id: e.id,
            title: `[${e.sourceLabel}] ${e.title}`,
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

  const connectGoogle = async () => {
    try {
      const res = await fetch(
        `${FUNCTIONS_BASE}/google-calendar-oauth?action=start&return_to=${encodeURIComponent(
          window.location.pathname,
        )}`,
        {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        },
      );
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      window.location.href = data.auth_url;
    } catch (err) {
      toast.error("Failed to start Google OAuth");
    }
  };

  const addMondaySource = async () => {
    if (!newSource.board_id || !newSource.date_column_id || !newSource.label) {
      toast.error("Board ID, date column ID, and label are required");
      return;
    }
    const { error } = await supabase.from("monday_calendar_sources").insert(newSource);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewSource({ board_id: "", date_column_id: "", label: "", color: "#8b5cf6" });
    await loadSources();
    await loadAll();
    toast.success("Monday source added");
  };

  const deleteSource = async (id: string) => {
    await supabase.from("monday_calendar_sources").delete().eq("id", id);
    await loadSources();
    await loadAll();
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

  const eventStyleGetter = (event: UnifiedEvent) => ({
    style: {
      backgroundColor: event.color,
      borderColor: event.color,
      color: "#fff",
      borderRadius: 4,
      fontSize: "0.75rem",
      padding: "1px 4px",
    },
  });

  const upcoming = useMemo(
    () =>
      [...events]
        .filter((e) => e.start >= new Date(Date.now() - 24 * 60 * 60 * 1000))
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .slice(0, 30),
    [events],
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
              mondayConfigured && mondaySources.length > 0
                ? "bg-green-500/20 text-green-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            Monday: {mondaySources.length > 0 ? `${mondaySources.length} board(s)` : "no sources"}
          </span>
          {!googleConnected && (
            <Button size="sm" variant="outline" onClick={connectGoogle}>
              <LinkIcon className="w-3 h-3 mr-1" /> Connect Google
            </Button>
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
            {upcoming.map((e) => (
              <div
                key={e.id}
                className="flex items-start gap-3 p-3 rounded-md border border-border bg-card/50"
              >
                <div
                  className="w-1 self-stretch rounded"
                  style={{ backgroundColor: e.color }}
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(e.start, "EEE MMM d, h:mm a")}
                    {!e.allDay && ` – ${format(e.end, "h:mm a")}`}
                  </div>
                  {e.meta?.location && (
                    <div className="text-xs text-muted-foreground mt-1">
                      📍 {e.meta.location}
                    </div>
                  )}
                </div>
                <span className="text-[10px] uppercase text-muted-foreground">
                  {e.source}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-background rounded-md p-2" style={{ height: 600 }}>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              views={["month", "week", "day"]}
              eventPropGetter={eventStyleGetter}
              style={{ height: "100%" }}
              onSelectEvent={(e: UnifiedEvent) => {
                if (e.meta?.htmlLink) window.open(e.meta.htmlLink, "_blank");
                else if (e.meta?.itemUrl) window.open(e.meta.itemUrl, "_blank");
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
                <Button onClick={connectGoogle} size="sm">
                  <LinkIcon className="w-4 h-4 mr-1" /> Connect Google Calendar
                </Button>
              )}
            </section>

            <section>
              <h3 className="font-medium mb-2">Monday.com Boards</h3>
              <div className="space-y-2 mb-4">
                {mondaySources.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 p-2 border rounded"
                  >
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: s.color }}
                    />
                    <div className="flex-1 text-sm">
                      <div className="font-medium">{s.label}</div>
                      <div className="text-xs text-muted-foreground">
                        Board {s.board_id} · col {s.date_column_id}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteSource(s.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {mondaySources.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No Monday boards configured yet.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 border rounded">
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
                <Button onClick={addMondaySource} className="col-span-2" size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Add Source
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Find Board ID in the Monday URL (boards/<b>123456789</b>). Find the
                date Column ID via Monday board → ⋯ → Developers → Column IDs.
              </p>
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
    </Card>
  );
}
