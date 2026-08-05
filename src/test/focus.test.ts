import { describe, expect, it } from "vitest";
import {
  FOCUS_WIP_CAP,
  POMODORO,
  ageDays,
  cheer,
  formatClock,
  heatTier,
  pickNextFocus,
  sortByFocusPriority,
} from "@/lib/focus";

const NOW = Date.parse("2026-08-05T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe("ageDays", () => {
  it("counts whole days since a timestamp", () => {
    expect(ageDays(daysAgo(0), NOW)).toBe(0);
    expect(ageDays(daysAgo(3), NOW)).toBe(3);
    expect(ageDays(daysAgo(21), NOW)).toBe(21);
  });

  it("never goes negative for a future timestamp", () => {
    expect(ageDays(new Date(NOW + 86_400_000).toISOString(), NOW)).toBe(0);
  });

  it("treats an unparseable timestamp as brand new", () => {
    expect(ageDays("not a date", NOW)).toBe(0);
  });
});

describe("heatTier", () => {
  it("warms up as a card sits", () => {
    expect(heatTier(0)).toBe("fresh");
    expect(heatTier(2)).toBe("fresh");
    expect(heatTier(3)).toBe("warm");
    expect(heatTier(6)).toBe("warm");
    expect(heatTier(7)).toBe("hot");
    expect(heatTier(13)).toBe("hot");
    expect(heatTier(14)).toBe("stale");
    expect(heatTier(90)).toBe("stale");
  });
});

describe("pickNextFocus", () => {
  it("returns null on an empty queue", () => {
    expect(pickNextFocus([])).toBeNull();
  });

  it("puts dated work ahead of undated work", () => {
    const rows = [
      { id: "undated", due_date: null, created_at: daysAgo(30) },
      { id: "dated", due_date: "2026-09-01", created_at: daysAgo(1) },
    ];
    expect(pickNextFocus(rows)?.id).toBe("dated");
  });

  it("takes the soonest due date, so overdue floats to the top", () => {
    const rows = [
      { id: "later", due_date: "2026-09-01", created_at: daysAgo(1) },
      { id: "overdue", due_date: "2026-08-01", created_at: daysAgo(1) },
      { id: "soon", due_date: "2026-08-06", created_at: daysAgo(1) },
    ];
    expect(sortByFocusPriority(rows).map((r) => r.id)).toEqual(["overdue", "soon", "later"]);
  });

  it("breaks undated ties by age, oldest first", () => {
    const rows = [
      { id: "new", due_date: null, created_at: daysAgo(1) },
      { id: "old", due_date: null, created_at: daysAgo(40) },
    ];
    expect(pickNextFocus(rows)?.id).toBe("old");
  });

  it("does not mutate the input array", () => {
    const rows = [
      { id: "b", due_date: "2026-09-01", created_at: daysAgo(1) },
      { id: "a", due_date: "2026-08-01", created_at: daysAgo(1) },
    ];
    sortByFocusPriority(rows);
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("formatClock", () => {
  it("renders mm:ss with a padded seconds field", () => {
    expect(formatClock(POMODORO.work)).toBe("25:00");
    expect(formatClock(POMODORO.break)).toBe("5:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(9)).toBe("0:09");
  });

  it("floors at zero rather than showing a negative clock", () => {
    expect(formatClock(-30)).toBe("0:00");
  });
});

describe("cheer", () => {
  it("always returns a line, and cycles rather than running out", () => {
    for (const n of [0, 1, 5, 12, 999]) {
      expect(cheer(n).length).toBeGreaterThan(0);
    }
  });
});

describe("FOCUS_WIP_CAP", () => {
  it("is the soft cap of 5 Josh approved", () => {
    expect(FOCUS_WIP_CAP).toBe(5);
  });
});
