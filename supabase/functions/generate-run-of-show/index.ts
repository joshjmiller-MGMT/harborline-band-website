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

    // Parse sheet data into structured event info based on template type
    const eventData = parseSheetToEvent(sheetData, template);
    
    // Generate HTML content based on template
    const html = generateHTML(eventData, template);

    // For now, we return the HTML as a "document" 
    // The client will handle the download
    // We encode the HTML as base64 for transport
    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(html);
    const base64 = btoa(String.fromCharCode(...htmlBytes));

    const filename = `${eventData.eventName || 'run-of-show'}_${template}`.replace(/[^a-zA-Z0-9-_]/g, '_');

    return new Response(JSON.stringify({ 
      file: base64, 
      filename,
      format: 'html', // We generate HTML that can be opened/printed as PDF
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

interface EventData {
  eventName: string;
  eventDate: string;
  venue: string;
  venueAddress: string;
  client: string;
  eventType: string;
  setupTime: string;
  startEnd: string;
  musicians: string;
  otherStaff: string;
  guestCount: string;
  attire: string;
  foodBev: string;
  audioReinforcement: string;
  salesperson: string;
  coordinator: string;
  venueType: string;
  sections: EventSection[];
  rawRows: Record<string, string>[];
}

interface EventSection {
  title: string;
  time: string;
  description: string;
  songs: string[];
  notes: string[];
}

function parseSheetToEvent(sheetData: any, template: string): EventData {
  const { headers, rows } = sheetData;
  
  // Convert rows to key-value objects
  const rawRows = rows.map((row: string[]) => {
    const obj: Record<string, string> = {};
    headers.forEach((h: string, i: number) => {
      obj[h.toLowerCase().trim()] = row[i] || '';
    });
    return obj;
  });

  // Try to extract event info from common column patterns
  const findVal = (keys: string[]) => {
    for (const row of rawRows) {
      for (const key of keys) {
        for (const col of Object.keys(row)) {
          if (col.includes(key) && row[col]) return row[col];
        }
      }
    }
    return '';
  };

  // Build sections from rows that look like timeline entries
  const sections: EventSection[] = [];
  let currentSection: EventSection | null = null;

  for (const row of rawRows) {
    const values = Object.values(row);
    const firstVal = values[0]?.trim() || '';
    
    // Check if this row looks like a section header (contains time or section keywords)
    const isSection = /^\d+\.|prelude|processional|recessional|postlude|cocktail|ceremony|dinner|reception|set\s?\d/i.test(firstVal);
    
    if (isSection) {
      if (currentSection) sections.push(currentSection);
      currentSection = {
        title: firstVal,
        time: values[1]?.trim() || '',
        description: values[2]?.trim() || '',
        songs: [],
        notes: [],
      };
    } else if (currentSection && firstVal) {
      // This is a song or note within the current section
      if (firstVal.includes(' - ') || firstVal.includes(' – ')) {
        currentSection.songs.push(firstVal);
      } else {
        currentSection.notes.push(values.join(' ').trim());
      }
    }
  }
  if (currentSection) sections.push(currentSection);

  return {
    eventName: findVal(['event name', 'event', 'name', 'title']) || sheetData.sheetTitle || 'Event',
    eventDate: findVal(['date', 'event date']),
    venue: findVal(['venue', 'location']),
    venueAddress: findVal(['address', 'venue address']),
    client: findVal(['client', 'contact']),
    eventType: findVal(['event type', 'type']),
    setupTime: findVal(['setup', 'setup time']),
    startEnd: findVal(['start', 'time', 'start/end']),
    musicians: findVal(['musician', 'ensemble', 'band']),
    otherStaff: findVal(['staff', 'dj', 'other']),
    guestCount: findVal(['guest', 'count', 'guests']),
    attire: findVal(['attire', 'dress']),
    foodBev: findVal(['food', 'meal', 'catering']),
    audioReinforcement: findVal(['audio', 'sound', 'reinforcement']),
    salesperson: findVal(['salesperson', 'sales']),
    coordinator: findVal(['coordinator', 'point of contact', 'poc']),
    venueType: findVal(['venue type', 'inside', 'outside']),
    sections,
    rawRows,
  };
}

function generateHTML(event: EventData, template: string): string {
  const brandPurple = '#7C3AED';
  const brandBlue = '#3B82F6';
  const darkBg = '#0F1117';
  const cardBg = '#161922';
  const cream = '#F5F0E8';
  const mutedText = '#8B8FA3';

  const baseStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', sans-serif;
      background: ${darkBg};
      color: ${cream};
      padding: 40px;
      line-height: 1.6;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 2px solid ${brandPurple};
    }
    
    .brand-text {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 36px;
      letter-spacing: 0.15em;
      background: linear-gradient(135deg, ${brandPurple}, ${brandBlue});
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }
    
    .event-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 28px;
      letter-spacing: 0.08em;
      color: ${cream};
      margin-bottom: 4px;
    }
    
    .event-subtitle {
      font-size: 14px;
      color: ${mutedText};
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 40px;
      background: ${cardBg};
      padding: 24px;
      border-radius: 8px;
      border: 1px solid rgba(124, 58, 237, 0.2);
    }
    
    .info-item {
      font-size: 13px;
    }
    
    .info-label {
      color: ${brandPurple};
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 2px;
    }
    
    .info-value {
      color: ${cream};
    }
    
    .section {
      margin-bottom: 32px;
      background: ${cardBg};
      border-radius: 8px;
      padding: 24px;
      border-left: 3px solid ${brandPurple};
    }
    
    .section-header {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 22px;
      letter-spacing: 0.08em;
      color: ${cream};
      margin-bottom: 4px;
    }
    
    .section-time {
      font-size: 13px;
      color: ${brandBlue};
      font-weight: 500;
      margin-bottom: 12px;
    }
    
    .section-description {
      font-size: 13px;
      color: ${mutedText};
      font-style: italic;
      margin-bottom: 12px;
    }
    
    .song-list {
      list-style: none;
      padding: 0;
    }
    
    .song-item {
      padding: 6px 0;
      font-size: 14px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      display: flex;
      gap: 8px;
    }
    
    .song-number {
      color: ${brandPurple};
      font-weight: 600;
      min-width: 24px;
    }
    
    .note-item {
      font-size: 13px;
      color: ${mutedText};
      padding: 4px 0;
      padding-left: 12px;
      border-left: 2px solid rgba(124, 58, 237, 0.3);
      margin-top: 4px;
    }
    
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.1);
      font-size: 12px;
      color: ${mutedText};
    }
    
    .raw-data {
      margin-top: 40px;
    }
    
    .raw-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    
    .raw-table th {
      background: ${brandPurple};
      color: white;
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .raw-table td {
      padding: 8px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    
    .raw-table tr:nth-child(even) td {
      background: rgba(255,255,255,0.02);
    }

    @media print {
      body { background: white; color: #1a1a1a; padding: 20px; }
      .info-grid, .section { background: #f8f8f8; border-color: ${brandPurple}; }
      .info-value, .event-title, .section-header { color: #1a1a1a; }
      .song-item { color: #333; }
    }
  `;

  const infoFields = [
    { label: 'Event Date', value: event.eventDate },
    { label: 'Event Type', value: event.eventType },
    { label: 'Venue', value: event.venue },
    { label: 'Venue Address', value: event.venueAddress },
    { label: 'Client', value: event.client },
    { label: 'Guest Count', value: event.guestCount },
    { label: 'Setup Time', value: event.setupTime },
    { label: 'Start / End', value: event.startEnd },
    { label: 'Musicians', value: event.musicians },
    { label: 'Other Staff', value: event.otherStaff },
    { label: 'Attire', value: event.attire },
    { label: 'Food & Bev', value: event.foodBev },
    { label: 'Audio Reinforcement', value: event.audioReinforcement },
    { label: 'Venue Type', value: event.venueType },
    { label: 'Salesperson', value: event.salesperson },
    { label: 'Coordinator', value: event.coordinator },
  ].filter(f => f.value);

  const infoGridHTML = infoFields.map(f => `
    <div class="info-item">
      <div class="info-label">${f.label}</div>
      <div class="info-value">${f.value}</div>
    </div>
  `).join('');

  const sectionsHTML = event.sections.map(section => `
    <div class="section">
      <div class="section-header">${section.title}</div>
      ${section.time ? `<div class="section-time">${section.time}</div>` : ''}
      ${section.description ? `<div class="section-description">${section.description}</div>` : ''}
      ${section.songs.length > 0 ? `
        <ol class="song-list">
          ${section.songs.map((s, i) => `
            <li class="song-item">
              <span class="song-number">${i + 1}.</span>
              <span>${s}</span>
            </li>
          `).join('')}
        </ol>
      ` : ''}
      ${section.notes.map(n => `<div class="note-item">${n}</div>`).join('')}
    </div>
  `).join('');

  // If no structured sections were found, show raw data as table
  let rawDataHTML = '';
  if (event.sections.length === 0 && event.rawRows.length > 0) {
    const cols = Object.keys(event.rawRows[0]);
    rawDataHTML = `
      <div class="raw-data">
        <div class="section-header" style="margin-bottom: 16px;">Event Data</div>
        <table class="raw-table">
          <thead>
            <tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${event.rawRows.map(row => `
              <tr>${cols.map(c => `<td>${row[c] || ''}</td>`).join('')}</tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${event.eventName} - Run of Show</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand-text">HARBORLINE</div>
      <div class="event-title">${event.eventName}</div>
      ${event.eventDate ? `<div class="event-subtitle">${event.eventDate}${event.venue ? ` · ${event.venue}` : ''}</div>` : ''}
    </div>
    
    ${infoFields.length > 0 ? `<div class="info-grid">${infoGridHTML}</div>` : ''}
    
    ${event.sections.length > 0 ? `<h2 class="section-header" style="margin-bottom: 20px; font-size: 26px;">Run of Show</h2>` : ''}
    ${sectionsHTML}
    ${rawDataHTML}
    
    <div class="footer">
      HARBORLINE &nbsp;·&nbsp; Baltimore's Go-To Live Band &nbsp;·&nbsp; harborlineband.com
    </div>
  </div>
</body>
</html>`;
}
