// chart-library-drive-sync.mjs — P14 Round 2
//
// Pushes chart-library/output/ to Google Drive and populates chart_index in
// Supabase. Idempotent: re-runnable after chart-library ships new tunes.
//
// What it does:
//   1. Reads OAuth token from google_calendar_tokens (filter by ACCOUNT_EMAIL
//      env if set, else picks the first row).
//   2. Verifies Drive scope is granted (drive.readonly). Refreshes access
//      token if expired (mirrors drive-search-event pattern).
//   3. Walks chart-library/output/ recursively. Skips backups, reports,
//      .DS_Store, ireal-pro/ (reports-only — no PDFs).
//   4. Parses metadata.csv into a Title→[row] multi-map.
//   5. For each PDF: computes sha256, looks up matching CSV row by Title +
//      folder-fuzzy-match, ensures Drive folder chain exists, uploads, and
//      upserts the chart_index row.
//   6. Skip-if-already-synced: existing row with matching (folder_path,
//      filename, sha256) → no-op. Existing row with different sha256 →
//      re-upload to Drive (delete old file, upload new) + update row.
//
// Env (read from .env.local in chart-library/ or process.env):
//   SUPABASE_URL                       (required)
//   SUPABASE_SERVICE_ROLE_KEY          (required)
//   GOOGLE_CALENDAR_CLIENT_ID          (required)
//   GOOGLE_CALENDAR_CLIENT_SECRET      (required)
//   ACCOUNT_EMAIL                      (optional — which Gmail to use)
//   OUTPUT_DIR                         (default: ../chart-library/output)
//   DRIVE_ROOT_FOLDER                  (default: "Harborline/chart-library")
//   DRY_RUN=1                          (preview without uploading)
//   LIMIT=N                            (stop after N file ops — smoke test)
//
// Run: node scripts/chart-library-drive-sync.mjs

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readdirSync, statSync, readFileSync, createReadStream } from "node:fs";
import { join, relative, dirname, basename } from "node:path";

// ───── config ───────────────────────────────────────────────────────────────

const ENV = process.env;
const SUPABASE_URL = ENV.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_CLIENT_ID = ENV.GOOGLE_CALENDAR_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = ENV.GOOGLE_CALENDAR_CLIENT_SECRET;
const ACCOUNT_EMAIL = ENV.ACCOUNT_EMAIL || null;
const DRIVE_ROOT_FOLDER = ENV.DRIVE_ROOT_FOLDER || "Harborline/chart-library";
const OUTPUT_DIR =
  ENV.OUTPUT_DIR ||
  join(import.meta.dirname, "..", "..", "..", "chart-library", "output");
const DRY_RUN = ENV.DRY_RUN === "1";
const LIMIT = ENV.LIMIT ? parseInt(ENV.LIMIT, 10) : null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
  die("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn(
    "⚠ Missing GOOGLE_CALENDAR_CLIENT_ID / GOOGLE_CALENDAR_CLIENT_SECRET. " +
      "Refresh-on-401 disabled. Run will fail if the OAuth access token " +
      "expires mid-upload. Token expiry is logged below — make sure there's " +
      "enough headroom for the full run."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ───── exclusions ───────────────────────────────────────────────────────────

const EXCLUDED_FILE_PATTERNS = [
  /\.DS_Store$/,
  /^metadata\.csv\.bak/,
  /SPLIT_REPORT\.md$/i,
  /^PHASE\d+_REPORT\.md$/i,
];
const EXCLUDED_DIRS = new Set(["ireal-pro"]);

function isExcluded(filename, folderPath) {
  if (EXCLUDED_DIRS.has(folderPath.split("/")[0])) return true;
  return EXCLUDED_FILE_PATTERNS.some((p) => p.test(filename));
}

// ───── filesystem walk ──────────────────────────────────────────────────────

function walkFiles(rootDir) {
  const files = [];
  function recurse(dir) {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const st = statSync(fullPath);
      if (st.isDirectory()) {
        recurse(fullPath);
      } else if (st.isFile()) {
        const relPath = relative(rootDir, fullPath);
        const folderPath = dirname(relPath) === "." ? "" : dirname(relPath);
        const filename = basename(relPath);
        if (isExcluded(filename, folderPath)) continue;
        files.push({
          folder_path: folderPath,
          filename,
          absolute_path: fullPath,
          file_size: st.size,
        });
      }
    }
  }
  recurse(rootDir);
  return files.sort((a, b) =>
    (a.folder_path + "/" + a.filename).localeCompare(
      b.folder_path + "/" + b.filename
    )
  );
}

