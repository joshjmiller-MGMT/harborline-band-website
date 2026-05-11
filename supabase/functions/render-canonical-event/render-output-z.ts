// Output Z — DJ-facing wedding ROS (NEW per taxonomy v2 Q2 rec).
// Native rendering of Shape B (BSE DJ Wedding Planner) canonical_events. NOT a
// B→A→Output-X transform — surfaces Shape B's DJ-specific fields directly.
//
// ‼️ MARKED FOR JOSH'S DESIGN REVIEW. Conservative defaults below; please redline:
//   1. Section order is: Event Header → Ceremony Music → Reception Highlights
//      (Intros / First Dance / Parent Dances / Cake / Bouquet / Last Dance)
//      → Approved Line Dances → Music Preferences (Must-Play / Do-Not-Play /
//      Style Notes) → Tag These Vendors (IG handles) → footer.
//      Alternate orders: line dances first (DJ scans for floor moments?), or
//      put vendor IG block at TOP for "tag everyone" usability?
//   2. Line dances yes/no/maybe: I render YES as a checkmark list, MAYBE as a
//      grayed "DJ judgment call" sub-block, NO collapsed into a footer line
//      ("Client said no to: Cha Cha, Wobble"). Alternative: three-column
//      grid showing all 7 at a glance? Or omit NOs entirely?
//   3. Vendor IG handles render as @clickable links to instagram.com/<handle>.
//      Block heading: "Tag These Vendors". Alternative: list per-vendor with
//      role label ("@photog_handle — Photographer")?
//   4. No Harborline / BSE logo — pure type header. Add a logo + tagline?
//   5. Color treatment: I used a single teal accent (#0D9488) for headings and
//      yes-checkmarks. Brand-correct? Brand-irrelevant?

import type {
  CanonicalEvent,
  PersonnelEntry,
  VendorEntry,
} from "./canonical-event-types.ts";
import {
  BASE_FONT_STYLES,
  escapeHtml,
  formatCoupleName,
  formatLongDate,
  renderBrandCirclesHeader,
} from "./render-shared.ts";

const Z_STYLES = `
  .dj-page { max-width:760px; margin:0 auto; padding:50px 55px; }
  .dj-section { margin-top:32px; }
  .dj-title { font-size:18px; font-weight:700; color:#0D9488; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.04em; }
  .dj-subtitle { font-size:13px; color:#666; font-style:italic; margin-bottom:12px; }
  .dj-card { padding:12px 14px; margin:6px 0; background:#F9FAFB; border-left:3px solid #0D9488; border-radius:0 6px 6px 0; }
  .dj-card .dj-card-label { font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:#999; margin-bottom:2px; }
  .dj-card .dj-card-song { font-size:15px; color:#222; }
  .dj-yes-list { list-style:none; padding:0; margin:6px 0; }
  .dj-yes-list li { padding:4px 0; font-size:14px; }
  .dj-yes-list li::before { content:"✓"; color:#0D9488; font-weight:700; margin-right:8px; }
  .dj-maybe-block { padding:10px 14px; margin:8px 0; background:#FEF3C7; border-left:3px solid #F59E0B; border-radius:0 6px 6px 0; font-size:13px; color:#92400E; }
  .dj-skip-line { font-size:12px; color:#9CA3AF; font-style:italic; margin-top:10px; }
  .dj-tag-block { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
  .dj-tag { display:inline-block; padding:6px 12px; background:#F3F4F6; border:1px solid #E5E7EB; border-radius:999px; font-size:13px; }
  .dj-tag a { color:#0D9488; text-decoration:none; }
  .dj-tag .dj-tag-role { color:#9CA3AF; font-size:11px; margin-left:6px; }
  .dj-preflist { margin:6px 0 0 20px; padding:0; font-size:13px; color:#333; }
  .dj-preflist li { padding:2px 0; }
  .dj-stylenote { font-size:13px; color:#444; margin-top:6px; font-style:italic; }
`;

