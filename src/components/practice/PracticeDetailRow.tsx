import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

  // Nothing to offer for this section (Songs, Transcriptions…) — stay invisible
  // rather than showing an empty control.
  if (loading || methods.length === 0) return null;

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
