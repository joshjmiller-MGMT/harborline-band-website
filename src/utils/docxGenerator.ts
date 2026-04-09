import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, HeadingLevel, LevelFormat, PageBreak,
} from "docx";
import { saveAs } from "file-saver";

// ─── Types ──────────────────────────────────────────────────────────────

interface EventData {
  eventName: string;
  details: Record<string, string>;
  personnel: { role: string; name: string }[];
  timeline: { time: string; description: string }[];
  songSections: { title: string; time: string; songs: SongEntry[] }[];
}

interface SongEntry {
  order: string;
  request: boolean;
  artist: string;
  title: string;
  notes: string;
  key: string;
  bpm: string;
  singer: string;
  patches: string;
}

type TemplateType = "wedding-ros" | "client-planner" | "corporate-ros" | "party-runsheet";

// ─── Personnel Grouping ─────────────────────────────────────────────────

interface PersonnelGroup {
  label: string;
  members: { role: string; name: string }[];
}

function groupPersonnelByDept(personnel: { role: string; name: string }[]): PersonnelGroup[] {
  const soundKeywords = ['sound', 'audio', 'a/v', 'av ', 'a1', 'a2', 'monitor', 'foh'];
  const lightKeywords = ['light', 'lighting', 'ld', 'spots', 'spot op'];
  const productionKeywords = ['mc', 'emcee', 'stage manager', 'production', 'break playlist', 'dj'];
  const coordKeywords = ['coordinator', 'planner', 'ceremony', 'cocktail hour', 'cocktail'];

  const groups: Record<string, { role: string; name: string }[]> = {
    'Band': [], 'Sound': [], 'Lighting': [], 'Production': [], 'Coordination': [],
  };

  for (const p of personnel) {
    const r = p.role.toLowerCase();
    if (soundKeywords.some(k => r.includes(k))) groups['Sound'].push(p);
    else if (lightKeywords.some(k => r.includes(k))) groups['Lighting'].push(p);
    else if (productionKeywords.some(k => r.includes(k))) groups['Production'].push(p);
    else if (coordKeywords.some(k => r.includes(k))) groups['Coordination'].push(p);
    else groups['Band'].push(p);
  }

  return Object.entries(groups)
    .filter(([_, members]) => members.length > 0)
    .map(([label, members]) => ({ label, members }));
}
type OrgKey = "harborline" | "bse" | "tsb";
type RequiredField = { label: string; key: string };

// ─── Alias lookup (mirrors edge function) ───────────────────────────────

const DETAIL_KEY_ALIASES: Record<string, string> = {
  "musicians salesperson": "musician salesperson",
  "musicians sales person": "musician salesperson",
  "musician sales person": "musician salesperson",
  salesperson: "musician salesperson",
  "sales person": "musician salesperson",
  "sales rep": "musician salesperson",
  "coordinator or on-site point of contact": "coordinator",
  "on-site point of contact": "coordinator",
  "event coordinator": "coordinator",
  "day-of coordinator": "coordinator",
  "wedding coordinator": "coordinator",
  "planner": "coordinator",
  "band project lead": "project lead",
  "bandleader": "project lead",
  "band leader": "project lead",
  "on site poc": "musician pos",
  "on-site poc": "musician pos",
  "musician poc": "musician pos",
  "musician point of contact": "musician pos",
  couple: "client",
  "bride and groom": "client",
  "bride & groom": "client",
  location: "venue",
  address: "venue address",
  sound: "audio reinforcement",
  "what to wear": "attire",
};

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/['']/g, "").replace(/\s+/g, " ").trim();
}

function getDetailValue(details: Record<string, string>, lookupKey: string): string {
  const norm = DETAIL_KEY_ALIASES[normalizeKey(lookupKey)] || normalizeKey(lookupKey);
  for (const [key, value] of Object.entries(details)) {
    const nk = DETAIL_KEY_ALIASES[normalizeKey(key)] || normalizeKey(key);
    if (nk === norm && value) return value;
  }
  return details[lookupKey] || "";
}

// ─── Helpers ────────────────────────────────────────────────────────────

const BLANK = "________";

