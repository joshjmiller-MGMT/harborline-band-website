#!/usr/bin/env node
// scripts/retag-stale-visual-assets.mjs
//
// P302 (2026-05-13): one-off batch re-tag of `visual_assets` rows that pre-date
// P9's structured-taxonomy expansion (ai_suggested_kind IS NULL) OR carry a
// stale `ai_error`. Calls the deployed `tag-visual-asset` v6 edge fn one row at
// a time with a small concurrency pool. Designed to run from the repo root so
// it picks up `.env` and `node_modules/@supabase/supabase-js`.
//
// Usage:
//   node scripts/retag-stale-visual-assets.mjs           # all 65 null-kind rows
//   node scripts/retag-stale-visual-assets.mjs --errors  # only rows with ai_error set
//
// Idempotent: safe to re-run. The edge fn clears ai_error on success and writes
// fresh ai_suggested_* columns.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

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

const errorsOnly = process.argv.includes("--errors");
// Anthropic Sonnet 4.6 input-token rate limit on this org is 10k tpm. Each vision
// call sends ~1.5k input tokens (image + prompt + tool schema) so the budget is ≈6.6
// calls/minute. CONCURRENCY=1 + 12s fire interval = 5 calls/min ≈ 7.5k tpm with margin.
const CONCURRENCY = 1;
const MIN_FIRE_INTERVAL_MS = 12000;
const RETRY_ON_429_DELAY_MS = 65000;

async function fetchTargets() {
  let q = supabase
    .from("visual_assets")
    .select("id, filename, folder, ai_error")
    .order("created_at", { ascending: true });
  if (errorsOnly) {
    q = q.not("ai_error", "is", null);
  } else {
    q = q.is("ai_suggested_kind", null);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

async function readAiError(assetId) {
  const { data } = await supabase
    .from("visual_assets")
    .select("ai_error")
    .eq("id", assetId)
    .maybeSingle();
  return data?.ai_error ?? null;
}

async function tagOne(asset, allowRetry = true) {
  const start = Date.now();
  try {
    const { data, error } = await supabase.functions.invoke("tag-visual-asset", {
      body: { asset_id: asset.id },
    });
    const dur = Date.now() - start;
    if (error) {
      // Edge fn wrote the underlying Anthropic error to visual_assets.ai_error; read it back.
      const aiError = await readAiError(asset.id);
      const is429 = aiError && /Anthropic 429/.test(aiError);
      if (is429 && allowRetry) {
        console.log(`     ↳ 429 detected, sleeping ${RETRY_ON_429_DELAY_MS / 1000}s and retrying once`);
        await new Promise((r) => setTimeout(r, RETRY_ON_429_DELAY_MS));
        return tagOne(asset, false);
      }
      return { id: asset.id, filename: asset.filename, ok: false, dur, err: aiError || error.message || String(error) };
    }
    return {
      id: asset.id,
      filename: asset.filename,
      ok: true,
      dur,
      kind: data?.suggestions?.kind,
      confidence: data?.confidence,
      review_status: data?.review_status,
      auto_applied: data?.auto_applied,
    };
  } catch (e) {
    return { id: asset.id, filename: asset.filename, ok: false, dur: Date.now() - start, err: e?.message || String(e) };
  }
}

async function runPool(tasks, concurrency, minInterval) {
  const results = [];
  let i = 0;
  let lastFire = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= tasks.length) return;
      const now = Date.now();
      const wait = Math.max(0, lastFire + minInterval - now);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastFire = Date.now();
      const r = await tasks[idx]();
      results[idx] = r;
      console.log(
        `  [${(idx + 1).toString().padStart(2)}/${tasks.length}] ${r.ok ? "✓" : "✗"} ${(r.dur / 1000).toFixed(1)}s  ${r.filename}` +
          (r.ok ? `  kind=${r.kind} conf=${r.confidence} status=${r.review_status} auto=${r.auto_applied}` : `  ERR: ${r.err}`),
      );
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

async function main() {
  const targets = await fetchTargets();
  console.log(`scope: ${errorsOnly ? "ai_error IS NOT NULL only" : "ai_suggested_kind IS NULL (all pre-P9 + errored)"}`);
  console.log(`found ${targets.length} target rows`);
  if (targets.length === 0) {
    console.log("nothing to do");
    return;
  }

  const tasks = targets.map((t) => () => tagOne(t));
  const t0 = Date.now();
  const results = await runPool(tasks, CONCURRENCY, MIN_FIRE_INTERVAL_MS);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  const needsReview = ok.filter((r) => r.review_status === "needs-review");
  const autoApplied = ok.filter((r) => r.auto_applied);

  console.log("\n— summary —");
  console.log(`  total       ${results.length}`);
  console.log(`  success     ${ok.length}`);
  console.log(`  errors      ${fail.length}`);
  console.log(`  auto-applied${" ".repeat(1)}${autoApplied.length}`);
  console.log(`  needs-review ${needsReview.length}`);
  console.log(`  elapsed     ${elapsed}s`);

  if (needsReview.length > 0) {
    console.log("\nneeds-review rows (visit /team/visual-assets → Review queue chip):");
    for (const r of needsReview) console.log(`  - ${r.filename}  (kind=${r.kind})`);
  }
  if (fail.length > 0) {
    console.log("\nfailures:");
    for (const r of fail) console.log(`  - ${r.filename}  ${r.err}`);
  }
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
