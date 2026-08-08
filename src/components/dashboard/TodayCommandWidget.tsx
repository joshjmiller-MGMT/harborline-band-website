import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Sun, AlertTriangle, ArrowRight, CircleDot, ListChecks } from "lucide-react";

// TODAY command panel (Josh 2026-07-19): "the core answer of what I'm doing
// daily needs to be on my main dashboard." Pulled LIVE from the system —
// no routine silo. Left: what needs Josh. Middle: what's blocked on him on
// the team boards. Right: what every teammate is on right now.

type ReviewRow = { id: string; title: string; priority: string; queued_at: string };
type TodoRow = ReviewRow & { est_minutes: number | null; do_order: number | null; requires_josh_action: boolean };

// Bands for the full list. do_order is assigned deliberately: unblockers and
// live security holes first, then anything with a date on it, then decisions
// that unblock Claude, then long-form sit-down work.
const BANDS: { key: string; label: string; blurb: string; max: number }[] = [
  { key: "unblock", label: "Do these first", blurb: "each one unblocks other work or closes a live hole", max: 9 },
  { key: "clock", label: "On a clock", blurb: "these have a date attached", max: 12 },
  { key: "decide", label: "Decisions", blurb: "short answers that unblock me", max: 18 },
  { key: "sitdown", label: "Sit-down work", blurb: "needs a proper block of time", max: 99 },
];

const mins = (n: number) => (n >= 60 ? `${Math.floor(n / 60)}h ${n % 60 ? `${n % 60}m` : ""}`.trim() : `${n}m`);
type BlockedJob = { title: string; blocked_reason: string | null; slug: string; emoji: string };
type AgentRow = { slug: string; name: string; emoji: string; status: string; current_action: string | null };
type Brief = { brief_date: string; brief_md: string };

