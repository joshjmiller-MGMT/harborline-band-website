import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Timer,
  Play,
  Pause,
  SkipForward,
  Plus,
  Trash2,
  GripVertical,
  RotateCcw,
  Settings,
  StopCircle,
  History,
  Music,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Hand,
  Maximize2,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ---------- Types ----------
interface Preset {
  id: string;
  name: string;
  description: string;
  target_minutes: number;
  sort_order: number;
  is_default: boolean;
}
interface PresetSegment {
  id: string;
  preset_id: string;
  category: string;
  label: string;
  target_minutes: number;
  bpm: number | null;
  notes: string;
  sort_order: number;
}
interface RuntimeSegment {
  key: string; // local key (id or temp)
  category: string;
  label: string;
  target_minutes: number;
  bpm: number | null;
  notes: string;
  what_practiced: string;
  actual_seconds: number;
  completed: boolean;
  skipped: boolean;
}
interface SessionRow {
  id: string;
  preset_name: string;
  song_of_the_day: string;
  notes: string;
  started_at: string;
  ended_at: string | null;
  total_minutes: number;
  status: string;
}

const CATEGORIES = [
  "Chords",
  "Scales",
  "Technical",
  "Patterns",
  "Lines",
  "Songs",
  "Transcriptions",
  "Arrangements",
  "Original",
  "Other",
  "Rehearsal",
  "Gigs",
];

const fmt = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
    : `${m}:${String(r).padStart(2, "0")}`;
};

// Soft chime via WebAudio (no asset needed)
function playChime() {
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new Ctx();
    const tones = [880, 660];
    tones.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.start(t);
      o.stop(t + 0.4);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* no audio */
  }
}

// ---------- Metronome (WebAudio scheduled clicks) ----------
function useMetronome() {
  const ctxRef = useRef<AudioContext | null>(null);
  const nextNoteRef = useRef(0);
  const beatRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const bpmRef = useRef(100);
  const mutedRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [bpm, setBpm] = useState(100);
  const [currentBeat, setCurrentBeat] = useState(-1); // -1 = idle, 0..3 = beat in bar

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const ensureCtx = () => {
    if (!ctxRef.current) {
      const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      ctxRef.current = new Ctx();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  };

  const click = (time: number, beatInBar: number) => {
    const ctx = ctxRef.current!;
    const accent = beatInBar === 0;
    if (!mutedRef.current) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = accent ? 1500 : 1000;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(accent ? 0.4 : 0.25, time + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      o.start(time);
      o.stop(time + 0.06);
    }
    // Schedule UI beat indicator update at audio time
    const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
    window.setTimeout(() => setCurrentBeat(beatInBar), delayMs);
  };

  const scheduler = () => {
    const ctx = ctxRef.current!;
    while (nextNoteRef.current < ctx.currentTime + 0.1) {
      click(nextNoteRef.current, beatRef.current % 4);
      nextNoteRef.current += 60.0 / Math.max(20, bpmRef.current);
      beatRef.current += 1;
    }
  };

  const start = () => {
    const ctx = ensureCtx();
    beatRef.current = 0;
    nextNoteRef.current = ctx.currentTime + 0.05;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(scheduler, 25);
    setRunning(true);
  };
  const stop = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
    setCurrentBeat(-1);
  };

  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); }, []);

  return { running, start, stop, bpm, setBpm, muted, setMuted, currentBeat };
}

// ---------- Tap tempo ----------
function useTapTempo(onTempo: (bpm: number) => void) {
  const taps = useRef<number[]>([]);
  return () => {
    const now = performance.now();
    taps.current.push(now);
    // keep last 5, reset if >2s gap
    if (taps.current.length > 1 && now - taps.current[taps.current.length - 2] > 2000) {
      taps.current = [now];
    }
    if (taps.current.length > 5) taps.current.shift();
    if (taps.current.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < taps.current.length; i++) {
        intervals.push(taps.current[i] - taps.current[i - 1]);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avg);
      if (bpm >= 30 && bpm <= 300) onTempo(bpm);
    }
  };
}

