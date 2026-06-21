import { useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MicButton } from "@/components/dictation/MicButton";
import { appendDictation } from "@/hooks/useDictation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import {
  Plus,
  Search,
  Trash2,
  Loader2,
  X,
  Users,
  Disc3,
  CalendarRange,
  FileBadge,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Venture = "harborline" | "economy" | "jmj" | "personal" | "bse";
type Skill = "novice" | "intermediate" | "pro";
type EngagementStatus = "active" | "occasional" | "paused" | "past";

const VENTURE_OPTIONS: { value: Venture; label: string }[] = [
  { value: "harborline", label: "Harborline" },
  { value: "economy", label: "Economy" },
  { value: "jmj", label: "JMJ" },
  { value: "personal", label: "Personal" },
  { value: "bse", label: "BSE" },
];

const SKILL_OPTIONS: { value: Skill; label: string }[] = [
  { value: "novice", label: "Novice" },
  { value: "intermediate", label: "Intermediate" },
  { value: "pro", label: "Pro" },
];

const STATUS_OPTIONS: { value: EngagementStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "occasional", label: "Occasional" },
  { value: "paused", label: "Paused" },
  { value: "past", label: "Past" },
];

interface Collaborator {
  id: string;
  name: string;
  ventures: Venture[];
  roles: string[];
  skill_level: Skill | null;
  engagement_status: EngagementStatus;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  found_via: string | null;
  rate_note: string | null;
  created_at: string;
  updated_at: string;
}

export default function TeamBrandStudio() {
  return (
    <TeamLayout>
      <Helmet>
        <title>Brand Studio · Harborline Team</title>
      </Helmet>
      <div className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl tracking-wide-custom text-foreground">
            Brand Studio
          </h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
            One layer for managing brand &amp; media work across ventures —
            people, releases, EPKs, metrics. Internal tooling, not a
            client-facing service.
          </p>
        </div>

        <Tabs defaultValue="people">
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="people" className="gap-1.5">
              <Users className="w-3.5 h-3.5" /> People
            </TabsTrigger>
            <TabsTrigger value="catalog" className="gap-1.5">
              <Disc3 className="w-3.5 h-3.5" /> Catalog
            </TabsTrigger>
            <TabsTrigger value="releases" className="gap-1.5">
              <CalendarRange className="w-3.5 h-3.5" /> Releases
            </TabsTrigger>
            <TabsTrigger value="epk" className="gap-1.5">
              <FileBadge className="w-3.5 h-3.5" /> EPK
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> Metrics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="people"><PeopleTab /></TabsContent>
          <TabsContent value="catalog">
            <PlaceholderTab
              title="Catalog / Songs"
              phase="2"
              body="Per-song record with writers, producers, performers (linked to People), publishing + master splits, ISRC, release status. EPK builder pulls from here."
            />
          </TabsContent>
          <TabsContent value="releases">
            <PlaceholderTab
              title="Releases / Campaigns"
              phase="2"
              body="Timeline of singles, albums, performance videos, social campaigns per venture. Status pipeline: planning → in production → ready → released."
            />
          </TabsContent>
          <TabsContent value="epk">
            <PlaceholderTab
              title="EPK / Press Kit Builder"
              phase="2"
              body="Generate a shareable per-venture press kit: bio + photos (from Visual Assets, filtered by venture + rights) + reel links + booking contact. Linktree-shaped output."
            />
          </TabsContent>
          <TabsContent value="metrics">
            <PlaceholderTab
              title="Content &amp; Performance Metrics"
              phase="3"
              body="Venture-aware: Economy + JMJ get streaming + Chartmetric panels; Harborline gets bookings + IG + Bandsintown. Manual paste first, automated ingestion later."
            />
          </TabsContent>
        </Tabs>
      </div>
    </TeamLayout>
  );
}

