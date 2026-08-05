import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Target, Play, Pause, RotateCcw, CheckCircle2, SkipForward, Loader2, ExternalLink, Coffee,
} from "lucide-react";
import {
  POMODORO,
  ageDays,
  cheer,
  formatClock,
  heatLabel,
  heatTier,
  HEAT_STYLE,
  pickNextFocus,
} from "@/lib/focus";

// Focus layer, elements 1 / 2 / 5 (Josh approved all five 2026-07-21, review
// card ab338385 "Build all 5"). One next action, a visible 25/5 timer on it,
// and a small celebration when it closes. Elements 3 (WIP cap) and 4 (aging
// heat) live on the SMART board where the Active column is.
//
// The toggle is OFF by default and hides nothing until it is on — the rest of
// the dashboard stays exactly where it was. `onFocusChange` lets the page dim
// its other widgets while focus is running.

type FocusRow = {
  id: string;
  raw_input: string;
  revised_title: string | null;
  definition_of_done: string | null;
  measure: string | null;
  effort: string | null;
  due_date: string | null;
  created_at: string;
  board_bucket: string | null;
  google_calendar_event_id: string | null;
  google_calendar_html_link: string | null;
  trello_card_url: string | null;
};

const STORE_KEY = "harborline.focusMode";

// Same derivation the SMART board uses: a row is Active when it says so, or
// when it has been put on the calendar.
function isActive(r: FocusRow): boolean {
  if (r.board_bucket && r.board_bucket !== "Trello inbox") return r.board_bucket === "Active";
  return Boolean(r.google_calendar_event_id);
}

