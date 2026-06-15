import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Parse a free-form event-date string ("6/15/2026", "06.15.26", "June 15, 2026", etc.)
// into YYYY-MM-DD, or null if unparseable.
function parseEventDateToISO(raw: string): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // M/D/YYYY or M-D-YYYY or M.D.YYYY
  let m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) {
    const [, mo, d, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // M/D/YY (assume 20YY)
  m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (m) {
    const [, mo, d, yy] = m;
    return `20${yy}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // YYYY-MM-DD passthrough
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // "June 15, 2026" / "Jun 15 2026"
  const monthsLong = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const monthsShort = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const lower = s.toLowerCase().replace(/,/g, '');
  m = lower.match(/^(\w+)\s+(\d{1,2})\s+(\d{4})$/);
  if (m) {
    const [, monStr, d, y] = m;
    const idx = monthsLong.indexOf(monStr);
    const idxShort = monthsShort.indexOf(monStr);
    const monthNum = idx >= 0 ? idx + 1 : (idxShort >= 0 ? idxShort + 1 : 0);
    if (monthNum > 0) {
      return `${y}-${String(monthNum).padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  return null;
}

async function upsertRunOfShow(eventData: any, organization?: string) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  const isoDate = parseEventDateToISO(eventData?.details?.['event date'] || '');
  if (!isoDate) return;
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const venue = eventData?.details?.['venue'] || null;
    const eventName = eventData?.eventName || null;
    const org = organization || null;
    // Upsert by (event_date, venue, organization). The unique index uses
    // COALESCE on venue/organization, so nulls collapse to '' for matching.
    const { data: existing } = await supabase
      .from('run_of_show')
      .select('id')
      .eq('event_date', isoDate)
      .eq('venue', venue ?? '')
      .eq('organization', org ?? '')
      .maybeSingle();
    if (existing?.id) {
      await supabase
        .from('run_of_show')
        .update({
          event_name: eventName,
          details: eventData?.details || {},
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('run_of_show')
        .insert({
          event_date: isoDate,
          event_name: eventName,
          venue,
          organization: org,
          details: eventData?.details || {},
        });
    }
  } catch (_err) {
    // Don't fail the doc generation if persistence has a hiccup.
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const denial = await requireOperator(req);
  if (denial) return denial;

  try {
    const { sheetData, template, format, logos, overrides, requiredFields, organization, preMergedEvent } = await req.json();

    if (!template || !format) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // P7: when the client has already merged multiple sources into one event,
    // skip parse and use it directly. Single-source flow still goes through
    // parseSheetToEvent.
    const eventData: EventData = preMergedEvent
      ? {
          eventName: String(preMergedEvent.eventName || ''),
          details: (preMergedEvent.details && typeof preMergedEvent.details === 'object') ? preMergedEvent.details : {},
          personnel: Array.isArray(preMergedEvent.personnel) ? preMergedEvent.personnel : [],
          timeline: Array.isArray(preMergedEvent.timeline) ? preMergedEvent.timeline : [],
          songSections: Array.isArray(preMergedEvent.songSections) ? preMergedEvent.songSections : [],
          inferredKeys: Array.isArray(preMergedEvent.inferredKeys)
            ? preMergedEvent.inferredKeys.filter((k: unknown) => typeof k === 'string')
            : [],
        }
      : parseSheetToEvent(sheetData || { headers: [], rows: [], sheetTitle: 'Untitled' });
    
    // Organization-specific defaults for project lead and musician POS
    if (!eventData.details['project lead'] && !eventData.details['bandleader']) {
      if (organization === 'tsb') {
        eventData.details['project lead'] = 'Tom Starr';
      } else if (organization === 'harborline') {
        eventData.details['project lead'] = 'Josh Miller';
      }
    }
    // Default musician POS to project lead if not already set
    if (!eventData.details['musician pos']) {
      if (eventData.details['project lead']) {
        eventData.details['musician pos'] = eventData.details['project lead'];
      } else if (eventData.details['bandleader']) {
        eventData.details['musician pos'] = eventData.details['bandleader'];
      }
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

    // Persist a row to run_of_show so availability-checker can flag this date as locked-in.
    // Fire-and-forget: doc generation must succeed even if persistence fails.
    upsertRunOfShow(eventData, organization).catch(() => {});

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
  timeline: { time: string; description: string; inferred?: boolean }[];
  songSections: SongSection[];
  // Detail keys whose values were LLM-inferred (not stated verbatim in source).
  // Rendered with an "(inferred)" tag so the operator can tell derived from stated.
  inferredKeys?: string[];
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
  // Try to find AM/PM anywhere in the string (e.g. "8:10 - 9:00 PM" → PM applies)
  const hasAM = /AM/i.test(timeStr);
  const hasPM = /PM/i.test(timeStr);
  // Extract first HH:MM occurrence
  const m = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 9999;
  let hours = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  if (hasPM && !hasAM && hours < 12) hours += 12;
  if (hasAM && !hasPM && hours === 12) hours = 0;
  // If no AM/PM anywhere in string, assume PM for typical event times (all hours)
  if (!hasAM && !hasPM && hours < 12) hours += 12;
  return hours * 60 + mins;
}

/** Clean up a time string — remove noise like "OR EARLIER", trailing location info in parens */
function cleanTimeString(timeStr: string): string {
  return timeStr
    .replace(/\s+OR\s+EARLIER/gi, '')
    .replace(/\s+OR\s+LATER/gi, '')
    .trim();
}

/** Sort timeline entries chronologically by parsed time, and deduplicate */
function sortTimeline(timeline: { time: string; description: string }[]): { time: string; description: string }[] {
  // Deduplicate: entries with same description (case-insensitive) — keep the one with the cleaner time
  const seen = new Map<string, { time: string; description: string }>();
  for (const entry of timeline) {
    const key = entry.description.toLowerCase().replace(/\s+/g, ' ').replace(/\([^)]*\)/g, '').trim();
    if (!seen.has(key)) {
      seen.set(key, entry);
    }
  }
  const deduped = Array.from(seen.values());
  return deduped.sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
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
  "sound system": "audio reinforcement",
  "pa": "audio reinforcement",
  "pa system": "audio reinforcement",
  "audio": "audio reinforcement",
  "sound reinforcement": "audio reinforcement",
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

// ─── Inferred-value tagging (Class 4) ───────────────────────────────────
// Values the LLM derived (rather than read verbatim) are flagged so the
// rendered doc shows the operator what's stated vs. inferred.
const INFERRED_TAG =
  ' <span style="font-size:0.78em;font-style:italic;color:#999;font-weight:400;letter-spacing:0;">(inferred)</span>';

/** True if `key` (under alias normalization) is in the event's inferred set. */
function isInferredKey(event: EventData, key: string): boolean {
  const keys = event.inferredKeys;
  if (!keys || keys.length === 0) return false;
  const target = DETAIL_KEY_ALIASES[normalizeDetailKey(key)] || normalizeDetailKey(key);
  return keys.some(
    (k) => (DETAIL_KEY_ALIASES[normalizeDetailKey(k)] || normalizeDetailKey(k)) === target,
  );
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
    // Extract singer from parenthetical notes like (JACK), (TOM or Angela), (Tom/Angela)
    for (const song of songs) {
      if (!song.singer && song.notes) {
        const singerMatch = song.notes.match(/\(([A-Za-z][A-Za-z\s\/,&or]+?)\)/);
        if (singerMatch) {
          const candidate = singerMatch[1].trim();
          // Only treat as singer if it looks like a name (short, no equipment words)
          if (candidate.length <= 40 && !/speaker|mic|pa|jbl|monitor|provided|acoustic/i.test(candidate)) {
            song.singer = candidate;
            // Remove the singer parenthetical from notes to avoid duplication
            song.notes = song.notes.replace(singerMatch[0], '').replace(/\s{2,}/g, ' ').trim();
          }
        }
      }
      // Move key data into singer if key looks like a name (no musical key patterns)
      if (song.key && !song.singer) {
        const isMusicalKey = /^[A-G][b#]?\s*(maj|min|m|major|minor)?$/i.test(song.key.trim());
        if (!isMusicalKey) {
          song.singer = song.key;
          song.key = '';
        }
      }
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
  return { eventName, details, personnel, timeline: sortTimeline(timeline), songSections: sortSongSections(songSections) };
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

    // ── Section headers that might look like role lines: "CEREMONY (TOM SOLO) JACK - SOUND" ──
    // Must check BEFORE role matching so known event sections become song section headers
    const eventSectionKeywords = /^(CEREMONY|COCKTAIL\s*HOUR|COCKTAIL|RECEPTION|PRELUDE|PROCESSIONAL|RECESSIONAL|POSTLUDE)/i;
    if (eventSectionKeywords.test(line) && !line.includes(':')) {
      if (currentSongs.length > 0) {
        songSections.push({ title: currentSectionTitle || 'Songs', time: currentSectionTime, songs: currentSongs });
        currentSongs = [];
      }
      // Extract section name (up to first paren or dash)
      const sectionClean = line.match(/^([A-Z][A-Z\s/&]+)/i);
      currentSectionTitle = sectionClean ? sectionClean[1].trim() : line;
      currentSectionTime = '';
      // Store the rest as a detail (e.g., personnel for that section)
      const afterSection = line.replace(eventSectionKeywords, '').trim().replace(/^\([^)]*\)\s*/, '').trim();
      if (afterSection) {
        details[currentSectionTitle.toLowerCase()] = afterSection;
      }
      continue;
    }

    // ── Role assignment lines: "FULL BAND – ..." or "CEREMONY – ..." or "Day-Of Planner – ..." ──
    // Check this BEFORE pipe-delimited details so FULL BAND isn't consumed as key-value
    const roleMatch = line.match(/^([A-Z][A-Z\s/&()-]+?)\s*[–]\s*(.+)$/) || line.match(/^([A-Z][A-Z\s/&()]+?)\s+-\s+(.+)$/) || line.match(/^([A-Za-z][A-Za-z\s/&()-]+?)\s*[–]\s*(.+)$/);
    // Skip lines that look like song/event descriptions ending with "– MC" or similar short role tags
    // e.g. "Private Last Dance / Everyone leave the room / 'Wildflowers & Wine' – MC"
    const looksLikeSongNote = roleMatch && roleMatch[1].trim().length > 30;
    // If we're inside a song section and the "role" is just MC, treat as a song/event note instead
    const isMCInsideSongSection = roleMatch && currentSectionTitle && currentSongs.length > 0 && 
      (roleMatch[1].trim().toUpperCase() === 'MC' || roleMatch[2].trim().toUpperCase() === 'MC');
    const isRoleLine = roleMatch && !looksLikeSongNote && !isMCInsideSongSection && !line.match(/^\d/) && !line.match(/^(Extras|Typically|Moments|Fill|Email|Note|Private|I WANNA|WANNA)/i);
    
    // If it's an MC line inside a song section, add it as a song/event note
    if (isMCInsideSongSection && roleMatch) {
      const mcNote = roleMatch[1].trim().toUpperCase() === 'MC' 
        ? roleMatch[2].trim() 
        : roleMatch[1].trim();
      currentSongs.push({
        order: String(currentSongs.length + 1), request: false,
        title: mcNote, artist: '',
        notes: 'MC', key: '', bpm: '', singer: '', patches: '',
      });
      continue;
    }
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
      let songTitle = '', songArtist = '', songNotes = '', songSinger = '';

      // Pattern: "Mother-Son – Humble & Kind / Tim McGraw (First 60-90 seconds)"
      const dashArtist = songLine.match(/^(.+?)\s*[–\/]\s*(.+?)(?:\s*\((.+)\))?$/);
      if (dashArtist && dashArtist[2].trim().length > 1) {
        songTitle = dashArtist[1].trim();
        songArtist = dashArtist[2].trim();
        songNotes = dashArtist[3] ? dashArtist[3].trim() : '';
      } else {
        // Pattern: "SEPTEMBER ANG" or "TWIST N SHOUT JACK" — song name, singer is last word(s)
        // Also handles "HEY YA -> BROWN EYED GIRL TOM" where singer trails
        const words = songLine.replace(/\([^)]*\)/g, '').trim().split(/\s+/);
        const lastWord = words[words.length - 1];
        songSinger = '';
        // If last word is a short uppercase name (2-10 chars), it's the singer
        if (lastWord && /^[A-Z]+[?]?$/.test(lastWord) && lastWord.length >= 2 && lastWord.length <= 10 && words.length > 1) {
          songSinger = lastWord.replace(/\?$/, '');
          songTitle = words.slice(0, -1).join(' ');
        } else {
          songTitle = songLine;
        }
        // Extract parenthetical notes
        const parenMatch = songLine.match(/\(([^)]*)\)/);
        if (parenMatch) {
          songNotes = parenMatch[1].trim();
          songTitle = songTitle.replace(parenMatch[0], '').trim();
        }
      }

      // Clean up arrow notation like "SUPER->FUNKY" → "SUPER → FUNKY" 
      songTitle = songTitle.replace(/->/g, ' → ').replace(/\s{2,}/g, ' ').trim();

      if (songTitle) {
        currentSongs.push({
          order: String(currentSongs.length + 1), request: false,
          title: songTitle, artist: songArtist,
          notes: songNotes, key: '', bpm: '', singer: songSinger, patches: '',
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

  // ── Post-process all songs: extract singer/key from notes, deduplicate info ──
  for (const section of songSections) {
    for (const song of section.songs) {
      // 1. Extract singer names from notes parentheticals like (JACK), (TOM OR ANGELA), (JACK OR TOM)
      if (!song.singer && song.notes) {
        const singerParenMatch = song.notes.match(/^\(?\s*([A-Za-z]+(?:\s+(?:OR|AND|&|\/)\s+[A-Za-z]+)*)\s*\)?$/i);
        if (singerParenMatch) {
          const candidate = singerParenMatch[1].trim();
          // Verify it's a name (all words are short, no numbers, no musical terms)
          const isName = candidate.split(/\s+(?:OR|AND|&|\/)\s+/i).every(
            w => w.length >= 2 && w.length <= 12 && !/^\d/.test(w) && !/^(first|full|short|seconds?|song|do|ending|minutes?)$/i.test(w)
          );
          if (isName) {
            song.singer = candidate.toUpperCase();
            song.notes = '';
          }
        }
      }
      // Also extract singer from inside notes like "First 60-90 seconds (JACK)"
      if (!song.singer && song.notes) {
        const embeddedSinger = song.notes.match(/\(([A-Z][A-Za-z]*(?:\s+(?:OR|AND|&|\/)\s+[A-Z][A-Za-z]*)*)\)\s*$/);
        if (embeddedSinger) {
          const candidate = embeddedSinger[1].trim();
          const isName = candidate.split(/\s+(?:OR|AND|&|\/)\s+/i).every(
            w => w.length >= 2 && w.length <= 12 && !/^(first|full|short|seconds?|do|ending|minutes?)$/i.test(w)
          );
          if (isName) {
            song.singer = candidate.toUpperCase();
            song.notes = song.notes.replace(embeddedSinger[0], '').trim();
          }
        }
      }

      // 2. Extract musical keys from notes like "(Bb)" or "Key: Am"
      if (!song.key && song.notes) {
        const keyInNotes = song.notes.match(/\b([A-G][b#]?\s*(?:maj|min|m|major|minor)?)\b/i);
        if (keyInNotes) {
          const keyCandidate = keyInNotes[1].trim();
          // Only extract if it really looks like a musical key (not part of a longer word)
          if (/^[A-G][b#]?\s*(?:maj|min|m|major|minor)?$/i.test(keyCandidate)) {
            song.key = keyCandidate;
            song.notes = song.notes.replace(keyInNotes[0], '').replace(/^\s*[,;–-]\s*/, '').replace(/\s*[,;–-]\s*$/, '').trim();
          }
        }
      }

      // 3. Extract singer from title if it's embedded like "First Verse from both vocalists - Joy Stapleton (JACK OR TOM)"
      if (!song.singer && song.title) {
        const titleSingerMatch = song.title.match(/\(([A-Z][A-Za-z]*(?:\s+(?:OR|AND|&|\/)\s+[A-Z][A-Za-z]*)*)\)\s*$/);
        if (titleSingerMatch) {
          const candidate = titleSingerMatch[1].trim();
          const isName = candidate.split(/\s+(?:OR|AND|&|\/)\s+/i).every(
            w => w.length >= 2 && w.length <= 12 && !/^(first|full|short|seconds?|do|ending|minutes?)$/i.test(w)
          );
          if (isName) {
            song.singer = candidate.toUpperCase();
            song.title = song.title.replace(titleSingerMatch[0], '').trim();
          }
        }
      }

      // 4. If key ended up in singer field (musical key pattern), move it
      if (song.singer && /^[A-G][b#]?\s*(?:maj|min|m|major|minor)?$/i.test(song.singer.trim()) && !song.key) {
        song.key = song.singer.trim();
        song.singer = '';
      }

      // 5. If singer info is in key field (not a musical key), move it
      if (song.key && !/^[A-G][b#]?\s*(?:maj|min|m|major|minor)?$/i.test(song.key.trim())) {
        if (!song.singer) {
          song.singer = song.key;
        } else {
          song.notes = song.notes ? `${song.notes}, ${song.key}` : song.key;
        }
        song.key = '';
      }

      // 6. Clean up: remove empty parens, extra whitespace
      song.notes = song.notes.replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
      song.title = song.title.replace(/\s{2,}/g, ' ').trim();
    }
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
    if (normalized && normalized !== rawKey) {
      // Overwrite if target is empty/missing, or if source has more content
      if (!details[normalized] || (!details[normalized].trim() && val.trim())) {
        details[normalized] = val;
      }
    }
  }

  // Fallback: if venue address still missing, check for any key containing "address"
  if (!details['venue address']) {
    for (const [key, val] of Object.entries(details)) {
      if (key.includes('address') && val && val.trim()) {
        details['venue address'] = val;
        break;
      }
    }
  }

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

  // Auto-populate "audio reinforcement" from sound personnel or sound detail
  if (!details['audio reinforcement']) {
    if (details['sound']) {
      // Use explicit sound detail value
      details['audio reinforcement'] = details['sound'];
    }
  }
  // If still empty, derive from sound personnel
  if (!details['audio reinforcement'] && personnel.length > 0) {
    const soundKeywords = ['sound', 'audio', 'a/v', 'av ', 'a1', 'a2', 'monitor', 'foh'];
    const soundPeople = personnel.filter(p => {
      const combined = (p.role + ' ' + p.name).toLowerCase();
      return soundKeywords.some(k => combined.includes(k));
    });
    if (soundPeople.length > 0) {
      // Extract just the person's name (strip sound-related role info)
      const names = soundPeople.map(p => {
        // If the name contains "SOUND", the actual name might be in the role or vice versa
        const nameClean = p.name.replace(/\b(sound|audio|ceremony|cocktail|reception|dinner|foh|monitor)\b/gi, '').replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
        const roleClean = p.role.replace(/\b(sound|audio|ceremony|cocktail|reception|dinner|foh|monitor)\b/gi, '').replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
        return nameClean || roleClean || p.name;
      });
      // Deduplicate names
      const uniqueNames = [...new Set(names.filter(n => n.length > 0))];
      if (uniqueNames.length > 0) {
        details['audio reinforcement'] = uniqueNames.join(', ');
      }
    }
  }
  // Clean up the standalone "sound" key to avoid duplication
  if (details['sound'] && details['audio reinforcement']) {
    delete details['sound'];
  }

  // Default musician POS to project lead / bandleader if not specified
  if (!details['musician pos']) {
    if (details['project lead']) {
      details['musician pos'] = details['project lead'];
    } else if (details['bandleader']) {
      details['musician pos'] = details['bandleader'];
    }
  }

  // Consolidate "what to wear" into "attire"
  if (details['what to wear']) {
    if (!details['attire']) {
      details['attire'] = details['what to wear'];
    }
    delete details['what to wear'];
  }

  // Map "ensemble" from pipe-delimited header if present
  if (!details['ensemble'] && details['musicians']) {
    details['ensemble'] = details['musicians'];
  }

  // DEBUG: Log all parsed detail keys
  console.log('PARSED DETAILS KEYS:', JSON.stringify(Object.keys(details)));
  console.log('VENUE ADDRESS VALUE:', JSON.stringify(details['venue address'] || 'NOT FOUND'));
  console.log('ADDRESS VALUE:', JSON.stringify(details['address'] || 'NOT FOUND'));

  // ── Sort timeline chronologically ──
  const sortedTimeline = sortTimeline(timeline);

  // ── Derive start/end from event timeline (skip load-in/setup; use ceremony/guest arrival → last item's end time) ──
  if (!details['start / end'] && sortedTimeline.length >= 2) {
    // Find first non-load-in/setup entry as the "start"
    const eventStart = sortedTimeline.find(t => 
      !/load[- ]?in|setup|sound\s*check|warehouse|band\s*load/i.test(t.description)
    );
    const eventEnd = sortedTimeline[sortedTimeline.length - 1];
    if (eventStart && eventEnd && eventStart !== eventEnd) {
      // Extract the start time (first time from the start entry)
      const startClean = cleanTimeString(eventStart.time).replace(/\s*[–-]\s*\d.*$/, '').trim();
      // Extract the end time (last time from the end entry — if it's a range like "8:10 - 9:00 PM", use the end)
      const endTimeStr = cleanTimeString(eventEnd.time);
      const endRangeMatch = endTimeStr.match(/\d{1,2}:\d{2}\s*(?:AM|PM)?\s*[–-]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
      const endClean = endRangeMatch ? endRangeMatch[1].trim() : endTimeStr;
      details['start / end'] = `${startClean} – ${endClean}`;
    }
  }

  // Derive load-in time from timeline if present (always prefer timeline time over bullet text)
  const loadInEntry = sortedTimeline.find(t => /load[- ]?in/i.test(t.description));
  if (loadInEntry) {
    if (details['load-in time'] && !/^\d{1,2}:\d{2}/i.test(details['load-in time'])) {
      details['load-in notes'] = details['load-in time'];
    }
    details['load-in time'] = cleanTimeString(loadInEntry.time);
  }

  // Derive setup time from load-in if missing
  if (!details['setup time'] && details['load-in time']) {
    details['setup time'] = details['load-in time'];
  }

  // Extract date from sheetTitle if not found
  if (!details['event date'] && sheetTitle) {
    const titleDateMatch = sheetTitle.match(/(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4})/);
    if (titleDateMatch) {
      details['event date'] = titleDateMatch[1].replace(/\./g, '/');
    }
  }

  // Also try extracting date from any detail value if still missing
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

  // ── Sort song sections in proper event order ──
  const sortedSongSections = sortSongSections(songSections);

  // ── Clean up time strings in details ──
  for (const key of ['load-in time', 'setup time', 'start / end', 'soundcheck']) {
    if (details[key]) {
      details[key] = cleanTimeString(details[key]);
    }
  }

  const eventName = details['event name'] || sheetTitle || 'Event';
  return { eventName, details, personnel, timeline: sortedTimeline, songSections: sortedSongSections };
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

// ─── Personnel Grouping ─────────────────────────────────────────────────

interface PersonnelGroup {
  label: string;
  members: { role: string; name: string }[];
}

function groupPersonnelByDept(personnel: { role: string; name: string }[]): PersonnelGroup[] {
  // Person-level dedup BEFORE grouping: same name with varied role wordings
  // collapses to one entry (belt-and-suspenders for paths that bypass the
  // client-side mergeSources dedup).
  const normName = (n: string) =>
    (n || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const byName = new Map<string, { role: string; name: string }>();
  for (const p of personnel) {
    const k = normName(p.name);
    if (!k) continue;
    const existing = byName.get(k);
    if (!existing) {
      byName.set(k, { ...p });
      continue;
    }
    const oldRole = (existing.role || '').trim();
    const newRole = (p.role || '').trim();
    if (!oldRole) existing.role = newRole;
    else if (!newRole || oldRole === newRole) {/* no-op */}
    else if (oldRole.toLowerCase().includes(newRole.toLowerCase())) {/* keep longer */}
    else if (newRole.toLowerCase().includes(oldRole.toLowerCase())) existing.role = newRole;
    else existing.role = `${oldRole} / ${newRole}`;
  }
  const deduped = Array.from(byName.values());

  // Routing keywords. Order matters: more-specific categories must precede
  // less-specific ones (BOOKING before VENUE before COORD; VENUE before LIGHTING).
  // The Class-2 bug that put Courtney Alday in Lighting came from "events" not
  // having a venue route — she landed in Band as fallback, then got mis-routed
  // by an earlier code path. Explicit venue/booking routing fixes it.
  const bookingKeywords = ['booking', 'sales person', 'salesperson', 'sales rep', 'sales contact', 'bse sales'];
  const venueKeywords = ['venue contact', 'venue manager', 'events manager', 'events & activations', 'activations manager', 'venue coordinator', 'venue events', 'on-site venue', 'aramark events'];
  const soundKeywords = ['sound', 'audio', 'a/v', 'av ', 'a1', 'a2', 'monitor', 'foh'];
  const lightKeywords = ['light', 'lighting', 'ld', 'spots', 'spot op'];
  const productionKeywords = ['mc', 'emcee', 'stage manager', 'production', 'break playlist', 'dj'];
  const coordKeywords = ['coordinator', 'planner'];

  const groups: Record<string, { role: string; name: string }[]> = {
    'Band': [],
    'Booking': [],
    'Venue': [],
    'Sound': [],
    'Lighting': [],
    'Production': [],
    'Coordination': [],
  };

  for (const p of deduped) {
    const combined = (p.role + ' ' + p.name).toLowerCase();
    if (bookingKeywords.some(k => combined.includes(k))) {
      groups['Booking'].push(p);
    } else if (venueKeywords.some(k => combined.includes(k))) {
      groups['Venue'].push(p);
    } else if (soundKeywords.some(k => combined.includes(k))) {
      groups['Sound'].push(p);
    } else if (lightKeywords.some(k => combined.includes(k))) {
      groups['Lighting'].push(p);
    } else if (productionKeywords.some(k => combined.includes(k))) {
      groups['Production'].push(p);
    } else if (coordKeywords.some(k => combined.includes(k))) {
      groups['Coordination'].push(p);
    } else {
      groups['Band'].push(p);
    }
  }

  return Object.entries(groups)
    .filter(([_, members]) => members.length > 0)
    .map(([label, members]) => ({ label, members }));
}

function personnelGroupsToHTML(groups: PersonnelGroup[], roleFirst = true): string {
  return groups.map(g => {
    const memberStr = g.members.map(p => roleFirst ? `${p.role}: ${p.name}` : `${p.name} - ${p.role}`).join('  |  ');
    return `<div style="margin-bottom: 8px;"><strong style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em;">${g.label}:</strong> <span>${memberStr}</span></div>`;
  }).join('');
}

// ─── HTML Generator ─────────────────────────────────────────────────────

type RequiredField = { label: string; key: string };

// Build detail HTML showing all required fields, with blanks for missing ones
// Cross-validate eventName against the structured venue field. When the
// event name (often derived from a Google Doc/Sheet filename) contains a
// venue-word with a typo and the structured `venue` field has the canonical
// spelling, swap to the canonical. Example: filename "6/13 Harborline @
// Guiness Open Gate" (one N) + structured Venue "Guinness Open Gate Brewery"
// (two N) -> eventName becomes "6/13 Harborline @ Guinness Open Gate".
function validatedEventName(event: EventData): string {
  const en = event.eventName || '';
  const venue = (event.details['venue'] || '').toString();
  if (!en || !venue) return en;

  // Tokenize venue (words of length >= 4 only, lowercased).
  const venueTokens = venue.split(/[^a-zA-Z]+/).filter(w => w.length >= 4);
  if (!venueTokens.length) return en;

  const lev1 = (a: string, b: string): boolean => {
    if (a === b) return false; // identical -> not a typo
    const al = a.length, bl = b.length;
    if (Math.abs(al - bl) > 1) return false;
    if (Math.abs(al - bl) === 1) {
      // single insertion/deletion
      const [shorter, longer] = al < bl ? [a, b] : [b, a];
      let i = 0, j = 0, skipped = 0;
      while (i < shorter.length && j < longer.length) {
        if (shorter[i] !== longer[j]) {
          if (skipped) return false;
          skipped = 1;
          j++;
        } else {
          i++; j++;
        }
      }
      return true;
    }
    // same length: single substitution
    let diffs = 0;
    for (let i = 0; i < al; i++) if (a[i] !== b[i]) diffs++;
    return diffs === 1;
  };

  let fixed = en;
  for (const vt of venueTokens) {
    // Find all tokens in eventName that look like typo'd vt
    fixed = fixed.replace(/[A-Za-z]+/g, (word) => {
      if (word.length < 4) return word;
      if (word.toLowerCase() === vt.toLowerCase()) return word;
      if (lev1(word.toLowerCase(), vt.toLowerCase())) {
        // Preserve original casing pattern (UPPER vs Title vs lower).
        if (word === word.toUpperCase()) return vt.toUpperCase();
        if (word[0] === word[0].toUpperCase()) return vt.charAt(0).toUpperCase() + vt.slice(1).toLowerCase();
        return vt.toLowerCase();
      }
      return word;
    });
  }
  return fixed;
}

// Semantic-equivalent field pairs: same datum, different label. When BOTH
// fields are present + values agree (or one is missing), collapse to the
// canonical label. Order: [canonical, alias-to-suppress-if-canonical-wins].
// If the alias is populated and the canonical is blank, the alias value migrates
// onto the canonical label and the alias row is dropped.
const FIELD_EQUIVALENCE_PAIRS: Array<[string, string]> = [
  ['load-in time', 'setup time'],
  ['coordinator', 'venue contact'],
  ['coordinator', 'on-site contact'],
  ['musician pos', 'on-site poc'],
];

// Wedding-only fields that should hide when the event type is clearly non-wedding
// (concerts, corporate, brewery, etc.). Hidden only when the field has no value.
const WEDDING_ONLY_KEYS = new Set(['officiant', 'entrance', 'ceremony', 'recessional', 'processional', 'first look', 'toasts']);

function isNonWeddingEventType(et: string): boolean {
  if (!et) return false;
  const s = et.toLowerCase();
  // Catches "Live Music", "Summer Concert Series", "Corporate", "Brewery",
  // "Birthday", "Anniversary", "Holiday Party", etc.
  if (s.includes('wedding') || s.includes('ceremony')) return false;
  return /(\bconcert\b|\blive music\b|corporate|brewery|birthday|anniversary|holiday|gala|fundraiser|charity|cocktail|reception|party)/.test(s);
}

// Build the field list with: (a) field-equivalence collapse, (b) blank-hide for
// truly-empty fields (no fake underscore placeholder), (c) wedding-field
// suppression when the event type signals non-wedding context.
function resolveFieldsForRender(event: EventData, requiredFields: RequiredField[]): Array<{ label: string; value: string; key: string }> {
  const eventType = (event.details['event type'] || event.details['event_type'] || '').toString();
  const suppressWedding = isNonWeddingEventType(eventType);

  const suppressed = new Set<string>();
  // Equivalence collapse: if canonical has a value, suppress the alias.
  for (const [canonical, alias] of FIELD_EQUIVALENCE_PAIRS) {
    const canVal = getDetailValue(event.details, canonical);
    const aliasVal = getDetailValue(event.details, alias);
    if (canVal && aliasVal) {
      // Both populated -> drop alias regardless (canonical wins).
      suppressed.add(alias);
    } else if (!canVal && aliasVal) {
      // Only alias populated -> migrate alias value to canonical, drop alias row.
      event.details[canonical] = aliasVal;
      suppressed.add(alias);
    }
  }

  const out: Array<{ label: string; value: string }> = [];
  for (const f of requiredFields) {
    if (suppressed.has(f.key)) continue;
    const value = getDetailValue(event.details, f.key);
    if (!value) {
      // Blank-field policy: hide entirely if no value, unless the field is
      // explicitly load-bearing (we keep Event Name + Venue placeholders for
      // structural reasons -- those must show even if blank so the user sees
      // what's missing).
      const alwaysShow = f.key === 'event name' || f.key === 'venue' || f.key === 'event date';
      if (!alwaysShow) continue;
      // Wedding-field suppression: even alwaysShow doesn't apply here (these
      // aren't in WEDDING_ONLY_KEYS), but check anyway.
      if (suppressWedding && WEDDING_ONLY_KEYS.has(f.key)) continue;
    }
    if (!value && suppressWedding && WEDDING_ONLY_KEYS.has(f.key)) continue;
    out.push({ label: f.label, value: value || '', key: f.key });
  }
  return out;
}

function buildAllFieldsHTML(event: EventData, requiredFields?: RequiredField[], cssClass = 'detail-group', labelClass = 'detail-label', valueClass = 'detail-value'): string {
  if (!requiredFields || requiredFields.length === 0) {
    return Object.entries(event.details)
      .filter(([k, v]) => !k.startsWith('vibe:') && !k.startsWith('timing:') && v && v.trim())
      .map(([k, v]) => `<div class="${cssClass}"><div class="${labelClass}">${k.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</div><div class="${valueClass}">${v}${isInferredKey(event, k) ? INFERRED_TAG : ''}</div></div>`)
      .join('');
  }
  const resolved = resolveFieldsForRender(event, requiredFields);
  return resolved.map(f => {
    const display = f.value || '<span style="color:#ccc; letter-spacing:0.1em;">________</span>';
    const tag = f.value && isInferredKey(event, f.key) ? INFERRED_TAG : '';
    return `<div class="${cssClass}"><div class="${labelClass}">${f.label}</div><div class="${valueClass}">${display}${tag}</div></div>`;
  }).join('');
}

// Simpler line-based version for clean templates
function buildAllFieldsLines(event: EventData, requiredFields?: RequiredField[]): string {
  if (!requiredFields || requiredFields.length === 0) {
    return Object.entries(event.details)
      .filter(([k, v]) => !k.startsWith('vibe:') && !k.startsWith('timing:') && v && v.trim())
      .map(([k, v]) => `<div class="detail-row"><strong>${k.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}:</strong> ${v}${isInferredKey(event, k) ? INFERRED_TAG : ''}</div>`)
      .join('');
  }
  const resolved = resolveFieldsForRender(event, requiredFields);
  return resolved.map(f => {
    const display = f.value || '<span style="color:#ccc; letter-spacing:0.1em;">________</span>';
    const tag = f.value && isInferredKey(event, f.key) ? INFERRED_TAG : '';
    return `<div class="detail-row"><strong>${f.label}:</strong> ${display}${tag}</div>`;
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
    .brand-text { max-height: 140px; width: auto; max-width: 320px; margin: 0 auto 24px; display: block; }
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
      .map(([label, k]) => `<div class="detail-line"><strong>${label}:</strong> ${event.details[k as string]}${isInferredKey(event, k as string) ? INFERRED_TAG : ''}</div>`)
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
      timelineHTML += `<div class="song-line"><strong>${t.time}</strong> — ${t.description}${t.inferred ? INFERRED_TAG : ''}</div>`;
    }
  }

  const eventName = validatedEventName(event) || 'Wedding Ceremony Planner';

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
    .brand-text { max-height: 140px; width: auto; max-width: 320px; margin: 0 auto 20px; display: block; }
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
    const groups = groupPersonnelByDept(event.personnel);
    personnelHTML = groups.map(g => {
      const memberStr = g.members.map(p => `<div class="personnel-block"><strong>${p.role}:</strong> ${p.name}</div>`).join('');
      return `<div style="margin-bottom: 12px;"><div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #999; margin-bottom: 4px;">${g.label}</div>${memberStr}</div>`;
    }).join('');
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
      timelineHTML += `<div class="detail-row"><strong>${t.time}</strong> — ${t.description}${t.inferred ? INFERRED_TAG : ''}</div>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${validatedEventName(event)} - Run of Show</title>
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
  const isJMJ = organization === 'jmj';
  const teal = isTSB ? '#E85D04' : isJMJ ? '#0B3D91' : '#14B8A6';
  const darkText = '#1a1a1a';
  const bodyText = '#333333';
  const textLogo = logos?.text || '';

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: white; color: ${bodyText}; line-height: 1.7; font-size: 14px; }
    .page { max-width: 720px; margin: 0 auto; padding: 50px 60px; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid ${teal}; padding-bottom: 24px; }
    .brand-text { max-height: 140px; width: auto; max-width: 320px; margin: 0 auto 12px; display: block; }
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
    const groups = groupPersonnelByDept(event.personnel);
    const groupsHTML = groups.map(g => {
      const memberLines = g.members.map(p => `<div style="padding-left: 12px; margin-bottom: 2px;">${p.role}: ${p.name}</div>`).join('');
      return `<div style="margin-bottom: 14px;"><div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: ${teal}; font-weight: 600; margin-bottom: 4px;">${g.label}</div>${memberLines}</div>`;
    }).join('');
    personnelHTML = `
      <div class="section-title">Team</div>
      <hr class="section-rule" />
      <div class="personnel-text">${groupsHTML}</div>
    `;
  }

  let timelineHTML = '';
  if (event.timeline.length > 0) {
    const items = event.timeline.map(t =>
      `<div class="timeline-item"><span class="timeline-time">${t.time}</span> &mdash; ${t.description}${t.inferred ? INFERRED_TAG : ''}</div>`
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
    const hasKey = allSongs.some(s => s.key && /^[A-G][b#]?\s*(maj|min|m|major|minor)?$/i.test(s.key.trim()));
    const hasBpm = allSongs.some(s => s.bpm);
    const hasSinger = allSongs.some(s => s.singer);

    const sectionsHTML = event.songSections.map(section => {
      const songRows = section.songs.map(s => {
        return `<tr>
          <td style="width:36px; text-align:center;">${s.order || ''}</td>
          <td>${s.title}</td>
          <td>${s.artist}</td>
          ${hasSinger ? `<td>${s.singer || ''}</td>` : ''}
          ${hasKey ? `<td>${s.key}</td>` : ''}
          ${hasBpm ? `<td>${s.bpm}</td>` : ''}
          <td>${s.notes || ''}</td>
        </tr>`;
      }).join('');

      return `
        <div class="set-title">${section.time ? section.time + ' &mdash; ' : ''}${section.title}</div>
        <table class="song-table">
          <thead><tr>
            <th>#</th><th>Title</th><th>Artist</th>
            ${hasSinger ? '<th>Singer</th>' : ''}
            ${hasKey ? '<th>Key</th>' : ''}${hasBpm ? '<th>BPM</th>' : ''}
            <th>Notes</th>
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
  <title>${validatedEventName(event)} - Corporate Event</title>
  <style>${styles}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      ${textLogo ? `<img src="${textLogo}" alt="Logo" class="brand-text" />` : ''}
      <div class="event-title">${validatedEventName(event)}</div>
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
  const isJMJ = organization === 'jmj';
  const purple = isTSB ? '#DC2626' : isJMJ ? '#0B3D91' : '#7C3AED';
  const teal = isTSB ? '#E85D04' : isJMJ ? '#1E40AF' : '#14B8A6';
  const darkText = '#1a1a1a';
  const bodyText = '#333333';
  const mutedText = '#666666';

  const circleColors = isTSB
    ? ['#DC2626', '#E85D04', '#F59E0B', '#EF4444', '#D97706', '#FBBF24']
    : isJMJ
    ? ['#0B3D91', '#1E40AF', '#1D4ED8', '#2563EB', '#3B82F6', '#1E3A8A']
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
    .brand-text { max-height: 140px; width: auto; max-width: 340px; margin: 0 auto; display: block; }
    .event-title { font-family: 'Bebas Neue', sans-serif; font-size: 30px; letter-spacing: 0.06em; color: #111111; margin-top: 28px; text-align: center; }
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
    const groups = groupPersonnelByDept(event.personnel);
    const groupsHTML = groups.map(g => {
      const memberLines = g.members.map(p => `<div style="padding-left: 12px; margin-bottom: 2px;">${p.name} – ${p.role}</div>`).join('');
      return `<div style="margin-bottom: 14px;"><div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: ${purple}; font-weight: 600; margin-bottom: 4px;">${g.label}</div>${memberLines}</div>`;
    }).join('');
    personnelHTML = `
      <div class="section-title">Teammates</div>
      <hr class="section-rule" />
      <div class="personnel-text">${groupsHTML}</div>
    `;
  }

  let timelineHTML = '';
  if (event.timeline.length > 0) {
    const items = event.timeline.map(t =>
      `<li class="timeline-item"><span class="timeline-time">${t.time}</span> : ${t.description}${t.inferred ? INFERRED_TAG : ''}</li>`
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
    const hasKey = allSongs.some(s => s.key && /^[A-G][b#]?\s*(maj|min|m|major|minor)?$/i.test(s.key.trim()));
    const hasBpm = allSongs.some(s => s.bpm);
    const hasSinger = allSongs.some(s => s.singer);

    const sectionsHTML = event.songSections.map(section => {
      const songRows = section.songs.map(s => {
        const reqStar = s.request ? '<span class="request-star">&#9733;</span>' : '';
        return `<tr>
          <td style="width:36px; text-align:center;">${s.order || ''}</td>
          <td style="width:24px; text-align:center;">${reqStar}</td>
          <td>${s.title}</td>
          <td>${s.artist}</td>
          ${hasSinger ? `<td>${s.singer || ''}</td>` : ''}
          ${hasKey ? `<td>${s.key}</td>` : ''}
          ${hasBpm ? `<td>${s.bpm}</td>` : ''}
          <td>${s.notes || ''}</td>
        </tr>`;
      }).join('');

      return `
        <div class="set-title">${section.time ? section.time + ' &mdash; ' : ''}${section.title}</div>
        <table class="song-table">
          <thead>
            <tr>
              <th>#</th>
              <th></th>
              <th>Title</th>
              <th>Artist</th>
              ${hasSinger ? '<th>Singer</th>' : ''}
              ${hasKey ? '<th>Key</th>' : ''}
              ${hasBpm ? '<th>BPM</th>' : ''}
              <th>Notes</th>
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
  <title>${validatedEventName(event)} - Run of Show</title>
  <style>${styles}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="circles">${circlesHTML}</div>
      ${textLogo ? `<img src="${textLogo}" alt="Logo" class="brand-text" />` : ''}
    </div>

    <div class="event-title">${validatedEventName(event)}</div>
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
      ${isTSB ? 'TOM STARR BAND &nbsp;&middot;&nbsp; tomstarrband.com' : isJMJ ? 'JMJ' : organization === 'bse' ? 'BALTIMORE SOUND ENTERTAINMENT &nbsp;&middot;&nbsp; baltimoresound.net' : 'HARBORLINE &nbsp;&middot;&nbsp; Baltimore\'s Go-To Live Band &nbsp;&middot;&nbsp; harborlineband.com'}
    </div>
  </div>
</body>
</html>`;
}