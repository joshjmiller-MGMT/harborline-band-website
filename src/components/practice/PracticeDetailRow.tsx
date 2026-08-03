import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { colorSpecFor, ladderFor, type PracticeItem } from "@/lib/practice-mastery";
import {
  suggestItem, suggestKeys, suggestNeglected, suggestPatternRange,
  type HistoryRow, type Suggestion,
} from "@/lib/practice-coach";

// Josh does 1, 2 or 4 key centres depending on time — never a fixed count
// (8/2: "don't suggest a fixed number… maybe you have a dropdown for keys").
const KEYS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

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
  bpm: number | null; range_from: number | null; range_to: number | null;
  maintenance: boolean; keys_worked: string[] | null;
  lh_id: string | null; lh_item_id: string | null;
  triad_interval: string | null; triad_qualities: string | null;
  pattern_item_id: string | null; rh_item_id: string | null;
  sort_order: number;
};

// Triad pairs (Josh 8/2, decoding his own "TT(M-M)" shorthand): two triads a
// fixed interval apart. The CASE is the quality — uppercase major, lowercase
// minor — which is why the pair is picked separately from the interval.
const TRIAD_INTERVALS = ["m2","M2","m3","M3","P4","TT","P5","m6","M6","m7","M7"];
const TRIAD_QUALITIES = ["M-M","M-m","m-M","m-m"];

// Patterns work differently again (Josh 8/2): he moves through *Patterns for
// Jazz* (Coker) in RANGES — "122-148" means patterns 122 through 148 — and he
// pencils each pattern's BPM into the physical book. So this row takes a range
// and deliberately offers NO bpm field.
const RANGE_SECTIONS = new Set(["Patterns", "Patters"]);  // sheet has both spellings

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
type Item = { id: string; kind: string; title: string; color_level: number; artist: string | null };

