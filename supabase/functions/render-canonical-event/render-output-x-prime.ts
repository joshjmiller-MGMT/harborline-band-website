// Output X′ — Harborline Musicians ROS.
// 2026-05-11 rewrite: format target is the Cytron 80th Birthday Run Sheet
// (https://docs.google.com/document/d/1-FmJnHUq_H3t8OIhkimcUuvSZPDTWJb86neo9XfCRyA/edit).
// Per Josh: this layout is the output template for Harborline + TSB (not BSE).
//
// Structural pattern (top to bottom):
//   - Brand-circles header (blue→purple for Harborline)
//   - Event title (bold, large) + date suffix
//   - Time range + full long date
//   - Location: Venue | Room
//   - Address: street, city, state ZIP
//   - "Event Details" section label
//   - H1 sub-sections (Event Type / Venue Type / Guest Count / Musician Refreshments),
//     each rendered as bold sub-header with indented bullet content
//   - Contact Person + Coordinator blocks (stacked Name / Phone / Role:)
//   - "Client" block
//   - "Timeline" — bulleted `Time : Description` lines
//   - "Teammates" H2 — pipe-delimited Name - Role | Name - Role | ...
//   - "Songlist" H2 — **Bold Section** + bulleted songs (setlist-table fallback
//     when songs have key/bpm/singer/patches detail)
//   - "Load-in & Parking" H2 — prose paragraph(s) synthesized from
//     event.logistics.parking + event.logistics.load_in / entrance
//   - "Arrival Time" H2 — prose paragraph(s) standard musician-arrival template
//
// Reuses BASE_FONT_STYLES; adds X-prime specific overrides.

import type {
  CanonicalEvent,
  PersonnelEntry,
  SongSectionField,
  TimelineEntry,
} from "./canonical-event-types.ts";
import {
  BASE_FONT_STYLES,
  escapeHtml,
  formatCoupleName,
  formatLongDate,
  renderBrandCirclesHeader,
} from "./render-shared.ts";

const XPRIME_STYLES = `
  .xp-title { font-size: 26px; font-weight: 700; letter-spacing: 0.005em; text-align: center; margin-top: 4px; }
  .xp-subhead-time { font-size: 14px; color: #444; text-align: center; margin-top: 4px; }
  .xp-loc { font-size: 14px; color: #333; text-align: center; margin-top: 16px; }
  .xp-addr { font-size: 13px; color: #666; text-align: center; }
  .xp-section-label { font-size: 18px; font-weight: 600; color: #222; margin-top: 36px; margin-bottom: 8px; border-bottom: 1.5px solid #222; padding-bottom: 4px; }
  .xp-h1 { font-size: 16px; font-weight: 700; color: #222; margin-top: 16px; margin-bottom: 4px; }
  .xp-h2 { font-size: 18px; font-weight: 700; color: #222; margin-top: 32px; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .xp-bullet { padding-left: 24px; position: relative; font-size: 14px; line-height: 1.7; margin: 2px 0; }
  .xp-bullet::before { content: "•"; position: absolute; left: 8px; color: #666; }
  .xp-block { margin: 4px 0 4px 4px; font-size: 14px; line-height: 1.7; }
  .xp-block-role { color: #666; font-style: italic; }
  .xp-client { font-size: 15px; margin: 8px 0; }
  .xp-client strong { font-weight: 700; }
  .xp-client .xp-rel { color: #666; }
  .xp-timeline-row { padding: 4px 0 4px 24px; position: relative; font-size: 14px; line-height: 1.7; }
  .xp-timeline-row::before { content: "•"; position: absolute; left: 8px; color: #666; }
  .xp-teammates-line { font-size: 14px; line-height: 1.8; margin: 6px 0 0 0; color: #222; }
  .xp-songgroup-title { font-size: 15px; font-weight: 700; margin: 16px 0 6px; }
  .xp-songbullet { padding-left: 24px; position: relative; font-size: 14px; line-height: 1.7; }
  .xp-songbullet::before { content: "•"; position: absolute; left: 8px; color: #666; }
  .xp-songbullet-sub { padding-left: 48px; }
  .xp-songbullet-sub::before { left: 32px; }
  .xp-prose { font-size: 14px; line-height: 1.7; margin: 8px 0; }
  .xp-prose strong { font-weight: 700; }
  table.setlist { width:100%; border-collapse:collapse; margin:10px 0 20px; font-size:13px; }
  table.setlist th, table.setlist td { padding:6px 10px; text-align:left; border-bottom:1px solid #eee; }
  table.setlist th { font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:#999; font-weight:600; }
  table.setlist td.song-num { width:32px; color:#999; font-variant-numeric:tabular-nums; }
  table.setlist td.song-bpm, table.setlist td.song-key { width:60px; font-variant-numeric:tabular-nums; }
  table.setlist td.song-singer, table.setlist td.song-patches { width:90px; color:#666; }
  .tempo-arc { font-size:12px; color:#666; font-style:italic; margin:4px 0 18px; }
`;

