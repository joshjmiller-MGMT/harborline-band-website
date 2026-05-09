import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Save, RotateCcw, Loader2, CheckCircle2, Clock, Target, AlertTriangle, Calendar } from "lucide-react";

type SmartShape = {
  revised_title: string;
  definition_of_done: string;
  measure: string;
  blockers: string;
  effort: string;
  due_date: string | null;
};

export default function SmartTaskWidget() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [smart, setSmart] = useState<SmartShape | null>(null);
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);

  async function rewrite() {
    if (!input.trim()) return;
    setWorking(true);
    setSmart(null);
    try {
      const { data, error } = await supabase.functions.invoke("smart-task-rewrite", {
        body: { input: input.trim() },
      });
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

  async function save() {
    if (!smart) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("smart_task_enrichments").insert({
        raw_input: input.trim(),
        revised_title: smart.revised_title,
        definition_of_done: smart.definition_of_done,
        measure: smart.measure,
        blockers: smart.blockers,
        effort: smart.effort,
        due_date: smart.due_date,
      });
      if (error) throw error;
      toast({ title: "Saved", description: "Task stored in smart_task_enrichments." });
      setInput("");
      setSmart(null);
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

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg tracking-wide-custom flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Make a Task SMART
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Fix the website, follow up with Pendry, finalize the NJ setlist…"
            className="min-h-[80px] resize-y"
            disabled={working || saving}
          />
          <p className="text-xs text-muted-foreground mt-1">
            One task at a time. Claude rewrites it into a SMART version. You confirm before save.
          </p>
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
