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

    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(html);
    const base64 = btoa(String.fromCharCode(...htmlBytes));

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
  const lines = text.split('\n').filter(l => l.trim() !== '' && !l.trim().match(/^_{3,}$/));

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
    'organization', 'load-in time', 'soundcheck', 'parking', 'entrance',
    'green room', 'what to wear', 'posting',
  ];

  let currentSectionTitle = '';
  let currentSectionTime = '';
  let currentSongs: SongEntry[] = [];
  let inSongSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for "Label: Value" pattern
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < 60) {
      const label = line.substring(0, colonIdx).trim().toLowerCase();
      const value = line.substring(colonIdx + 1).trim();
      
      if (value && detailKeys.some(k => label === k || label.includes(k))) {
        details[label] = value;
        continue;
      }
    }

    // Check for section headers like "1. Prelude (Guest Arrival) – Approximately 5:40 PM"
    const sectionMatch = line.match(/^\d+\.\s+(.+?)(?:\s*[–-]\s*(?:Approximately\s*)?(\d{1,2}:\d{2}\s*(?:PM|AM)?))?$/i);
    if (sectionMatch) {
      const potentialTitle = sectionMatch[1].trim();
      if (potentialTitle.includes('(') || potentialTitle.length > 15 || 
          /prelude|processional|recessional|cocktail|ceremony|reception|dinner/i.test(potentialTitle)) {
        if (currentSongs.length > 0) {
          songSections.push({ title: currentSectionTitle || 'Songs', time: currentSectionTime, songs: currentSongs });
          currentSongs = [];
        }
        currentSectionTitle = potentialTitle;
        currentSectionTime = sectionMatch[2] || '';
        inSongSection = true;
        
        if (currentSectionTime) {
          timeline.push({ time: currentSectionTime, description: potentialTitle });
        }
        continue;
      }
    }

    // Check for "* Subsection label" markers
    const subSectionMatch = line.match(/^\*\s+(.+)/);
    if (subSectionMatch && inSongSection) {
      const subLabel = subSectionMatch[1].trim();
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const songMatch = nextLine.match(/^\*?\s*(.+?)\s*-\s*(.+)$/);
        if (songMatch) {
          currentSongs.push({
            order: String(currentSongs.length + 1), request: false,
            title: songMatch[1].trim(),
            artist: songMatch[2].trim(),
            notes: subLabel,
            key: '', bpm: '', singer: '', patches: '',
          });
          i++;
          continue;
        }
      }
      continue;
    }

    // Check for numbered songs: "1. Song Title – Artist" or "1. Song Title - Artist"
    const numberedSong = line.match(/^\d+\.\s+(.+?)\s*[–-]\s*(.+)$/);
    if (numberedSong && inSongSection) {
      const songTitle = numberedSong[1].trim();
      const songArtist = numberedSong[2].trim();
      if (!/prelude|processional|recessional|cocktail|ceremony/i.test(songTitle)) {
        currentSongs.push({
          order: String(currentSongs.length + 1),
          request: false,
          title: songTitle,
          artist: songArtist,
          notes: '', key: '', bpm: '', singer: '', patches: '',
        });
        continue;
      }
    }

    // Check for "Song Title - Artist" without number (but with a capital letter after dash)
    const dashSong = line.match(/^\*?\s*(.+?)\s*-\s*([A-Z][\w\s.]+)$/);
    if (dashSong && inSongSection && !line.includes(':')) {
      currentSongs.push({
        order: String(currentSongs.length + 1),
        request: false,
        title: dashSong[1].trim(),
        artist: dashSong[2].trim(),
        notes: '', key: '', bpm: '', singer: '', patches: '',
      });
      continue;
    }

    // Check for "Run of Show" header
    if (/^run of show$/i.test(line)) {
      inSongSection = true;
      continue;
    }

    // Quoted notes / instructions
    if (line.startsWith('"') && inSongSection) {
      const lastTimeline = timeline[timeline.length - 1];
      if (lastTimeline) {
        lastTimeline.description += ` — ${line.replace(/"/g, '')}`;
      }
      continue;
    }
  }

  // Push final section
  if (currentSongs.length > 0) {
    songSections.push({ title: currentSectionTitle || 'Songs', time: currentSectionTime, songs: currentSongs });
  }

  // Extract personnel from details
  if (details['musicians']) {
    personnel.push({ role: 'Musicians', name: details['musicians'] });
  }
  if (details['other staff members']) {
    personnel.push({ role: 'Other Staff', name: details['other staff members'] });
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
  const logoUrl = 'https://harborline.lovable.app/logo-text.png';

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