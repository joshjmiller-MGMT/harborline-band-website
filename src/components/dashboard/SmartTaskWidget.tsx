import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Save, RotateCcw, Loader2, CheckCircle2, Clock, Target, AlertTriangle, Calendar,
  Trello, RefreshCw, ExternalLink, Inbox,
} from "lucide-react";

type SmartShape = {
  revised_title: string;
  definition_of_done: string;
  measure: string;
  blockers: string;
  effort: string;
  due_date: string | null;
};

type TrelloLabelLite = { name: string; color: string | null };
type TrelloChecklistOpen = { name: string; items: string[] };
type TrelloCommentLite = { text: string; date: string };
type TrelloCustomFieldLite = { name: string; value: string };

type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  url: string;
  list_id: string;
  list_name?: string | null;
  labels?: TrelloLabelLite[];
  checklists_open?: TrelloChecklistOpen[];
  recent_comments?: TrelloCommentLite[];
  custom_fields?: TrelloCustomFieldLite[];
  date_last_activity?: string;
  age_days?: number;
};

type CardContext = {
  list: string | null;
  labels: string[];
  checklist_open: string[];
  recent_comments: string[];
  custom_fields: TrelloCustomFieldLite[];
  age_days: number;
  due: string | null;
};

function buildCardContext(card: TrelloCard): CardContext {
  const flatChecklist = (card.checklists_open || []).flatMap((cl) =>
    cl.items.map((item) => (cl.name ? `[${cl.name}] ${item}` : item)),
  );
  return {
    list: card.list_name ?? null,
    labels: (card.labels || []).map((l) => l.name),
    checklist_open: flatChecklist,
    recent_comments: (card.recent_comments || []).map((c) => c.text),
    custom_fields: card.custom_fields || [],
    age_days: card.age_days ?? 0,
    due: card.due,
  };
}