const VENTURE_WORDMARK: Record<string, string> = {
  harborline: "Harborline",
  tsb: "Tom Steele Band",
};

function brandLabel(organization?: string): string {
  return VENTURE_WORDMARK[(organization || "").toLowerCase()] || "Harborline";
}

function formatTimeRangeFromTimeline(timeline: TimelineEntry[]): string {
  if (!timeline || timeline.length === 0) return "";
  const first = timeline[0]?.time?.trim();
  const last = timeline[timeline.length - 1]?.time?.trim();
  if (!first && !last) return "";
  if (first && last && first !== last) return `${first} – ${last}`;
  return first || last || "";
}

function formatShortDateSuffix(iso: string): string {
  // ISO YYYY-MM-DD → "3/23" or "3/23/26" for title-suffix use
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${parseInt(m[2])}/${parseInt(m[3])}`;
}

function renderHeaderBlock(event: CanonicalEvent): string {
  const titleDateSuffix = formatShortDateSuffix(event.event_date);
  const title = `${escapeHtml(event.name || "Event")}${titleDateSuffix ? ` - ${titleDateSuffix}` : ""}`;
  const timeRange = formatTimeRangeFromTimeline(event.timeline || []);
  const longDate = formatLongDate(event.event_date);
  const timeHtml = timeRange
    ? `<div class="xp-subhead-time">${escapeHtml(timeRange)}, ${escapeHtml(longDate)}</div>`
    : `<div class="xp-subhead-time">${escapeHtml(longDate)}</div>`;

  const venueName = event.venue?.name;
  // Cytron format: "Location: Venue Name | Room/Space" — Room may be inside venue.name
  // or absent; we render it as-is.
  const locHtml = venueName
    ? `<div class="xp-loc"><strong>Location:</strong> ${escapeHtml(venueName)}</div>`
    : "";
  const addrHtml = event.venue?.address
    ? `<div class="xp-addr"><strong>Address:</strong> ${escapeHtml(event.venue.address)}</div>`
    : "";

  return `
    ${renderBrandCirclesHeader(event.organization || "harborline")}
    <div class="xp-title">${title}</div>
    ${timeHtml}
    ${locHtml}
    ${addrHtml}
  `;
}

function renderEventDetailsBlock(event: CanonicalEvent): string {
  const eventType = event.event_type
    ? titleCase(event.event_type)
    : "";
  const venueType = event.venue?.type
    ? event.venue.type === "both"
      ? "Indoor & Outdoor"
      : titleCase(event.venue.type)
    : "";
  const guestCount = event.guests?.count;
  const refreshments = event.logistics?.meals;

  const blocks: string[] = [];
  if (eventType) {
    blocks.push(`<div class="xp-h1">Event Type</div><div class="xp-bullet">${escapeHtml(eventType)}</div>`);
  }
  if (venueType) {
    blocks.push(`<div class="xp-h1">Venue Type</div><div class="xp-bullet">${escapeHtml(venueType)}</div>`);
  }
  if (guestCount) {
    blocks.push(`<div class="xp-h1">Guest Count</div><div class="xp-bullet">${escapeHtml(String(guestCount))}</div>`);
  }
  if (refreshments) {
    blocks.push(`<div class="xp-h1">Musician Refreshments</div><div class="xp-bullet">${escapeHtml(refreshments)}</div>`);
  }
  if (event.attire) {
    blocks.push(`<div class="xp-h1">Attire</div><div class="xp-bullet">${escapeHtml(event.attire)}</div>`);
  }
  if (blocks.length === 0) return "";
  return `<div class="xp-section-label">Event Details</div>${blocks.join("")}`;
}

const POC_ROLE_PATTERN = /poc|point of contact|day-of|salesperson|client lead|sales/i;
const COORD_ROLE_PATTERN = /coordinator|bandleader|md|music director|production manager|director/i;
const PROJECT_LEAD_PATTERN = /project lead|band lead|music lead/i;

function isPocLike(p: PersonnelEntry): boolean {
  return POC_ROLE_PATTERN.test(p.role || "");
}

function isCoordinatorLike(p: PersonnelEntry): boolean {
  return COORD_ROLE_PATTERN.test(p.role || "") || PROJECT_LEAD_PATTERN.test(p.role || "");
}

const ORG_PROJECT_LEAD_DEFAULTS: Record<string, string> = {
  harborline: "Josh Miller",
  tsb: "Tom Starr",
};

function renderPersonBlock(p: PersonnelEntry): string {
  const parts: string[] = [];
  parts.push(`<div class="xp-block">${escapeHtml(p.name || "")}</div>`);
  if (p.phone) parts.push(`<div class="xp-block">${escapeHtml(p.phone)}</div>`);
  parts.push(`<div class="xp-block xp-block-role">Role: ${escapeHtml(p.role || "—")}</div>`);
  return parts.join("");
}

function renderContactBlocks(personnel: PersonnelEntry[], organization?: string): string {
  const blocks: string[] = [];

  const pocs = personnel.filter(isPocLike);
  if (pocs.length > 0) {
    blocks.push(`<div class="xp-h1">Contact Person</div>${pocs.map(renderPersonBlock).join("")}`);
  }

  // Coordinator: anyone with a coordinator-like or project-lead role.
  const coords = personnel.filter(isCoordinatorLike);
  if (coords.length > 0) {
    blocks.push(`<div class="xp-h1">Coordinator &amp; Point of Contact</div>${coords.map(renderPersonBlock).join("")}`);
  } else {
    // Org-aware default: when no coordinator/project-lead is named for
    // Harborline or TSB, fall back to Josh / Tom. Mirrors v1 behavior.
    const orgKey = (organization || "").toLowerCase();
    const defaultLead = ORG_PROJECT_LEAD_DEFAULTS[orgKey];
    if (defaultLead) {
      const fallback: PersonnelEntry = { role: "Project Lead", name: defaultLead };
      blocks.push(`<div class="xp-h1">Coordinator &amp; Point of Contact</div>${renderPersonBlock(fallback)}`);
    }
  }

  return blocks.join("");
}

function renderClientBlock(event: CanonicalEvent): string {
  const couple = formatCoupleName(event.client);
  if (!couple) return "";
  // Relationship parenthetical isn't currently a canonical field; emit just the bold name.
  return `<div class="xp-section-label">Client</div><div class="xp-client"><strong>${couple}</strong></div>`;
}

function renderTimelineBlock(timeline: TimelineEntry[]): string {
  if (!timeline || timeline.length === 0) return "";
  const rows = timeline
    .map((t) => {
      const note = t.notes ? ` <span style="color:#666;">(${escapeHtml(t.notes)})</span>` : "";
      const loc = t.location ? ` <span style="color:#666;">— ${escapeHtml(t.location)}</span>` : "";
      return `<div class="xp-timeline-row"><strong>${escapeHtml(t.time)}</strong> : ${escapeHtml(t.description)}${loc}${note}</div>`;
    })
    .join("");
  return `<div class="xp-section-label">Timeline</div>${rows}`;
}

function renderTeammatesLine(personnel: PersonnelEntry[]): string {
  // Pipe-delimited line, musicians + crew only (exclude POCs/Coordinators rendered above
  // unless they're also musicians — heuristic: if role contains a musician keyword,
  // include them).
  const musicianKeywords = /drum|bass|key|piano|guitar|vocal|vox|sax|horn|trumpet|trombone|violin|viola|cello|perc|tracks|audio|sound|engineer|tenor|alto|baritone/i;
  const team = personnel.filter((p) => musicianKeywords.test(p.role || ""));
  if (team.length === 0) return "";
  const line = team
    .map((p) => `${escapeHtml(p.name)} - ${escapeHtml(p.role)}`)
    .join(" | ");
  return `<div class="xp-h2">Teammates</div><div class="xp-teammates-line">${line}</div>`;
}

function sectionHasTableableDetails(section: SongSectionField): boolean {
  return section.songs.some(
    (s) => s.key || s.bpm || s.singer || s.patches,
  );
}

function renderSetlistTable(section: SongSectionField): string {
  const rows = section.songs
    .map((song, i) => {
      const order = song.order || String(i + 1);
      return `<tr>
        <td class="song-num">${escapeHtml(order)}</td>
        <td>${escapeHtml(song.artist || "—")}</td>
        <td>${escapeHtml(song.title || "—")}</td>
        <td class="song-key">${escapeHtml(song.key || "—")}</td>
        <td class="song-bpm">${escapeHtml(song.bpm || "—")}</td>
        <td class="song-singer">${escapeHtml(song.singer || "—")}</td>
        <td class="song-patches">${escapeHtml(song.patches || "—")}</td>
      </tr>`;
    })
    .join("");
  const tempoArc = section.tempo_arc
    ? `<div class="tempo-arc">${escapeHtml(section.tempo_arc)}</div>`
    : "";
  return `
    <table class="setlist">
      <thead><tr>
        <th>#</th><th>Artist</th><th>Title</th><th>Key</th><th>BPM</th><th>Singer</th><th>Patches</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${tempoArc}
  `;
}

function renderSongGroup(section: SongSectionField): string {
  const titleHtml = `<div class="xp-songgroup-title">${escapeHtml(section.title)}</div>`;
  if (section.songs.length === 0) return titleHtml;

  if (sectionHasTableableDetails(section)) {
    return titleHtml + renderSetlistTable(section);
  }

  // Cytron-style: bulleted song list. Nested bullets for medleys when notes
  // start with "medley:" pattern (not currently in schema; reserved for future).
  const items = section.songs
    .map((s) => {
      const left = escapeHtml(s.title || "");
      const artistPart = s.artist ? ` – ${escapeHtml(s.artist)}` : "";
      return `<div class="xp-songbullet">${left}${artistPart}</div>`;
    })
    .join("");
  return titleHtml + items;
}

function renderSonglist(sections: SongSectionField[]): string {
  if (!sections || sections.length === 0) return "";
  return `<div class="xp-h2">Songlist</div>${sections.map(renderSongGroup).join("")}`;
}

function renderLoadInProse(event: CanonicalEvent): string {
  const logistics = event.logistics || {};
  const venueName = event.venue?.name || "the venue";
  const orgLabel = brandLabel(event.organization);
  const eventName = event.name || "the event";

  const parts: string[] = [];

  if (logistics.load_in || logistics.entrance) {
    const entrance = logistics.entrance ? ` at the <strong>${escapeHtml(logistics.entrance)}</strong>` : "";
    const loadInTime = logistics.load_in ? ` Load-in is at <strong>${escapeHtml(logistics.load_in)}</strong>.` : "";
    parts.push(`<div class="xp-prose">Load-in for <strong>${escapeHtml(venueName)}</strong> is${entrance}.${loadInTime}</div>`);
  }

  if (logistics.parking) {
    parts.push(`<div class="xp-prose"><strong>Parking:</strong> ${escapeHtml(logistics.parking)} Mention you're with <strong>${escapeHtml(orgLabel)}</strong> for <strong>${escapeHtml(eventName)}</strong>.</div>`);
  }

  if (logistics.green_room) {
    parts.push(`<div class="xp-prose"><strong>Green room:</strong> ${escapeHtml(logistics.green_room)}.</div>`);
  }

  if (logistics.audio_reinforcement) {
    parts.push(`<div class="xp-prose"><strong>Audio:</strong> ${escapeHtml(logistics.audio_reinforcement)}.</div>`);
  }

  if (parts.length === 0) return "";
  return `<div class="xp-h2">Load-in &amp; Parking</div>${parts.join("")}`;
}

