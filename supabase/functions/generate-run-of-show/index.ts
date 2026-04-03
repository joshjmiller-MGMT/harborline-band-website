const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { sheetData, template, format } = await req.json();

    if (!sheetData || !template || !format) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const eventData = parseSheetToEvent(sheetData);
    const html = generateHTML(eventData);

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
    'salesperson', 'coordinator', 'venue type', 'setup time', 'start', 'end',
    'start / end', 'musicians', 'other staff members', 'musician food & bev',
    "musicians' salesperson", 'coordinator or on-site point of contact',
  ];
  
  for (const row of allRows) {
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
        if (labelPatterns.some(p => cellLower === p) && !details[cellLower]) {
          details[cellLower] = nextCell;
        }
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

  const timeline: { time: string; description: string }[] = [];
  for (const row of allRows) {
    for (let c = 0; c < row.length; c++) {
      const cell = (row[c] || '').trim();
      const timeMatch = cell.match(/^(\d{1,2}:\d{2}\s*(?:PM|AM))\s+(.+)/i);
      if (timeMatch && timeMatch[2].trim().length > 2) {
        timeline.push({ time: timeMatch[1].trim(), description: timeMatch[2].trim() });
      }
      const fuzzyMatch = cell.match(/^(\d{1,2}:\d{2}\w*)\s+(.{3,})/);
      if (fuzzyMatch && !timeMatch && fuzzyMatch[2].trim().length > 2) {
        timeline.push({ time: fuzzyMatch[1].trim(), description: fuzzyMatch[2].trim() });
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
  let songHeaderRow = -1;
  let titleCol = -1, artistCol = -1, notesCol = -1, keyCol = -1, bpmCol = -1, singerCol = -1, patchesCol = -1, numCol = -1, reqCol = -1;

  for (let r = 0; r < allRows.length; r++) {
    const row = allRows[r];
    for (let c = 0; c < row.length; c++) {
      if ((row[c] || '').trim().toLowerCase() === 'title') {
        songHeaderRow = r;
        titleCol = c;
        for (let cc = 0; cc < row.length; cc++) {
          const h = (row[cc] || '').trim().toLowerCase();
          if (h === '#') numCol = cc;
          if (h === 'artist') artistCol = cc;
          if (h === 'arrangement notes') notesCol = cc;
          if (h === 'key') keyCol = cc;
          if (h === 'bpm') bpmCol = cc;
          if (h === 'singer') singerCol = cc;
          if (h.includes('patch')) patchesCol = cc;
        }
        if (numCol === -1 && titleCol > 0) {
          for (let cc = 0; cc < titleCol; cc++) {
            const h = (row[cc] || '').trim();
            if (h === '#') numCol = cc;
            if (h.includes('Request') || h === '*') reqCol = cc;
          }
        }
        break;
      }
    }
    if (songHeaderRow >= 0) break;
  }

  if (songHeaderRow >= 0) {
    let currentSection: SongSection = { title: 'Songs', time: '', songs: [] };
    
    for (let r = songHeaderRow + 1; r < allRows.length; r++) {
      const row = allRows[r];
      const col0 = (row[0] || '').trim();
      const col1 = (row[1] || '').trim();
      const titleVal = titleCol >= 0 ? (row[titleCol] || '').trim() : '';
      const artistVal = artistCol >= 0 ? (row[artistCol] || '').trim() : '';
      
      const sectionMatch = col0.match(/^(\d{1,2}:\d{2}\s*(?:PM|AM)?)/i);
      if (sectionMatch && col1 && !artistVal) {
        if (currentSection.songs.length > 0) {
          songSections.push(currentSection);
        }
        currentSection = { title: col1, time: sectionMatch[1], songs: [] };
        continue;
      }
      
      if (col1.toLowerCase().includes('request')) continue;
      if (titleVal.toLowerCase() === 'setlist' || col0.toLowerCase() === 'setlist') continue;
      
      if (artistVal || titleVal) {
        let orderVal = '';
        if (col0 && /^\d+$/.test(col0)) {
          orderVal = col0;
        } else if (numCol >= 0) {
          const numVal = (row[numCol] || '').trim();
          if (/^\d+$/.test(numVal)) orderVal = numVal;
        }
        const isRequest = col1 === '*' || 
          (reqCol >= 0 && (row[reqCol] || '').trim() === '*') ||
          (numCol >= 0 && (row[numCol] || '').trim() === '*');
        
        const song: SongEntry = {
          order: orderVal,
          request: isRequest,
          artist: artistVal,
          title: titleVal,
          notes: notesCol >= 0 ? (row[notesCol] || '').trim() : '',
          key: keyCol >= 0 ? (row[keyCol] || '').trim() : '',
          bpm: bpmCol >= 0 ? (row[bpmCol] || '').trim() : '',
          singer: singerCol >= 0 ? (row[singerCol] || '').trim() : '',
          patches: patchesCol >= 0 ? (row[patchesCol] || '').trim() : '',
        };
        currentSection.songs.push(song);
      }
    }
    
    if (currentSection.songs.length > 0) {
      songSections.push(currentSection);
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
    'audio reinforcement', "musicians' salesperson", 'salesperson',
    'coordinator or on-site point of contact', 'coordinator', 'on site poc',
    'organization', 'load-in time', 'load-in', 'soundcheck', 'parking', 'entrance',
    'green room', 'what to wear', 'posting', 'address',
  ];

  // ── Phase 1: Try to parse pipe-delimited header line ──
  // e.g. "4-11-2026 | Brian Fierstein Wedding | Location: Vandiver Inn | 7-Piece Band | BLACK TIE ATTIRE"
  const firstLine = lines[0] || '';
  if (firstLine.includes('|')) {
    const segments = firstLine.split('|').map(s => s.trim());
    for (const seg of segments) {
      // Date pattern
      if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}$/.test(seg)) {
        details['event date'] = seg;
      } else if (/location\s*:/i.test(seg)) {
        details['venue'] = seg.replace(/location\s*:\s*/i, '').trim();
      } else if (/piece|solo|duo|trio|quartet|quintet|band/i.test(seg)) {
        details['ensemble'] = seg;
      } else if (/attire|tux|formal|casual|black tie/i.test(seg)) {
        details['attire'] = seg;
      } else if (!details['event name'] && seg.length > 3) {
        details['event name'] = seg;
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

    // Skip if already parsed as header
    if (i === 0 && firstLine.includes('|') && line === firstLine.trim()) continue;

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

    // ── Role assignment lines: "FULL BAND – ..." or "CEREMONY – ..." ──
    // Check this BEFORE pipe-delimited details so FULL BAND isn't consumed as key-value
    const roleMatch = line.match(/^([A-Z][A-Z\s/&()]+?)\s*[–-]\s*(.+)$/);
    if (roleMatch && !line.match(/^\d/)) {
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

    // ── Timeline entries: "4:00 - 4:35 PM – CEREMONY (Tom)" or "8:10 – 9:00 PM – BAND SET 2" ──
    const timelineMatch = line.match(/^(\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?\s*(?:PM|AM)?)\s*[–-]\s*(.+)$/i);
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

    // ── Numbered section headers: "1. Prelude (Guest Arrival) – Approximately 5:40 PM" ──
    const numberedSectionMatch = line.match(/^\d+\.\s+(.+?)(?:\s*[–-]\s*(?:Approximately\s*)?(\d{1,2}:\d{2}\s*(?:PM|AM)?).*)?$/i);
    if (numberedSectionMatch) {
      const potentialTitle = numberedSectionMatch[1].trim();
      if (/prelude|processional|recessional|cocktail|ceremony|reception|dinner|guest/i.test(potentialTitle) ||
          potentialTitle.includes('(') || potentialTitle.length > 20) {
        if (currentSongs.length > 0) {
          songSections.push({ title: currentSectionTitle || 'Songs', time: currentSectionTime, songs: currentSongs });
          currentSongs = [];
        }
        currentSectionTitle = potentialTitle;
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

    // ── Bullet point songs: "- SONG TITLE SINGER" or "* SONG TITLE SINGER" ──
    const bulletMatch = line.match(/^[-•*]\s+(.+)$/);
    if (bulletMatch) {
      const songLine = bulletMatch[1].trim();

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

function generateHTML(event: EventData): string {
  const purple = '#7C3AED';
  const teal = '#14B8A6';
  const darkText = '#1a1a1a';
  const bodyText = '#333333';
  const mutedText = '#666666';

  const circleColors = ['#14B8A6', '#0EA5E9', '#6366F1', '#7C3AED', '#A855F7', '#3B82F6'];
  const logoUrl = 'https://zsfkgncdenqzctdzxedl.supabase.co/storage/v1/object/public/assets/logo-text.png';

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: white; color: ${bodyText}; line-height: 1.7; font-size: 14px; }
    .page { max-width: 720px; margin: 0 auto; padding: 50px 60px; }
    .header { text-align: center; margin-bottom: 48px; }
    .circles { display: flex; justify-content: center; gap: 10px; margin-bottom: 20px; }
    .circle { width: 28px; height: 28px; border-radius: 50%; }
    .brand-logo { max-width: 320px; height: auto; margin: 0 auto; display: block; }
    .event-title { font-family: 'Bebas Neue', sans-serif; font-size: 30px; letter-spacing: 0.06em; color: ${purple}; margin-top: 28px; text-align: center; }
    .event-meta { font-size: 14px; color: ${bodyText}; margin-top: 6px; line-height: 1.8; text-align: center; }
    .section-title { font-family: 'Inter', sans-serif; font-size: 26px; font-weight: 300; color: ${purple}; margin-top: 40px; margin-bottom: 4px; }
    .section-rule { border: none; border-top: 2.5px solid ${teal}; margin-bottom: 20px; }
    .detail-group { margin-bottom: 14px; }
    .detail-label { font-weight: 700; color: ${darkText}; font-size: 14px; margin-bottom: 2px; }
    .detail-value { color: ${bodyText}; font-size: 14px; padding-left: 24px; position: relative; }
    .detail-value::before { content: '●'; position: absolute; left: 4px; color: ${bodyText}; font-size: 8px; top: 4px; }
    .personnel-text { font-size: 14px; color: ${bodyText}; line-height: 1.8; }
    .timeline-list { list-style: none; padding: 0; }
    .timeline-item { padding: 4px 0; padding-left: 24px; position: relative; font-size: 14px; }
    .timeline-item::before { content: '●'; position: absolute; left: 4px; color: ${bodyText}; font-size: 8px; top: 8px; }
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

  const detailDisplayOrder = [
    ['Event Type', 'event type'],
    ['Venue', 'venue'],
    ['Venue Address', 'venue address'],
    ['Event Date', 'event date'],
    ['Client', 'client'],
    ['Organization', 'organization'],
    ['Guest Count', 'guest count'],
    ['Setup Time', 'setup time'],
    ['Start / End', 'start / end'],
    ['Load-in Time', 'load-in time'],
    ['Soundcheck', 'soundcheck'],
    ['Parking', 'parking'],
    ['Entrance', 'entrance'],
    ['On Site POC', 'on site poc'],
    ['Green Room', 'green room'],
    ['What to Wear', 'what to wear'],
    ['Attire', 'attire'],
    ['Posting', 'posting'],
    ['Musician Food & Bev', 'musician food & bev'],
    ['Musician Refreshments', 'musician refreshments'],
    ['Audio Reinforcement', 'audio reinforcement'],
    ['Venue Type', 'venue type'],
    ["Musicians' Salesperson", "musicians' salesperson"],
    ['Coordinator', 'coordinator or on-site point of contact'],
  ];

  const detailsHTML = detailDisplayOrder
    .filter(([, key]) => event.details[key])
    .map(([label, key]) => `
      <div class="detail-group">
        <div class="detail-label">${label}</div>
        <div class="detail-value">${event.details[key]}</div>
      </div>
    `).join('');

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
    const sectionsHTML = event.songSections.map(section => {
      const songRows = section.songs.map(s => {
        const reqStar = s.request ? '<span class="request-star">★</span>' : '';
        return `<tr>
          <td style="width:36px; text-align:center;">${s.order || ''}</td>
          <td style="width:24px; text-align:center;">${reqStar}</td>
          <td>${s.artist}</td>
          <td>${s.title}</td>
          <td>${s.notes}</td>
        </tr>`;
      }).join('');

      return `
        <div class="set-title">${section.time ? section.time + ' — ' : ''}${section.title}</div>
        <table class="song-table">
          <thead>
            <tr>
              <th>#</th>
              <th></th>
              <th>Artist</th>
              <th>Title</th>
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
  <title>${event.eventName} - Run of Show</title>
  <style>${styles}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="circles">${circlesHTML}</div>
      <img src="${logoUrl}" alt="Harborline" class="brand-logo" />
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
      HARBORLINE &nbsp;·&nbsp; Baltimore's Go-To Live Band &nbsp;·&nbsp; harborlineband.com
    </div>
  </div>
</body>
</html>`;
}