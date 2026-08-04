import { describe, it, expect } from "vitest";
import { ink, fillFor, logoMaxH, orgFooterText, type OrgKey } from "@/utils/docxGenerator";

// Bug class: org-branding regression (8/3). Two real incidents pinned here:
//   1. BSE monochrome — Josh: BSE docs must be pure black and white. ink()
//      forces #000000, fillFor() drops table shading, logoMaxH() scales the
//      logo up. Only for BSE; every other org keeps its palette.
//   2. Footer drift — OrgKey fell three orgs behind the UI, so a JJM or
//      one-off run-of-show shipped with the HARBORLINE footer.

const NON_BSE: OrgKey[] = ["harborline", "tsb", "jmj", "other"];

describe("BSE monochrome branding", () => {
  it("forces pure black ink for BSE regardless of the palette color", () => {
    expect(ink("bse", "4A5568")).toBe("000000");
    expect(ink("bse", "DDDDDD")).toBe("000000");
  });

  it("drops table shading entirely for BSE", () => {
    expect(fillFor("bse", "F7FAFC")).toBeUndefined();
  });

  it("scales the BSE logo up from the template base", () => {
    expect(logoMaxH("bse", 120)).toBe(228); // 1.9x, rounded
  });

  it("leaves every other org's palette untouched", () => {
    for (const org of NON_BSE) {
      expect(ink(org, "4A5568")).toBe("4A5568");
      expect(fillFor(org, "F7FAFC")).toBe("F7FAFC");
      expect(logoMaxH(org, 120)).toBe(120);
    }
  });
});

describe("per-org doc footer (the OrgKey drift)", () => {
  it("pins every selectable org's footer independently", () => {
    expect(orgFooterText("harborline")).toBe("HARBORLINE · Baltimore's Go-To Live Band · harborlineband.com");
    expect(orgFooterText("bse")).toBe("BALTIMORE SOUND ENTERTAINMENT · baltimoresound.net");
    expect(orgFooterText("tsb")).toBe("TOM STARR BAND · tomstarrband.com");
    expect(orgFooterText("jmj")).toBe("JOSHUA J MILLER");
    // One-off ensembles get NO footer rather than someone else's brand.
    expect(orgFooterText("other")).toBe("");
  });

  it("never leaks the Harborline footer onto a non-Harborline org", () => {
    for (const org of ["bse", "tsb", "jmj", "other"] as OrgKey[]) {
      expect(orgFooterText(org)).not.toContain("HARBORLINE");
    }
  });
});
