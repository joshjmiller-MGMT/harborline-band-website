import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { COLOR_SCALE, colorSpec } from "@/lib/practice-mastery";

// Structured practice detail (Josh 2026-08-02). Sits UNDER the free-text box —
// it supplements, never replaces it ("I like that it's a comment style text box").
//
// The shape Josh has been typing into prose for months ("Barry Harris voicing -
// major drop 2", a segment literally titled "Barry Harris min drop 2 at 35 bpm")
// becomes: method → dim2 → dim3 → BPM.
//
// TWO RULES FROM JOSH THAT DRIVE THIS DESIGN:
// 1. The second dropdown is per-method. Barry/Bill Evans take chord QUALITIES;
//    4ths/quartal and Belzer take PARENT SCALES *instead of* qualities — same
//    slot, never both. The method row declares it (dim2/dim3 columns).
// 2. Vocabulary is COLUMN-EXCLUSIVE. "Bill" the voicing exercise and the "Bill
//    Evans lines" he studies are different entities sharing a name, so options
//    are filtered by the segment's category — never pooled globally.

const db = supabase as unknown as { from: (t: string) => any };

type Tax = {
  id: string; dimension: string; parent_id: string | null;
  value: string; label: string; applies_to: string[];
  dim2: string | null; dim3: string | null; sort_order: number;
};
type Detail = {
  id: string; segment_id: string;
  method_id: string | null; dim2_id: string | null; dim3_id: string | null;
  bpm: number | null; sort_order: number;
};

// Slow-practice range first — Josh's log lives at 30-60 ("Belz 10ths MAJ 35 BPM",
// "Barry Harris min drop 2 at 35 bpm"), so those are the reachable options.
const BPMS = [30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 110, 120, 140, 160, 180, 200];

const sel =
  "h-7 text-xs rounded border border-border bg-background px-1.5 text-foreground disabled:opacity-40 disabled:cursor-not-allowed";

// Lines and Songs work differently (Josh 8/2): they're not method→quality→
// voicing, they're a NAMED ITEM ("Bill 2", "Harry 5", "Oscar 1", "Bird 3")
// carrying a mastery colour that belongs to the item ITSELF, not to the
// session. Change it here and the line's status changes everywhere — that's
// the point: "it changes the color status of that line".
const ITEM_SECTIONS: Record<string, "line" | "song"> = {
  Lines: "line",
  "Lines (RH/LH)": "line",
  Songs: "song",
};
type Item = { id: string; kind: string; title: string; color_level: number };

