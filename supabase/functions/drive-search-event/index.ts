// drive-search-event — Cut 5 (Layer 6 of v2 architecture).
//
// Builds a structured Drive search query from { name, date } per Q6 rec:
// "auto-find first; if 0 or 5+ matches fall back to picker; auto-confirm on 1
// match." This function returns the QUERY (and a set of search variants),
// not the actual search results.
//
// ‼️ MARKED FOR JOSH'S REVIEW — Drive API execution gap:
//   Supabase edge functions do not have Google Drive API access today. The
//   existing Google OAuth flow (google-calendar-oauth) only requests calendar
//   scopes. To execute the search against your Drive, ONE of these has to
//   happen:
//     (a) Extend google-calendar-oauth to request drive.metadata.readonly +
//         drive.readonly scopes. Adds a consent-screen re-prompt for you.
//     (b) Have the frontend execute the search using a Google API JS client
//         (browser-side, user-consented Drive read).
//     (c) Run the actual search Cowork-side via the Drive MCP, with this
//         function emitting the query for Cowork to consume.
//
// For now this function returns:
//   { drive_query, name_variants, date_variants, ready_for_execution: false }
// so the frontend can render "we'll search Drive for: <query>" and Josh can
// approve before committing to the Drive scope.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Parse ISO YYYY-MM-DD (or common variants) into components.
function parseDate(raw: string): { y: number; m: number; d: number } | null {
  const s = raw.trim();
  let mm = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mm) return { y: parseInt(mm[1]), m: parseInt(mm[2]), d: parseInt(mm[3]) };
  mm = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (mm) {
    const y = mm[3].length === 2 ? 2000 + parseInt(mm[3]) : parseInt(mm[3]);
    return { y, m: parseInt(mm[1]), d: parseInt(mm[2]) };
  }
  return null;
}

function dateVariants(raw: string): string[] {
  const parsed = parseDate(raw);
  if (!parsed) return [raw];
  const { y, m, d } = parsed;
  const m2 = String(m).padStart(2, "0");
  const d2 = String(d).padStart(2, "0");
  const yShort = String(y).slice(-2);
  const longMonth = MONTHS_LONG[m - 1];
  const shortMonth = MONTHS_SHORT[m - 1];
  return Array.from(new Set([
    `${m}/${d}/${y}`,
    `${m}-${d}-${y}`,
    `${m}.${d}.${y}`,
    `${m}/${d}/${yShort}`,
    `${m}-${d}-${yShort}`,
    `${m}.${d}.${yShort}`,
    `${m2}/${d2}/${y}`,
    `${m2}-${d2}-${y}`,
    `${y}-${m2}-${d2}`,
    `${longMonth} ${d} ${y}`,
    `${longMonth} ${d}, ${y}`,
    `${shortMonth} ${d} ${y}`,
    `${shortMonth} ${d}, ${y}`,
  ]));
}

function nameVariants(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const cleaned = trimmed.replace(/\s+/g, " ");
  const tokens = cleaned.split(" ").filter(Boolean);

  const out = new Set<string>();
  out.add(cleaned);

  // Strip leading honorifics
  const honorifics = /^(mr|mrs|ms|dr)\.?\s+/i;
  if (honorifics.test(cleaned)) out.add(cleaned.replace(honorifics, ""));

  // Last token alone (often the surname or event noun)
  if (tokens.length >= 2) out.add(tokens[tokens.length - 1]);

  // Couple/event split: "Hoffman Wedding" → "Hoffman" + "Wedding"
  if (tokens.length === 2) {
    out.add(tokens[0]);
    out.add(tokens[1]);
  }

  // "David & Erica Hoffman" → split at &
  if (cleaned.includes("&")) {
    for (const half of cleaned.split("&").map((s) => s.trim()).filter(Boolean)) {
      out.add(half);
      const halfTokens = half.split(" ").filter(Boolean);
      if (halfTokens.length >= 2) out.add(halfTokens[halfTokens.length - 1]);
    }
  }

  return Array.from(out);
}

function buildDriveQuery(names: string[], dates: string[]): string {
  // Drive API search syntax (https://developers.google.com/drive/api/guides/search-files):
  //   fullText contains 'foo' or fullText contains 'bar'
  //   (name contains 'X' or name contains 'Y') and (fullText contains 'D1' or fullText contains 'D2')
  const nameClauses = names.map((n) => `name contains '${escapeDriveQ(n)}'`);
  const dateClauses = dates.map((d) => `fullText contains '${escapeDriveQ(d)}'`);
  const namePart = nameClauses.length > 0 ? `(${nameClauses.join(" or ")})` : "";
  const datePart = dateClauses.length > 0 ? `(${dateClauses.join(" or ")})` : "";
  return [namePart, datePart].filter(Boolean).join(" and ");
}

function escapeDriveQ(s: string): string {
  // Drive search literals quote with single quotes; escape with backslash
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const date = typeof body?.date === "string" ? body.date.trim() : "";
    if (!name) return jsonResponse({ error: "name required" }, 400);
    if (!date) return jsonResponse({ error: "date required" }, 400);

    const names = nameVariants(name);
    const dates = dateVariants(date);
    const driveQuery = buildDriveQuery(names, dates);

    return jsonResponse({
      drive_query: driveQuery,
      name_variants: names,
      date_variants: dates,
      ready_for_execution: false,
      execution_notes:
        "Drive scope not yet granted to this edge function. Surface the query to Josh; execution path TBD.",
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});
