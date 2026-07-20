import { useCallback, useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Users, RefreshCw, Search, Mail, Phone, ExternalLink, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Contacts — the /team mirror of the JJMM Contact Spreadsheet ("Contact List" tab
// = the official central hub). Seeded from the Trello Contacts + POC-F/U buckets
// (2026-07-07); POC-F/U people carry the follow-up flag and surface in the
// dashboard Follow-ups alert. Future: auto email/text blasts from here.

const JJMM_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1ljSJ-58WqTJP0zK9RiNAtsEG3BYW-L0Mpb1PgGi7b4g/edit?gid=2099086399#gid=2099086399";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  org: string | null;
  venture: string | null;
  followup: boolean;
  followup_note: string | null;
  source: string;
  notes: string | null;
  sheet_synced: boolean;
};

const SOURCE_LABEL: Record<string, string> = {
  "trello-contacts": "Trello", "trello-poc-fu": "POC F/U", "jjmm-sheet": "JJMM sheet",
  email: "Email", manual: "Manual",
};

export default function TeamContacts() {
  const [rows, setRows] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [onlyFollowup, setOnlyFollowup] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contacts")
      .select("id, name, email, phone, role, org, venture, followup, followup_note, source, notes, sheet_synced")
      // task-not-contact rows are board items, not people (audit 7/19)
      .not("tags", "cs", "{task-not-contact}")
      .order("followup", { ascending: false })
      .order("name", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Contact[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleFollowup = useCallback(async (id: string, followup: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, followup } : r)));
    const { error } = await supabase.from("contacts").update({ followup, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error("Failed to save"); void load(); }
  }, [load]);

  const visible = useMemo(() => {
    let v = rows;
    if (onlyFollowup) v = v.filter((r) => r.followup);
    const s = q.trim().toLowerCase();
    if (s) v = v.filter((r) =>
      [r.name, r.email, r.phone, r.org, r.role, r.notes].some((f) => f?.toLowerCase().includes(s)));
    return v;
  }, [rows, q, onlyFollowup]);

  const followupCount = useMemo(() => rows.filter((r) => r.followup).length, [rows]);

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
              <Users className="w-7 h-7 text-primary" /> Contacts
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {rows.length} contacts · {followupCount} flagged follow-up · mirror of the JJMM Contact Spreadsheet
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href={JJMM_SHEET_URL} target="_blank" rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              JJMM sheet <ExternalLink className="w-3 h-3" />
            </a>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, org…" className="pl-8 h-9" />
          </div>
          <button
            onClick={() => setOnlyFollowup((s) => !s)}
            className={`text-xs px-2.5 py-1.5 rounded border inline-flex items-center gap-1.5 ${onlyFollowup ? "border-amber-500/50 bg-amber-500/10 text-amber-400" : "border-border text-muted-foreground hover:bg-muted/40"}`}
          >
            <Flag className="w-3 h-3" /> Follow-ups ({followupCount})
          </button>
        </div>

        <div className="rounded-lg border border-border bg-card/40 divide-y divide-border/50">
          {visible.map((c) => (
            <div key={c.id} className="px-3 py-2 flex items-center gap-3">
              <button
                onClick={() => toggleFollowup(c.id, !c.followup)}
                className={`shrink-0 ${c.followup ? "text-amber-400" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                title={c.followup ? "Clear follow-up flag" : "Flag for follow-up"}
              >
                <Flag className="w-4 h-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate">{c.name}</p>
                <p className="text-[11px] text-muted-foreground truncate flex items-center gap-2">
                  {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-0.5 hover:text-foreground"><Mail className="w-3 h-3" />{c.email}</a>}
                  {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-0.5 hover:text-foreground"><Phone className="w-3 h-3" />{c.phone}</a>}
                  {c.org && <span>{c.org}</span>}
                  {c.role && <span>· {c.role}</span>}
                  {c.notes && !c.email && !c.phone && !c.org && <span className="truncate">{c.notes}</span>}
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground shrink-0">
                {SOURCE_LABEL[c.source] ?? c.source}
              </span>
            </div>
          ))}
          {!loading && visible.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No contacts match.</p>
          )}
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Next: sheet-sync (push new contacts to the JJMM "Contact List" tab), pull-in from email/text history, and auto email/text blasts.
        </p>
      </div>
    </TeamLayout>
  );
}