function detailRuns(label: string, value: string, opts?: { bold?: boolean; fontSize?: number; color?: string }): Paragraph {
  const fs = (opts?.fontSize || 12) * 2;
  const val = value || BLANK;
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: fs, font: opts?.bold ? "Inter" : "Inter", color: opts?.color || "1a1a1a" }),
      new TextRun({ text: val, size: fs, font: "Inter", color: val === BLANK ? "cccccc" : (opts?.color || "333333") }),
    ],
  });
}

function sectionHeading(text: string, opts: { font?: string; size?: number; color?: string; spacing?: number; bold?: boolean; allCaps?: boolean }): Paragraph {
  return new Paragraph({
    spacing: { before: (opts.spacing || 360), after: 80 },
    children: [
      new TextRun({
        text: opts.allCaps ? text.toUpperCase() : text,
        font: opts.font || "Inter",
        size: (opts.size || 18) * 2,
        bold: opts.bold !== false,
        color: opts.color || "1a1a1a",
        allCaps: opts.allCaps,
      }),
    ],
  });
}

function hrParagraph(color = "cccccc", size = 6): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size, color, space: 1 } },
    children: [],
  });
}

function emptyLine(): Paragraph {
  return new Paragraph({ spacing: { after: 60 }, children: [] });
}

async function loadImageAsBuffer(src: string): Promise<{ buf: Buffer | Uint8Array; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Failed to convert image"));
        blob.arrayBuffer().then(ab => {
          resolve({ buf: new Uint8Array(ab), w: img.naturalWidth, h: img.naturalHeight });
        });
      }, "image/png");
    };
    img.onerror = reject;
    img.src = src;
  });
}

// ─── Shared: build detail paragraphs from requiredFields ────────────────

function buildDetailParagraphs(event: EventData, requiredFields: RequiredField[], opts?: { fontSize?: number; color?: string; labelColor?: string }): Paragraph[] {
  return requiredFields.map(f => {
    const value = getDetailValue(event.details, f.key);
    return detailRuns(f.label, value, { fontSize: opts?.fontSize || 12, color: opts?.labelColor || "1a1a1a" });
  });
}

// ─── Song table builder ─────────────────────────────────────────────────

function buildSongTable(songs: SongEntry[], accentColor: string, showRequest = false): Table {
  const allSongs = songs;
  const hasKey = allSongs.some(s => s.key && /^[A-G][b#]?\s*(maj|min|m|major|minor)?$/i.test(s.key.trim()));
  const hasBpm = allSongs.some(s => s.bpm);
  const hasSinger = allSongs.some(s => s.singer);

  const cols: { header: string; width: number; getter: (s: SongEntry) => string }[] = [
    { header: "#", width: 500, getter: s => s.order || "" },
  ];
  if (showRequest) cols.push({ header: "★", width: 400, getter: s => s.request ? "★" : "" });
  cols.push({ header: "Title", width: 2800, getter: s => s.title });
  cols.push({ header: "Artist", width: 2200, getter: s => s.artist });
  if (hasSinger) cols.push({ header: "Singer", width: 1200, getter: s => s.singer });
  if (hasKey) cols.push({ header: "Key", width: 600, getter: s => s.key });
  if (hasBpm) cols.push({ header: "BPM", width: 600, getter: s => s.bpm });
  cols.push({ header: "Notes", width: 1800, getter: s => s.notes || "" });

  // Normalize widths to fit ~9360 DXA
  const totalRaw = cols.reduce((s, c) => s + c.width, 0);
  const scale = 9360 / totalRaw;
  const colWidths = cols.map(c => Math.round(c.width * scale));

  const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" };
  const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
  const headerBorders = { ...cellBorders, bottom: { style: BorderStyle.SINGLE, size: 3, color: accentColor } };

  const headerRow = new TableRow({
    children: cols.map((col, i) =>
      new TableCell({
        width: { size: colWidths[i], type: WidthType.DXA },
        borders: headerBorders,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [new Paragraph({
          children: [new TextRun({ text: col.header, bold: true, size: 18, font: "Inter", color: accentColor })],
        })],
      })
    ),
  });

  const dataRows = allSongs.map((song, ri) =>
    new TableRow({
      children: cols.map((col, ci) =>
        new TableCell({
          width: { size: colWidths[ci], type: WidthType.DXA },
          borders: cellBorders,
          margins: { top: 30, bottom: 30, left: 60, right: 60 },
          shading: ri % 2 === 1 ? { fill: "F9F9F9", type: ShadingType.CLEAR } : undefined,
          children: [new Paragraph({
            children: [new TextRun({ text: col.getter(song), size: 22, font: "Inter", color: "222222" })],
          })],
        })
      ),
    })
  );

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  });
}

// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE GENERATORS
// ═══════════════════════════════════════════════════════════════════════

// ─── Client Planner (Elegant) ───────────────────────────────────────────

function buildClientPlanner(event: EventData, requiredFields: RequiredField[], logoData?: { buf: Uint8Array; w: number; h: number }): Document {
  const children: any[] = [];

  // Logo
  if (logoData) {
    const maxH = 60;
    const ratio = logoData.w / logoData.h;
    const h = Math.min(maxH, logoData.h);
    const w = Math.round(h * ratio);
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new ImageRun({ type: "png", data: logoData.buf, transformation: { width: w, height: h }, altText: { title: "Logo", description: "Brand logo", name: "logo" } })],
    }));
  }

  // Title
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: event.eventName || "Wedding Ceremony Planner", font: "Garamond", size: 52, color: "1a1a1a" })],
  }));

  // Detail fields
  children.push(hrParagraph("cccccc", 4));
  children.push(...buildDetailParagraphs(event, requiredFields, { fontSize: 12 }));
  children.push(hrParagraph("cccccc", 4));

  // Timeline
  if (event.timeline.length > 0) {
    children.push(sectionHeading("Timeline", { font: "Garamond", size: 20, color: "1a1a1a" }));
    children.push(hrParagraph("cccccc", 4));
    for (const t of event.timeline) {
      children.push(new Paragraph({
        spacing: { after: 60 },
        indent: { left: 240 },
        children: [
          new TextRun({ text: t.time, bold: true, size: 24, font: "Inter", color: "1a1a1a" }),
          new TextRun({ text: ` — ${t.description}`, size: 24, font: "Inter", color: "333333" }),
        ],
      }));
    }
  }

  // Song sections
  for (const section of event.songSections) {
    children.push(sectionHeading(section.title, { font: "Garamond", size: 20, color: "1a1a1a" }));
    if (section.time) {
      children.push(new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: section.time, size: 22, font: "Inter", color: "888888", italics: true })],
      }));
    }
    children.push(hrParagraph("cccccc", 4));

    for (const song of section.songs) {
      const artistPart = song.artist ? ` – ${song.artist}` : "";
      children.push(new Paragraph({
        spacing: { after: 40 },
        indent: { left: 240 },
        bullet: { level: 0 },
        children: [new TextRun({ text: `${song.title}${artistPart}`, size: 24, font: "Inter", color: "333333" })],
      }));
    }
  }

  // Footer
  children.push(emptyLine());
  children.push(hrParagraph("dddddd", 4));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Thank you for choosing us for your special day", size: 18, font: "Inter", color: "aaaaaa" })],
  }));

  return new Document({
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      }],
    },
    styles: {
      default: { document: { run: { font: "Inter", size: 24 } } },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });
}

// ─── Wedding RoS (Musician-facing) ──────────────────────────────────────

