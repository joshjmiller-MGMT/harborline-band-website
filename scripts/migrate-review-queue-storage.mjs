#!/usr/bin/env node
// migrate-review-queue-storage.mjs
//
// One-shot operator script. Migrates `waiting_on_josh` rows whose media_refs
// currently point at Dropbox temp_link `external_url` values to durable
// `storage_path` references in the private `review-media` Supabase Storage
// bucket.
//
// Reads source files from the local Dropbox sync (no Dropbox API needed --
// Legion has BSE/Content/2025/ synced on disk).
//
// Auth: SUPABASE_SERVICE_ROLE_KEY from scripts/.env.local (gitignored).
//
// Idempotent: skips any ref that already has `storage_path` set. Safe to
// re-run.
//
// Usage:
//   node scripts/migrate-review-queue-storage.mjs --row <short-id>  # smoke 1 row
//   node scripts/migrate-review-queue-storage.mjs --batch           # all eligible rows
//   node scripts/migrate-review-queue-storage.mjs --dry-run         # plan, no writes
//
// Scope (per legion-review-queue-storage-2026-06-09 handoff):
//   5 BSE/Content/2025/ rows -> 9 file uploads. Homepage og-image left alone
//   (already a durable harborlineband.com URL). Resolved rows skipped.
//   Finance dedup rows skipped (out of original scope; can re-run later
//   with --include-finance).

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, statSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const TMP_DIR = mkdtempSync(join(tmpdir(), 'review-media-mig-'));
const DBX_PS1 = 'C:/dev/scripts/dbx.ps1';