function PlaceholderTab({
  title,
  phase,
  body,
}: {
  title: string;
  phase: string;
  body: string;
}) {
  return (
    <Card className="p-8 border-dashed">
      <div className="max-w-xl">
        <Badge variant="outline" className="mb-3">Phase {phase}</Badge>
        <h2 className="font-display text-xl tracking-wide-custom mb-2">
          {title}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
      </div>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// People tab
// -----------------------------------------------------------------------------

function PeopleTab() {
  const [people, setPeople] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ventureFilter, setVentureFilter] = useState<"all" | Venture>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | EngagementStatus>("all");
  const [editing, setEditing] = useState<Collaborator | "new" | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("brand_collaborators")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      toast({ title: "Couldn't load people", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setPeople((data ?? []) as Collaborator[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => {
      if (ventureFilter !== "all" && !p.ventures.includes(ventureFilter)) return false;
      if (statusFilter !== "all" && p.engagement_status !== statusFilter) return false;
      if (q) {
        const hay = [p.name, ...p.roles, p.notes ?? "", p.found_via ?? ""].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [people, search, ventureFilter, statusFilter]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, role, notes…"
            className="pl-9"
          />
        </div>
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
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | EngagementStatus)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {people.length}
        </span>
        <Button onClick={() => setEditing("new")} className="ml-auto">
          <Plus className="w-4 h-4 mr-1.5" /> Add person
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
          {people.length === 0 ? "No people yet. Add one." : "No people match these filters."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <PersonCard key={p.id} person={p} onClick={() => setEditing(p)} />
          ))}
        </div>
      )}

      {editing && (
        <PersonDialog
          person={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          onDeleted={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function PersonCard({ person, onClick }: { person: Collaborator; onClick: () => void }) {
  const statusVariant =
    person.engagement_status === "active" ? "default" :
    person.engagement_status === "occasional" ? "secondary" :
    "outline";
  return (
    <button
      onClick={onClick}
      className="text-left rounded-lg border border-border bg-card hover:border-primary/40 transition-colors p-4"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="font-medium text-foreground">{person.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {person.roles.length > 0 ? person.roles.join(" · ") : "—"}
          </p>
        </div>
        <Badge variant={statusVariant} className="text-[10px] capitalize shrink-0">
          {person.engagement_status}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-1 mt-3">
        {person.ventures.map((v) => (
          <Badge key={v} variant="secondary" className="text-[10px] uppercase">
            {v}
          </Badge>
        ))}
        {person.skill_level && (
          <Badge variant="outline" className="text-[10px] capitalize ml-auto">
            {person.skill_level}
          </Badge>
        )}
      </div>
      {person.notes && (
        <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{person.notes}</p>
      )}
    </button>
  );
}

function PersonDialog({
  person,
  onClose,
  onSaved,
  onDeleted,
}: {
  person: Collaborator | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(person?.name ?? "");
  const [ventures, setVentures] = useState<Venture[]>(person?.ventures ?? []);
  const [roles, setRoles] = useState<string[]>(person?.roles ?? []);
  const [roleInput, setRoleInput] = useState("");
  const [skillLevel, setSkillLevel] = useState<Skill | "none">(person?.skill_level ?? "none");
  const [engagementStatus, setEngagementStatus] = useState<EngagementStatus>(
    person?.engagement_status ?? "active"
  );
  const [contactEmail, setContactEmail] = useState(person?.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(person?.contact_phone ?? "");
  const [foundVia, setFoundVia] = useState(person?.found_via ?? "");
  const [rateNote, setRateNote] = useState(person?.rate_note ?? "");
  const [notes, setNotes] = useState(person?.notes ?? "");
  const [saving, setSaving] = useState(false);

  function toggleVenture(v: Venture) {
    setVentures((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  function addRole(t: string) {
    const clean = t.trim();
    if (!clean || roles.includes(clean)) return;
    setRoles([...roles, clean]);
    setRoleInput("");
  }

  async function save() {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      ventures,
      roles,
      skill_level: skillLevel === "none" ? null : skillLevel,
      engagement_status: engagementStatus,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      found_via: foundVia.trim() || null,
      rate_note: rateNote.trim() || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = person
      ? await supabase.from("brand_collaborators").update(payload).eq("id", person.id)
      : await supabase.from("brand_collaborators").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: person ? "Saved" : "Added" });
    onSaved();
  }

  async function remove() {
    if (!person) return;
    if (!confirm(`Delete ${person.name}? They'll be removed from People; release records that reference them keep their ID as a soft reference.`)) return;
    const { error } = await supabase.from("brand_collaborators").delete().eq("id", person.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    onDeleted();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide-custom">
            {person ? person.name : "Add person"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
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
            <Label>Roles</Label>
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
              {roles.length === 0 && (
                <span className="text-xs text-muted-foreground">e.g. graphic design, videographer, social media manager</span>
              )}
              {roles.map((r) => (
                <Badge key={r} variant="secondary" className="gap-1 pr-1">
                  {r}
                  <button
                    type="button"
                    onClick={() => setRoles(roles.filter((x) => x !== r))}
                    className="hover:bg-muted rounded p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRole(roleInput);
                  }
                }}
                placeholder="Add role and hit enter"
              />
              <Button type="button" variant="outline" onClick={() => addRole(roleInput)}>Add</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="skill">Skill level</Label>
              <Select value={skillLevel} onValueChange={(v) => setSkillLevel(v as Skill | "none")}>
                <SelectTrigger id="skill"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— not set —</SelectItem>
                  {SKILL_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Engagement</Label>
              <Select value={engagementStatus} onValueChange={(v) => setEngagementStatus(v as EngagementStatus)}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="email">Contact email</Label>
              <Input id="email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">Contact phone</Label>
              <Input id="phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="found_via">Found via</Label>
              <Input
                id="found_via"
                value={foundVia}
                onChange={(e) => setFoundVia(e.target.value)}
                placeholder="Soundbetter, referral from X…"
              />
            </div>
            <div>
              <Label htmlFor="rate_note">Rate note</Label>
              <Input
                id="rate_note"
                value={rateNote}
                onChange={(e) => setRateNote(e.target.value)}
                placeholder="$X/hr, per-project, negotiated…"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="notes">Notes</Label>
              <MicButton onText={(t) => setNotes((p) => appendDictation(p, t))} />
            </div>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything you want future-you (or Adam) to know."
            />
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {person && (
              <Button variant="ghost" size="sm" onClick={remove} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {person ? "Save" : "Add"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
