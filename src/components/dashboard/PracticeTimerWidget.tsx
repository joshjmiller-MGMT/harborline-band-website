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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { MicButton } from "@/components/dictation/MicButton";
import { appendDictation } from "@/hooks/useDictation";
import PracticeDetailRow from "@/components/practice/PracticeDetailRow";
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
  Minimize2,
  List,
  Activity,
  Disc,
  Sliders,
} from "lucide-react";
import MetronomeWheel from "@/components/dashboard/MetronomeWheel";
import {
  colorSpec,
  recommendItems,
  sectionPool,
  SEGMENT_CATEGORY_TO_KIND,
  type PracticeItem,
  type PracticeItemKind,
} from "@/lib/practice-mastery";
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

// Parse a time string in the same formats fmt() renders: "m:ss", "h:mm:ss",
// or a bare number (treated as minutes). Returns seconds, or null if unparseable.
const parseTimeInput = (raw: string): number | null => {
  const t = raw.trim();
  if (!t) return null;
  const parts = t.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || !/^\d+$/.test(p))) return null;
  const nums = parts.map((p) => parseInt(p, 10));
  if (nums.length === 1) return nums[0] * 60;
  if (nums.length === 2) return nums[0] * 60 + Math.min(59, nums[1]);
  if (nums.length === 3) return nums[0] * 3600 + Math.min(59, nums[1]) * 60 + Math.min(59, nums[2]);
  return null;
};

// Click-to-edit time display. One shared affordance for the big elapsed timer
// and per-segment elapsed times so the interaction is identical everywhere:
// click → input pre-filled with the current value, Enter/blur commits,
// Escape cancels, invalid input reverts.
function EditableTime({
  seconds,
  onCommit,
  className = "",
  title = "Click to edit time",
}: {
  seconds: number;
  onCommit: (sec: number) => void;
  className?: string;
  title?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const parsed = parseTimeInput(draft);
    if (parsed != null) onCommit(parsed);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") setEditing(false);
        }}
        className={`bg-transparent border-b border-primary outline-none tabular-nums ${className}`}
        style={{ width: `${Math.max(4, draft.length + 1)}ch` }}
        inputMode="numeric"
        aria-label="Edit time"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(fmt(seconds));
        setEditing(true);
      }}
      title={title}
      className={`tabular-nums cursor-text hover:underline decoration-dotted underline-offset-4 text-left ${className}`}
    >
      {fmt(seconds)}
    </button>
  );
}

// ---------- Background-safe intervals (Web Worker driven) ----------
// Main-thread setInterval gets throttled to >=1s (or fully paused) in
// backgrounded tabs, which froze the metronome and stalled the timer when the
// phone locked or the user switched apps. A tiny dedicated worker fires the
// ticks instead (worker timers are not throttled by tab visibility) and the
// main thread does the WebAudio scheduling / elapsed math on each tick.
// Falls back to plain setInterval if workers are unavailable.
type TickKind = "metro" | "clock";
let clockWorker: Worker | null = null;
let clockWorkerFailed = false;
const tickListeners: Record<TickKind, Set<() => void>> = { metro: new Set(), clock: new Set() };

function getClockWorker(): Worker | null {
  if (clockWorkerFailed || typeof window === "undefined") return null;
  if (!clockWorker) {
    try {
      clockWorker = new Worker(new URL("../../workers/practiceClock.worker.ts", import.meta.url), {
        type: "module",
      });
      clockWorker.onmessage = (e: MessageEvent) => {
        const t = (e.data as { type?: string } | null)?.type;
        if (t === "metro-tick") tickListeners.metro.forEach((l) => l());
        else if (t === "clock-tick") tickListeners.clock.forEach((l) => l());
      };
      clockWorker.onerror = () => {
        clockWorkerFailed = true;
        try {
          clockWorker?.terminate();
        } catch {
          /* noop */
        }
        clockWorker = null;
      };
    } catch {
      clockWorkerFailed = true;
      return null;
    }
  }
  return clockWorker;
}

function startWorkerInterval(kind: TickKind, cb: () => void): () => void {
  const w = getClockWorker();
  if (w) {
    tickListeners[kind].add(cb);
    w.postMessage({ type: `${kind}-start` });
    return () => {
      tickListeners[kind].delete(cb);
      if (tickListeners[kind].size === 0) {
        try {
          clockWorker?.postMessage({ type: `${kind}-stop` });
        } catch {
          /* noop */
        }
      }
    };
  }
  const id = window.setInterval(cb, kind === "metro" ? 25 : 250);
  return () => window.clearInterval(id);
}

// ---------- Metronome sound + feel options ----------
type ClickToneId = "wood" | "click" | "beep";
const CLICK_TONES: Record<ClickToneId, { label: string; type: OscillatorType; freq: number }> = {
  wood: { label: "Wood", type: "triangle", freq: 420 },
  click: { label: "Click", type: "square", freq: 1000 },
  beep: { label: "Beep", type: "sine", freq: 1800 },
};
const TIME_SIGS: { label: string; beats: number }[] = [
  { label: "2/4", beats: 2 },
  { label: "3/4", beats: 3 },
  { label: "4/4", beats: 4 },
  { label: "5/4", beats: 5 },
  { label: "6/8", beats: 6 },
  { label: "7/4", beats: 7 },
];
const METRO_PREFS_KEY = "practice.metroPrefs.v1";
const SESSION_STATE_KEY = "practice.activeSession.v1";

interface MetroPrefs {
  clickTone: ClickToneId;
  accentTone: ClickToneId;
  timeSig: string;
  emphasis: boolean[];
}
const defaultEmphasis = (beats: number) => Array.from({ length: beats }, (_, i) => i === 0);

function loadMetroPrefs(): MetroPrefs {
  const fallback: MetroPrefs = {
    clickTone: "click",
    accentTone: "click",
    timeSig: "4/4",
    emphasis: defaultEmphasis(4),
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(METRO_PREFS_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<MetroPrefs>;
    const timeSig = TIME_SIGS.some((t) => t.label === p.timeSig) ? (p.timeSig as string) : "4/4";
    const beats = TIME_SIGS.find((t) => t.label === timeSig)?.beats ?? 4;
    const emphasis = Array.isArray(p.emphasis)
      ? Array.from({ length: beats }, (_, i) => p.emphasis?.[i] === true)
      : defaultEmphasis(beats);
    const tone = (t: unknown): ClickToneId => (t === "wood" || t === "click" || t === "beep" ? t : "click");
    return { clickTone: tone(p.clickTone), accentTone: tone(p.accentTone), timeSig, emphasis };
  } catch {
    return fallback;
  }
}

// Per-segment metronome usage captured during a session (keyed by segment key).
interface SegMetroLog {
  bpm_start: number;
  bpm_end: number;
  time_sig: string;
  seconds: number;
}

// ---------- Shared WebAudio context ----------
// iOS Safari is strict: (1) an AudioContext starts "suspended" and only unlocks
// inside a real user gesture, and (2) it caps you at a few contexts before
// `new AudioContext()` throws. So we keep ONE lazily-created context for the
// whole widget (metronome clicks + chime) instead of spinning up a fresh one
// per sound, and unlock it from the actual button presses.
let sharedCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    try {
      sharedCtx = new Ctx();
    } catch {
      return null;
    }
  }
  return sharedCtx;
}

