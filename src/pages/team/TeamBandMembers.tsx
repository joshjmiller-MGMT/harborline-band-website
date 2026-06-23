import { useEffect, useMemo, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, Upload, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface BandMember {
  id: string;
  name: string;
  role: string;
  reference_image_path: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function publicUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/visual-assets/${path}`;
}

export default function TeamBandMembers({ embedded = false }: { embedded?: boolean } = {}) {
  const [members, setMembers] = useState<BandMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BandMember | "new" | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("band_members")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      toast.error("Couldn't load band members", { description: error.message });
      setLoading(false);
      return;
    }
    setMembers((data ?? []) as BandMember[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const activeWithImage = useMemo(
    () => members.filter((m) => m.active && m.reference_image_path).length,
    [members],
  );

  const content = (
    <>
      {!embedded && (
        <Helmet>
          <title>Band Members · Team</title>
        </Helmet>
      )}
      <div className="container mx-auto px-6 py-8 max-w-5xl">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display tracking-wide-custom text-2xl flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" /> Band Members
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Roster used by the visual-asset tagger to identify people by name.
              Each active member needs a reference image — the tagger matches
              faces in uploads against these references and writes the matching
              name into <code className="text-xs bg-muted px-1 rounded">people_names</code>.
              Separate from Brand Studio People (creative collaborators).
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {activeWithImage} of {members.length} active with reference images
            </p>
          </div>
          <Button onClick={() => setEditing("new")}>
            <Plus className="w-4 h-4 mr-1.5" /> Add member
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading…
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
            No band members yet. Add one to enable face recognition in the tagger.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => (
              <MemberCard key={m.id} member={m} onClick={() => setEditing(m)} />
            ))}
          </div>
        )}

        {editing && (
          <MemberDialog
            member={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              load();
            }}
            onDeleted={() => {
              setEditing(null);
              load();
            }}
          />
        )}
      </div>
    </>
  );

  if (embedded) return content;
  return <TeamLayout>{content}</TeamLayout>;
}

function MemberCard({ member, onClick }: { member: BandMember; onClick: () => void }) {
  const hasImage = !!member.reference_image_path;
  return (
    <button
      onClick={onClick}
      className="text-left rounded-lg border border-border bg-card hover:border-primary/40 transition-colors p-3 flex items-center gap-3"
    >
      <div className="w-14 h-14 rounded-full overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center text-xs text-muted-foreground">
        {hasImage ? (
          <img
            src={publicUrl(member.reference_image_path!)}
            alt={member.name}
            className="w-full h-full object-cover"
          />
        ) : (
          "no img"
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-foreground truncate">{member.name}</h3>
          {!member.active && (
            <Badge variant="outline" className="text-[10px]">inactive</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{member.role}</p>
        {!hasImage && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
            Missing reference image — not used by tagger
          </p>
        )}
      </div>
    </button>
  );
}

function MemberDialog({
  member,
  onClose,
  onSaved,
  onDeleted,
}: {
  member: BandMember | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(member?.name ?? "");
  const [role, setRole] = useState(member?.role ?? "");
  const [active, setActive] = useState(member?.active ?? true);
  const [referencePath, setReferencePath] = useState<string | null>(
    member?.reference_image_path ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Reference must be an image file");
      return;
    }
    setUploading(true);
    const ext = file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() || "jpg";
    const stamp = Date.now();
    // Path is keyed by member id so re-uploads overwrite cleanly; for brand-new
    // members (no id yet), use a temp stamp and the save step rewrites the row.
    const baseId = member?.id ?? `pending-${stamp}`;
    const path = `reference-faces/${baseId}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("visual-assets")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });
    setUploading(false);
    if (upErr) {
      toast.error("Upload failed", { description: upErr.message });
      return;
    }
    // Bust any stale prior reference for the SAME id (different extension) so we
    // don't leak orphans.
    if (member?.reference_image_path && member.reference_image_path !== path) {
      await supabase.storage.from("visual-assets").remove([member.reference_image_path]);
    }
    setReferencePath(path);
    toast.success("Reference image uploaded");
  }

  async function save() {
    if (!name.trim() || !role.trim()) {
      toast.error("Name and role are required");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      role: role.trim(),
      active,
      reference_image_path: referencePath,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = member
      ? await supabase
          .from("band_members")
          .update(payload)
          .eq("id", member.id)
          .select("*")
          .single()
      : await supabase.from("band_members").insert(payload).select("*").single();
    setSaving(false);
    if (error) {
      toast.error("Couldn't save", { description: error.message });
      return;
    }
    // If this was a new row + the image was uploaded under a `pending-` id,
    // rename the storage object to use the real row id so future re-uploads
    // overwrite the same key.
    if (!member && data && referencePath?.includes("pending-")) {
      const newPath = referencePath.replace(/pending-\d+/, data.id);
      const { error: mvErr } = await supabase.storage
        .from("visual-assets")
        .move(referencePath, newPath);
      if (!mvErr) {
        await supabase
          .from("band_members")
          .update({ reference_image_path: newPath })
          .eq("id", data.id);
      }
    }
    toast.success(member ? "Saved" : "Added");
    onSaved();
  }

  async function remove() {
    if (!member) return;
    if (!confirm(`Remove ${member.name} from the roster?`)) return;
    if (member.reference_image_path) {
      await supabase.storage.from("visual-assets").remove([member.reference_image_path]);
    }
    const { error } = await supabase.from("band_members").delete().eq("id", member.id);
    if (error) {
      toast.error("Delete failed", { description: error.message });
      return;
    }
    toast.success("Removed");
    onDeleted();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{member ? "Edit member" : "Add band member"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="bm-name">Name</Label>
            <Input
              id="bm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Josh Miller"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Exact spelling — this is what the tagger writes into{" "}
              <code className="bg-muted px-1 rounded">people_names</code>.
            </p>
          </div>
          <div>
            <Label htmlFor="bm-role">Role</Label>
            <Input
              id="bm-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. keys / bandleader, vocals, drums"
            />
          </div>
          <div>
            <Label>Reference image</Label>
            <div className="mt-2 flex items-center gap-3">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex items-center justify-center text-[10px] text-muted-foreground border border-border flex-shrink-0">
                {referencePath ? (
                  <img
                    src={publicUrl(referencePath)}
                    alt={name || "reference"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  "no img"
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  id="bm-upload"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  disabled={uploading}
                >
                  <label htmlFor="bm-upload" className="cursor-pointer">
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-1.5" />
                        {referencePath ? "Replace" : "Upload"}
                      </>
                    )}
                  </label>
                </Button>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  A clear, well-lit face shot works best. One image per member.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <div>
              <Label htmlFor="bm-active" className="cursor-pointer">Active</Label>
              <p className="text-[11px] text-muted-foreground">
                Inactive members are skipped by the tagger.
              </p>
            </div>
            <Switch id="bm-active" checked={active} onCheckedChange={setActive} />
          </div>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          {member && (
            <Button variant="ghost" size="sm" onClick={remove} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" /> Remove
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {member ? "Save" : "Add"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