type TrelloPoll = {
  board?: { id: string; name: string };
  cards?: TrelloCard[];
  total_open?: number;
  pending_count?: number;
  error?: string;
  message?: string;
};

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export default function SmartTaskWidget() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [smart, setSmart] = useState<SmartShape | null>(null);
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);

  // Source-of-task tracking: when null, the input came from the textarea
  // (free-form). When set, the input came from a Trello card; saving will
  // SMART-ify the card and write a calendar event.
  const [activeCard, setActiveCard] = useState<TrelloCard | null>(null);

  // Trello inbox state
  const [cards, setCards] = useState<TrelloCard[]>([]);
  const [trelloLoading, setTrelloLoading] = useState(false);
  const [trelloError, setTrelloError] = useState<string | null>(null);
  const [boardName, setBoardName] = useState<string | null>(null);

  const loadTrello = useCallback(async () => {
    setTrelloLoading(true);
    setTrelloError(null);
    try {
      const { data, error } = await supabase.functions.invoke("trello-poll", {
        body: { action: "poll" },
      });
      if (error) throw error;
      const result = data as TrelloPoll;
      if (result.error) {
        setTrelloError(result.message || result.error);
        setCards([]);
        setBoardName(null);
        return;
      }
      setCards(result.cards || []);
      setBoardName(result.board?.name || null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTrelloError(msg);
      setCards([]);
    } finally {
      setTrelloLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTrello();
  }, [loadTrello]);

  function pickCard(card: TrelloCard) {
    const combined = card.desc?.trim()
      ? `${card.name}\n\n${card.desc.trim()}`
      : card.name;
    setInput(combined);
    setSmart(null);
    setActiveCard(card);
  }

  async function rewrite() {
    if (!input.trim()) return;
    setWorking(true);
    setSmart(null);
    try {
      const body: { input: string; card_context?: CardContext } = { input: input.trim() };
      if (activeCard) body.card_context = buildCardContext(activeCard);
      const { data, error } = await supabase.functions.invoke("smart-task-rewrite", { body });
      if (error) throw error;
      const result = (data as { smart?: SmartShape })?.smart;
      if (!result) throw new Error("Empty response");
      setSmart(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Couldn't rewrite", description: msg, variant: "destructive" });
    } finally {
      setWorking(false);
    }
  }

  async function createCalendarEvent(s: SmartShape): Promise<{ id: string; htmlLink: string } | null> {
    if (!s.due_date) return null;
    const description = [
      s.definition_of_done && `Definition of done: ${s.definition_of_done}`,
      s.measure && `Measure: ${s.measure}`,
      s.blockers && s.blockers !== "None" && `Blockers: ${s.blockers}`,
      s.effort && `Effort: ${s.effort}`,
      activeCard?.url && `Trello: ${activeCard.url}`,
    ]
      .filter(Boolean)
      .join("\n");

    // The shared edge fn expects ISO timestamps with allDay flag.
    const startIso = `${s.due_date}T00:00:00.000Z`;
    const endIso = `${s.due_date}T23:59:59.000Z`;

    try {
      const res = await fetch(`${FUNCTIONS_BASE}/google-calendar-events?action=create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: s.revised_title,
          description,
          start: startIso,
          end: endIso,
          allDay: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      return { id: data.event?.id, htmlLink: data.event?.htmlLink };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: "Calendar insert failed",
        description: `${msg} — task still saved.`,
        variant: "destructive",
      });
      return null;
    }
  }

  async function markCardSmartified(cardId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke("trello-poll", {
        body: { action: "mark-smartified", card_id: cardId },
      });
      if (error) throw error;
      const result = data as { labeled?: boolean; error?: string };
      if (result.error) throw new Error(result.error);
      return !!result.labeled;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: "Trello label failed",
        description: `${msg} — task still saved.`,
        variant: "destructive",
      });
      return false;
    }
  }

  async function save() {
    if (!smart) return;
    setSaving(true);
    try {
      const calendarEvent = await createCalendarEvent(smart);

      const { error } = await supabase.from("smart_task_enrichments").insert({
        raw_input: input.trim(),
        revised_title: smart.revised_title,
        definition_of_done: smart.definition_of_done,
        measure: smart.measure,
        blockers: smart.blockers,
        effort: smart.effort,
        due_date: smart.due_date,
        trello_card_id: activeCard?.id ?? null,
        trello_card_url: activeCard?.url ?? null,
        google_calendar_event_id: calendarEvent?.id ?? null,
        google_calendar_html_link: calendarEvent?.htmlLink ?? null,
      });
      if (error) throw error;

      if (activeCard) {
        await markCardSmartified(activeCard.id);
      }

      const parts = ["Saved"];
      if (calendarEvent) parts.push("calendar event created");
      if (activeCard) parts.push("Trello card labeled");
      toast({ title: parts.join(" + "), description: smart.revised_title });

      setInput("");
      setSmart(null);
      setActiveCard(null);
      if (activeCard) void loadTrello();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Couldn't save", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setSmart(null);
  }

  function clearSource() {
    setActiveCard(null);
    setInput("");
    setSmart(null);
  }

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg tracking-wide-custom flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Make a Task SMART
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <TrelloInbox
          cards={cards}
          boardName={boardName}
          loading={trelloLoading}
          error={trelloError}
          activeCardId={activeCard?.id ?? null}
          onPick={pickCard}
          onRefresh={loadTrello}
          disabled={working || saving}
        />

        <div>
          <Textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (activeCard) setActiveCard(null);
            }}
            placeholder="e.g. Fix the website, follow up with Pendry, finalize the NJ setlist…"
            className="min-h-[80px] resize-y"
            disabled={working || saving}
          />
          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="text-xs text-muted-foreground">
              Paste a task or pick one from Trello above. Claude rewrites it into SMART; you confirm before save.
            </p>
            {activeCard && (
              <Button onClick={clearSource} variant="ghost" size="sm" className="h-6 px-2 text-xs">
                Clear Trello source
              </Button>
            )}
          </div>
          {activeCard && <CardContextPreview card={activeCard} />}
        </div>

        {!smart && (
          <Button
            onClick={rewrite}
            disabled={working || !input.trim()}
            variant="hero"
            size="sm"
            className="w-full"
          >
            {working ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Rewriting…</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Make SMART</>
            )}
          </Button>
        )}

        {smart && (
          <div className="space-y-3 rounded-lg border border-border bg-background/50 p-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">REVISED TITLE</p>
              <p className="text-sm font-display tracking-wide-custom">{smart.revised_title}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
              <SmartField icon={CheckCircle2} label="Definition of done" value={smart.definition_of_done} />
              <SmartField icon={Target} label="Measure" value={smart.measure} />
              <SmartField icon={AlertTriangle} label="Blockers" value={smart.blockers} />
              <SmartField icon={Clock} label="Effort" value={smart.effort} />
              <SmartField
                icon={Calendar}
                label="Due"
                value={smart.due_date ?? "(no deadline)"}
                muted={!smart.due_date}
                full
              />
            </div>

            {smart.due_date && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                On save: all-day event on {smart.due_date} in your Google Calendar.
              </p>
            )}
            {activeCard && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Trello className="w-3 h-3" />
                On save: Trello card labeled ✅ SMART-ified (stays on board).
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={save} disabled={saving} variant="default" size="sm" className="flex-1">
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save</>
                )}
              </Button>
              <Button onClick={reset} disabled={saving} variant="ghost" size="sm">
                <RotateCcw className="w-4 h-4 mr-2" /> Redo
              </Button>
            </div>

            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              Saves to smart_task_enrichments
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrelloInbox({
  cards,
  boardName,
  loading,
  error,
  activeCardId,
  onPick,
  onRefresh,
  disabled,
}: {
  cards: TrelloCard[];
  boardName: string | null;
  loading: boolean;
  error: string | null;
  activeCardId: string | null;
  onPick: (c: TrelloCard) => void;
  onRefresh: () => void;
  disabled: boolean;
}) {
  // Hide entirely if Trello isn't configured / no board found AND no error to show.
  if (!loading && !error && cards.length === 0 && !boardName) return null;

  return (
    <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Inbox className="w-3.5 h-3.5" />
          <span>Trello inbox{boardName ? ` · ${boardName}` : ""}</span>
          {!loading && cards.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 h-4">{cards.length}</Badge>
          )}
        </div>
        <Button onClick={onRefresh} disabled={loading || disabled} variant="ghost" size="sm" className="h-6 px-2">
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {!error && !loading && cards.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Nothing pending. All cards on this board are SMART-ified.
        </p>
      )}

      {cards.length > 0 && (
        <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
          {cards.map((c) => {
            const isActive = c.id === activeCardId;
            const checklistCount = (c.checklists_open || []).reduce(
              (sum, cl) => sum + cl.items.length,
              0,
            );
            const commentCount = (c.recent_comments || []).length;
            return (
              <div
                key={c.id}
                className={`flex items-start justify-between gap-2 rounded px-2 py-1.5 text-xs transition-colors ${
                  isActive
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-muted/50 border border-transparent"
                }`}
              >
                <button
                  onClick={() => onPick(c)}
                  disabled={disabled}
                  className="flex-1 text-left disabled:opacity-50 min-w-0"
                >
                  <p className="font-medium truncate">{c.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                    {c.list_name && (
                      <span className="px-1 py-px rounded bg-muted/60 font-medium">
                        {c.list_name}
                      </span>
                    )}
                    {(c.labels || []).slice(0, 3).map((l) => (
                      <span
                        key={l.name}
                        className="px-1 py-px rounded bg-muted/40"
                      >
                        {l.name}
                      </span>
                    ))}
                    {c.due && <span>· due {c.due.slice(0, 10)}</span>}
                    {checklistCount > 0 && <span>· ☐ {checklistCount}</span>}
                    {commentCount > 0 && <span>· 💬 {commentCount}</span>}
                    {typeof c.age_days === "number" && c.age_days >= 30 && (
                      <span>· {c.age_days}d old</span>
                    )}
                  </div>
                </button>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                  title="Open in Trello"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CardContextPreview({ card }: { card: TrelloCard }) {
  const checklistItems = (card.checklists_open || []).flatMap((cl) =>
    cl.items.map((item) => (cl.name ? `${cl.name}: ${item}` : item)),
  );
  const commentTexts = (card.recent_comments || []).map((c) => c.text);
  const customFields = card.custom_fields || [];
  const hasContext =
    card.list_name ||
    (card.labels && card.labels.length > 0) ||
    checklistItems.length > 0 ||
    commentTexts.length > 0 ||
    customFields.length > 0 ||
    (typeof card.age_days === "number" && card.age_days >= 7);
  if (!hasContext) return null;

  return (
    <details className="mt-2 rounded border border-border bg-muted/30 px-2 py-1.5 text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
        Card context sent to Claude
        {card.list_name && (
          <span className="ml-1.5 px-1 py-px rounded bg-muted/60 text-[10px] font-medium">
            {card.list_name}
          </span>
        )}
        {checklistItems.length > 0 && (
          <span className="ml-1 text-[10px]">· ☐ {checklistItems.length}</span>
        )}
        {commentTexts.length > 0 && (
          <span className="ml-1 text-[10px]">· 💬 {commentTexts.length}</span>
        )}
        {customFields.length > 0 && (
          <span className="ml-1 text-[10px]">· ⚙ {customFields.length}</span>
        )}
      </summary>
      <div className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
        {card.list_name && (
          <p>
            <span className="text-foreground">Bucket:</span> {card.list_name}
          </p>
        )}
        {card.labels && card.labels.length > 0 && (
          <p>
            <span className="text-foreground">Labels:</span> {card.labels.map((l) => l.name).join(", ")}
          </p>
        )}
        {typeof card.age_days === "number" && card.age_days >= 7 && (
          <p>
            <span className="text-foreground">Age:</span> {card.age_days} days since last activity
          </p>
        )}
        {checklistItems.length > 0 && (
          <div>
            <p className="text-foreground">Open checklist:</p>
            <ul className="ml-3 list-disc">
              {checklistItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {commentTexts.length > 0 && (
          <div>
            <p className="text-foreground">Recent comments:</p>
            <ul className="ml-3 list-disc">
              {commentTexts.map((c, i) => (
                <li key={i} className="italic">"{c}"</li>
              ))}
            </ul>
          </div>
        )}
        {customFields.length > 0 && (
          <div>
            <p className="text-foreground">Custom fields:</p>
            <ul className="ml-3 list-disc">
              {customFields.map((f, i) => (
                <li key={i}>
                  <span className="text-foreground">{f.name}:</span> {f.value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function SmartField({
  icon: Icon,
  label,
  value,
  muted = false,
  full = false,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  muted?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground mb-0.5">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <p className={`text-sm ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