function renderEventHeader(event: CanonicalEvent): string {
  const couple = formatCoupleName(event.client);
  const titles = (event.client?.titles || []).filter(Boolean);
  const titleStr = titles.length === 2 ? `(${titles.join(" + ")})` : "";
  const dayOfPoc = (event.personnel || []).find((p) =>
    /day-of|point of contact|poc/i.test(p.role),
  );
  return `
    <div style="text-align:center; margin-bottom:24px;">
      ${renderBrandCirclesHeader(event.organization)}
      <h1 style="font-size:28px; font-weight:700; letter-spacing:0.02em;">${couple || escapeHtml(event.name)}</h1>
      <p style="color:#666; font-size:13px; margin-top:4px;">${escapeHtml(formatLongDate(event.event_date))} ${titleStr ? `<span style="color:#9CA3AF;">${escapeHtml(titleStr)}</span>` : ""}</p>
    </div>
    <div class="dj-section">
      <div class="dj-title">Event</div>
      ${event.venue?.name ? `<div style="font-size:14px;"><strong>${escapeHtml(event.venue.name)}</strong>${event.venue?.address ? ` · ${escapeHtml(event.venue.address)}` : ""}</div>` : ""}
      ${event.venue?.type ? `<div style="font-size:13px; color:#666;">${escapeHtml(event.venue.type === "both" ? "Indoor & Outdoor" : event.venue.type.charAt(0).toUpperCase() + event.venue.type.slice(1))}</div>` : ""}
      ${event.guests?.count ? `<div style="font-size:13px; color:#666;">Approx. ${event.guests.count} guests · ${event.attire ? escapeHtml(event.attire) : "Attire TBD"}</div>` : ""}
      ${dayOfPoc ? `<div style="font-size:13px; color:#666; margin-top:6px;"><strong>Day-of POC:</strong> ${escapeHtml(dayOfPoc.name)}${dayOfPoc.phone ? ` · ${escapeHtml(dayOfPoc.phone)}` : ""}</div>` : ""}
    </div>
  `;
}

function findSection(event: CanonicalEvent, titleRegex: RegExp): typeof event.song_sections[number] | undefined {
  return (event.song_sections || []).find((s) => titleRegex.test(s.title));
}

function renderCeremonyMusic(event: CanonicalEvent): string {
  const ceremony = findSection(event, /ceremony/i);
  if (!ceremony || ceremony.songs.length === 0) return "";
  const items = ceremony.songs
    .map((s, i) => `
      <div class="dj-card">
        <div class="dj-card-label">${escapeHtml(s.notes || `Song ${i + 1}`)}</div>
        <div class="dj-card-song">${escapeHtml(s.title || "—")}${s.artist ? ` <span style="color:#666;">— ${escapeHtml(s.artist)}</span>` : ""}</div>
      </div>`)
    .join("");
  return `<div class="dj-section"><div class="dj-title">Ceremony Music</div>${items}</div>`;
}

function renderReceptionHighlights(event: CanonicalEvent): string {
  const reception = findSection(event, /reception|highlight/i);
  if (!reception || reception.songs.length === 0) return "";
  const items = reception.songs
    .map((s) => `
      <div class="dj-card">
        <div class="dj-card-song">${escapeHtml(s.title || "—")}${s.artist ? ` <span style="color:#666;">— ${escapeHtml(s.artist)}</span>` : ""}</div>
      </div>`)
    .join("");
  return `<div class="dj-section"><div class="dj-title">Reception Highlights</div><div class="dj-subtitle">First dance, parent dances, cake cutting, bouquet, last dance</div>${items}</div>`;
}

