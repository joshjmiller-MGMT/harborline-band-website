import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import TeamLayout from "@/components/TeamLayout";
import { Users, RefreshCw, Search, Mail, Phone, ExternalLink, Flag, Plus, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Contacts — the /team mirror of the JJMM Contact Spreadsheet's network tab
// (gid=554277039 — Josh's active contact-dump tab, re-affirmed 2026-07-21).
// TWO-WAY: "Sync sheet" pulls new sheet rows in and pushes un-synced board
// contacts out (append-only; jjmm-contacts-sync edge fn, hourly cron too).
// Layout mirrors the sheet's columns: Name / Phone / Email / Notes.

const JJMM_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1ljSJ-58WqTJP0zK9RiNAtsEG3BYW-L0Mpb1PgGi7b4g/edit?gid=554277039#gid=554277039";

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
  email: "Email", manual: "Manual", "fan-signup": "Fan",
};

const EMPTY_DRAFT = { name: "", phone: "", email: "", org: "", notes: "" };

export default function TeamContacts() {
  const [rows, setRows] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // ?q= deep-link support (the Fans page links each signup to its contact row)
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [onlyFollowup, setOnlyFollowup] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

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

  const addContact = useCallback(async () => {
    const name = draft.name.trim();
    if (!name) { toast.error("Name is required"); return; }
    setSaving(true);
    const { error } = await supabase.from("contacts").insert({
      name,
      phone: draft.phone.trim() || null,
      email: draft.email.trim() || null,
      org: draft.org.trim() || null,
      notes: draft.notes.trim() || null,
      source: "manual",
      sheet_synced: false, // next sync pushes it to the JJMM sheet
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${name} added — will push to the JJMM sheet on next sync`);
    setDraft(EMPTY_DRAFT);
    void load();
  }, [draft, load]);

  const syncSheet = useCallback(async () => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("jjmm-contacts-sync", { body: {} });
    setSyncing(false);
    if (error) {
      // supabase-js stashes the Response on error.context for non-2xx
      let detail = error.message;
      try {
        const body = await (error as { context?: Response }).context?.json();
        detail = body?.message || body?.detail || body?.error || detail;
      } catch { /* keep generic message */ }
      toast.error(`Sync failed: ${detail}`);
      return;
    }
    toast.success(
      `Synced "${data.tab}": ${data.pulled} pulled in, ${data.pushed} pushed to sheet, ${data.matched} matched${data.filled ? `, ${data.filled} enriched` : ""}`,
      { duration: 8000 },
    );
    void load();
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
  const syncedCount = useMemo(() => rows.filter((r) => r.sheet_synced).length, [rows]);

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
              <Users className="w-7 h-7 text-primary" /> Contacts
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {rows.length} contacts · {followupCount} flagged follow-up · {syncedCount} on the JJMM sheet
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href={JJMM_SHEET_URL} target="_blank" rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              JJMM sheet <ExternalLink className="w-3 h-3" />
            </a>
            <Button variant="outline" size="sm" onClick={() => void syncSheet()} disabled={syncing}>
              <ArrowLeftRight className={`w-4 h-4 mr-1.5 ${syncing ? "animate-pulse" : ""}`} />
              {syncing ? "Syncing…" : "Sync sheet"}
            </Button>
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
          <button
            onClick={() => setShowAdd((s) => !s)}
            className={`text-xs px-2.5 py-1.5 rounded border inline-flex items-center gap-1.5 ${showAdd ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40"}`}
          >
            <Plus className="w-3 h-3" /> Add contact
          </button>
        </div>

        {showAdd && (
          <div className="mb-4 rounded-lg border border-border bg-card/40 p-3 grid grid-cols-2 md:grid-cols-6 gap-2">
            <Input className="h-9 md:col-span-2" placeholder="Name *" value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            <Input className="h-9" placeholder="Phone" value={draft.phone}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
            <Input className="h-9" placeholder="Email" value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
            <Input className="h-9" placeholder="Org / context" value={draft.org}
              onChange={(e) => setDraft((d) => ({ ...d, org: e.target.value }))} />
            <div className="flex gap-2">
              <Input className="h-9 flex-1" placeholder="Notes" value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") void addContact(); }} />
              <Button size="sm" className="h-9" onClick={() => void addContact()} disabled={saving}>Add</Button>
            </div>
          </div>
        )}

        {/* Sheet-mirroring layout: Name / Phone / Email / Org·Role / Notes */}
        <div className="rounded-lg border border-border bg-card/40">
          <div className="hidden md:grid grid-cols-[28px_minmax(140px,1.2fr)_minmax(110px,0.9fr)_minmax(140px,1.1fr)_minmax(100px,0.9fr)_minmax(140px,1.4fr)_70px] gap-2 px-3 py-1.5 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
            <span /><span>Name</span><span>Phone</span><span>Email</span><span>Org · Role</span><span>Notes</span><span className="text-right">Source</span>
          </div>
          <div className="divide-y divide-border/50">
            {visible.map((c) => (
              <div key={c.id} className="px-3 py-2 grid grid-cols-[28px_1fr_70px] md:grid-cols-[28px_minmax(140px,1.2fr)_minmax(110px,0.9fr)_minmax(140px,1.1fr)_minmax(100px,0.9fr)_minmax(140px,1.4fr)_70px] gap-2 items-center">
                <button
                  onClick={() => toggleFollowup(c.id, !c.followup)}
                  className={`shrink-0 ${c.followup ? "text-amber-400" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                  title={c.followup ? "Clear follow-up flag" : "Flag for follow-up"}
                >
                  <Flag className="w-4 h-4" />
                </button>
                <div className="min-w-0 flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.sheet_synced ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                    title={c.sheet_synced ? "On the JJMM sheet" : "Not yet on the JJMM sheet — next sync pushes it"}
                  />
                  <p className="text-sm text-foreground truncate">{c.name}</p>
                </div>
                <p className="hidden md:block text-xs text-muted-foreground truncate">
                  {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-foreground"><Phone className="w-3 h-3" />{c.phone}</a>}
                </p>
                <p className="hidden md:block text-xs text-muted-foreground truncate">
                  {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-foreground"><Mail className="w-3 h-3" />{c.email}</a>}
                </p>
                <p className="hidden md:block text-xs text-muted-foreground truncate">
                  {[c.org, c.role].filter(Boolean).join(" · ")}
                </p>
                <p className="hidden md:block text-[11px] text-muted-foreground truncate" title={c.followup_note || c.notes || undefined}>
                  {c.followup_note || c.notes}
                </p>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground text-center shrink-0 justify-self-end">
                  {SOURCE_LABEL[c.source] ?? c.source}
                </span>
              </div>
            ))}
            {!loading && visible.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No contacts match.</p>
            )}
          </div>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Two-way sync is live: sheet rows pull in, board adds push out (append-only — the sheet is the network source). Hourly auto-sync + the button above. Next: pull-in from email/text history, auto email/text blasts.
        </p>
      </div>
    </TeamLayout>
  );
}
