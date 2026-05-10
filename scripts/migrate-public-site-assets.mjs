#!/usr/bin/env node
// scripts/migrate-public-site-assets.mjs
//
// One-off migration that moves all photo assets in src/assets/ (excluding logos)
// into the visual-assets Supabase Storage bucket, generates 4 WebP derivatives
// (320 / 600 / 1200 / 2000 width) per image via Sharp, creates a visual_assets
// row per file, triggers Claude vision auto-tagging, and writes
// src/lib/asset-manifest.ts mapping slug -> { original, w320, w600, w1200, w2000 }.
//
// Idempotent: re-running skips already-uploaded originals + derivatives, but
// always rewrites the manifest from the current state of the bucket.
//
// Run after adding new images to src/assets/:
//   node scripts/migrate-public-site-assets.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, parse, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

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
const DERIVATIVE_PREFIX = `${STORAGE_PREFIX}/derivatives`;
const DERIVATIVE_SIZES = [320, 600, 1200, 2000]; // widths
const WEBP_QUALITY = 82;
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

function pubUrl(storagePath) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

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
      if (stem.startsWith("logo")) continue;
      files.push(p);
    }
  }
  return files;
}

async function uploadIfMissing(storagePath, buffer, contentType) {
  const maxAttempts = 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType,
      upsert: false,
      cacheControl: "31536000",
    });
    if (!error) return { uploaded: true };
    const msg = error.message || String(error);
    if (/already exists|Duplicate|409/i.test(msg)) return { uploaded: false };
    lastErr = msg;
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  throw new Error(`upload ${storagePath}: ${lastErr}`);
}

async function generateDerivatives(originalBuffer, slug) {
  // Generate all 4 sizes in parallel. Each is a WebP via Sharp.
  const tasks = DERIVATIVE_SIZES.map(async (width) => {
    const webp = await sharp(originalBuffer, { failOn: "none" })
      .rotate() // honor EXIF orientation before resizing
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    const path = `${DERIVATIVE_PREFIX}/w${width}/${slug}.webp`;
    await uploadIfMissing(path, webp, "image/webp");
    return [`w${width}`, pubUrl(path)];
  });
  const entries = await Promise.all(tasks);
  return Object.fromEntries(entries);
}

async function processOne(absPath) {
  const rel = relative(ASSETS_ROOT, absPath); // band/jazz-trio-1.webp
  const slug = rel.replace(/\.[^.]+$/, "").split("\\").join("/");
  const ext = extname(absPath).toLowerCase();
  const filename = parse(absPath).base;
  const storagePath = `${STORAGE_PREFIX}/${rel.split("\\").join("/")}`;
  const folderRel = parse(rel).dir.split("\\").join("/");
  const folder = folderRel ? `${STORAGE_PREFIX}/${folderRel}` : STORAGE_PREFIX;
  const buf = readFileSync(absPath);
  const mime = MIME_BY_EXT[ext];

  // 1. Upload original
  await uploadIfMissing(storagePath, buf, mime);

  // 2. Find existing row (by storage_path) or insert
  const { data: existing } = await supabase
    .from("visual_assets")
    .select("id, derivative_paths, ai_processed_at")
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
      .select("id, derivative_paths")
      .single();
    if (insErr) throw new Error(`row insert ${slug}: ${insErr.message}`);
    assetId = row.id;
    inserted = true;
  }

  // 3. Decide whether derivatives need (re)generating
  const currentDerivs = existing?.derivative_paths ?? {};
  const allSizesPresent = DERIVATIVE_SIZES.every((w) => currentDerivs[`w${w}`]);
  let derivPaths;
  let derivsRegenerated = false;
  if (allSizesPresent) {
    derivPaths = currentDerivs;
  } else {
    derivPaths = await generateDerivatives(buf, slug);
    derivsRegenerated = true;
    const { error: updErr } = await supabase
      .from("visual_assets")
      .update({ derivative_paths: derivPaths })
      .eq("id", assetId);
    if (updErr) throw new Error(`derivative_paths update ${slug}: ${updErr.message}`);
  }

  return {
    slug,
    assetId,
    inserted,
    derivsRegenerated,
    needsTag: inserted || !existing?.ai_processed_at,
    manifestEntry: {
      original: pubUrl(storagePath),
      ...derivPaths,
    },
  };
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
  let regenerated = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    process.stdout.write(`[${i + 1}/${files.length}] ${relative(ASSETS_ROOT, f)} `);
    try {
      const r = await processOne(f);
      manifest[r.slug] = r.manifestEntry;
      if (r.inserted) inserted++;
      if (r.derivsRegenerated) regenerated++;
      if (r.needsTag) toTag.push(r.assetId);
      const status = [
        r.inserted ? "row+" : "row=",
        r.derivsRegenerated ? "derivs+" : "derivs=",
      ].join(" ");
      console.log(`→ ${status}`);
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
  }

  // Stable sort + write manifest
  const sortedKeys = Object.keys(manifest).sort();
  const sorted = {};
  for (const k of sortedKeys) sorted[k] = manifest[k];

  const ts = `// AUTO-GENERATED by scripts/migrate-public-site-assets.mjs — do not edit by hand.
// Maps public-site asset slugs to Supabase Storage CDN URLs.
//
// Each entry has the original + four WebP derivatives (320 / 600 / 1200 / 2000 width).
// <OptimizedImage src="<slug>" /> renders an <img srcset> driven by these.
// asset(slug) returns the original; asset(slug, "w600") picks a specific size.

export interface AssetSources {
  original: string;
  w320: string;
  w600: string;
  w1200: string;
  w2000: string;
}

export const ASSET_MANIFEST: Record<string, AssetSources> = ${JSON.stringify(sorted, null, 2)} as const;

export type AssetSlug = keyof typeof ASSET_MANIFEST;
export type AssetSize = "original" | "w320" | "w600" | "w1200" | "w2000";
`;
  writeFileSync(MANIFEST_PATH, ts);
  console.log(`\nwrote ${MANIFEST_PATH} with ${sortedKeys.length} entries`);
  console.log(`new rows: ${inserted}, derivative regens: ${regenerated}, queued for AI tagging: ${toTag.length}`);

  // Tag any rows that need it (sequential, polite to rate limits)
  for (let i = 0; i < toTag.length; i++) {
    process.stdout.write(`[tag ${i + 1}/${toTag.length}] ${toTag[i]} `);
    try {
      await tagOne(toTag[i]);
      console.log("✓");
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log("\ndone");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
