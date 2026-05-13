import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ListChecks, Check, X, ExternalLink } from "lucide-react";
import {
  CONFIDENCE_TONE,
  KIND_COLOR,
  type InstrumentClassification,
  type InstrumentKind,
} from "@/lib/instrument-hours";

// Surfaces the medium/low-confidence rows from the scan so Josh can Apply / Skip
// / Edit-classification. Same UX pattern as P21's visual-asset review queue.
// "Apply" promotes to review_status='reviewed' with current values; "Skip" sets
// classified_as='none' + reviewed; editing the kind/hours updates the row.

export default function HoursReviewQueueWidget() {
  const [rows, setRows] = useState<InstrumentClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKind, setEditKind] = useState<InstrumentKind>("gig");
  const [editHours, setEditHours] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("instrument_event_classifications")
      .select("*")
      .eq("review_status", "needs-review")
      .order("event_start", { ascending: false });
    setRows((data as InstrumentClassification[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("hours_review_queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instrument_event_classifications" },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const apply = async (r: InstrumentClassification, override?: { kind?: InstrumentKind; hours?: number }) => {
    const patch: Record<string, unknown> = {
      review_status: "reviewed",
      reviewed_at: new Date().toISOString(),
    };
    if (override?.kind) patch.classified_as = override.kind;
    if (override?.hours !== undefined && Number.isFinite(override.hours)) patch.estimated_hours = override.hours;
    const { error } = await supabase
      .from("instrument_event_classifications")
      .update(patch)
      .eq("id", r.id);
    if (error) {
      toast({ title: "Couldn't apply", description: error.message, variant: "destructive" });
      return;
    }
    setEditingId(null);
    toast({ title: "Marked reviewed", description: r.event_title });
  };

  const skip = async (r: InstrumentClassification) => {
    const { error } = await supabase
      .from("instrument_event_classifications")
      .update({
        classified_as: "none",
        estimated_hours: 0,
        review_status: "reviewed",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    if (error) {
      toast({ title: "Couldn't skip", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Skipped — won't count toward hours" });
  };

  const startEdit = (r: InstrumentClassification) => {
    setEditingId(r.id);
    setEditKind(r.classified_as === "gig" || r.classified_as === "rehearsal" || r.classified_as === "practice" ? r.classified_as : "gig");
    setEditHours(String(r.estimated_hours));
  };

  const saveEdit = (r: InstrumentClassification) => {
    apply(r, { kind: editKind, hours: parseFloat(editHours) || 0 });
  };

  const total = rows.length;
  const sum = useMemo(() => rows.reduce((a, r) => a + Number(r.estimated_hours || 0), 0), [rows]);

  if (!loading && total === 0) {
    return null; // hide entirely when queue is clean
  }

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-amber-500" />
          Hours review queue
          <Badge variant="outline" className="ml-1 text-xs border-amber-500/40">
            {total} events · {sum.toFixed(1)}hr pending
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {rows.map((r) => {
            const isEditing = editingId === r.id;
            const kindColor =
              r.classified_as === "gig" || r.classified_as === "rehearsal" || r.classified_as === "practice"
                ? KIND_COLOR[r.classified_as]
                : KIND_COLOR.gig;
            const confTone = CONFIDENCE_TONE[r.confidence];
            const dateLabel = new Date(r.event_start).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            return (
              <div key={r.id} className={`rounded border ${kindColor.border} bg-card p-2 space-y-2`}>
                <div className="flex items-start gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-medium truncate">{r.event_title}</span>
                      <span className="text-muted-foreground">{dateLabel}</span>
                      <Badge variant="outline" className={`text-[10px] ${kindColor.text} ${kindColor.border}`}>
                        {r.classified_as}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${confTone.text}`}>
                        {r.confidence}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      block {Number(r.block_hours).toFixed(1)}hr · est {Number(r.estimated_hours).toFixed(1)}hr · {r.estimation_source}
                    </div>
                  </div>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Select value={editKind} onValueChange={(v) => setEditKind(v as InstrumentKind)}>
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gig" className="text-xs">Gig</SelectItem>
                        <SelectItem value="rehearsal" className="text-xs">Rehearsal</SelectItem>
                        <SelectItem value="practice" className="text-xs">Practice</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      value={editHours}
                      onChange={(e) => setEditHours(e.target.value)}
                      className="h-7 w-20 text-xs"
                      placeholder="hours"
                    />
                    <span className="text-[10px] text-muted-foreground mr-1">hrs</span>
                    <Button size="sm" onClick={() => saveEdit(r)} className="h-7 gap-1 text-xs">
                      <Check className="w-3 h-3" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 text-xs">
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Button size="sm" onClick={() => apply(r)} className="h-7 gap-1 text-xs">
                      <Check className="w-3 h-3" /> Apply
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => startEdit(r)} className="h-7 text-xs">
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => skip(r)} className="h-7 gap-1 text-xs text-muted-foreground">
                      <X className="w-3 h-3" /> Skip
                    </Button>
                    {r.gcal_account_email && (
                      <a
                        href={`https://calendar.google.com/calendar/u/0/r/eventedit/${encodeURIComponent(r.gcal_event_id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> open in GCal
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
