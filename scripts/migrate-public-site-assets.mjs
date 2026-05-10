#!/usr/bin/env node
// scripts/migrate-public-site-assets.mjs
//
// One-off migration that moves all photo assets in src/assets/ (excluding logos)
// into the visual-assets Supabase Storage bucket, creates a visual_assets row
// per file, triggers Claude vision auto-tagging, and writes
// src/lib/asset-manifest.ts mapping slug -> public CDN URL.
//
// Idempotent: re-running skips already-uploaded files and already-existing rows.
//
// Usage:
//   node scripts/migrate-public-site-assets.mjs
//
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY from .env automatically.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, parse, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// Load .env
function loadEnv() {
  const envPath = join(PROJECT_ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=["']?([^"'\n]+)["']?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ASSETS_ROOT = join(PROJECT_ROOT, "src/assets");
const MANIFEST_PATH = join(PROJECT_ROOT, "src/lib/asset-manifest.ts");
const BUCKET = "visual-assets";
const STORAGE_PREFIX = "public-site";
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

// Walk recursively. Skip logo files (kept as bundled imports — too small to matter,
// and they're on the critical render path).
function walk(dir, files = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) {
      walk(p, files);
    } else {
      const ext = extname(p).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;
      const stem = parse(p).name;
      if (stem.startsWith("logo")) continue; // keep logos bundled
      files.push(p);
    }
  }
  return files;
}

async function uploadOne(absPath) {
  const rel = relative(ASSETS_ROOT, absPath); // e.g. band/jazz-trio-1.webp
  const slug = rel.replace(/\.[^.]+$/, "").split("\\").join("/"); // band/jazz-trio-1
  const ext = extname(absPath).toLowerCase();
  const filename = parse(absPath).base;
  const storagePath = `${STORAGE_PREFIX}/${rel.split("\\").join("/")}`;
  const folderRel = parse(rel).dir.split("\\").join("/");
  const folder = folderRel ? `${STORAGE_PREFIX}/${folderRel}` : STORAGE_PREFIX;
  const buf = readFileSync(absPath);
  const mime = MIME_BY_EXT[ext];

  // Upload (skip if already exists)
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, buf, {
    contentType: mime,
    upsert: false,
    cacheControl: "31536000",
  });
  if (upErr) {
    const msg = upErr.message || String(upErr);
    if (!/already exists|Duplicate|409/i.test(msg)) {
      throw new Error(`upload ${storagePath}: ${msg}`);
    }
    // file exists — that's fine
  }

  // Find existing row, or insert
  const { data: existing } = await supabase
    .from("visual_assets")
    .select("id, ai_processed_at")
    .eq("storage_path", storagePath)
    .maybeSingle();

  let assetId;
  let inserted = false;
  if (existing) {
    assetId = existing.id;
  } else {
    const { data: row, error: insErr } = await supabase
      .from("visual_assets")
      .insert({
        filename,
        storage_path: storagePath,
        folder,
        mime_type: mime,
        file_size_bytes: buf.length,
        ventures: ["harborline"],
        rights: "public-ok",
        tags: ["public-site"],
        uploaded_by: "migrate-public-site-assets",
      })
      .select("id")
      .single();
    if (insErr) throw new Error(`row insert ${slug}: ${insErr.message}`);
    assetId = row.id;
    inserted = true;
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
  return { slug, publicUrl, assetId, inserted, needsTag: !existing?.ai_processed_at };
}

async function tagOne(assetId) {
  const { error } = await supabase.functions.invoke("tag-visual-asset", {
    body: { asset_id: assetId },
  });
  if (error) throw new Error(error.message || String(error));
}

async function main() {
  const files = walk(ASSETS_ROOT).sort();
  console.log(`found ${files.length} candidate images (logos excluded)`);

  const manifest = {};
  const toTag = [];
  let inserted = 0;
  let existing = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    process.stdout.write(`[${i + 1}/${files.length}] ${relative(ASSETS_ROOT, f)} `);
    try {
      const r = await uploadOne(f);
      manifest[r.slug] = r.publicUrl;
      if (r.inserted) inserted++;
      else existing++;
      if (r.needsTag) toTag.push(r.assetId);
      console.log(r.inserted ? "→ uploaded + row" : "→ exists, manifest only");
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
  }

  // Sort manifest keys for stable diffs
  const sortedKeys = Object.keys(manifest).sort();
  const sortedManifest = {};
  for (const k of sortedKeys) sortedManifest[k] = manifest[k];

  const ts = `// AUTO-GENERATED by scripts/migrate-public-site-assets.mjs — do not edit by hand.
// Maps public-site asset slugs to Supabase Storage CDN URLs.
// Used by <OptimizedImage src="<slug>" /> and asset(slug) helper.

export const ASSET_MANIFEST = ${JSON.stringify(sortedManifest, null, 2)} as const;

export type AssetSlug = keyof typeof ASSET_MANIFEST;
`;
  writeFileSync(MANIFEST_PATH, ts);
  console.log(`\nwrote ${MANIFEST_PATH} with ${sortedKeys.length} entries`);
  console.log(`uploaded: ${inserted}, existing: ${existing}, queued for AI tagging: ${toTag.length}`);

  // Trigger AI tagging — sequential to stay polite to Anthropic rate limits.
  for (let i = 0; i < toTag.length; i++) {
    process.stdout.write(`[tag ${i + 1}/${toTag.length}] ${toTag[i]} `);
    try {
      await tagOne(toTag[i]);
      console.log("✓");
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
    // 200ms gap between calls; Sonnet can handle this comfortably
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log("\ndone");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
