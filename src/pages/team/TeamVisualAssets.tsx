import { useEffect, useMemo, useRef, useState } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { ImagePlus, Search, Sparkles, Trash2, Loader2, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Venture = "harborline" | "economy" | "jmj" | "personal" | "bse";
type Rights = "internal-only" | "client-approved" | "public-ok";

const VENTURE_OPTIONS: { value: Venture; label: string }[] = [
  { value: "harborline", label: "Harborline" },
  { value: "economy", label: "Economy" },
  { value: "jmj", label: "JMJ" },
  { value: "personal", label: "Personal" },
  { value: "bse", label: "BSE" },
];

const RIGHTS_OPTIONS: { value: Rights; label: string }[] = [
  { value: "internal-only", label: "Internal only" },
  { value: "client-approved", label: "Client-approved" },
  { value: "public-ok", label: "Public OK" },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface VisualAsset {
  id: string;
  filename: string;
  storage_path: string;
  folder: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
  tags: string[];
  ventures: Venture[];
  rights: Rights;
  shoot_date: string | null;
  ai_suggested_tags: string[];
  ai_suggested_alt: string | null;
  ai_suggested_caption: string | null;
  ai_suggested_kind: string | null;
  ai_suggested_people_roles: string[];
  ai_suggested_people_count: string | null;
  ai_suggested_venue: string | null;
  ai_suggested_instruments: string[];
  ai_suggested_location: string | null;
  ai_processed_at: string | null;
  ai_error: string | null;
  uploaded_at: string;
}

// Flatten the AI-suggested structured taxonomy into prefix-conventioned tags so the
// existing `tags` array (and the search/filter UI built on it) keeps working unchanged.
// Mirrors the backend's buildPrefixedTags in tag-visual-asset/index.ts — kept in sync
// so both auto-apply and manual Apply produce the same tag layout.
function buildAiPrefixedTags(asset: VisualAsset): string[] {
  const out: string[] = [];
  if (asset.ai_suggested_kind) out.push(`kind:${asset.ai_suggested_kind}`);
  if (asset.ai_suggested_people_count && asset.ai_suggested_people_count !== "none") {
    out.push(`count:${asset.ai_suggested_people_count}`);
  }
  for (const r of asset.ai_suggested_people_roles ?? []) out.push(`role:${r}`);
  if (asset.ai_suggested_venue) {
    const slug = asset.ai_suggested_venue
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (slug) out.push(`venue:${slug}`);
  }
  for (const i of asset.ai_suggested_instruments ?? []) out.push(`instrument:${i}`);
  if (asset.ai_suggested_location) out.push(`location:${asset.ai_suggested_location}`);
  for (const tag of asset.ai_suggested_tags ?? []) out.push(tag);
  return Array.from(new Set(out));
}

function publicUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/visual-assets/${storagePath}`;
}

// Section IDs mirror the public Gallery's section layout (Band Photos / Member
// Portraits / Venue Photos), then DB-only sections (Instagram, Shoots, Logos,
// Other) cover the rest of the library. Order here drives render order + nav order.
type SectionId =
  | "band"
  | "members"
  | "venues"
  | "instagram"
  | "shoots"
  | "logos"
  | "other";

const SECTIONS: { id: SectionId; label: string; hint: string }[] = [
  { id: "band", label: "Band Photos", hint: "Group shots, performances, candid moments" },
  { id: "members", label: "Member Portraits", hint: "Individual headshots and player portraits" },
  { id: "venues", label: "Venue Photos", hint: "Venues and locations" },
  { id: "instagram", label: "Instagram & Social", hint: "Pulled from social feeds" },
  { id: "shoots", label: "Shoots & Uploads", hint: "Recent uploads, awaiting tagging or sorting" },
  { id: "logos", label: "Logos & Branding", hint: "Most logos are code-bundled — only DB-stored logo files appear here" },
  { id: "other", label: "Other / Uncategorized", hint: "Doesn't fit a section above" },
];

// Derive a section for an asset. Priority:
//   1. ai_suggested_kind (post-P9 tags are most reliable)
//   2. Folder path (deterministic for the public-site/* tree)
//   3. Filename heuristics (member-*/portrait-* under public-site/band)
// Falls back to "other" if nothing matches.
function deriveSection(asset: VisualAsset): SectionId {
  const kind = asset.ai_suggested_kind?.toLowerCase() ?? null;
  if (kind) {
    if (kind === "headshot") return "members";
    if (kind === "venue-photo") return "venues";
    if (kind === "logo") return "logos";
    if (
      kind === "live-performance" ||
      kind === "press-shot" ||
      kind === "behind-the-scenes" ||
      kind === "rehearsal" ||
      kind === "event-photo" ||
      kind === "promo"
    )
      return "band";
    // studio / screenshot / other → fall through to folder heuristics
  }

  const folder = asset.folder ?? "";
  const filename = asset.filename?.toLowerCase() ?? "";

  if (folder.startsWith("public-site/venues")) return "venues";
  if (folder.startsWith("public-site/instagram")) return "instagram";
  if (folder.startsWith("shoots/")) return "shoots";
  if (folder === "public-site/band") {
    if (filename.startsWith("portrait-") || filename.startsWith("member-")) return "members";
    return "band";
  }
  if (folder === "public-site") {
    if (filename.startsWith("logo")) return "logos";
    return "band"; // gallery-*, band-hero, hero-band etc.
  }

  return "other";
}

function fmtBytes(b: number | null): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function slugifyFilename(name: string): string {
  // Keep extension; slug the stem.
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";
  const slug = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "asset";
  return `${slug}${ext}`;
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export default function TeamVisualAssets() {
  const [assets, setAssets] = useState<VisualAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ventureFilter, setVentureFilter] = useState<"all" | Venture>("all");
  const [rightsFilter, setRightsFilter] = useState<"all" | Rights>("all");
  const [folderInput, setFolderInput] = useState("shoots/2026-05-misc");
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [selected, setSelected] = useState<VisualAsset | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function loadAssets() {
    setLoading(true);
    const { data, error } = await supabase
      .from("visual_assets")
      .select("*")
      .order("uploaded_at", { ascending: false });
    if (error) {
      toast({ title: "Couldn't load assets", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setAssets((data ?? []) as VisualAsset[]);
    setLoading(false);
  }

  useEffect(() => {
    loadAssets();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (ventureFilter !== "all" && !a.ventures.includes(ventureFilter)) return false;
      if (rightsFilter !== "all" && a.rights !== rightsFilter) return false;
      if (q) {
        const hay = [
          a.filename,
          a.folder,
          a.alt_text ?? "",
          a.caption ?? "",
          ...a.tags,
          ...a.ai_suggested_tags,
          a.ai_suggested_kind ?? "",
          ...(a.ai_suggested_people_roles ?? []),
          a.ai_suggested_venue ?? "",
          ...(a.ai_suggested_instruments ?? []),
          a.ai_suggested_location ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [assets, search, ventureFilter, rightsFilter]);

  // Group filtered assets by section. Sections render in SECTIONS order; empty
  // sections are dropped from the page (and from the nav).
  const bySection = useMemo(() => {
    const map = new Map<SectionId, VisualAsset[]>();
    for (const s of SECTIONS) map.set(s.id, []);
    for (const a of filtered) map.get(deriveSection(a))!.push(a);
    return map;
  }, [filtered]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const folder = (folderInput || "uploads").replace(/^\/+|\/+$/g, "");
    const list = Array.from(files);
    setUploading({ done: 0, total: list.length });

    let successes = 0;
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      try {
        const safeName = slugifyFilename(file.name);
        const stamp = Date.now();
        const storagePath = `${folder}/${stamp}-${safeName}`;

        const dims = await getImageDimensions(file);

        const { error: upErr } = await supabase.storage
          .from("visual-assets")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || undefined,
          });
        if (upErr) throw new Error(`upload: ${upErr.message}`);

        const { data: row, error: insErr } = await supabase
          .from("visual_assets")
          .insert({
            filename: file.name,
            storage_path: storagePath,
            folder,
            mime_type: file.type || null,
            file_size_bytes: file.size,
            width: dims?.width ?? null,
            height: dims?.height ?? null,
          })
          .select("id")
          .single();
        if (insErr) throw new Error(`row: ${insErr.message}`);

        // Fire-and-forget vision tagging; UI will pick it up on next refresh.
        supabase.functions
          .invoke("tag-visual-asset", { body: { asset_id: row.id } })
          .then(() => loadAssets())
          .catch((e) => console.warn("tag-visual-asset failed", e));

        successes++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast({
          title: `Upload failed: ${file.name}`,
          description: msg,
          variant: "destructive",
        });
      }
      setUploading({ done: i + 1, total: list.length });
    }

    setUploading(null);
    if (successes > 0) {
      toast({
        title: `Uploaded ${successes} of ${list.length}`,
        description: "AI tagging in the background.",
      });
      loadAssets();
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <TeamLayout>
      <div className="container mx-auto px-6 py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl tracking-wide-custom text-foreground">
              Visual Assets
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              The archive. Originals here, derivatives downstream. AI tags on upload — you approve.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder="folder e.g. shoots/2026-05-..."
              className="w-64"
            />
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button onClick={() => fileInput.current?.click()} disabled={!!uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {uploading.done}/{uploading.total}
                </>
              ) : (
                <>
                  <ImagePlus className="w-4 h-4 mr-2" /> Upload
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename, tags, alt text…"
              className="pl-9"
            />
          </div>
          <Select value={ventureFilter} onValueChange={(v) => setVentureFilter(v as any)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Venture" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ventures</SelectItem>
              {VENTURE_OPTIONS.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={rightsFilter} onValueChange={(v) => setRightsFilter(v as any)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Rights" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rights</SelectItem>
              {RIGHTS_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {assets.length}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-lg">
            {assets.length === 0 ? (
              <>
                <ImagePlus className="w-8 h-8 mx-auto mb-3 opacity-50" />
                No assets yet. Upload a shoot folder to get started.
              </>
            ) : (
              "No assets match these filters."
            )}
          </div>
        ) : (
          <>
            {/* Section nav — anchor chips with counts; empty sections hidden */}
            <div className="mb-6 flex flex-wrap gap-2">
              {SECTIONS.map((s) => {
                const count = bySection.get(s.id)?.length ?? 0;
                if (count === 0) return null;
                return (
                  <a
                    key={s.id}
                    href={`#section-${s.id}`}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    <span className="font-medium">{s.label}</span>{" "}
                    <span className="text-muted-foreground">({count})</span>
                  </a>
                );
              })}
            </div>

            {/* Per-section grids */}
            <div className="space-y-10">
              {SECTIONS.map((s) => {
                const items = bySection.get(s.id) ?? [];
                if (items.length === 0) return null;
                return (
                  <section key={s.id} id={`section-${s.id}`} className="scroll-mt-20">
                    <div className="mb-3 flex items-baseline justify-between border-b border-border pb-2">
                      <div>
                        <h2 className="font-display text-xl tracking-wide-custom text-foreground">
                          {s.label}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.hint}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{items.length}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {items.map((a) => (
                        <AssetTile key={a.id} asset={a} onClick={() => setSelected(a)} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}

        {selected && (
          <AssetDetailDialog
            asset={selected}
            onClose={() => setSelected(null)}
            onSaved={(updated) => {
              setAssets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
              setSelected(updated);
            }}
            onDeleted={(id) => {
              setAssets((prev) => prev.filter((p) => p.id !== id));
              setSelected(null);
            }}
          />
        )}
      </div>
    </TeamLayout>
  );
}

function AssetTile({ asset, onClick }: { asset: VisualAsset; onClick: () => void }) {
  const url = publicUrl(asset.storage_path);
  const aiPending = !asset.ai_processed_at && !asset.ai_error;
  return (
    <button
      onClick={onClick}
      className="group block text-left rounded-lg overflow-hidden border border-border bg-card hover:border-primary/40 transition-colors"
    >
      <div className="aspect-square bg-muted overflow-hidden relative">
        <img
          src={url}
          alt={asset.alt_text ?? asset.filename}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
        />
        {aiPending && (
          <div className="absolute top-1.5 right-1.5 bg-background/80 backdrop-blur px-1.5 py-0.5 rounded text-[10px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> tagging…
          </div>
        )}
      </div>
      <div className="p-2">
        <div className="text-xs font-medium truncate" title={asset.filename}>
          {asset.filename}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {asset.ai_suggested_kind && (
            <Badge variant="default" className="text-[9px] px-1.5 py-0">
              {asset.ai_suggested_kind}
            </Badge>
          )}
          {asset.ventures.slice(0, 3).map((v) => (
            <Badge key={v} variant="secondary" className="text-[9px] px-1.5 py-0">
              {v}
            </Badge>
          ))}
          {asset.tags
            .filter((t) => !t.startsWith("kind:") && !t.startsWith("role:") && !t.startsWith("count:") && !t.startsWith("venue:") && !t.startsWith("instrument:") && !t.startsWith("location:"))
            .slice(0, 2)
            .map((t) => (
              <Badge key={t} variant="outline" className="text-[9px] px-1.5 py-0">
                {t}
              </Badge>
            ))}
        </div>
      </div>
    </button>
  );
}

function AssetDetailDialog({
  asset,
  onClose,
  onSaved,
  onDeleted,
}: {
  asset: VisualAsset;
  onClose: () => void;
  onSaved: (a: VisualAsset) => void;
  onDeleted: (id: string) => void;
}) {
  const [altText, setAltText] = useState(asset.alt_text ?? "");
  const [caption, setCaption] = useState(asset.caption ?? "");
  const [rights, setRights] = useState<Rights>(asset.rights);
  const [shootDate, setShootDate] = useState(asset.shoot_date ?? "");
  const [tags, setTags] = useState<string[]>(asset.tags);
  const [tagInput, setTagInput] = useState("");
  const [ventures, setVentures] = useState<Venture[]>(asset.ventures);
  const [saving, setSaving] = useState(false);
  const [retagging, setRetagging] = useState(false);

  const url = publicUrl(asset.storage_path);

  function addTag(t: string) {
    const clean = t.trim().toLowerCase().replace(/\s+/g, "-");
    if (!clean) return;
    if (tags.includes(clean)) return;
    setTags([...tags, clean]);
    setTagInput("");
  }

  function toggleVenture(v: Venture) {
    setVentures((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  async function save() {
    setSaving(true);
    const { data, error } = await supabase
      .from("visual_assets")
      .update({
        alt_text: altText || null,
        caption: caption || null,
        rights,
        shoot_date: shootDate || null,
        tags,
        ventures,
      })
      .eq("id", asset.id)
      .select("*")
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved" });
    onSaved(data as VisualAsset);
  }

  async function retag() {
    setRetagging(true);
    const { error } = await supabase.functions.invoke("tag-visual-asset", {
      body: { asset_id: asset.id },
    });
    setRetagging(false);
    if (error) {
      toast({ title: "Re-tag failed", description: error.message, variant: "destructive" });
      return;
    }
    const { data } = await supabase
      .from("visual_assets")
      .select("*")
      .eq("id", asset.id)
      .single();
    if (data) onSaved(data as VisualAsset);
    toast({ title: "AI re-tagged" });
  }

  async function applyAiSuggestions() {
    const prefixed = buildAiPrefixedTags(asset);
    if (prefixed.length) {
      const merged = [...new Set([...tags, ...prefixed])];
      setTags(merged);
    }
    if (asset.ai_suggested_alt && !altText) setAltText(asset.ai_suggested_alt);
    if (asset.ai_suggested_caption && !caption) setCaption(asset.ai_suggested_caption);
  }

  async function deleteAsset() {
    if (!confirm(`Delete ${asset.filename}? This removes the file and the row.`)) return;
    await supabase.storage.from("visual-assets").remove([asset.storage_path]);
    const { error } = await supabase.from("visual_assets").delete().eq("id", asset.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    onDeleted(asset.id);
  }

  const aiHasSuggestions =
    asset.ai_suggested_tags.length > 0 ||
    asset.ai_suggested_alt ||
    asset.ai_suggested_caption ||
    asset.ai_suggested_kind ||
    (asset.ai_suggested_people_roles?.length ?? 0) > 0 ||
    asset.ai_suggested_venue ||
    (asset.ai_suggested_instruments?.length ?? 0) > 0 ||
    asset.ai_suggested_location;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide-custom truncate">
            {asset.filename}
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <a href={url} target="_blank" rel="noreferrer" className="block">
              <img
                src={url}
                alt={asset.alt_text ?? asset.filename}
                className="w-full rounded-lg border border-border"
              />
            </a>
            <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
              <div>Folder: {asset.folder || "(root)"}</div>
              <div>
                {asset.width && asset.height ? `${asset.width}×${asset.height} • ` : ""}
                {fmtBytes(asset.file_size_bytes)} • {asset.mime_type}
              </div>
              <div>
                Uploaded {new Date(asset.uploaded_at).toLocaleString()}
              </div>
              <div>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-foreground"
                >
                  Public URL
                </a>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {aiHasSuggestions && (
              <div className="border border-primary/30 bg-primary/5 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-primary font-medium">
                    <Sparkles className="w-4 h-4" /> AI suggestions
                  </div>
                  <Button size="sm" variant="ghost" onClick={applyAiSuggestions}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Apply
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2 text-xs">
                  {asset.ai_suggested_kind && (
                    <div>
                      <span className="text-muted-foreground">Kind:</span>{" "}
                      <span className="font-medium">{asset.ai_suggested_kind}</span>
                    </div>
                  )}
                  {asset.ai_suggested_people_count && asset.ai_suggested_people_count !== "none" && (
                    <div>
                      <span className="text-muted-foreground">People:</span>{" "}
                      <span className="font-medium">{asset.ai_suggested_people_count}</span>
                    </div>
                  )}
                  {asset.ai_suggested_venue && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Venue:</span>{" "}
                      <span className="font-medium">{asset.ai_suggested_venue}</span>
                    </div>
                  )}
                  {asset.ai_suggested_location && (
                    <div>
                      <span className="text-muted-foreground">Location:</span>{" "}
                      <span className="font-medium">{asset.ai_suggested_location}</span>
                    </div>
                  )}
                </div>
                {(asset.ai_suggested_people_roles?.length ?? 0) > 0 && (
                  <div className="mb-1.5 flex flex-wrap items-center gap-1 text-xs">
                    <span className="text-muted-foreground">Roles:</span>
                    {asset.ai_suggested_people_roles.map((r) => (
                      <Badge key={r} variant="secondary" className="text-[10px]">
                        {r}
                      </Badge>
                    ))}
                  </div>
                )}
                {(asset.ai_suggested_instruments?.length ?? 0) > 0 && (
                  <div className="mb-1.5 flex flex-wrap items-center gap-1 text-xs">
                    <span className="text-muted-foreground">Instruments:</span>
                    {asset.ai_suggested_instruments.map((i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {i}
                      </Badge>
                    ))}
                  </div>
                )}
                {asset.ai_suggested_alt && (
                  <div className="mb-1.5">
                    <span className="text-muted-foreground">Alt:</span> {asset.ai_suggested_alt}
                  </div>
                )}
                {asset.ai_suggested_caption && (
                  <div className="mb-1.5">
                    <span className="text-muted-foreground">Caption:</span>{" "}
                    {asset.ai_suggested_caption}
                  </div>
                )}
                {asset.ai_suggested_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {asset.ai_suggested_tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            {asset.ai_error && (
              <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
                AI tagging failed: {asset.ai_error}
              </div>
            )}

            <div>
              <Label htmlFor="alt">Alt text</Label>
              <Textarea
                id="alt"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Plain accessible description"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="caption">Caption</Label>
              <Textarea
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Editorial caption for press / social"
                rows={2}
              />
            </div>

            <div>
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                {tags.length === 0 && (
                  <span className="text-xs text-muted-foreground">None yet.</span>
                )}
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1 pr-1">
                    {t}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((x) => x !== t))}
                      className="hover:bg-muted rounded p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  placeholder="Add tag and hit enter"
                />
                <Button type="button" variant="outline" onClick={() => addTag(tagInput)}>
                  Add
                </Button>
              </div>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rights">Rights</Label>
                <Select value={rights} onValueChange={(v) => setRights(v as Rights)}>
                  <SelectTrigger id="rights">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RIGHTS_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="shoot">Shoot date</Label>
                <Input
                  id="shoot"
                  type="date"
                  value={shootDate}
                  onChange={(e) => setShootDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={retag} disabled={retagging}>
              {retagging ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Re-run AI
            </Button>
            <Button variant="ghost" size="sm" onClick={deleteAsset} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
