import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TeamLayout from "@/components/TeamLayout";
import { Users, RefreshCw, Search, Plus, Music, Clapperboard, Star, X, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// People — the unified roster (Josh 7/24: "everything should be connected —
// team members, roster, players, contacts"). One row per human Josh works
// with, holding one or more CAPACITIES (player / crew / managed-artist),
// linked to their contacts row. Seeded from Brand Studio (crew) + band_members
// (players) + the editors roster. See people-management eval in the brain.

type Person = {
  id: string;
  name: string;
  capacities: string[];
  instruments: string[];
  roles: string[];
  ventures: string[];
  tier: number | null;
  skill_level: string | null;
  engagement_status: string;
  contact_id: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  instagram_handle: string | null;
  bio_short: string | null;
  rate_note: string | null;
  found_via: string | null;
  notes: string | null;
  active: boolean;
};

const CAPACITIES = ["player", "crew", "managed-artist"] as const;
const VENTURES = ["harborline", "economy", "jmj", "personal", "bse"] as const;
const ENGAGEMENTS = ["active", "occasional", "paused", "past"] as const;
const SKILLS = ["novice", "intermediate", "pro"] as const;

const CAP_META: Record<string, { label: string; cls: string; icon: typeof Music }> = {
  player: { label: "Player", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: Music },
  crew: { label: "Crew", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30", icon: Clapperboard },
  "managed-artist": { label: "Managed artist", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Star },
};

const csv = (arr: string[]) => arr.join(", ");
const parseCsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const EMPTY: Partial<Person> = { name: "", capacities: [], instruments: [], roles: [], ventures: [], engagement_status: "active" };

export default function TeamPeople() {
  const [rows, setRows] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [capFilter, setCapFilter] = useState<string>("all");
  const [ventureFilter, setVentureFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<Person> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as unknown as { from: (t: string) => any })
      .from("people")
      .select("*")
      .order("name", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Person[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    let v = rows;
    if (capFilter === "both") v = v.filter((r) => r.capacities.length > 1);
    else if (capFilter !== "all") v = v.filter((r) => r.capacities.includes(capFilter));
    if (ventureFilter !== "all") v = v.filter((r) => r.ventures.includes(ventureFilter));
    const s = q.trim().toLowerCase();
    if (s) v = v.filter((r) => [r.name, ...r.instruments, ...r.roles, r.notes ?? ""].join(" ").toLowerCase().includes(s));
    return v;
  }, [rows, capFilter, ventureFilter, q]);

  const counts = useMemo(() => ({
    all: rows.length,
    player: rows.filter((r) => r.capacities.includes("player")).length,
    crew: rows.filter((r) => r.capacities.includes("crew")).length,
    both: rows.filter((r) => r.capacities.length > 1).length,
  }), [rows]);

  const toggle = (field: "capacities" | "ventures", val: string) => {
    setEditing((e) => {
      if (!e) return e;
      const cur = (e[field] as string[]) ?? [];
      return { ...e, [field]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] };
    });
  };

  const save = useCallback(async () => {
    if (!editing?.name?.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const payload = {
      name: editing.name.trim(),
      capacities: editing.capacities ?? [],
      instruments: editing.instruments ?? [],
      roles: editing.roles ?? [],
      ventures: editing.ventures ?? [],
      skill_level: editing.skill_level || null,
      engagement_status: editing.engagement_status || "active",
      contact_email: editing.contact_email || null,
      contact_phone: editing.contact_phone || null,
      instagram_handle: editing.instagram_handle || null,
      bio_short: editing.bio_short || null,
      rate_note: editing.rate_note || null,
      notes: editing.notes || null,
      updated_at: new Date().toISOString(),
    };
    const db = supabase as unknown as { from: (t: string) => any };
    const res = editing.id
      ? await db.from("people").update(payload).eq("id", editing.id)
      : await db.from("people").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editing.id ? "Saved" : "Added");
    setEditing(null);
    void load();
  }, [editing, load]);

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground flex items-center gap-3">
              <Users className="w-7 h-7 text-primary" /> People
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {counts.all} people · {counts.player} players · {counts.crew} crew · {counts.both} both — everyone you work with, in one roster, linked to Contacts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setEditing({ ...EMPTY })}><Plus className="w-4 h-4 mr-1.5" /> Add person</Button>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, instrument, role, notes…" className="pl-8 h-9" />
          </div>
          {([["all", `All (${counts.all})`], ["player", `Players (${counts.player})`], ["crew", `Crew (${counts.crew})`], ["both", `Both (${counts.both})`]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setCapFilter(v)}
              className={`text-xs px-2.5 py-1.5 rounded border ${capFilter === v ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
              {label}
            </button>
          ))}
          <select value={ventureFilter} onChange={(e) => setVentureFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs">
            <option value="all">All ventures</option>
            {VENTURES.map((vn) => <option key={vn} value={vn}>{vn}</option>)}
          </select>
        </div>

        <div className="rounded-lg border border-border bg-card/40 divide-y divide-border/50">
          {visible.map((p) => (
            <button key={p.id} onClick={() => setEditing({ ...p })} className="w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-muted/20">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-foreground font-medium">{p.name}</span>
                  {p.capacities.map((c) => {
                    const m = CAP_META[c]; if (!m) return null; const I = m.icon;
                    return <span key={c} className={`text-[10px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${m.cls}`}><I className="w-2.5 h-2.5" />{m.label}</span>;
                  })}
                  {p.engagement_status !== "active" && <Badge variant="outline" className="text-[10px] text-muted-foreground">{p.engagement_status}</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {[...(p.instruments ?? []), ...(p.roles ?? [])].join(" · ")}
                  {p.ventures?.length ? `  —  ${p.ventures.join(", ")}` : ""}
                </p>
                {p.notes && <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{p.notes}</p>}
              </div>
              {p.contact_id && (
                <Link to={`/team/contacts?q=${encodeURIComponent(p.name)}`} onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5" title="Open in Contacts">
                  <ExternalLink className="w-4 h-4" />
                </Link>
              )}
            </button>
          ))}
          {!loading && visible.length === 0 && <p className="px-3 py-10 text-center text-sm text-muted-foreground">No people match.</p>}
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Players carry instruments; crew carry roles; some are both (tag both capacities). Each person links to their Contacts entry. Face-tags for media still live in band_members.
        </p>
      </div>

      {/* Add / edit */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {editing && (
            <>
              <DialogHeader><DialogTitle>{editing.id ? "Edit person" : "Add person"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Name *</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-9 mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Capacity</Label>
                  <div className="flex gap-1.5 mt-1">
                    {CAPACITIES.map((c) => (
                      <button key={c} type="button" onClick={() => toggle("capacities", c)}
                        className={`text-xs px-2.5 py-1.5 rounded border ${(editing.capacities ?? []).includes(c) ? CAP_META[c].cls : "border-border text-muted-foreground hover:bg-muted/40"}`}>
                        {CAP_META[c].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Instruments (players)</Label>
                    <Input value={csv(editing.instruments ?? [])} onChange={(e) => setEditing({ ...editing, instruments: parseCsv(e.target.value) })} placeholder="keys, bass, drums" className="h-9 mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Roles (crew)</Label>
                    <Input value={csv(editing.roles ?? [])} onChange={(e) => setEditing({ ...editing, roles: parseCsv(e.target.value) })} placeholder="video, audio, design" className="h-9 mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Ventures</Label>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {VENTURES.map((vn) => (
                      <button key={vn} type="button" onClick={() => toggle("ventures", vn)}
                        className={`text-xs px-2.5 py-1.5 rounded border ${(editing.ventures ?? []).includes(vn) ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40"}`}>
                        {vn}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Engagement</Label>
                    <select value={editing.engagement_status ?? "active"} onChange={(e) => setEditing({ ...editing, engagement_status: e.target.value })} className="h-9 mt-1 w-full rounded-md border border-input bg-background px-2 text-sm">
                      {ENGAGEMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Skill</Label>
                    <select value={editing.skill_level ?? ""} onChange={(e) => setEditing({ ...editing, skill_level: e.target.value || null })} className="h-9 mt-1 w-full rounded-md border border-input bg-background px-2 text-sm">
                      <option value="">—</option>
                      {SKILLS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Email</Label><Input value={editing.contact_email ?? ""} onChange={(e) => setEditing({ ...editing, contact_email: e.target.value })} className="h-9 mt-1" /></div>
                  <div><Label className="text-xs">Phone</Label><Input value={editing.contact_phone ?? ""} onChange={(e) => setEditing({ ...editing, contact_phone: e.target.value })} className="h-9 mt-1" /></div>
                </div>
                <div>
                  <Label className="text-xs">Rate note</Label>
                  <Input value={editing.rate_note ?? ""} onChange={(e) => setEditing({ ...editing, rate_note: e.target.value })} className="h-9 mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} className="mt-1" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setEditing(null)}><X className="w-4 h-4 mr-1" /> Cancel</Button>
                <Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Save</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </TeamLayout>
  );
}
