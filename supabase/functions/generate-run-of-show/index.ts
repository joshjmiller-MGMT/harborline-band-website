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

    const eventData = parseSheetToEvent(sheetData, template);
    const html = generateHTML(eventData, template);

    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(html);
    const base64 = btoa(String.fromCharCode(...htmlBytes));

    const filename = `${eventData.eventName || 'run-of-show'}_${template}`.replace(/[^a-zA-Z0-9-_]/g, '_');

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
  contactPerson: string;
  contactPhone: string;
  contactRole: string;
  coordinatorName: string;
  coordinatorPhone: string;
  coordinatorRole: string;
  musicianRefreshments: string;
  teammates: string;
  loadInParking: string;
  arrivalTime: string;
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
  
  const rawRows = rows.map((row: string[]) => {
    const obj: Record<string, string> = {};
    headers.forEach((h: string, i: number) => {
      obj[h.toLowerCase().trim()] = row[i] || '';
    });
    return obj;
  });

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

  const sections: EventSection[] = [];
  let currentSection: EventSection | null = null;

  for (const row of rawRows) {
    const values = Object.values(row);
    const firstVal = values[0]?.trim() || '';
    
    const isSection = /^\d+\.|prelude|processional|recessional|postlude|cocktail|ceremony|dinner|reception|set\s?\d|band\s+set/i.test(firstVal);
    
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
    venueType: findVal(['venue type', 'inside', 'outside', 'indoor']),
    contactPerson: findVal(['contact person', 'contact name']),
    contactPhone: findVal(['contact phone', 'phone']),
    contactRole: findVal(['contact role']),
    coordinatorName: findVal(['coordinator name', 'coordinator']),
    coordinatorPhone: findVal(['coordinator phone']),
    coordinatorRole: findVal(['coordinator role']),
    musicianRefreshments: findVal(['refreshment', 'meal', 'catering', 'food']),
    teammates: findVal(['teammate', 'team', 'roster', 'musician']),
    loadInParking: findVal(['load-in', 'load in', 'parking']),
    arrivalTime: findVal(['arrival', 'call time']),
    sections,
    rawRows,
  };
}

