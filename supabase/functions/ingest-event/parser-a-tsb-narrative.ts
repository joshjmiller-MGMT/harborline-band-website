// Parser A — TSB Narrative ROS (taxonomy Shape A, Doc 1).
//
// Targets dense free-text ROS docs written by Josh / TSB project lead:
//   - Pipe-delimited header (date | Couple: ... | Location: ...)
//   - PERSONNEL / ROLES block (FULL BAND – Drums - Name | Bass - Name ...)
//   - LOAD-IN / PARKING block
//   - TIMELINE block (time → description rows)
//   - Time-block sections (INTROS, FIRST DANCES, BAND SET 1/2/3/4, CEREMONY, COCKTAIL HOUR SET)
//   - Bare uppercase song lines with optional (key) and trailing singer code
//
// This is a streamlined re-implementation of the relevant slice of
// parseTextToEvent in generate-run-of-show/index.ts, targeting canonical
// jsonb fields directly (not the legacy flat-details shape).

import type {
  CanonicalEventFields,
  ParseResult,
  PersonnelEntry,
  SongEntry,
  SongSectionField,
  TimelineEntry,
} from "./canonical-event-types.ts";

const SECTION_HEADER_PATTERNS = [
  /^(INTROS?)\s*(?:\(([^)]+)\))?\s*$/i,
  /^(FIRST\s+DANCES?)\s*$/i,
  /^(BAND\s+SET\s+\d)\s*$/i,
  /^(CEREMONY)(?:\s*\(([^)]+)\))?\s*$/i,
  /^(COCKTAIL\s+HOUR(?:\s+SET)?)/i,
  /^(RECESSIONAL)\s*$/i,
  /^(PRELUDES?)\s*$/i,
  /^(PROCESSIONALS?)\s*$/i,
  /^(POSTLUDE)\s*$/i,
  /^(BRIDAL\s+PROCESSIONAL)/i,
  /^(MAIN\s+PROCESSIONAL)/i,
];

const PERSONNEL_PREFIXES = [
  /^FULL\s+BAND/i,
  /^BAND\s*[-–]/i,
  /^PERSONNEL/i,
  /^DUO/i,
  /^TRIO/i,
  /^QUARTET/i,
];

// "Drums - Name", "Bass - Name", etc., as pipe-separated tokens
const INSTRUMENT_HINTS = [
  "drums","bass","keys","piano","guitar","vocals","vox","sax","horn","trumpet",
  "trombone","violin","viola","cello","percussion","perc","aux","tracks",
];

const ROLE_LINE_PATTERNS = [
  // Single roles inline on multi-role lines: "MC – Name", "SOUND – Name", "LIGHTS – Name"
  { role: "MC", pattern: /\bMC\s*[-–]\s*([^|]+?)(?=\s*(?:\||$))/i },
  { role: "Sound", pattern: /\bSOUND\s*[-–]\s*([^|]+?)(?=\s*(?:\||$))/i },
  { role: "Lights", pattern: /\bLIGHTS\s*[-–]\s*([^|]+?)(?=\s*(?:\||$))/i },
  { role: "Officiant", pattern: /\bOfficiant\s*[-–]\s*([^|]+?)(?=\s*(?:\||$))/i },
  { role: "Day-Of Planner", pattern: /\bDay[-\s]?Of\s+Planner\s*[-–]\s*([^|]+?)(?=\s*(?:\||$))/i },
];

const SINGER_CODES = new Set([
  "TOM","ANG","JACK","ANGELA","TOM/ANG","ANG/TOM",
]);

function parsePipeHeader(line: string): {
  date?: string;
  client_primary?: string;
  client_secondary?: string;
  venue_name?: string;
  attire?: string;
  venue_address?: string;
} {
  const out: ReturnType<typeof parsePipeHeader> = {};
  // The header line typically contains `<DATE> | Couple: <names> | Location: <name> | <N>-Piece Band | <ATTIRE> | ADDRESS: <addr>`
  const parts = line.split("|").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    const dateLike = part.match(/^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/);
    if (dateLike && !out.date) {
      out.date = dateLike[1];
      continue;
    }
    const coupleMatch = part.match(/^Couple:\s*(.+)$/i);
    if (coupleMatch) {
      const [primary, secondary] = coupleMatch[1].split(/\s*&\s*|\s+and\s+/i).map((s) => s.trim());
      out.client_primary = primary;
      if (secondary) out.client_secondary = secondary;
      continue;
    }
    const locMatch = part.match(/^Location:\s*(.+)$/i);
    if (locMatch) {
      out.venue_name = locMatch[1].trim();
      continue;
    }
    const addrMatch = part.match(/^ADDRESS:\s*(.+)$/i);
    if (addrMatch) {
      out.venue_address = addrMatch[1].trim();
      continue;
    }
    if (/black\s+tie|formal|cocktail|casual/i.test(part)) {
      out.attire = part;
    }
  }
  return out;
}

