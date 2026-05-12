// Output X — BSE Musicians ROS.
// Port of generate-run-of-show/index.ts → generateWeddingROSHTML, adapted to
// read from a CanonicalEvent row (the row produced by ingest-event in Cuts 1-3).
//
// MARKED FOR JOSH'S REVIEW:
//   - Style matches the existing generator (Inter / 14px / dividers / decimal song list).
//     If you've been wanting to refresh the look, this is the moment.

import type {
  CanonicalEvent,
  PersonnelEntry,
  SongSectionField,
} from "./canonical-event-types.ts";
import {
  BASE_FONT_STYLES,
  escapeHtml,
  formatCoupleName,
  formatLongDate,
  renderBrandCirclesHeader,
  renderDetailRow,
} from "./render-shared.ts";

const INSTRUMENT_ORDER: Record<string, number> = {
  drums: 10, bass: 20, keys: 30, piano: 35, guitar: 40,
  vocals: 50, vox: 51, sax: 60, horn: 65, trumpet: 66, trombone: 67,
  violin: 70, viola: 75, cello: 80, percussion: 85, perc: 86,
  aux: 90, tracks: 95,
};

function personnelSortOrder(role: string): number {
  const r = role.toLowerCase();
  for (const [key, ord] of Object.entries(INSTRUMENT_ORDER)) {
    if (r.includes(key)) return ord;
  }
  return 999;
}

function renderPersonnel(personnel: PersonnelEntry[]): string {
  if (personnel.length === 0) return "";
  const sorted = [...personnel].sort(
    (a, b) => personnelSortOrder(a.role) - personnelSortOrder(b.role),
  );
  return sorted
    .map(
      (p) =>
        `<div class="detail-row"><strong>${escapeHtml(p.role)}:</strong> ${escapeHtml(p.name)}</div>`,
    )
    .join("");
}

function renderSection(section: SongSectionField): string {
  const titleHtml = `<div class="section-title">${escapeHtml(section.title)}</div>`;
  const subtitleHtml = section.time
    ? `<div class="section-subtitle">${escapeHtml(section.time)}</div>`
    : "";
  const vibeHtml = section.vibe
    ? `<div class="quote-text" style="font-size:13px;color:#555;font-style:italic;margin:6px 0 10px 8px;border-left:2px solid #ddd;padding-left:12px;">${escapeHtml(section.vibe)}</div>`
    : "";

  if (section.songs.length === 0) return titleHtml + subtitleHtml + vibeHtml;

  const hasMoments = section.songs.some(
    (s) => !s.artist && (s.notes || "").length > 0,
  );

  let body = "";
  if (hasMoments) {
    body = section.songs
      .map((song) => {
        const left = escapeHtml(song.title || "");
        if (song.artist) {
          return `<div style="padding:3px 0 3px 20px;position:relative;">${left} – ${escapeHtml(song.artist)}</div>`;
        }
        return `<div style="padding:3px 0 3px 20px;position:relative;">${left}${song.notes ? " (" + escapeHtml(song.notes) + ")" : ""}</div>`;
      })
      .join("");
  } else {
    body = `<ol class="song-list">` +
      section.songs
        .map((song) => {
          const artistPart = song.artist ? ` – ${escapeHtml(song.artist)}` : "";
          return `<li>${escapeHtml(song.title || "")}${artistPart}</li>`;
        })
        .join("") +
      `</ol>`;
  }

  return titleHtml + subtitleHtml + vibeHtml + `<hr class="divider-light" />` + body;
}

export function renderOutputX(event: CanonicalEvent): string {
  const dateHtml = renderDetailRow("Event Date", formatLongDate(event.event_date));
  const coupleHtml = renderDetailRow("Couple", formatCoupleName(event.client));
  const eventTypeHtml = renderDetailRow("Event Type", event.event_type);
  const venueHtml = renderDetailRow("Venue", event.venue?.name);
  const venueAddrHtml = renderDetailRow("Venue Address", event.venue?.address);
  const venueTypeHtml = renderDetailRow("Venue Type", event.venue?.type);
  const ensembleHtml = renderDetailRow("Ensemble", event.ensemble);
  const guestsHtml = event.guests?.count
    ? renderDetailRow("Guest Count", String(event.guests.count))
    : "";
  const attireHtml = renderDetailRow("Attire", event.attire);
  const setupTimeHtml = renderDetailRow("Setup Time", event.logistics?.setup_time);
  const loadInHtml = renderDetailRow("Load-In", event.logistics?.load_in);
  const startTimeHtml = renderDetailRow("Start Time", event.logistics?.start_time);
  const endTimeHtml = renderDetailRow("End Time", event.logistics?.end_time);
  const audioHtml = renderDetailRow("Audio Reinforcement", event.logistics?.audio_reinforcement);
  const mealsHtml = renderDetailRow("Musician Food & Bev", event.logistics?.musician_meals);
  const postingHtml = renderDetailRow("Posting", event.preferences?.posting_notes);

  const personnelHtml = renderPersonnel(event.personnel || []);

  const timelineHtml = (event.timeline || []).length === 0 ? "" : `
    <div class="section-title">Timeline</div>
    <hr class="divider-light" />
    ${event.timeline
      .map((t) =>
        `<div class="detail-row"><strong>${escapeHtml(t.time)}</strong> — ${escapeHtml(t.description)}${t.location ? ` <em style="color:#666;">(${escapeHtml(t.location)})</em>` : ""}</div>`,
      )
      .join("")}
  `;

  const sectionsHtml = (event.song_sections || []).map(renderSection).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(event.name)} — Musicians Run of Show</title>
  <style>${BASE_FONT_STYLES}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      ${renderBrandCirclesHeader(event.organization)}
      <h1 style="font-size:24px;font-weight:700;letter-spacing:0.02em;">Baltimore Sound Entertainment</h1>
      <p style="color:#666;font-size:13px;margin-top:4px;">Musicians Run of Show</p>
    </div>

    <hr class="divider" />

    ${dateHtml}
    ${coupleHtml}
    ${eventTypeHtml}
    ${venueHtml}
    ${venueAddrHtml}
    ${venueTypeHtml}
    ${ensembleHtml}
    ${guestsHtml}
    ${attireHtml}
    ${setupTimeHtml}
    ${loadInHtml}
    ${startTimeHtml}
    ${endTimeHtml}
    ${audioHtml}
    ${mealsHtml}
    ${postingHtml}

    ${personnelHtml ? `<div style="margin-top:16px;">${personnelHtml}</div>` : ""}

    <hr class="divider" />

    <div class="section-title">Run of Show</div>

    ${timelineHtml}
    ${sectionsHtml}

    <div class="footer">Confidential — For musician use only</div>
  </div>
</body>
</html>`;
}
