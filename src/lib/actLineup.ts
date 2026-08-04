// Act lineup join — the slug-drift fix (2026-08-04, spec-onesheet-2026-08).
//
// acts.slug is the CANONICAL join key into people.ventures. But legacy venture
// tags survive as join keys by design — JJM's acts.slug is literally its legacy
// slug 'jmj', and Economy rows were tagged 'economy' before the act row landed
// as 'the-economy'. That drift silently returned 0 of 5 Economy players until
// 8/4. History never gets renamed; instead the join accepts the slug PLUS every
// legacy tag (lowercased), and a roster act that still comes back empty is
// surfaced loudly by lineupGap rather than rendering as a quiet missing section.

export type LineupAct = {
  slug: string;
  kind: string;
  legacy_venture_tags: string[];
};

export type LineupPlayer = {
  id: string;
  name: string;
  instruments: string[];
  engagement_status: string;
};

/** Every value that counts as "this act" in a ventures[] column. */
export function lineupJoinKeys(act: Pick<LineupAct, "slug" | "legacy_venture_tags">): string[] {
  const keys = [act.slug, ...(act.legacy_venture_tags ?? []).map((t) => t.toLowerCase())];
  return [...new Set(keys.filter(Boolean))];
}

/**
 * A roster act ("own" = one of Josh's bands) with ZERO players is never real —
 * every band has at least Josh. It means the acts.slug ↔ people.ventures join
 * key drifted again, so the UI must show the failure, not an empty section.
 * Managed acts (Charles Wilson) legitimately have no lineup rows here.
 */
export function lineupGap(act: Pick<LineupAct, "kind">, playerCount: number): boolean {
  return act.kind === "own" && playerCount === 0;
}

/** Active players for an act, joined per the rules above. */
export async function fetchActLineup(
  db: { from: (t: string) => any },
  act: Pick<LineupAct, "slug" | "legacy_venture_tags">,
): Promise<{ players: LineupPlayer[]; error: string | null }> {
  const { data, error } = await db
    .from("people")
    .select("id,name,instruments,engagement_status")
    .contains("capacities", ["player"])
    .overlaps("ventures", lineupJoinKeys(act))
    .eq("active", true)
    .order("name");
  return { players: (data ?? []) as LineupPlayer[], error: error ? String(error.message ?? error) : null };
}
