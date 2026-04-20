import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Repeat, Sparkles, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Brand = { id: string; slug: string; name: string; color: string; platforms: string[] };
type Source = {
  id: string; brand_id: string; title: string; description: string;
  kind: "recurring" | "oneoff"; cadence: "weekly" | "biweekly" | "monthly" | null;
  day_of_week: number | null; event_date: string | null; active: boolean;
};
type Post = {
  id: string; brand_id: string; source_id: string | null; title: string; notes: string;
  status: "idea" | "drafting" | "scheduled" | "posted";
  scheduled_for: string | null; posted_at: string | null;
};

type DragPayload =
  | { kind: "source"; sourceId: string }
  | { kind: "post"; postId: string };

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am - 11pm
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtHour(h: number): string {
  const ampm = h >= 12 ? "p" : "a";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${ampm}`;
}

interface Props {
  brand: Brand;
  sources: Source[];
  posts: Post[];
  onSchedulePost: (postId: string, isoDate: string) => Promise<void> | void;
  onCreatePostFromSource: (sourceId: string, isoDate: string) => Promise<void> | void;
  onOpenPost: (post: Post) => void;
  onUnschedule: (postId: string) => Promise<void> | void;
}

export default function WeekScheduleCalendar({
  brand, sources, posts, onSchedulePost, onCreatePostFromSource, onOpenPost, onUnschedule,
}: Props) {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [dragOver, setDragOver] = useState<string | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = addDays(weekStart, 7);

  // Posts that are scheduled within this visible week
  const scheduledThisWeek = useMemo(() => {
    return posts.filter((p) => {
      if (!p.scheduled_for) return false;
      const t = new Date(p.scheduled_for).getTime();
      return t >= weekStart.getTime() && t < weekEnd.getTime();
    });
  }, [posts, weekStart, weekEnd]);

  // Backlog: ideas + drafting that aren't scheduled yet
  const backlogPosts = useMemo(
    () => posts.filter((p) => (p.status === "idea" || p.status === "drafting") && !p.scheduled_for),
    [posts],
  );

  const handleDragStart = (e: React.DragEvent, payload: DragPayload) => {
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e: React.DragEvent, day: Date, hour: number) => {
    e.preventDefault();
    setDragOver(null);
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    let payload: DragPayload;
    try { payload = JSON.parse(raw); } catch { return; }
    const slot = new Date(day);
    slot.setHours(hour, 0, 0, 0);
    const iso = slot.toISOString();
    if (payload.kind === "post") await onSchedulePost(payload.postId, iso);
    else await onCreatePostFromSource(payload.sourceId, iso);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = (d: Date) => d.getTime() === today.getTime();

  const weekLabel = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <div className="rounded-lg border bg-muted/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/40">
        <div className="flex items-center gap-2">
          <CalIcon className="w-4 h-4 text-primary" />
          <span className="font-display tracking-wide-custom text-sm">Week Schedule</span>
          <Badge variant="outline" className="text-[10px]">{weekLabel}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Today
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[200px_1fr]">
        {/* Drag tray (sources + backlog) */}
        <div className="border-r bg-background/40 p-2 space-y-3 max-h-[480px] overflow-y-auto">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <Repeat className="w-3 h-3" /> Sources
            </div>
            <div className="space-y-1.5">
              {sources.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic">No sources yet</p>
              )}
              {sources.map((s) => (
                <div
                  key={s.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, { kind: "source", sourceId: s.id })}
                  className="rounded border bg-card hover:bg-card/80 px-2 py-1.5 cursor-grab active:cursor-grabbing transition-colors"
                  style={{ borderLeft: `3px solid ${brand.color}` }}
                  title={s.description}
                >
                  <div className="text-xs font-medium truncate flex items-center gap-1">
                    {s.kind === "recurring" ? <Repeat className="w-3 h-3 opacity-60" /> : <CalIcon className="w-3 h-3 opacity-60" />}
                    {s.title}
                  </div>
                  {s.kind === "recurring" && s.cadence && (
                    <div className="text-[10px] text-muted-foreground capitalize">
                      {s.cadence}{s.day_of_week !== null ? ` · ${DAY_LABELS[s.day_of_week]}` : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Backlog ({backlogPosts.length})
            </div>
            <div className="space-y-1.5">
              {backlogPosts.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic">No unscheduled ideas</p>
              )}
              {backlogPosts.map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, { kind: "post", postId: p.id })}
                  onClick={() => onOpenPost(p)}
                  className="rounded border bg-card hover:bg-card/80 px-2 py-1.5 cursor-grab active:cursor-grabbing transition-colors"
                  style={{ borderLeft: `3px solid ${brand.color}` }}
                >
                  <div className="text-xs font-medium truncate flex items-center gap-1">
                    {p.status === "idea" ? <Sparkles className="w-3 h-3 opacity-60" /> : <FileText className="w-3 h-3 opacity-60" />}
                    {p.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground capitalize">{p.status}</div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground/70 italic pt-1 border-t">
            Drag onto a day &amp; time to schedule.
          </p>
        </div>

        {/* Calendar grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Day header row */}
            <div className="grid grid-cols-[40px_repeat(7,1fr)] sticky top-0 bg-muted/40 border-b z-10">
              <div />
              {days.map((d) => (
                <div
                  key={d.toISOString()}
                  className={`text-center py-1.5 text-xs border-l ${
                    isToday(d) ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground"
                  }`}
                >
                  <div className="font-display tracking-wide-custom">{DAY_LABELS[d.getDay()]}</div>
                  <div className="text-[10px] opacity-70">{d.getMonth() + 1}/{d.getDate()}</div>
                </div>
              ))}
            </div>

            {/* Hour rows */}
            <div className="max-h-[420px] overflow-y-auto">
              {HOURS.map((hour) => (
                <div key={hour} className="grid grid-cols-[40px_repeat(7,1fr)] border-b border-border/40">
                  <div className="text-[10px] text-muted-foreground text-right pr-1.5 pt-1">
                    {fmtHour(hour)}
                  </div>
                  {days.map((d) => {
                    const slotKey = `${d.toISOString()}-${hour}`;
                    const slotStart = new Date(d); slotStart.setHours(hour, 0, 0, 0);
                    const slotEnd = new Date(d); slotEnd.setHours(hour + 1, 0, 0, 0);
                    const cellPosts = scheduledThisWeek.filter((p) => {
                      const t = new Date(p.scheduled_for!).getTime();
                      return t >= slotStart.getTime() && t < slotEnd.getTime();
                    });
                    const isOver = dragOver === slotKey;
                    return (
                      <div
                        key={slotKey}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(slotKey); }}
                        onDragLeave={() => setDragOver((cur) => (cur === slotKey ? null : cur))}
                        onDrop={(e) => handleDrop(e, d, hour)}
                        className={`border-l min-h-[36px] p-0.5 transition-colors ${
                          isOver ? "bg-primary/15 ring-1 ring-primary/40" : "hover:bg-muted/30"
                        }`}
                      >
                        {cellPosts.map((p) => (
                          <div
                            key={p.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, { kind: "post", postId: p.id })}
                            onClick={() => onOpenPost(p)}
                            className="group rounded px-1.5 py-1 mb-0.5 text-[11px] cursor-pointer relative"
                            style={{ backgroundColor: `${brand.color}33`, borderLeft: `3px solid ${brand.color}` }}
                            title={p.title}
                          >
                            <div className="truncate font-medium pr-4">{p.title}</div>
                            <div className="text-[9px] text-muted-foreground">
                              {new Date(p.scheduled_for!).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); onUnschedule(p.id); }}
                              className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive"
                              title="Unschedule"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
