// audit-asset-usage.mjs — Visual-asset library Phase 4
//
// Scans the codebase for references to every slug in src/lib/asset-manifest.ts
// and produces a usage report. The goal: find orphan assets (in manifest but
// never referenced) so we can prune the visual_assets table + Storage objects.
//
// Detection patterns (case-sensitive, exact-match):
//   <OptimizedImage src="<slug>" ...>
//   asset("<slug>")
//   asset('<slug>')
//   "<slug>" or '<slug>' appearing inside .ts/.tsx files (last-resort fallback)
//
// Output:
//   - Console summary: total slugs, referenced, orphan, with examples
//   - JSON file at scripts/asset-usage-report.json with full slug → [refs] map
//
// Run: node scripts/audit-asset-usage.mjs

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const SRC_DIR = join(REPO_ROOT, "src");
const MANIFEST_PATH = join(REPO_ROOT, "src/lib/asset-manifest.ts");
const REPORT_PATH = join(REPO_ROOT, "scripts/asset-usage-report.json");

function extractSlugs(manifestSource) {
  const slugs = [];
  const re = /^  "([^"]+)":/gm;
  let m;
  while ((m = re.exec(manifestSource)) !== null) {
    slugs.push(m[1]);
  }
  return slugs;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, files);
    } else if (/\.(ts|tsx|jsx|js|html|md)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function findReferences(slug, files, fileCache) {
  const refs = [];
  for (const file of files) {
    if (file === MANIFEST_PATH) continue; // skip the manifest itself
    const text = fileCache.get(file) ?? readFileSync(file, "utf8");
    fileCache.set(file, text);

    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Quoted slug — most reliable signal
      if (line.includes(`"${slug}"`) || line.includes(`'${slug}'`)) {
        refs.push({
          file: relative(REPO_ROOT, file),
          line: i + 1,
          snippet: line.trim().slice(0, 200),
        });
      }
    }
  }
  return refs;
}

function main() {
  const manifest = readFileSync(MANIFEST_PATH, "utf8");
  const slugs = extractSlugs(manifest);
  console.log(`[asset-usage] Parsed ${slugs.length} slugs from ${relative(REPO_ROOT, MANIFEST_PATH)}`);

  const files = walk(SRC_DIR);
  console.log(`[asset-usage] Scanning ${files.length} source files…`);

  const fileCache = new Map();
  const report = {};
  let orphans = 0;
  let referenced = 0;
  let totalRefs = 0;

  for (const slug of slugs) {
    const refs = findReferences(slug, files, fileCache);
    report[slug] = refs;
    if (refs.length === 0) {
      orphans++;
    } else {
      referenced++;
      totalRefs += refs.length;
    }
  }

  // Summary
  console.log("");
  console.log("═══ Asset usage summary ═══");
  console.log(`  Total slugs:      ${slugs.length}`);
  console.log(`  Referenced:       ${referenced} (${totalRefs} total refs)`);
  console.log(`  Orphans:          ${orphans}`);
  console.log("");

  if (orphans > 0) {
    console.log("Orphan slugs (no references found):");
    for (const slug of slugs) {
      if (report[slug].length === 0) console.log(`  · ${slug}`);
    }
    console.log("");
  }

  // Per-page usage (group by page file)
  const pageUsage = new Map();
  for (const slug of slugs) {
    for (const ref of report[slug]) {
      const page = ref.file.split("/").slice(0, 3).join("/");
      if (!pageUsage.has(page)) pageUsage.set(page, new Map());
      const pageMap = pageUsage.get(page);
      pageMap.set(slug, (pageMap.get(slug) || 0) + 1);
    }
  }

  console.log("Per-area usage (top 10 most-referenced slugs):");
  const slugCounts = slugs
    .map((s) => ({ slug: s, count: report[s].length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  for (const { slug, count } of slugCounts) {
    console.log(`  ${count.toString().padStart(3, " ")}×  ${slug}`);
  }
  console.log("");

  writeFileSync(
    REPORT_PATH,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        manifest_path: relative(REPO_ROOT, MANIFEST_PATH),
        total_slugs: slugs.length,
        referenced,
        orphans,
        total_refs: totalRefs,
        slugs: report,
      },
      null,
      2,
    ),
  );
  console.log(`[asset-usage] Wrote report → ${relative(REPO_ROOT, REPORT_PATH)}`);
}

main();