// One dropdown, two kinds of answer: a generic left-hand style (bass, stride,
// walking) or an actual exercise tagged lh_device (VA 2, a diad movement, the
// Roman numeral movement). They write to different columns because one is
// taxonomy and the other is a real item, so the value is prefixed to say which.
function LeftHandSelect({
  row, styles, items, onChange,
}: {
  row: { lh_id: string | null; lh_item_id: string | null };
  styles: Tax[];
  items: Array<{ id: string; title: string }>;
  onChange: (p: { lh_id: string | null; lh_item_id: string | null }) => void;
}) {
  const value = row.lh_item_id ? `item:${row.lh_item_id}` : row.lh_id ? `tax:${row.lh_id}` : "";
  return (
    <select
      className={sel}
      value={value}
      title="What the left hand was doing"
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return onChange({ lh_id: null, lh_item_id: null });
        const [kind, id] = v.split(":");
        onChange(kind === "item" ? { lh_id: null, lh_item_id: id } : { lh_id: id, lh_item_id: null });
      }}
    >
      <option value="">LH…</option>
      {styles.length > 0 && (
        <optgroup label="Style">
          {styles.map((o) => <option key={o.id} value={`tax:${o.id}`}>{o.label}</option>)}
        </optgroup>
      )}
      {items.length > 0 && (
        <optgroup label="Exercise">
          {items.map((i) => <option key={i.id} value={`item:${i.id}`}>{i.title}</option>)}
        </optgroup>
      )}
    </select>
  );
}

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
  const isRange = RANGE_SECTIONS.has(category);

  // Item mode: pull the named items (lines/songs) with their CURRENT mastery.
  useEffect(() => {
    if (!itemKind) return;
    let alive = true;
    db.from("practice_items")
      .select("id,kind,title,color_level,artist")
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
  // Patterns is normally range-only (tempos live pencilled in the book), but
  // triad pairs is an exercise there and his own variation isn't in the book,
  // so it takes a range AND a bpm.
  const isTriadPairs = (methodId: string | null) =>
    !!methodId && byId.get(methodId)?.value === "triad_pairs";
  const isCA = (methodId: string | null) =>
    !!methodId && byId.get(methodId)?.value === "chordal_arrangements";
  const isCombination = category === "Combinations";

  const optionsFor = (methodId: string | null, which: "dim2" | "dim3") => {
    if (!methodId) return [];
    const m = byId.get(methodId);
    const dim = which === "dim2" ? m?.dim2 : m?.dim3;
    if (!dim) return [];
    const scoped = tax.filter((t) => t.dimension === dim && t.parent_id === methodId);
    if (scoped.length) return scoped;
    return tax.filter((t) => t.dimension === dim && !t.parent_id && t.applies_to.includes(category));
  };

  // The left hand is its own axis, not a per-method child — nearly every
  // right-hand exercise in the log names one, across every section.
  //
  // Josh 8/2: "pull any left hand item for lh devices". So the list is the
  // generic styles (bass, stride, walking…) PLUS every real item tagged
  // lh_device — VA 1-3, the diad movements, the Roman numeral movement. An
  // exercise can be a technique in one slot and a left-hand device in another,
  // which is exactly how he practises them.
  const [lhItems, setLhItems] = useState<Array<{ id: string; title: string }>>([]);
  useEffect(() => {
    let alive = true;
    db.from("practice_items")
      .select("id,title")
      .contains("roles", ["lh_device"])
      .is("archived_at", null)
      .order("title")
      .then(({ data }: { data: Array<{ id: string; title: string }> | null }) => {
        if (alive) setLhItems(data ?? []);
      });
    return () => { alive = false; };
  }, []);
  const lhStyles = useMemo(() => tax.filter((t) => t.dimension === "lh"), [tax]);

  // Selecting a CA means picking the numbered item — Josh 8/2: "it's numbered,
  // doesn't need to be more than that." Barry's movements are CAs, so they are
  // in this same list.
  const [caItems, setCaItems] = useState<Array<{ id: string; title: string }>>([]);
  const [allItems, setAllItems] = useState<Array<{ id: string; title: string; kind: string }>>([]);
  useEffect(() => {
    let alive = true;
    db.from("practice_items").select("id,title").contains("roles", ["ca"])
      .is("archived_at", null).order("title")
      .then(({ data }: { data: Array<{ id: string; title: string }> | null }) => {
        if (alive) setCaItems(data ?? []);
      });
    // Combinations pairs ANY two kinds of material, one per hand, so the
    // right-hand picker is deliberately unfiltered.
    db.from("practice_items").select("id,title,kind").is("archived_at", null).order("kind").order("title")
      .then(({ data }: { data: Array<{ id: string; title: string; kind: string }> | null }) => {
        if (alive) setAllItems(data ?? []);
      });
    return () => { alive = false; };
  }, []);

  // Josh's off-book triad-pair variation, and anything like it he adds later.
  // It has to be loggable at the same time as a book range: "I want to include
  // it with my patterns practice, ESPECIALLY when I'm doing other triad pairs."
  const [triadItems, setTriadItems] = useState<Array<{ id: string; title: string }>>([]);
  useEffect(() => {
    let alive = true;
    db.from("practice_items")
      .select("id,title")
      .contains("roles", ["triad_pair"])
      .is("archived_at", null)
      .order("title")
      .then(({ data }: { data: Array<{ id: string; title: string }> | null }) => {
        if (alive) setTriadItems(data ?? []);
      });
    return () => { alive = false; };
  }, []);

  const patch = async (id: string, p: Partial<Detail>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
    await db.from("practice_segment_details").update(p).eq("id", id);
  };

  // Patterns for Jazz 180-208 are triad-pair studies. Josh knows not to log
  // them as plain patterns, but asked for the net anyway "just in case I forget
  // one time" — so entering a range in that window selects the method for him.
  const TRIAD_BOOK_RANGE: [number, number] = [180, 208];
  const patchRange = async (row: Detail, p: Partial<Detail>) => {
    const from = p.range_from ?? row.range_from;
    const to = p.range_to ?? row.range_to;
    const inWindow = (n: number | null) =>
      n != null && n >= TRIAD_BOOK_RANGE[0] && n <= TRIAD_BOOK_RANGE[1];
    const triadMethod = tax.find((t) => t.dimension === "method" && t.value === "triad_pairs");
    if (triadMethod && !isTriadPairs(row.method_id) && (inWindow(from) || inWindow(to))) {
      await patch(row.id, { ...p, method_id: triadMethod.id });
      return;
    }
    await patch(row.id, p);
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

  // Josh 8/2: suggestions surface "only when I arrive at that section", not all
  // up front. This component renders per-section, so computing here IS that.
  const [history, setHistory] = useState<HistoryRow[]>([]);
  useEffect(() => {
    let alive = true;
    db.from("v_practice_history")
      .select("*")
      .eq("category", category)
      .order("started_at", { ascending: false })
      .limit(120)
      .then(({ data }: { data: HistoryRow[] | null }) => { if (alive) setHistory(data ?? []); });
    return () => { alive = false; };
  }, [category]);

  const suggestion: Suggestion | null = useMemo(() => {
    if (itemKind) return suggestItem(items as unknown as PracticeItem[]);
    if (isRange) return suggestPatternRange(history);
    // Method sections: push the least-touched method, then the least-covered keys.
    const byNeglect = suggestNeglected(
      methods.map((m) => ({ id: m.id, label: m.label })), history, "method_id", "session");
    return byNeglect ?? suggestKeys(history);
  }, [itemKind, isRange, items, history, methods]);

  if (loading) return null;
  // Nothing seeded for this section — stay invisible rather than show an empty control.
  if (!itemKind && methods.length === 0) return null;

  // ── ITEM MODE (Lines / Songs): named item + its own mastery colour ──
  if (itemKind) {
    return (
      <div className="space-y-1">
      {suggestion && (
        <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground mb-1">
          <span className="text-primary/80 shrink-0">suggestion</span>
          <span>
            <span className="text-foreground">{suggestion.text}</span>
            <span className="opacity-70"> — {suggestion.because}</span>
          </span>
        </div>
      )}
        {rows.map((r) => {
          const item = r.method_id ? items.find((i) => i.id === r.method_id) : null;
          // Same colours, kind-specific meanings (song vs transcription vs line).
          const spec = colorSpecFor(itemKind, item?.color_level ?? 0);
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
                  {/* Per-kind ladder: pink only exists for transcriptions. */}
                  {ladderFor(itemKind).map((c) => (
                    <option key={c.level} value={c.level}>{c.name} — {c.meaning}</option>
                  ))}
                </select>
              </span>

              {/* Maintenance = held it at its current colour rather than pushed
                  it up. The coaching engine needs to tell those apart. */}
              <label className="inline-flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer"
                title="Worked to KEEP it where it is, rather than move it up">
                <input type="checkbox" className="accent-current"
                  checked={r.maintenance}
                  onChange={(e) => void patch(r.id, { maintenance: e.target.checked })} />
                upkeep
              </label>

              <LeftHandSelect
                row={r}
                styles={lhStyles}
                items={lhItems}
                onChange={(p) => void patch(r.id, p)}
              />


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

            {/* Triad pairs is an exercise inside Patterns (Josh 8/2), so its
                controls hang off the METHOD, not off an item. Book examples
                180-208 are triad-pair studies; his own variation is not in the
                book at all. */}
            {isTriadPairs(r.method_id) && (
              <>
                <select className={sel} value={r.triad_interval ?? ""}
                  title="Interval between the two triads"
                  onChange={(e) => void patch(r.id, { triad_interval: e.target.value || null })}>
                  <option value="">triad int…</option>
                  {TRIAD_INTERVALS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
                <select className={sel} value={r.triad_qualities ?? ""}
                  title="Quality of each triad — uppercase major, lowercase minor"
                  onChange={(e) => void patch(r.id, { triad_qualities: e.target.value || null })}>
                  <option value="">M/m…</option>
                  {TRIAD_QUALITIES.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </>
            )}

            {isCA(r.method_id) && caItems.length > 0 && (
              <select className={sel} value={r.pattern_item_id ?? ""}
                title="Which arrangement — the number is the whole identification"
                onChange={(e) => void patch(r.id, { pattern_item_id: e.target.value || null })}>
                <option value="">which CA…</option>
                {caItems.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
              </select>
            )}

            {/* Combinations: two different kinds of material, one per hand.
                The left hand uses the same control every section has. */}
            {isCombination && allItems.length > 0 && (
              <select className={sel} value={r.rh_item_id ?? ""}
                title="Right hand"
                onChange={(e) => void patch(r.id, { rh_item_id: e.target.value || null })}>
                <option value="">RH…</option>
                {allItems.map((i) => (
                  <option key={i.id} value={i.id}>{i.title} ({i.kind})</option>
                ))}
              </select>
            )}

            {isTriadPairs(r.method_id) && triadItems.length > 0 && (
              <select className={sel} value={r.pattern_item_id ?? ""}
                title="A specific variation, alongside whatever book range you worked"
                onChange={(e) => void patch(r.id, { pattern_item_id: e.target.value || null })}>
                <option value="">book only…</option>
                {triadItems.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
              </select>
            )}

            {isRange && !isTriadPairs(r.method_id) ? (
              // Range in, no BPM — those tempos live pencilled in his book.
              <span className="inline-flex items-center gap-1">
                <input type="number" inputMode="numeric" placeholder="from"
                  className={`${sel} w-16`} value={r.range_from ?? ""}
                  onChange={(e) => void patchRange(r, { range_from: e.target.value ? Number(e.target.value) : null })} />
                <span className="text-[10px] text-muted-foreground">–</span>
                <input type="number" inputMode="numeric" placeholder="to"
                  className={`${sel} w-16`} value={r.range_to ?? ""}
                  onChange={(e) => void patchRange(r, { range_to: e.target.value ? Number(e.target.value) : null })} />
              </span>
            ) : (
              <>
                {isRange && isTriadPairs(r.method_id) && (
                  <span className="inline-flex items-center gap-1">
                    <input type="number" inputMode="numeric" placeholder="from"
                      className={`${sel} w-16`} value={r.range_from ?? ""}
                      onChange={(e) => void patchRange(r, { range_from: e.target.value ? Number(e.target.value) : null })} />
                    <span className="text-[10px] text-muted-foreground">–</span>
                    <input type="number" inputMode="numeric" placeholder="to"
                      className={`${sel} w-16`} value={r.range_to ?? ""}
                      onChange={(e) => void patchRange(r, { range_to: e.target.value ? Number(e.target.value) : null })} />
                  </span>
                )}
                <select
                  className={sel}
                  value={r.bpm ?? ""}
                  onChange={(e) => void patch(r.id, { bpm: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">bpm…</option>
                  {BPMS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </>
            )}

            {/* Left hand, every section. "Same as right hand" leads because
                that's the most common case on patterns, lines, transcriptions
                and scale work. */}
            <LeftHandSelect
              row={r}
              styles={lhStyles}
              items={lhItems}
              onChange={(p) => void patch(r.id, p)}
            />

            {/* Key chips — tap the centres worked this rep. No fixed count on
                purpose (Josh: depends on time and how fast the exercise goes). */}
            <span className="inline-flex items-center gap-0.5 flex-wrap">
              {KEYS.map((k) => {
                const on = (r.keys_worked ?? []).includes(k);
                return (
                  <button key={k} type="button"
                    onClick={() => {
                      const cur = r.keys_worked ?? [];
                      void patch(r.id, { keys_worked: on ? cur.filter((x) => x !== k) : [...cur, k] });
                    }}
                    className={`px-1 py-0.5 rounded text-[9px] border ${on ? "border-primary bg-primary/15 text-primary" : "border-border/60 text-muted-foreground/60 hover:text-muted-foreground"}`}>
                    {k}
                  </button>
                );
              })}
            </span>

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
