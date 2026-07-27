import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ExternalLink, Music, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// EPK / Roster & Asset Manager — v1 (Josh 7/27). The roster rail + per-act
// identity + the LIVE readiness checklist (acts + epk_components tables,
// seeded from wiki/harborline/epk-asset-checklist-2026-07.md). The static brain
// checklist became this queryable grid — status flips persist immediately.
// Spec: wiki/harborline/epk-builder-spec-2026-07.md (Assets drawer + /epk/:slug
// rendering are build-order steps 2-3).

const db = supabase as unknown as { from: (t: string) => any };

type Act = {
  id: string; slug: string; name: string; kind: string; status: string;
  one_liner: string | null; bio_short: string | null; bio_long: string | null;
  booking_email: string | null; booking_phone: string | null; website_url: string | null;
  socials: Record<string, string>; listen_smart_link_slug: string | null;
  commission_pct: number | null; voice_locked: boolean;
  legacy_venture_tags: string[]; sort_order: number; notes: string | null;
};
type Component = {
  id: string; act_id: string; component: string; status: string;
  link: string | null; source_ref: string | null; note: string | null; sort_order: number;
};

const COMPONENT_LABEL: Record<string, string> = {
  short_bio: "Short bio", long_bio: "Long bio", one_sheet: "One-sheet / EPK",
  press_photos: "Press photos", live_video: "Live video / reel", audio_dsp: "Audio / DSP",
  logo: "Logo / brand mark", social_proof: "Social proof", tech_rider: "Tech rider",
  pricing: "Pricing / configs", website_social: "Website / social", agreement: "Agreement",
};
// Click a status chip to cycle it — the fastest possible edit loop.
const STATUS_CYCLE = ["missing", "partial", "have", "na", "gated"] as const;
const STATUS_STYLE: Record<string, string> = {
  have: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  partial: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  missing: "bg-red-500/15 text-red-400 border-red-500/30",
  na: "bg-muted/40 text-muted-foreground border-border",
  gated: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

export default function EpkTab() {
  const [acts, setActs] = useState<Act[]>([]);
  const [comps, setComps] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [assetCounts, setAssetCounts] = useState<Record<string, { curated: number; dam: number }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [a, c] = await Promise.all([
      db.from("acts").select("*").order("sort_order"),
      db.from("epk_components").select("*").order("sort_order"),
    ]);
    if (a.error) toast({ title: a.error.message, variant: "destructive" });
    setActs((a.data ?? []) as Act[]);
    setComps((c.data ?? []) as Component[]);
    setSelected((prev) => prev ?? (a.data?.[0]?.slug ?? null));
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Real per-act asset counts (curated visual_assets vs the DAM firehose) so
  // gaps like "Economy: 0 curated / 527 raw" stay visible and honest.
  useEffect(() => {
    (async () => {
      const out: Record<string, { curated: number; dam: number }> = {};
      for (const act of acts) {
        const [cur, dam] = await Promise.all([
          db.from("visual_assets").select("id", { count: "exact", head: true }).contains("ventures", [act.slug]),
          db.from("media_assets").select("id", { count: "exact", head: true }).in("venture", act.legacy_venture_tags.length ? act.legacy_venture_tags : [act.name]).eq("media_type", "image"),
        ]);
        out[act.slug] = { curated: cur.count ?? 0, dam: dam.count ?? 0 };
      }
      setAssetCounts(out);
    })();
  }, [acts]);

  const act = useMemo(() => acts.find((a) => a.slug === selected) ?? null, [acts, selected]);
  const actComps = useMemo(() => comps.filter((c) => c.act_id === act?.id), [comps, act]);

  const completeness = useCallback((actId: string) => {
    const rows = comps.filter((c) => c.act_id === actId && !["na", "gated"].includes(c.status));
    if (!rows.length) return 0;
    return Math.round((rows.filter((c) => c.status === "have").length / rows.length) * 100);
  }, [comps]);

  const cycleStatus = async (comp: Component) => {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(comp.status as typeof STATUS_CYCLE[number]) + 1) % STATUS_CYCLE.length];
    setComps((prev) => prev.map((c) => (c.id === comp.id ? { ...c, status: next } : c)));
    const { error } = await db.from("epk_components").update({ status: next, updated_at: new Date().toISOString() }).eq("id", comp.id);
    if (error) { toast({ title: error.message, variant: "destructive" }); void load(); }
  };

  const patchAct = async (patch: Partial<Act>) => {
    if (!act) return;
    setActs((prev) => prev.map((a) => (a.id === act.id ? { ...a, ...patch } : a)));
    const { error } = await db.from("acts").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", act.id);
    if (error) toast({ title: error.message, variant: "destructive" });
  };

  if (loading) return <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-5">
      {/* Roster rail */}
      <div className="space-y-2">
        {acts.map((a) => {
          const pct = completeness(a.id);
          return (
            <button key={a.slug} onClick={() => setSelected(a.slug)}
              className={`w-full text-left rounded-lg border p-3 transition ${selected === a.slug ? "border-primary/60 bg-primary/5" : "border-border bg-card/40 hover:bg-muted/30"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm text-foreground truncate">{a.name}</span>
                <Badge variant="outline" className="text-[9px] shrink-0">{a.kind === "managed" ? "managed" : a.status}</Badge>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground">{pct}% pitch-ready</span>
            </button>
          );
        })}
      </div>

      {/* Act detail */}
      {act && (
        <div className="space-y-5 min-w-0">
          {/* Identity */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-display text-lg tracking-wide-custom text-foreground">{act.name}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {act.commission_pct != null && <Badge variant="outline" className="text-[10px]">{act.commission_pct}% commission</Badge>}
                {act.website_url && (
                  <a href={act.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                    site <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
            {act.voice_locked && (
              <p className="text-xs rounded border border-amber-500/40 bg-amber-500/10 text-amber-500 px-2.5 py-1.5">
                Voice locked — Josh + Jon sign-off required before bio prose ships.
              </p>
            )}
            <Input value={act.one_liner ?? ""} placeholder="One-liner"
              onChange={(e) => setActs((p) => p.map((x) => x.id === act.id ? { ...x, one_liner: e.target.value } : x))}
              onBlur={(e) => void patchAct({ one_liner: e.target.value })} className="h-8 text-sm" />
            <Textarea value={act.bio_short ?? ""} placeholder="Short bio (~50 words)" rows={2}
              onChange={(e) => setActs((p) => p.map((x) => x.id === act.id ? { ...x, bio_short: e.target.value } : x))}
              onBlur={(e) => void patchAct({ bio_short: e.target.value })} className="text-sm" />
            <div className="grid sm:grid-cols-2 gap-2">
              <Input value={act.booking_email ?? ""} placeholder="Booking email"
                onChange={(e) => setActs((p) => p.map((x) => x.id === act.id ? { ...x, booking_email: e.target.value } : x))}
                onBlur={(e) => void patchAct({ booking_email: e.target.value })} className="h-8 text-sm" />
              <Input value={act.booking_phone ?? ""} placeholder="Booking phone"
                onChange={(e) => setActs((p) => p.map((x) => x.id === act.id ? { ...x, booking_phone: e.target.value } : x))}
                onBlur={(e) => void patchAct({ booking_phone: e.target.value })} className="h-8 text-sm" />
            </div>
          </Card>

          {/* Live checklist */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">EPK readiness — click a status to change it</h4>
              <span className="text-xs text-muted-foreground tabular-nums">{completeness(act.id)}%</span>
            </div>
            <div className="divide-y divide-border/50">
              {actComps.map((c) => (
                <div key={c.id} className="py-2 flex items-start gap-3">
                  <button onClick={() => void cycleStatus(c)}
                    className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border shrink-0 mt-0.5 cursor-pointer ${STATUS_STYLE[c.status] ?? STATUS_STYLE.missing}`}
                    title="Click to cycle status">
                    {c.status}
                  </button>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-foreground">{COMPONENT_LABEL[c.component] ?? c.component}</span>
                    {c.note && <span className="block text-xs text-muted-foreground">{c.note}</span>}
                  </div>
                  {c.link && (
                    <a href={c.link} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground shrink-0">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Assets + listen — honest counts, deep links to the real surfaces */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> Assets
              </h4>
              <p className="text-sm text-foreground tabular-nums">
                {assetCounts[act.slug]?.curated ?? "…"} curated · {assetCounts[act.slug]?.dam ?? "…"} raw in DAM
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Curate in <a href="/team/visual-assets" className="underline hover:text-foreground">Visual Assets</a> · browse the <a href="/team/media" className="underline hover:text-foreground">DAM</a>
              </p>
            </Card>
            <Card className="p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5" /> Listen
              </h4>
              {act.listen_smart_link_slug ? (
                <a href={`https://gethip.to/${act.listen_smart_link_slug}`} target="_blank" rel="noreferrer"
                  className="text-sm text-primary hover:underline">gethip.to/{act.listen_smart_link_slug}</a>
              ) : (
                <p className="text-sm text-muted-foreground">No smart link yet — <a href="/team/smart-links" className="underline hover:text-foreground">create one</a></p>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
