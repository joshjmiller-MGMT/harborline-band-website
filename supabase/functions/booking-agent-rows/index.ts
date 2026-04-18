// Reads the configured Booking Agent Google Sheet (must be link-viewable),
// classifies each row as a Reachout or Follow-up based on its Status column,
// and returns calendar events keyed off the Next Followup Date column.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: cfg } = await supabase
      .from("booking_agent_config")
      .select("*")
      .eq("id", "default")
      .maybeSingle();

    if (!cfg) {
      return new Response(
        JSON.stringify({ configured: false, events: [], reachouts: [], followups: [], note: "No booking_agent_config row" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const c = cfg as unknown as Config;

    if (!c.enabled || !c.sheet_id || !c.next_followup_col || !c.name_col) {
      return new Response(
        JSON.stringify({
          configured: false,
          events: [],
          reachouts: [],
          followups: [],
          note: "Booking Agent not fully configured. Set Sheet ID, Name column, and Next Followup Date column.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const gidPart = c.tab_gid ? `&gid=${encodeURIComponent(c.tab_gid)}` : "";
    const csvUrl = `https://docs.google.com/spreadsheets/d/${c.sheet_id}/export?format=csv${gidPart}`;
    const resp = await fetch(csvUrl);
    if (!resp.ok) {
      return new Response(
        JSON.stringify({
          configured: true,
          events: [],
          reachouts: [],
          followups: [],
          error: `Could not fetch sheet (status ${resp.status}). Set the sheet to "Anyone with the link can view".`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const csv = await resp.text();
    const grid = parseCSV(csv);
    if (grid.length === 0) {
      return new Response(
        JSON.stringify({ configured: true, events: [], reachouts: [], followups: [], note: "Sheet is empty" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const headers = grid[0];
    const dataRows = grid.slice(1);

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

    const events: any[] = [];
    const reachouts: any[] = [];
    const followups: any[] = [];

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

      const item = {
        id: `booking-${i}-${name.slice(0, 32).replace(/\s+/g, "-")}`,
        rowIndex: i + 2, // 1-indexed + header
        name,
        status: statusRaw,
        type: idx.type >= 0 ? row[idx.type] || "" : "",
        notes: idx.notes >= 0 ? row[idx.notes] || "" : "",
        link: idx.link >= 0 ? row[idx.link] || "" : "",
        lastContact: idx.lastContact >= 0 ? row[idx.lastContact] || "" : "",
        nextFollowup: nextFollowRaw,
        nextFollowupDate: parsed.date,
        kind,
      };

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
          // Label includes "Action Items" so it's automatically picked up by
          // the existing Today's Action Items widget (which filters by regex).
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
        counts: { reachouts: reachouts.length, followups: followups.length, events: events.length },
        sheetUrl: `https://docs.google.com/spreadsheets/d/${c.sheet_id}/edit${c.tab_gid ? `#gid=${c.tab_gid}` : ""}`,
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
