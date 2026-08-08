import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MicButton } from "@/components/dictation/MicButton";
import { appendDictation } from "@/hooks/useDictation";
import { toast } from "@/hooks/use-toast";
import { HelpCircle, Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

// The practice fill-in grid, on the site instead of a markdown file (Josh 8/07).
// Every question here is something the taxonomy genuinely can't answer — nothing
// already settled is asked again. Answers land in practice_open_questions and
// get picked up next session.

type Row = {
  id: string;
  grid: string;
  grid_label: string;
  ref: string;
  question: string;
  context: string | null;
  answer: string | null;
  answered_at: string | null;
  sort_order: number;
};

const db = supabase as unknown as { from: (t: string) => any };

export default function PracticeQuestionsWidget() {
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [openGrids, setOpenGrids] = useState<Record<string, boolean>>({});
  const [showAnswered, setShowAnswered] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await db
      .from("practice_open_questions")
      .select("*")
      .order("sort_order", { ascending: true });
    const list = (data ?? []) as Row[];
    setRows(list);
    setDrafts(Object.fromEntries(list.map((r) => [r.id, r.answer ?? ""])));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    const visible = showAnswered ? rows : rows.filter((r) => !r.answered_at);
    const by = new Map<string, { label: string; items: Row[] }>();
    for (const r of visible) {
      if (!by.has(r.grid)) by.set(r.grid, { label: r.grid_label, items: [] });
      by.get(r.grid)!.items.push(r);
    }
    return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, showAnswered]);

  const answered = rows.filter((r) => r.answered_at).length;

  const save = async (row: Row) => {
    const value = (drafts[row.id] ?? "").trim();
    setSaving(row.id);
    const { error } = await db
      .from("practice_open_questions")
      .update({ answer: value === "" ? null : value })
      .eq("id", row.id);
    setSaving(null);
    if (error) {
      toast({ title: "Didn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: value ? `${row.ref} answered` : `${row.ref} cleared` });
    load();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="h-5 w-5 text-amber-500" />
            Practice — fill in the gaps
            <Badge variant="secondary" className="font-normal">
              {answered}/{rows.length} answered
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowAnswered((s) => !s)}>
            {showAnswered ? "Hide answered" : "Show answered"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Everything the practice tool still can't work out on its own. One line each is plenty, and
          you can talk them out with the mic. Nothing you've already settled is asked again.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {groups.map(([grid, { label, items }]) => {
          const open = openGrids[grid] ?? true;
          return (
            <div key={grid} className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setOpenGrids((g) => ({ ...g, [grid]: !open }))}
                className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/40 transition"
              >
                {open ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium text-sm">{label}</span>
                <Badge variant="outline" className="ml-auto font-normal">
                  {items.length}
                </Badge>
              </button>

              {open && (
                <div className="divide-y divide-border border-t border-border">
                  {items.map((r) => {
                    const dirty = (drafts[r.id] ?? "") !== (r.answer ?? "");
                    return (
                      <div key={r.id} className="p-4 space-y-2">
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="mt-0.5 shrink-0 font-mono text-[10px]">
                            {r.ref}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{r.question}</p>
                            {r.context && (
                              <p className="mt-1 text-xs text-muted-foreground">{r.context}</p>
                            )}
                          </div>
                          {r.answered_at && (
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          )}
                        </div>

                        <div className="flex items-start gap-2">
                          <Textarea
                            value={drafts[r.id] ?? ""}
                            onChange={(e) =>
                              setDrafts((d) => ({ ...d, [r.id]: e.target.value }))
                            }
                            placeholder="Type or dictate…"
                            className="min-h-[60px] text-sm"
                          />
                          <div className="flex flex-col gap-2">
                            <MicButton
                              onText={(chunk) =>
                                setDrafts((d) => ({
                                  ...d,
                                  [r.id]: appendDictation(d[r.id] ?? "", chunk),
                                }))
                              }
                            />
                            <Button
                              size="sm"
                              variant={dirty ? "default" : "outline"}
                              disabled={!dirty || saving === r.id}
                              onClick={() => save(r)}
                            >
                              {saving === r.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {!groups.length && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            All answered. Nothing left for me to ask.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