function sha256File(absPath) {
  const data = readFileSync(absPath);
  return createHash("sha256").update(data).digest("hex");
}

// ───── CSV parsing ──────────────────────────────────────────────────────────

function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        fields.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  let buf = "";
  let inQuotes = false;
  // Handle multi-line quoted fields by joining lines while inside quotes
  for (const line of lines) {
    buf += (buf ? "\n" : "") + line;
    const dq = (line.match(/"/g) || []).length;
    inQuotes = (inQuotes ? dq % 2 === 0 : dq % 2 === 1) ? !inQuotes : inQuotes;
    if (!inQuotes) {
      rows.push(buf);
      buf = "";
    }
  }
  if (buf) rows.push(buf);
  if (!rows.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(rows[0]);
  const parsed = rows.slice(1).filter(Boolean).map((r) => {
    const fields = parseCsvLine(r);
    const obj = {};
    headers.forEach((h, i) => (obj[h] = fields[i] ?? ""));
    return obj;
  });
  return { headers, rows: parsed };
}

function splitArrayField(value, sep) {
  if (!value) return [];
  return value
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ───── Title→folder slug matching ───────────────────────────────────────────

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Build a multi-map: lowercased title → [rows]
function buildTitleIndex(csvRows) {
  const idx = new Map();
  for (const row of csvRows) {
    const title = (row.Title || "").trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (!idx.has(key)) idx.set(key, []);
    idx.get(key).push(row);
  }
  return idx;
}

// For a file at folder_path, find the matching CSV row.
function findCsvMatch(file, titleIndex) {
  const titleCandidate = file.filename.replace(/\.pdf$/i, "");
  const titleKey = titleCandidate.toLowerCase();
  let matches = titleIndex.get(titleKey) || [];

  // Try title with parenthetical suffix stripped (e.g. "Promise (Laufey)" → "Promise")
  if (matches.length === 0) {
    const stripped = titleCandidate.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (stripped !== titleCandidate) {
      matches = titleIndex.get(stripped.toLowerCase()) || [];
    }
  }

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  // Disambiguate by folder_path matching Reference book slug
  const folderTokens = file.folder_path.toLowerCase().split("/");
  const lastFolderSlug = folderTokens[folderTokens.length - 1] || "";

  // Score each match by similarity between Reference slug and folder slug
  let best = null;
  let bestScore = -1;
  for (const m of matches) {
    const ref = (m.Reference || "").toLowerCase();
    const refBookSlug = slugify(ref.replace(/\s+p\.?\s*\d+.*$/i, ""));
    let score = 0;
    if (refBookSlug && lastFolderSlug.includes(refBookSlug.split("-")[0]))
      score += 1;
    if (refBookSlug === lastFolderSlug) score += 5;
    if (refBookSlug && lastFolderSlug.startsWith(refBookSlug.slice(0, 6)))
      score += 2;
    // Genre folder match for single-charts
    const csvGenre = (m.Genre || "").toLowerCase();
    if (
      file.folder_path.startsWith("single-charts/") &&
      csvGenre &&
      file.folder_path.includes(csvGenre)
    )
      score += 3;
    if (
      file.folder_path === "originals" &&
      /^original:/i.test(m.Reference || "")
    )
      score += 5;
    if (
      file.folder_path.startsWith("chord-charts") &&
      /^chord chart:/i.test(m.Reference || "")
    )
      score += 5;
    if (
      file.folder_path.startsWith("parts/") &&
      ((m.Tags || "").toLowerCase().includes("part") ||
        /part/i.test(m.Reference || ""))
    )
      score += 5;
    if (
      file.folder_path.startsWith("setlists/") &&
      (m.Tags || "").toLowerCase().includes("setlist-meta")
    )
      score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

// ───── OAuth + Drive helpers ────────────────────────────────────────────────

async function loadOAuthRow() {
  const { data: rows, error } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!rows || rows.length === 0)
    die(
      "No Google account connected. Connect one via /team/dashboard before running."
    );
  const row = ACCOUNT_EMAIL
    ? rows.find((r) => r.account_email === ACCOUNT_EMAIL)
    : rows[0];
  if (!row)
    die(
      `No google_calendar_tokens row matches ACCOUNT_EMAIL=${ACCOUNT_EMAIL}. Available: ${rows
        .map((r) => r.account_email)
        .join(", ")}`
    );
  if (!row.scope || !/drive\.readonly/.test(row.scope))
    die(
      `Drive scope not granted on ${row.account_email}. Re-consent via /team/dashboard.`
    );
  return row;
}

async function refreshAccessToken(row) {
  // Prefer the server-side refresh edge function — it has the real Google
  // client secrets in env (Supabase Vault wraps them; the dashboard doesn't
  // surface the literal values). Fall back to direct Google call ONLY if
  // local GOOGLE_CLIENT_ID/SECRET are set (legacy path).
  const edgeUrl = `${SUPABASE_URL}/functions/v1/refresh-google-token`;
  const res = await fetch(edgeUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ account_email: row.account_email }),
  });
  const body = await res.json();
  if (!res.ok) {
    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
      console.warn(
        `Edge refresh failed (${res.status}); falling back to direct Google call.`,
      );
      return await refreshDirectGoogle(row);
    }
    throw new Error(
      `Refresh failed (${res.status}): ${JSON.stringify(body)}. ` +
        `Hint: deploy supabase/functions/refresh-google-token if not deployed.`,
    );
  }
  row.access_token = body.access_token;
  row.expires_at = body.expires_at;
  return body.access_token;
}