// Unlock audio for iOS: call inside a user gesture. Resuming alone isn't enough
// on iPad — iOS only truly opens output once a source node actually starts
// within the gesture, so we also fire a 1-frame silent buffer.
function unlockAudio() {
  // iOS 17+/Safari 17: route WebAudio to the "playback" audio session so the
  // ringer/silent switch does NOT mute the click. Without this, WebAudio plays
  // on the ambient channel, which the mute switch silences — the most common
  // real-world cause of "metronome makes no sound" on iPhone.
  try {
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";
  } catch {
    /* not supported */
  }
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  try {
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* already unlocked / not supported */
  }
}

// Soft chime via WebAudio (no asset needed). Uses the shared, already-unlocked
// context — the session was started by a user gesture, which unlocks it.
function playChime() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
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
  } catch {
    /* no audio */
  }
}

// ---------- Metronome (WebAudio scheduled clicks) ----------
function useMetronome() {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const keepAliveRef = useRef<AudioBufferSourceNode | null>(null);
  const nextNoteRef = useRef(0);
  const beatRef = useRef(0);
  const stopTicksRef = useRef<(() => void) | null>(null);
  const bpmRef = useRef(100);
  const mutedRef = useRef(false);
  const runningRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [bpm, setBpm] = useState(100);
  const [currentBeat, setCurrentBeat] = useState(-1); // -1 = idle, 0..beats-1

  // Sound + feel prefs — persisted to localStorage so they stick across loads.
  const initialPrefs = useMemo(() => loadMetroPrefs(), []);
  const [clickTone, setClickTone] = useState<ClickToneId>(initialPrefs.clickTone);
  const [accentTone, setAccentTone] = useState<ClickToneId>(initialPrefs.accentTone);
  const [timeSig, setTimeSigState] = useState(initialPrefs.timeSig);
  const [emphasis, setEmphasis] = useState<boolean[]>(initialPrefs.emphasis);
  const beatsPerBar = TIME_SIGS.find((t) => t.label === timeSig)?.beats ?? 4;

  const clickToneRef = useRef(clickTone);
  const accentToneRef = useRef(accentTone);
  const emphasisRef = useRef(emphasis);
  const beatsRef = useRef(beatsPerBar);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { clickToneRef.current = clickTone; }, [clickTone]);
  useEffect(() => { accentToneRef.current = accentTone; }, [accentTone]);
  useEffect(() => { emphasisRef.current = emphasis; }, [emphasis]);
  useEffect(() => { beatsRef.current = beatsPerBar; }, [beatsPerBar]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        METRO_PREFS_KEY,
        JSON.stringify({ clickTone, accentTone, timeSig, emphasis } as MetroPrefs)
      );
    } catch {
      /* storage blocked — non-fatal */
    }
  }, [clickTone, accentTone, timeSig, emphasis]);

  const setTimeSig = (label: string) => {
    const sig = TIME_SIGS.find((t) => t.label === label);
    if (!sig) return;
    setTimeSigState(label);
    // Resize the emphasis pattern to the new bar length, preserving existing
    // beat choices; fresh beats default to unaccented.
    setEmphasis((prev) => Array.from({ length: sig.beats }, (_, i) => prev[i] === true));
    beatRef.current = 0;
  };
  const toggleEmphasisBeat = (i: number) =>
    setEmphasis((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  const setEmphasisPreset = (preset: "first" | "all") =>
    setEmphasis(Array.from({ length: beatsPerBar }, (_, i) => (preset === "all" ? true : i === 0)));

  const ensureCtx = () => {
    // Shared context + iOS unlock (silent-buffer prime). start() is always
    // called from a button press, so this runs inside a real user gesture.
    unlockAudio();
    ctxRef.current = getAudioCtx();
    return ctxRef.current;
  };

  const getMasterGain = (ctx: AudioContext) => {
    if (!masterGainRef.current || masterGainRef.current.context !== ctx) {
      const g = ctx.createGain();
      g.gain.value = 1;
      g.connect(ctx.destination);
      masterGainRef.current = g;
    }
    return masterGainRef.current;
  };

  // Silent looping buffer while the metronome runs. Keeps the audio session
  // alive on iOS when the screen locks / app backgrounds, so the click keeps
  // playing instead of the context being suspended.
  const startKeepAlive = (ctx: AudioContext) => {
    if (keepAliveRef.current) return;
    try {
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); // 1s of silence
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(getMasterGain(ctx));
      src.start();
      keepAliveRef.current = src;
    } catch {
      /* non-fatal */
    }
  };
  const stopKeepAlive = () => {
    try {
      keepAliveRef.current?.stop();
    } catch {
      /* noop */
    }
    keepAliveRef.current = null;
  };

  const click = (time: number, beatInBar: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const accent = emphasisRef.current[beatInBar] === true;
    if (!mutedRef.current) {
      const spec = CLICK_TONES[accent ? accentToneRef.current : clickToneRef.current];
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = spec.type;
      // Accented clicks sit a bit higher + louder so the accent cuts through
      // even when both selectors use the same tone.
      o.frequency.value = accent ? spec.freq * 1.4 : spec.freq;
      o.connect(g);
      g.connect(getMasterGain(ctx));
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.28, time + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      o.start(time);
      o.stop(time + 0.06);
    }
    // Schedule UI beat indicator update at audio time
    const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
    window.setTimeout(() => setCurrentBeat(beatInBar), delayMs);
  };

  const scheduler = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    // 0.18s lookahead absorbs tick-delivery jitter from a backgrounded worker.
    while (nextNoteRef.current < ctx.currentTime + 0.18) {
      click(nextNoteRef.current, beatRef.current % beatsRef.current);
      nextNoteRef.current += 60.0 / Math.max(20, bpmRef.current);
      beatRef.current += 1;
    }
  };

  const start = async () => {
    const ctx = ensureCtx();
    if (!ctx) {
      toast({
        title: "Audio unavailable",
        description: "This browser doesn't support Web Audio.",
        variant: "destructive",
      });
      return;
    }
    // Root-cause fix for "metronome runs but makes no sound": the old code
    // fired resume() fire-and-forget and scheduled regardless — if the context
    // stayed suspended (autoplay policy), clicks were scheduled onto a frozen
    // clock: metronome "running", zero audio, no error. Verify the context is
    // actually running before scheduling, and say so if the browser refuses.
    try {
      if (ctx.state !== "running") await ctx.resume();
    } catch {
      /* retried below */
    }
    if ((ctx.state as string) !== "running") {
      unlockAudio();
      try {
        await ctx.resume();
      } catch {
        /* verified below */
      }
    }
    if ((ctx.state as string) !== "running") {
      toast({
        title: "Tap Start once more",
        description: "The browser blocked audio until a direct tap.",
        variant: "destructive",
      });
      return;
    }
    startKeepAlive(ctx);
    beatRef.current = 0;
    nextNoteRef.current = ctx.currentTime + 0.06;
    stopTicksRef.current?.();
    stopTicksRef.current = startWorkerInterval("metro", scheduler);
    setRunning(true);
  };
  const stop = () => {
    stopTicksRef.current?.();
    stopTicksRef.current = null;
    stopKeepAlive();
    setRunning(false);
    setCurrentBeat(-1);
  };

  // If the tab returns to the foreground with the metronome supposed to be
  // running but the context suspended (mobile lock can suspend it), resume.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) return;
      const ctx = ctxRef.current;
      if (runningRef.current && ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(
    () => () => {
      stopTicksRef.current?.();
      stopTicksRef.current = null;
      try {
        keepAliveRef.current?.stop();
      } catch {
        /* noop */
      }
      keepAliveRef.current = null;
    },
    []
  );

  return {
    running,
    start,
    stop,
    bpm,
    setBpm,
    muted,
    setMuted,
    currentBeat,
    clickTone,
    setClickTone,
    accentTone,
    setAccentTone,
    timeSig,
    setTimeSig,
    beatsPerBar,
    emphasis,
    toggleEmphasisBeat,
    setEmphasisPreset,
  };
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
type SegStatus = "pending" | "active" | "done" | "skipped";

function SortableRow({
  seg,
  index,
  active,
  elapsedSec,
  onChange,
  onRemove,
  running,
  items,
  hasSession,
  onStatusChange,
  onElapsedEdit,
  metroInfo,
}: {
  seg: RuntimeSegment;
  index: number;
  active: boolean;
  elapsedSec: number;
  onChange: (patch: Partial<RuntimeSegment>) => void;
  onRemove: () => void;
  running: boolean;
  items: PracticeItem[];
  hasSession: boolean;
  onStatusChange: (status: SegStatus) => void;
  onElapsedEdit: (sec: number) => void;
  metroInfo: SegMetroLog | null;
}) {
  // Datalist source — narrow to the kind that matches this segment's category,
  // or fall back to all items if the category isn't recommendation-linked.
  // Pool-aware (Josh 8/3): the datalist offers only what belongs to this
  // section — Chords never lists the numbered movements, those are Misc's.
  const pool = sectionPool(items, seg.category);
  const datalistItems = pool ?? items;
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
                {datalistItems.map((it) => (
                  <option key={it.id} value={it.artist ? `${it.title} — ${it.artist}` : it.title} />
                ))}
              </datalist>
            </div>
            {/* Editable status — click the badge to change it mid-session, or
                mark already-done offline practice as completed retroactively. */}
            <Select
              value={active ? "active" : seg.completed ? "done" : seg.skipped ? "skipped" : "pending"}
              onValueChange={(v) => onStatusChange(v as SegStatus)}
            >
              <SelectTrigger
                className={`h-6 w-auto gap-1 rounded-full border px-2 text-[10px] font-medium ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : seg.completed
                    ? "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400"
                    : seg.skipped
                    ? "border-muted bg-muted/40 text-muted-foreground"
                    : "border-border text-muted-foreground"
                }`}
                title="Click to change status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active" disabled={!hasSession}>
                  Active
                </SelectItem>
                <SelectItem value="done">✓ Done</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
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
            <div
              className={`text-xs font-mono flex items-center gap-1 ${
                overtime ? "text-orange-500 font-bold" : "text-muted-foreground"
              }`}
            >
              <EditableTime
                seconds={elapsed}
                onCommit={onElapsedEdit}
                className="text-xs font-mono"
                title="Click to edit elapsed time"
              />
              <span>/ {fmt(target)}</span>
              {overtime && <span>⚠</span>}
            </div>
            <Button size="sm" variant="ghost" className="h-7 px-2 ml-auto" onClick={onRemove} disabled={running}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>

          <Progress value={pct} className="h-1.5" />

          {/* Metronome auto-log — only shown when the click actually ran during this segment */}
          {metroInfo && metroInfo.seconds > 0 && (
            <p className="text-[10px] text-muted-foreground font-mono">
              ♩ {metroInfo.bpm_start}
              {metroInfo.bpm_end !== metroInfo.bpm_start ? `→${metroInfo.bpm_end}` : ""} BPM ·{" "}
              {metroInfo.time_sig} · click {fmt(metroInfo.seconds)}
            </p>
          )}

          {(active || seg.what_practiced) && (
            <div className="relative">
              <Textarea
                value={seg.what_practiced}
                onChange={(e) => onChange({ what_practiced: e.target.value })}
                placeholder="Notes — what did you actually work on?"
                className="text-xs min-h-[40px] resize-none pr-9"
              />
              <MicButton
                className="absolute top-0.5 right-0.5"
                onText={(t) => onChange({ what_practiced: appendDictation(seg.what_practiced, t) })}
              />
            </div>
          )}

          {/* Structured detail (Josh 8/2) — sits under the comment box, never
              replaces it. Renders nothing for sections with no methods seeded.
              seg.key holds the DB id once persisted; "tmp-" keys are segments
              that haven't landed yet, and the detail row needs a real
              segment_id to write against. (This guard originally checked a
              nonexistent seg.id, so the whole feature never rendered — caught
              by the 8/3 audit.) */}
          {(active || seg.what_practiced) && seg.key && !seg.key.startsWith("tmp-") && (
            <PracticeDetailRow segmentId={seg.key} category={seg.category} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Flow display ----------
function FlowDisplay({
  seg,
  nextSeg,
  elapsedSec,
  totalElapsed,
  totalTarget,
  sessionStart,
  onElapsedEdit,
}: {
  seg: RuntimeSegment;
  nextSeg: RuntimeSegment | null;
  elapsedSec: number;
  totalElapsed: number;
  totalTarget: number;
  sessionStart: Date | null;
  onElapsedEdit: (sec: number) => void;
}) {
  const target = seg.target_minutes * 60;
  const pct = target > 0 ? Math.min(100, (elapsedSec / target) * 100) : 0;
  const overtime = elapsedSec > target && target > 0;
  const remaining = target - elapsedSec;
  const clockNow = new Date();
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{seg.category}</p>
          <p className="text-lg font-medium leading-tight truncate max-w-[400px]">
            {seg.label || <span className="text-muted-foreground italic">(no label)</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {clockNow.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {sessionStart && ` · started ${sessionStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Total {fmt(totalElapsed)} / {fmt(totalTarget)}
          </p>
        </div>
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <EditableTime
            seconds={elapsedSec}
            onCommit={onElapsedEdit}
            className="font-mono text-6xl md:text-7xl font-bold leading-none"
            title="Click to edit elapsed time"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Target {seg.target_minutes}m
            {overtime ? (
              <span className="ml-2 text-orange-500 font-semibold">
                +{fmt(elapsedSec - target)} over
              </span>
            ) : (
              <span className="ml-2 text-muted-foreground">
                {fmt(Math.max(0, remaining))} left
              </span>
            )}
          </p>
        </div>
        {seg.bpm && (
          <div className="ml-auto text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Click</p>
            <p className="font-mono text-lg">{seg.bpm} BPM</p>
          </div>
        )}
      </div>
      <Progress value={pct} className="h-2" />
      {nextSeg && (
        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
          <SkipForward className="w-3 h-3" />
          <span>Next:</span>
          <span className="font-medium text-foreground">{nextSeg.category}</span>
          {nextSeg.label && <span>· {nextSeg.label}</span>}
          <span>· {nextSeg.target_minutes}m</span>
        </div>
      )}
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
  const [focusOpen, setFocusOpen] = useState(false);
  // Confirm dialog before logging a session — replaces silent autolog so a
  // half-second test run doesn't end up in analytics.
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);

  const metro = useMetronome();
  const tap = useTapTempo((b) => metro.setBpm(b));

  // ---------- Clock refs (timestamp-anchored elapsed) ----------
  const elapsedSecRef = useRef(0);
  const elapsedBaseRef = useRef(0);
  const runStartMsRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  useEffect(() => {
    runningRef.current = running;
  }, [running]);
  useEffect(() => {
    elapsedSecRef.current = elapsedSec;
  }, [elapsedSec]);

  // Seed the elapsed clock to an absolute value (segment switch, restore, or
  // an inline edit). Re-anchors the timestamp math when running so the next
  // tick continues from the new value instead of the old anchor.
  const seedElapsed = (sec: number) => {
    const v = Math.max(0, Math.floor(sec));
    elapsedBaseRef.current = v;
    runStartMsRef.current = runningRef.current ? Date.now() : null;
    elapsedSecRef.current = v;
    setElapsedSec(v);
  };

  // ---------- Per-segment metronome auto-log ----------
  const metroLogRef = useRef<Record<string, SegMetroLog>>({});
  const metroAnchorRef = useRef<{ key: string; startedMs: number } | null>(null);
  // Render-safe mirror of the log (refs are the source of truth; this state
  // copy is what the rows display, refreshed from effects/handlers).
  const [metroLogView, setMetroLogView] = useState<Record<string, SegMetroLog>>({});

  // Snapshot including any in-flight accumulation (metronome still running on
  // the active segment) — used for display, persistence, and the final insert.
  const metroLogSnapshot = (): Record<string, SegMetroLog> => {
    const snap: Record<string, SegMetroLog> = {};
    for (const [k, v] of Object.entries(metroLogRef.current)) snap[k] = { ...v };
    const anchor = metroAnchorRef.current;
    if (anchor && snap[anchor.key]) {
      snap[anchor.key].seconds += Math.round((Date.now() - anchor.startedMs) / 1000);
    }
    return snap;
  };

  // One-shot guard for the target-hit chime (keyed segment:target so bumping
  // the target re-arms it).
  const targetHitRef = useRef<string | null>(null);

  // View mode + metronome display mode, both persisted to localStorage so the
  // setting sticks across page reloads.
  const [viewMode, setViewMode] = useState<"rows" | "flow">(() => {
    if (typeof window === "undefined") return "rows";
    return (window.localStorage.getItem("practice.viewMode") as "rows" | "flow") || "rows";
  });
  const [metroDisplay, setMetroDisplay] = useState<"wheel" | "input">(() => {
    if (typeof window === "undefined") return "wheel";
    return (window.localStorage.getItem("practice.metroDisplay") as "wheel" | "input") || "wheel";
  });
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("practice.viewMode", viewMode);
  }, [viewMode]);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("practice.metroDisplay", metroDisplay);
  }, [metroDisplay]);

  const [items, setItems] = useState<PracticeItem[]>([]);

  const loadItems = async () => {
    const { data } = await supabase
      .from("practice_items")
      .select("*")
      .is("archived_at", null)
      .order("color_level", { ascending: true })
      .order("last_practiced_at", { ascending: true, nullsFirst: true });
    setItems((data as PracticeItem[]) || []);
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
    if (ps.length) {
      const def = ps.find((p) => p.is_default) || ps[0];
      // Functional update: this resolves async, and a restored session may
      // have set its preset in the meantime — never clobber it.
      setSelectedPresetId((prev) => prev || def.id);
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

  // ---------- Session persistence (survive reload / tab close / phone lock) ----------
  const clearSavedSession = () => {
    try {
      window.localStorage.removeItem(SESSION_STATE_KEY);
    } catch {
      /* noop */
    }
  };

  // Restore a persisted session on mount. Auto-resumes the clock only when the
  // page was gone under a minute (quick refresh) — longer gaps restore paused
  // so time away from the instrument isn't counted as practice.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || typeof window === "undefined") return;
    restoredRef.current = true;
    try {
      const raw = window.localStorage.getItem(SESSION_STATE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s || s.v !== 1 || !s.sessionId || !Array.isArray(s.segments) || s.segments.length === 0) {
        clearSavedSession();
        return;
      }
      setSegments(s.segments as RuntimeSegment[]);
      setActiveIdx(typeof s.activeIdx === "number" ? s.activeIdx : null);
      setSessionId(s.sessionId as string);
      setSessionStart(s.sessionStartIso ? new Date(s.sessionStartIso) : null);
      setSongOfDay(s.songOfDay || "");
      setSessionNotes(s.sessionNotes || "");
      if (s.selectedPresetId) setSelectedPresetId(s.selectedPresetId);
      metroLogRef.current = s.metroLog && typeof s.metroLog === "object" ? s.metroLog : {};
      setMetroLogView({ ...metroLogRef.current });
      seedElapsed(typeof s.elapsedSec === "number" ? s.elapsedSec : 0);
      const quickRefresh = s.running && Date.now() - (s.savedAt || 0) < 60_000;
      if (quickRefresh) {
        setRunning(true);
        toast({ title: "Session resumed", description: "Picked up right where you left off." });
      } else {
        toast({
          title: "Session restored",
          description: `${fmt(s.elapsedSec || 0)} on the current segment — tap Resume to continue.`,
        });
      }
    } catch {
      clearSavedSession();
    }
  }, []);

  // Persist the live session on every meaningful change (segment edits, status
  // changes, 1Hz ticks). Cleared only on explicit finish/discard.
  useEffect(() => {
    if (typeof window === "undefined" || !sessionId) return;
    try {
      window.localStorage.setItem(
        SESSION_STATE_KEY,
        JSON.stringify({
          v: 1,
          savedAt: Date.now(),
          sessionId,
          sessionStartIso: sessionStart ? sessionStart.toISOString() : null,
          selectedPresetId,
          segments,
          activeIdx,
          elapsedSec,
          running,
          songOfDay,
          sessionNotes,
          metroLog: metroLogSnapshot(),
        })
      );
    } catch {
      /* storage blocked — session continues in memory */
    }
  }, [sessionId, sessionStart, selectedPresetId, segments, activeIdx, elapsedSec, running, songOfDay, sessionNotes]);

  useEffect(() => {
    loadPresets();
    loadHistory();
    loadItems();
    const ch = supabase
      .channel("items_in_timer")
      .on("postgres_changes", { event: "*", schema: "public", table: "practice_items" }, loadItems)
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
    seedElapsed(0);
  }, [selectedPresetId, presetSegments, running, sessionId]);

  // Tick — timestamp-anchored (elapsed = base + wall-clock since anchor) and
  // driven from the Web Worker, so time stays accurate even when the browser
  // throttles or suspends the tab; recomputed again on visibility return.
  useEffect(() => {
    if (!running) return;
    elapsedBaseRef.current = elapsedSecRef.current;
    runStartMsRef.current = Date.now();
    const compute = () => {
      if (runStartMsRef.current == null) return;
      const next = elapsedBaseRef.current + Math.floor((Date.now() - runStartMsRef.current) / 1000);
      if (next !== elapsedSecRef.current) {
        elapsedSecRef.current = next;
        setElapsedSec(next);
      }
    };
    const stopTicks = startWorkerInterval("clock", compute);
    const onVis = () => {
      if (!document.hidden) compute();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopTicks();
      document.removeEventListener("visibilitychange", onVis);
      runStartMsRef.current = null;
    };
  }, [running]);

  // Auto-log metronome usage against the active segment: BPM at start/end,
  // time signature, and how long the click actually ran during that segment.
  useEffect(() => {
    const now = Date.now();
    const anchor = metroAnchorRef.current;
    if (anchor) {
      const prev = metroLogRef.current[anchor.key];
      if (prev) {
        metroLogRef.current[anchor.key] = {
          ...prev,
          seconds: prev.seconds + Math.round((now - anchor.startedMs) / 1000),
        };
      }
      metroAnchorRef.current = null;
    }
    const key = activeIdx != null ? segments[activeIdx]?.key : undefined;
    if (metro.running && key) {
      const prev = metroLogRef.current[key];
      metroLogRef.current[key] = prev
        ? { ...prev, bpm_end: metro.bpm, time_sig: metro.timeSig }
        : { bpm_start: metro.bpm, bpm_end: metro.bpm, time_sig: metro.timeSig, seconds: 0 };
      metroAnchorRef.current = { key, startedMs: now };
    }
    setMetroLogView(metroLogSnapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metro.running, metro.bpm, metro.timeSig, activeIdx]);

  // Keep the row-level metronome display fresh while the click accumulates
  // (rides the 1Hz session tick; final values are snapshotted at save time).
  useEffect(() => {
    if (!metro.running) return;
    setMetroLogView(metroLogSnapshot());
  }, [elapsedSec, metro.running]);

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

  // Auto-stop at target (chime + pause). Uses >= with a one-shot guard because
  // the timestamp clock can jump past the exact target second after a
  // background stretch or an inline time edit.
  useEffect(() => {
    if (activeIdx == null || !running) return;
    const seg = segments[activeIdx];
    const target = seg.target_minutes * 60;
    const fireKey = `${seg.key}:${target}`;
    if (target > 0 && elapsedSec < target && targetHitRef.current === fireKey) {
      targetHitRef.current = null; // re-armed (restart / time edited back down)
    }
    if (target > 0 && elapsedSec >= target && targetHitRef.current !== fireKey) {
      targetHitRef.current = fireKey;
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
    // Unlock audio inside this gesture so the later auto-chime (fired from a
    // timer effect, not a gesture) can play on iOS.
    unlockAudio();
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
    targetHitRef.current = null;
    seedElapsed(segments[0].actual_seconds);
    setRunning(true);
  };

  const startSegment = (idx: number) => {
    if (!sessionId) return;
    setActiveIdx(idx);
    targetHitRef.current = null;
    seedElapsed(segments[idx].actual_seconds);
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
      // End of session — pause + open confirm dialog instead of silently logging.
      setRunning(false);
      setStopConfirmOpen(true);
      return;
    }
    setActiveIdx(next);
    targetHitRef.current = null;
    seedElapsed(segments[next].actual_seconds);
    setRunning(true);
  };

  // Discard the in-progress session without logging. Removes the `in_progress`
  // row created at startSession + any segment rows that somehow attached, then
  // resets local state back to the preset's fresh segments.
  const discardSession = async () => {
    setRunning(false);
    if (sessionId) {
      await supabase.from("practice_sessions").delete().eq("id", sessionId);
    }
    clearSavedSession();
    metroLogRef.current = {};
    metroAnchorRef.current = null;
    setMetroLogView({});
    setSessionId(null);
    setSessionStart(null);
    setActiveIdx(null);
    seedElapsed(0);
    setSongOfDay("");
    setSessionNotes("");
    setStopConfirmOpen(false);
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
    toast({ title: "Session discarded", description: "Nothing was logged." });
  };

  const addMinute = () => {
    if (activeIdx == null) return;
    setSegments((prev) => prev.map((s, i) => (i === activeIdx ? { ...s, target_minutes: s.target_minutes + 1 } : s)));
  };

  // Tack-on / subtract on the current segment. Target floor of 1 to keep the
  // progress bar meaningful.
  const adjustTarget = (deltaMin: number, idx: number | null = activeIdx) => {
    if (idx == null) return;
    setSegments((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, target_minutes: Math.max(1, s.target_minutes + deltaMin) } : s
      )
    );
  };

  // Jump back to (or forward to) any segment mid-session — preserves the in-session
  // elapsed of that segment, marks it active, keeps running state.
  const jumpToSegment = (idx: number) => {
    if (!sessionId) return;
    if (idx === activeIdx) return;
    if (idx < 0 || idx >= segments.length) return;
    // Save current elapsed into the leaving segment before switching
    setSegments((prev) =>
      prev.map((s, i) => (i === activeIdx ? { ...s, actual_seconds: elapsedSec } : s))
    );
    setActiveIdx(idx);
    targetHitRef.current = null;
    seedElapsed(segments[idx].actual_seconds);
  };

  const restartSegment = () => {
    if (activeIdx == null) return;
    targetHitRef.current = null;
    seedElapsed(0);
    setSegments((prev) => prev.map((s, i) => (i === activeIdx ? { ...s, actual_seconds: 0, completed: false, skipped: false } : s)));
    // Restart wipes this segment's metronome log too — it's a fresh take.
    const key = segments[activeIdx].key;
    if (metroLogRef.current[key]) {
      metroLogRef.current[key] = {
        bpm_start: metro.bpm,
        bpm_end: metro.bpm,
        time_sig: metro.timeSig,
        seconds: 0,
      };
      if (metroAnchorRef.current?.key === key) {
        metroAnchorRef.current = metro.running ? { key, startedMs: Date.now() } : null;
      }
      setMetroLogView(metroLogSnapshot());
    }
  };

  // Editable status per segment (Pending / Active / Done / Skipped) — usable
  // mid-session or before one. This is also how practice done away from the
  // app gets marked completed retroactively (set the time, then mark Done).
  const setSegStatus = (idx: number, status: SegStatus) => {
    if (status === "active") {
      if (!sessionId) {
        toast({ title: "Start a session first", description: "Segments go active once a session is running." });
        return;
      }
      startSegment(idx);
      return;
    }
    const completed = status === "done";
    const skipped = status === "skipped";
    if (idx === activeIdx) {
      const committed = elapsedSec;
      setSegments((prev) =>
        prev.map((s, i) => (i === idx ? { ...s, actual_seconds: committed, completed, skipped } : s))
      );
      setActiveIdx(null);
      setRunning(false);
    } else {
      updateSeg(idx, { completed, skipped });
    }
  };

  const finishSession = async () => {
    if (!sessionId) {
      // local reset
      setActiveIdx(null);
      setRunning(false);
      seedElapsed(0);
      return;
    }
    setRunning(false);
    // Snapshot metronome usage (incl. in-flight time) before clearing anything.
    const metroSnap = metroLogSnapshot();
    metroAnchorRef.current = null;
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
      finalSegs.map((s, i) => {
        // Metronome auto-log: only segments where the click actually ran get
        // values — everything else stays NULL (no placeholders).
        const m = metroSnap[s.key];
        const hasMetro = !!m && m.seconds > 0;
        return {
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
          metronome_bpm_start: hasMetro ? m.bpm_start : null,
          metronome_bpm_end: hasMetro ? m.bpm_end : null,
          metronome_time_sig: hasMetro ? m.time_sig : null,
          metronome_seconds: hasMetro ? m.seconds : null,
        };
      })
    );

    // Bump times_practiced + last_practiced_at on any practice_item whose title
    // matches a played segment's label (case-insensitive, title-only — the user
    // types "Title — Artist" but we strip the artist tail for the match).
    const playedLabels = finalSegs
      .filter((s) => s.actual_seconds > 0 && !s.skipped && s.label?.trim())
      .map((s) => s.label.split("—")[0].trim().toLowerCase());
    if (playedLabels.length) {
      const matched = items.filter((it) =>
        playedLabels.includes(it.title.toLowerCase())
      );
      if (matched.length) {
        await Promise.all(
          matched.map((it) =>
            supabase
              .from("practice_items")
              .update({
                times_practiced: (it.times_practiced || 0) + 1,
                last_practiced_at: new Date().toISOString(),
              })
              .eq("id", it.id)
          )
        );
        loadItems();
      }
    }

    toast({ title: "Session logged", description: `${Math.round(totalSec / 60)} minutes practiced.` });

    // P318: mirror to Josh's long-running practice sheet. Fire-and-forget —
    // sheet is the historical-record mirror; DB is source of truth, so a
    // failed sheet append does NOT block session-end. Capture sessionId
    // here because we null it below.
    const mirroredSessionId = sessionId;
    supabase.functions
      .invoke("append-practice-session-row", { body: { session_id: mirroredSessionId } })
      .then(async ({ data, error }) => {
        // Helper: try to extract the structured error body from the fn's
        // JSON response. supabase-js stashes the original Response on
        // error.context for non-2xx; .json() yields our { error, message }
        // payload. Falls back to error.message if parse fails.
        const extractErrorBody = async (err: any): Promise<{ code?: string; msg?: string }> => {
          try {
            if (err?.context?.json) {
              const body = await err.context.json();
              // fn writes `message` for known errors, `detail` for unhandled exceptions.
              return { code: body?.error, msg: body?.message || body?.detail };
            }
          } catch (_) { /* fallthrough */ }
          return { msg: err?.message };
        };

        if (error) {
          const { code, msg } = await extractErrorBody(error);
          console.error("[P318] sheet mirror failed:", { code, msg, raw: error });
          const titleByCode: Record<string, string> = {
            spreadsheets_scope_not_granted: "Reconnect Google for sheet sync",
            no_google_account_connected: "Connect Google to enable sheet sync",
            owner_account_not_found: "Practice-sheet owner not connected",
            sheets_api_error: "Sheets API error",
            sheets_api_not_enabled: "Enable Sheets API in Google Cloud",
          };
          toast({
            title: code && titleByCode[code] ? titleByCode[code] : "Sheet sync failed",
            description: msg || code || "Portal record saved. Check console.",
            variant: "destructive",
          });
          return;
        }
        if (data?.ok) {
          toast({
            title: "Mirrored to sheet",
            description: data.row_index ? `Row ${data.row_index} appended.` : "Row appended.",
          });
        }
      })
      .catch((e) => console.error("[P318] sheet mirror exception:", e));

    setStopConfirmOpen(false);
    clearSavedSession();
    metroLogRef.current = {};
    setMetroLogView({});
    setSessionId(null);
    setSessionStart(null);
    setActiveIdx(null);
    seedElapsed(0);
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
            <div className="flex items-center rounded-md border bg-card p-0.5 mr-1">
              <button
                type="button"
                onClick={() => setViewMode("rows")}
                className={`h-7 px-2 rounded text-xs flex items-center gap-1 transition-colors ${
                  viewMode === "rows" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Rows view — edit + reorder segments"
              >
                <List className="w-3 h-3" /> Rows
              </button>
              <button
                type="button"
                onClick={() => setViewMode("flow")}
                className={`h-7 px-2 rounded text-xs flex items-center gap-1 transition-colors ${
                  viewMode === "flow" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title="Flow view — focus on current segment"
              >
                <Activity className="w-3 h-3" /> Flow
              </button>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setFocusOpen(true)} title="Full-screen focus mode">
              <Maximize2 className="w-4 h-4" />
            </Button>
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
          {/* Breadcrumb pill row — surfaces every segment, click to jump back/forward.
              Visible in both rows + flow views so the navigation is consistent. */}
          {segments.length > 0 && sessionId && (
            <div className="flex items-center gap-1 flex-wrap mb-3 pb-3 border-b border-border/50">
              {segments.map((s, i) => {
                const isActive = i === activeIdx;
                const isDone = s.completed;
                const isSkipped = s.skipped;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => jumpToSegment(i)}
                    className={`h-6 px-2 rounded-full text-[10px] flex items-center gap-1 border transition-all ${
                      isActive
                        ? "border-primary bg-primary/15 text-foreground font-medium"
                        : isDone
                        ? "border-green-500/40 bg-green-500/10 text-muted-foreground"
                        : isSkipped
                        ? "border-muted bg-muted/30 text-muted-foreground line-through"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                    title={`${s.category}${s.label ? " · " + s.label : ""} · ${s.target_minutes}m`}
                  >
                    <span className="font-mono">{i + 1}</span>
                    <span className="truncate max-w-[80px]">{s.label || s.category}</span>
                  </button>
                );
              })}
            </div>
          )}

          {viewMode === "flow" && activeIdx != null ? (
            <FlowDisplay
              seg={segments[activeIdx]}
              nextSeg={segments[activeIdx + 1] ?? null}
              elapsedSec={elapsedSec}
              totalElapsed={totalElapsed}
              totalTarget={totalTarget}
              sessionStart={sessionStart}
              onElapsedEdit={seedElapsed}
            />
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {activeIdx != null ? segments[activeIdx]?.category : "Ready"}
                </p>
                {activeIdx != null ? (
                  <EditableTime
                    seconds={elapsedSec}
                    onCommit={seedElapsed}
                    className="font-mono text-4xl font-bold"
                    title="Click to edit elapsed time"
                  />
                ) : (
                  <p className="font-mono text-4xl font-bold">{fmt(elapsedSec)}</p>
                )}
                {activeIdx != null && (
                  <p className="text-xs text-muted-foreground">
                    Segment target {segments[activeIdx]?.target_minutes} min
                    {segments[activeIdx]?.label ? ` · ${segments[activeIdx].label}` : ""}
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
          )}

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
                <Button onClick={restartSegment} variant="ghost" size="sm" className="gap-1">
                  <RotateCcw className="w-3 h-3" /> Restart
                </Button>
                <Button
                  onClick={() => {
                    setRunning(false);
                    setStopConfirmOpen(true);
                  }}
                  variant="destructive"
                  size="sm"
                  className="gap-1 ml-auto"
                >
                  <StopCircle className="w-4 h-4" /> Stop
                </Button>
              </>
            )}
          </div>

          {/* Tack-on time controls — visible whenever a segment is active */}
          {activeIdx != null && (
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">
                Adjust segment
              </span>
              <button
                type="button"
                onClick={() => adjustTarget(-5)}
                className="h-7 px-2 rounded border text-xs hover:bg-muted"
              >
                −5m
              </button>
              <button
                type="button"
                onClick={() => adjustTarget(-1)}
                className="h-7 px-2 rounded border text-xs hover:bg-muted"
              >
                −1m
              </button>
              <button
                type="button"
                onClick={() => adjustTarget(1)}
                className="h-7 px-2 rounded border text-xs hover:bg-muted"
              >
                +1m
              </button>
              <button
                type="button"
                onClick={() => adjustTarget(5)}
                className="h-7 px-2 rounded border text-xs hover:bg-muted"
              >
                +5m
              </button>
            </div>
          )}

          {/* Metronome */}
          <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Metronome
              </span>
              <Button
                size="sm"
                variant={metro.running ? "default" : "outline"}
                onClick={() => (metro.running ? metro.stop() : metro.start())}
                className="h-7 gap-1 text-xs"
              >
                {metro.running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {metro.running ? "Stop" : "Click"}
              </Button>
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
              <div className="ml-auto flex items-center rounded-md border bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setMetroDisplay("wheel")}
                  className={`h-6 px-2 rounded text-[10px] flex items-center gap-1 transition-colors ${
                    metroDisplay === "wheel" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Wheel display"
                >
                  <Disc className="w-3 h-3" /> Wheel
                </button>
                <button
                  type="button"
                  onClick={() => setMetroDisplay("input")}
                  className={`h-6 px-2 rounded text-[10px] flex items-center gap-1 transition-colors ${
                    metroDisplay === "input" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="±/input display"
                >
                  <Sliders className="w-3 h-3" /> ±
                </button>
              </div>
              {activeIdx != null && segments[activeIdx]?.bpm && (
                <span className="text-[10px] text-muted-foreground w-full md:w-auto">
                  Synced to segment ({segments[activeIdx].bpm} BPM)
                </span>
              )}
            </div>

            {/* Sound + feel: time signature, click/accent tones, and which
                beats get the accent — all persisted across reloads. */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={metro.timeSig} onValueChange={metro.setTimeSig}>
                <SelectTrigger className="h-7 w-[64px] text-xs" title="Time signature">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SIGS.map((t) => (
                    <SelectItem key={t.label} value={t.label}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Click</span>
                <Select value={metro.clickTone} onValueChange={(v) => metro.setClickTone(v as ClickToneId)}>
                  <SelectTrigger className="h-7 w-[76px] text-xs" title="Regular click tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CLICK_TONES) as ClickToneId[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {CLICK_TONES[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Accent</span>
                <Select value={metro.accentTone} onValueChange={(v) => metro.setAccentTone(v as ClickToneId)}>
                  <SelectTrigger className="h-7 w-[76px] text-xs" title="Accented (emphasized) click tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CLICK_TONES) as ClickToneId[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {CLICK_TONES[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1 ml-auto flex-wrap">
                <span className="text-[10px] text-muted-foreground mr-0.5">Accent beats</span>
                {metro.emphasis.map((on, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => metro.toggleEmphasisBeat(i)}
                    className={`h-6 w-6 rounded-full border text-[10px] font-mono transition-colors ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                    title={`Beat ${i + 1}: ${on ? "accented" : "regular"} — tap to toggle`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => metro.setEmphasisPreset("first")}
                  className="h-6 px-1.5 rounded border text-[10px] text-muted-foreground hover:text-foreground"
                  title="Accent beat 1 only"
                >
                  1st
                </button>
                <button
                  type="button"
                  onClick={() => metro.setEmphasisPreset("all")}
                  className="h-6 px-1.5 rounded border text-[10px] text-muted-foreground hover:text-foreground"
                  title="Accent every beat"
                >
                  All
                </button>
              </div>
            </div>

            {metroDisplay === "wheel" ? (
              <div className="flex justify-center py-2">
                <MetronomeWheel
                  bpm={metro.bpm}
                  onBpmChange={(b) => metro.setBpm(b)}
                  running={metro.running}
                  currentBeat={metro.currentBeat}
                  size={200}
                  beatsPerBar={metro.beatsPerBar}
                  emphasis={metro.emphasis}
                />
              </div>
            ) : (
              <div className="flex items-center gap-1 flex-wrap">
                <Music className="w-3 h-3 text-muted-foreground" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => metro.setBpm(Math.max(30, metro.bpm - 5))}
                  className="h-7 px-2 text-xs"
                >
                  −5
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => metro.setBpm(Math.max(30, metro.bpm - 1))}
                  className="h-7 px-2 text-xs"
                >
                  −1
                </Button>
                <Input
                  type="number"
                  min={30}
                  max={300}
                  value={metro.bpm}
                  onChange={(e) => metro.setBpm(parseInt(e.target.value || "0") || 0)}
                  className="h-7 w-16 text-xs text-center"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => metro.setBpm(Math.min(300, metro.bpm + 1))}
                  className="h-7 px-2 text-xs"
                >
                  +1
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => metro.setBpm(Math.min(300, metro.bpm + 5))}
                  className="h-7 px-2 text-xs"
                >
                  +5
                </Button>
                <span className="text-xs text-muted-foreground">BPM</span>
                {/* Inline beat indicator */}
                <div className="flex items-center gap-1 ml-2">
                  {Array.from({ length: metro.beatsPerBar }, (_, b) => {
                    const active = metro.running && metro.currentBeat === b;
                    return (
                      <div
                        key={b}
                        className={`w-2 h-2 rounded-full transition-all ${
                          active
                            ? metro.emphasis[b]
                              ? "bg-primary scale-125"
                              : "bg-primary/70"
                            : "bg-muted"
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
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
          <div className="flex items-center gap-1">
            <Input
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="Session note"
              className="text-sm flex-1"
            />
            <MicButton onText={(t) => setSessionNotes((p) => appendDictation(p, t))} />
          </div>
        </div>

        {/* Recommendation slot — only in flow mode, only when there's an active segment whose
            category maps to a kind and whose label is empty. Surfaces top-3 picks. */}
        {viewMode === "flow" && activeIdx != null && (() => {
          const seg = segments[activeIdx];
          // Section pool, not raw kind (Josh 8/3): Chords suggests chordal
          // EXERCISES; the numbered movements surface in Misc/Other instead.
          const segPool = sectionPool(items, seg.category);
          if (!segPool) return null;
          const top = recommendItems(segPool, { count: 3 });
          if (!top.length && !seg.label) return null;
          return (
            <div className="rounded-md border bg-card p-3">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Pull suggestions ({seg.category})
                </p>
                {/* Accidental click escape hatch (Josh 8/3): the current pick
                    is clearable, and the whole pool is reachable without
                    scrolling down to the library. */}
                {seg.label && (
                  <span className="inline-flex items-center gap-1 text-[11px] rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5">
                    {seg.label}
                    <button type="button" aria-label="Clear selection"
                      onClick={() => updateSeg(activeIdx, { label: "" })}
                      className="text-muted-foreground hover:text-destructive">×</button>
                  </span>
                )}
                <select
                  className="ml-auto h-6 text-[11px] rounded border border-border bg-background px-1"
                  value=""
                  onChange={(e) => { if (e.target.value) updateSeg(activeIdx, { label: e.target.value }); }}
                  title="Pick anything from this section's pool"
                >
                  <option value="">pick any…</option>
                  {segPool.map((it) => (
                    <option key={it.id} value={it.artist ? `${it.title} — ${it.artist}` : it.title}>
                      {it.title}{it.artist ? ` — ${it.artist}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {top.map((it) => {
                  const spec = colorSpec(it.color_level);
                  const value = it.artist ? `${it.title} — ${it.artist}` : it.title;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => updateSeg(activeIdx, { label: value })}
                      className={`text-left rounded border ${spec.borderTint} bg-card hover:bg-muted/40 p-2 flex items-start gap-2`}
                    >
                      <div className={`w-1.5 self-stretch rounded-sm ${spec.swatchBg}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{it.title}</div>
                        {it.artist && (
                          <div className="text-[10px] text-muted-foreground truncate">{it.artist}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Segments — full editor (rows view only) */}
        {viewMode === "rows" && (
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
                      items={items}
                      hasSession={!!sessionId}
                      onStatusChange={(st) => setSegStatus(i, st)}
                      onElapsedEdit={(sec) =>
                        i === activeIdx ? seedElapsed(sec) : updateSeg(i, { actual_seconds: Math.max(0, Math.floor(sec)) })
                      }
                      metroInfo={metroLogView[seg.key] ?? null}
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
            <p className="text-[10px] text-muted-foreground text-center">Tip: double-click any segment to jump to it, or click breadcrumb pills above.</p>
          )}
        </div>
        )}
      </CardContent>

      {/* Focus mode modal — consolidated Timer + Metronome */}
      <Dialog open={focusOpen} onOpenChange={setFocusOpen}>
        <DialogContent className="max-w-5xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-primary" /> Focus Mode
              {activeIdx != null && segments[activeIdx] && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {segments[activeIdx].category}
                  {segments[activeIdx].label ? ` · ${segments[activeIdx].label}` : ""}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            {/* Left: Timer */}
            <div className="rounded-xl border bg-gradient-to-br from-primary/10 to-transparent p-6 flex flex-col items-center justify-center min-h-[340px]">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {activeIdx != null ? `Segment ${activeIdx + 1} of ${segments.length}` : "Ready"}
              </p>
              {activeIdx != null ? (
                <EditableTime
                  seconds={elapsedSec}
                  onCommit={seedElapsed}
                  className="font-mono text-7xl md:text-8xl font-bold my-2"
                  title="Click to edit elapsed time"
                />
              ) : (
                <p className="font-mono text-7xl md:text-8xl font-bold tabular-nums my-2">{fmt(elapsedSec)}</p>
              )}
              {activeIdx != null && (
                <p className="text-xs text-muted-foreground mb-3">
                  Target {segments[activeIdx]?.target_minutes} min · Total {fmt(totalElapsed)} / {fmt(totalTarget)}
                </p>
              )}
              {/* Suggestion in focus mode too (Josh 8/3) — same section pool
                  as the flow view, tap to pull it into the segment label. */}
              {activeIdx != null && segments[activeIdx]?.label && (
                <div className="flex items-center justify-center mb-2">
                  <span className="inline-flex items-center gap-1 text-[11px] rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5">
                    {segments[activeIdx].label}
                    <button type="button" aria-label="Clear selection"
                      onClick={() => updateSeg(activeIdx, { label: "" })}
                      className="text-muted-foreground hover:text-destructive">×</button>
                  </span>
                </div>
              )}
              {activeIdx != null && (() => {
                const seg = segments[activeIdx];
                if (!seg || seg.label) return null;
                const segPool = sectionPool(items, seg.category);
                if (!segPool) return null;
                const top = recommendItems(segPool, { count: 2 });
                if (!top.length) return null;
                return (
                  <div className="flex items-center gap-1.5 flex-wrap justify-center mb-2">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">suggested:</span>
                    {top.map((it) => {
                      const spec = colorSpec(it.color_level);
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => updateSeg(activeIdx, { label: it.artist ? `${it.title} — ${it.artist}` : it.title })}
                          className={`inline-flex items-center gap-1 rounded-full border ${spec.borderTint} px-2 py-0.5 text-[11px] hover:bg-muted/40`}
                        >
                          <span className={`w-2 h-2 rounded-full ${spec.swatchBg}`} aria-hidden />
                          {it.title}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
              <div className="flex items-center gap-2 flex-wrap justify-center mt-2">
                {!sessionId ? (
                  <Button onClick={startSession} className="gap-1">
                    <Play className="w-4 h-4" /> Start
                  </Button>
                ) : (
                  <>
                    <Button onClick={togglePause} variant={running ? "secondary" : "default"} className="gap-1">
                      {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {running ? "Pause" : "Resume"}
                    </Button>
                    <Button onClick={() => nextSegment(true)} variant="outline" size="sm" className="gap-1">
                      <SkipForward className="w-4 h-4" /> Next
                    </Button>
                    <Button onClick={addMinute} variant="ghost" size="sm">+1</Button>
                    <Button
                      onClick={() => {
                        setRunning(false);
                        setStopConfirmOpen(true);
                      }}
                      variant="destructive"
                      size="sm"
                      className="gap-1"
                    >
                      <StopCircle className="w-4 h-4" /> Stop
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Right: Metronome */}
            <div className="rounded-xl border bg-gradient-to-br from-accent/10 to-transparent p-6 flex flex-col items-center justify-center min-h-[340px]">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Metronome</p>
              <p className="font-mono text-7xl md:text-8xl font-bold tabular-nums my-2">{metro.bpm}</p>
              <p className="text-xs text-muted-foreground mb-4">BPM</p>

              {/* Beat indicator lights — one per beat in the bar */}
              <div className="flex items-center gap-3 mb-5">
                {Array.from({ length: metro.beatsPerBar }, (_, i) => {
                  const active = metro.running && metro.currentBeat === i;
                  const accent = metro.emphasis[i] === true;
                  return (
                    <div
                      key={i}
                      className={`rounded-full transition-all duration-75 ${
                        active
                          ? accent
                            ? "w-7 h-7 bg-primary shadow-[0_0_20px_hsl(var(--primary))]"
                            : "w-6 h-6 bg-primary/80 shadow-[0_0_12px_hsl(var(--primary)/0.6)]"
                          : "w-5 h-5 bg-muted"
                      }`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-center">
                <Button
                  onClick={() => (metro.running ? metro.stop() : metro.start())}
                  variant={metro.running ? "default" : "outline"}
                  className="gap-1"
                >
                  {metro.running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {metro.running ? "Stop" : "Start"}
                </Button>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => metro.setBpm(Math.max(30, metro.bpm - 5))}>−5</Button>
                  <Input
                    type="number"
                    min={30}
                    max={300}
                    value={metro.bpm}
                    onChange={(e) => metro.setBpm(parseInt(e.target.value || "0") || 0)}
                    className="h-8 w-16 text-center text-sm"
                  />
                  <Button size="sm" variant="ghost" onClick={() => metro.setBpm(Math.min(300, metro.bpm + 5))}>+5</Button>
                </div>
                <Button size="sm" variant="ghost" onClick={tap} className="gap-1">
                  <Hand className="w-3 h-3" /> Tap
                </Button>
                <Button size="sm" variant="ghost" onClick={() => metro.setMuted(!metro.muted)}>
                  {metro.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
              </div>
              {activeIdx != null && segments[activeIdx]?.bpm && (
                <p className="text-[10px] text-muted-foreground mt-3">
                  Synced to segment ({segments[activeIdx].bpm} BPM)
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stop-confirmation: replaces silent autolog so half-second test runs
          don't end up in analytics. */}
      <Dialog open={stopConfirmOpen} onOpenChange={setStopConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log this session?</DialogTitle>
            <DialogDescription>
              You've practiced <span className="font-medium text-foreground">{fmt(totalElapsed)}</span>
              {segments.filter((s) => s.completed).length > 0 && (
                <> across <span className="font-medium text-foreground">
                  {segments.filter((s) => s.completed).length} of {segments.length}
                </span> segments</>
              )}.
              Save it to your history, or discard it (nothing logged).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={discardSession}>
              Discard
            </Button>
            <Button variant="default" onClick={finishSession} className="gap-1">
              <StopCircle className="w-4 h-4" /> Save & log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