export default function FocusModeWidget({
  onFocusChange,
}: {
  onFocusChange?: (on: boolean) => void;
}) {
  const [on, setOn] = useState<boolean>(() => {
    try { return localStorage.getItem(STORE_KEY) === "1"; } catch { return false; }
  });
  const [rows, setRows] = useState<FocusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [closing, setClosing] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [burst, setBurst] = useState<string | null>(null);

  // Timer: 25 work / 5 break, counts down, auto-flips phase at zero.
  const [phase, setPhase] = useState<"work" | "break">("work");
  const [left, setLeft] = useState<number>(POMODORO.work);
  const [running, setRunning] = useState(false);
  const tick = useRef<number | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, on ? "1" : "0"); } catch { /* private mode */ }
    onFocusChange?.(on);
  }, [on, onFocusChange]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("smart_task_enrichments")
      .select(
        "id, raw_input, revised_title, definition_of_done, measure, effort, due_date, created_at, board_bucket, google_calendar_event_id, google_calendar_html_link, trello_card_url",
      )
      // Narrow server-side to a superset of Active (the table is ~700 rows and
      // only ~24 are active). isActive() below applies the exact board rule.
      .or("board_bucket.eq.Active,google_calendar_event_id.not.is.null")
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setRows(((data ?? []) as FocusRow[]).filter(isActive));
    setLoading(false);
  }, []);

  useEffect(() => { if (on) void load(); }, [on, load]);

  useEffect(() => {
    if (!running) return;
    tick.current = window.setInterval(() => setLeft((s) => s - 1), 1000);
    return () => { if (tick.current) window.clearInterval(tick.current); };
  }, [running]);

  // Phase flip at zero. Work → break pauses so a break is a real choice; break
  // → work also pauses, so nothing silently eats a pomodoro while he is away.
  useEffect(() => {
    if (left > 0) return;
    setRunning(false);
    const next = phase === "work" ? "break" : "work";
    setPhase(next);
    setLeft(next === "work" ? POMODORO.work : POMODORO.break);
    toast(phase === "work" ? "25 up — take 5." : "Break's over.");
  }, [left, phase]);

  const resetTimer = useCallback((p: "work" | "break" = "work") => {
    setRunning(false);
    setPhase(p);
    setLeft(p === "work" ? POMODORO.work : POMODORO.break);
  }, []);

  const queue = useMemo(() => rows.filter((r) => !skipped.has(r.id)), [rows, skipped]);
  const current = useMemo(() => pickNextFocus(queue), [queue]);

  const celebrate = useCallback(() => {
    const n = doneCount + 1;
    setDoneCount(n);
    setBurst(cheer(n));
    window.setTimeout(() => setBurst(null), 1600);
  }, [doneCount]);

  const markDone = useCallback(async () => {
    if (!current) return;
    setClosing(true);
    try {
      // Same path the SMART board uses — closes the row and queues the Trello
      // check-off, so focus mode is not a second, divergent write path.
      const { error } = await supabase.functions.invoke("update-smart-task-bucket", {
        body: { id: current.id, bucket: "Done" },
      });
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== current.id));
      celebrate();
      resetTimer("break");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not close it");
    } finally {
      setClosing(false);
    }
  }, [current, celebrate, resetTimer]);

  const skip = useCallback(() => {
    if (!current) return;
    setSkipped((prev) => new Set(prev).add(current.id));
    resetTimer("work");
  }, [current, resetTimer]);

  const total = phase === "work" ? POMODORO.work : POMODORO.break;
  const pct = ((total - left) / total) * 100;
  const days = current ? ageDays(current.created_at) : 0;
  const tier = heatTier(days);

  return (
    <Card className={on ? "border-primary/50" : "border-border"}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Target className={`w-5 h-5 ${on ? "text-primary" : "text-muted-foreground"}`} />
            <div>
              <p className="font-display tracking-wide-custom text-foreground">Just one thing</p>
              <p className="text-[11px] text-muted-foreground">
                {on ? "Everything else is hidden. Close this, get the next one." : "Hide the dashboard and work one card at a time."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {doneCount > 0 && (
              <span className="text-[11px] text-emerald-400 tabular-nums">{doneCount} done</span>
            )}
            <Switch checked={on} onCheckedChange={setOn} aria-label="Focus mode" />
          </div>
        </div>

        {on && (
          <div className="mt-4">
            {loading && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" /> Finding the next one…
              </p>
            )}

            {!loading && !current && (
              <div className="py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-foreground">
                  {skipped.size > 0 ? "That's everything you didn't skip." : "Nothing active. The board is clear."}
                </p>
                <div className="flex items-center justify-center gap-2 mt-3">
                  {skipped.size > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setSkipped(new Set())}>
                      Bring back {skipped.size} skipped
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/team/review">Open the board</Link>
                  </Button>
                </div>
              </div>
            )}

            {!loading && current && (
              <div className="relative">
                {/* Micro-celebration: a short burst over the card, then it's gone. */}
                {burst && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <span className="absolute w-24 h-24 rounded-full bg-emerald-400/20 animate-ping" />
                    <span className="relative flex items-center gap-2 text-emerald-400 font-display text-2xl tracking-wide-custom animate-fade-up">
                      <CheckCircle2 className="w-7 h-7" /> {burst}
                    </span>
                  </div>
                )}

                <div className={burst ? "opacity-30 transition-opacity" : "transition-opacity"}>
                  {/* The one card — big, and the only thing to read. */}
                  <p className="font-display text-2xl tracking-wide-custom text-foreground leading-snug">
                    {current.revised_title || current.raw_input}
                  </p>

                  <div className="flex items-center gap-3 flex-wrap mt-2 text-[11px] text-muted-foreground">
                    {tier !== "fresh" && (
                      <span className={`inline-flex items-center gap-1 ${HEAT_STYLE[tier].text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${HEAT_STYLE[tier].dot}`} />
                        sat {heatLabel(days)}
                      </span>
                    )}
                    {current.due_date && <span className="tabular-nums">due {current.due_date}</span>}
                    {current.effort && <span>{current.effort}</span>}
                    <span>{queue.length - 1} more after this</span>
                    {(current.google_calendar_html_link || current.trello_card_url) && (
                      <a
                        href={current.google_calendar_html_link || current.trello_card_url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 hover:text-foreground"
                      >
                        source <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {current.definition_of_done && (
                    <p className="text-sm text-foreground/90 mt-3">
                      <span className="text-muted-foreground">Done =</span> {current.definition_of_done}
                    </p>
                  )}
                  {current.measure && (
                    <p className="text-[11px] text-muted-foreground mt-1">Measure: {current.measure}</p>
                  )}

                  {/* Visible 25/5 timer on the focused item. */}
                  <div className="mt-4 rounded-lg border border-border bg-card/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        {phase === "break" ? <Coffee className="w-4 h-4 text-sky-400" /> : <Target className="w-4 h-4 text-primary" />}
                        <span className="font-display text-3xl tabular-nums text-foreground">{formatClock(left)}</span>
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {phase === "break" ? "break" : "focus"}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Button size="sm" variant={running ? "outline" : "default"} onClick={() => setRunning((v) => !v)}>
                          {running ? <Pause className="w-4 h-4 mr-1.5" /> : <Play className="w-4 h-4 mr-1.5" />}
                          {running ? "Pause" : "Start"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => resetTimer(phase)} aria-label="Reset timer">
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5 mt-2.5" />
                  </div>

                  {/* Done → next loop. */}
                  <div className="flex items-center gap-2 mt-3">
                    <Button onClick={() => void markDone()} disabled={closing} className="flex-1">
                      {closing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                      Done — next one
                    </Button>
                    <Button variant="outline" onClick={skip} disabled={closing}>
                      <SkipForward className="w-4 h-4 mr-1.5" /> Not now
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