function buildWeddingRoS(event: EventData, requiredFields: RequiredField[], logoData?: { buf: Uint8Array; w: number; h: number }): Document {
  const children: any[] = [];

  if (logoData) {
    const maxH = 60;
    const ratio = logoData.w / logoData.h;
    const h = Math.min(maxH, logoData.h);
    const w = Math.round(h * ratio);
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new ImageRun({ type: "png", data: logoData.buf, transformation: { width: w, height: h }, altText: { title: "Logo", description: "Brand logo", name: "logo" } })],
    }));
  }

  children.push(hrParagraph("222222", 12));

  // Details
  children.push(...buildDetailParagraphs(event, requiredFields, { fontSize: 12 }));

  // Personnel grouped by department
  if (event.personnel.length > 0) {
    children.push(emptyLine());
    const groups = groupPersonnelByDept(event.personnel);
    for (const g of groups) {
      children.push(new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: g.label.toUpperCase(), size: 20, font: "Inter", color: "999999", bold: true })],
      }));
      for (const p of g.members) {
        children.push(new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: `${p.role}: `, bold: true, size: 24, font: "Inter", color: "222222" }),
            new TextRun({ text: p.name, size: 24, font: "Inter", color: "222222" }),
          ],
        }));
      }
    }
  }

  children.push(hrParagraph("222222", 12));

  // Run of Show heading
  children.push(sectionHeading("Run of Show", { font: "Inter", size: 18, color: "222222", bold: true }));

  // Timeline
  if (event.timeline.length > 0) {
    children.push(sectionHeading("Timeline", { font: "Inter", size: 16, color: "222222", bold: true }));
    children.push(hrParagraph("cccccc", 4));
    for (const t of event.timeline) {
      children.push(new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: t.time, bold: true, size: 24, font: "Inter", color: "222222" }),
          new TextRun({ text: ` — ${t.description}`, size: 24, font: "Inter", color: "222222" }),
        ],
      }));
    }
  }

  // Song sections as numbered lists
  for (const section of event.songSections) {
    children.push(sectionHeading(section.title, { font: "Inter", size: 16, color: "222222", bold: true }));
    if (section.time) {
      children.push(new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: section.time, size: 22, font: "Inter", color: "666666", italics: true })],
      }));
    }
    children.push(hrParagraph("cccccc", 4));

    for (let i = 0; i < section.songs.length; i++) {
      const song = section.songs[i];
      const artistPart = song.artist ? ` – ${song.artist}` : "";
      const notesPart = song.notes ? ` (${song.notes})` : "";
      children.push(new Paragraph({
        spacing: { after: 40 },
        indent: { left: 360 },
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, size: 24, font: "Inter", color: "222222" }),
          new TextRun({ text: `${song.title}${artistPart}${notesPart}`, size: 24, font: "Inter", color: "222222" }),
        ],
      }));
    }
  }

  // Footer
  children.push(emptyLine());
  children.push(hrParagraph("cccccc", 4));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Confidential — For musician use only", size: 18, font: "Inter", color: "999999" })],
  }));

  return new Document({
    styles: { default: { document: { run: { font: "Inter", size: 24 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1200, right: 1320, bottom: 1200, left: 1320 },
        },
      },
      children,
    }],
  });
}

// ─── Corporate Event ────────────────────────────────────────────────────

