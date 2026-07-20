import { useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, ChevronRight, BookOpen, Loader2 } from "lucide-react";

// Self-study conservatory (Josh 2026-07-20): "spec out an actual full grad
// school curriculum I'd find at Manhattan School of Music... I want to self
// study to greatness and seek out mentorship." Two MM programs; content rows
// authored by the research agent into curriculum_items.

type Week = { week: number; topic: string; materials?: string };
type Reading = { title: string; author?: string; note?: string };
type Variant = { school: string; note: string };
type CourseRow = {
  id: string;
  program: "jazz-piano-performance" | "jazz-composition";
  semester: number;
  course_code: string;
  title: string;
  credits: number | null;
  description: string | null;
  weeks: Week[];
  readings: Reading[];
  variants: Variant[];
  mentorship_note: string | null;
  sort: number;
};

const PROGRAMS = [
  { key: "jazz-piano-performance", label: "MM · Jazz Piano Performance" },
  { key: "jazz-composition", label: "MM · Jazz Composition" },
] as const;

export default function TeamCurriculum() {
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<CourseRow["program"]>("jazz-piano-performance");
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase
      .from("curriculum_items")
      .select("*")
      .order("semester")
      .order("sort")
      .then(({ data }) => {
        setRows((data as CourseRow[]) || []);
        setLoading(false);
      });
  }, []);

  const bySemester = useMemo(() => {
    const m = new Map<number, CourseRow[]>();
    for (const r of rows.filter((r) => r.program === program)) {
      (m.get(r.semester) ?? m.set(r.semester, []).get(r.semester)!).push(r);
    }
    return m;
  }, [rows, program]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12">
        <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
          <GraduationCap className="w-7 h-7 text-primary" /> Conservatory
        </h1>
        <p className="text-muted-foreground mt-2 mb-6">
          The MM you'd get at Manhattan School of Music — rebuilt for self-study.
          Weekly topics, the actual books, and where a mentor plugs in.
        </p>

        <div className="flex gap-2 mb-8">
          {PROGRAMS.map((p) => (
            <Button
              key={p.key}
              variant={program === p.key ? "default" : "outline"}
              onClick={() => setProgram(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            Curriculum is being authored — the research agent is writing the full
            program now. Refresh in a bit.
          </CardContent></Card>
        ) : (
          [1, 2, 3, 4].map((sem) => {
            const courses = bySemester.get(sem) || [];
            if (!courses.length) return null;
            return (
              <div key={sem} className="mb-8">
                <h2 className="font-display text-xl text-foreground mb-3">
                  Semester {sem}
                  <span className="text-sm text-muted-foreground ml-2">
                    {courses.reduce((a, c) => a + (c.credits || 0), 0)} credits
                  </span>
                </h2>
                <div className="space-y-2">
                  {courses.map((c) => {
                    const isOpen = open.has(c.id);
                    return (
                      <Card key={c.id} className="border-border">
                        <CardContent className="p-4">
                          <button type="button" onClick={() => toggle(c.id)} className="w-full text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                              <Badge variant="outline" className="font-mono text-xs">{c.course_code}</Badge>
                              <span className="font-medium text-foreground">{c.title}</span>
                              {c.credits != null && <span className="text-xs text-muted-foreground">{c.credits} cr</span>}
                            </div>
                            {!isOpen && c.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2 pl-6">{c.description}</p>
                            )}
                          </button>
                          {isOpen && (
                            <div className="mt-3 pl-6 space-y-4">
                              {c.description && <p className="text-sm text-foreground/90">{c.description}</p>}
                              {c.weeks?.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Week by week</h4>
                                  <div className="rounded border border-border divide-y divide-border/60">
                                    {c.weeks.map((w) => (
                                      <div key={w.week} className="px-3 py-1.5 text-sm flex gap-3">
                                        <span className="font-mono text-xs text-muted-foreground w-8 shrink-0 pt-0.5">W{w.week}</span>
                                        <div className="min-w-0">
                                          <span className="text-foreground">{w.topic}</span>
                                          {w.materials && <span className="block text-xs text-muted-foreground">{w.materials}</span>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {c.readings?.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> Reading & materials</h4>
                                  <ul className="text-sm space-y-1">
                                    {c.readings.map((r, i) => (
                                      <li key={i}>
                                        <span className="text-foreground">{r.title}</span>
                                        {r.author && <span className="text-muted-foreground"> — {r.author}</span>}
                                        {r.note && <span className="block text-xs text-muted-foreground pl-3">{r.note}</span>}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {c.variants?.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">How the other schools teach it</h4>
                                  <ul className="text-sm space-y-1">
                                    {c.variants.map((v, i) => (
                                      <li key={i}>
                                        <Badge variant="outline" className="text-[10px] mr-1.5">{v.school}</Badge>
                                        <span className="text-muted-foreground">{v.note}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {c.mentorship_note && (
                                <p className="text-sm text-primary/90 border-l-2 border-primary/40 pl-3">🎓 Mentorship: {c.mentorship_note}</p>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </TeamLayout>
  );
}