async function refreshDirectGoogle(row) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Direct Google refresh requires GOOGLE_CALENDAR_CLIENT_ID/SECRET");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Direct refresh failed: ${JSON.stringify(body)}`);
  const newExpires = new Date(Date.now() + body.expires_in * 1000).toISOString();
  await supabase
    .from("google_calendar_tokens")
    .update({
      access_token: body.access_token,
      expires_at: newExpires,
      last_refresh_at: new Date().toISOString(),
      last_refresh_error: null,
    })
    .eq("id", row.id);
  row.access_token = body.access_token;
  row.expires_at = newExpires;
  return body.access_token;
}

async function ensureFreshToken(row) {
  const expiresAt = new Date(row.expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) return row.access_token;
  return await refreshAccessToken(row);
}

async function driveFetch(row, path, init = {}) {
  let accessToken = await ensureFreshToken(row);
  const doFetch = (tok) =>
    fetch(`https://www.googleapis.com${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${tok}`,
      },
    });
  let res = await doFetch(accessToken);
  if (res.status === 401) {
    accessToken = await refreshAccessToken(row);
    res = await doFetch(accessToken);
  }
  return res;
}

async function driveUpload(row, parentId, filename, absPath, fileSize) {
  // Resumable upload would be cleaner for big files, but PDFs here are
  // all <2MB. Single-shot multipart upload via /upload endpoint.
  let accessToken = await ensureFreshToken(row);
  const metadata = {
    name: filename,
    parents: [parentId],
    mimeType: "application/pdf",
  };
  const boundary = `bnd_${Math.random().toString(36).slice(2)}`;
  const fileBuf = readFileSync(absPath);
  const head =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: application/pdf\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const body = Buffer.concat([
    Buffer.from(head, "utf8"),
    fileBuf,
    Buffer.from(tail, "utf8"),
  ]);
  const doFetch = (tok) =>
    fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tok}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": String(body.length),
        },
        body,
      }
    );
  let res = await doFetch(accessToken);
  if (res.status === 401) {
    accessToken = await refreshAccessToken(row);
    res = await doFetch(accessToken);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive upload failed (${res.status}): ${text}`);
  }
  return await res.json();
}

async function driveDeleteFile(row, fileId) {
  const res = await driveFetch(row, `/drive/v3/files/${fileId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Drive delete failed (${res.status}): ${text}`);
  }
}

// ───── Drive folder tree ────────────────────────────────────────────────────

const folderCache = new Map(); // "parentId|name" → folderId

async function ensureFolder(row, parentId, name) {
  const cacheKey = `${parentId}|${name}`;
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey);
  const q = encodeURIComponent(
    `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const res = await driveFetch(
    row,
    `/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive list folder failed (${res.status}): ${text}`);
  }
  const body = await res.json();
  if (body.files && body.files.length > 0) {
    folderCache.set(cacheKey, body.files[0].id);
    return body.files[0].id;
  }
  // Create
  const createRes = await driveFetch(row, "/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Drive create folder failed (${createRes.status}): ${text}`);
  }
  const created = await createRes.json();
  folderCache.set(cacheKey, created.id);
  return created.id;
}

