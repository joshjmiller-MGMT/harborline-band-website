import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MicButton } from "@/components/dictation/MicButton";
import { appendDictation } from "@/hooks/useDictation";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Venture taxonomy — kept local so this admin feature is self-contained.
type Venture = "harborline" | "economy" | "jmj" | "personal" | "bse";

const VENTURE_OPTIONS: { value: Venture; label: string }[] = [
  { value: "harborline", label: "Harborline" },
  { value: "economy", label: "Economy" },
  { value: "jmj", label: "JMJ" },
  { value: "personal", label: "Personal" },
  { value: "bse", label: "BSE" },
];

interface BrandDecision {
  id: string;
  ventures: Venture[];
  title: string;
  decision: string;
  rationale: string | null;
  decided_at: string;
  decided_by: string | null;
  related_assets: string[] | null;
  superseded_by: string | null;
  created_at: string;
}

/**
 * Decision log — moved here from Brand Studio (2026-06-21). Internal governance
 * record of brand/business decisions across ventures, backed by `brand_decisions`.
 */
export function DecisionLog() {
  const [decisions, setDecisions] = useState<BrandDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [ventureFilter, setVentureFilter] = useState<"all" | Venture>("all");
  const [showSuperseded, setShowSuperseded] = useState(false);
  const [editing, setEditing] = useState<BrandDecision | "new" | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("brand_decisions")
      .select("*")
      .order("decided_at", { ascending: false });
    if (error) {
      toast({ title: "Couldn't load decisions", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setDecisions((data ?? []) as BrandDecision[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return decisions.filter((d) => {
      if (!showSuperseded && d.superseded_by) return false;
      if (ventureFilter !== "all" && !d.ventures.includes(ventureFilter)) return false;
      return true;
    });
  }, [decisions, ventureFilter, showSuperseded]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select value={ventureFilter} onValueChange={(v) => setVentureFilter(v as "all" | Venture)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Venture" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ventures</SelectItem>
            {VENTURE_OPTIONS.map((v) => (
              <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showSuperseded}
            onChange={(e) => setShowSuperseded(e.target.checked)}
            className="rounded border-border"
          />
          Show superseded
        </label>
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {decisions.length}
        </span>
        <Button onClick={() => setEditing("new")} className="ml-auto">
          <Plus className="w-4 h-4 mr-1.5" /> Log decision
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
          {decisions.length === 0 ? "No decisions logged yet." : "No decisions match these filters."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <DecisionCard key={d.id} decision={d} onClick={() => setEditing(d)} />
          ))}
        </div>
      )}

      {editing && (
        <DecisionDialog
          decision={editing === "new" ? null : editing}
          allDecisions={decisions}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          onDeleted={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function DecisionCard({ decision, onClick }: { decision: BrandDecision; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="block w-full text-left rounded-lg border border-border bg-card hover:border-primary/40 transition-colors p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-medium text-foreground">{decision.title}</h3>
        <span className="text-xs text-muted-foreground shrink-0">{decision.decided_at}</span>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{decision.decision}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {decision.ventures.map((v) => (
          <Badge key={v} variant="secondary" className="text-[10px] uppercase">{v}</Badge>
        ))}
        {decision.decided_by && (
          <Badge variant="outline" className="text-[10px]">by {decision.decided_by}</Badge>
        )}
        {decision.superseded_by && (
          <Badge variant="outline" className="text-[10px] text-muted-foreground ml-auto">superseded</Badge>
        )}
      </div>
    </button>
  );
}

function DecisionDialog({
  decision,
  allDecisions,
  onClose,
  onSaved,
  onDeleted,
}: {
  decision: BrandDecision | null;
  allDecisions: BrandDecision[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(decision?.title ?? "");
  const [ventures, setVentures] = useState<Venture[]>(decision?.ventures ?? []);
  const [decisionText, setDecisionText] = useState(decision?.decision ?? "");
  const [rationale, setRationale] = useState(decision?.rationale ?? "");
  const [decidedAt, setDecidedAt] = useState(decision?.decided_at ?? new Date().toISOString().slice(0, 10));
  const [decidedBy, setDecidedBy] = useState(decision?.decided_by ?? "josh");
  const [supersededBy, setSupersededBy] = useState<string>(decision?.superseded_by ?? "none");
  const [saving, setSaving] = useState(false);

  function toggleVenture(v: Venture) {
    setVentures((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  async function save() {
    if (!title.trim() || !decisionText.trim()) {
      toast({ title: "Title and decision are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      ventures,
      decision: decisionText.trim(),
      rationale: rationale.trim() || null,
      decided_at: decidedAt,
      decided_by: decidedBy.trim() || null,
      superseded_by: supersededBy === "none" ? null : supersededBy,
    };
    const { error } = decision
      ? await supabase.from("brand_decisions").update(payload).eq("id", decision.id)
      : await supabase.from("brand_decisions").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: decision ? "Saved" : "Logged" });
    onSaved();
  }

  async function remove() {
    if (!decision) return;
    if (!confirm(`Delete this decision? Prefer "supersede" over delete to preserve history.`)) return;
    const { error } = await supabase.from("brand_decisions").delete().eq("id", decision.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    onDeleted();
  }

  const supersedeOptions = allDecisions.filter((d) => d.id !== decision?.id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide-custom">
            {decision ? "Edit decision" : "Log decision"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="d-title">Title</Label>
            <Input id="d-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="One-line summary" />
          </div>

          <div>
            <Label>Ventures</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {VENTURE_OPTIONS.map((v) => {
                const on = ventures.includes(v.value);
                return (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => toggleVenture(v.value)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      on
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="d-decision">Decision</Label>
              <MicButton onText={(t) => setDecisionText((p) => appendDictation(p, t))} />
            </div>
            <Textarea
              id="d-decision"
              value={decisionText}
              onChange={(e) => setDecisionText(e.target.value)}
              rows={2}
              placeholder="What was chosen."
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="d-rationale">Rationale (the why)</Label>
              <MicButton onText={(t) => setRationale((p) => appendDictation(p, t))} />
            </div>
            <Textarea
              id="d-rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
              placeholder="Why this choice. Future-you and Adam will read this."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="d-when">Decided on</Label>
              <Input id="d-when" type="date" value={decidedAt} onChange={(e) => setDecidedAt(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="d-by">Decided by</Label>
              <Input id="d-by" value={decidedBy} onChange={(e) => setDecidedBy(e.target.value)} placeholder="josh, team, adam-rec…" />
            </div>
          </div>

          {decision && supersedeOptions.length > 0 && (
            <div>
              <Label htmlFor="d-supersede">Superseded by</Label>
              <Select value={supersededBy} onValueChange={setSupersededBy}>
                <SelectTrigger id="d-supersede"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— still active —</SelectItem>
                  {supersedeOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {decision && (
              <Button variant="ghost" size="sm" onClick={remove} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {decision ? "Save" : "Log"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
