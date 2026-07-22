import { useCallback, useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Inbox, RefreshCw, Phone, Mail, CalendarClock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Lead = {
  id: string;
  source: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  venture: string | null;
  event_type: string | null;
  event_date: string | null;
  venue: string | null;
  budget: string | null;
  genres: string | null;
  status: string;
  notes: string | null;
  first_seen: string | null;
};

const STATUSES = ["new", "contacted", "quoted", "booked", "lost", "nurture"];
const STATUS_STYLE: Record<string, string> = {
  new: "bg-primary/15 text-primary",
  contacted: "bg-amber-500/15 text-amber-400",
  quoted: "bg-accent/15 text-accent",
  booked: "bg-emerald-500/15 text-emerald-400",
  lost: "bg-rose-500/15 text-rose-400",
  nurture: "bg-muted/60 text-muted-foreground",
};
const SOURCE_LABEL: Record<string, string> = {
  "harborline-gmail": "Harborline", "bse-gmail": "BSE email", djep: "DJEP",
  referral: "Referral", "knowledge-capture": "Captured", web: "Web", other: "Other",
};
const VENTURE_DOT: Record<string, string> = {
  Harborline: "bg-primary", Economy: "bg-accent", JMJ: "bg-amber-500",
  BSE: "bg-rose-500", Personal: "bg-emerald-500",
};

export default function TeamLeads() {
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("id, source, name, email, phone, venture, event_type, event_date, venue, budget, genres, status, notes, first_seen")
      .order("event_date", { ascending: true, nullsFirst: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Lead[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setStatus = useCallback(async (id: string, status: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase.from("leads").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Failed to save"); void load(); }
  }, [load]);

  const filtered = useMemo(
    () => (statusFilter ? rows.filter((r) => r.status === statusFilter) : rows),
    [rows, statusFilter],
  );
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r.status] = (m[r.status] ?? 0) + 1;
    return m;
  }, [rows]);

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
              <Inbox className="w-7 h-7 text-primary" /> Leads
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {rows.length} leads · {counts.new ?? 0} new · booking inquiries across all sources
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <button onClick={() => setStatusFilter("")} className={`text-xs px-2 py-1 rounded border ${statusFilter === "" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
            All ({rows.length})
          </button>
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)}
              className={`text-xs px-2 py-1 rounded border ${statusFilter === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
              {s} ({counts[s] ?? 0})
            </button>
          ))}
        </div>

        {/* List view (was a 2-col card grid — Josh via Webb, 2026-07-15) */}
        <div className="rounded-lg border border-border bg-card/40 divide-y divide-border">
          {filtered.map((l) => (
            <div key={l.id} className="px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{l.name || "(unnamed lead)"}</span>
                  {l.venture && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className={`w-2 h-2 rounded-full ${VENTURE_DOT[l.venture] ?? "bg-muted-foreground"}`} />{l.venture}
                    </span>
                  )}
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">{SOURCE_LABEL[l.source] ?? l.source}</span>
                  {l.event_type && <span className="text-[12px] text-foreground/90">· {l.event_type}</span>}
                </div>
                <select
                  value={l.status}
                  onChange={(e) => setStatus(l.id, e.target.value)}
                  className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border-0 shrink-0 cursor-pointer ${STATUS_STYLE[l.status] ?? ""}`}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                {l.event_date && <span className="inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" />{l.event_date}</span>}
                {l.venue && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{l.venue}</span>}
                {l.email && <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 hover:text-foreground"><Mail className="w-3 h-3" />{l.email}</a>}
                {l.phone && <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="w-3 h-3" />{l.phone}</a>}
                {l.genres && <span>· {l.genres}</span>}
                {l.notes && <span className="basis-full text-muted-foreground/80">{l.notes}</span>}
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No leads match.</p>
          )}
        </div>
      </div>
    </TeamLayout>
  );
}