function renderLineDances(event: CanonicalEvent): string {
  const lineDances = event.preferences?.line_dances || {};
  const keys = Object.keys(lineDances);
  if (keys.length === 0) return "";

  const yeses = keys.filter((k) => lineDances[k] === "yes");
  const maybes = keys.filter((k) => lineDances[k] === "maybe");
  const nos = keys.filter((k) => lineDances[k] === "no");

  let body = "";
  if (yeses.length > 0) {
    body += `<ul class="dj-yes-list">${yeses
      .map((k) => `<li>${escapeHtml(titleCase(k))}</li>`)
      .join("")}</ul>`;
  }
  if (maybes.length > 0) {
    body += `<div class="dj-maybe-block"><strong>DJ judgment call:</strong> ${maybes.map(titleCase).map(escapeHtml).join(", ")} — play if the floor is hungry for it.</div>`;
  }
  if (nos.length > 0) {
    body += `<div class="dj-skip-line">Client said no: ${nos.map(titleCase).map(escapeHtml).join(", ")}.</div>`;
  }

  return `<div class="dj-section"><div class="dj-title">Approved Line Dances</div>${body}</div>`;
}

function renderMusicPreferences(event: CanonicalEvent): string {
  const prefs = event.preferences || {};
  const mustPlay = prefs.must_play || [];
  const doNotPlay = prefs.do_not_play || [];
  const styleNotes = prefs.style_notes;
  if (mustPlay.length === 0 && doNotPlay.length === 0 && !styleNotes) return "";

  const mp = mustPlay.length > 0
    ? `<div style="margin-top:8px;"><strong>Must Play</strong><ul class="dj-preflist">${mustPlay.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></div>`
    : "";
  const dnp = doNotPlay.length > 0
    ? `<div style="margin-top:8px;"><strong style="color:#B91C1C;">Do Not Play</strong><ul class="dj-preflist">${doNotPlay.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></div>`
    : "";
  const sn = styleNotes
    ? `<div class="dj-stylenote">${escapeHtml(styleNotes)}</div>`
    : "";

  return `<div class="dj-section"><div class="dj-title">Music Preferences</div>${mp}${dnp}${sn}</div>`;
}

function renderTagTheseVendors(vendors: VendorEntry[]): string {
  const tagged = vendors.filter((v) => v.ig_handle);
  if (tagged.length === 0) return "";
  const tags = tagged
    .map((v) => {
      const handle = v.ig_handle!.replace(/^@/, "");
      return `<div class="dj-tag"><a href="https://instagram.com/${encodeURIComponent(handle)}" target="_blank">@${escapeHtml(handle)}</a>${v.type ? `<span class="dj-tag-role">${escapeHtml(v.type)}</span>` : ""}</div>`;
    })
    .join("");
  return `<div class="dj-section"><div class="dj-title">Tag These Vendors</div><div class="dj-subtitle">Social-post hooks for the day-of gallery.</div><div class="dj-tag-block">${tags}</div></div>`;
}

function renderIntros(personnel: PersonnelEntry[]): string {
  const intros = personnel.filter((p) =>
    /wedding party duo|moh|newlyweds/i.test(p.role),
  );
  if (intros.length === 0) return "";
  const items = intros
    .map(
      (p) => `<div class="dj-card"><div class="dj-card-label">${escapeHtml(p.role)}</div><div class="dj-card-song">${escapeHtml(p.name)}</div></div>`,
    )
    .join("");
  return `<div class="dj-section"><div class="dj-title">Introductions</div>${items}</div>`;
}

const ALL_CAPS_TOKENS = new Set(["ymca", "dj", "moh", "mc"]);
function titleCase(s: string): string {
  return s
    .split(" ")
    .map((w) => {
      if (ALL_CAPS_TOKENS.has(w.toLowerCase())) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

export function renderOutputZ(event: CanonicalEvent): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(event.name)} — DJ Run of Show</title>
  <style>${BASE_FONT_STYLES}${Z_STYLES}</style>
</head>
<body>
  <div class="dj-page">
    ${renderEventHeader(event)}
    ${renderIntros(event.personnel || [])}
    ${renderCeremonyMusic(event)}
    ${renderReceptionHighlights(event)}
    ${renderLineDances(event)}
    ${renderMusicPreferences(event)}
    ${renderTagTheseVendors(event.vendors || [])}
    <div class="footer">Confidential — For DJ team use only</div>
  </div>
</body>
</html>`;
}
