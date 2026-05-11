// Parser D — Harborline Multi-Block Spreadsheet (taxonomy Shape D, Doc 7).
//
// Targets Google Sheets exported as stacked markdown tables: header block →
// logistics block → personnel grid (right side) + reception flow (left side) →
// inline song-detail tables → setlist tables with Title|Artist|Notes|Key|BPM|Singer|Patches.
//
// Two valid input forms:
//   - rawText: a markdown-table dump of the sheet (from the existing
//     fetch-google-sheet edge function or a paste).
//   - structured rows/headers from sheet ingestion (future).
//
// Cut 2 implementation targets the rawText form first. The existing
// parseSheetToEvent in generate-run-of-show handles structured rows; that
// path stays as the production renderer until Cut 4 unifies them.

import type {
  CanonicalEventFields,
  ParseResult,
  PersonnelEntry,
  SongEntry,
  SongSectionField,
  TimelineEntry,
} from "./canonical-event-types.ts";

const LABEL_PATTERNS: Record<keyof Mapping, RegExp[]> = {
  event_name: [/^Event\s+Name:?$/i],
  venue: [/^Venue:?$/i],
  venue_address: [/^Venue\s+Address:?$/i],
  event_date: [/^Event\s+Date:?$/i],
  client: [/^Client:?$/i],
  organization: [/^Organization:?$/i],
  event_type: [/^Event\s+Type:?$/i],
  load_in: [/^Load[-\s]?in(?:\s+Time)?:?$/i],
  soundcheck: [/^Soundcheck:?$/i],
  parking: [/^Parking:?$/i],
  entrance: [/^Entrance:?$/i],
  on_site_poc: [/^On[-\s]?site\s+POC:?$/i, /^Musician\s+POS:?$/i],
  green_room: [/^Green\s+room:?$/i],
  posting: [/^Posting:?$/i],
  attire: [/^What\s+to\s+wear:?$/i, /^Attire:?$/i],
};

type Mapping = {
  event_name: string;
  venue: string;
  venue_address: string;
  event_date: string;
  client: string;
  organization: string;
  event_type: string;
  load_in: string;
  soundcheck: string;
  parking: string;
  entrance: string;
  on_site_poc: string;
  green_room: string;
  posting: string;
  attire: string;
};

// "Personell" (with the canonical typo) and "Personnel" — instrument keys
const PERSONNEL_ROLE_LABELS = new Set([
  "drums","bass","keys","piano","guitar","vocals","sax","horn",
  "trumpet","trombone","violin","viola","cello","percussion","aux",
]);

function findLabel(cell: string): keyof Mapping | null {
  const trimmed = cell.trim();
  if (!trimmed) return null;
  for (const [key, patterns] of Object.entries(LABEL_PATTERNS)) {
    for (const pat of patterns) {
      if (pat.test(trimmed)) return key as keyof Mapping;
    }
  }
  return null;
}

function parseTableRow(line: string): string[] {
  if (!line.includes("|")) return [];
  // Markdown table row: "| a | b | c |" → ["a","b","c"]
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^[-:\s]+$/.test(c));
}

