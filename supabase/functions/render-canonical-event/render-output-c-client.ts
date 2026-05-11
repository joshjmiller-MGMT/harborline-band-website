// Output C-client — client-facing event planner / preview.
//
// Audience: the client. Used for sending the event plan to the couple, the
// corporate planner, or the host so they can review timeline + song picks
// before the date. Strict rule: NO internal jargon — no musician roster, no
// load-in / parking / green-room logistics, no audio reinforcement notes, no
// musician POS or project-lead labels. Coordinator + ensemble (lineup, not
// names) are shown so the client knows who their contact is and what they're
// hearing.
//
// Structural pattern (top to bottom):
//   - Brand-circles header (venture-aware)
//   - "Your Event" heading
//   - Event title + full long date
//   - Venue: Name + address
//   - "Your Music" section — the ensemble (e.g. "Trio: piano / bass / drums")
//   - "Your Points of Contact" section — coordinator + musician salesperson
//   - "Timeline" — what happens when, in client-readable prose
//   - "Song Selections" — sections + songs, each section labeled with vibe if
//     present. Songs render as a clean list (no key/bpm/patches columns —
//     those are operator-internal).
//   - "Notes" footer — short closing line + Josh's contact info if available.

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

const C_CLIENT_STYLES = `
  .cc-eyebrow { font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #888; text-align: center; margin-top: 8px; }
  .cc-title { font-size: 28px; font-weight: 700; text-align: center; margin-top: 6px; color: #1a1a1a; }
  .cc-greeting { font-size: 15px; color: #444; text-align: center; margin-top: 10px; font-style: italic; }
  .cc-date { font-size: 15px; color: #444; text-align: center; margin-top: 16px; }
  .cc-venue { font-size: 14px; color: #333; text-align: center; margin-top: 8px; }
  .cc-venue-name { font-weight: 600; }
  .cc-venue-addr { color: #777; font-size: 13px; margin-top: 2px; }
  .cc-section { margin-top: 36px; }
  .cc-section-label { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #888; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1.5px solid #ddd; }
  .cc-section-body { font-size: 14px; line-height: 1.75; color: #222; }
  .cc-row { padding: 6px 0; }
  .cc-row-label { font-weight: 600; color: #444; min-width: 110px; display: inline-block; }
  .cc-timeline-row { padding: 5px 0; display: flex; gap: 14px; align-items: baseline; }
  .cc-timeline-time { font-weight: 600; color: #1a1a1a; min-width: 80px; font-variant-numeric: tabular-nums; }
  .cc-timeline-desc { color: #333; flex: 1; }
  .cc-timeline-loc { color: #888; font-style: italic; }
  .cc-songgroup { margin: 18px 0; }
  .cc-songgroup-title { font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
  .cc-songgroup-vibe { font-size: 13px; color: #777; font-style: italic; margin-bottom: 8px; }
  .cc-songlist { list-style: none; padding-left: 0; }
  .cc-songlist li { padding: 4px 0 4px 18px; position: relative; color: #333; }
  .cc-songlist li::before { content: "♪"; position: absolute; left: 0; color: #aaa; font-size: 12px; top: 6px; }
  .cc-song-title { color: #1a1a1a; }
  .cc-song-artist { color: #777; }
  .cc-footer { margin-top: 48px; padding-top: 18px; border-top: 1px solid #ddd; font-size: 13px; color: #666; text-align: center; line-height: 1.7; }
  .cc-footer strong { color: #333; }
`;

const VENTURE_WORDMARK: Record<string, string> = {
  harborline: "Harborline",
  tsb: "Tom Steele Band",
  bse: "Baltimore Sound Entertainment",
};

function brandLabel(organization?: string): string {
  return VENTURE_WORDMARK[(organization || "").toLowerCase()] || "Harborline";
}

const ENSEMBLE_ROLE_PATTERN = /drum|bass|key|piano|guitar|vocal|vox|sax|horn|trumpet|trombone|violin|viola|cello|perc|tracks|md|director|leader|tenor|alto|baritone/i;
const SALESPERSON_ROLE_PATTERN = /salesperson|sales rep|account|booker/i;
const COORDINATOR_ROLE_PATTERN = /coordinator|planner|day-of|day of/i;

function normalizeRoleToken(role: string): string {
  return role.toLowerCase().replace(/[^a-z]/g, "");
}

function describeEnsemble(personnel: PersonnelEntry[]): string {
  const instruments = personnel
    .filter((p) => ENSEMBLE_ROLE_PATTERN.test(p.role || ""))
    .map((p) => p.role.trim())
    .filter(Boolean);
  if (instruments.length === 0) return "";

  // Collapse duplicates while preserving order.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const inst of instruments) {
    const key = normalizeRoleToken(inst);
    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(inst);
    }
  }

  const count = unique.length;
  const sizeWord = ({ 1: "Solo", 2: "Duo", 3: "Trio", 4: "Quartet", 5: "Quintet", 6: "Sextet", 7: "Septet", 8: "Octet" } as Record<number, string>)[count] || `${count}-piece ensemble`;
  return `${sizeWord}: ${unique.join(" / ")}`;
}

function renderEnsembleSection(personnel: PersonnelEntry[], organization?: string): string {
  const ensemble = describeEnsemble(personnel);
  if (!ensemble) return "";
  return `
    <div class="cc-section">
      <div class="cc-section-label">Your Music</div>
      <div class="cc-section-body">
        <div class="cc-row"><span class="cc-row-label">Ensemble:</span> ${escapeHtml(ensemble)}</div>
        <div class="cc-row"><span class="cc-row-label">Provided by:</span> ${escapeHtml(brandLabel(organization))}</div>
      </div>
    </div>
  `;
}