function buildCorporateRoS(event: EventData, requiredFields: RequiredField[], org: OrgKey, logoData?: { buf: Uint8Array; w: number; h: number }): Document {
  const accentColor = org === "tsb" ? "E85D04" : "14B8A6";
  const children: any[] = [];

  if (logoData) {
    const maxH = 65;
    const ratio = logoData.w / logoData.h;
    const h = Math.min(maxH, logoData.h);
    const w = Math.round(h * ratio);
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new ImageRun({ type: "png", data: logoData.buf, transformation: { width: w, height: h }, altText: { title: "Logo", description: "Brand logo", name: "logo" } })],
    }));
  }

  // Title
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({ text: event.eventName, font: "Inter", size: 44, bold: true, color: "1a1a1a" })],
  }));
  const eventDate = event.details["event date"] || "";
  const venue = event.details["venue"] || "";
  if (eventDate || venue) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: [eventDate, venue].filter(Boolean).join("  •  "), size: 24, font: "Inter", color: "333333" })],
    }));
  }

  // Accent border
  children.push(new Paragraph({
    spacing: { after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: accentColor, space: 1 } },
    children: [],
  }));

  // Details
  children.push(sectionHeading("Event Details", { font: "Inter", size: 16, color: accentColor, allCaps: true }));
  children.push(new Paragraph({ spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: accentColor, space: 1 } }, children: [] }));
  children.push(...buildDetailParagraphs(event, requiredFields, { fontSize: 12, labelColor: "1a1a1a" }));

  // Personnel grouped by department
  if (event.personnel.length > 0) {
    children.push(sectionHeading("Team", { font: "Inter", size: 16, color: accentColor, allCaps: true }));
    children.push(new Paragraph({ spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: accentColor, space: 1 } }, children: [] }));
    const groups = groupPersonnelByDept(event.personnel);
    for (const g of groups) {
      children.push(new Paragraph({ spacing: { after: 40 }, children: [
        new TextRun({ text: g.label.toUpperCase(), bold: true, size: 20, font: "Inter", color: accentColor }),
      ] }));
      for (const p of g.members) {
        children.push(new Paragraph({ spacing: { after: 40 }, indent: { left: 240 }, children: [
          new TextRun({ text: `${p.role}: `, bold: true, size: 24, font: "Inter", color: "1a1a1a" }),
          new TextRun({ text: p.name, size: 24, font: "Inter", color: "333333" }),
        ] }));
      }
    }
  }

  // Timeline
  if (event.timeline.length > 0) {
    children.push(sectionHeading("Schedule", { font: "Inter", size: 16, color: accentColor, allCaps: true }));
    children.push(new Paragraph({ spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: accentColor, space: 1 } }, children: [] }));
    for (const t of event.timeline) {
      children.push(new Paragraph({
        spacing: { after: 60 },
        indent: { left: 360 },
        border: { left: { style: BorderStyle.SINGLE, size: 6, color: accentColor, space: 8 } },
        children: [
          new TextRun({ text: t.time, bold: true, size: 24, font: "Inter", color: "1a1a1a" }),
          new TextRun({ text: ` — ${t.description}`, size: 24, font: "Inter", color: "333333" }),
        ],
      }));
    }
  }

  // Songlist
  if (event.songSections.length > 0) {
    children.push(sectionHeading("Songlist", { font: "Inter", size: 16, color: accentColor, allCaps: true }));
    children.push(new Paragraph({ spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: accentColor, space: 1 } }, children: [] }));
    for (const section of event.songSections) {
      children.push(new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: `${section.time ? section.time + " — " : ""}${section.title}`, bold: true, size: 26, font: "Inter", color: "1a1a1a" })],
      }));
      children.push(buildSongTable(section.songs, accentColor));
    }
  }

  // Footer
  children.push(emptyLine());
  children.push(new Paragraph({
    spacing: { before: 200 },
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: accentColor, space: 8 } },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Internal Document  •  Confidential", size: 20, font: "Inter", color: "888888" })],
  }));

  return new Document({
    styles: { default: { document: { run: { font: "Inter", size: 24 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1200, right: 1440, bottom: 1200, left: 1440 },
        },
      },
      children,
    }],
  });
}

// ─── Party Run Sheet (Internal, colorful) ───────────────────────────────

