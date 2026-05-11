// Layer 3 — cheap shape classifier.
// Examines filename + first ~200 chars + a quick whole-doc signal scan and
// returns the most likely shape with a confidence score. Routes to Parser A/B/C/D
// or falls through to Shape W (LLM extraction, Cut 3).

import type { Shape } from "./canonical-event-types.ts";

export type DetectInput = {
  filename?: string;
  text: string;
  // sheet-typed inputs (Shape D candidate) come in pre-flagged from the ingestion route
  source_type?: string;
};

export type DetectResult = {
  shape: Shape;
  confidence: number;
  signals: string[];
};

const SHAPE_B_TITLE_PATTERNS = [
  /dj\s+wedding\s+planner/i,
  /wedding\s+planner/i,
];

const SHAPE_C_TITLE_PATTERNS = [
  /run\s+of\s+show\s+template/i,
  /wedding\s+ceremony\s+(planner|template)/i,
  /ceremony\s+run\s+of\s+show/i,
];

const SHAPE_A_HEADER_PATTERNS = [
  /^BASIC\s+DETAILS/im,
  /^PERSONNEL/im,
  /^TIMELINE/im,
  /FULL\s+BAND/i,
  /^LOAD-?IN/im,
];

const SHAPE_B_LABEL_PATTERNS = [
  /^Spouse\s+#?1\s+Name:/im,
  /^Spouse\s+#?2\s+Name:/im,
  /^Wedding\s+Date:/im,
  /^Venue\s+Name:/im,
  /^DJ\s+Attire\s+Preference:/im,
];

const SHAPE_C_SECTION_PATTERNS = [
  /^#{0,3}\s*\**\s*1\.\s+Prelude/im,
  /^#{0,3}\s*\**\s*2\.\s+Processional/im,
  /^#{0,3}\s*\**\s*3\.\s+Recessional/im,
  /^#{0,3}\s*\**\s*4\.\s+Postlude/im,
];

const SHAPE_D_TELLS = [
  /Personell:?\s*\|/i, // canonical typo
  /\bSetlist\b/i,
  /\bBPM\b.*\bKey\b/i,
];

export function detectShape(input: DetectInput): DetectResult {
  const text = (input.text || "").slice(0, 4000);
  const head = text.slice(0, 200);
  const filename = (input.filename || "").toLowerCase();
  const signals: string[] = [];

  // Spreadsheet ingestion → strong Shape D prior unless it doesn't quack like one.
  if (input.source_type === "drive-sheet") {
    let dHits = 0;
    for (const pat of SHAPE_D_TELLS) {
      if (pat.test(text)) {
        dHits++;
        signals.push(`D-tell:${pat.source}`);
      }
    }
    if (dHits > 0 || /\bvenue:\s*\|/i.test(text)) {
      return { shape: "D", confidence: Math.min(0.6 + 0.15 * dHits, 0.95), signals };
    }
  }

  // Shape B — DJ Wedding Planner Q&A. Title + label density.
  const titleIsB = SHAPE_B_TITLE_PATTERNS.some((p) => p.test(head)) ||
    /dj\s+wedding\s+planner/i.test(filename);
  let bLabelHits = 0;
  for (const pat of SHAPE_B_LABEL_PATTERNS) {
    if (pat.test(text)) {
      bLabelHits++;
      signals.push(`B-label:${pat.source}`);
    }
  }
  if (titleIsB && bLabelHits >= 2) {
    return { shape: "B", confidence: Math.min(0.85 + 0.03 * bLabelHits, 0.99), signals };
  }
  if (bLabelHits >= 4) {
    // Title missing but >=4 label tells — still confident enough to route to Parser B.
    return { shape: "B", confidence: 0.8, signals };
  }

  // Shape C — Ceremony Run of Show Template. Numbered sections 1-4.
  const titleIsC = SHAPE_C_TITLE_PATTERNS.some((p) => p.test(head));
  let cSectionHits = 0;
  for (const pat of SHAPE_C_SECTION_PATTERNS) {
    if (pat.test(text)) {
      cSectionHits++;
      signals.push(`C-section:${pat.source}`);
    }
  }
  if (titleIsC && cSectionHits >= 2) {
    return { shape: "C", confidence: Math.min(0.85 + 0.04 * cSectionHits, 0.99), signals };
  }
  if (cSectionHits >= 3) {
    return { shape: "C", confidence: 0.8, signals };
  }

  // Shape A — TSB Narrative ROS. Pipe-delimited header + ALL-CAPS section markers.
  let aHits = 0;
  for (const pat of SHAPE_A_HEADER_PATTERNS) {
    if (pat.test(text)) {
      aHits++;
      signals.push(`A-marker:${pat.source}`);
    }
  }
  const hasPipeHeader = /\|.*(couple|location):/i.test(head);
  if (hasPipeHeader) {
    aHits++;
    signals.push("A-pipe-header");
  }
  if (aHits >= 2) {
    return { shape: "A", confidence: Math.min(0.7 + 0.08 * aHits, 0.95), signals };
  }

  // Shape D fallback — multi-block table-like input even without source_type hint.
  let dHits = 0;
  for (const pat of SHAPE_D_TELLS) {
    if (pat.test(text)) {
      dHits++;
      signals.push(`D-fallback:${pat.source}`);
    }
  }
  if (dHits >= 2) {
    return { shape: "D", confidence: 0.6 + 0.1 * dHits, signals };
  }

  // Nothing matched confidently — Shape W (wild). LLM extraction takes over in Cut 3.
  return { shape: "W", confidence: 0.3, signals: ["no-shape-match"] };
}