// ---------- Sortable row ----------
function SortableRow({
  seg,
  index,
  active,
  elapsedSec,
  onChange,
  onRemove,
  running,
  songs,
}: {
  seg: RuntimeSegment;
  index: number;
  active: boolean;
  elapsedSec: number;
  onChange: (patch: Partial<RuntimeSegment>) => void;
  onRemove: () => void;
  running: boolean;
  songs: { id: string; title: string; artist: string }[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: seg.key });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const target = seg.target_minutes * 60;
  const elapsed = active ? elapsedSec : seg.actual_seconds;
  const pct = target > 0 ? Math.min(100, (elapsed / target) * 100) : 0;
  const overtime = elapsed > target && target > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border p-3 transition-colors ${
        active ? "border-primary bg-primary/5" : seg.completed ? "border-green-500/30 bg-green-500/5" : seg.skipped ? "border-muted bg-muted/20 opacity-60" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab touch-none text-muted-foreground hover:text-foreground"
          disabled={running}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
            <Select value={seg.category} onValueChange={(v) => onChange({ category: v })}>
              <SelectTrigger className="h-7 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[140px]">
              <Input
                list={`songs-${seg.key}`}
                value={seg.label}
                onChange={(e) => onChange({ label: e.target.value })}
                placeholder="What are you working on? (type to search songs)"
                className="h-7 text-xs"
              />
              <datalist id={`songs-${seg.key}`}>
                {songs.map((s) => (
                  <option key={s.id} value={s.artist ? `${s.title} — ${s.artist}` : s.title} />
                ))}
              </datalist>
            </div>
            {active && (
              <Badge variant="default" className="text-xs">
                <Timer className="w-3 h-3 mr-1" /> Active
              </Badge>
            )}
            {seg.completed && !active && <Badge variant="secondary" className="text-xs">Done</Badge>}
            {seg.skipped && <Badge variant="outline" className="text-xs">Skipped</Badge>}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Target</span>
              <Input
                type="number"
                min={1}
                value={seg.target_minutes}
                onChange={(e) => onChange({ target_minutes: parseInt(e.target.value || "0") || 0 })}
                className="h-7 w-16 text-xs"
              />
              <span className="text-xs text-muted-foreground">min</span>
            </div>
            <div className="flex items-center gap-1">
              <Music className="w-3 h-3 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                value={seg.bpm ?? ""}
                onChange={(e) => onChange({ bpm: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="BPM"
                className="h-7 w-16 text-xs"
              />
            </div>
            <div className={`text-xs font-mono ${overtime ? "text-orange-500 font-bold" : "text-muted-foreground"}`}>
              {fmt(elapsed)} / {fmt(target)}
              {overtime && " ⚠"}
            </div>
            <Button size="sm" variant="ghost" className="h-7 px-2 ml-auto" onClick={onRemove} disabled={running}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>

          <Progress value={pct} className="h-1.5" />

          {(active || seg.what_practiced) && (
            <Textarea
              value={seg.what_practiced}
              onChange={(e) => onChange({ what_practiced: e.target.value })}
              placeholder="Notes — what did you actually work on?"
              className="text-xs min-h-[40px] resize-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Main ----------
export default function PracticeTimerWidget() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetSegments, setPresetSegments] = useState<Record<string, PresetSegment[]>>({});
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  const [segments, setSegments] = useState<RuntimeSegment[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const [songOfDay, setSongOfDay] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [chime, setChime] = useState(true);

  const [history, setHistory] = useState<SessionRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const tickRef = useRef<number | null>(null);
  const metro = useMetronome();
  const tap = useTapTempo((b) => metro.setBpm(b));
  const [songs, setSongs] = useState<{ id: string; title: string; artist: string }[]>([]);

  const loadSongs = async () => {
    const { data } = await supabase
      .from("practice_songs")
      .select("id, title, artist, status")
      .order("status")
      .order("title");
    setSongs((data as { id: string; title: string; artist: string }[]) || []);
  };

  // Load presets
  const loadPresets = async () => {
    const { data: ps } = await supabase
      .from("practice_presets")
      .select("*")
      .order("sort_order");
    if (!ps) return;
    setPresets(ps);
    const { data: segs } = await supabase
      .from("practice_preset_segments")
      .select("*")
      .order("sort_order");
    const byPreset: Record<string, PresetSegment[]> = {};
    (segs || []).forEach((s) => {
      if (!byPreset[s.preset_id]) byPreset[s.preset_id] = [];
      byPreset[s.preset_id].push(s);
    });
    setPresetSegments(byPreset);
    if (!selectedPresetId && ps.length) {
      const def = ps.find((p) => p.is_default) || ps[0];
      setSelectedPresetId(def.id);
    }
  };

  const loadHistory = async () => {
    const { data } = await supabase
      .from("practice_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);
    setHistory(data || []);
  };

  useEffect(() => {
    loadPresets();
    loadHistory();
    loadSongs();
    const ch = supabase
      .channel("songs_in_timer")
      .on("postgres_changes", { event: "*", schema: "public", table: "practice_songs" }, loadSongs)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // When preset changes, populate working segments (only when no session running)
  useEffect(() => {
    if (running || sessionId) return;
    if (!selectedPresetId) return;
    const segs = presetSegments[selectedPresetId] || [];
    setSegments(
      segs.map((s) => ({
        key: s.id,
        category: s.category,
        label: s.label,
        target_minutes: s.target_minutes,
        bpm: s.bpm,
        notes: s.notes,
        what_practiced: "",
        actual_seconds: 0,
        completed: false,
        skipped: false,
      }))
    );
    setActiveIdx(null);
    setElapsedSec(0);
  }, [selectedPresetId, presetSegments, running, sessionId]);

  // Tick
  useEffect(() => {
    if (!running) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }
    tickRef.current = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [running]);

  // Sync metronome BPM to active segment when changed
  useEffect(() => {
    if (activeIdx == null) return;
    const segBpm = segments[activeIdx]?.bpm;
    if (segBpm && segBpm > 0) metro.setBpm(segBpm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, segments[activeIdx ?? 0]?.bpm]);

  // Auto-stop metronome when timer is not running
  useEffect(() => {
    if (!running && metro.running) metro.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Auto-stop at target (chime + pause)
  useEffect(() => {
    if (activeIdx == null || !running) return;
    const seg = segments[activeIdx];
    const target = seg.target_minutes * 60;
    if (target > 0 && elapsedSec === target) {
      if (chime) playChime();
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Segment complete", { body: `${seg.category} — ${seg.label || ""}`.trim() });
      }
      // pause and wait for user
      setRunning(false);
      toast({ title: "Segment time hit", description: `${seg.category} reached ${seg.target_minutes} min. Tap Next or +1.` });
    }
  }, [elapsedSec, activeIdx, running, segments, chime]);

  // Persist current segment seconds when active
  useEffect(() => {
    if (activeIdx == null) return;
    setSegments((prev) =>
      prev.map((s, i) => (i === activeIdx ? { ...s, actual_seconds: elapsedSec } : s))
    );
  }, [elapsedSec, activeIdx]);

  const totalElapsed = useMemo(
    () => segments.reduce((a, s, i) => a + (i === activeIdx ? elapsedSec : s.actual_seconds), 0),
    [segments, activeIdx, elapsedSec]
  );
  const totalTarget = useMemo(() => segments.reduce((a, s) => a + s.target_minutes * 60, 0), [segments]);

  // ---------- Session control ----------
  const startSession = async () => {
    if (!segments.length) {
      toast({ title: "Add at least one segment", variant: "destructive" });
      return;
    }
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const presetName = presets.find((p) => p.id === selectedPresetId)?.name || "Custom";
    const { data, error } = await supabase
      .from("practice_sessions")
      .insert({
        preset_id: selectedPresetId || null,
        preset_name: presetName,
        song_of_the_day: songOfDay,
        notes: sessionNotes,
        status: "in_progress",
      })
      .select()
      .single();
    if (error || !data) {
      toast({ title: "Could not start session", description: error?.message, variant: "destructive" });
      return;
    }
    setSessionId(data.id);
    setSessionStart(new Date(data.started_at));
    setActiveIdx(0);
    setElapsedSec(segments[0].actual_seconds);
    setRunning(true);
  };

  const startSegment = (idx: number) => {
    if (!sessionId) return;
    setActiveIdx(idx);
    setElapsedSec(segments[idx].actual_seconds);
    setRunning(true);
  };

  const togglePause = () => {
    if (activeIdx == null) return;
    setRunning((r) => !r);
  };

  const nextSegment = (markCompleted = true) => {
    if (activeIdx == null) return;
    setSegments((prev) =>
      prev.map((s, i) =>
        i === activeIdx ? { ...s, actual_seconds: elapsedSec, completed: markCompleted, skipped: !markCompleted } : s
      )
    );
    const next = activeIdx + 1;
    if (next >= segments.length) {
      finishSession();
      return;
    }
    setActiveIdx(next);
    setElapsedSec(segments[next].actual_seconds);
    setRunning(true);
  };

  const addMinute = () => {
    if (activeIdx == null) return;
    setSegments((prev) => prev.map((s, i) => (i === activeIdx ? { ...s, target_minutes: s.target_minutes + 1 } : s)));
  };

  const restartSegment = () => {
    if (activeIdx == null) return;
    setElapsedSec(0);
    setSegments((prev) => prev.map((s, i) => (i === activeIdx ? { ...s, actual_seconds: 0, completed: false, skipped: false } : s)));
  };

  const finishSession = async () => {
    if (!sessionId) {
      // local reset
      setActiveIdx(null);
      setRunning(false);
      setElapsedSec(0);
      return;
    }
    setRunning(false);
    // commit current segment seconds
    const finalSegs = segments.map((s, i) => (i === activeIdx ? { ...s, actual_seconds: elapsedSec } : s));
    const totalSec = finalSegs.reduce((a, s) => a + s.actual_seconds, 0);
    await supabase
      .from("practice_sessions")
      .update({
        ended_at: new Date().toISOString(),
        total_minutes: Math.round(totalSec / 60),
        status: "completed",
        song_of_the_day: songOfDay,
        notes: sessionNotes,
      })
      .eq("id", sessionId);
    await supabase.from("practice_session_segments").insert(
      finalSegs.map((s, i) => ({
        session_id: sessionId,
        category: s.category,
        label: s.label,
        target_minutes: s.target_minutes,
        actual_seconds: s.actual_seconds,
        bpm: s.bpm,
        notes: s.notes,
        what_practiced: s.what_practiced,
        sort_order: i,
        completed: s.completed,
        skipped: s.skipped,
      }))
    );

    // Bump times_practiced for any segment label matching a tracked song
    const labels = finalSegs
      .filter((s) => s.actual_seconds > 0 && !s.skipped && s.label?.trim())
      .map((s) => s.label.split("—")[0].trim().toLowerCase());
    const matched = songs.filter((sg) => labels.includes(sg.title.toLowerCase()));
    if (matched.length) {
      const { data: current } = await supabase
        .from("practice_songs")
        .select("id, times_practiced")
        .in("id", matched.map((m) => m.id));
      await Promise.all(
        (current || []).map((c) =>
          supabase
            .from("practice_songs")
            .update({
              times_practiced: (c.times_practiced || 0) + 1,
              last_practiced_at: new Date().toISOString(),
            })
            .eq("id", c.id)
        )
      );
      loadSongs();
    }

    toast({ title: "Session logged", description: `${Math.round(totalSec / 60)} minutes practiced.` });
    setSessionId(null);
    setSessionStart(null);
    setActiveIdx(null);
    setElapsedSec(0);
    setSongOfDay("");
    setSessionNotes("");
    loadHistory();
    // reset segments to fresh from preset
    if (selectedPresetId) {
      const segs = presetSegments[selectedPresetId] || [];
      setSegments(
        segs.map((s) => ({
          key: s.id,
          category: s.category,
          label: s.label,
          target_minutes: s.target_minutes,
          bpm: s.bpm,
          notes: s.notes,
          what_practiced: "",
          actual_seconds: 0,
          completed: false,
          skipped: false,
        }))
      );
    }
  };

  // ---------- Segment editing ----------
  const updateSeg = (idx: number, patch: Partial<RuntimeSegment>) => {
    setSegments((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const removeSeg = (idx: number) => {
    setSegments((prev) => prev.filter((_, i) => i !== idx));
    if (activeIdx === idx) {
      setActiveIdx(null);
      setRunning(false);
    }
  };
  const addSeg = () => {
    setSegments((prev) => [
      ...prev,
      {
        key: `tmp-${Date.now()}`,
        category: "Songs",
        label: "",
        target_minutes: 10,
        bpm: null,
        notes: "",
        what_practiced: "",
        actual_seconds: 0,
        completed: false,
        skipped: false,
      },
    ]);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSegments((prev) => {
      const oldIdx = prev.findIndex((s) => s.key === active.id);
      const newIdx = prev.findIndex((s) => s.key === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      const moved = arrayMove(prev, oldIdx, newIdx);
      // adjust active idx if needed
      if (activeIdx != null) {
        if (activeIdx === oldIdx) setActiveIdx(newIdx);
        else if (oldIdx < activeIdx && newIdx >= activeIdx) setActiveIdx(activeIdx - 1);
        else if (oldIdx > activeIdx && newIdx <= activeIdx) setActiveIdx(activeIdx + 1);
      }
      return moved;
    });
  };

  // Save current arrangement back to preset
  const savePresetFromCurrent = async () => {
    if (!selectedPresetId) return;
    await supabase.from("practice_preset_segments").delete().eq("preset_id", selectedPresetId);
    if (segments.length) {
      await supabase.from("practice_preset_segments").insert(
        segments.map((s, i) => ({
          preset_id: selectedPresetId,
          category: s.category,
          label: s.label,
          target_minutes: s.target_minutes,
          bpm: s.bpm,
          notes: s.notes,
          sort_order: i,
        }))
      );
    }
    toast({ title: "Preset saved" });
    loadPresets();
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Timer className="w-4 h-4 text-primary" /> Practice Timer
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setChime((c) => !c)} title={chime ? "Mute chime" : "Enable chime"}>
              {chime ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </Button>
            <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" onClick={loadHistory}>
                  <History className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Practice History</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  {history.length === 0 && <p className="text-sm text-muted-foreground">No sessions yet.</p>}
                  {history.map((h) => (
                    <div key={h.id} className="border rounded p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{new Date(h.started_at).toLocaleString()}</span>
                        <Badge variant={h.status === "completed" ? "default" : "secondary"}>
                          {h.total_minutes} min · {h.preset_name}
                        </Badge>
                      </div>
                      {h.song_of_the_day && (
                        <p className="text-xs text-muted-foreground mt-1">SOTD: {h.song_of_the_day}</p>
                      )}
                      {h.notes && <p className="text-xs mt-1">{h.notes}</p>}
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs value={selectedPresetId} onValueChange={setSelectedPresetId}>
          <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${Math.max(presets.length, 1)}, 1fr)` }}>
            {presets.map((p) => (
              <TabsTrigger key={p.id} value={p.id} disabled={!!sessionId} className="text-xs">
                {p.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {presets.map((p) => (
            <TabsContent key={p.id} value={p.id} className="mt-2">
              <p className="text-xs text-muted-foreground">{p.description} · target {p.target_minutes} min</p>
            </TabsContent>
          ))}
        </Tabs>

        {/* Big timer */}
        <div className="rounded-xl border bg-gradient-to-br from-primary/10 to-transparent p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {activeIdx != null ? segments[activeIdx]?.category : "Ready"}
              </p>
              <p className="font-mono text-4xl font-bold">{fmt(elapsedSec)}</p>
              {activeIdx != null && (
                <p className="text-xs text-muted-foreground">
                  Segment target {segments[activeIdx]?.target_minutes} min
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
              <p className="font-mono text-xl">{fmt(totalElapsed)} / {fmt(totalTarget)}</p>
              {sessionStart && (
                <p className="text-xs text-muted-foreground">Started {sessionStart.toLocaleTimeString()}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {!sessionId ? (
              <Button onClick={startSession} className="gap-1">
                <Play className="w-4 h-4" /> Start Session
              </Button>
            ) : (
              <>
                <Button onClick={togglePause} variant={running ? "secondary" : "default"} className="gap-1">
                  {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {running ? "Pause" : "Resume"}
                </Button>
                <Button onClick={() => nextSegment(true)} variant="outline" className="gap-1">
                  <SkipForward className="w-4 h-4" /> Next
                </Button>
                <Button onClick={() => nextSegment(false)} variant="ghost" size="sm">
                  Skip
                </Button>
                <Button onClick={addMinute} variant="ghost" size="sm">+1 min</Button>
                <Button onClick={restartSegment} variant="ghost" size="sm" className="gap-1">
                  <RotateCcw className="w-3 h-3" /> Restart
                </Button>
                <Button onClick={finishSession} variant="destructive" size="sm" className="gap-1 ml-auto">
                  <StopCircle className="w-4 h-4" /> Stop & Log
                </Button>
              </>
            )}
          </div>

          {/* Metronome */}
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Metronome</span>
            <Button
              size="sm"
              variant={metro.running ? "default" : "outline"}
              onClick={() => (metro.running ? metro.stop() : metro.start())}
              className="h-7 gap-1 text-xs"
            >
              {metro.running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {metro.running ? "Stop" : "Click"}
            </Button>
            <div className="flex items-center gap-1">
              <Music className="w-3 h-3 text-muted-foreground" />
              <Input
                type="number"
                min={30}
                max={300}
                value={metro.bpm}
                onChange={(e) => metro.setBpm(parseInt(e.target.value || "0") || 0)}
                className="h-7 w-16 text-xs"
              />
              <span className="text-xs text-muted-foreground">BPM</span>
            </div>
            <Button size="sm" variant="ghost" onClick={tap} className="h-7 gap-1 text-xs">
              <Hand className="w-3 h-3" /> Tap
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => metro.setMuted(!metro.muted)}
              className="h-7 gap-1 text-xs"
              title={metro.muted ? "Unmute" : "Mute"}
            >
              {metro.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            </Button>
            {activeIdx != null && segments[activeIdx]?.bpm && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                Synced to segment ({segments[activeIdx].bpm} BPM)
              </span>
            )}
          </div>
        </div>

        {/* Session meta */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input
            value={songOfDay}
            onChange={(e) => setSongOfDay(e.target.value)}
            placeholder="🎵 Song of the day"
            className="text-sm"
          />
          <Input
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="Session note"
            className="text-sm"
          />
        </div>

        {/* Segments */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Segments — drag to reorder</p>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={addSeg} disabled={running} className="h-7 gap-1 text-xs">
                <Plus className="w-3 h-3" /> Add
              </Button>
              <Button size="sm" variant="ghost" onClick={savePresetFromCurrent} disabled={running || !selectedPresetId} className="h-7 gap-1 text-xs">
                <Settings className="w-3 h-3" /> Save as Preset
              </Button>
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={segments.map((s) => s.key)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {segments.map((seg, i) => (
                  <div key={seg.key} onDoubleClick={() => sessionId && startSegment(i)}>
                    <SortableRow
                      seg={seg}
                      index={i}
                      active={activeIdx === i}
                      elapsedSec={elapsedSec}
                      running={running && activeIdx === i}
                      onChange={(patch) => updateSeg(i, patch)}
                      onRemove={() => removeSeg(i)}
                      songs={songs}
                    />
                  </div>
                ))}
                {segments.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">No segments. Click Add.</p>
                )}
              </div>
            </SortableContext>
          </DndContext>
          {sessionId && (
            <p className="text-[10px] text-muted-foreground text-center">Tip: double-click any segment to jump to it.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