function parsePersonnelLine(line: string): PersonnelEntry[] {
  const out: PersonnelEntry[] = [];
  // Strip the "FULL BAND – " or similar prefix
  const body = line.replace(/^[^–-]+[–-]\s*/, "");
  for (const segment of body.split("|").map((s) => s.trim()).filter(Boolean)) {
    const m = segment.match(/^([^-–]+?)\s*[-–]\s*(.+)$/);
    if (!m) continue;
    const left = m[1].trim();
    const right = m[2].trim();
    if (INSTRUMENT_HINTS.some((h) => left.toLowerCase().includes(h))) {
      out.push({ role: left, name: right });
    }
  }
  return out;
}

function parseSongLine(line: string): SongEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (/^[\-•*]/.test(trimmed)) {
    return parseSongLine(trimmed.replace(/^[-•*]\s*/, ""));
  }
  // Format: "TITLE (KEY) SINGER" or "TITLE - ARTIST" or "Title / Artist (notes)"
  const singerMatch = trimmed.match(/\s+([A-Z][A-Z\/]+)\s*$/);
  let singer: string | undefined;
  let body = trimmed;
  if (singerMatch && SINGER_CODES.has(singerMatch[1].trim())) {
    singer = singerMatch[1].trim();
    body = trimmed.slice(0, singerMatch.index).trim();
  }
  const keyMatch = body.match(/\(([A-G][#b]?m?)\)/);
  let key: string | undefined;
  if (keyMatch) {
    key = keyMatch[1];
    body = body.replace(keyMatch[0], "").trim();
  }
  // Split title / artist on " / " or " - " or " – "
  const sepMatch = body.match(/^(.+?)\s+[\/\-–]\s+(.+)$/);
  if (sepMatch) {
    return { title: sepMatch[1].trim(), artist: sepMatch[2].trim(), key, singer };
  }
  return { title: body, key, singer };
}

function classifySectionTitle(line: string): { title: string; time?: string } | null {
  // Time-prefixed section: "5:30 PM – BAND SET 1" or "5:30 - BAND SET 1"
  const timeM = line.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–]\s*(.+)$/i);
  let candidate = line.trim();
  let time: string | undefined;
  if (timeM) {
    time = timeM[1].trim();
    candidate = timeM[2].trim();
  }
  for (const pat of SECTION_HEADER_PATTERNS) {
    const m = candidate.match(pat);
    if (m) return { title: candidate.replace(/\s*\([^)]+\)\s*$/, "").trim(), time };
  }
  return null;
}

function parseTimelineLine(line: string): TimelineEntry | null {
  const m = line.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM)?(?:\s*[-–]\s*\d{1,2}:\d{2}\s*(?:AM|PM)?)?)\s*[-–]\s*(.+)$/i);
  if (!m) return null;
  return { time: m[1].trim(), description: m[2].trim() };
}