function renderContactRow(label: string, person: PersonnelEntry): string {
  const phone = person.phone ? ` · ${escapeHtml(person.phone)}` : "";
  const email = person.email ? ` · ${escapeHtml(person.email)}` : "";
  return `<div class="cc-row"><span class="cc-row-label">${escapeHtml(label)}:</span> ${escapeHtml(person.name)}${phone}${email}</div>`;
}

function renderPointsOfContactSection(personnel: PersonnelEntry[]): string {
  const coordinators = personnel.filter((p) => COORDINATOR_ROLE_PATTERN.test(p.role || ""));
  const salespeople = personnel.filter((p) => SALESPERSON_ROLE_PATTERN.test(p.role || ""));

  if (coordinators.length === 0 && salespeople.length === 0) return "";

  const rows: string[] = [];
  for (const c of coordinators) rows.push(renderContactRow("Event Coordinator", c));
  for (const s of salespeople) rows.push(renderContactRow("Your Salesperson", s));

  return `
    <div class="cc-section">
      <div class="cc-section-label">Your Points of Contact</div>
      <div class="cc-section-body">${rows.join("")}</div>
    </div>
  `;
}

function renderTimelineSection(timeline: TimelineEntry[]): string {
  if (!timeline || timeline.length === 0) return "";
  const rows = timeline
    .map((t) => {
      const loc = t.location ? ` <span class="cc-timeline-loc">— ${escapeHtml(t.location)}</span>` : "";
      return `<div class="cc-timeline-row">
        <span class="cc-timeline-time">${escapeHtml(t.time || "—")}</span>
        <span class="cc-timeline-desc">${escapeHtml(t.description || "—")}${loc}</span>
      </div>`;
    })
    .join("");
  return `
    <div class="cc-section">
      <div class="cc-section-label">Timeline</div>
      <div class="cc-section-body">${rows}</div>
    </div>
  `;
}

function renderSongGroup(section: SongSectionField): string {
  const title = `<div class="cc-songgroup-title">${escapeHtml(section.title)}</div>`;
  const vibe = section.vibe
    ? `<div class="cc-songgroup-vibe">${escapeHtml(section.vibe)}</div>`
    : "";
  if (section.songs.length === 0) {
    return `<div class="cc-songgroup">${title}${vibe}</div>`;
  }
  const items = section.songs
    .map((s) => {
      const titleHtml = `<span class="cc-song-title">${escapeHtml(s.title || "—")}</span>`;
      const artist = s.artist ? ` <span class="cc-song-artist">— ${escapeHtml(s.artist)}</span>` : "";
      return `<li>${titleHtml}${artist}</li>`;
    })
    .join("");
  return `<div class="cc-songgroup">${title}${vibe}<ul class="cc-songlist">${items}</ul></div>`;
}

function renderSongSelectionsSection(sections: SongSectionField[]): string {
  if (!sections || sections.length === 0) return "";
  return `
    <div class="cc-section">
      <div class="cc-section-label">Song Selections</div>
      <div class="cc-section-body">${sections.map(renderSongGroup).join("")}</div>
    </div>
  `;
}

function renderEventDetailsSection(event: CanonicalEvent): string {
  const rows: string[] = [];
  if (event.guests?.count) {
    rows.push(`<div class="cc-row"><span class="cc-row-label">Guest Count:</span> ${escapeHtml(String(event.guests.count))}</div>`);
  }
  if (event.event_type) {
    rows.push(`<div class="cc-row"><span class="cc-row-label">Event Type:</span> ${escapeHtml(event.event_type)}</div>`);
  }
  if (event.attire) {
    rows.push(`<div class="cc-row"><span class="cc-row-label">Attire:</span> ${escapeHtml(event.attire)}</div>`);
  }
  if (rows.length === 0) return "";
  return `
    <div class="cc-section">
      <div class="cc-section-label">Event Details</div>
      <div class="cc-section-body">${rows.join("")}</div>
    </div>
  `;
}

function renderClientGreeting(event: CanonicalEvent): string {
  const couple = formatCoupleName(event.client);
  if (!couple) return "";
  return `<div class="cc-greeting">Prepared for ${couple}</div>`;
}

export function renderOutputCClient(event: CanonicalEvent): string {
  const brand = brandLabel(event.organization);
  const longDate = formatLongDate(event.event_date);
  const venueName = event.venue?.name;
  const venueAddr = event.venue?.address;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(event.name)} — Event Plan</title>
  <style>${BASE_FONT_STYLES}${C_CLIENT_STYLES}</style>
</head>
<body>
  <div class="page">
    ${renderBrandCirclesHeader(event.organization || "harborline")}
    <div class="cc-eyebrow">Your Event Plan</div>
    <div class="cc-title">${escapeHtml(event.name || "Event")}</div>
    ${renderClientGreeting(event)}
    <div class="cc-date">${escapeHtml(longDate)}</div>
    ${venueName ? `<div class="cc-venue"><span class="cc-venue-name">${escapeHtml(venueName)}</span></div>` : ""}
    ${venueAddr ? `<div class="cc-venue cc-venue-addr">${escapeHtml(venueAddr)}</div>` : ""}

    ${renderEventDetailsSection(event)}
    ${renderEnsembleSection(event.personnel || [], event.organization)}
    ${renderPointsOfContactSection(event.personnel || [])}
    ${renderTimelineSection(event.timeline || [])}
    ${renderSongSelectionsSection(event.song_sections || [])}

    <div class="cc-footer">
      Questions about your event? Reach out to <strong>${escapeHtml(brand)}</strong> any time.<br>
      We're looking forward to playing for you.
    </div>
  </div>
</body>
</html>`;
}
