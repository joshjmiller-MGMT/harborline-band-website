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
  title: string; // e.g. "DINNER", "Reception"
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
  const { headers, rows, sheetTitle } = sheetData;
  
  // Combine headers row with data rows into one flat grid
  const allRows: string[][] = [headers, ...rows];
  
  // 1. Scan all cells for label:value pairs
  const details: Record<string, string> = {};
  const labelPatterns = [
    'venue', 'venue address', 'event date', 'client', 'organization',
    'event type', 'event name', 'load-in time', 'soundcheck', 'parking',
    'entrance', 'on site poc', 'green room', 'posting', 'what to wear',
    'attire', 'guest count', 'musician refreshments', 'audio reinforcement',
    'salesperson', 'coordinator', 'venue type', 'setup time', 'start', 'end',
  ];
  
  for (const row of allRows) {
    for (let c = 0; c < row.length - 1; c++) {
      const cell = (row[c] || '').trim();
      const nextCell = (row[c + 1] || '').trim();
      
      // Check for "Label:" pattern (cell ends with colon, or contains colon)
      if (cell.endsWith(':') && nextCell) {
        const label = cell.replace(/:$/, '').trim().toLowerCase();
        if (!details[label] || nextCell.length > details[label].length) {
          details[label] = nextCell;
        }
      }
      // Check for "Label: Value" in the same cell
      if (cell.includes(':') && !cell.match(/^\d+:\d+/)) {
        const colonIdx = cell.indexOf(':');
        const label = cell.substring(0, colonIdx).trim().toLowerCase();
        const value = cell.substring(colonIdx + 1).trim();
        if (value && labelPatterns.some(p => label.includes(p))) {
          details[label] = value;
        }
      }
    }
  }

  // 2. Extract personnel (look for instrument/name pairs in header row area)
  const personnel: { role: string; name: string }[] = [];
  const personnelColStart = findColumnIndex(allRows, 'personell') ?? findColumnIndex(allRows, 'personnel');
  
  if (personnelColStart !== null) {
    // Personnel is usually in the column after "Personell:" label and the one after that
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

  // 3. Extract timeline events from the right-side columns
  const timeline: { time: string; description: string }[] = [];
  for (const row of allRows) {
    for (let c = 0; c < row.length; c++) {
      const cell = (row[c] || '').trim();
      // Match patterns like "8:45 PM First Dance" or "9:00 PM Dance Floor Opens!"
      // Must have real description text after the time (not just "PM" or "AM")
      const timeMatch = cell.match(/^(\d{1,2}:\d{2}\s*(?:PM|AM))\s+(.+)/i);
      if (timeMatch && timeMatch[2].trim().length > 2) {
        timeline.push({ time: timeMatch[1].trim(), description: timeMatch[2].trim() });
      }
      // Also match "9:50ish band ends" style
      const fuzzyMatch = cell.match(/^(\d{1,2}:\d{2}\w*)\s+(.{3,})/);
      if (fuzzyMatch && !timeMatch && fuzzyMatch[2].trim().length > 2) {
        timeline.push({ time: fuzzyMatch[1].trim(), description: fuzzyMatch[2].trim() });
      }
    }
  }
  
  // Also check for "Cocktail:", "Reception" style entries with times in adjacent cells
  for (const row of allRows) {
    for (let c = 0; c < row.length - 1; c++) {
      const cell = (row[c] || '').trim();
      const nextCell = (row[c + 1] || '').trim();
      if (/^(cocktail|reception|ceremony|dinner)/i.test(cell) && nextCell.includes('|')) {
        // "Places / Performance" with "8:15 PM | 8:30 PM" pattern
        const label = cell;
        const times = nextCell;
        if (!timeline.find(t => t.description.toLowerCase().includes(label.toLowerCase()))) {
          timeline.push({ time: times, description: label });
        }
      }
    }
  }

  // 4. Find song table header row and parse songs
  const songSections: SongSection[] = [];
  let songHeaderRow = -1;
  let titleCol = -1, artistCol = -1, notesCol = -1, keyCol = -1, bpmCol = -1, singerCol = -1, patchesCol = -1, numCol = -1, reqCol = -1;

  for (let r = 0; r < allRows.length; r++) {
    const row = allRows[r];
    for (let c = 0; c < row.length; c++) {
      if ((row[c] || '').trim().toLowerCase() === 'title') {
        songHeaderRow = r;
        titleCol = c;
        // Map adjacent columns
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
        // Check if column before title is the request marker column
        if (numCol === -1 && titleCol > 0) {
          // The "#" column and "*" column might be separate
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
      
      // Check for section headers like "8:00 DINNER" or "9:00 PM Reception"
      const sectionMatch = col0.match(/^(\d{1,2}:\d{2}\s*(?:PM|AM)?)/i);
      if (sectionMatch && col1 && !artistVal) {
        // It's a section header
        if (currentSection.songs.length > 0) {
          songSections.push(currentSection);
        }
        currentSection = { title: col1, time: sectionMatch[1], songs: [] };
        continue;
      }
      
      // Skip the "Requests = *" info row
      if (col1.toLowerCase().includes('request')) continue;
      // Skip "Setlist" label row
      if (titleVal.toLowerCase() === 'setlist' || col0.toLowerCase() === 'setlist') continue;
      
      // If we have artist or title, it's a song
      if (artistVal || titleVal) {
        const song: SongEntry = {
          order: numCol >= 0 ? (row[numCol] || '').trim() : col0,
          request: reqCol >= 0 ? (row[reqCol] || '').trim() === '*' : col1 === '*',
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

  // Extract event name from details or sheet title
  const eventName = details['event name'] || details['event'] || sheetTitle || 'Event';

  return { eventName, details, personnel, timeline, songSections };
}

function findColumnIndex(allRows: string[][], keyword: string): number | null {
  for (const row of allRows) {
    for (let c = 0; c < row.length; c++) {
      if ((row[c] || '').trim().toLowerCase().includes(keyword)) {
        return c + 1; // Return the column AFTER the label
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

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: white; color: ${bodyText}; line-height: 1.7; font-size: 14px; }
    .page { max-width: 720px; margin: 0 auto; padding: 50px 60px; }
    .header { text-align: center; margin-bottom: 48px; }
    .circles { display: flex; justify-content: center; gap: 10px; margin-bottom: 20px; }
    .circle { width: 28px; height: 28px; border-radius: 50%; }
    .brand-text { font-family: 'Bebas Neue', sans-serif; font-size: 48px; letter-spacing: 0.08em; color: ${darkText}; line-height: 1; }
    .brand-highlight { color: ${purple}; }
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

  // Event details
  const detailDisplayOrder = [
    ['Event Type', 'event type'],
    ['Venue', 'venue'],
    ['Venue Address', 'venue address'],
    ['Event Date', 'event date'],
    ['Client', 'client'],
    ['Organization', 'organization'],
    ['Guest Count', 'guest count'],
    ['Load-in Time', 'load-in time'],
    ['Soundcheck', 'soundcheck'],
    ['Parking', 'parking'],
    ['Entrance', 'entrance'],
    ['On Site POC', 'on site poc'],
    ['Green Room', 'green room'],
    ['What to Wear', 'what to wear'],
    ['Attire', 'attire'],
    ['Posting', 'posting'],
    ['Musician Refreshments', 'musician refreshments'],
    ['Audio Reinforcement', 'audio reinforcement'],
    ['Venue Type', 'venue type'],
  ];

  const detailsHTML = detailDisplayOrder
    .filter(([, key]) => event.details[key])
    .map(([label, key]) => `
      <div class="detail-group">
        <div class="detail-label">${label}</div>
        <div class="detail-value">${event.details[key]}</div>
      </div>
    `).join('');

  // Personnel
  let personnelHTML = '';
  if (event.personnel.length > 0) {
    const personnelStr = event.personnel.map(p => `${p.name} - ${p.role}`).join(' | ');
    personnelHTML = `
      <div class="section-title">Teammates</div>
      <hr class="section-rule" />
      <div class="personnel-text">${personnelStr}</div>
    `;
  }

  // Timeline
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

  // Songlist sections
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
          <td>${s.key}</td>
          <td>${s.bpm}</td>
          <td>${s.singer}</td>
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
              <th>Key</th>
              <th>BPM</th>
              <th>Singer</th>
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
      <p class="body-text" style="font-size:12px; color:${mutedText}; margin-bottom:16px;">★ = Client request</p>
      ${sectionsHTML}
    `;
  }

  // Build venue/date subtitle
  const eventDate = event.details['event date'] || '';
  const venue = event.details['venue'] || '';
  const venueAddr = event.details['venue address'] || '';
  const startEnd = event.details['load-in time'] ? `Load-in: ${event.details['load-in time']}` : '';

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
      <div class="brand-text">HARBOR<span class="brand-highlight">LINE</span></div>
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
