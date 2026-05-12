// Parser B — BSE DJ Wedding Planner Q&A (taxonomy Shape B, Docs 2/5/10/11/12).
//
// The doc is a stack of "Label: value" pairs in known sections (General Info,
// Ceremony Info, Reception Highlights, Bridal Party Introductions, Music
// Requests, Line Dances & Novelty Music, TIMELINE, Other Information).
//
// Round-trip detection (per taxonomy v2 Cut 2 spec): if every label has an
// empty value, this is the blank-starter template (Doc ID
// 1Lb9-jP1CUxkZx7A5KQnXeq9UrjCvkwCor3m7FOG7Ri0) — flag canonical row as
// `is_blank_starter` so the renderer knows not to render against it.
//
// All labels here come from the blank template (read 2026-05-10).

import type {
  CanonicalEventFields,
  ParseResult,
  PersonnelEntry,
  SongSectionField,
} from "./canonical-event-types.ts";

// Two-spouse semantics structured (Q4 rec)
type ShapeBValues = Record<string, string>;

const LINE_DANCE_LABELS = [
  "electric slide","cha cha slide","cupid shuffle","ymca","wobble","shout","sweet caroline",
];

const SECTION_HEADER_PATTERNS = [
  /^\**General\s+Information\**/i,
  /^\**Ceremony\s+Information\**/i,
  /^\**Reception\s+Highlights\**/i,
  /^\**Bridal\s+Party\s+Introductions\**/i,
  /^\**Music\s+Requests\**/i,
  /^\**Line\s+Dances\s*&?\s*Novelty\s+Music\**/i,
  /^\**TIMELINE\**/i,
  /^\**Other\s+Information\**/i,
  /^\**Social\s+Media\s+Tags\s+for\s+Vendors\**/i,
  /^\**Vendor\s+Tags\**/i,
];

function normalizeLabel(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[#\*]/g, "")
    .replace(/\\/g, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[:?]+$/, "")
    .trim();
}

function extractLabelValuePairs(text: string): ShapeBValues {
  const out: ShapeBValues = {};
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (SECTION_HEADER_PATTERNS.some((p) => p.test(line))) continue;
    if (/^[-=_\\]+$/.test(line)) continue;

    // "Label: value" — value can be on the same line OR on the next line
    const m = line.match(/^([^:]{2,80}):\s*(.*)$/);
    if (!m) continue;
    const label = normalizeLabel(m[1]);
    let value = m[2].trim();

    // Free-text follow-on lines (used for Music Requests / Other Info)
    let j = i + 1;
    while (
      j < lines.length &&
      lines[j].trim() &&
      !lines[j].trim().match(/^[^:]{2,80}:/) &&
      !SECTION_HEADER_PATTERNS.some((p) => p.test(lines[j].trim()))
    ) {
      value += (value ? " " : "") + lines[j].trim();
      j++;
    }
    i = j - 1;

    if (label) out[label] = value;
  }
  return out;
}

function parseYesNoMaybe(v: string): "yes" | "no" | "maybe" | null {
  const t = v.toLowerCase().trim();
  if (!t) return null;
  if (/^yes/.test(t)) return "yes";
  if (/^no/.test(t)) return "no";
  if (/^maybe/.test(t)) return "maybe";
  return null;
}

function toIntOrUndef(v: string): number | undefined {
  const m = v.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : undefined;
}

