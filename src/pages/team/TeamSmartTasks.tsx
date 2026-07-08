import { useCallback, useMemo, useState } from "react";
import { Sparkles, RefreshCw, ChevronDown, Repeat, MessageSquarePlus, ExternalLink, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import SmartTaskWidget from "@/components/dashboard/SmartTaskWidget";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  SMART_VENTURES,
  VENTURE_COLORS,
  PERSISTABLE_SMART_BUCKETS,
  type SmartBucket,
  type SmartVenture,
  normalizeVenture,
} from "@/components/board/smartTaskBuckets";
import {
  useSmartTaskBoardData,
  type SmartTaskRow,
  type TrelloCard,
} from "@/hooks/useSmartTaskBoardData";

// SMART board v3 (Josh spec 2026-07-07): NO scrum boards. Two clean sections —
// (1) Trello inbox mirroring the SOURCE bucket structure (only buckets that
// still feed the board; routed/done/ported buckets filtered out), and
// (2) SMART tasks as compact rows grouped by stage, with dropdowns instead of
// drag. Built to de-overwhelm: collapse everything you're not working.

// Buckets that still feed the board (the STAY set). Cards from ported buckets
// (Daily's → Day plan, Contacts/POC-F/U → Contacts, To Listen/Learn/Watch →
// Feed) and Claude-execution buckets (website fixes, To Claude) never show.
const INBOX_BUCKETS = new Set([
  "notes", "tasks random", "urgent", "other projects", "web & tech",
  "social / media / content", "harborline", "econ", "bse",
  "solo / personal dev / jazz",
]);

function deriveBucket(row: SmartTaskRow): SmartBucket {
  if (row.board_bucket && row.board_bucket !== "Trello inbox") {
    return row.board_bucket as SmartBucket;
  }
  if (row.google_calendar_event_id) return "Active";
  return "Pending approval";
}

// Sticky undo toast (Josh, 2026-07-08: accidentally sent a card to review —
// every board action gets an Undo popup that STAYS until clicked away).
function undoToast(message: string, onUndo: () => void | Promise<void>) {
  toast(message, {
    duration: Infinity,               // stays until the user clicks it away
    action: { label: "Undo", onClick: () => void onUndo() },
    cancel: { label: "✕", onClick: () => {} },
  });
}

const STAGE_ACCENT: Record<string, string> = {
  "Needs SMART": "text-orange-400",
  "Pending approval": "text-sky-400",
  "Active": "text-emerald-400",
  "Done": "text-muted-foreground",
};
const STAGE_LABEL: Record<string, string> = {
  "Needs SMART": "Needs SMART",
  "Pending approval": "Pending approval",
  "Active": "Active (calendar)",
  "Done": "Done",
};

