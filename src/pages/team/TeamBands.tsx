import { useEffect, useMemo, useState, useCallback } from "react";
import TeamLayout from "@/components/TeamLayout";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Handshake,
  RefreshCw,
  ExternalLink,
  Search,
  MapPin,
  Instagram,
  Users,
  Loader2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrumBoard, type ScrumColumn } from "@/components/board/ScrumBoard";

type BandRow = { id: string; rowIndex: number; fields: Record<string, string> };
type BandCardData = { id: string; columnId: string; band: BandRow };

// Match a sheet header case-insensitively against a set of aliases, so a rename
// on the JJMM "Artists" tab (e.g. "Artist Fit" → "Fit") doesn't blank the view.
function pick(fields: Record<string, string> | undefined, aliases: string[]): string {
  const entries = Object.entries(fields || {});
  for (const alias of aliases) {
    const a = alias.toLowerCase();
    const hit = entries.find(([k]) => k.trim().toLowerCase() === a);
    if (hit && hit[1].trim()) return hit[1].trim();
  }
  return "";
}

// "Artist Fit" cells look like "3 — Explore" / "5 — Book It". Pull the leading
// 1–5 tier digit; 0 = unrated.
function fitTier(raw: string): number {
  const m = raw.match(/^\s*([1-5])\b/);
  return m ? parseInt(m[1], 10) : 0;
}

// Josh's color scale (chosen 2026-06-21): 5 blue · 4 green · 3 yellow · 2 orange · 1 red.
// Unrated = neutral. Classes are static strings so Tailwind keeps them in the build.
const TIERS: Record<
  number,
  { label: string; col: string; head: string; dot: string; badge: string }
> = {
  5: {
    label: "Book It",
    col: "border-blue-500/30",
    head: "text-blue-400",
    dot: "bg-blue-500",
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  4: {
    label: "Strong Yes",
    col: "border-emerald-500/30",
    head: "text-emerald-400",
    dot: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  3: {
    label: "Explore",
    col: "border-amber-500/30",
    head: "text-amber-400",
    dot: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  2: {
    label: "Not Yet",
    col: "border-orange-500/30",
    head: "text-orange-400",
    dot: "bg-orange-500",
    badge: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  },
  1: {
    label: "Pass",
    col: "border-red-500/30",
    head: "text-red-400",
    dot: "bg-red-500",
    badge: "bg-red-500/15 text-red-400 border-red-500/30",
  },
  0: {
    label: "Unrated",
    col: "border-border",
    head: "text-muted-foreground",
    dot: "bg-muted-foreground/60",
    badge: "bg-muted/40 text-muted-foreground border-border",
  },
};

// Display order: best fit first, unrated last.
const TIER_ORDER = [5, 4, 3, 2, 1, 0];

// The exact string written back to the "Artist Fit" cell for a tier (em-dash to
// match the sheet's existing format, e.g. "4 — Strong Yes"). Tier 0 clears it.
function fitValueForTier(tier: number): string {
  return tier >= 1 && tier <= 5 ? `${tier} — ${TIERS[tier].label}` : "";
}

// Return a copy of the row with its Artist-Fit field set to `fit` (optimistic).
function withFit(row: BandRow, fit: string): BandRow {
  const fields = { ...row.fields };
  const key =
    Object.keys(fields).find((k) => ["artist fit", "fit"].includes(k.trim().toLowerCase())) ||
    "Artist Fit";
  fields[key] = fit;
  return { ...row, fields };
}

function formatFollowers(raw: string): string {
  if (!raw) return "";
  const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
  if (isNaN(n)) return raw;
  return n.toLocaleString();
}

function igHref(ig: string): string | null {
  const v = ig.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "");
  return `https://instagram.com/${handle}`;
}

// Pull a useful message out of a supabase.functions error (non-2xx bodies are
// stashed on error.context as a Response).
async function errorMessage(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.message || body?.error) return body.message || body.error;
    } catch {
      /* not json */
    }
  }
  return error instanceof Error ? error.message : fallback;
}

