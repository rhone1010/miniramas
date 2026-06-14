#!/usr/bin/env node
/**
 * bake-previews-local.mjs
 * Liten & Co -- run picked sources through the PRODUCTION generate route
 * and deposit results into the preview library folder convention LOCALLY:
 *
 *   previews/portraits/{preset}/{bin}.jpg
 *
 * You then drag the "portraits" folder into the Supabase "previews" bucket
 * (dashboard upload preserves folder structure). Done.
 *
 * SETUP (one minute):
 *   1. Put your picked source images in:  preview-sources\picked\
 *      Named by bin:  f_adult.png, m_senior.png, etc. (filename = bin)
 *   2. Edit the PRESETS list below to your real 12 portrait preset ids.
 *   3. Start the dev server:  npm run dev
 *
 * RUN (from repo root, second PowerShell window):
 *   node scripts\bake-previews-local.mjs
 *
 * Re-runs SKIP files that already exist, so a failed render just means
 * run it again -- it only does the missing ones.
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// ---------------------------------------------------------------- config
const API_URL = "http://127.0.0.1:3000/api/v1/portraits/generate";
const SOURCES_DIR = path.join(process.cwd(), "preview-sources", "picked");
const OUT_DIR = path.join(process.cwd(), "previews", "portraits");
const CONCURRENCY = 2; // renders are heavy; keep this low

// EDIT ME: your 12 portrait presets, exact ids the generate route expects
const PRESETS = [
  "bronze",
  "walnut",
  "alabaster",
  // ...add the remaining presets here...
];

// Loosen the gate for bake runs (requires LITEN_INTERNAL_KEY in .env.local)
const QA_OVERRIDE = { source_strictness: 3, render_strictness: 3 };

// ---------------------------------------------------------------- env
function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*)"?\s*$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
const ENV = { ...loadEnvLocal(), ...process.env };
const INTERNAL_KEY = ENV.LITEN_INTERNAL_KEY;

// ---------------------------------------------------------------- jobs
function buildJobs() {
  if (!fs.existsSync(SOURCES_DIR)) {
    console.error(`Sources folder not found: ${SOURCES_DIR}`);
    console.error("Create it and drop your picked bin images in (f_adult.png etc).");
    process.exit(1);
  }
  const seen = new Set();
  const sources = [];
  for (const f of fs.readdirSync(SOURCES_DIR).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()) {
    // filename -> bin: strip extension AND any _a/_b candidate suffix automatically
    const bin = f.replace(/\.(png|jpe?g)$/i, "").replace(/_[ab]$/i, "");
    if (seen.has(bin)) {
      console.log(`  note: skipping ${f} (already have a source for bin "${bin}")`);
      continue;
    }
    seen.add(bin);
    sources.push({ bin, file: path.join(SOURCES_DIR, f) });
  }

  if (!sources.length) {
    console.error(`No images found in ${SOURCES_DIR}`);
    process.exit(1);
  }

  const jobs = [];
  for (const preset of PRESETS) {
    for (const src of sources) {
      const dest = path.join(OUT_DIR, preset, `${src.bin}.jpg`);
      if (fs.existsSync(dest)) continue; // skip already-baked
      jobs.push({ preset, bin: src.bin, srcFile: src.file, dest });
    }
  }
  return { jobs, sourceCount: sources.length };
}

// ---------------------------------------------------------------- render
async function renderJob(job, attempt = 1) {
  try {
    const sourceB64 = fs.readFileSync(job.srcFile).toString("base64");
    const headers = { "Content-Type": "application/json" };
    if (INTERNAL_KEY) headers["x-liten-internal"] = INTERNAL_KEY;

    const res = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source_image_b64: sourceB64,
        style_id: ["impressionist","torn_paper","folded_book","charcoal_chalk","pencil_sketch","sheet_music"].includes(job.preset)
          ? "artists_gallery"
          : "realistic",
        preset_id: job.preset,
        scale: "fill",
        aspect_ratio: "1:1",
        upper_body_concept:
          "Tight headshot — face and shoulders only, head centered in frame, no hands visible, no torso below the shoulders",
        advanced: { beam: "on", threePoint: "on", brightness: "15", enhanced: "on" },
        ...(INTERNAL_KEY ? { qa_override: QA_OVERRIDE } : {}),
      }),
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);

    const data = await res.json();
    const imageB64 = data?.result?.image_b64;
    if (!imageB64) {
      throw new Error(
        `no image in response (status: ${data?.result?.status ?? data?.status ?? "unknown"})`
      );
    }

    fs.mkdirSync(path.dirname(job.dest), { recursive: true });
    await sharp(Buffer.from(imageB64, "base64")).jpeg({ quality: 90 }).toFile(job.dest);
    console.log(`  ok  ${job.preset}/${job.bin}.jpg`);
    return { ...job, status: "ok" };
  } catch (err) {
    if (attempt < 2) {
      console.log(`  retry ${job.preset}/${job.bin} (${err.message})`);
      return renderJob(job, attempt + 1);
    }
    console.log(`  FAILED ${job.preset}/${job.bin}: ${err.message}`);
    return { ...job, status: "failed", error: String(err.message) };
  }
}

// ---------------------------------------------------------------- main
async function main() {
  const { jobs, sourceCount } = buildJobs();
  console.log(
    `Bake: ${sourceCount} sources x ${PRESETS.length} presets -> ` +
      `${jobs.length} renders to do (already-done files skipped)\n`
  );
  if (!INTERNAL_KEY) {
    console.log("NOTE: LITEN_INTERNAL_KEY not found -- qa_override will be skipped,");
    console.log("renders run at table strictness. Fine if nothing bounces.\n");
  }

  const results = [];
  const queue = [...jobs];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      results.push(await renderJob(queue.shift()));
    }
  });
  await Promise.all(workers);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "bake-manifest.json"),
    JSON.stringify(results, null, 2)
  );

  const ok = results.filter((r) => r.status === "ok").length;
  const failed = results.length - ok;
  console.log(`\nDone: ${ok} baked, ${failed} failed.`);
  if (failed) console.log("Just re-run the script -- it only retries the missing ones.");
  console.log(`\nUpload: drag the folder  previews\\portraits  into the Supabase "previews" bucket.`);
}

main();