export function parseShapeD(text: string, sourceFilename?: string): ParseResult {
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

  let pendingSetlist: SongSectionField | null = null;
  let setlistHeader: string[] | null = null;

  const recordValue = (label: keyof Mapping, value: string) => {
    const v = value.trim();
    if (!v) return;
    switch (label) {
      case "event_name":
        fields.name = v;
        break;
      case "venue":
        fields.venue!.name = v;
        fields.venue_name = v;
        break;
      case "venue_address":
        fields.venue!.address = v;
        break;
      case "event_date":
        fields.event_date = v;
        break;
      case "client": {
        const [primary, secondary] = v.split(/\s*&\s*|\s+and\s+/i).map((s) => s.trim());
        fields.client!.primary = primary;
        if (secondary) fields.client!.secondary = secondary;
        break;
      }
      case "organization":
        fields.organization = v.toLowerCase().includes("baltimore sound") ? "bse"
          : v.toLowerCase().includes("harborline") ? "harborline"
          : v.toLowerCase().includes("tsb") ? "tsb"
          : v.toLowerCase();
        break;
      case "event_type":
        fields.event_type = v.toLowerCase();
        break;
      case "load_in":
        fields.logistics!.load_in = v;
        break;
      case "soundcheck":
        fields.logistics!.soundcheck = v;
        break;
      case "parking":
        fields.logistics!.parking = v;
        break;
      case "entrance":
        fields.logistics!.entrance = v;
        break;
      case "on_site_poc":
        fields.personnel!.push({ role: "On-Site POC", name: v });
        break;
      case "green_room":
        fields.logistics!.green_room = v;
        break;
      case "posting":
        fields.preferences!.style_notes =
          (fields.preferences!.style_notes ? fields.preferences!.style_notes + " " : "") +
          "Posting: " + v;
        break;
      case "attire":
        fields.attire = v;
        break;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cells = parseTableRow(line);
    if (cells.length === 0) continue;
    if (isSeparatorRow(cells)) continue;

    // Label/value detection: scan adjacent cells in pairs.
    let consumed = false;
    for (let j = 0; j < cells.length - 1; j++) {
      const label = findLabel(cells[j]);
      if (label && cells[j + 1]) {
        recordValue(label, cells[j + 1]);
        consumed = true;
      }
    }
    if (consumed) continue;

    // Personnel row: "Drums | Sean Sidley" style (two cells, left = role)
    if (cells.length === 2) {
      const left = cells[0].toLowerCase().trim().replace(/[:]+$/, "");
      if (PERSONNEL_ROLE_LABELS.has(left)) {
        fields.personnel!.push({ role: cells[0].replace(/[:]+$/, "").trim(), name: cells[1] });
        continue;
      }

      // Reception flow row: "8:00" | "DINNER" or "8:45 PM" | "First Dance"
      const timeM = cells[0].match(/^\d{1,2}:\d{2}(\s*(?:AM|PM))?/i);
      if (timeM && cells[1]) {
        fields.timeline!.push({ time: cells[0], description: cells[1] });
        continue;
      }
    }

    // Setlist header — declares column order
    const setlistHeaderMatch = cells.some((c) => /title/i.test(c)) &&
      cells.some((c) => /artist/i.test(c));
    if (setlistHeaderMatch) {
      setlistHeader = cells.map((c) => c.toLowerCase().trim());
      pendingSetlist = pendingSetlist ?? {
        title: "Setlist",
        songs: [],
      };
      continue;
    }

    // Song row in a known setlist
    if (setlistHeader && pendingSetlist && cells.length >= 2) {
      const song: SongEntry = {};
      for (let k = 0; k < cells.length && k < setlistHeader.length; k++) {
        const header = setlistHeader[k];
        const value = cells[k];
        if (!value) continue;
        if (header.includes("title")) song.title = value;
        else if (header.includes("artist")) song.artist = value;
        else if (header.includes("key")) song.key = value;
        else if (header.includes("bpm")) song.bpm = value;
        else if (header.includes("singer")) song.singer = value;
        else if (header.includes("patches")) song.patches = value;
        else if (header.includes("notes") || header.includes("arrangement")) song.notes = value;
        else if (/^\d+$/.test(header) || header === "#" || header === "no_header") {
          if (!song.order) song.order = value;
        }
      }
      if (song.title || song.artist) {
        pendingSetlist.songs.push(song);
      }
    }
  }

  if (pendingSetlist && pendingSetlist.songs.length > 0) {
    fields.song_sections!.push(pendingSetlist);
  }

  // Sort timeline chronologically
  fields.timeline = sortTimelineByClock(fields.timeline!);

  // Use filename as event name fallback
  if (!fields.name && sourceFilename) {
    fields.name = sourceFilename.replace(/\.[^.]+$/, "");
  }

  let confidence = 0.5;
  if (fields.event_date) confidence += 0.1;
  if (fields.venue_name) confidence += 0.1;
  if ((fields.personnel?.length || 0) >= 3) confidence += 0.1;
  if ((fields.song_sections?.[0]?.songs.length || 0) >= 3) confidence += 0.15;

  return {
    shape: "D",
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
  if (!ampm && h < 8) h += 12;
  return h * 60 + mn;
}