function generateHTML(event: EventData, template: string): string {
  // Harborline teal → purple theme
  const teal = '#14B8A6';
  const purple = '#7C3AED';
  const blue = '#3B82F6';
  const sectionColor = '#7C3AED'; // purple for section headers
  const ruleColor = '#14B8A6'; // teal for horizontal rules
  const darkText = '#1a1a1a';
  const bodyText = '#333333';
  const mutedText = '#666666';

  // Circle colors: teal to purple gradient spectrum
  const circleColors = ['#14B8A6', '#0EA5E9', '#6366F1', '#7C3AED', '#A855F7', '#3B82F6'];

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: white;
      color: ${bodyText};
      line-height: 1.7;
      font-size: 14px;
    }
    
    .page {
      max-width: 720px;
      margin: 0 auto;
      padding: 50px 60px;
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 48px;
    }

    .circles {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-bottom: 20px;
    }

    .circle {
      width: 28px;
      height: 28px;
      border-radius: 50%;
    }

    .brand-text {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 48px;
      letter-spacing: 0.08em;
      color: ${darkText};
      line-height: 1;
    }

    .brand-highlight {
      color: ${purple};
    }

    .event-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 30px;
      letter-spacing: 0.06em;
      color: ${sectionColor};
      margin-top: 28px;
    }

    .event-meta {
      font-size: 14px;
      color: ${bodyText};
      margin-top: 6px;
      line-height: 1.8;
    }

    /* Section headers - matches the PDF style */
    .section-title {
      font-family: 'Inter', sans-serif;
      font-size: 26px;
      font-weight: 300;
      color: ${sectionColor};
      margin-top: 40px;
      margin-bottom: 4px;
    }

    .section-rule {
      border: none;
      border-top: 2.5px solid ${ruleColor};
      margin-bottom: 20px;
    }

    /* Detail items (bold label + bullet value) */
    .detail-group {
      margin-bottom: 18px;
    }

    .detail-label {
      font-weight: 700;
      color: ${darkText};
      font-size: 14px;
      margin-bottom: 2px;
    }

    .detail-value {
      color: ${bodyText};
      font-size: 14px;
      padding-left: 24px;
      position: relative;
    }

    .detail-value::before {
      content: '●';
      position: absolute;
      left: 4px;
      color: ${bodyText};
      font-size: 8px;
      top: 4px;
    }

    /* Contact blocks */
    .contact-block {
      margin-bottom: 18px;
    }

    .contact-block .contact-name {
      padding-left: 24px;
      color: ${bodyText};
    }

    /* Timeline */
    .timeline-list {
      list-style: none;
      padding: 0;
    }

    .timeline-item {
      padding: 4px 0;
      padding-left: 24px;
      position: relative;
      font-size: 14px;
    }

    .timeline-item::before {
      content: '●';
      position: absolute;
      left: 4px;
      color: ${bodyText};
      font-size: 8px;
      top: 8px;
    }

    .timeline-time {
      font-weight: 500;
    }

    /* Teammates inline */
    .teammates-text {
      font-size: 14px;
      color: ${bodyText};
      line-height: 1.8;
    }

    /* Songlist */
    .set-title {
      font-weight: 700;
      font-size: 15px;
      color: ${darkText};
      margin-top: 20px;
      margin-bottom: 8px;
    }

    .song-list {
      list-style: none;
      padding: 0;
    }

    .song-item {
      padding: 3px 0;
      padding-left: 24px;
      position: relative;
      font-size: 14px;
    }

    .song-item::before {
      content: '●';
      position: absolute;
      left: 4px;
      color: ${bodyText};
      font-size: 8px;
      top: 7px;
    }

    /* Body text paragraphs */
    .body-text {
      font-size: 14px;
      color: ${bodyText};
      line-height: 1.8;
      margin-bottom: 12px;
    }

    .body-text strong {
      color: ${darkText};
      font-weight: 700;
    }

    /* Raw data fallback table */
    .raw-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-top: 16px;
    }

    .raw-table th {
      background: ${purple};
      color: white;
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
    }

    .raw-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #eee;
    }

    .raw-table tr:nth-child(even) td {
      background: #f9f9f9;
    }

    .footer {
      text-align: center;
      margin-top: 48px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: ${mutedText};
    }

    @media print {
      body { padding: 0; }
      .page { padding: 30px 40px; }
    }
  `;

  // Build circles HTML
  const circlesHTML = circleColors.map(c => 
    `<div class="circle" style="background-color: ${c};"></div>`
  ).join('');

  // Event details section
  const detailItems = [
    { label: 'Event Type', value: event.eventType },
    { label: 'Venue Type', value: event.venueType },
    { label: 'Guest Count', value: event.guestCount },
    { label: 'Musician Refreshments', value: event.musicianRefreshments || event.foodBev },
    { label: 'Attire', value: event.attire },
    { label: 'Audio Reinforcement', value: event.audioReinforcement },
    { label: 'Setup Time', value: event.setupTime },
  ].filter(d => d.value);

  const detailsHTML = detailItems.map(d => `
    <div class="detail-group">
      <div class="detail-label">${d.label}</div>
      <div class="detail-value">${d.value}</div>
    </div>
  `).join('');

  // Contact / Coordinator / Client sections
  const contactSections: string[] = [];
  
  if (event.contactPerson || event.coordinator) {
    const name = event.contactPerson || event.coordinator;
    const phone = event.contactPhone || event.coordinatorPhone || '';
    const role = event.contactRole || event.coordinatorRole || '';
    contactSections.push(`
      <div class="detail-group">
        <div class="detail-label">Contact Person</div>
        <div class="contact-block">
          <div class="contact-name">${name}</div>
          ${phone ? `<div class="contact-name">${phone}</div>` : ''}
          ${role ? `<div class="contact-name">Role: ${role}</div>` : ''}
        </div>
      </div>
    `);
  }

  if (event.coordinatorName || event.coordinator) {
    const name = event.coordinatorName || event.coordinator;
    const phone = event.coordinatorPhone || '';
    const role = event.coordinatorRole || '';
    contactSections.push(`
      <div class="detail-group">
        <div class="detail-label">Coordinator &amp; Point of Contact</div>
        <div class="contact-block">
          <div class="contact-name">${name}</div>
          ${phone ? `<div class="contact-name">${phone}</div>` : ''}
          ${role ? `<div class="contact-name">Role: ${role}</div>` : ''}
        </div>
      </div>
    `);
  }

  // Client section
  let clientHTML = '';
  if (event.client) {
    clientHTML = `
      <div class="section-title">Client</div>
      <hr class="section-rule" />
      <div class="body-text"><strong>${event.client}</strong></div>
    `;
  }

  // Timeline from sections
  const timelineSections = event.sections.filter(s => s.time || /^\d/.test(s.title));
  let timelineHTML = '';
  if (timelineSections.length > 0) {
    const items = timelineSections.map(s => {
      const time = s.time || '';
      const desc = s.description || s.title;
      return `<li class="timeline-item"><span class="timeline-time">${time}</span>${time && desc ? ' : ' : ''}${desc}</li>`;
    }).join('');
    timelineHTML = `
      <div class="section-title">Timeline</div>
      <hr class="section-rule" />
      <ul class="timeline-list">${items}</ul>
    `;
  }

  // Teammates
  let teammatesHTML = '';
  if (event.teammates || event.musicians) {
    teammatesHTML = `
      <div class="section-title">Teammates</div>
      <hr class="section-rule" />
      <div class="teammates-text">${event.teammates || event.musicians}</div>
    `;
  }

  // Songlist - group by sections that look like sets
  const songSections = event.sections.filter(s => s.songs.length > 0);
  let songlistHTML = '';
  if (songSections.length > 0) {
    const setsHTML = songSections.map(s => {
      const songsItems = s.songs.map(song => `<li class="song-item">${song}</li>`).join('');
      return `
        <div class="set-title">${s.title}</div>
        <ul class="song-list">${songsItems}</ul>
      `;
    }).join('');
    songlistHTML = `
      <div class="section-title">Songlist</div>
      <hr class="section-rule" />
      ${setsHTML}
    `;
  }

  // Load-in & Parking
  let loadInHTML = '';
  if (event.loadInParking) {
    loadInHTML = `
      <div class="section-title">Load-in &amp; Parking</div>
      <hr class="section-rule" />
      <div class="body-text">${event.loadInParking}</div>
    `;
  }

  // Arrival Time
  let arrivalHTML = '';
  if (event.arrivalTime) {
    arrivalHTML = `
      <div class="section-title">Arrival Time</div>
      <hr class="section-rule" />
      <div class="body-text">${event.arrivalTime}</div>
    `;
  }

  // If no structured sections, show raw data
  let rawDataHTML = '';
  if (event.sections.length === 0 && event.rawRows.length > 0) {
    const cols = Object.keys(event.rawRows[0]);
    rawDataHTML = `
      <div class="section-title">Event Data</div>
      <hr class="section-rule" />
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
    `;
  }

  // Additional info fields that didn't fit elsewhere
  const extraFields = [
    { label: 'Salesperson', value: event.salesperson },
    { label: 'Other Staff', value: event.otherStaff },
  ].filter(f => f.value);

  const extraHTML = extraFields.map(f => `
    <div class="detail-group">
      <div class="detail-label">${f.label}</div>
      <div class="detail-value">${f.value}</div>
    </div>
  `).join('');

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

    <div class="event-title" style="text-align: center;">${event.eventName}</div>
    <div class="event-meta" style="text-align: center;">
      ${event.startEnd ? `${event.startEnd}` : ''}${event.eventDate ? `, ${event.eventDate}` : ''}
      ${event.venue ? `<br/>Location: ${event.venue}` : ''}
      ${event.venueAddress ? `<br/>Address: ${event.venueAddress}` : ''}
    </div>

    ${detailsHTML || contactSections.length || extraHTML ? `
      <div class="section-title">Event Details</div>
      <hr class="section-rule" />
      ${detailsHTML}
      ${contactSections.join('')}
      ${extraHTML}
    ` : ''}

    ${clientHTML}
    ${timelineHTML}
    ${teammatesHTML}
    ${songlistHTML}
    ${loadInHTML}
    ${arrivalHTML}
    ${rawDataHTML}

    <div class="footer">
      HARBORLINE &nbsp;·&nbsp; Baltimore's Go-To Live Band &nbsp;·&nbsp; harborlineband.com
    </div>
  </div>
</body>
</html>`;
}
