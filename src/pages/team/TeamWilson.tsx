import { useCallback, useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Mic2, RefreshCw, ExternalLink, Mail, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAuth } from "@/hooks/useTeamAuth";

// Charles Wilson — the managed EXTERNAL artist (brain:
// wiki/harborline/charles-wilson-agent-opportunity-2026-07.md). Josh books him
// on ~10% commission, so this surface answers three questions in one screen:
// who have we put him in front of, what came back, and what is the commission
// worth. Backend landed 8/2 (3 tables + RLS + 15 seeded targets) with no UI at
// all — this page is that UI.
//
// RLS: every authenticated teammate can READ; only is_operator() can write. The
// selects below disable for non-operators rather than letting a save 403 in
// their face.

type SubmissionRow = {
  id: string;
  target: string;
  category: string;
  region: string | null;
  submit_path: string | null;
  status: string;
  submitted_at: string | null;
  notes: string | null;
  sort: number;
};
type BookingRow = {
  id: string;
  event_date: string | null;
  venue: string | null;
  buyer: string | null;
  fee: number | null;
  commission_pct: number;
  status: string;
  notes: string | null;
};
type OutreachRow = {
  id: string;
  target: string | null;
  channel: string | null;
  direction: string;
  summary: string;
  happened_at: string;
};

// Free-text in the DB (no CHECK constraint), so the vocabulary lives here.
// Covers both seeded values (not_submitted, listed) plus the stages a target
// actually moves through once Josh starts working it.
const SUBMISSION_STATUSES = [
  "not_submitted", "submitted", "in_conversation", "listed", "declined", "skip",
];
const SUBMISSION_STATUS_STYLE: Record<string, string> = {
  not_submitted: "bg-muted/60 text-muted-foreground",
  submitted: "bg-primary/15 text-primary",
  in_conversation: "bg-sky-500/15 text-sky-400",
  listed: "bg-emerald-500/15 text-emerald-400",
  declined: "bg-rose-500/15 text-rose-400",
  skip: "bg-muted/60 text-muted-foreground",
};

const BOOKING_STATUSES = ["pitched", "offered", "confirmed", "played", "paid", "lost"];
const BOOKING_STATUS_STYLE: Record<string, string> = {
  pitched: "bg-primary/15 text-primary",
  offered: "bg-sky-500/15 text-sky-400",
  confirmed: "bg-emerald-500/15 text-emerald-400",
  played: "bg-emerald-500/15 text-emerald-400",
  paid: "bg-accent/15 text-accent",
  lost: "bg-rose-500/15 text-rose-400",
};

// Category order = the order Josh works them. Existing rep is context, not work.
const CATEGORY_ORDER = ["agency", "festival", "network", "existing-rep"];
const CATEGORY_LABEL: Record<string, string> = {
  agency: "Agencies",
  festival: "Festivals",
  network: "Networks & press",
  "existing-rep": "Already representing him",
};
const CATEGORY_NOTE: Record<string, string> = {
  agency: "Roster submissions — the ones that book dates for him.",
  festival: "Direct pitches. Most want an agent first, so these follow the agencies.",
  network: "Blues societies, publicity, charts. These raise demand, they do not book.",
  "existing-rep": "In place before Josh came on. Listed so we do not double-pitch.",
};

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// submit_path is a mixed bag in the seed: URLs, bare emails, and nulls.
function pathLink(p: string): { href: string; label: string; mail: boolean } | null {
  if (p.startsWith("http")) return { href: p, label: "submit", mail: false };
  if (p.includes("@")) return { href: `mailto:${p}`, label: p, mail: true };
  return null;
}

