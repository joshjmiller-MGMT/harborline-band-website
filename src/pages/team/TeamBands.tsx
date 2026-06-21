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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type BandRow = { id: string; rowIndex: number; fields: Record<string, string> };

// Match a sheet header case-insensitively against a set of aliases, so a rename
// on the JJMM "Artists" tab (e.g. "Artist Fit" → "Fit") doesn't blank the view.
function pick(fields: Record<string, string>, aliases: string[]): string {
  const entries = Object.entries(fields);
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

  const grouped = useMemo(() => {
    const g = new Map<number, BandRow[]>();
    for (const t of TIER_ORDER) g.set(t, []);
    for (const r of filtered) {
      const t = fitTier(pick(r.fields, ["Artist Fit", "Fit"]));
      g.get(t)!.push(r);
    }
    for (const [, list] of g) {
      list.sort((a, b) =>
        pick(a.fields, ["Name"]).localeCompare(pick(b.fields, ["Name"])),
      );
    }
    return g;
  }, [filtered]);

  return (
    <TeamLayout>
      <Helmet>
        <title>Bands · Team</title>
      </Helmet>
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
          <div>
            <h1 className="font-display tracking-wide-custom text-2xl flex items-center gap-2">
              <Handshake className="w-6 h-6 text-primary" /> Bands
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Relationship board of bands for show swaps, support slots, and bills —
              color-coded by <strong>Artist Fit</strong>. Sourced live from the JJMM
              <em> Artists</em> tab; edit the sheet to change a rating.
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
          <div className="flex gap-4 overflow-x-auto pb-4">
            {TIER_ORDER.map((t) => {
              const list = grouped.get(t) || [];
              if (list.length === 0) return null;
              const tier = TIERS[t];
              return (
                <div key={t} className="flex-shrink-0 w-[270px]">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <h2 className={`text-sm font-display tracking-wide-custom flex items-center gap-2 ${tier.head}`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${tier.dot}`} />
                      {t > 0 ? `${t} · ${tier.label}` : tier.label}
                    </h2>
                    <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {list.map((r) => (
                      <BandCard key={r.id} row={r} tierClass={tier.col} onClick={() => setDetail(r)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <BandDialog row={detail} sheetUrl={sheetUrl} onClose={() => setDetail(null)} />
      </div>
    </TeamLayout>
  );
}

function BandCard({
  row,
  tierClass,
  onClick,
}: {
  row: BandRow;
  tierClass: string;
  onClick: () => void;
}) {
  const f = row.fields;
  const name = pick(f, ["Name"]);
  const location = pick(f, ["Location"]);
  const followers = formatFollowers(pick(f, ["# IG Followers", "IG Followers", "Followers"]));
  const ig = pick(f, ["IG / Website", "IG", "Instagram"]);
  const notes = pick(f, ["Notes"]);
  const status = pick(f, ["Status"]);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border bg-card hover:border-primary/40 transition-colors p-3 ${tierClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-foreground text-sm leading-snug">{name}</h3>
        {status && (
          <Badge variant="outline" className="text-[9px] flex-shrink-0">{status}</Badge>
        )}
      </div>
      <div className="mt-1.5 flex flex-col gap-1 text-[11px] text-muted-foreground">
        {location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {location}
          </span>
        )}
        <div className="flex items-center gap-3">
          {ig && (
            <span className="inline-flex items-center gap-1 truncate">
              <Instagram className="w-3 h-3" /> {ig}
            </span>
          )}
          {followers && (
            <span className="inline-flex items-center gap-1">
              <Users className="w-3 h-3" /> {followers}
            </span>
          )}
        </div>
        {notes && <p className="text-foreground/70 italic line-clamp-2 mt-0.5">“{notes}”</p>}
      </div>
    </button>
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