export function parseShapeA(text: string, sourceFilename?: string): ParseResult {
  const warnings: string[] = [];
  const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));
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

  let currentSection: SongSectionField | null = null;
  let inTimelineBlock = false;
  let inPersonnelBlock = false;

  // Use the doc's first line or filename as event name candidate
  const firstNonEmpty = lines.find((l) => l.trim());
  if (firstNonEmpty && !/^\s*\d/.test(firstNonEmpty)) {
    fields.name = firstNonEmpty.replace(/[#*]/g, "").trim();
  } else if (sourceFilename) {
    fields.name = sourceFilename.replace(/\.[^.]+$/, "");
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;

    // Pipe-delimited header
    if (line.includes("|") && /Couple:|Location:/i.test(line)) {
      const hdr = parsePipeHeader(line);
      if (hdr.date) fields.event_date = hdr.date;
      if (hdr.client_primary) fields.client!.primary = hdr.client_primary;
      if (hdr.client_secondary) fields.client!.secondary = hdr.client_secondary;
      if (hdr.venue_name) {
        fields.venue!.name = hdr.venue_name;
        fields.venue_name = hdr.venue_name;
      }
      if (hdr.venue_address) fields.venue!.address = hdr.venue_address;
      if (hdr.attire) fields.attire = hdr.attire;
      continue;
    }

    // Section markers
    if (/^PERSONNEL|^ROLES/i.test(line)) {
      inPersonnelBlock = true;
      inTimelineBlock = false;
      currentSection = null;
      continue;
    }
    if (/^LOAD[-\s]?IN|^LOGISTICS/i.test(line)) {
      inPersonnelBlock = false;
      inTimelineBlock = false;
      currentSection = null;
      continue;
    }
    if (/^TIMELINE$/i.test(line)) {
      inTimelineBlock = true;
      inPersonnelBlock = false;
      currentSection = null;
      continue;
    }

    // FULL BAND personnel
    if (PERSONNEL_PREFIXES.some((p) => p.test(line))) {
      const entries = parsePersonnelLine(line);
      if (entries.length) fields.personnel!.push(...entries);
      inPersonnelBlock = false;
      continue;
    }

    // Multi-role inline (MC – Name, SOUND – Name, etc.)
    for (const { role, pattern } of ROLE_LINE_PATTERNS) {
      const m = line.match(pattern);
      if (m && m[1] && !/^[A-Z]+\s*[-–]/.test(m[1].trim())) {
        const name = m[1].trim().replace(/[,;]+$/, "");
        if (name) fields.personnel!.push({ role, name });
      }
    }

    // Load-in / Parking
    const loadInM = line.match(/^Load[-\s]?in\s*[-–:]\s*(.+)$/i);
    if (loadInM) {
      fields.logistics!.load_in = loadInM[1].trim();
      continue;
    }
    const parkingM = line.match(/^Parking\s*[-–:]\s*(.+)$/i);
    if (parkingM) {
      fields.logistics!.parking = parkingM[1].trim();
      continue;
    }

    // Section header
    const section = classifySectionTitle(line);
    if (section) {
      if (currentSection && currentSection.songs.length > 0) {
        fields.song_sections!.push(currentSection);
      }
      currentSection = { title: section.title, time: section.time, songs: [] };
      inTimelineBlock = false;
      continue;
    }

    // Timeline row
    if (inTimelineBlock) {
      const tl = parseTimelineLine(line);
      if (tl) {
        fields.timeline!.push(tl);
        continue;
      }
    } else {
      // Also catch standalone time lines outside the TIMELINE block
      const standalone = parseTimelineLine(line);
      if (standalone && !currentSection) {
        fields.timeline!.push(standalone);
        continue;
      }
    }

    // Songs inside current section
    if (currentSection) {
      const song = parseSongLine(line);
      if (song && song.title) {
        currentSection.songs.push(song);
      }
    }
  }

  if (currentSection && currentSection.songs.length > 0) {
    fields.song_sections!.push(currentSection);
  }

  // Sort timeline chronologically (Q3 rec — always chronological for output)
  fields.timeline = sortTimelineByClock(fields.timeline!);

  // Confidence: high if we found header + at least 2 sections or 3 personnel entries
  let confidence = 0.5;
  if (fields.event_date) confidence += 0.15;
  if (fields.client?.primary) confidence += 0.1;
  if ((fields.personnel?.length || 0) >= 3) confidence += 0.1;
  if ((fields.song_sections?.length || 0) >= 2) confidence += 0.1;
  if ((fields.timeline?.length || 0) >= 3) confidence += 0.05;

  return {
    shape: "A",
    fields,
    confidence: Math.min(confidence, 0.99),
    warnings,
  };
}

function sortTimelineByClock(timeline: TimelineEntry[]): TimelineEntry[] {
  return [...timeline].sort((a, b) => clockToMin(a.time) - clockToMin(b.time));
}

function clockToMin(t: string): number {
  const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return 9999;
  let h = parseInt(m[1], 10);
  const mn = parseInt(m[2], 10);
  const ampm = m[3]?.toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  if (!ampm && h < 8) h += 12; // common ROS times default to PM
  return h * 60 + mn;
}