export function parseShapeB(text: string, sourceFilename?: string): ParseResult {
  const warnings: string[] = [];
  const values = extractLabelValuePairs(text);
  const labelKeys = Object.keys(values);
  const filledCount = labelKeys.filter((k) => values[k] && values[k].length > 0).length;

  const fields: CanonicalEventFields = {
    client: {},
    venue: {},
    contact: {},
    guests: {},
    logistics: {},
    personnel: [],
    vendors: [],
    timeline: [],
    song_sections: [],
    preferences: {},
  };

  const grab = (key: string): string | undefined => values[key] || undefined;

  // ── General Information ─────────────────────────────────────────────
  const spouse1 = grab("spouse 1 name") || grab("spouse #1 name");
  const spouse2 = grab("spouse 2 name") || grab("spouse #2 name");
  const title1 = grab("spouse 1 preferred title (bride, groom, partner, etc)") ||
    grab("spouse #1 preferred title") ||
    grab("spouse 1 preferred title");
  const title2 = grab("spouse 2 preferred title (bride, groom, partner, etc)") ||
    grab("spouse #2 preferred title") ||
    grab("spouse 2 preferred title");

  if (spouse1) fields.client!.primary = spouse1;
  if (spouse2) fields.client!.secondary = spouse2;
  const titles: string[] = [];
  if (title1) titles.push(title1);
  if (title2) titles.push(title2);
  if (titles.length) fields.client!.titles = titles;

  const phone = grab("primary contact phone");
  const email = grab("email");
  if (phone) fields.contact!.phone = phone;
  if (email) fields.contact!.email = email;

  const weddingDate = grab("wedding date");
  if (weddingDate) fields.event_date = weddingDate;

  const venueName = grab("venue name");
  if (venueName) {
    fields.venue!.name = venueName;
    fields.venue_name = venueName;
  }
  const venueAddress = grab("venue address");
  if (venueAddress) fields.venue!.address = venueAddress;
  const indoorOutdoor = grab("indoor/outdoor") || grab("indoor / outdoor");
  if (indoorOutdoor) {
    const v = indoorOutdoor.toLowerCase();
    if (v.includes("both")) fields.venue!.type = "both";
    else if (v.includes("outdoor")) fields.venue!.type = "outdoor";
    else if (v.includes("indoor")) fields.venue!.type = "indoor";
  }

  const guestCount = grab("number of guests");
  if (guestCount) fields.guests!.count = toIntOrUndef(guestCount);
  const guestArrival = grab("guest arrival time");
  if (guestArrival) fields.guests!.arrival_time = guestArrival;
  const partyArrival = grab("wedding party arrival time");
  if (partyArrival) fields.guests!.party_arrival_time = partyArrival;

  const poc = grab("day-of point of contact") || grab("day of point of contact");
  if (poc) fields.personnel!.push({ role: "Day-of Point of Contact", name: poc });
  const photographer = grab("photographer");
  if (photographer) fields.vendors!.push({ company: photographer, type: "photographer" });
  const videographer = grab("videographer");
  if (videographer) fields.vendors!.push({ company: videographer, type: "videographer" });
  const contentCreator = grab("content creator");
  if (contentCreator) fields.vendors!.push({ company: contentCreator, type: "content-creator" });

  const djAttire = grab("dj attire preference");
  if (djAttire) fields.attire = djAttire;
  const meal = grab("will the dj be provided a meal");
  if (meal) fields.logistics!.musician_meals = meal;

  // ── Ceremony Information ─────────────────────────────────────────────
  const ceremonySongs: { title: string }[] = [];
  for (const k of [
    "wedding party #1 processional song",
    "wedding party 1 processional song",
    "wedding party #2 processional song",
    "wedding party 2 processional song",
    "spouse processional song",
    "recessional song",
  ]) {
    const song = grab(k);
    if (song) ceremonySongs.push({ title: song });
  }
  if (ceremonySongs.length > 0) {
    fields.song_sections!.push({ title: "Ceremony", songs: ceremonySongs });
  }
  const preludeType = grab("prelude music type");
  if (preludeType) {
    fields.song_sections!.push({ title: "Prelude", vibe: preludeType, songs: [] });
  }

  // ── Reception Highlights — dance + cake + bouquet songs ─────────────
  const reception: { title: string }[] = [];
  for (const k of [
    "first dance song",
    "parent dance #1 song",
    "parent dance 1 song",
    "parent dance #2 song",
    "parent dance 2 song",
    "cake cutting song",
    "bouquet song",
    "last dance song",
    "introduction music",
  ]) {
    const v = grab(k);
    if (v) reception.push({ title: v });
  }
  if (reception.length > 0) {
    fields.song_sections!.push({ title: "Reception Highlights", songs: reception });
  }

  const dinnerStyle = grab("dinner style (buffet/seated)");
  if (dinnerStyle) {
    fields.preferences!.style_notes = (fields.preferences!.style_notes ? fields.preferences!.style_notes + " " : "") +
      `Dinner: ${dinnerStyle}`;
  }
  const cocktailType = grab("cocktail music type");
  if (cocktailType) {
    fields.song_sections!.push({ title: "Cocktail Hour", vibe: cocktailType, songs: [] });
  }
  const dinnerType = grab("dinner music type");
  if (dinnerType) {
    fields.song_sections!.push({ title: "Dinner", vibe: dinnerType, songs: [] });
  }

  // ── Music Requests ──────────────────────────────────────────────────
  const tastes = grab("tell us about your musical tastes(favorite artists, songs, dances)") ||
    grab("tell us about your musical tastes");
  if (tastes) fields.preferences!.style_notes = (fields.preferences!.style_notes || "") + " " + tastes;
  const mustPlay = grab("are there any songs that you feel must be played at your wedding");
  if (mustPlay) {
    fields.preferences!.must_play = mustPlay
      .split(/[\n;,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const dontLike = grab("equally as important, tell us briefly about what music you don't like") ||
    grab("equally as important, tell us briefly about what music you dont like");
  if (dontLike) {
    fields.preferences!.do_not_play = dontLike
      .split(/[\n;,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // ── Line Dances ─────────────────────────────────────────────────────
  const lineDances: Record<string, "yes" | "no" | "maybe"> = {};
  for (const label of LINE_DANCE_LABELS) {
    const v = grab(label);
    const decision = v ? parseYesNoMaybe(v) : null;
    if (decision) lineDances[label] = decision;
  }
  if (Object.keys(lineDances).length > 0) fields.preferences!.line_dances = lineDances;

  // ── Bridal Party Introductions → personnel-ish ──────────────────────
  for (let n = 1; n <= 10; n++) {
    const v = grab(`wedding party duo (${n})`);
    if (v) fields.personnel!.push({ role: `Wedding Party Duo ${n}`, name: v });
  }
  const moh = grab("maid/matron of honor & best man") ||
    grab("maid/matron of honor and best man");
  if (moh) fields.personnel!.push({ role: "MOH & Best Man", name: moh });
  const newlyweds = grab("newlyweds");
  if (newlyweds) fields.personnel!.push({ role: "Newlyweds Announcement", name: newlyweds });

  // ── Set fields.name if we have couple ────────────────────────────────
  if (!fields.name) {
    if (spouse1 && spouse2) fields.name = `${spouse1} & ${spouse2} Wedding`;
    else if (spouse1) fields.name = `${spouse1} Wedding`;
    else if (sourceFilename) fields.name = sourceFilename.replace(/\.[^.]+$/, "");
  }

  // Blank-starter detection — every captured label had an empty value
  const isBlankStarter = labelKeys.length > 0 && filledCount === 0;
  if (isBlankStarter) {
    warnings.push("Shape B blank starter detected — zero client signal across all known labels");
  }

  let confidence = 0.6;
  if (filledCount >= 5) confidence += 0.15;
  if (filledCount >= 15) confidence += 0.1;
  if (fields.client?.primary) confidence += 0.05;
  if (fields.event_date) confidence += 0.05;

  return {
    shape: "B",
    fields,
    is_blank_starter: isBlankStarter,
    confidence: Math.min(confidence, 0.99),
    warnings,
  };
}