function age(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function TodayCommandWidget() {
  const [review, setReview] = useState<ReviewRow[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [blocked, setBlocked] = useState<BlockedJob[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [listOpen, setListOpen] = useState(true);

  useEffect(() => {
    (async () => {
      const [r, j, a] = await Promise.all([
        supabase
          .from("waiting_on_josh")
          .select("id, title, priority, queued_at", { count: "exact" })
          .is("resolved_at", null)
          .order("priority", { ascending: true })
          .order("queued_at", { ascending: true })
          .limit(6),
        supabase
          .from("agent_jobs")
          .select("title, blocked_reason, agent_teammates(slug, emoji)")
          .eq("status", "blocked")
          .limit(8),
        supabase
          .from("agent_teammates")
          .select("slug, name, emoji, status, current_action")
          .order("sort_order"),
      ]);
      const rows = (r.data as ReviewRow[]) || [];
      // priority sorts alphabetically (high < low < normal) — fix ordering here.
      const rank: Record<string, number> = { high: 0, normal: 1, low: 2 };
      rows.sort((x, y) => (rank[x.priority] ?? 1) - (rank[y.priority] ?? 1) || +new Date(x.queued_at) - +new Date(y.queued_at));
      setReview(rows);
      setReviewTotal(r.count || 0);
      setBlocked(
        ((j.data as unknown as { title: string; blocked_reason: string | null; agent_teammates: { slug: string; emoji: string } | null }[]) || []).map(
          (x) => ({ title: x.title, blocked_reason: x.blocked_reason, slug: x.agent_teammates?.slug || "", emoji: x.agent_teammates?.emoji || "•" }),
        ),
      );
      setAgents((a.data as AgentRow[]) || []);
      const { data: b } = await supabase
        .from("daily_briefs")
        .select("brief_date, brief_md")
        .order("brief_date", { ascending: false })
        .limit(1);
      if (b?.[0]) setBrief(b[0] as Brief);

      // The full list — everything open, in the order it should be worked.
      const { data: t } = await supabase
        .from("waiting_on_josh")
        .select("id, title, priority, queued_at, est_minutes, do_order, requires_josh_action")
        .is("resolved_at", null)
        .order("do_order", { ascending: true, nullsFirst: false })
        .order("queued_at", { ascending: true });
      setTodos((t as TodoRow[]) || []);
    })();
  }, []);

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-transparent">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sun className="w-4 h-4 text-primary" />
          <h2 className="font-display text-lg tracking-wide-custom text-foreground">Today</h2>
          <span className="text-xs text-muted-foreground">the whole operation, one glance — nothing briefs anywhere else</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 1 — needs Josh */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Needs you ({reviewTotal})</h3>
              <Link to="/team/review" className="text-xs text-primary hover:underline inline-flex items-center gap-0.5">
                review <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <ul className="space-y-1">
              {review.map((r) => (
                <li key={r.id} className="text-sm flex items-start gap-1.5">
                  {r.priority === "high" && <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />}
                  <Link to="/team/review" className="hover:text-primary truncate">{r.title}</Link>
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{age(r.queued_at)}</span>
                </li>
              ))}
              {review.length === 0 && <li className="text-sm text-muted-foreground">Clear. 🎉</li>}
            </ul>
          </div>
          {/* 2 — blocked on Josh across the boards */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Team blocked on you ({blocked.length})</h3>
            <ul className="space-y-1">
              {blocked.map((b, i) => (
                <li key={i} className="text-sm">
                  <span className="mr-1">{b.emoji}</span>
                  <span className="text-foreground">{b.title}</span>
                  {b.blocked_reason && <span className="block text-[11px] text-amber-500/90 pl-5">{b.blocked_reason}</span>}
                </li>
              ))}
              {blocked.length === 0 && <li className="text-sm text-muted-foreground">Nothing — all lanes moving.</li>}
            </ul>
          </div>
          {/* 3 — what the team is doing right now */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team is on</h3>
              <Link to="/team/members" className="text-xs text-primary hover:underline inline-flex items-center gap-0.5">
                boards <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <ul className="space-y-1">
              {agents.map((a) => (
                <li key={a.slug} className="text-sm flex items-center gap-1.5 min-w-0">
                  <span>{a.emoji}</span>
                  <CircleDot className={`w-2.5 h-2.5 shrink-0 ${a.status === "working" ? "text-green-500" : a.status === "waiting_on_josh" ? "text-amber-500" : "text-muted-foreground/40"}`} />
                  <span className="text-muted-foreground truncate">{a.current_action || "idle"}</span>
                </li>
              ))}
            </ul>
            <Badge variant="outline" className="mt-2 text-[10px]">every routine + update flows here — no silos</Badge>
          </div>
        </div>
        {/* The full list. The three columns above are the glance; this is
            everything on Josh, in the order it should be worked, with honest
            time estimates (Josh 2026-08-08: "everything I need to do for
            everything"). Banded so a two-minute unblock never sits below a
            forty-five-minute grant application. */}
        {todos.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/40">
            <button
              type="button"
              onClick={() => setListOpen(!listOpen)}
              className="flex w-full items-center gap-2 text-left"
            >
              <ListChecks className="w-4 h-4 text-primary shrink-0" />
              <h3 className="font-display text-sm tracking-wide-custom">Everything on you</h3>
              <Badge variant="secondary" className="font-normal text-[10px]">
                {todos.length} items · {mins(todos.reduce((s, t) => s + (t.est_minutes ?? 0), 0))} total
              </Badge>
              <span className="ml-auto text-xs text-primary">{listOpen ? "hide" : "show"}</span>
            </button>

            {listOpen && (
              <div className="mt-3 space-y-4">
                {BANDS.map((band, bi) => {
                  const lo = bi === 0 ? 1 : BANDS[bi - 1].max + 1;
                  const rows = todos.filter(
                    (t) => (t.do_order ?? 999) >= lo && (t.do_order ?? 999) <= band.max,
                  );
                  if (!rows.length) return null;
                  const total = rows.reduce((s, t) => s + (t.est_minutes ?? 0), 0);
                  return (
                    <div key={band.key}>
                      <div className="flex flex-wrap items-baseline gap-x-2 mb-1.5">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                          {band.label}
                        </h4>
                        <span className="text-[11px] text-muted-foreground">
                          {band.blurb} · {rows.length} items, {mins(total)}
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {rows.map((t) => (
                          <li key={t.id} className="flex items-start gap-2 text-sm">
                            <span className="mt-0.5 w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                              {t.est_minutes ? mins(t.est_minutes) : "—"}
                            </span>
                            {t.priority === "high" && (
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                            )}
                            <Link to="/team/review" className="min-w-0 flex-1 hover:text-primary">
                              {t.title}
                            </Link>
                            {t.requires_josh_action && (
                              <Badge
                                variant="outline"
                                className="mt-0.5 shrink-0 text-[9px] uppercase tracking-wider"
                                title="Only you can do this one — it happens outside our systems"
                              >
                                you only
                              </Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 9am cloud brief — published into the site, rendered here (no silo). */}
        {brief && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <button type="button" onClick={() => setBriefOpen(!briefOpen)}
              className="text-xs text-primary hover:underline">
              ☀️ Morning brief — {brief.brief_date} {briefOpen ? "(hide)" : "(read)"}
            </button>
            {briefOpen && (
              <pre className="mt-2 text-xs text-foreground/90 whitespace-pre-wrap font-sans bg-muted/30 rounded p-3 max-h-80 overflow-y-auto">{brief.brief_md}</pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