function renderArrivalProse(event: CanonicalEvent): string {
  // Standard musician-arrival prose. Soundcheck if present, otherwise generic
  // "20 min before the start of the performance."
  const soundcheck = event.logistics?.soundcheck;
  const setupTime = event.logistics?.setup_time;

  const firstSlot = (event.timeline || [])[0]?.time;
  const arrivalRef = soundcheck
    ? `<strong>soundcheck at ${escapeHtml(soundcheck)}</strong>`
    : setupTime
      ? `<strong>setup at ${escapeHtml(setupTime)}</strong>`
      : firstSlot
        ? `<strong>20 minutes before the ${escapeHtml(firstSlot)} start</strong>`
        : "<strong>ready to play 20 minutes before the performance</strong>";

  return `<div class="xp-h2">Arrival Time</div>
    <div class="xp-prose">Musicians — please arrive with enough time to be ready for ${arrivalRef}. Build in buffer for traffic and load-in.</div>
    <div class="xp-prose">Arrival time is crucial to our clients. If you're delayed, communicate promptly with the coordinator and your fellow musicians — <strong>prompt communication is key</strong>. Don't keep people waiting.</div>`;
}

export function renderOutputXPrime(event: CanonicalEvent): string {
  const headerBlock = renderHeaderBlock(event);
  const eventDetails = renderEventDetailsBlock(event);
  const contacts = renderContactBlocks(event.personnel || [], event.organization);
  const clientBlock = renderClientBlock(event);
  const timelineBlock = renderTimelineBlock(event.timeline || []);
  const teammatesLine = renderTeammatesLine(event.personnel || []);
  const songlistBlock = renderSonglist(event.song_sections || []);
  const loadInProse = renderLoadInProse(event);
  const arrivalProse = renderArrivalProse(event);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(event.name)} — ${brandLabel(event.organization)} Musicians ROS</title>
  <style>${BASE_FONT_STYLES}${XPRIME_STYLES}</style>
</head>
<body>
  <div class="page">
    ${headerBlock}
    ${eventDetails}
    ${contacts}
    ${clientBlock}
    ${timelineBlock}
    ${teammatesLine}
    ${songlistBlock}
    ${loadInProse}
    ${arrivalProse}
    <div class="footer">Confidential — For musician use only</div>
  </div>
</body>
</html>`;
}

const ALL_CAPS_TOKENS = new Set(["dj", "moh", "mc", "ymca", "tsb", "bse", "av", "vip"]);
function titleCase(s: string): string {
  return String(s || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (ALL_CAPS_TOKENS.has(w.toLowerCase())) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}