export default function TeamBands() {
  const [rows, setRows] = useState<BandRow[]>([]);
  const [sheetUrl, setSheetUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [detail, setDetail] = useState<BandRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNote(null);
    try {
      const { data, error } = await supabase.functions.invoke("booking-agent-rows", {
        body: { tab: "bands" },
      });
      if (error) throw error;
      const d = data as {
        rows?: BandRow[];
        sheetUrl?: string;
        error?: string;
        note?: string;
      };
      if (d?.error) setError(d.error);
      if (d?.note) setNote(d.note);
      setRows(d?.rows || []);
      setSheetUrl(d?.sheetUrl || "");
      setRefreshedAt(new Date());
    } catch (e) {
      console.error("TeamBands load error", e);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Only the bands (Category=Artist) — Label/Mgmt + Press rows on the same tab
  // are a different kind of contact and live elsewhere.
  const bands = useMemo(
    () =>
      rows
        .filter((r) => pick(r.fields, ["Category"]).toLowerCase() === "artist")
        .filter((r) => pick(r.fields, ["Name"]) !== ""),
    [rows],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return bands;
    const q = search.toLowerCase();
    return bands.filter((r) => Object.values(r.fields).join(" ").toLowerCase().includes(q));
  }, [bands, search]);

  const columns: ScrumColumn[] = useMemo(
    () =>
      TIER_ORDER.map((t) => ({
        id: String(t),
        title: t > 0 ? `${t} · ${TIERS[t].label}` : TIERS[t].label,
        accent: TIERS[t].head,
      })),
    [],
  );

  const cards: BandCardData[] = useMemo(
    () =>
      filtered.map((b) => ({
        id: b.id,
        columnId: String(fitTier(pick(b.fields, ["Artist Fit", "Fit"]))),
        band: b,
      })),
    [filtered],
  );

  // Drag a band to a new Fit column → optimistic recolor + write the new rating
  // back to the sheet; roll back (reload) on failure.
  const handleCardMove = useCallback(
    async (cardId: string, _from: string, to: string) => {
      const tier = parseInt(to, 10);
      const fit = fitValueForTier(tier);
      const band = rows.find((r) => r.id === cardId);
      if (!band) return;
      const name = pick(band.fields, ["Name"]) || "Band";

      const prevRows = rows;
      setRows((rs) => rs.map((r) => (r.id === cardId ? withFit(r, fit) : r)));

      try {
        const { data, error } = await supabase.functions.invoke("bands-set-fit", {
          body: { row_index: band.rowIndex, fit },
        });
        if (error) throw error;
        const d = data as { ok?: boolean; error?: string; message?: string };
        if (d?.error) throw new Error(d.message || d.error);
        toast.success(tier > 0 ? `${name} → ${tier} ${TIERS[tier].label}` : `${name} → Unrated`);
      } catch (e) {
        const msg = await errorMessage(e, "Couldn't save to the sheet");
        toast.error(msg);
        setRows(prevRows); // rollback the optimistic move
      }
    },
    [rows],
  );

  return (
    <TeamLayout>
      <Helmet>
        <title>Bands · Team</title>
      </Helmet>
      <div className="container mx-auto px-6 py-8 max-w-[88rem]">
        <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
          <div>
            <h1 className="font-display tracking-wide-custom text-2xl flex items-center gap-2">
              <Handshake className="w-6 h-6 text-primary" /> Bands
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Relationship board of bands for show swaps, support slots, and bills.
              <strong> Drag a band between columns</strong> to re-rate its{" "}
              <strong>Artist Fit</strong> — the new rating writes straight back to the JJMM
              <em> Artists</em> tab.
            </p>
          </div>
          <div className="flex items-center gap-1">
            {sheetUrl && (
              <Button variant="ghost" size="icon" asChild title="Open the Artists tab">
                <a href={sheetUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={load} disabled={loading} title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Legend + count */}
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-muted-foreground mb-4">
          {refreshedAt && (
            <span>
              {bands.length} band{bands.length === 1 ? "" : "s"} · updated{" "}
              {refreshedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
          <span className="flex items-center gap-3">
            {[5, 4, 3, 2, 1].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${TIERS[t].dot}`} />
                {t} {TIERS[t].label}
              </span>
            ))}
          </span>
        </div>

        {error && (
          <div className="mb-4 p-2 rounded text-xs bg-destructive/10 text-destructive border border-destructive/30">
            {error} — make sure the JJMM sheet is set to “Anyone with the link can view.”
          </div>
        )}
        {note && !error && (
          <div className="mb-4 p-2 rounded text-xs bg-muted/40 text-muted-foreground border border-border">
            {note}
          </div>
        )}

        <div className="relative max-w-sm mb-5">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bands, locations, notes…"
            className="pl-8 h-9"
          />
        </div>

        {loading && rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading bands…
          </div>
        ) : bands.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
            No bands found on the JJMM Artists tab.
          </div>
        ) : (
          <ScrumBoard<BandCardData>
            columns={columns}
            cards={cards}
            onCardMove={handleCardMove}
            emptyColumnLabel="No bands"
            renderCard={(card) => (
              <BandCard band={card.band} onInfo={() => setDetail(card.band)} />
            )}
          />
        )}

        <BandDialog row={detail} sheetUrl={sheetUrl} onClose={() => setDetail(null)} />
      </div>
    </TeamLayout>
  );
}

function BandCard({ band, onInfo }: { band: BandRow; onInfo: () => void }) {
  const f = band.fields;
  const name = pick(f, ["Name"]);
  const location = pick(f, ["Location"]);
  const followers = formatFollowers(pick(f, ["# IG Followers", "IG Followers", "Followers"]));
  const ig = pick(f, ["IG / Website", "IG", "Instagram"]);
  const igLink = igHref(ig);
  const notes = pick(f, ["Notes"]);
  const status = pick(f, ["Status"]);
  const tier = fitTier(pick(f, ["Artist Fit", "Fit"]));

  return (
    <div className={`p-3 border-l-2 ${TIERS[tier].col} rounded-md`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-foreground text-sm leading-snug">{name}</h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          {status && (
            <Badge variant="outline" className="text-[9px]">{status}</Badge>
          )}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onInfo();
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Details for ${name}`}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-1.5 flex flex-col gap-1 text-[11px] text-muted-foreground">
        {location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {location}
          </span>
        )}
        <div className="flex items-center gap-3">
          {ig &&
            (igLink ? (
              <a
                href={igLink}
                target="_blank"
                rel="noreferrer"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 truncate hover:text-foreground"
              >
                <Instagram className="w-3 h-3" /> {ig}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 truncate">
                <Instagram className="w-3 h-3" /> {ig}
              </span>
            ))}
          {followers && (
            <span className="inline-flex items-center gap-1">
              <Users className="w-3 h-3" /> {followers}
            </span>
          )}
        </div>
        {notes && <p className="text-foreground/70 italic line-clamp-2 mt-0.5">“{notes}”</p>}
      </div>
    </div>
  );
}

function BandDialog({
  row,
  sheetUrl,
  onClose,
}: {
  row: BandRow | null;
  sheetUrl: string;
  onClose: () => void;
}) {
  const t = row ? fitTier(pick(row.fields, ["Artist Fit", "Fit"])) : 0;
  const tier = TIERS[t];
  const fitRaw = row ? pick(row.fields, ["Artist Fit", "Fit"]) : "";
  // Surface every non-empty field on the row, skipping Category (always "Artist" here).
  const detailFields = row
    ? Object.entries(row.fields).filter(
        ([k, v]) => v.trim() && k.trim().toLowerCase() !== "category" && k.trim().toLowerCase() !== "name",
      )
    : [];

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {row && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Handshake className="w-5 h-5 text-primary" />
                {pick(row.fields, ["Name"]) || `Row ${row.rowIndex}`}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 pt-1">
                {fitRaw ? (
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border ${tier.badge}`}>
                    <span className={`w-2 h-2 rounded-full ${tier.dot}`} />
                    {fitRaw}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">Unrated</span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 mt-2">
              {detailFields.map(([k, v]) => (
                <div key={k} className="flex gap-3 text-sm border-b border-border/20 pb-1.5">
                  <div className="w-1/3 text-muted-foreground text-xs pt-0.5">{k}</div>
                  <div className="flex-1 text-foreground/90 whitespace-pre-wrap break-words">{v}</div>
                </div>
              ))}
            </div>

            {sheetUrl && (
              <div className="pt-3 border-t border-border/30">
                <Button variant="outline" size="sm" asChild>
                  <a href={sheetUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-4 h-4 mr-1" /> Open in Google Sheets
                  </a>
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
