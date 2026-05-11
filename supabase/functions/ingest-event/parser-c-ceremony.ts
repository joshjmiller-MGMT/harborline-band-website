// Parser C — Ceremony-Only Run of Show Template (taxonomy Shape C, Doc 3).
//
// Polished short doc with 4 numbered sections:
//   1. Prelude (Guest Arrival) – N songs
//   2. Processional – sub-bullets (Groom & Wedding Party / Bride's Entrance)
//   3. Recessional – N songs
//   4. Postlude (Guest Departure) – optional/backup songs
//   (5. Cocktail Hour – Add-On, sometimes present)
//
// Round-trip detection: the blank template (Doc ID
// 1izZedBDBVH33KHmlN3xlaF2SWhdx0gvyUSz4kaO0V0s) has the section headers but
// NO song entries — only vibe blurbs and song-count hints ("5-7 songs"). When
// any song list under any section is populated, the client has returned with
// edits and the parser pulls those songs.

import type {
  CanonicalEventFields,
  ParseResult,
  SongEntry,
  SongSectionField,
} from "./canonical-event-types.ts";

const SECTION_HEADERS: { match: RegExp; title: string }[] = [
  { match: /^#{0,3}\s*\**\s*1\.\s+Prelude/i, title: "Prelude" },
  { match: /^#{0,3}\s*\**\s*2\.\s+Processional/i, title: "Processional" },
  { match: /^#{0,3}\s*\**\s*3\.\s+Recessional/i, title: "Recessional" },
  { match: /^#{0,3}\s*\**\s*4\.\s+Postlude/i, title: "Postlude" },
  { match: /^#{0,3}\s*\**\s*5\.\s+Cocktail/i, title: "Cocktail Hour" },
];

const VIBE_PATTERNS = [
  /^\s*\*\**Vibe:\**\s*(.+?)\**\s*$/i,
  /^\s*\(Approx\.[^)]+\)/i, // timing hint
  /^\s*\*\(.+?\)\*\s*$/, // italicized aside
];

// Bare song line — possibly numbered ("1. Title – Artist"), bulleted, or just plain.
function parseSongLine(line: string): SongEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Strip leading list markers (number., -, •, *)
  const body = trimmed
    .replace(/^\d+\.\s*/, "")
    .replace(/^[-•*]\s*/, "")
    .replace(/^\(.+?\)\s*/, "") // strip leading "(Optional)" / "(Backup)" labels
    .trim();
  if (!body) return null;
  // Skip prose lines that aren't songs (heuristic — no title-artist separator and looks sentence-like)
  if (body.length > 80 && !/[\-–\/]/.test(body)) return null;
  if (/^\s*(it'?s|i'?ve|i'?m|email|fill out|let me know)/i.test(body)) return null;

  // Split on " – " or " - " or " / "
  const sep = body.match(/^(.+?)\s+[\-–\/]\s+(.+)$/);
  if (sep) {
    return { title: sep[1].trim(), artist: sep[2].trim() };
  }
  return { title: body };
}

function isVibeLine(line: string): boolean {
  return VIBE_PATTERNS.some((p) => p.test(line));
}

function extractVibe(line: string): string | undefined {
  const m = line.match(/Vibe:\**\s*(.+?)\**\s*$/i);
  return m ? m[1].trim().replace(/\**$/, "").trim() : undefined;
}

function isProcessionalSubBullet(line: string): boolean {
  return /^\s*[-•*]\s*Proce[s]+ion\s+of/i.test(line);
}

export function parseShapeC(text: string, sourceFilename?: string): ParseResult {
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
  let inTemplate = false;
  let knownSectionsSeen = 0;

  fields.event_type = "wedding-ceremony";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Enter the structured portion once we see "Run of Show Template" or section 1
    if (/run\s+of\s+show\s+template/i.test(trimmed)) {
      inTemplate = true;
      continue;
    }

    // Section header check (closes the previous section)
    const sectionMatch = SECTION_HEADERS.find((s) => s.match.test(trimmed));
    if (sectionMatch) {
      if (currentSection && currentSection.songs.length > 0) {
        fields.song_sections!.push(currentSection);
      }
      currentSection = { title: sectionMatch.title, songs: [] };
      inTemplate = true;
      knownSectionsSeen++;
      continue;
    }

    if (!inTemplate) {
      // Boilerplate prose preamble. Capture nothing.
      continue;
    }

    // Vibe / timing note attaches to current section
    if (currentSection && isVibeLine(trimmed)) {
      const vibe = extractVibe(trimmed);
      if (vibe) currentSection.vibe = vibe;
      continue;
    }

    // Processional sub-bullets describe ceremony movements — capture as songs-with-notes
    if (currentSection?.title === "Processional" && isProcessionalSubBullet(trimmed)) {
      const cleaned = trimmed.replace(/^[\s-•*]+/, "").trim();
      currentSection.songs.push({ title: cleaned, notes: "movement-note" });
      continue;
    }

    // Otherwise try parsing as a song line
    if (currentSection) {
      const song = parseSongLine(trimmed);
      if (song) {
        // Don't capture pure description lines mistakenly parsed as songs
        if (song.title && song.title.length > 0 && song.title.length < 140) {
          currentSection.songs.push(song);
        }
      }
    }
  }

  if (currentSection && currentSection.songs.length > 0) {
    fields.song_sections!.push(currentSection);
  }

  // Blank-starter detection: we saw the section headers but no real song entries.
  // Songs with `notes: "movement-note"` are template scaffolding, not client input.
  const realSongCount = (fields.song_sections || []).reduce(
    (sum, s) => sum + s.songs.filter((song) => song.notes !== "movement-note").length,
    0,
  );
  const isBlankStarter = knownSectionsSeen >= 3 && realSongCount === 0;
  if (isBlankStarter) {
    warnings.push("Shape C blank starter detected — section headers present but no songs entered");
  }

  if (!fields.name && sourceFilename) {
    fields.name = sourceFilename.replace(/\.[^.]+$/, "");
  }

  let confidence = 0.55;
  if (knownSectionsSeen >= 3) confidence += 0.15;
  if (knownSectionsSeen >= 4) confidence += 0.1;
  if (realSongCount >= 3) confidence += 0.1;
  if (realSongCount >= 10) confidence += 0.05;

  return {
    shape: "C",
    fields,
    is_blank_starter: isBlankStarter,
    confidence: Math.min(confidence, 0.99),
    warnings,
  };
}