function buildPartyRunSheet(event: EventData, requiredFields: RequiredField[], org: OrgKey, logoData?: { buf: Uint8Array; w: number; h: number }): Document {
  const isTSB = org === "tsb";
  const purple = isTSB ? "DC2626" : "7C3AED";
  const teal = isTSB ? "E85D04" : "14B8A6";
  const children: any[] = [];

  if (logoData) {
    const maxH = 70;
    const ratio = logoData.w / logoData.h;
    const h = Math.min(maxH, logoData.h);
    const w = Math.round(h * ratio);
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new ImageRun({ type: "png", data: logoData.buf, transformation: { width: w, height: h }, altText: { title: "Logo", description: "Brand logo", name: "logo" } })],
    }));
  }

  // Event title
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: event.eventName.toUpperCase(), font: "Inter", size: 52, bold: true, color: purple })],
  }));

  const eventDate = event.details["event date"] || "";
  const venue = event.details["venue"] || "";
  const venueAddr = event.details["venue address"] || "";
  const metaParts = [eventDate, venue, venueAddr].filter(Boolean);
  if (metaParts.length > 0) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: metaParts.map((part, i) => new TextRun({
        text: (i > 0 ? "\n" : "") + (i === 1 ? `Location: ${part}` : i === 2 ? `Address: ${part}` : part),
        size: 24, font: "Inter", color: "333333",
      })),
    }));
  }

  // Details
  children.push(sectionHeading("Event Details", { font: "Inter", size: 22, color: purple, bold: false }));
  children.push(new Paragraph({ spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: teal, space: 1 } }, children: [] }));
  children.push(...buildDetailParagraphs(event, requiredFields, { fontSize: 12 }));

  // Personnel grouped by department
  if (event.personnel.length > 0) {
    children.push(sectionHeading("Teammates", { font: "Inter", size: 22, color: purple, bold: false }));
    children.push(new Paragraph({ spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: teal, space: 1 } }, children: [] }));
    const groups = groupPersonnelByDept(event.personnel);
    for (const g of groups) {
      children.push(new Paragraph({ spacing: { after: 40 }, children: [
        new TextRun({ text: g.label.toUpperCase(), bold: true, size: 22, font: "Inter", color: purple }),
      ] }));
      for (const p of g.members) {
        children.push(new Paragraph({ spacing: { after: 40 }, indent: { left: 240 }, children: [
          new TextRun({ text: `${p.name} – ${p.role}`, size: 24, font: "Inter", color: "333333" }),
        ] }));
      }
    }
  }

  // Timeline
  if (event.timeline.length > 0) {
    children.push(sectionHeading("Timeline", { font: "Inter", size: 22, color: purple, bold: false }));
    children.push(new Paragraph({ spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: teal, space: 1 } }, children: [] }));
    for (const t of event.timeline) {
      children.push(new Paragraph({
        spacing: { after: 60 },
        indent: { left: 360 },
        children: [
          new TextRun({ text: t.time, bold: true, size: 24, font: "Inter" }),
          new TextRun({ text: ` : ${t.description}`, size: 24, font: "Inter", color: "333333" }),
        ],
      }));
    }
  }

  // Songlist
  if (event.songSections.length > 0) {
    children.push(sectionHeading("Songlist", { font: "Inter", size: 22, color: purple, bold: false }));
    children.push(new Paragraph({ spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: teal, space: 1 } }, children: [] }));
    for (const section of event.songSections) {
      children.push(new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: `${section.time ? section.time + " — " : ""}${section.title}`, bold: true, size: 28, font: "Inter", color: "1a1a1a" })],
      }));
      children.push(buildSongTable(section.songs, purple, true));
    }
  }

  // Footer
  children.push(emptyLine());
  const footerText = isTSB
    ? "TOM STARR BAND · tomstarrband.com"
    : org === "bse"
    ? "BALTIMORE SOUND ENTERTAINMENT · baltimoresound.net"
    : "HARBORLINE · Baltimore's Go-To Live Band · harborlineband.com";
  children.push(new Paragraph({
    spacing: { before: 200 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD", space: 8 } },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: footerText, size: 20, font: "Inter", color: "666666" })],
  }));

  return new Document({
    styles: { default: { document: { run: { font: "Inter", size: 24 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1200, right: 1440, bottom: 1200, left: 1440 },
        },
      },
      children,
    }],
  });
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════

export async function generateDocxBlob(
  event: EventData,
  template: TemplateType,
  organization: OrgKey,
  requiredFields: RequiredField[],
  logoSrc: string,
): Promise<{ blob: Blob; filename: string }> {
  let logoData: { buf: Uint8Array; w: number; h: number } | undefined;
  try {
    logoData = await loadImageAsBuffer(logoSrc);
  } catch {
    console.warn("Failed to load logo for DOCX");
  }

  let doc: Document;

  switch (template) {
    case "client-planner":
      doc = buildClientPlanner(event, requiredFields, logoData);
      break;
    case "wedding-ros":
      doc = buildWeddingRoS(event, requiredFields, logoData);
      break;
    case "corporate-ros":
      doc = buildCorporateRoS(event, requiredFields, organization, logoData);
      break;
    default:
      doc = buildPartyRunSheet(event, requiredFields, organization, logoData);
      break;
  }

  const blob = await Packer.toBlob(doc);
  const filename = `${(event.eventName || "document").replace(/[^a-zA-Z0-9-_ ]/g, "_")}.docx`;
  return { blob, filename };
}

export async function generateDocx(
  event: EventData,
  template: TemplateType,
  organization: OrgKey,
  requiredFields: RequiredField[],
  logoSrc: string,
): Promise<void> {
  const { blob, filename } = await generateDocxBlob(event, template, organization, requiredFields, logoSrc);
  saveAs(blob, filename);
}
