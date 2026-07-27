#!/usr/bin/env node
/**
 * run-multiface-pilot.mjs  ·  MULTI-OUTPUT viability test
 *
 * Pushes the 2-3 person sources through the REAL Portraits generate route in
 * MULTI mode (subject_mode:'multi') so NB2 renders EVERY subject, then saves
 * the renders to eyeball whether 2-3 likenesses hold through effects.
 *
 * Test config (Rich, 2026-07-10): COVERAGE read.
 *   - Framing: signature (only signature-multi is authored)
 *   - Effects: bronze, alabaster, walnut  (realistic register, stress likeness)
 *   - 20 renders picked at RANDOM across the 10 sources x 3 effects.
 *   - Judge the aggregate by eye — no per-render scoring needed.
 *
 * Requires the additive multi engine change dropped in first:
 *   portraits-prompt.ts · portraits-generator.ts · route.ts (generate route)
 *
 * Prereqs:
 *   npm run dev                                             # route at :3000
 *   node scripts\generate-multiface-pool.mjs --n 10        # 10 sources (skips existing)
 *
 * Run:
 *   node scripts\run-multiface-pilot.mjs --dry             # print the 20 picks
 *   node scripts\run-multiface-pilot.mjs                   # render them
 *   node scripts\run-multiface-pilot.mjs --count 30        # different total
 *   node scripts\run-multiface-pilot.mjs --seed 42         # reproducible picks
 *
 * Output: .\multiface-pilot-out\<source>__signature__<effect>.png + pilot-results.json
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const countArg = argv.indexOf("--count");
const TOTAL = countArg > -1 ? parseInt(argv[countArg + 1], 10) : 20;
const seedArg = argv.indexOf("--seed");
const SEED = seedArg > -1 ? parseInt(argv[seedArg + 1], 10) : 7;

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const GEN_URL = `${BASE_URL}/api/v1/portraits/generate`;
const SRC_DIR = path.join(process.cwd(), "source-pool-multiface");
const OUT_DIR = path.join(process.cwd(), "multiface-pilot-out");
const CONCURRENCY = 2;

// ---------------------------------------------------------------- test config
const FRAMING = "signature";        // only signature-multi authored
const SCALE = "close_up";
const EFFECTS = [
  { id: "bronze",    style: "realistic", preset: "bronze"    }, // monolithic metal
  { id: "alabaster", style: "realistic", preset: "alabaster" }, // translucent stone
  { id: "walnut",    style: "realistic", preset: "walnut"    }, // wood grain over skin
];

// ---------------------------------------------------------------- seeded RNG (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- load sources
function loadSources() {
  if (!fs.existsSync(SRC_DIR)) { console.error(`Missing ${SRC_DIR}. Run generate-multiface-pool.mjs first.`); process.exit(1); }
  let manifest = [];
  const mp = path.join(SRC_DIR, "multiface-manifest.json");
  if (fs.existsSync(mp)) { try { manifest = JSON.parse(fs.readFileSync(mp, "utf8")); } catch {} }
  const byId = new Map(manifest.map((m) => [m.id, m]));
  const files = fs.readdirSync(SRC_DIR).filter((f) => /^m\d+.*\.png$/i.test(f)).sort();
  return files.map((file) => {
    const id = file.replace(/\.png$/i, "");
    const meta = byId.get(id) || {};
    return { id, path: path.join(SRC_DIR, file), people_count: meta.people_count ?? null, composition: meta.composition ?? id };
  });
}

// ---------------------------------------------------------------- generate
async function generate(job) {
  const b64 = fs.readFileSync(job.src.path).toString("base64");
  const res = await fetch(GEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_image_b64: b64,
      style_id:         job.effect.style,
      preset_id:        job.effect.preset,
      scale:            SCALE,
      framing:          FRAMING,
      subject_mode:     "multi",                       // render EVERY subject
      subject_count:    job.src.people_count || undefined,
      skip_redirect:    true,                          // stay past Gate 0 group redirect
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const result = data.result || data;
  if (result?.status === "redirected") throw new Error("still redirected — multi bypass not active");
  if (!result || !result.image_b64) throw new Error(result?.fatal_error || "no image_b64 in response");
  return { image_b64: result.image_b64, ok: !!result.ok };
}

async function runJob(job, attempt = 1) {
  const outName = `${job.src.id}__${FRAMING}__${job.effect.preset}.png`;
  const dest = path.join(OUT_DIR, outName);
  if (fs.existsSync(dest)) { console.log(`  skip ${outName} (exists)`); return { ...job.meta, file: outName, status: "ok", note: "skipped-exists" }; }
  try {
    const r = await generate(job);
    fs.writeFileSync(dest, Buffer.from(r.image_b64, "base64"));
    console.log(`  ok   ${outName}  (${job.src.people_count ?? "?"}p)`);
    return { ...job.meta, file: outName, status: "ok", ok: r.ok };
  } catch (err) {
    if (attempt < 3) { console.log(`  retry ${attempt + 1}/3 ${outName} (${err.message})`); await new Promise((r) => setTimeout(r, 1500)); return runJob(job, attempt + 1); }
    console.log(`  FAIL ${outName}: ${err.message}`);
    return { ...job.meta, file: outName, status: "failed", error: String(err.message) };
  }
}

// ---------------------------------------------------------------- main
async function main() {
  const sources = loadSources();
  if (!sources.length) { console.error("no sources found."); process.exit(1); }

  // Build every source x effect combo, shuffle (seeded), take TOTAL — coverage.
  const combos = [];
  for (const src of sources) for (const effect of EFFECTS) combos.push({ src, effect });
  const rand = rng(SEED);
  for (let i = combos.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [combos[i], combos[j]] = [combos[j], combos[i]]; }
  const picks = combos.slice(0, Math.min(TOTAL, combos.length));
  const jobs = picks.map(({ src, effect }) => ({
    src, effect,
    meta: { source: src.id, composition: src.composition, people_count: src.people_count, framing: FRAMING, effect: effect.id },
  }));

  if (DRY) {
    console.log(`Base URL: ${GEN_URL}`);
    console.log(`Sources (${sources.length}):`, sources.map((s) => `${s.id}[${s.people_count ?? "?"}p]`).join(", "));
    console.log(`Framing: ${FRAMING} · multi · effects: ${EFFECTS.map((e) => e.id).join(", ")} · seed ${SEED}`);
    console.log(`\n${picks.length} random picks:`);
    jobs.forEach((j, i) => console.log(`  ${String(i + 1).padStart(2)}. ${j.src.id}[${j.src.people_count ?? "?"}p] × ${j.effect.id}`));
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Multi-OUTPUT test → ${OUT_DIR}`);
  console.log(`${jobs.length} renders · ${FRAMING} framing · multi mode · ${GEN_URL}\n`);

  const results = [];
  const queue = [...jobs];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (queue.length) results.push(await runJob(queue.shift())); }));

  fs.writeFileSync(path.join(OUT_DIR, "pilot-results.json"), JSON.stringify(results, null, 2));
  const ok = results.filter((r) => r.status === "ok").length;
  console.log(`\nDone. ${ok}/${results.length} rendered → ${OUT_DIR}`);
  console.log(`Eyeball the aggregate: across the 20, do 2–3 distinct likenesses hold, or do faces blend / drop / go generic?`);
}

main();
