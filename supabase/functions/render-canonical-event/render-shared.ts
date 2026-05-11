// Shared rendering helpers used by all 3 output templates.

export const BASE_FONT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; background: white; color: #222; line-height: 1.7; font-size: 14px; }
  .page { max-width: 760px; margin: 0 auto; padding: 50px 55px; }
  .header { text-align: center; margin-bottom: 32px; }
  .brand-text { max-height: 140px; width: auto; max-width: 320px; margin: 0 auto 20px; display: block; }
  .divider { border: none; border-top: 1.5px solid #222; margin: 20px 0; }
  .divider-light { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
  .detail-row { font-size: 14px; color: #222; margin-bottom: 5px; line-height: 1.6; }
  .detail-row strong { font-weight: 600; }
  .section-title { font-size: 18px; font-weight: 700; color: #222; margin-top: 32px; margin-bottom: 6px; }
  .section-subtitle { font-size: 13px; color: #666; font-style: italic; margin-bottom: 10px; }
  .song-list { list-style: decimal; padding-left: 24px; margin: 8px 0; }
  .song-list li { font-size: 14px; color: #222; padding: 2px 0; }
  .footer { text-align: center; margin-top: 48px; padding-top: 16px; border-top: 1px solid #ccc; font-size: 11px; color: #999; letter-spacing: 0.06em; text-transform: uppercase; }
  @media print { body { padding: 0; } .page { padding: 30px 40px; } }
`;

export function escapeHtml(s: string | undefined | null): string {
  if (s === undefined || s === null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatLongDate(iso: string): string {
  // ISO YYYY-MM-DD → "Saturday, March 28, 2026"
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(parseInt(y), parseInt(mo) - 1, parseInt(d)));
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  return `${days[date.getUTCDay()]}, ${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function formatCoupleName(client: {
  primary?: string;
  secondary?: string;
}): string {
  if (client.primary && client.secondary) {
    return `${escapeHtml(client.primary)} & ${escapeHtml(client.secondary)}`;
  }
  return escapeHtml(client.primary || client.secondary || "");
}

export function renderDetailRow(label: string, value: string | undefined): string {
  if (!value) return "";
  return `<div class="detail-row"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`;
}

// Venture-aware decorative-circles header. Per Josh 2026-05-11:
//   Harborline → blue → purple gradient
//   TSB        → red → orange gradient
//   BSE / else → no circles (omitted entirely)
// 5 circles, 14px diameter, sampled across the gradient. Centered above the
// title block. Canonical brand-visual rule lives at
// `co-manager/04-brand-voice/visual-brand-language.md`.
const BRAND_CIRCLES: Record<string, [string, string, string, string, string]> = {
  harborline: ["#2563eb", "#4f46e5", "#7c3aed", "#9333ea", "#a855f7"], // blue → purple
  tsb:        ["#dc2626", "#e3501f", "#ea580c", "#f97316", "#fb923c"], // red  → orange
};

export function renderBrandCirclesHeader(organization?: string): string {
  const key = (organization || "").toLowerCase().trim();
  const colors = BRAND_CIRCLES[key];
  if (!colors) return ""; // BSE + default — no circles
  const dots = colors
    .map(
      (c) => `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c};margin:0 6px;"></span>`,
    )
    .join("");
  return `<div style="text-align:center;margin:0 0 18px 0;">${dots}</div>`;
}
