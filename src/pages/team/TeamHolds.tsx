import { useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Plus, Check, MessageCircle, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Sales Holds (Josh 2026-07-20): the sales-rep ↔ Josh ↔ musician hold loop.
// Chase the rep on a cadence; keep the player informed proactively.

type Hold = {
  id: string;
  event_date: string | null;
  event_label: string | null;
  sales_rep: string | null;
  agency: string | null;
  role: string | null;
  musician: string | null;
  musician_status: string;
  hold_status: string;
  followup_cadence: string;
  last_checked_at: string | null;
  next_check_at: string | null;
  last_told_musician_at: string | null;
  notes: string | null;
};

const CADENCE_DAYS: Record<string, number> = { "every-3-days": 3, weekly: 7, biweekly: 14, monthly: 30 };
const HOLD_STYLE: Record<string, string> = {
  open: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  confirmed: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  lost: "bg-destructive/15 text-destructive border-destructive/30",
  released: "bg-muted text-muted-foreground border-border",
};
const MUS_STATUS = ["available", "held", "confirmed", "released", "declined"];
const HOLD_STATUS = ["open", "confirmed", "lost", "released"];

function due(next: string | null): boolean {
  return !!next && new Date(next).getTime() <= Date.now();
}
function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleDateString([], { month: "short", day: "numeric" }) : "—";
}

export default function TeamHolds() {
  const [rows, setRows] = useState<Hold[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Partial<Hold>>({ agency: "BSE", followup_cadence: "weekly", musician_status: "available", hold_status: "open" });

  const load = async () => {
    const { data } = await supabase.from("sales_holds").select("*").order("event_date", { ascending: true, nullsFirst: false });
    setRows((data as Hold[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const patch = async (id: string, p: Partial<Hold>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
    await supabase.from("sales_holds").update({ ...p, updated_at: new Date().toISOString() }).eq("id", id);
  };

  const markChecked = (h: Hold) => {
    const days = CADENCE_DAYS[h.followup_cadence] ?? 7;
    patch(h.id, { last_checked_at: new Date().toISOString(), next_check_at: new Date(Date.now() + days * 86400000).toISOString() });
    toast({ title: `Checked with ${h.sales_rep || "rep"}`, description: `Next check in ${days}d` });
  };
  const markTold = (h: Hold) => {
    patch(h.id, { last_told_musician_at: new Date().toISOString() });
    toast({ title: `${h.musician || "Player"} updated`, description: "Logged the outreach" });
  };

  const addHold = async () => {
    if (!draft.musician && !draft.role) return toast({ title: "Add at least a role or musician", variant: "destructive" });
    const days = CADENCE_DAYS[draft.followup_cadence || "weekly"] ?? 7;
    const { error } = await supabase.from("sales_holds").insert({ ...draft, next_check_at: new Date(Date.now() + days * 86400000).toISOString() });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setAdding(false);
    setDraft({ agency: "BSE", followup_cadence: "weekly", musician_status: "available", hold_status: "open" });
    load();
  };

  const dueCount = useMemo(() => rows.filter((r) => r.hold_status === "open" && due(r.next_check_at)).length, [rows]);
  const active = rows.filter((r) => r.hold_status === "open");
  const closed = rows.filter((r) => r.hold_status !== "open");

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
              <CalendarClock className="w-7 h-7 text-primary" /> Sales Holds
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Rep floats a date → you hold a player → chase the rep, keep the player informed.
              {dueCount > 0 && <span className="text-yellow-600 font-medium"> · {dueCount} due for a check-in</span>}
            </p>
          </div>
          <Button onClick={() => setAdding(!adding)} className="gap-1.5"><Plus className="w-4 h-4" /> New hold</Button>
        </div>

        {adding && (
          <Card className="mb-4 border-primary/30">
            <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              <Input type="date" value={draft.event_date || ""} onChange={(e) => setDraft({ ...draft, event_date: e.target.value })} />
              <Input placeholder="Event (venue/label)" value={draft.event_label || ""} onChange={(e) => setDraft({ ...draft, event_label: e.target.value })} />
              <Input placeholder="Sales rep" value={draft.sales_rep || ""} onChange={(e) => setDraft({ ...draft, sales_rep: e.target.value })} />
              <Input placeholder="Agency" value={draft.agency || ""} onChange={(e) => setDraft({ ...draft, agency: e.target.value })} />
              <Input placeholder="Role (trumpet)" value={draft.role || ""} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
              <Input placeholder="Musician" value={draft.musician || ""} onChange={(e) => setDraft({ ...draft, musician: e.target.value })} />
              <Select value={draft.followup_cadence} onValueChange={(v) => setDraft({ ...draft, followup_cadence: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.keys(CADENCE_DAYS).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={addHold} className="gap-1"><Check className="w-4 h-4" /> Add</Button>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No holds yet. Add one when a rep floats a date.</CardContent></Card>
        ) : (
          <>
            <div className="space-y-2">
              {active.map((h) => (
                <Card key={h.id} className={`border-border ${due(h.next_check_at) ? "border-l-2 border-l-yellow-500" : ""}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {due(h.next_check_at) && <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />}
                      <span className="font-medium text-foreground">{h.role || "role"}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-foreground">{h.musician || "(no player)"}</span>
                      <Badge variant="outline" className="text-[10px]">{h.musician_status}</Badge>
                      <span className="text-muted-foreground text-sm">for {h.event_date || "?"} {h.event_label ? `(${h.event_label})` : ""}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{h.agency} · {h.sales_rep}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                      <span>check {h.followup_cadence}</span>
                      <span>· last checked {fmt(h.last_checked_at)}</span>
                      <span className={due(h.next_check_at) ? "text-yellow-600 font-medium" : ""}>· next {fmt(h.next_check_at)}</span>
                      <span>· told {h.musician?.split(" ")[0] || "player"} {fmt(h.last_told_musician_at)}</span>
                    </div>
                    {h.notes && <p className="text-xs text-muted-foreground mt-1">{h.notes}</p>}
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => markChecked(h)}>
                        <Check className="w-3 h-3" /> Checked with {h.sales_rep || "rep"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => markTold(h)}>
                        <MessageCircle className="w-3 h-3" /> Told {h.musician?.split(" ")[0] || "player"}
                      </Button>
                      <Select value={h.hold_status} onValueChange={(v) => patch(h.id, { hold_status: v })}>
                        <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{HOLD_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={h.musician_status} onValueChange={(v) => patch(h.id, { musician_status: v })}>
                        <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{MUS_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {closed.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Closed ({closed.length})</h3>
                <div className="space-y-1">
                  {closed.map((h) => (
                    <div key={h.id} className="text-sm px-2 py-1 flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${HOLD_STYLE[h.hold_status]}`}>{h.hold_status}</Badge>
                      <span className="text-foreground">{h.role} · {h.musician}</span>
                      <span className="text-muted-foreground text-xs">{h.event_date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </TeamLayout>
  );
}