export default function TeamWilson() {
  const { isOperator } = useTeamAuth();
  const [subs, setSubs] = useState<SubmissionRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [outreach, setOutreach] = useState<OutreachRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Log-a-touch composer — outreach is the whole point of the page, so logging
  // one stays inline instead of behind a dialog.
  const [logTarget, setLogTarget] = useState("");
  const [logSummary, setLogSummary] = useState("");
  const [logging, setLogging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, b, o] = await Promise.all([
      supabase
        .from("wilson_submissions")
        .select("id, target, category, region, submit_path, status, submitted_at, notes, sort")
        .order("sort", { ascending: true }),
      supabase
        .from("wilson_bookings")
        .select("id, event_date, venue, buyer, fee, commission_pct, status, notes")
        .order("event_date", { ascending: true }),
      supabase
        .from("wilson_outreach")
        .select("id, target, channel, direction, summary, happened_at")
        .order("happened_at", { ascending: false })
        .limit(50),
    ]);
    if (s.error) toast.error(s.error.message);
    if (b.error) toast.error(b.error.message);
    if (o.error) toast.error(o.error.message);
    setSubs((s.data ?? []) as SubmissionRow[]);
    setBookings((b.data ?? []) as BookingRow[]);
    setOutreach((o.data ?? []) as OutreachRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setSubStatus = useCallback(async (id: string, status: string) => {
    const row = subs.find((r) => r.id === id);
    // Stamp the submit date the first time it leaves not_submitted, so the
    // follow-up clock starts without Josh having to type a date.
    const stampNow = status !== "not_submitted" && !row?.submitted_at;
    const submitted_at = stampNow ? new Date().toISOString().slice(0, 10) : row?.submitted_at ?? null;
    setSubs((prev) => prev.map((r) => (r.id === id ? { ...r, status, submitted_at } : r)));
    const { error } = await supabase
      .from("wilson_submissions")
      .update({ status, submitted_at, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Failed to save"); void load(); }
  }, [subs, load]);

  const setBookingStatus = useCallback(async (id: string, status: string) => {
    setBookings((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase
      .from("wilson_bookings")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Failed to save"); void load(); }
  }, [load]);

  const logTouch = useCallback(async () => {
    if (!logSummary.trim()) { toast.error("Say what happened first"); return; }
    setLogging(true);
    const { error } = await supabase.from("wilson_outreach").insert({
      target: logTarget.trim() || null,
      summary: logSummary.trim(),
      direction: "out",
    });
    setLogging(false);
    if (error) { toast.error(error.message); return; }
    setLogTarget("");
    setLogSummary("");
    toast.success("Logged");
    void load();
  }, [logTarget, logSummary, load]);

  const byCategory = useMemo(() => {
    const m = new Map<string, SubmissionRow[]>();
    for (const r of subs) (m.get(r.category) ?? m.set(r.category, []).get(r.category)!).push(r);
    // Unknown categories sort to the end rather than to the front (indexOf -1).
    const rank = (c: string) => { const i = CATEGORY_ORDER.indexOf(c); return i === -1 ? 99 : i; };
    return [...m.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [subs]);

  // Commission math: what the pipeline is actually worth. Confirmed/played/paid
  // is money in flight; everything else is still a pitch.
  const earned = useMemo(() => {
    const live = bookings.filter((b) => ["confirmed", "played", "paid"].includes(b.status));
    const gross = live.reduce((a, b) => a + (b.fee ?? 0), 0);
    const commission = live.reduce((a, b) => a + (b.fee ?? 0) * (b.commission_pct ?? 0) / 100, 0);
    return { n: live.length, gross, commission };
  }, [bookings]);

  const worked = subs.filter((r) => r.status !== "not_submitted" && r.category !== "existing-rep").length;
  const workable = subs.filter((r) => r.category !== "existing-rep").length;

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
              <Mic2 className="w-7 h-7 text-primary" /> Charles Wilson
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Managed artist · Josh books him on commission · {worked} of {workable} targets worked
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {/* Who he is — the pitch facts, so nobody has to go find the brain page. */}
        <div className="rounded-lg border border-border bg-card/40 p-3.5 mb-6">
          <p className="text-sm text-foreground/90">
            Soul-blues singer, "The Crown Prince of Soul." Nephew of Little Milton. Blues Hall of Fame
            inductee (2019), two-time W.C. Handy Award nominee. Records for Severn and Bear Family.
            Nashville-based.
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-1.5">
            brain: wiki/harborline/charles-wilson-agent-opportunity-2026-07.md · drafts:
            charles-wilson-outreach-drafts-2026-07.md
          </p>
        </div>

        {/* Commission strip */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="rounded-lg border border-border bg-card/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Live bookings</p>
            <p className="text-xl text-foreground tabular-nums mt-0.5">{earned.n}</p>
          </div>
          <div className="rounded-lg border border-border bg-card/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gross fees</p>
            <p className="text-xl text-foreground tabular-nums mt-0.5">{money(earned.gross)}</p>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Commission</p>
            <p className="text-xl text-emerald-400 tabular-nums mt-0.5">{money(earned.commission)}</p>
          </div>
        </div>

        {/* ── Targets, grouped by how Josh works them ─────────────────────── */}
        {byCategory.map(([cat, rows]) => (
          <section key={cat} className="mb-6">
            <h2 className="font-display text-lg tracking-wide-custom text-foreground">
              {CATEGORY_LABEL[cat] ?? cat}{" "}
              <span className="text-sm text-muted-foreground tabular-nums">{rows.length}</span>
            </h2>
            {CATEGORY_NOTE[cat] && (
              <p className="text-[11px] text-muted-foreground mb-2">{CATEGORY_NOTE[cat]}</p>
            )}
            <div className="space-y-2">
              {rows.map((r) => {
                const link = r.submit_path ? pathLink(r.submit_path) : null;
                return (
                  <div key={r.id} className="rounded-lg border border-border bg-card/40 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{r.target}</span>
                          {r.region && (
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
                              {r.region}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                          {link ? (
                            <a href={link.href} target={link.mail ? undefined : "_blank"} rel="noreferrer"
                              className="inline-flex items-center gap-0.5 hover:text-foreground">
                              {link.mail ? <Mail className="w-3 h-3" /> : <ExternalLink className="w-3 h-3" />}
                              {link.label}
                            </a>
                          ) : (
                            <span>no submission channel found</span>
                          )}
                          {r.submitted_at && <span>· sent {r.submitted_at}</span>}
                        </div>
                      </div>
                      <select
                        value={r.status}
                        disabled={!isOperator}
                        onChange={(e) => setSubStatus(r.id, e.target.value)}
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border-0 shrink-0 ${isOperator ? "cursor-pointer" : "opacity-70"} ${SUBMISSION_STATUS_STYLE[r.status] ?? ""}`}
                      >
                        {/* Keep an unknown DB value selectable so it never silently flips. */}
                        {(SUBMISSION_STATUSES.includes(r.status)
                          ? SUBMISSION_STATUSES
                          : [r.status, ...SUBMISSION_STATUSES]
                        ).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    {r.notes && <p className="text-[11px] text-muted-foreground mt-2">{r.notes}</p>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {!loading && subs.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No targets seeded yet.</p>
        )}

        {/* ── Bookings ────────────────────────────────────────────────────── */}
        <section className="mb-6">
          <h2 className="font-display text-lg tracking-wide-custom text-foreground mb-2">
            Bookings <span className="text-sm text-muted-foreground tabular-nums">{bookings.length}</span>
          </h2>
          <div className="space-y-2">
            {bookings.map((b) => (
              <div key={b.id} className="rounded-lg border border-border bg-card/40 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{b.venue || "venue TBD"}</span>
                      {b.buyer && <span className="text-[11px] text-muted-foreground">via {b.buyer}</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground tabular-nums">
                      <span>{b.event_date || "date TBD"}</span>
                      {b.fee != null && (
                        <span>
                          · {money(b.fee)} · {b.commission_pct}% ={" "}
                          <span className="text-emerald-400">{money(b.fee * b.commission_pct / 100)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <select
                    value={b.status}
                    disabled={!isOperator}
                    onChange={(e) => setBookingStatus(b.id, e.target.value)}
                    className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border-0 shrink-0 ${isOperator ? "cursor-pointer" : "opacity-70"} ${BOOKING_STATUS_STYLE[b.status] ?? ""}`}
                  >
                    {(BOOKING_STATUSES.includes(b.status)
                      ? BOOKING_STATUSES
                      : [b.status, ...BOOKING_STATUSES]
                    ).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {b.notes && <p className="text-[11px] text-muted-foreground mt-2">{b.notes}</p>}
              </div>
            ))}
            {bookings.length === 0 && (
              <p className="text-sm text-muted-foreground py-4">
                No bookings yet. The first one comes from a target above.
              </p>
            )}
          </div>
        </section>

        {/* ── Outreach log ────────────────────────────────────────────────── */}
        <section>
          <h2 className="font-display text-lg tracking-wide-custom text-foreground mb-2">
            Outreach log <span className="text-sm text-muted-foreground tabular-nums">{outreach.length}</span>
          </h2>
          {isOperator && (
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <Input
                value={logTarget}
                onChange={(e) => setLogTarget(e.target.value)}
                placeholder="Who (optional)"
                className="sm:max-w-[14rem]"
              />
              <Input
                value={logSummary}
                onChange={(e) => setLogSummary(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void logTouch(); }}
                placeholder="What happened"
              />
              <Button size="sm" onClick={() => void logTouch()} disabled={logging} className="shrink-0">
                {logging ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
                Log
              </Button>
            </div>
          )}
          <div className="space-y-2">
            {outreach.map((o) => (
              <div key={o.id} className="rounded-lg border border-border bg-card/40 p-3">
                <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                  <span className="tabular-nums">{o.happened_at}</span>
                  <span className={`uppercase tracking-wider px-1.5 py-0.5 rounded ${o.direction === "in" ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/15 text-primary"}`}>
                    {o.direction === "in" ? "reply" : "sent"}
                  </span>
                  {o.target && <span className="text-foreground">{o.target}</span>}
                  {o.channel && <span>· {o.channel}</span>}
                </div>
                <p className="text-sm text-foreground/90 mt-1">{o.summary}</p>
              </div>
            ))}
            {outreach.length === 0 && (
              <p className="text-sm text-muted-foreground py-4">
                Nothing logged yet. Every send and reply goes here so follow-ups have a clock.
              </p>
            )}
          </div>
        </section>
      </div>
    </TeamLayout>
  );
}
