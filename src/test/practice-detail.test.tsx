import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { makeMockDb } from "./mockSupabase";

// Bug class: feature-never-renders typo (8/3 audit). The structured
// practice-detail row was gated on a NONEXISTENT seg.id, so the whole feature
// silently rendered nothing. Two nets here:
//   1. detailSegmentId — the extracted guard is pure and typed against
//      RuntimeSegment, so a bad property is a compile error and a logic drift
//      fails below.
//   2. An actual render of PracticeDetailRow — the path the guard gates must
//      produce visible content when the data says it should.

const h = vi.hoisted(() => ({
  mock: undefined as unknown as ReturnType<typeof import("./mockSupabase").makeMockDb>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  // Lazy delegation: h.mock is (re)built in beforeEach, after this factory runs.
  supabase: { from: (t: string) => h.mock.client.from(t) },
}));

import PracticeDetailRow from "@/components/practice/PracticeDetailRow";
import { detailSegmentId } from "@/components/dashboard/PracticeTimerWidget";

describe("detailSegmentId (the seg.id guard)", () => {
  it("returns the DB key for an active persisted segment", () => {
    expect(detailSegmentId({ key: "3f9a-real-uuid", what_practiced: "" }, true)).toBe("3f9a-real-uuid");
  });

  it("returns the key for an inactive segment that has logged content", () => {
    expect(detailSegmentId({ key: "3f9a-real-uuid", what_practiced: "Barry Harris drop 2" }, false)).toBe("3f9a-real-uuid");
  });

  it("returns null for unpersisted tmp- segments (nothing to write against)", () => {
    expect(detailSegmentId({ key: "tmp-1712000000", what_practiced: "stuff" }, true)).toBeNull();
  });

  it("returns null for inactive segments with nothing logged", () => {
    expect(detailSegmentId({ key: "3f9a-real-uuid", what_practiced: "" }, false)).toBeNull();
  });
});

describe("PracticeDetailRow (the gated path actually renders)", () => {
  beforeEach(() => {
    h.mock = makeMockDb({
      practice_taxonomy: [
        {
          id: "m1", dimension: "method", parent_id: null, value: "barry_harris",
          label: "Barry Harris", applies_to: ["Chords"], dim2: "quality",
          dim3: "voicing", sort_order: 1, active: true,
        },
        {
          id: "q1", dimension: "quality", parent_id: "m1", value: "maj",
          label: "major", applies_to: ["Chords"], dim2: null, dim3: null,
          sort_order: 1, active: true,
        },
      ],
      practice_segment_details: [
        {
          id: "d1", segment_id: "seg-db-1", method_id: "m1", dim2_id: null,
          dim3_id: null, bpm: 35, range_from: null, range_to: null,
          maintenance: false, keys_worked: [], lh_id: null, lh_item_id: null,
          triad_interval: null, triad_qualities: null, pattern_item_id: null,
          rh_item_id: null, sort_order: 0,
        },
      ],
      practice_items: [],
      v_practice_history: [],
    });
  });

  it("renders the seeded method and the add-row control for a method section", async () => {
    render(<PracticeDetailRow segmentId="seg-db-1" category="Chords" />);
    // With the old seg.id guard this component was never mounted at all —
    // asserting real content is the regression net.
    expect(await screen.findByText("Barry Harris")).toBeInTheDocument();
    expect(screen.getByText("add another")).toBeInTheDocument();
  });
});
