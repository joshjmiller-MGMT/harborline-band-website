import { describe, it, expect } from "vitest";
import { lineupJoinKeys, lineupGap, fetchActLineup } from "@/lib/actLineup";
import { makeMockDb } from "./mockSupabase";

// Bug class: silent feature-never-renders, join-key edition (8/4). The Economy
// lineup rendered 0 of 5 players because people.ventures said 'economy' while
// acts.slug said 'the-economy'. The fix joins on slug + lowercased legacy tags
// (history never gets renamed — JJM's legacy 'jmj' IS its join key by design),
// and lineupGap turns an empty roster-act lineup into a loud warning instead
// of an empty section.

describe("lineupJoinKeys", () => {
  it("accepts the slug plus every legacy tag, lowercased (the Economy drift)", () => {
    expect(lineupJoinKeys({ slug: "the-economy", legacy_venture_tags: ["Economy", "the-economy"] }))
      .toEqual(["the-economy", "economy"]);
  });

  it("mirrors the JJM pattern — legacy slugs survive as join keys", () => {
    expect(lineupJoinKeys({ slug: "jmj", legacy_venture_tags: ["JMJ", "solo", "JJM"] }))
      .toEqual(["jmj", "solo", "jjm"]);
  });

  it("handles missing legacy tags without exploding", () => {
    expect(lineupJoinKeys({ slug: "harborline", legacy_venture_tags: undefined as unknown as string[] }))
      .toEqual(["harborline"]);
  });
});

describe("lineupGap (the loud-failure guard)", () => {
  it("flags a roster act with zero players — every band has at least Josh", () => {
    expect(lineupGap({ kind: "own" }, 0)).toBe(true);
  });

  it("does not flag managed acts — their players are their own", () => {
    expect(lineupGap({ kind: "managed" }, 0)).toBe(false);
  });

  it("does not flag a roster act whose join works", () => {
    expect(lineupGap({ kind: "own" }, 5)).toBe(false);
  });
});

describe("fetchActLineup", () => {
  it("returns the joined players with no error", async () => {
    const mock = makeMockDb({
      people: [
        { id: "1", name: "Colin Sidley", instruments: ["bass", "vocals"], engagement_status: "active" },
        { id: "2", name: "Ian Hoke", instruments: ["keys", "vocals"], engagement_status: "active" },
        { id: "3", name: "Jon Miller", instruments: [], engagement_status: "active" },
        { id: "4", name: "Josh Miller", instruments: ["keys", "bandleader"], engagement_status: "active" },
        { id: "5", name: "Sean Sidley", instruments: ["drums"], engagement_status: "active" },
      ],
    });
    const { players, error } = await fetchActLineup(mock.client, {
      slug: "the-economy",
      legacy_venture_tags: ["Economy", "the-economy"],
    });
    expect(error).toBeNull();
    expect(players).toHaveLength(5);
    expect(players.map((p) => p.name)).toContain("Josh Miller");
  });
});