export default function PracticeDetailRow({
  segmentId,
  category,
}: {
  segmentId: string;
  category: string;
}) {
  const [tax, setTax] = useState<Tax[]>([]);
  const [rows, setRows] = useState<Detail[]>([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const itemKind = ITEM_SECTIONS[category];

  // Item mode: pull the named items (lines/songs) with their CURRENT mastery.
  useEffect(() => {
    if (!itemKind) return;
    let alive = true;
    db.from("practice_items")
      .select("id,kind,title,color_level")
      .eq("kind", itemKind)
      .is("archived_at", null)
      .order("title")
      .then(({ data }: { data: Item[] | null }) => { if (alive) setItems(data ?? []); });
    return () => { alive = false; };
  }, [itemKind]);

  // Writing the colour here updates the ITEM — the line's mastery is a property
  // of the line, so it moves everywhere at once (widgets, filters, recs).
  const setItemColor = async (itemId: string, level: number) => {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, color_level: level } : i)));
    await db
      .from("practice_items")
      .update({ color_level: level, color_level_updated_at: new Date().toISOString() })
      .eq("id", itemId);
  };

  const load = useCallback(async () => {
    const [t, d] = await Promise.all([
      db.from("practice_taxonomy").select("*").eq("active", true).order("sort_order"),
      db.from("practice_segment_details").select("*").eq("segment_id", segmentId).order("sort_order"),
    ]);
    setTax((t.data ?? []) as Tax[]);
    setRows((d.data ?? []) as Detail[]);
    setLoading(false);
  }, [segmentId]);
  useEffect(() => { void load(); }, [load]);

  // Only methods that belong to THIS section (the column-exclusivity rule).
  const methods = useMemo(
    () => tax.filter((t) => t.dimension === "method" && t.applies_to.includes(category)),
    [tax, category],
  );
  const byId = useMemo(() => new Map(tax.map((t) => [t.id, t])), [tax]);

  // dim2 options: children of the chosen method when the dimension is scoped to
  // it (qualities differ per method), otherwise the shared set for that
  // dimension (parent scales are the same three everywhere).
  const optionsFor = (methodId: string | null, which: "dim2" | "dim3") => {
    if (!methodId) return [];
    const m = byId.get(methodId);
    const dim = which === "dim2" ? m?.dim2 : m?.dim3;
    if (!dim) return [];
    const scoped = tax.filter((t) => t.dimension === dim && t.parent_id === methodId);
    if (scoped.length) return scoped;
    return tax.filter((t) => t.dimension === dim && !t.parent_id && t.applies_to.includes(category));
  };

  const patch = async (id: string, p: Partial<Detail>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
    await db.from("practice_segment_details").update(p).eq("id", id);
  };
  const addRow = async () => {
    const { data } = await db
      .from("practice_segment_details")
      .insert({ segment_id: segmentId, sort_order: rows.length })
      .select()
      .single();
    if (data) setRows((prev) => [...prev, data as Detail]);
  };
  const removeRow = async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await db.from("practice_segment_details").delete().eq("id", id);
  };

  if (loading) return null;
  // Nothing seeded for this section — stay invisible rather than show an empty control.
  if (!itemKind && methods.length === 0) return null;

  // ── ITEM MODE (Lines / Songs): named item + its own mastery colour ──
  if (itemKind) {
    return (
      <div className="space-y-1">
        {rows.map((r) => {
          const item = r.method_id ? items.find((i) => i.id === r.method_id) : null;
          const spec = colorSpec(item?.color_level ?? 0);
          return (
            <div key={r.id} className="flex items-center gap-1 flex-wrap">
              <select
                className={sel}
                value={r.method_id ?? ""}
                onChange={(e) => void patch(r.id, { method_id: e.target.value || null })}
              >
                <option value="">{itemKind === "line" ? "line…" : "song…"}</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
              </select>

              {/* The colour belongs to the ITEM. Changing it here moves that
                  line/song's mastery everywhere, which is the whole point. */}
              <span className="inline-flex items-center gap-1">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${spec.swatchBg}`} aria-hidden />
                <select
                  className={sel}
                  value={item?.color_level ?? ""}
                  disabled={!item}
                  title={item ? `${spec.name} — ${spec.meaning}` : "pick an item first"}
                  onChange={(e) => item && void setItemColor(item.id, Number(e.target.value))}
                >
                  <option value="">how well?</option>
                  {COLOR_SCALE.map((c) => (
                    <option key={c.level} value={c.level}>{c.name} — {c.meaning}</option>
                  ))}
                </select>
              </span>

              <select
                className={sel}
                value={r.bpm ?? ""}
                onChange={(e) => void patch(r.id, { bpm: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">bpm…</option>
                {BPMS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>

              <button type="button" onClick={() => void removeRow(r.id)}
                className="text-muted-foreground/60 hover:text-destructive" aria-label="Remove">
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
        <button type="button" onClick={() => void addRow()}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary">
          <Plus className="w-3 h-3" /> {rows.length ? "add another" : `log a ${itemKind}`}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {rows.map((r) => {
        const m = r.method_id ? byId.get(r.method_id) : null;
        const d2 = optionsFor(r.method_id, "dim2");
        const d3 = optionsFor(r.method_id, "dim3");
        return (
          <div key={r.id} className="flex items-center gap-1 flex-wrap">
            <select
              className={sel}
              value={r.method_id ?? ""}
              onChange={(e) =>
                void patch(r.id, { method_id: e.target.value || null, dim2_id: null, dim3_id: null })
              }
            >
              <option value="">method…</option>
              {methods.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>

            <select
              className={sel}
              value={r.dim2_id ?? ""}
              disabled={!r.method_id || d2.length === 0}
              onChange={(e) => void patch(r.id, { dim2_id: e.target.value || null })}
            >
              <option value="">{m?.dim2 === "parent_scale" ? "parent scale…" : "quality…"}</option>
              {d2.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>

            <select
              className={sel}
              value={r.dim3_id ?? ""}
              disabled={!r.method_id || d3.length === 0}
              onChange={(e) => void patch(r.id, { dim3_id: e.target.value || null })}
            >
              <option value="">{m?.dim3 === "spread" ? "spread…" : "voicing…"}</option>
              {d3.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>

            <select
              className={sel}
              value={r.bpm ?? ""}
              onChange={(e) => void patch(r.id, { bpm: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">bpm…</option>
              {BPMS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>

            <button
              type="button"
              onClick={() => void removeRow(r.id)}
              className="text-muted-foreground/60 hover:text-destructive"
              aria-label="Remove this detail"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => void addRow()}
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
      >
        <Plus className="w-3 h-3" /> {rows.length ? "add another" : "log what you drilled"}
      </button>
    </div>
  );
}