async function ensureFolderChain(row, segments) {
  let parentId = "root";
  for (const seg of segments) {
    if (!seg) continue;
    parentId = await ensureFolder(row, parentId, seg);
  }
  return parentId;
}

// ───── main ─────────────────────────────────────────────────────────────────

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function log(...args) {
  console.log(...args);
}

async function main() {
  log(`▶ chart-library-drive-sync (${DRY_RUN ? "DRY RUN" : "LIVE"})`);
  log(`  OUTPUT_DIR=${OUTPUT_DIR}`);
  log(`  DRIVE_ROOT_FOLDER=${DRIVE_ROOT_FOLDER}`);

  // Step 1: filesystem walk
  log(`▶ Walking ${OUTPUT_DIR}…`);
  const files = walkFiles(OUTPUT_DIR);
  log(`  ${files.length} files (post-exclusion)`);

  // Step 2: metadata.csv
  const csvPath = join(OUTPUT_DIR, "metadata.csv");
  log(`▶ Parsing ${csvPath}…`);
  const csvText = readFileSync(csvPath, "utf8");
  const { headers, rows } = parseCsv(csvText);
  log(`  ${rows.length} rows (${headers.length} cols)`);
  const titleIndex = buildTitleIndex(rows);

  // Step 3: OAuth
  log(`▶ Loading OAuth token (account=${ACCOUNT_EMAIL || "first row"})…`);
  const tokenRow = await loadOAuthRow();
  log(`  account_email=${tokenRow.account_email}`);
  await ensureFreshToken(tokenRow);
  log(`  token refreshed if needed`);

  // Step 4: ensure root folder
  log(`▶ Ensuring Drive root folder chain "${DRIVE_ROOT_FOLDER}"…`);
  const rootSegments = DRIVE_ROOT_FOLDER.split("/").filter(Boolean);
  const rootFolderId = DRY_RUN
    ? "DRYRUN_ROOT"
    : await ensureFolderChain(tokenRow, rootSegments);
  log(`  root folder id=${rootFolderId}`);

  // Step 5: per-file upload + index
  const stats = {
    total: files.length,
    skipped_unchanged: 0,
    uploaded_new: 0,
    re_uploaded_changed: 0,
    orphan_no_csv_match: 0,
    errors: 0,
  };
  let ops = 0;

  for (const file of files) {
    if (LIMIT !== null && ops >= LIMIT) {
      log(`▶ LIMIT=${LIMIT} reached, stopping early`);
      break;
    }
    const relKey = `${file.folder_path}/${file.filename}`;

    try {
      // Check existing chart_index row
      const { data: existingRows, error: selErr } = await supabase
        .from("chart_index")
        .select("id, sha256, drive_id")
        .eq("folder_path", file.folder_path)
        .eq("filename", file.filename);
      if (selErr) throw selErr;
      const existing = existingRows && existingRows[0];

      // Compute sha256
      const sha = sha256File(file.absolute_path);

      // Skip if unchanged
      if (existing && existing.sha256 === sha && existing.drive_id) {
        stats.skipped_unchanged++;
        continue;
      }

      // CSV match
      const csvMatch = findCsvMatch(file, titleIndex);
      if (!csvMatch) stats.orphan_no_csv_match++;

      const titleFallback = file.filename.replace(/\.pdf$/i, "");

      // Drive: re-upload if changed (delete old, upload new)
      let driveId = null;
      let webViewLink = null;
      if (!DRY_RUN) {
        if (existing && existing.drive_id && existing.sha256 !== sha) {
          await driveDeleteFile(tokenRow, existing.drive_id);
        }
        const folderSegments = file.folder_path.split("/").filter(Boolean);
        const parentId = await ensureFolderChain(tokenRow, [
          ...rootSegments,
          ...folderSegments,
        ]);
        const uploaded = await driveUpload(
          tokenRow,
          parentId,
          file.filename,
          file.absolute_path,
          file.file_size
        );
        driveId = uploaded.id;
        webViewLink = uploaded.webViewLink;
      }

      const rowData = {
        folder_path: file.folder_path,
        filename: file.filename,
        file_size: file.file_size,
        sha256: sha,
        drive_id: driveId,
        drive_web_view_link: webViewLink,
        drive_account_email: DRY_RUN ? null : tokenRow.account_email,
        drive_uploaded_at: DRY_RUN ? null : new Date().toISOString(),
        title: (csvMatch?.Title || titleFallback).trim() || titleFallback,
        composer: csvMatch?.Composer?.trim() || null,
        genre: csvMatch?.Genre?.trim() || null,
        tags: splitArrayField(csvMatch?.Tags, ","),
        keywords: csvMatch?.Keywords?.trim() || null,
        rating: csvMatch?.Rating?.trim() || null,
        difficulty: csvMatch?.Difficulty?.trim() || null,
        duration: csvMatch?.Duration?.trim() || null,
        key_signature: csvMatch?.Key?.trim() || null,
        time_signature: csvMatch?.Time?.trim() || null,
        reference: csvMatch?.Reference?.trim() || null,
        setlists: splitArrayField(csvMatch?.Setlists, ";"),
        ireal_pro: splitArrayField(csvMatch?.["iReal Pro"], ";"),
        metadata_csv_row: csvMatch ? JSON.parse(JSON.stringify(csvMatch)) : null,
        last_synced_at: new Date().toISOString(),
      };

      if (!DRY_RUN) {
        const { error: upsertErr } = await supabase
          .from("chart_index")
          .upsert(rowData, { onConflict: "folder_path,filename" });
        if (upsertErr) throw upsertErr;
      }

      if (existing) stats.re_uploaded_changed++;
      else stats.uploaded_new++;
      ops++;
      if (ops % 50 === 0) {
        log(
          `  …${ops}/${files.length} processed (new=${stats.uploaded_new} re=${stats.re_uploaded_changed} skip=${stats.skipped_unchanged} orphan=${stats.orphan_no_csv_match} err=${stats.errors})`
        );
      }
    } catch (err) {
      stats.errors++;
      console.error(`  ✗ ${relKey}: ${err.message}`);
    }
  }

  log(`▶ Done.`);
  log(`  Total files walked:       ${stats.total}`);
  log(`  Uploaded new:             ${stats.uploaded_new}`);
  log(`  Re-uploaded (changed):    ${stats.re_uploaded_changed}`);
  log(`  Skipped (unchanged):      ${stats.skipped_unchanged}`);
  log(`  Orphan (no CSV match):    ${stats.orphan_no_csv_match}`);
  log(`  Errors:                   ${stats.errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
