// Reads the configured Booking Agent Google Sheet (must be link-viewable),
// classifies each row as a Reachout or Follow-up based on its Status column,
// and returns calendar events keyed off the Next Followup Date column.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOperator } from "../_shared/require-operator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Config = {
  enabled: boolean;
  sheet_id: string;
  tab_gid: string;
  venue_tab_gid: string;
  status_col: string;
  name_col: string;
  next_followup_col: string;
  last_contact_col: string;
  notes_col: string;
  link_col: string;
  type_col: string;
  reachout_values: string;
  followup_values: string;
  color: string;
};

// Convert "A" → 0, "B" → 1, "AA" → 26. Returns -1 for empty/invalid.
function colLetterToIndex(letter: string): number {
  const s = (letter || "").trim().toUpperCase();
  if (!s || !/^[A-Z]+$/.test(s)) return -1;
  let n = 0;
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// Resolve a column reference (letter like "C" or header name like "Status")
// against the headers row. Letter wins if it parses; otherwise case-insensitive
// header match.
function resolveCol(ref: string, headers: string[]): number {
  if (!ref) return -1;
  const asLetter = colLetterToIndex(ref);
  if (asLetter >= 0) return asLetter;
  const norm = ref.trim().toLowerCase();
  return headers.findIndex((h) => (h || "").trim().toLowerCase() === norm);
}

function parseDateLoose(value: string): { date: string | null; time: string | null } {
  if (!value || !value.trim()) return { date: null, time: null };
  const v = value.trim();
  // ISO yyyy-mm-dd
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (iso) {
    const date = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    const time = iso[4] ? `${iso[4].padStart(2, "0")}:${iso[5]}` : null;
    return { date, time };
  }
  // m/d/yyyy or m/d/yy
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (us) {
    let yr = parseInt(us[3], 10);
    if (yr < 100) yr += 2000;
    const date = `${yr}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
    const time = us[4] ? `${us[4].padStart(2, "0")}:${us[5]}` : null;
    return { date, time };
  }
  // Native fallback
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { date, time: null };
  }
  return { date: null, time: null };
}

// P311 default-bucket derivation. Used when no override exists in
// booking_pipeline_buckets for a given (sheet_id, row_index). Matches the
// 6-bucket default lane set in src/components/board/bookingBuckets.ts.
function deriveBucket(statusLower: string, kind: "reachout" | "followup" | "unknown"): string {
  const s = statusLower;
  if (/done|complete|played|cancel|cancelled|passed|dead|lost|archive/.test(s)) return "Done";
  if (/confirm|booked|signed|deposit|contracted/.test(s)) return "Confirmed";
  if (/followup\s*2|f2|second\s+followup|no\s+response/.test(s)) return "Followup 2";
  if (/convo|in\s+progress|talking|negotiat/.test(s)) return "In Convo";
  if (/awaiting|sent|waiting|pending/.test(s)) return "Awaiting Reply";
  if (/cold|new|no\s+reply|reach/.test(s)) return "Reach Out";
  if (kind === "reachout") return "Reach Out";
  if (kind === "followup") return "Awaiting Reply";
  return "Reach Out";
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(current); current = ""; }
      else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        row.push(current); current = ""; rows.push(row); row = [];
        if (ch === "\r") i++;
      } else current += ch;
    }
  }
  if (current || row.length > 0) { row.push(current); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function normalizeHeaders(headers: string[]): string[] {
  return headers.map((h) => (h || "").trim().toLowerCase());
}

function looksLikeVenueHeaders(headers: string[]): boolean {
  const lower = normalizeHeaders(headers);
  return lower.includes("venue / festival name")
    || lower.includes("venue / festival")
    || (lower.includes("responded?") && lower.includes("contact status") && lower.includes("next action"));
}

function extractCandidateSheetGids(html: string): string[] {
  const gids: string[] = [];
  const regex = /\[\\"dt[^\\"]+\\",\[\\"(\d+)\\"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const gid = match[1];
    if (gid && !gids.includes(gid)) gids.push(gid);
  }
  return gids;
}

async function fetchSheetGrid(sheetId: string, gid: string) {
  const gidPart = gid ? `&gid=${encodeURIComponent(gid)}` : "";
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidPart}`;
  const resp = await fetch(csvUrl);
  if (!resp.ok) {
    return { ok: false, status: resp.status, csvUrl, grid: [] as string[][] };
  }
  const csv = await resp.text();
  return { ok: true, status: resp.status, csvUrl, grid: parseCSV(csv) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denial = await requireOperator(req);
  if (denial) return denial;

  try {
    // Parse optional ?tab=lead|venue (default: lead)
    const url = new URL(req.url);
    let tabParam = (url.searchParams.get("tab") || "").toLowerCase();
    if (!tabParam && req.method === "POST") {
      try {
        const body = await req.clone().json();
        if (body && typeof body.tab === "string") tabParam = body.tab.toLowerCase();
      } catch (_) { /* ignore */ }
    }
    const useVenueTab = tabParam === "venue" || tabParam === "venues" || tabParam === "festival";
    // Bands relationship view reads the JJMM "Artists — bands for show swaps / support
    // slots" tab. Its gid is stable, so it's hardcoded here rather than adding a config
    // column (keeps this lane migration-free). Returns generic header→value rows; the
    // /team/bands page filters to Category=Artist and colors by the "Artist Fit" tier.
    const useBandsTab = tabParam === "bands" || tabParam === "artists";
    const BANDS_TAB_GID = "1165689834";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: cfg } = await supabase
      .from("booking_agent_config")
      .select("*")
      .eq("id", "default")
      .maybeSingle();

    if (!cfg) {
      return new Response(
        JSON.stringify({ configured: false, events: [], reachouts: [], followups: [], rows: [], note: "No booking_agent_config row" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const c = cfg as unknown as Config;

    if (!useVenueTab && !useBandsTab && (!c.enabled || !c.sheet_id || !c.next_followup_col || !c.name_col)) {
      return new Response(
        JSON.stringify({
          configured: false,
          events: [],
          reachouts: [],
          followups: [],
          rows: [],
          note: "Booking Agent not fully configured. Set Sheet ID, Name column, and Next Followup Date column.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if ((useVenueTab || useBandsTab) && (!c.enabled || !c.sheet_id)) {
      return new Response(
        JSON.stringify({ configured: false, rows: [], note: "Booking Agent not configured. Set the Sheet ID first." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let activeGid = useVenueTab ? c.venue_tab_gid : useBandsTab ? BANDS_TAB_GID : c.tab_gid;
    let note: string | undefined;

    let sheetResult = await fetchSheetGrid(c.sheet_id, activeGid);
    if (!sheetResult.ok) {
      return new Response(
        JSON.stringify({
          configured: true,
          events: [],
          reachouts: [],
          followups: [],
          rows: [],
          error: `Could not fetch sheet (status ${sheetResult.status}). Set the sheet to "Anyone with the link can view".`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let grid = sheetResult.grid;

    // If the venue gid is blank or points at the wrong tab, scan candidate sheet gids
    // and auto-resolve the one whose header row matches the venue tracker columns.
    if (useVenueTab) {
      const initialHeaders = grid[0] || [];
      if (!activeGid || !looksLikeVenueHeaders(initialHeaders)) {
        try {
          const editResp = await fetch(`https://docs.google.com/spreadsheets/d/${c.sheet_id}/edit`);
          if (editResp.ok) {
            const html = await editResp.text();
            const candidateGids = extractCandidateSheetGids(html).filter((gid) => gid !== activeGid);
            for (const gid of candidateGids) {
              const candidate = await fetchSheetGrid(c.sheet_id, gid);
              if (!candidate.ok || candidate.grid.length === 0) continue;
              if (!looksLikeVenueHeaders(candidate.grid[0] || [])) continue;
              activeGid = gid;
              sheetResult = candidate;
              grid = candidate.grid;
              note = c.venue_tab_gid
                ? `Configured venue tab gid did not match the venue tracker, so the correct tab was auto-detected.`
                : `Auto-detected the Venue & Festival Tracker tab.`;
              await supabase
                .from("booking_agent_config")
                .update({ venue_tab_gid: gid, updated_at: new Date().toISOString() })
                .eq("id", "default");
              break;
            }
          }
        } catch (_) {
          // fall back to the original sheet result if auto-detection fails
        }
      }
    }

    if (grid.length === 0) {
      return new Response(
        JSON.stringify({ configured: true, events: [], reachouts: [], followups: [], rows: [], note: note || "Sheet is empty" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const headers = grid[0];
    const dataRows = grid.slice(1);
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${c.sheet_id}/edit${activeGid ? `#gid=${activeGid}` : ""}`;

    // === Venue & Festival OR Bands tab: return generic header→value rows ===
    if (useVenueTab || useBandsTab) {
      const prefix = useBandsTab ? "band" : "venue";
      const rows = dataRows
        .map((r, i) => {
          const obj: Record<string, string> = {};
          headers.forEach((h, hi) => {
            const key = (h || `col_${hi}`).trim() || `col_${hi}`;
            obj[key] = (r[hi] || "").trim();
          });
          const hasAny = Object.values(obj).some((v) => v !== "");
          if (!hasAny) return null;
          return { id: `${prefix}-${i}`, rowIndex: i + 2, fields: obj };
        })
        .filter(Boolean);

      return new Response(
        JSON.stringify({ configured: true, tab: useBandsTab ? "bands" : "venue", headers, rows, count: rows.length, sheetUrl, note }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const idx = {
      status: resolveCol(c.status_col, headers),
      name: resolveCol(c.name_col, headers),
      nextFollow: resolveCol(c.next_followup_col, headers),
      lastContact: resolveCol(c.last_contact_col, headers),
      notes: resolveCol(c.notes_col, headers),
      link: resolveCol(c.link_col, headers),
      type: resolveCol(c.type_col, headers),
    };

    const reachoutSet = new Set(
      (c.reachout_values || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    const followupSet = new Set(
      (c.followup_values || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );

    // P311: pull bucket overlay for this sheet so we can stamp every row.
    const { data: bucketRows } = await supabase
      .from("booking_pipeline_buckets")
      .select("row_index, bucket")
      .eq("sheet_id", c.sheet_id);
    const bucketOverlay = new Map<number, string>();
    for (const br of (bucketRows ?? []) as Array<{ row_index: number; bucket: string }>) {
      bucketOverlay.set(br.row_index, br.bucket);
    }

    const events: any[] = [];
    const reachouts: any[] = [];
    const followups: any[] = [];
    const rows: any[] = [];

    dataRows.forEach((row, i) => {
      if (idx.name < 0) return;
      const name = (row[idx.name] || "").trim();
      if (!name) return;

      const statusRaw = idx.status >= 0 ? (row[idx.status] || "").trim() : "";
      const statusLower = statusRaw.toLowerCase();
      let kind: "reachout" | "followup" | "unknown" = "unknown";
      if (reachoutSet.size > 0 && reachoutSet.has(statusLower)) kind = "reachout";
      else if (followupSet.size > 0 && followupSet.has(statusLower)) kind = "followup";
      else if (reachoutSet.size === 0 && followupSet.size === 0) {
        // Heuristic when nothing configured: "no reply"-ish → reachout, else followup
        kind = /reach|new|cold|no reply/i.test(statusRaw) ? "reachout" : "followup";
      }

      const nextFollowRaw = idx.nextFollow >= 0 ? row[idx.nextFollow] : "";
      const parsed = parseDateLoose(nextFollowRaw || "");

      const rowIndex = i + 2;
      const bucket = bucketOverlay.get(rowIndex) ?? deriveBucket(statusLower, kind);

      const item = {
        id: `booking-${i}-${name.slice(0, 32).replace(/\s+/g, "-")}`,
        rowIndex,
        name,
        status: statusRaw,
        type: idx.type >= 0 ? row[idx.type] || "" : "",
        notes: idx.notes >= 0 ? row[idx.notes] || "" : "",
        link: idx.link >= 0 ? row[idx.link] || "" : "",
        lastContact: idx.lastContact >= 0 ? row[idx.lastContact] || "" : "",
        nextFollowup: nextFollowRaw,
        nextFollowupDate: parsed.date,
        kind,
        bucket,
      };

      rows.push(item);
      if (kind === "reachout") reachouts.push(item);
      else if (kind === "followup") followups.push(item);

      if (parsed.date) {
        const startISO = parsed.time
          ? new Date(`${parsed.date}T${parsed.time}`).toISOString()
          : new Date(`${parsed.date}T00:00:00`).toISOString();
        const endISO = parsed.time
          ? new Date(new Date(startISO).getTime() + 30 * 60 * 1000).toISOString()
          : startISO;
        events.push({
          id: item.id,
          title: `📞 ${name}${statusRaw ? ` · ${statusRaw}` : ""}`,
          start: startISO,
          end: endISO,
          allDay: !parsed.time,
          source: "booking",
          sourceLabel: "Booking Agent — Action Items",
          color: c.color || "#f59e0b",
          itemUrl: item.link || `https://docs.google.com/spreadsheets/d/${c.sheet_id}/edit${c.tab_gid ? `#gid=${c.tab_gid}` : ""}`,
          kind,
        });
      }
    });

    return new Response(
      JSON.stringify({
        configured: true,
        events,
        reachouts,
        followups,
        rows,
        sheetId: c.sheet_id,
        counts: { reachouts: reachouts.length, followups: followups.length, events: events.length, rows: rows.length },
        sheetUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg, events: [], reachouts: [], followups: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
