import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { makeMockDb, type RecordedWrite } from "./mockSupabase";

// Consent-record stamping (TCPA/CTIA pass, 8/4). CTIA 5.1.2 wants a record of
// what was SHOWN, not just consent=true — so every fan_signups insert must
// carry the verbatim disclosure copy, and that stored copy must actually be a
// verbatim subset of what the fan sees on the lander. The public copy itself
// is Josh's call (lawyer pass pending) — these tests pin the STAMPING, and if
// the copy is ever edited they keep stamp and display from drifting apart.

const h = vi.hoisted(() => ({
  mock: undefined as unknown as ReturnType<typeof import("./mockSupabase").makeMockDb>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: string) => h.mock.client.from(t) },
}));
vi.mock("@/lib/smartlink", () => ({
  platformMeta: vi.fn(() => ({ label: "Spotify", color: "#1DB954" })),
  logSmartLinkEvent: vi.fn(),
  initMetaPixel: vi.fn(),
  pixelTrack: vi.fn(),
}));

import { FanSignup, consentText } from "@/pages/SmartLink";

const ARTIST = "Joshua J Miller";
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

describe("fan signup consent stamping", () => {
  beforeEach(() => {
    h.mock = makeMockDb({ fan_signups: [] });
  });

  it("shows the fan the exact copy that gets stored (verbatim subset)", () => {
    const { container } = render(<FanSignup slug="test-release" accent="#ffffff" artist={ARTIST} />);
    expect(squash(container.textContent ?? "")).toContain(squash(consentText(ARTIST)));
  });

  it("stamps consent_text with the exact disclosure copy on every signup insert", async () => {
    render(<FanSignup slug="test-release" accent="#ffffff" artist={ARTIST} />);
    fireEvent.change(screen.getByPlaceholderText("Your number"), {
      target: { value: "410-555-1212" },
    });
    fireEvent.click(screen.getByLabelText("Sign up"));

    await waitFor(() => {
      expect(h.mock.calls.some((c: RecordedWrite) => c.table === "fan_signups" && c.op === "insert")).toBe(true);
    });
    const insert = h.mock.calls.find(
      (c: RecordedWrite) => c.table === "fan_signups" && c.op === "insert",
    ) as RecordedWrite;
    const payload = insert.payload as Record<string, unknown>;
    expect(payload.consent_text).toBe(consentText(ARTIST));
    expect(payload.contact_norm).toBe("4105551212");
    expect(payload.contact_type).toBe("phone");
  });
});
