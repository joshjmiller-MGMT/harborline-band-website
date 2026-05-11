// Output X′ — Harborline Musicians ROS (variant of X).
// Diff from X: split load-in fields are first-class, and the setlist renders
// as a 6-column table (Title | Artist | Key | BPM | Singer | Patches) when
// the song section has those details, instead of a numbered list.
//
// MARKED FOR JOSH'S REVIEW:
//   - Top-block branding currently says "Harborline" + "Musicians Run of Show".
//     Adjust copy / hierarchy as you want.
//   - The setlist table renders ALL columns even when some are empty for a row.
//     Empty cells fall to em-dash. Alternative: hide empty columns globally.
//     Current behavior is closer to the Mt Vernon CC sample (Doc 14 in taxonomy).

import type {
  CanonicalEvent,
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

const SETLIST_STYLES = `
  table.setlist { width:100%; border-collapse:collapse; margin:10px 0 20px; font-size:13px; }
  table.setlist th, table.setlist td { padding:6px 10px; text-align:left; border-bottom:1px solid #eee; }
  table.setlist th { font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:#999; font-weight:600; }
  table.setlist td.song-num { width:32px; color:#999; font-variant-numeric:tabular-nums; }
  table.setlist td.song-bpm, table.setlist td.song-key { width:60px; font-variant-numeric:tabular-nums; }
  table.setlist td.song-singer, table.setlist td.song-patches { width:90px; color:#666; }
  .tempo-arc { font-size:12px; color:#666; font-style:italic; margin:4px 0 18px; }
`;

function sectionHasTableableDetails(section: SongSectionField): boolean {
  return section.songs.some(
    (s) => s.key || s.bpm || s.singer || s.patches,
  );
}

function renderSection(section: SongSectionField): string {
  const titleHtml = `<div class="section-title">${escapeHtml(section.title)}</div>`;
  const subtitleHtml = section.time
    ? `<div class="section-subtitle">${escapeHtml(section.time)}</div>`
    : "";
  const vibeHtml = section.vibe
    ? `<div style="font-size:13px;color:#555;font-style:italic;margin:6px 0 10px 8px;border-left:2px solid #ddd;padding-left:12px;">${escapeHtml(section.vibe)}</div>`
    : "";

  if (section.songs.length === 0) return titleHtml + subtitleHtml + vibeHtml;

  if (sectionHasTableableDetails(section)) {
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
    const tempoArcHtml = section.tempo_arc
      ? `<div class="tempo-arc">${escapeHtml(section.tempo_arc)}</div>`
      : "";
    return `${titleHtml}${subtitleHtml}${vibeHtml}
      <table class="setlist">
        <thead><tr>
          <th>#</th><th>Artist</th><th>Title</th><th>Key</th><th>BPM</th><th>Singer</th><th>Patches</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${tempoArcHtml}`;
  }

  // Fallback: numbered list (no per-song details)
  return `${titleHtml}${subtitleHtml}${vibeHtml}<ol class="song-list">${
    section.songs
      .map((s) => {
        const artistPart = s.artist ? ` – ${escapeHtml(s.artist)}` : "";
        return `<li>${escapeHtml(s.title || "")}${artistPart}</li>`;
      })
      .join("")
  }</ol>`;
}

export function renderOutputXPrime(event: CanonicalEvent): string {
  const dateHtml = renderDetailRow("Event Date", formatLongDate(event.event_date));
  const eventNameHtml = renderDetailRow("Event Name", event.name);
  const clientHtml = renderDetailRow("Client", formatCoupleName(event.client) || undefined);
  const eventTypeHtml = renderDetailRow("Event Type", event.event_type);
  const venueHtml = renderDetailRow("Venue", event.venue?.name);
  const venueAddrHtml = renderDetailRow("Venue Address", event.venue?.address);
  const venueTypeHtml = renderDetailRow("Venue Type", event.venue?.type);

  // Split load-in fields — Harborline-specific (per taxonomy Doc 14)
  const avSetupHtml = renderDetailRow("A/V Setup Time", event.logistics?.setup_time);
  const bandLoadInHtml = renderDetailRow("Band Load-In", event.logistics?.load_in);
  const soundcheckHtml = renderDetailRow("Soundcheck", event.logistics?.soundcheck);

  const guestsHtml = event.guests?.count
    ? renderDetailRow("Guest Count", String(event.guests.count))
    : "";
  const attireHtml = renderDetailRow("Attire", event.attire);
  const mealsHtml = renderDetailRow("Musician Food & Bev", event.logistics?.meals);
  const audioHtml = renderDetailRow("Audio Reinforcement", event.logistics?.audio_reinforcement);

  const musicianNames = (event.personnel || [])
    .filter((p) => !/poc|coordinator|salesperson/i.test(p.role))
    .map((p) => escapeHtml(p.name))
    .join(", ");
  const musiciansHtml = musicianNames
    ? `<div class="detail-row"><strong>Musicians:</strong> ${musicianNames}</div>`
    : "";

  const sectionsHtml = (event.song_sections || []).map(renderSection).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(event.name)} — Harborline Musicians ROS</title>
  <style>${BASE_FONT_STYLES}${SETLIST_STYLES}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      ${renderBrandCirclesHeader(event.organization || "harborline")}
      <h1 style="font-size:24px;font-weight:700;letter-spacing:0.02em;">Harborline</h1>
      <p style="color:#666;font-size:13px;margin-top:4px;">Musicians Run of Show</p>
    </div>

    <hr class="divider" />

    ${dateHtml}
    ${eventNameHtml}
    ${avSetupHtml}
    ${bandLoadInHtml}
    ${soundcheckHtml}
    ${clientHtml}
    ${eventTypeHtml}
    ${venueHtml}
    ${venueAddrHtml}
    ${venueTypeHtml}
    ${musiciansHtml}
    ${guestsHtml}
    ${attireHtml}
    ${mealsHtml}
    ${audioHtml}

    <hr class="divider" />

    <div class="section-title">Run of Show</div>

    ${sectionsHtml}

    <div class="footer">Confidential — For musician use only</div>
  </div>
</body>
</html>`;
}