// Hydrate-or-read: Dropbox files on Legion are reparse-point placeholders
// (cloud-only) when not "Available offline." Node's readFileSync trips on
// the reparse tag. Use dbx.ps1 download (Dropbox REST API) into a tmp file
// instead, which always returns real bytes.
function readDropboxFile(dropboxPath, fileName) {
  const outFile = join(TMP_DIR, fileName);
  execFileSync('powershell', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', DBX_PS1,
    'download', '/' + dropboxPath.replace(/^\/+/, ''),
    outFile,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  if (!existsSync(outFile)) {
    throw new Error(`dbx download produced no file at ${outFile}`);
  }
  const buf = readFileSync(outFile);
  try { unlinkSync(outFile); } catch {}
  return buf;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimal .env.local parser -- avoid adding dotenv as a project dep.
function loadLocalEnv() {
  const envPath = join(__dirname, '.env.local');
  if (!existsSync(envPath)) return;
  const txt = readFileSync(envPath, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (k && !process.env[k]) process.env[k] = v;
  }
}
loadLocalEnv();

const SUPABASE_URL = 'https://mbqyznttpvebahgygsbx.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'review-media';

// Local Dropbox roots (Legion sync layout).
const DROPBOX_ROOT = 'C:/Users/joshj/Dropbox';

if (!SERVICE_KEY) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY missing. Paste it into scripts/.env.local.');
  process.exit(1);
}

const args = process.argv.slice(2);
const ROW_FILTER = args.includes('--row') ? args[args.indexOf('--row') + 1] : null;
const BATCH = args.includes('--batch');
const DRY_RUN = args.includes('--dry-run');
const INCLUDE_FINANCE = args.includes('--include-finance');

if (!ROW_FILTER && !BATCH) {
  console.error('Usage: --row <short-id> | --batch [--include-finance] [--dry-run]');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Map source_ref glob -> Dropbox path (relative to Dropbox root) for each
// scope subset. dbx download takes /-prefixed paths.
function dropboxPathFor(sourceRef, label) {
  const fileName = basename(label).split(' (')[0];
  if (sourceRef.startsWith('BSE/Content/2025/')) {
    return `BSE/Content/2025/${fileName}`;
  }
  if (sourceRef.startsWith('personal-admin/tax/')) {
    // source_ref is like personal-admin/tax/2024/file.pdf (often without
    // trailing filename if multiple). Take year only for the dir.
    const year = sourceRef.split('/')[2];
    return `personal-admin/tax/${year}/${fileName}`;
  }
  return null;
}

function storagePathFor(sourceRef, label) {
  const fileName = basename(label).split(' (')[0];
  if (sourceRef.startsWith('BSE/Content/2025/')) {
    return `sidecar/bse-content-2025/${fileName}`;
  }
  if (sourceRef.startsWith('personal-admin/tax/')) {
    const year = sourceRef.split('/')[2];
    return `finance/tax-${year}/${fileName}`;
  }
  return null;
}

function contentTypeFor(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

async function loadRows() {
  const { data, error } = await sb
    .from('waiting_on_josh')
    .select('id, title, source_ref, media_refs, resolved_at')
    .not('media_refs', 'is', null);
  if (error) throw error;
  let rows = data.filter(r => Array.isArray(r.media_refs) && r.media_refs.length > 0);
  if (ROW_FILTER) {
    rows = rows.filter(r => r.id.startsWith(ROW_FILTER));
  }
  return rows;
}

function shouldProcessRow(row) {
  if (row.resolved_at) {
    console.log(`  SKIP (resolved): ${row.id.slice(0,8)} ${row.title.slice(0,60)}`);
    return false;
  }
  if (!row.source_ref) {
    console.log(`  SKIP (no source_ref): ${row.id.slice(0,8)} ${row.title.slice(0,60)}`);
    return false;
  }
  const allDurable = row.media_refs.every(r => {
    const u = r.external_url || '';
    return u.startsWith('https://harborlineband.com/') || u.startsWith('https://www.harborlineband.com/');
  });
  if (allDurable) {
    console.log(`  SKIP (already durable URL): ${row.id.slice(0,8)} ${row.title.slice(0,60)}`);
    return false;
  }
  if (!INCLUDE_FINANCE && row.source_ref.startsWith('personal-admin/tax/')) {
    console.log(`  SKIP (finance, --include-finance not set): ${row.id.slice(0,8)} ${row.title.slice(0,60)}`);
    return false;
  }
  if (!dropboxPathFor(row.source_ref, row.media_refs[0].label || '')) {
    console.log(`  SKIP (no path mapping for source_ref=${row.source_ref}): ${row.id.slice(0,8)} ${row.title.slice(0,60)}`);
    return false;
  }
  return true;
}

async function migrateRow(row) {
  console.log(`\n=== ${row.id.slice(0,8)} :: ${row.title.slice(0,60)} ===`);
  console.log(`source_ref: ${row.source_ref}`);
  const newRefs = [];
  for (const ref of row.media_refs) {
    // Idempotent: already migrated.
    if (ref.storage_path) {
      console.log(`  KEEP (already storage_path): ${ref.label}`);
      newRefs.push(ref);
      continue;
    }
    if (!ref.external_url) {
      console.log(`  KEEP (no external_url, nothing to migrate): ${JSON.stringify(ref)}`);
      newRefs.push(ref);
      continue;
    }
    const fileName = basename(ref.label || '').split(' (')[0];
    const dropboxPath = dropboxPathFor(row.source_ref, ref.label);
    const storagePath = storagePathFor(row.source_ref, ref.label);
    console.log(`  fetch: /${dropboxPath} -> upload -> ${BUCKET}/${storagePath}`);
    if (DRY_RUN) {
      newRefs.push({ ...ref, storage_path: storagePath, external_url: undefined });
      continue;
    }
    let fileBuf;
    try {
      fileBuf = readDropboxFile(dropboxPath, fileName);
    } catch (e) {
      console.log(`  FAIL (dbx download): ${e.message}`);
      newRefs.push(ref);
      continue;
    }
    console.log(`  ${fileBuf.length} bytes downloaded`);
    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(storagePath, fileBuf, {
        contentType: contentTypeFor(fileName),
        upsert: true,
      });
    if (upErr) {
      console.log(`  FAIL (upload): ${upErr.message}`);
      newRefs.push(ref);
      continue;
    }
    const newRef = { ...ref, storage_path: storagePath };
    delete newRef.external_url;
    newRefs.push(newRef);
    console.log(`  OK`);
  }

  // Only write back if at least one ref actually changed shape.
  const changed = JSON.stringify(newRefs) !== JSON.stringify(row.media_refs);
  if (!changed) {
    console.log(`  no-op (nothing to write back)`);
    return { row: row.id, changed: false };
  }
  if (DRY_RUN) {
    console.log(`  DRY_RUN: would UPDATE waiting_on_josh.media_refs (${newRefs.length} refs)`);
    return { row: row.id, changed: true, dry_run: true };
  }
  const { error: updErr } = await sb
    .from('waiting_on_josh')
    .update({ media_refs: newRefs })
    .eq('id', row.id);
  if (updErr) {
    console.log(`  FAIL (db update): ${updErr.message}`);
    return { row: row.id, changed: false, error: updErr.message };
  }
  console.log(`  DB updated.`);
  return { row: row.id, changed: true };
}

async function main() {
  console.log(`migrate-review-queue-storage.mjs :: ${DRY_RUN ? 'DRY_RUN' : 'LIVE'}`);
  console.log(`mode: ${ROW_FILTER ? `row=${ROW_FILTER}` : 'batch'}${INCLUDE_FINANCE ? ' +finance' : ''}`);

  const rows = await loadRows();
  console.log(`found ${rows.length} candidate rows`);

  const processed = [];
  for (const row of rows) {
    if (!shouldProcessRow(row)) continue;
    const result = await migrateRow(row);
    processed.push(result);
  }

  console.log(`\n=== summary ===`);
  console.log(`processed: ${processed.length}`);
  console.log(`changed:   ${processed.filter(p => p.changed).length}`);
  console.log(`errors:    ${processed.filter(p => p.error).length}`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
