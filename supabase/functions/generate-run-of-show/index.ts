const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { sheetData, template, format, logos, overrides, requiredFields, organization } = await req.json();

    if (!template || !format) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const eventData = parseSheetToEvent(sheetData || { headers: [], rows: [], sheetTitle: 'Untitled' });
    
    // TSB default: project lead is always Tom Starr unless otherwise specified
    if (organization === 'tsb' && !eventData.details['project lead'] && !eventData.details['bandleader']) {
      eventData.details['project lead'] = 'Tom Starr';
    }

    // Merge manual overrides into parsed data
    if (overrides && typeof overrides === 'object') {
      for (const [key, value] of Object.entries(overrides)) {
        if (typeof value === 'string' && value.trim()) {
          eventData.details[key.toLowerCase()] = value.trim();
          // Also set event name if overridden
          if (key.toLowerCase() === 'event name') {
            eventData.eventName = value.trim();
          }
        }
      }
    }

    const html = generateHTML(eventData, logos, template, requiredFields, organization);

    // Encode to base64 safely handling UTF-8 / special characters
    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(html);
    let binary = '';
    for (let i = 0; i < htmlBytes.length; i++) {
      binary += String.fromCharCode(htmlBytes[i]);
    }
    const base64 = btoa(binary);

    const filename = `${eventData.eventName || 'run-of-show'}`.replace(/[^a-zA-Z0-9-_]/g, '_');

    return new Response(JSON.stringify({ 
      file: base64, 
      filename,
      format: 'html',
      contentType: 'text/html',
      parsedData: eventData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ─── Types ──────────────────────────────────────────────────────────────

interface EventData {
  eventName: string;
  details: Record<string, string>;
  personnel: { role: string; name: string }[];
  timeline: { time: string; description: string }[];
  songSections: SongSection[];
}

interface SongSection {
  title: string;
  time: string;
  songs: SongEntry[];
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

// ─── Time Utilities ─────────────────────────────────────────────────────

/** Parse a time string like "4:00 PM", "4:00 - 4:40 PM", "1:00 PM OR EARLIER" into minutes since midnight for sorting */
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 9999;
  // Extract first HH:MM AM/PM occurrence
  const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return 9999;
  let hours = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  const ampm = (m[3] || '').toUpperCase();
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  // If no AM/PM specified, assume PM for typical event times (after noon)
  if (!ampm && hours < 8) hours += 12;
  return hours * 60 + mins;
}

/** Clean up a time string — remove noise like "OR EARLIER", trailing location info in parens */
function cleanTimeString(timeStr: string): string {
  return timeStr
    .replace(/\s+OR\s+EARLIER/gi, '')
    .replace(/\s+OR\s+LATER/gi, '')
    .trim();
}

/** Sort timeline entries chronologically by parsed time */
function sortTimeline(timeline: { time: string; description: string }[]): { time: string; description: string }[] {
  return [...timeline].sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
}

/** Section ordering priority — lower = earlier in the event flow */
const SECTION_ORDER: [RegExp, number][] = [
  [/prelud/i, 10],
  [/guest\s*arrival/i, 15],
  [/processional/i, 20],
  [/ceremon/i, 30],
  [/recessional/i, 40],
  [/postlude/i, 45],
  [/cocktail/i, 50],
  [/dinner/i, 60],
  [/reception/i, 65],
  [/intro/i, 68],
  [/first\s*dance/i, 70],
  [/speech/i, 72],
  [/toast/i, 73],
  [/band\s*set\s*1|set\s*1/i, 80],
  [/band\s*set\s*2|set\s*2/i, 90],
  [/band\s*set\s*3|set\s*3/i, 100],
  [/band\s*set\s*4|set\s*4/i, 110],
  [/extra/i, 120],
];

function getSectionSortOrder(title: string): number {
  for (const [pattern, order] of SECTION_ORDER) {
    if (pattern.test(title)) return order;
  }
  return 75; // default: after cocktail, before sets
}

/** Sort song sections in proper event chronological order */
function sortSongSections(sections: SongSection[]): SongSection[] {
  return [...sections].sort((a, b) => {
    const orderA = getSectionSortOrder(a.title);
    const orderB = getSectionSortOrder(b.title);
    if (orderA !== orderB) return orderA - orderB;
    // If same order, sort by time
    return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
  });
}

const DETAIL_KEY_ALIASES: Record<string, string> = {
  "musicians salesperson": "musician salesperson",
  "musicians sales person": "musician salesperson",
  "musician sales person": "musician salesperson",
  salesperson: "musician salesperson",
  "sales person": "musician salesperson",
  "sales rep": "musician salesperson",
  "coordinator or on-site point of contact": "coordinator",
  "coordinator or on site point of contact": "coordinator",
  "on-site point of contact": "coordinator",
  "on site point of contact": "coordinator",
  "event coordinator": "coordinator",
  "day-of coordinator": "coordinator",
  "day of coordinator": "coordinator",
  "wedding coordinator": "coordinator",
  "day-of planner": "coordinator",
  "day of planner": "coordinator",
  "planner": "coordinator",
  "band project lead": "project lead",
  "music project lead": "project lead",
  "musician project lead": "project lead",
  "bandleader": "project lead",
  "band leader": "project lead",
  "on site poc": "musician pos",
  "on-site poc": "musician pos",
  "musician p o s": "musician pos",
  "musician poc": "musician pos",
  "musician point of contact": "musician pos",
  "musician on-site point of contact": "musician pos",
  "musician on site point of contact": "musician pos",
  "musician on-site poc": "musician pos",
  "musician on site poc": "musician pos",
  "musician onsite poc": "musician pos",
  "musician point person": "musician pos",
  "couple": "client",
  "bride and groom": "client",
  "bride & groom": "client",
  "officiant": "officiant",
  "location": "venue",
  "address": "venue address",
  "sound": "audio reinforcement",
  "what to wear": "attire",
  "black tie attire": "attire",
};

function normalizeDetailKey(rawKey: string): string {
  return rawKey
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDetailValue(details: Record<string, string>, lookupKey: string): string {
  const normalizedLookup = DETAIL_KEY_ALIASES[normalizeDetailKey(lookupKey)] || normalizeDetailKey(lookupKey);

  for (const [key, value] of Object.entries(details)) {
    const normalizedKey = DETAIL_KEY_ALIASES[normalizeDetailKey(key)] || normalizeDetailKey(key);
    if (normalizedKey === normalizedLookup && value) {
      return value;
    }
  }

  return details[lookupKey] || '';
}

// ─── Parser ─────────────────────────────────────────────────────────────

function parseSheetToEvent(sheetData: any): EventData {
  const { headers, rows, sheetTitle, rawText, sourceType } = sheetData;
  
  // If we have rawText (from Google Doc or webpage), use text-based parsing
  if (rawText || sourceType === 'google-doc' || sourceType === 'webpage') {
    return parseTextToEvent(rawText || rebuildText(headers, rows), sheetTitle);
  }
  
  // Combine headers row with data rows into one flat grid
  const allRows: string[][] = [headers, ...rows];
  
  // Check if this is single-column data (like a Google Doc export)
  const isSingleColumn = allRows.every(row => row.length <= 1);
  if (isSingleColumn) {
    const text = allRows.map(row => (row[0] || '').replace(/\r/g, '')).join('\n');
    return parseTextToEvent(text, sheetTitle);
  }
  
  // ── Multi-column spreadsheet parsing ──
  const details: Record<string, string> = {};
  const labelPatterns = [
    'venue', 'venue address', 'event date', 'client', 'organization',
    'event type', 'event name', 'load-in time', 'soundcheck', 'parking',
    'entrance', 'on site poc', 'green room', 'posting', 'what to wear',
    'attire', 'guest count', 'musician refreshments', 'audio reinforcement',
    'salesperson', 'sales person', 'sales rep', 'musicians salesperson', 'musicians sales person', 'musician salesperson', 'musician sales person', 'coordinator', 'event coordinator', 'day-of coordinator', 'day of coordinator', 'wedding coordinator', 'project lead', 'band project lead', 'music project lead', 'musician project lead', 'musician pos', 'musician poc', 'musician point of contact', 'musician point person', 'venue type', 'setup time', 'start', 'end',
    'start / end', 'musicians', 'other staff members', 'musician food & bev',
    "musicians' salesperson", 'coordinator or on-site point of contact', 'on-site point of contact', 'on site point of contact',
    'name', 'street address', 'city/state/zip', 'city', 'address',
    'warehouse load-out', 'sound load-in', 'lead load-in', 'band load-in',
    'set 1 time', 'set 2 time', 'set 3 time', 'set 4 time',
  ];
  
  for (const row of allRows) {
    // Scan pairs of adjacent columns for label/value
    for (let c = 0; c < row.length - 1; c++) {
      const cell = (row[c] || '').trim();
      const nextCell = (row[c + 1] || '').trim();
      
      if (cell.endsWith(':') && nextCell) {
        const label = cell.replace(/:$/, '').trim().toLowerCase();
        if (!details[label] || nextCell.length > details[label].length) {
          details[label] = nextCell;
        }
      }
      if (cell.includes(':') && !cell.match(/^\d+:\d+/)) {
        const colonIdx = cell.indexOf(':');
        const label = cell.substring(0, colonIdx).trim().toLowerCase();
        const value = cell.substring(colonIdx + 1).trim();
        if (value && labelPatterns.some(p => label.includes(p))) {
          details[label] = value;
        }
      }
      if (!cell.includes(':') && nextCell && cell.length > 2 && cell.length < 40) {
        const cellLower = cell.toLowerCase();
        if (labelPatterns.some(p => cellLower === p || cellLower.includes(p)) && !details[cellLower]) {
          details[cellLower] = nextCell;
        }
      }
    }
    
    // Also scan non-adjacent columns: label in col N, value in col N+1 across the full row
    // This catches layouts where label/value pairs span across separate column groups
    for (let c = 0; c < row.length; c++) {
      const cell = (row[c] || '').trim();
      if (!cell) continue;
      const cellLower = cell.toLowerCase().replace(/:$/, '');
      if (labelPatterns.some(p => cellLower === p || cellLower.includes(p))) {
        const nextCell = c + 1 < row.length ? (row[c + 1] || '').trim() : '';
        if (nextCell && !details[cellLower]) {
          details[cellLower] = nextCell;
        }
      }
    }
  }

  // Map common label aliases to canonical names
  if (!details['venue'] && details['name']) details['venue'] = details['name'];
  if (!details['venue address'] && details['street address']) {
    let addr = details['street address'];
    if (details['city/state/zip']) addr += ', ' + details['city/state/zip'];
    details['venue address'] = addr;
  }
  // Normalize salesperson aliases
  if (!details["musicians' salesperson"] && details["musicians salesperson"]) {
    details["musicians' salesperson"] = details["musicians salesperson"];
  }
  if (!details["musicians' salesperson"] && details["salesperson"]) {
    details["musicians' salesperson"] = details["salesperson"];
  }
  
  const timeline: { time: string; description: string }[] = [];

  // Build timeline from load-in/soundcheck/set time details
  const timelineDetailKeys = [
    'warehouse load-out', 'sound load-in', 'lead load-in', 'band load-in',
    'soundcheck', 'set 1 time', 'set 2 time', 'set 3 time', 'set 4 time',
  ];
  
  for (const key of timelineDetailKeys) {
    if (details[key]) {
      const label = key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      if (!timeline.find(t => t.description.toLowerCase().includes(key))) {
        timeline.push({ time: details[key], description: label });
      }
    }
  }

  const personnel: { role: string; name: string }[] = [];
  const personnelColStart = findColumnIndex(allRows, 'personell') ?? findColumnIndex(allRows, 'personnel');
  
  if (personnelColStart !== null) {
    for (const row of allRows) {
      const roleCol = personnelColStart;
      const nameCol = personnelColStart + 1;
      if (roleCol < row.length && nameCol < row.length) {
        const role = (row[roleCol] || '').trim();
        const name = (row[nameCol] || '').trim();
        if (role && name && !role.toLowerCase().includes('personell') && !role.toLowerCase().includes('personnel')) {
          personnel.push({ role, name });
        }
      }
    }
  }

  // Also parse inline time entries from cells (but skip pure time-range values like "3:00 PM - 4:00 PM")
  for (const row of allRows) {
    for (let c = 0; c < row.length; c++) {
      const cell = (row[c] || '').trim();
      // Skip cells that are already captured as detail values (time ranges or known labels)
      if (/^\d{1,2}:\d{2}\s*(?:PM|AM)?\s*-\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:PM|AM)?/i.test(cell)) continue;
      // Skip if this exact cell value is already in timeline
      if (timeline.find(t => t.time === cell)) continue;
      
      const timeMatch = cell.match(/^(\d{1,2}:\d{2}\s*(?:PM|AM))\s+(.+)/i);
      if (timeMatch && timeMatch[2].trim().length > 2) {
        // Skip if description is just another time or a known detail value
        const desc = timeMatch[2].trim();
        if (/^\d{1,2}:\d{2}/i.test(desc)) continue;
        if (!timeline.find(t => t.time === timeMatch[1].trim() && t.description === desc)) {
          timeline.push({ time: timeMatch[1].trim(), description: desc });
        }
      }
    }
  }
  
  for (const row of allRows) {
    for (let c = 0; c < row.length - 1; c++) {
      const cell = (row[c] || '').trim();
      const nextCell = (row[c + 1] || '').trim();
      if (/^(cocktail|reception|ceremony|dinner)/i.test(cell) && nextCell.includes('|')) {
        if (!timeline.find(t => t.description.toLowerCase().includes(cell.toLowerCase()))) {
          timeline.push({ time: nextCell, description: cell });
        }
      }
    }
  }

  const songSections: SongSection[] = [];

  // ── Detect SET sections and their respective header rows ──
  // A SET divider row looks like ["SET 1", "", "", ...] or ["SET 2", "", "", ...]
  // After each divider there's a header row with column names
  
  interface SectionRange {
    title: string;
    time: string;
    headerRow: number;
    titleCol: number;
    artistCol: number;
    notesCol: number;
    keyCol: number;
    bpmCol: number;
    singerCol: number;
    patchesCol: number;
    numCol: number;
    reqCol: number;
    startRow: number;
    endRow: number;
  }

  const sectionRanges: SectionRange[] = [];

  function detectSongHeader(row: string[]): { titleCol: number; artistCol: number; notesCol: number; keyCol: number; bpmCol: number; singerCol: number; patchesCol: number; numCol: number; reqCol: number } | null {
    let tCol = -1;
    for (let c = 0; c < row.length; c++) {
      if ((row[c] || '').trim().toLowerCase() === 'title') { tCol = c; break; }
    }
    if (tCol < 0) return null;
    let aCol = -1, nCol = -1, kCol = -1, bCol = -1, sCol = -1, pCol = -1, numC = -1, rCol = -1;
    for (let c = 0; c < row.length; c++) {
      const h = (row[c] || '').trim().toLowerCase();
      if (h === '#') numC = c;
      if (h === 'artist') aCol = c;
      if (h === 'arrangement notes' || h === 'notes') nCol = c;
      if (h === 'key') kCol = c;
      if (h === 'bpm') bCol = c;
      if (h === 'singer' || h === 'lead vox' || h === 'lead vocal' || h === 'vocals') sCol = c;
      if (h.includes('patch')) pCol = c;
      if (h.includes('request') || h === '*') rCol = c;
    }
    return { titleCol: tCol, artistCol: aCol, notesCol: nCol, keyCol: kCol, bpmCol: bCol, singerCol: sCol, patchesCol: pCol, numCol: numC, reqCol: rCol };
  }

  // First pass: find SET divider rows and song header rows
  for (let r = 0; r < allRows.length; r++) {
    const row = allRows[r];
    const col0 = (row[0] || '').trim().toUpperCase();
    
    // Detect "SET 1", "SET 2", etc.
    const setMatch = col0.match(/^SET\s*(\d+)$/);
    if (setMatch) {
      // Look at the time info from details already extracted
      const setNum = setMatch[1];
      const setTimeKey = Object.keys(details).find(k => k.includes(`set ${setNum}`) && k.includes('time'));
      const setTime = setTimeKey ? details[setTimeKey] : '';
      
      // Next row should be the header row
      const nextRow = allRows[r + 1];
      if (nextRow) {
        const cols = detectSongHeader(nextRow);
        if (cols) {
          sectionRanges.push({
            title: `Set ${setNum}`,
            time: setTime,
            headerRow: r + 1,
            ...cols,
            startRow: r + 2,
            endRow: allRows.length, // will be trimmed later
          });
        }
      }
      continue;
    }
  }

  // If no SET sections found, fall back to single section detection
  if (sectionRanges.length === 0) {
    for (let r = 0; r < allRows.length; r++) {
      const cols = detectSongHeader(allRows[r]);
      if (cols) {
        sectionRanges.push({
          title: 'Songs',
          time: '',
          headerRow: r,
          ...cols,
          startRow: r + 1,
          endRow: allRows.length,
        });
        break;
      }
    }
  }

  // Trim endRow for each section to the start of the next section
  for (let i = 0; i < sectionRanges.length - 1; i++) {
    // End at the SET divider row of next section (headerRow - 1)
    sectionRanges[i].endRow = sectionRanges[i + 1].headerRow - 1;
  }

  // Parse songs from each section
  for (const sec of sectionRanges) {
    const songs: SongEntry[] = [];
    for (let r = sec.startRow; r < sec.endRow; r++) {
      const row = allRows[r];
      const titleVal = sec.titleCol >= 0 ? (row[sec.titleCol] || '').trim() : '';
      const artistVal = sec.artistCol >= 0 ? (row[sec.artistCol] || '').trim() : '';
      
      if (!titleVal && !artistVal) continue;
      
      // Skip if this row looks like another header
      if (titleVal.toLowerCase() === 'title' || titleVal.toLowerCase() === 'setlist') continue;
      
      let orderVal = '';
      const col0 = (row[0] || '').trim();
      if (/^\d+$/.test(col0)) {
        orderVal = col0;
      } else if (sec.numCol >= 0) {
        const numVal = (row[sec.numCol] || '').trim();
        if (/^\d+$/.test(numVal)) orderVal = numVal;
      }

      const isRequest = (sec.reqCol >= 0 && (row[sec.reqCol] || '').trim() === '*') ||
        col0 === '*';

      songs.push({
        order: orderVal,
        request: isRequest,
        artist: artistVal,
        title: titleVal,
        notes: sec.notesCol >= 0 ? (row[sec.notesCol] || '').trim() : '',
        key: sec.keyCol >= 0 ? (row[sec.keyCol] || '').trim() : '',
        bpm: sec.bpmCol >= 0 ? (row[sec.bpmCol] || '').trim() : '',
        singer: sec.singerCol >= 0 ? (row[sec.singerCol] || '').trim() : '',
        patches: sec.patchesCol >= 0 ? (row[sec.patchesCol] || '').trim() : '',
      });
    }
    if (songs.length > 0) {
      songSections.push({ title: sec.title, time: sec.time, songs });
    }
  }

  // Try to extract event date from sheet title if not already found
  if (!details['event date'] && sheetTitle) {
    const dateMatch = sheetTitle.match(/(\d{4}\.\d{2}\.\d{2})/);
    if (dateMatch) {
      details['event date'] = dateMatch[1].replace(/\./g, '/');
    }
  }

  // Use venue name from the header area if we found it
  if (!details['event name']) {
    // Try venue name as event name
    const venue = details['venue'] || details['name'] || '';
    if (venue) {
      details['event name'] = venue;
    }
  }

  const eventName = details['event name'] || details['event'] || sheetTitle || 'Event';
  return { eventName, details, personnel, timeline, songSections };
}

// ─── Text-based Parser (Google Docs, webpages) ─────────────────────────

function rebuildText(headers: string[], rows: string[][]): string {
  const allRows = [headers, ...rows];
  return allRows.map(r => (r[0] || '').replace(/\r/g, '')).join('\n');
}

function parseTextToEvent(rawText: string, sheetTitle: string): EventData {
  const text = rawText.replace(/\r/g, '');
  const lines = text.split('\n').filter(l => l.trim() !== '' && !l.trim().match(/^_{3,}$/) && !l.trim().match(/^\*\s*\*\s*\*$/));

  const details: Record<string, string> = {};
  const personnel: { role: string; name: string }[] = [];
  const timeline: { time: string; description: string }[] = [];
  const songSections: SongSection[] = [];

  const detailKeys = [
    'event date', 'event name', 'setup time', 'start / end', 'start', 'end',
    'client', 'event type', 'venue', 'venue address', 'venue type',
    'musicians', 'other staff members', 'guest count', 'attire',
    'musician food & bev', 'musician food and bev', 'musician refreshments',
    'audio reinforcement', "musicians' salesperson", 'musicians salesperson', 'musicians sales person', 'musician salesperson', 'musician sales person', 'salesperson', 'sales person', 'sales rep',
    'coordinator or on-site point of contact', 'coordinator', 'event coordinator', 'day-of coordinator', 'day of coordinator', 'wedding coordinator', 'on-site point of contact', 'on site point of contact', 'on site poc', 'project lead', 'band project lead', 'music project lead', 'musician project lead', 'musician pos', 'musician poc', 'musician point of contact', 'musician point person',
    'organization', 'load-in time', 'load-in', 'soundcheck', 'parking', 'entrance',
    'green room', 'what to wear', 'posting', 'address',
    'officiant', 'day-of planner', 'day of planner', 'planner',
    'couple', 'bride and groom', 'bride & groom', 'location',
  ];

  // ── Phase 1: Try to parse pipe-delimited header line ──
  // Scan first ~5 lines for a pipe-delimited detail line
  // e.g. "4-11-2026 | Couple: Brian Fierstein & Jessica Cochran | Location: Vandiver Inn | 7-Piece Band | BLACK TIE ATTIRE | ADDRESS:301 S Union Ave"
  let pipeLineIndex = -1;
  for (let pi = 0; pi < Math.min(lines.length, 8); pi++) {
    if (lines[pi].includes('|') && (lines[pi].match(/\|/g) || []).length >= 2) {
      pipeLineIndex = pi;
      break;
    }
  }
  const pipeHeaderLine = pipeLineIndex >= 0 ? lines[pipeLineIndex] : '';
  if (pipeHeaderLine) {
    const segments = pipeHeaderLine.split('|').map(s => s.trim());
    for (const seg of segments) {
      // Date pattern
      if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/.test(seg)) {
        details['event date'] = seg;
      } else if (/^couple\s*:/i.test(seg)) {
        details['client'] = seg.replace(/^couple\s*:\s*/i, '').trim();
      } else if (/^location\s*:/i.test(seg)) {
        details['venue'] = seg.replace(/^location\s*:\s*/i, '').trim();
      } else if (/^address\s*:\s*/i.test(seg)) {
        details['venue address'] = seg.replace(/^address\s*:\s*/i, '').trim();
      } else if (/\d+[\s-]*piece|solo|duo|trio|quartet|quintet|band/i.test(seg)) {
        details['ensemble'] = seg;
      } else if (/attire|tux|formal|casual|black\s*tie/i.test(seg)) {
        details['attire'] = seg;
      }
    }
  }

  // ── Phase 2: Role assignment lines ──
  // e.g. "FULL BAND – Drums - John Love | Bass - Rob | ..."
  // e.g. "CEREMONY – Tom Starr (& Jack for PA)"
  // e.g. "LOAD-IN – TBD | PARKING – TBD"
  const roleKeywords = [
    'full band', 'ceremony', 'cocktail hour', 'cocktail', 'mc', 'sound', 'lights',
    'break playlists', 'load-in', 'parking', 'final timeline',
  ];

  let currentSectionTitle = '';
  let currentSectionTime = '';
  let currentSongs: SongEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip if already parsed as pipe-delimited header
    if (pipeLineIndex >= 0 && i === pipeLineIndex) continue;
    // Skip section headers like "BASIC DETAILS", "PERSONNEL / ROLES", "TIMELINE", "LOAD-IN / PARKING"
    if (/^(BASIC DETAILS|PERSONNEL\s*\/?\s*ROLES|TIMELINE|LOAD-IN\s*\/?\s*PARKING)$/i.test(line)) continue;

    // ── ADDRESS: line ──
    const addrMatch = line.match(/^ADDRESS\s*:\s*(.+)/i);
    if (addrMatch) {
      details['venue address'] = addrMatch[1].trim();
      continue;
    }

    // ── "Label: Value" pattern (standard) ──
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < 60) {
      const label = line.substring(0, colonIdx).trim().toLowerCase();
      const value = line.substring(colonIdx + 1).trim();
      // Skip time patterns like "4:00 PM"
      if (value && !label.match(/^\d{1,2}$/) && detailKeys.some(k => label === k || label.includes(k))) {
        details[label] = value;
        continue;
      }
    }

    // ── Role assignment lines: "FULL BAND – ..." or "CEREMONY – ..." or "Day-Of Planner – ..." ──
    // Check this BEFORE pipe-delimited details so FULL BAND isn't consumed as key-value
    const roleMatch = line.match(/^([A-Z][A-Z\s/&()-]+?)\s*[–]\s*(.+)$/) || line.match(/^([A-Z][A-Z\s/&()]+?)\s+-\s+(.+)$/) || line.match(/^([A-Za-z][A-Za-z\s/&()-]+?)\s*[–]\s*(.+)$/);
    const isRoleLine = roleMatch && !line.match(/^\d/) && !line.match(/^(Extras|Typically|Moments|Fill|Email|Note)/i);
    if (isRoleLine && roleMatch) {
      const roleLabel = roleMatch[1].trim();
      const roleValue = roleMatch[2].trim();
      const roleLower = roleLabel.toLowerCase().replace(/\s+/g, ' ');

      if (roleLower.includes('full band') || (roleLower === 'band')) {
        // Parse musicians from pipe-separated "Instrument - Name" pairs
        let musicianLine = roleValue;
        // Check if next line continues (starts with spaces/instrument pattern)
        while (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          const trimmed = nextLine.trim();
          // Continuation: line starts with whitespace or has Instrument - Name pattern
          if ((nextLine.match(/^\s{4,}/) || trimmed.match(/^[A-Z][a-z]+\s*(\/\s*[A-Z])/)) && 
              (trimmed.includes('-') || trimmed.includes('|'))) {
            i++;
            musicianLine += ' | ' + trimmed;
          } else {
            break;
          }
        }
        const musicians = musicianLine.split('|').map(s => s.trim()).filter(Boolean);
        for (const m of musicians) {
          const mMatch = m.match(/^(.+?)\s*-\s*(.+)$/);
          if (mMatch) {
            personnel.push({ role: mMatch[1].trim(), name: mMatch[2].trim() });
          } else if (m.length > 2) {
            personnel.push({ role: 'Musician', name: m });
          }
        }
        continue;
      }

      // Multi-assignment line: "COCKTAIL HOUR – (Duo) Josh Miller, Tom   MC – Tom Starr   SOUND – Jack"
      // Split by multiple UPPERCASE LABEL – value patterns
      const multiRoleSegments = line.match(/([A-Z][A-Z\s/&()]+?)\s*[–-]\s*([^A-Z]*(?:[A-Z][a-z][^–-]*)*?)(?=\s{2,}[A-Z]{2,}\s*[–-]|$)/g);
      if (multiRoleSegments && multiRoleSegments.length > 1) {
        for (const seg of multiRoleSegments) {
          const segMatch = seg.match(/^([A-Z][A-Z\s/&()]+?)\s*[–-]\s*(.+)$/);
          if (segMatch) {
            const k = segMatch[1].trim().toLowerCase().replace(/\s+/g, ' ');
            const v = segMatch[2].trim();
            if (['ceremony', 'cocktail hour', 'cocktail', 'mc', 'sound', 'lights', 'break playlists'].some(kw => k.includes(kw))) {
              details[k] = v;
            } else {
              details[k] = v;
            }
          }
        }
        continue;
      }

      // Single role assignment
      if (['ceremony', 'cocktail hour', 'cocktail', 'mc', 'sound', 'lights', 'break playlists'].some(k => roleLower.includes(k))) {
        details[roleLower] = roleValue;
        continue;
      }

      // Fallback: store as detail
      details[roleLower] = roleValue;
      continue;
    }

    // ── Pipe-delimited detail lines (LOAD-IN – TBD | PARKING – TBD) ──
    // Only if NOT a FULL BAND / role line (already handled above)
    if (line.includes('|') && /^[A-Z\s-]+[–-]/.test(line)) {
      const parts = line.split('|').map(s => s.trim());
      for (const part of parts) {
        const kvMatch = part.match(/^([A-Z][A-Z\s-]+?)\s*[–-]\s*(.+)$/i);
        if (kvMatch) {
          const k = kvMatch[1].trim().toLowerCase().replace(/\s+/g, ' ');
          const v = kvMatch[2].trim();
          if (k.includes('load-in') || k.includes('load in')) details['load-in time'] = v;
          else if (k.includes('parking')) details['parking'] = v;
          else if (k.includes('soundcheck')) details['soundcheck'] = v;
          else if (k.includes('final timeline')) details['final timeline'] = v;
          else details[k] = v;
        }
      }
      continue;
    }

    // ── Continuation lines (indented, with pipe-separated instrument-name pairs) ──
    if (line.includes('|') && line.includes('-') && personnel.length > 0) {
      const musicians = line.split('|').map(s => s.trim()).filter(Boolean);
      for (const m of musicians) {
        const mMatch = m.match(/^(.+?)\s*-\s*(.+)$/);
        if (mMatch) {
          personnel.push({ role: mMatch[1].trim(), name: mMatch[2].trim() });
        }
      }
      continue;
    }

    // ── Timeline entries: "4:00 - 4:35 PM – CEREMONY (Tom)" or "1:00 PM OR EARLIER – LOAD-IN" ──
    const timelineMatch = line.match(/^(\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?\s*(?:PM|AM)?(?:\s+(?:OR\s+)?[A-Z]+)?)\s*[–-]\s*(.+)$/i);
    if (timelineMatch) {
      // Save previous section
      if (currentSongs.length > 0) {
        songSections.push({ title: currentSectionTitle || 'Songs', time: currentSectionTime, songs: currentSongs });
        currentSongs = [];
      }
      currentSectionTime = timelineMatch[1].trim();
      currentSectionTitle = timelineMatch[2].trim();
      timeline.push({ time: currentSectionTime, description: currentSectionTitle });
      continue;
    }

    // ── "@" instruction lines (NOT * which are bullet songs) ──
    if (line.startsWith('@')) {
      const cleanLine = line.replace(/^@\s*/, '').trim();
      if (cleanLine && timeline.length > 0) {
        const lastTl = timeline[timeline.length - 1];
        lastTl.description += ` — ${cleanLine}`;
      }
      continue;
    }

    // ── "Vibe:" description lines — attach to current section ──
    const vibeMatch = line.match(/^Vibe\s*:\s*(.+)$/i);
    if (vibeMatch) {
      // Store as a detail on the current section (we'll use it in rendering)
      if (currentSectionTitle) {
        const vibeKey = `vibe:${currentSectionTitle.toLowerCase()}`;
        details[vibeKey] = vibeMatch[1].trim();
      }
      continue;
    }

    // ── Parenthetical timing notes like "(Approx. 15-20 minutes before the ceremony)" ──
    if (line.startsWith('(') && line.endsWith(')') && currentSectionTitle) {
      const vibeKey = `timing:${currentSectionTitle.toLowerCase()}`;
      details[vibeKey] = line;
      continue;
    }

    // ── Descriptive lines like "Typically, we select a style..." — skip ──
    if (/^(Typically|Moments for|Fill out|Email me|I've put|If you'd|It was great)/i.test(line)) {
      continue;
    }

    // ── Numbered section headers: "1. Prelude (Guest Arrival) – 5–7 songs" ──
    const numberedSectionMatch = line.match(/^\d+\.\s+(.+?)(?:\s*[–-]\s*(?:Approximately\s*)?(\d{1,2}:\d{2}\s*(?:PM|AM)?).*)?$/i);
    if (numberedSectionMatch) {
      const potentialTitle = numberedSectionMatch[1].trim();
      if (/prelude|processional|recessional|cocktail|ceremony|reception|dinner|guest|postlude/i.test(potentialTitle) ||
          potentialTitle.includes('(') || potentialTitle.length > 20) {
        if (currentSongs.length > 0) {
          songSections.push({ title: currentSectionTitle || 'Songs', time: currentSectionTime, songs: currentSongs });
          currentSongs = [];
        }
        // Capture the full section name including song count hint (e.g. "5–7 songs")
        const fullTitle = line.match(/^\d+\.\s+(.+)$/);
        currentSectionTitle = fullTitle ? fullTitle[1].trim() : potentialTitle;
        currentSectionTime = numberedSectionMatch[2] || '';
        if (currentSectionTime) {
          timeline.push({ time: currentSectionTime, description: potentialTitle });
        }
        continue;
      }
      // Otherwise it might be a numbered song "1. Song Title – Artist"
      const numberedSong = line.match(/^\d+\.\s+(.+?)\s*[–-]\s*(.+)$/);
      if (numberedSong) {
        currentSongs.push({
          order: String(currentSongs.length + 1), request: false,
          title: numberedSong[1].trim(), artist: numberedSong[2].trim(),
          notes: '', key: '', bpm: '', singer: '', patches: '',
        });
        continue;
      }
    }

    // ── Bullet point lines ──
    const bulletMatch = line.match(/^[-•*]\s+(.+)$/);
    if (bulletMatch) {
      const songLine = bulletMatch[1].trim();

      // Check if this is a detail line like "Load-in – ..." or "Parking – ..."
      const bulletDetailMatch = songLine.match(/^(Load-?in|Parking|Entrance|Soundcheck|Green Room)\s*[–-]\s*(.+)$/i);
      if (bulletDetailMatch) {
        const k = bulletDetailMatch[1].trim().toLowerCase().replace(/\s+/g, ' ');
        const v = bulletDetailMatch[2].trim();
        if (k.includes('load')) details['load-in time'] = v;
        else if (k.includes('parking')) details['parking'] = v;
        else if (k.includes('entrance')) details['entrance'] = v;
        else if (k.includes('soundcheck')) details['soundcheck'] = v;
        else if (k.includes('green')) details['green room'] = v;
        else details[k] = v;
        continue;
      }

      // Check if this is "Hold on, I'm Comin'" type instruction within a timeline section (not a setlist)
      // If we're in a timeline section (like INTROS, FIRST DANCES) treat these as song entries

      // Try "Song Title – Artist" or "Song Title / Artist"
      let songTitle = '', songArtist = '', songNotes = '';

      // Pattern: "Mother-Son – Humble & Kind / Tim McGraw (First 60-90 seconds)"
      const dashArtist = songLine.match(/^(.+?)\s*[–\/]\s*(.+?)(?:\s*\((.+)\))?$/);
      if (dashArtist && dashArtist[2].trim().length > 1) {
        songTitle = dashArtist[1].trim();
        songArtist = dashArtist[2].trim();
        songNotes = dashArtist[3] ? dashArtist[3].trim() : '';
      } else {
        // Pattern: "SEPTEMBER ANG" or "TWIST N SHOUT JACK" — song name in caps, singer is last word(s)
        // Try to split by looking for a name at the end (2-15 chars, possibly with ?)
        const capsMatch = songLine.match(/^(.+?)\s+([A-Z]{2,}(?:\s*[/?]?\s*[A-Z]*)*)\s*(\([^)]*\))?\s*$/);
        if (capsMatch && capsMatch[2]) {
          songTitle = capsMatch[1].trim();
          songArtist = '';
          songNotes = capsMatch[2].trim();
          if (capsMatch[3]) songNotes += ' ' + capsMatch[3].trim();
          // The last word might be the singer name
          // Check if the whole thing is uppercase (indicating song name + singer mashed together)
          const words = songLine.replace(/\([^)]*\)/g, '').trim().split(/\s+/);
          const lastWord = words[words.length - 1];
          if (lastWord && /^[A-Z]+[?]?$/.test(lastWord) && lastWord.length <= 10) {
            songNotes = lastWord.replace(/\?$/, '');
            songTitle = words.slice(0, -1).join(' ');
            if (songLine.includes('(')) {
              const parenMatch = songLine.match(/\(([^)]*)\)/);
              if (parenMatch) songTitle = songTitle.replace(parenMatch[0], '').trim();
              songNotes += parenMatch ? ' ' + parenMatch[1] : '';
            }
          }
        } else {
          songTitle = songLine;
        }
      }

      // Clean up arrow notation like "SUPER->FUNKY" → "SUPER → FUNKY" 
      songTitle = songTitle.replace(/->/g, ' → ').replace(/\s{2,}/g, ' ').trim();

      if (songTitle) {
        currentSongs.push({
          order: String(currentSongs.length + 1), request: false,
          title: songTitle, artist: songArtist,
          notes: songNotes, key: '', bpm: '', singer: songNotes || '', patches: '',
        });
      }
      continue;
    }

    // ── Bare song lines: "Song Title – Artist" or "Song Title - Artist" (no bullet/number) ──
    // Only if we're inside a section (currentSectionTitle is set)
    if (currentSectionTitle) {
      const bareSongMatch = line.match(/^(.+?)\s*[–-]\s*(.+)$/);
      if (bareSongMatch && bareSongMatch[1].trim().length > 1 && bareSongMatch[2].trim().length > 1) {
        const title = bareSongMatch[1].trim();
        const artist = bareSongMatch[2].trim();
        // Skip if this looks like a label:value pair
        if (!detailKeys.some(k => title.toLowerCase().includes(k))) {
          currentSongs.push({
            order: String(currentSongs.length + 1), request: false,
            title, artist,
            notes: '', key: '', bpm: '', singer: '', patches: '',
          });
          continue;
        }
      }
      // ── Bare uppercase song line (no bullet): "FRANKLIN'S TOWER" or "AIN'T NO SUNSHINE" ──
      // Only if line is mostly uppercase and looks like a song, not a section header
      if (/^[A-Z]/.test(line) && line.length > 2 && line.length < 80 && !line.includes(':') && !line.match(/^(BASIC|PERSONNEL|TIMELINE|LOAD|INTROS|EXTRAS)/i)) {
        const keyMatch = line.match(/^(.+?)\s*\(([A-G][#b]?m?)\)\s*$/);
        const songTitle = keyMatch ? keyMatch[1].trim() : line;
        const songKey = keyMatch ? keyMatch[2] : '';
        currentSongs.push({
          order: String(currentSongs.length + 1), request: false,
          title: songTitle, artist: '',
          notes: '', key: songKey, bpm: '', singer: '', patches: '',
        });
        continue;
      }
    }

    // ── "Extras:" line — attach extra songs to current section ──
    const extrasMatch = line.match(/^Extras?\s*:\s*(.+)$/i);
    if (extrasMatch && currentSectionTitle) {
      const extras = extrasMatch[1].split(',').map(s => s.trim()).filter(Boolean);
      for (const extra of extras) {
        currentSongs.push({
          order: '', request: false,
          title: extra, artist: '',
          notes: 'Extra', key: '', bpm: '', singer: '', patches: '',
        });
      }
      continue;
    }

    // ── Section headers without time: "CEREMONY(TOM & JACK)", "COCKTAIL HOUR SET(TOM & JOSH)" ──
    const sectionHeaderMatch = line.match(/^([A-Z][A-Z\s/&]+?)(?:\s*\((.+)\))?\s*[–-]?\s*$/);
    if (sectionHeaderMatch && line.length > 4 && /^[A-Z]/.test(line) && !line.includes(':')) {
      const sectionName = sectionHeaderMatch[1].trim();
      if (/^(CEREMONY|COCKTAIL|RECEPTION|DINNER|BAND|SET|PRELUDE|PROCESSIONAL|RECESSIONAL|INTROS|FIRST DANCE|SPEECHES)/i.test(sectionName)) {
        if (currentSongs.length > 0) {
          songSections.push({ title: currentSectionTitle || 'Songs', time: currentSectionTime, songs: currentSongs });
          currentSongs = [];
        }
        currentSectionTitle = sectionName;
        currentSectionTime = '';
        if (sectionHeaderMatch[2]) {
          details[sectionName.toLowerCase()] = sectionHeaderMatch[2].trim();
        }
        continue;
      }
    }

    // ── Quoted instruction lines ──
    if (line.startsWith('"') || line.startsWith('\u201C')) {
      const cleanQuote = line.replace(/["\u201C\u201D]/g, '').trim();
      if (timeline.length > 0) {
        timeline[timeline.length - 1].description += ` — ${cleanQuote}`;
      }
      continue;
    }

    // ── Fallback: lines starting with "First Verse", "@ 90 seconds" etc. are instructions ──
    if (/^(first|@|\*|note|please)/i.test(line) && timeline.length > 0) {
      timeline[timeline.length - 1].description += ` — ${line}`;
      continue;
    }
  }

  // Push final section
  if (currentSongs.length > 0) {
    songSections.push({ title: currentSectionTitle || 'Songs', time: currentSectionTime, songs: currentSongs });
  }

  // Extract personnel from details if not already found
  if (personnel.length === 0) {
    if (details['musicians']) {
      personnel.push({ role: 'Musicians', name: details['musicians'] });
    }
    if (details['other staff members']) {
      personnel.push({ role: 'Other Staff', name: details['other staff members'] });
    }
  }

  // Map role details to personnel if found
  const roleToPersonnel: [string, string][] = [
    ['ceremony', 'Ceremony'], ['cocktail hour', 'Cocktail Hour'], ['cocktail', 'Cocktail Hour'],
    ['mc', 'MC'], ['sound', 'Sound'], ['lights', 'Lights'], ['break playlists', 'Break Playlists'],
  ];
  for (const [key, label] of roleToPersonnel) {
    if (details[key] && !personnel.find(p => p.role === label)) {
      personnel.push({ role: label, name: details[key] });
    }
  }

  // Normalize salesperson aliases
  if (!details["musicians' salesperson"] && details["musicians salesperson"]) {
    details["musicians' salesperson"] = details["musicians salesperson"];
  }
  if (!details["musicians' salesperson"] && details["salesperson"]) {
    details["musicians' salesperson"] = details["salesperson"];
  }

  // Apply alias normalization to all stored detail keys
  for (const [rawKey, val] of Object.entries(details)) {
    const normalized = DETAIL_KEY_ALIASES[normalizeDetailKey(rawKey)];
    if (normalized && normalized !== rawKey && !details[normalized]) {
      details[normalized] = val;
    }
  }

  // If "couple" was found, this is a wedding — derive event type and event name
  if (details['client'] && !details['event type']) {
    // If there's a "couple" field, it's a wedding
    const clientLower = (details['client'] || '').toLowerCase();
    const hasCouple = Object.keys(details).some(k => normalizeDetailKey(k) === 'couple' || normalizeDetailKey(k) === 'bride and groom' || normalizeDetailKey(k) === 'bride & groom');
    if (hasCouple || clientLower.includes('&') || clientLower.includes(' and ')) {
      details['event type'] = 'Wedding';
    }
  }

  // Derive event name: "Couple Names - Wedding" if it's a wedding
  if (!details['event name'] && details['client']) {
    if (details['event type'] && details['event type'].toLowerCase() === 'wedding') {
      details['event name'] = `${details['client']} - Wedding`;
    } else {
      details['event name'] = details['client'];
    }
  }

  // Map "sound" detail to "audio reinforcement" if not set
  if (!details['audio reinforcement'] && details['sound']) {
    details['audio reinforcement'] = details['sound'];
  }

  // Map "attire" to "what to wear" and vice versa
  if (!details['what to wear'] && details['attire']) {
    details['what to wear'] = details['attire'];
  }
  if (!details['attire'] && details['what to wear']) {
    details['attire'] = details['what to wear'];
  }

  // Map "ensemble" from pipe-delimited header if present
  if (!details['ensemble'] && details['musicians']) {
    details['ensemble'] = details['musicians'];
  }

  // Derive start/end from first and last timeline entries
  if (!details['start / end'] && timeline.length >= 2) {
    const firstTime = timeline[0]?.time || '';
    const lastTime = timeline[timeline.length - 1]?.time || '';
    if (firstTime && lastTime) {
      details['start / end'] = `${firstTime} – ${lastTime}`;
    }
  }

  // Derive load-in time from timeline if present (always prefer timeline time over bullet text)
  const loadInEntry = timeline.find(t => /load[- ]?in/i.test(t.description));
  if (loadInEntry) {
    // Store the bullet-parsed load-in info as "load-in notes" if it's descriptive text, not a time
    if (details['load-in time'] && !/^\d{1,2}:\d{2}/i.test(details['load-in time'])) {
      details['load-in notes'] = details['load-in time'];
    }
    details['load-in time'] = loadInEntry.time;
  }

  // Derive setup time from load-in if missing
  if (!details['setup time'] && details['load-in time']) {
    details['setup time'] = details['load-in time'];
  }

  // Extract date from sheetTitle if not found (e.g. "4.11.2026 Fierstein Wedding")
  if (!details['event date'] && sheetTitle) {
    const titleDateMatch = sheetTitle.match(/(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4})/);
    if (titleDateMatch) {
      details['event date'] = titleDateMatch[1].replace(/\./g, '/');
    }
  }

  // Also try extracting date from any line if still missing
  if (!details['event date']) {
    for (const [_k, v] of Object.entries(details)) {
      const dMatch = (v || '').match(/(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4})/);
      if (dMatch) {
        details['event date'] = dMatch[1].replace(/\./g, '/');
        break;
      }
    }
  }

  // Map "Day-Of Planner" stored under its role key to coordinator
  if (!details['coordinator'] && details['day-of planner']) {
    details['coordinator'] = details['day-of planner'];
  }

  // Map MC to a detail for templates
  if (!details['mc'] && personnel.find(p => p.role === 'MC')) {
    details['mc'] = personnel.find(p => p.role === 'MC')!.name;
  }

  const eventName = details['event name'] || sheetTitle || 'Event';
  return { eventName, details, personnel, timeline, songSections };
}

function findColumnIndex(allRows: string[][], keyword: string): number | null {
  for (const row of allRows) {
    for (let c = 0; c < row.length; c++) {
      if ((row[c] || '').trim().toLowerCase().includes(keyword)) {
        return c + 1;
      }
    }
  }
  return null;
}

// ─── HTML Generator ─────────────────────────────────────────────────────

type RequiredField = { label: string; key: string };

// Build detail HTML showing all required fields, with blanks for missing ones
function buildAllFieldsHTML(event: EventData, requiredFields?: RequiredField[], cssClass = 'detail-group', labelClass = 'detail-label', valueClass = 'detail-value'): string {
  if (!requiredFields || requiredFields.length === 0) {
    // Fallback: just show what we have
    return Object.entries(event.details)
      .filter(([k]) => !k.startsWith('vibe:') && !k.startsWith('timing:'))
      .map(([k, v]) => `<div class="${cssClass}"><div class="${labelClass}">${k.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</div><div class="${valueClass}">${v}</div></div>`)
      .join('');
  }
  return requiredFields.map(f => {
    const value = getDetailValue(event.details, f.key);
    const display = value || '<span style="color:#ccc; letter-spacing:0.1em;">________</span>';
    return `<div class="${cssClass}"><div class="${labelClass}">${f.label}</div><div class="${valueClass}">${display}</div></div>`;
  }).join('');
}

// Simpler line-based version for clean templates
function buildAllFieldsLines(event: EventData, requiredFields?: RequiredField[]): string {
  if (!requiredFields || requiredFields.length === 0) {
    return Object.entries(event.details)
      .filter(([k]) => !k.startsWith('vibe:') && !k.startsWith('timing:'))
      .map(([k, v]) => `<div class="detail-row"><strong>${k.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}:</strong> ${v}</div>`)
      .join('');
  }
  return requiredFields.map(f => {
    const value = getDetailValue(event.details, f.key);
    const display = value || '<span style="color:#ccc; letter-spacing:0.1em;">________</span>';
    return `<div class="detail-row"><strong>${f.label}:</strong> ${display}</div>`;
  }).join('');
}

function generateHTML(event: EventData, logos?: { circle: string; text: string }, template?: string, requiredFields?: RequiredField[], organization?: string): string {
  if (template === 'client-planner') return generateClientPlannerHTML(event, logos, requiredFields, organization);
  if (template === 'wedding-ros') return generateWeddingROSHTML(event, logos, requiredFields, organization);
  if (template === 'corporate-ros') return generateCorporateHTML(event, logos, requiredFields, organization);
  return generateInternalHTML(event, logos, requiredFields, organization);
}

// ─── Client Planner (Elegant, client-facing) ────────────────────────────

function generateClientPlannerHTML(event: EventData, logos?: { circle: string; text: string }, requiredFields?: RequiredField[], organization?: string): string {
  const textLogo = logos?.text || '';

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: white; color: #333; line-height: 1.8; font-size: 14px; }
    .page { max-width: 680px; margin: 0 auto; padding: 60px 50px; }
    .header { text-align: center; margin-bottom: 40px; }
    .brand-text { max-width: 220px; height: auto; margin: 0 auto 24px; display: block; }
    .intro-text { font-size: 14px; color: #444; line-height: 1.9; margin-bottom: 24px; font-style: italic; }
    .divider { border: none; border-top: 1px solid #ccc; margin: 28px 0; }
    .doc-title { font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 400; color: #1a1a1a; text-align: center; margin-bottom: 8px; letter-spacing: 0.02em; }
    .doc-subtitle { font-size: 13px; color: #888; text-align: center; margin-bottom: 24px; }
    .section-heading { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-weight: 500; color: #1a1a1a; margin-top: 32px; margin-bottom: 4px; }
    .section-timing { font-size: 12px; color: #888; margin-bottom: 6px; font-style: italic; }
    .section-vibe { font-size: 13px; color: #666; margin-bottom: 12px; }
    .section-vibe strong { color: #444; }
    .song-line { font-size: 14px; color: #333; padding: 3px 0 3px 16px; position: relative; }
    .song-line::before { content: ''; position: absolute; left: 0; top: 12px; width: 5px; height: 5px; border-radius: 50%; background: #bbb; }
    .moment-line { font-size: 14px; color: #333; padding: 3px 0 3px 20px; position: relative; }
    .moment-line::before { content: '–'; position: absolute; left: 4px; color: #999; }
    .note-text { font-size: 13px; color: #666; font-style: italic; margin: 8px 0 8px 16px; }
    .detail-line { font-size: 14px; color: #333; margin-bottom: 4px; }
    .detail-line strong { color: #1a1a1a; }
    .footer { text-align: center; margin-top: 48px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 11px; color: #aaa; letter-spacing: 0.08em; text-transform: uppercase; }
    @media print { body { padding: 0; } .page { padding: 30px 40px; } }
  `;

  // Build event details section — use requiredFields if provided
  const detailsHTML = requiredFields 
    ? buildAllFieldsLines(event, requiredFields)
    : [['Event Date', 'event date'], ['Event Type', 'event type'], ['Venue', 'venue'],
       ['Musicians', 'musicians'], ['Ensemble', 'ensemble'], ['Guest Count', 'guest count']]
      .filter(([, k]) => event.details[k as string])
      .map(([label, k]) => `<div class="detail-line"><strong>${label}:</strong> ${event.details[k as string]}</div>`)
      .join('');

  // Build song sections — elegant style with vibes and simple song lines
  let sectionsHTML = '';
  for (const section of event.songSections) {
    sectionsHTML += `<div class="section-heading">${section.title}</div>`;

    // Look for timing/vibe data stored in details
    const sectionKey = section.title.replace(/\s*[–-]\s*\d.*$/, '').trim().toLowerCase();
    const timingNote = Object.entries(event.details).find(([k]) => k.startsWith('timing:') && k.includes(sectionKey));
    const vibeNote = Object.entries(event.details).find(([k]) => k.startsWith('vibe:') && k.includes(sectionKey));

    if (timingNote) {
      sectionsHTML += `<div class="section-timing">${timingNote[1]}</div>`;
    }
    if (section.time) {
      sectionsHTML += `<div class="section-timing">${section.time}</div>`;
    }
    if (vibeNote) {
      sectionsHTML += `<div class="section-vibe"><strong>Vibe:</strong> ${vibeNote[1]}</div>`;
    }
    sectionsHTML += `<hr class="divider" />`;

    for (const song of section.songs) {
      if (song.notes && !song.title.includes('\u2013') && !song.artist) {
        sectionsHTML += `<div class="moment-line">${song.title}${song.notes ? ' \u2014 ' + song.notes : ''}</div>`;
      } else {
        const artistPart = song.artist ? ` \u2013 ${song.artist}` : '';
        sectionsHTML += `<div class="song-line">${song.title}${artistPart}</div>`;
      }
    }
  }

  // Build timeline if present
  let timelineHTML = '';
  if (event.timeline.length > 0) {
    timelineHTML = `<div class="section-heading">Timeline</div><hr class="divider" />`;
    for (const t of event.timeline) {
      timelineHTML += `<div class="song-line"><strong>${t.time}</strong> — ${t.description}</div>`;
    }
  }

  const eventName = event.eventName || 'Wedding Ceremony Planner';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${eventName}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      ${textLogo ? `<img src="${textLogo}" alt="Logo" class="brand-text" />` : ''}
    </div>

    <div class="doc-title">${eventName}</div>
    ${detailsHTML ? `<div style="margin: 16px 0 8px;">${detailsHTML}</div>` : ''}

    <hr class="divider" />

    ${timelineHTML}
    ${sectionsHTML}

    <div class="footer">Thank you for choosing us for your special day</div>
  </div>
</body>
</html>`;
}

// ─── Wedding Run of Show (Musician-facing, professional) ────────────────

function generateWeddingROSHTML(event: EventData, logos?: { circle: string; text: string }, requiredFields?: RequiredField[], organization?: string): string {
  const textLogo = logos?.text || '';

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: white; color: #222; line-height: 1.7; font-size: 14px; }
    .page { max-width: 720px; margin: 0 auto; padding: 50px 55px; }
    .header { text-align: center; margin-bottom: 32px; }
    .brand-text { max-width: 240px; height: auto; margin: 0 auto 20px; display: block; }
    .divider { border: none; border-top: 1.5px solid #222; margin: 20px 0; }
    .divider-light { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
    .detail-row { font-size: 14px; color: #222; margin-bottom: 5px; line-height: 1.6; }
    .detail-row strong { font-weight: 600; }
    .section-title { font-size: 18px; font-weight: 700; color: #222; margin-top: 32px; margin-bottom: 6px; }
    .section-subtitle { font-size: 13px; color: #666; font-style: italic; margin-bottom: 10px; }
    .song-list { list-style: decimal; padding-left: 24px; margin: 8px 0; }
    .song-list li { font-size: 14px; color: #222; padding: 2px 0; }
    .moment-item { font-size: 14px; color: #222; padding: 3px 0 3px 20px; position: relative; }
    .moment-item::before { content: '\\2013'; position: absolute; left: 4px; color: #666; }
    .quote-text { font-size: 13px; color: #555; font-style: italic; margin: 6px 0 10px 8px; border-left: 2px solid #ddd; padding-left: 12px; }
    .personnel-block { font-size: 14px; color: #222; margin-bottom: 4px; }
    .footer { text-align: center; margin-top: 48px; padding-top: 16px; border-top: 1px solid #ccc; font-size: 11px; color: #999; letter-spacing: 0.06em; text-transform: uppercase; }
    @media print { body { padding: 0; } .page { padding: 30px 40px; } }
  `;

  const detailsHTML = buildAllFieldsLines(event, requiredFields);

  // Personnel
  let personnelHTML = '';
  if (event.personnel.length > 0) {
    personnelHTML = event.personnel
      .map(p => `<div class="personnel-block"><strong>${p.role}:</strong> ${p.name}</div>`)
      .join('');
  }

  // Song sections as numbered lists with dividers
  let sectionsHTML = '';
  for (const section of event.songSections) {
    sectionsHTML += `<div class="section-title">${section.title}</div>`;
    if (section.time) {
      sectionsHTML += `<div class="section-subtitle">${section.time}</div>`;
    }
    sectionsHTML += `<hr class="divider-light" />`;

    // Check if songs have processional-style moments (no artist, short titles with context)
    const hasMoments = section.songs.some(s => !s.artist && (s.notes || '').length > 0);

    if (hasMoments) {
      for (const song of section.songs) {
        if (song.artist) {
          sectionsHTML += `<div class="moment-item">${song.title} – ${song.artist}</div>`;
        } else {
          sectionsHTML += `<div class="moment-item">${song.title}${song.notes ? ' (' + song.notes + ')' : ''}</div>`;
        }
      }
    } else {
      sectionsHTML += `<ol class="song-list">`;
      for (const song of section.songs) {
        const artistPart = song.artist ? ` – ${song.artist}` : '';
        sectionsHTML += `<li>${song.title}${artistPart}</li>`;
      }
      sectionsHTML += `</ol>`;
    }
  }

  // Timeline
  let timelineHTML = '';
  if (event.timeline.length > 0) {
    timelineHTML = `<div class="section-title">Timeline</div><hr class="divider-light" />`;
    for (const t of event.timeline) {
      timelineHTML += `<div class="detail-row"><strong>${t.time}</strong> — ${t.description}</div>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${event.eventName} - Run of Show</title>
  <style>${styles}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      ${textLogo ? `<img src="${textLogo}" alt="Logo" class="brand-text" />` : ''}
    </div>

    <hr class="divider" />

    ${detailsHTML}

    ${personnelHTML ? `<div style="margin-top: 12px;">${personnelHTML}</div>` : ''}

    <hr class="divider" />

    <div class="section-title">Run of Show</div>

    ${timelineHTML}
    ${sectionsHTML}

    <div class="footer">Confidential — For musician use only</div>
  </div>
</body>
</html>`;
}

// ─── Corporate Event (Internal, teal-only, cleaner) ─────────────────────

function generateCorporateHTML(event: EventData, logos?: { circle: string; text: string }, requiredFields?: RequiredField[], organization?: string): string {
  const isTSB = organization === 'tsb';
  const teal = isTSB ? '#E85D04' : '#14B8A6';
  const darkText = '#1a1a1a';
  const bodyText = '#333333';
  const textLogo = logos?.text || '';

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: white; color: ${bodyText}; line-height: 1.7; font-size: 14px; }
    .page { max-width: 720px; margin: 0 auto; padding: 50px 60px; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid ${teal}; padding-bottom: 24px; }
    .brand-text { max-width: 260px; height: auto; margin: 0 auto 12px; display: block; }
    .event-title { font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 700; color: ${darkText}; margin-top: 20px; text-align: center; letter-spacing: 0.02em; }
    .event-meta { font-size: 14px; color: ${bodyText}; margin-top: 6px; line-height: 1.8; text-align: center; }
    .section-title { font-size: 18px; font-weight: 600; color: ${teal}; margin-top: 36px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.06em; }
    .section-rule { border: none; border-top: 2px solid ${teal}; margin-bottom: 18px; }
    .detail-group { margin-bottom: 10px; }
    .detail-label { font-weight: 600; color: ${darkText}; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }
    .detail-value { color: ${bodyText}; font-size: 14px; padding-left: 16px; }
    .personnel-text { font-size: 14px; color: ${bodyText}; line-height: 1.8; }
    .timeline-list { list-style: none; padding: 0; }
    .timeline-item { padding: 6px 0; padding-left: 20px; position: relative; font-size: 14px; border-left: 2px solid ${teal}; margin-left: 4px; }
    .timeline-time { font-weight: 600; color: ${darkText}; }
    .set-title { font-weight: 600; font-size: 15px; color: ${darkText}; margin-top: 20px; margin-bottom: 10px; }
    .song-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
    .song-table th { text-align: left; padding: 6px 8px; border-bottom: 2px solid ${teal}; color: ${teal}; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    .song-table td { padding: 5px 8px; border-bottom: 1px solid #eee; }
    .song-table tr:nth-child(even) td { background: #f8fafa; }
    .footer { text-align: center; margin-top: 48px; padding-top: 20px; border-top: 2px solid ${teal}; font-size: 12px; color: #888; }
    @media print { body { padding: 0; } .page { padding: 30px 40px; } }
  `;

  const detailsHTML = buildAllFieldsHTML(event, requiredFields, 'detail-group', 'detail-label', 'detail-value');

  let personnelHTML = '';
  if (event.personnel.length > 0) {
    const personnelStr = event.personnel.map(p => `<strong>${p.role}:</strong> ${p.name}`).join(' &nbsp;|&nbsp; ');
    personnelHTML = `
      <div class="section-title">Team</div>
      <hr class="section-rule" />
      <div class="personnel-text">${personnelStr}</div>
    `;
  }

  let timelineHTML = '';
  if (event.timeline.length > 0) {
    const items = event.timeline.map(t =>
      `<div class="timeline-item"><span class="timeline-time">${t.time}</span> &mdash; ${t.description}</div>`
    ).join('');
    timelineHTML = `
      <div class="section-title">Schedule</div>
      <hr class="section-rule" />
      ${items}
    `;
  }

  let songlistHTML = '';
  if (event.songSections.length > 0) {
    const allSongs = event.songSections.flatMap(s => s.songs);
    const hasKey = allSongs.some(s => s.key);
    const hasBpm = allSongs.some(s => s.bpm);
    const hasSinger = allSongs.some(s => s.singer);
    const hasNotes = allSongs.some(s => s.notes);

    const sectionsHTML = event.songSections.map(section => {
      const songRows = section.songs.map(s => {
        return `<tr>
          <td style="width:36px; text-align:center;">${s.order || ''}</td>
          <td>${s.artist}</td>
          <td>${s.title}</td>
          ${hasKey ? `<td>${s.key}</td>` : ''}
          ${hasBpm ? `<td>${s.bpm}</td>` : ''}
          ${hasSinger ? `<td>${s.singer}</td>` : ''}
          ${hasNotes ? `<td>${s.notes}</td>` : ''}
        </tr>`;
      }).join('');

      return `
        <div class="set-title">${section.time ? section.time + ' &mdash; ' : ''}${section.title}</div>
        <table class="song-table">
          <thead><tr>
            <th>#</th><th>Artist</th><th>Title</th>
            ${hasKey ? '<th>Key</th>' : ''}${hasBpm ? '<th>BPM</th>' : ''}
            ${hasSinger ? '<th>Singer</th>' : ''}${hasNotes ? '<th>Notes</th>' : ''}
          </tr></thead>
          <tbody>${songRows}</tbody>
        </table>
      `;
    }).join('');

    songlistHTML = `
      <div class="section-title">Songlist</div>
      <hr class="section-rule" />
      ${sectionsHTML}
    `;
  }

  const eventDate = event.details['event date'] || '';
  const venue = event.details['venue'] || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${event.eventName} - Corporate Event</title>
  <style>${styles}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      ${textLogo ? `<img src="${textLogo}" alt="Logo" class="brand-text" />` : ''}
      <div class="event-title">${event.eventName}</div>
      <div class="event-meta">
        ${eventDate ? eventDate : ''}${venue ? ` &nbsp;&bull;&nbsp; ${venue}` : ''}
      </div>
    </div>

    ${detailsHTML ? `
      <div class="section-title">Event Details</div>
      <hr class="section-rule" />
      ${detailsHTML}
    ` : ''}

    ${personnelHTML}
    ${timelineHTML}
    ${songlistHTML}

    <div class="footer">Internal Document &nbsp;&bull;&nbsp; Confidential</div>
  </div>
</body>
</html>`;
}

// ─── Internal Template (Party Run Sheet) ────────────────────────────────

function generateInternalHTML(event: EventData, logos?: { circle: string; text: string }, requiredFields?: RequiredField[], organization?: string): string {
  const isTSB = organization === 'tsb';
  const purple = isTSB ? '#DC2626' : '#7C3AED';
  const teal = isTSB ? '#E85D04' : '#14B8A6';
  const darkText = '#1a1a1a';
  const bodyText = '#333333';
  const mutedText = '#666666';

  const circleColors = isTSB 
    ? ['#DC2626', '#E85D04', '#F59E0B', '#EF4444', '#D97706', '#FBBF24']
    : ['#14B8A6', '#0EA5E9', '#6366F1', '#7C3AED', '#A855F7', '#3B82F6'];
  const textLogo = logos?.text || '';

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: white; color: ${bodyText}; line-height: 1.7; font-size: 14px; }
    .page { max-width: 720px; margin: 0 auto; padding: 50px 60px; }
    .header { text-align: center; margin-bottom: 48px; }
    .circles { display: flex; justify-content: center; gap: 10px; margin-bottom: 16px; }
    .circle { width: 28px; height: 28px; border-radius: 50%; }
    .brand-text { max-width: 280px; height: auto; margin: 0 auto; display: block; }
    .event-title { font-family: 'Bebas Neue', sans-serif; font-size: 30px; letter-spacing: 0.06em; color: ${purple}; margin-top: 28px; text-align: center; }
    .event-meta { font-size: 14px; color: ${bodyText}; margin-top: 6px; line-height: 1.8; text-align: center; }
    .section-title { font-family: 'Inter', sans-serif; font-size: 26px; font-weight: 300; color: ${purple}; margin-top: 40px; margin-bottom: 4px; }
    .section-rule { border: none; border-top: 2.5px solid ${teal}; margin-bottom: 20px; }
    .detail-group { margin-bottom: 14px; }
    .detail-label { font-weight: 700; color: ${darkText}; font-size: 14px; margin-bottom: 2px; }
    .detail-value { color: ${bodyText}; font-size: 14px; padding-left: 24px; position: relative; }
    .detail-value::before { content: '\\25CF'; position: absolute; left: 4px; color: ${bodyText}; font-size: 8px; top: 4px; }
    .personnel-text { font-size: 14px; color: ${bodyText}; line-height: 1.8; }
    .timeline-list { list-style: none; padding: 0; }
    .timeline-item { padding: 4px 0; padding-left: 24px; position: relative; font-size: 14px; }
    .timeline-item::before { content: '\\25CF'; position: absolute; left: 4px; color: ${bodyText}; font-size: 8px; top: 8px; }
    .timeline-time { font-weight: 600; }
    .set-title { font-weight: 700; font-size: 16px; color: ${darkText}; margin-top: 24px; margin-bottom: 10px; }
    .song-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
    .song-table th { text-align: left; padding: 6px 8px; border-bottom: 2px solid ${teal}; color: ${purple}; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    .song-table td { padding: 5px 8px; border-bottom: 1px solid #eee; }
    .song-table tr:nth-child(even) td { background: #f9f9f9; }
    .request-star { color: ${purple}; font-weight: 700; }
    .body-text { font-size: 14px; color: ${bodyText}; line-height: 1.8; margin-bottom: 12px; }
    .body-text strong { color: ${darkText}; font-weight: 700; }
    .footer { text-align: center; margin-top: 48px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: ${mutedText}; }
    @media print { body { padding: 0; } .page { padding: 30px 40px; } }
  `;

  const circlesHTML = circleColors.map(c => `<div class="circle" style="background-color: ${c};"></div>`).join('');

  const detailsHTML = buildAllFieldsHTML(event, requiredFields, 'detail-group', 'detail-label', 'detail-value');

  let personnelHTML = '';
  if (event.personnel.length > 0) {
    const personnelStr = event.personnel.map(p => `${p.name} - ${p.role}`).join(' | ');
    personnelHTML = `
      <div class="section-title">Teammates</div>
      <hr class="section-rule" />
      <div class="personnel-text">${personnelStr}</div>
    `;
  }

  let timelineHTML = '';
  if (event.timeline.length > 0) {
    const items = event.timeline.map(t =>
      `<li class="timeline-item"><span class="timeline-time">${t.time}</span> : ${t.description}</li>`
    ).join('');
    timelineHTML = `
      <div class="section-title">Timeline</div>
      <hr class="section-rule" />
      <ul class="timeline-list">${items}</ul>
    `;
  }

  let songlistHTML = '';
  if (event.songSections.length > 0) {
    const allSongs = event.songSections.flatMap(s => s.songs);
    const hasKey = allSongs.some(s => s.key);
    const hasBpm = allSongs.some(s => s.bpm);
    const hasSinger = allSongs.some(s => s.singer);
    const hasNotes = allSongs.some(s => s.notes);

    const sectionsHTML = event.songSections.map(section => {
      const songRows = section.songs.map(s => {
        const reqStar = s.request ? '<span class="request-star">&#9733;</span>' : '';
        return `<tr>
          <td style="width:36px; text-align:center;">${s.order || ''}</td>
          <td style="width:24px; text-align:center;">${reqStar}</td>
          <td>${s.artist}</td>
          <td>${s.title}</td>
          ${hasKey ? `<td>${s.key}</td>` : ''}
          ${hasBpm ? `<td>${s.bpm}</td>` : ''}
          ${hasSinger ? `<td>${s.singer}</td>` : ''}
          ${hasNotes ? `<td>${s.notes}</td>` : ''}
        </tr>`;
      }).join('');

      return `
        <div class="set-title">${section.time ? section.time + ' \\u2014 ' : ''}${section.title}</div>
        <table class="song-table">
          <thead>
            <tr>
              <th>#</th>
              <th></th>
              <th>Artist</th>
              <th>Title</th>
              ${hasKey ? '<th>Key</th>' : ''}
              ${hasBpm ? '<th>BPM</th>' : ''}
              ${hasSinger ? '<th>Singer</th>' : ''}
              ${hasNotes ? '<th>Notes</th>' : ''}
            </tr>
          </thead>
          <tbody>${songRows}</tbody>
        </table>
      `;
    }).join('');

    songlistHTML = `
      <div class="section-title">Songlist</div>
      <hr class="section-rule" />
      ${sectionsHTML}
    `;
  }

  const eventDate = event.details['event date'] || '';
  const venue = event.details['venue'] || '';
  const venueAddr = event.details['venue address'] || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${event.eventName} - Run of Show</title>
  <style>${styles}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="circles">${circlesHTML}</div>
      ${textLogo ? `<img src="${textLogo}" alt="Logo" class="brand-text" />` : ''}
    </div>

    <div class="event-title">${event.eventName}</div>
    <div class="event-meta">
      ${eventDate ? `${eventDate}` : ''}
      ${venue ? `<br/>Location: ${venue}` : ''}
      ${venueAddr ? `<br/>Address: ${venueAddr}` : ''}
    </div>

    ${detailsHTML ? `
      <div class="section-title">Event Details</div>
      <hr class="section-rule" />
      ${detailsHTML}
    ` : ''}

    ${personnelHTML}
    ${timelineHTML}
    ${songlistHTML}

    <div class="footer">
      ${isTSB ? 'TOM STARR BAND &nbsp;\\u00B7&nbsp; tomstarrband.com' : organization === 'bse' ? 'BALTIMORE SOUND ENTERTAINMENT &nbsp;\\u00B7&nbsp; baltimoresound.net' : 'HARBORLINE &nbsp;\\u00B7&nbsp; Baltimore\'s Go-To Live Band &nbsp;\\u00B7&nbsp; harborlineband.com'}
    </div>
  </div>
</body>
</html>`;
}