// Exported as a PANEL (no TeamLayout/page chrome): the smartify board now lives
// at the top of /team/review — review + smartification are ONE surface (Josh,
// 2026-07-07: "review board and smartification board should be the same").
export default function SmartBoardPanel() {
  const {
    trello,
    smartRows,
    smartRowsLoading,
    smartRowsError,
    refreshAll,
    refreshSmartRows,
  } = useSmartTaskBoardData();

  const smartifiedTrelloCardIds = useMemo(() => {
    const s = new Set<string>();
    for (const row of smartRows) if (row.trello_card_id) s.add(row.trello_card_id);
    return s;
  }, [smartRows]);

  // ── Trello inbox: mirror the source buckets, accurately ──────────────────
  const inboxByBucket = useMemo(() => {
    const m = new Map<string, TrelloCard[]>();
    for (const card of trello.cards) {
      const ln = (card.list_name || "").trim();
      if (!INBOX_BUCKETS.has(ln.toLowerCase())) continue;           // ported/exec buckets out
      if (smartifiedTrelloCardIds.has(card.id)) continue;            // already on the board
      const labels = (card.labels || []).map((l) => (l.name || "").toLowerCase());
      if (labels.some((n) => n.includes("routed") || n.includes("done by claude"))) continue;
      (m.get(ln) ?? m.set(ln, []).get(ln)!).push(card);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [trello.cards, smartifiedTrelloCardIds]);
  const inboxCount = useMemo(() => inboxByBucket.reduce((a, [, c]) => a + c.length, 0), [inboxByBucket]);

  // ── SMART rows grouped by stage ───────────────────────────────────────────
  const rowsByStage = useMemo(() => {
    const m = new Map<string, SmartTaskRow[]>();
    for (const b of PERSISTABLE_SMART_BUCKETS) m.set(b, []);
    for (const row of smartRows) {
      const b = deriveBucket(row);
      (m.get(b) ?? m.set(b, []).get(b)!).push(row);
    }
    return m;
  }, [smartRows]);

  // undoBody = the patch that reverts this action; every action gets a sticky
  // Undo toast that only goes away when clicked.
  const patchRow = useCallback(
    async (id: string, body: Record<string, unknown>, okMsg: string, undoBody?: Record<string, unknown>) => {
      try {
        const { error } = await supabase.functions.invoke("update-smart-task-bucket", {
          body: { id, ...body },
        });
        if (error) throw error;
        await refreshSmartRows();
        if (undoBody) {
          undoToast(okMsg, async () => {
            const { error: e2 } = await supabase.functions.invoke("update-smart-task-bucket", {
              body: { id, ...undoBody },
            });
            if (e2) toast.error("Undo failed");
            else { await refreshSmartRows(); toast.success("Undone"); }
          });
        } else {
          toast.success(okMsg);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save");
        await refreshSmartRows();
      }
    },
    [refreshSmartRows],
  );

  const sendToReview = useCallback(async (title: string, ref: string | null) => {
    try {
      const { data, error } = await supabase
        .from("waiting_on_josh")
        .insert({
          title,
          prompt: "Add what you know about this so it can be turned into a SMART action.",
          item_type: "smartify-context",
          priority: "normal",
          source_session: "smart-board",
          source_ref: ref,
        })
        .select("id")
        .single();
      if (error) throw error;
      const newId = (data as { id: string }).id;
      undoToast(`Sent to Review: "${title.slice(0, 50)}"`, async () => {
        const { error: e2 } = await supabase.from("waiting_on_josh").delete().eq("id", newId);
        if (e2) toast.error("Undo failed");
        else toast.success("Undone — removed from Review");
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send to review");
    }
  }, []);

  // Collapse state: stages default open only for Needs SMART + Active (the
  // working set); Pending approval + Done start closed (bulk lives there).
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    inbox: true, "Needs SMART": true, "Pending approval": false, Active: true, Done: false,
  });
  const toggle = (k: string) => setOpenSections((p) => ({ ...p, [k]: !p[k] }));

  // Needs SMART venture tabs (Josh, 2026-07-08): organize the section by category.
  const [needsTab, setNeedsTab] = useState<string>("All");

  const isLoading = smartRowsLoading || trello.loading;

  return (
    <div>
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl tracking-wide-custom text-foreground flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-primary" /> SMART Tasks
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {inboxCount} in Trello inbox · {smartRows.length} SMART-ified
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={refreshAll} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {(smartRowsError || trello.error) && (
          <div className="mb-4 p-2.5 rounded text-xs bg-destructive/10 text-destructive border border-destructive/30 space-y-1">
            {smartRowsError && <p>SMART rows: {smartRowsError}</p>}
            {trello.error && <p>Trello inbox: {trello.error}</p>}
          </div>
        )}

        {/* Quick SMART-ify composer */}
        <div className="mb-6">
          <SmartTaskWidget />
        </div>

        {/* ── Trello inbox — mirrors the source buckets ── */}
        <Collapsible open={openSections.inbox} onOpenChange={() => toggle("inbox")}
          className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-amber-500/10 rounded-lg text-left">
              <span className="flex items-center gap-2 min-w-0">
                <Inbox className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="font-display text-lg tracking-wide-custom text-foreground">Trello inbox</span>
                <span className="text-xs text-muted-foreground">{inboxCount} unrouted · grouped by source bucket · tag 🟢 in Trello to route</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${openSections.inbox ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pb-3 space-y-2">
            {inboxByBucket.length === 0 && (
              <p className="text-xs text-muted-foreground py-2 text-center">Inbox is clear — everything is routed or ported.</p>
            )}
            {inboxByBucket.map(([bucket, cards]) => (
              <div key={bucket}>
                <p className="text-[11px] uppercase tracking-wider text-amber-500/90 font-medium px-1 py-1">
                  {bucket} <span className="text-muted-foreground">({cards.length})</span>
                </p>
                <div className="rounded border border-border/60 bg-card/40 divide-y divide-border/40">
                  {cards.map((c) => (
                    <div key={c.id} className="px-2.5 py-1.5 flex items-center gap-2">
                      <span className="text-sm text-foreground truncate flex-1">{c.name}</span>
                      {c.due && <span className="text-[11px] text-muted-foreground shrink-0">{c.due.slice(0, 10)}</span>}
                      <a href={c.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Open in Trello">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        {/* ── SMART tasks by stage — compact rows, no scrum ── */}
        <div className="space-y-3">
          {PERSISTABLE_SMART_BUCKETS.map((stage) => {
            const rows = rowsByStage.get(stage) ?? [];
            const open = openSections[stage] ?? false;
            return (
              <Collapsible key={stage} open={open} onOpenChange={() => toggle(stage)}
                className="rounded-lg border border-border bg-card/40">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/30 rounded-lg text-left">
                    <span className={`font-display text-lg tracking-wide-custom ${STAGE_ACCENT[stage]}`}>
                      {STAGE_LABEL[stage]}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                      {rows.length}
                      <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {/* Needs SMART: venture tabs to organize the section */}
                  {stage === "Needs SMART" && rows.length > 0 && (
                    <div className="flex items-center gap-1 px-3 py-2 border-t border-border/60 overflow-x-auto">
                      {["All", ...SMART_VENTURES].map((v) => {
                        const n = v === "All" ? rows.length : rows.filter((r) => normalizeVenture(r.board_venture) === v).length;
                        if (v !== "All" && n === 0) return null;
                        return (
                          <button key={v} onClick={() => setNeedsTab(v)}
                            className={`text-xs px-2 py-1 rounded whitespace-nowrap border ${needsTab === v ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:bg-muted/40"}`}>
                            {v} <span className="opacity-60">({n})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="divide-y divide-border/40 border-t border-border/60">
                    {rows.length === 0 && (
                      <p className="text-xs text-muted-foreground py-3 text-center">Nothing here.</p>
                    )}
                    {(stage === "Needs SMART" && needsTab !== "All"
                      ? rows.filter((r) => normalizeVenture(r.board_venture) === needsTab)
                      : rows
                    ).map((row) => {
                      const venture = normalizeVenture(row.board_venture);
                      return (
                        <div key={row.id} className="px-3 py-1.5 flex items-center gap-2.5">
                          {/* venture (color dot + select) */}
                          <select
                            value={venture}
                            onChange={(e) => patchRow(row.id, { venture: e.target.value }, `Venture → ${e.target.value}`, { venture })}
                            title="Venture"
                            className="text-[10px] uppercase tracking-wide bg-transparent border-0 cursor-pointer text-muted-foreground w-[4.5rem] shrink-0"
                            style={{ appearance: "none" }}
                          >
                            {SMART_VENTURES.map((v) => <option key={v} value={v}>{v}</option>)}
                          </select>
                          <span className={`w-2 h-2 rounded-full shrink-0 -ml-1 ${VENTURE_COLORS[venture]}`} />
                          <span className="text-sm text-foreground truncate flex-1" title={row.revised_title || row.raw_input}>
                            {row.revised_title || row.raw_input}
                          </span>
                          {row.due_date && (
                            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{row.due_date}</span>
                          )}
                          {/* follow-up toggle (Active only) */}
                          {stage === "Active" && (
                            <button
                              onClick={() => patchRow(row.id, { recurring_followup: !row.recurring_followup },
                                row.recurring_followup ? "Follow-up stopped" : "Following up until done",
                                { recurring_followup: row.recurring_followup })}
                              className={`shrink-0 ${row.recurring_followup ? "text-indigo-400" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                              title={row.recurring_followup ? "Stop follow-up" : "Follow up until done"}
                            >
                              <Repeat className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* send to review (Needs SMART only) */}
                          {stage === "Needs SMART" && (
                            <button
                              onClick={() => sendToReview(row.revised_title || row.raw_input, row.id)}
                              className="text-sky-400/70 hover:text-sky-300 shrink-0"
                              title="Add context → Review"
                            >
                              <MessageSquarePlus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* stage select */}
                          <select
                            value={stage}
                            onChange={(e) => patchRow(row.id, { bucket: e.target.value }, `Moved to ${e.target.value}`, { bucket: stage })}
                            className="text-[11px] bg-card border border-border rounded px-1 py-0.5 cursor-pointer text-muted-foreground shrink-0"
                            title="Move stage"
                          >
                            {PERSISTABLE_SMART_BUCKETS.map((b) => <option key={b} value={b}>{b}</option>)}
                          </select>
                          {(row.google_calendar_html_link || row.trello_card_url) && (
                            <a href={row.google_calendar_html_link || row.trello_card_url || "#"} target="_blank" rel="noreferrer"
                              className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Open source">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
    </div>
  );
}
