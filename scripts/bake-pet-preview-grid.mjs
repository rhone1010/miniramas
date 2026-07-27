#!/usr/bin/env node
/**
 * bake-pet-preview-grid.mjs
 * Liten & Co -- bake the Pets Curator preview library (multi-animal).
 *
 * Mirrors bake-preview-grid.mjs (portraits), adapted for Pets:
 *   people pool          -> two-pet pool (pet-source-pool + pet-pool-manifest)
 *   portraits route      -> /api/v1/pets/generate
 *   26 portrait effects  -> 20 accepted pet effects (7 materials + 13 curiosities)
 *   age-quartile spread  -> species/pairing spread (each effect's cards vary)
 *
 * Multi-animal is AUTOMATIC: each source is a two-pet photo, so the Pets
 * pipeline's detection counts 2 and the group prompt fires. No extra field —
 * the source drives it. (Watch the console: detection under-counts show as a
 * warning so you can spot which pairings the analyzer misreads.)
 *
 * Writes:  previews/pets/{effect}/1.jpg .. {VARIATIONS}.jpg
 *
 * Sources needed = EFFECTS (20) x VARIATIONS (default 4) = 80 unique pairs.
 * So generate a pool of at least that many first:
 *   node scripts\generate-pet-source-pool.mjs --n 80
 *
 * SETUP: pool generated, dev server up (npm run dev), then a second window:
 *   PS D:\minramas> node scripts\bake-pet-preview-grid.mjs --dry            # print assignment, no calls
 *   PS D:\minramas> node scripts\bake-pet-preview-grid.mjs                  # bake all
 *   PS D:\minramas> node scripts\bake-pet-preview-grid.mjs --variations 3   # fewer cards per effect
 *
 * Re-runs SKIP already-baked files, so a partial/failed run just needs re-running.
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const varFlag = process.argv.indexOf("--variations");
const VARIATIONS = varFlag !== -1 ? Math.max(1, parseInt(process.argv[varFlag + 1], 10) || 4) : 4;

const API_URL = "http://127.0.0.1:3000/api/v1/pets/generate";
const POOL_DIR = path.join(process.cwd(), "pet-source-pool");
const MANIFEST = path.join(POOL_DIR, "pet-pool-manifest.json");
const OUT_DIR = path.join(process.cwd(), "previews", "pets");
const CONCURRENCY = 2;

// Preview render defaults (pets has no bust "framing" — it uses environment +
// action). These mirror a plain UI craft: gallery environment, as-photographed
// pose, landscape aspect that suits a pair.
const ENVIRONMENT = "gallery";
const ACTION = "as_photographed";
const ASPECT = "4:3";
const SCALE = "auto_85"; // route maps auto_85 -> close_up (runs the outpaint margin)

// ---------------------------------------------------------------- effects
// section drives the request branch: 'material' -> preset_id path,
// 'curiosity' -> experimental_effect path. Order here = deal order.
// IDs must match the ENGINE whitelist (pets-shared PetsPresetId /
// pets-experimental PetExperimentalEffectId), not any UI label.
const EFFECTS = [
  // materials (preset_id path)
  { id: "ceramic",      section: "material" },
  { id: "plushy",       section: "material" },
  { id: "walnut",       section: "material" },
  { id: "stone",        section: "material" },
  { id: "bronze",       section: "material" },
  { id: "mixed_metals", section: "material" },
  { id: "alabaster",    section: "material" },
  // curiosities (experimental_effect path)
  { id: "amber_inclusion",   section: "curiosity" },
  { id: "garden_statue",     section: "curiosity" },
  { id: "blown_glass",       section: "curiosity" },
  { id: "enchanted_crystal", section: "curiosity" },
  { id: "topiary",           section: "curiosity" },
  { id: "regal",             section: "curiosity" },
  { id: "elizabethan_ruff",  section: "curiosity" },
  { id: "sailor",            section: "curiosity" },
  { id: "ukiyo_e",           section: "curiosity" },
  { id: "art_nouveau",       section: "curiosity" },
  { id: "cubism",            section: "curiosity" },
  { id: "daguerreotype",     section: "curiosity" },
  { id: "film_noir",         section: "curiosity" },
];

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
const INTERNAL_KEY = ENV.LITEN_INTERNAL_KEY; // optional; pets route doesn't require it

// ---------------------------------------------------------------- deal
function loadPool() {
  if (!fs.existsSync(MANIFEST)) {
    console.error(`Manifest not found: ${MANIFEST}`);
    console.error("Run generate-pet-source-pool.mjs first.");
    process.exit(1);
  }
  const pool = JSON.parse(fs.readFileSync(MANIFEST, "utf8")).filter((p) => p.status === "ok");
  const present = pool.filter((p) => fs.existsSync(path.join(POOL_DIR, p.file)));
  const need = EFFECTS.length * VARIATIONS;
  if (present.length < need) {
    console.error(
      `Need ${need} source pairs (${EFFECTS.length} effects x ${VARIATIONS}), found ${present.length}. ` +
        `Generate more: node scripts\\generate-pet-source-pool.mjs --n ${need}`
    );
    process.exit(1);
  }
  return present;
}

// Deterministic shuffle (seeded) so re-runs assign identically -> skip logic works.
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildAssignment(pool) {
  // Pets have no ordinal axis like age, so we spread by SPECIES/pairing:
  // group the pool by pair signature, round-robin those groups into a single
  // interleaved list (so neighbors differ in species), then split into
  // VARIATIONS buckets and deal effect e -> bucket[q][e]. Each effect's cards
  // therefore pull from different points of the species spectrum.
  const groups = {};
  for (const p of pool) {
    const key = `${p.kind}:${p.speciesA}+${p.speciesB}`;
    (groups[key] ??= []).push(p);
  }
  const keys = seededShuffle(Object.keys(groups), 7);
  keys.forEach((k, i) => (groups[k] = seededShuffle(groups[k], 100 + i)));
  const interleaved = [];
  let added = true;
  while (added) {
    added = false;
    for (const k of keys) {
      if (groups[k].length) { interleaved.push(groups[k].shift()); added = true; }
    }
  }

  const perBucket = Math.floor(interleaved.length / VARIATIONS);
  const buckets = [];
  for (let q = 0; q < VARIATIONS; q++) {
    buckets.push(seededShuffle(interleaved.slice(q * perBucket, (q + 1) * perBucket), 42 + q));
  }

  const jobs = [];
  EFFECTS.forEach((effect, e) => {
    for (let v = 0; v < VARIATIONS; v++) {
      const src = buckets[v][e];
      jobs.push({
        effect: effect.id,
        section: effect.section,
        variation: v + 1,
        src,
        srcFile: path.join(POOL_DIR, src.file),
        dest: path.join(OUT_DIR, effect.id, `${v + 1}.jpg`),
      });
    }
  });
  return jobs;
}

// ---------------------------------------------------------------- render
async function renderJob(job, attempt = 1) {
  if (fs.existsSync(job.dest)) {
    console.log(`  skip ${job.effect}/${job.variation}.jpg (exists)`);
    return { ...jobMeta(job), status: "ok" };
  }
  try {
    const sourceB64 = fs.readFileSync(job.srcFile).toString("base64");
    const headers = { "Content-Type": "application/json" };
    if (INTERNAL_KEY) headers["x-liten-internal"] = INTERNAL_KEY;

    // Body mirrors the Pets UI craft. Materials go via preset_id + environment
    // + action; curiosities via experimental_effect (which bypasses those).
    // Detection infers subject count from the two-pet source -> group render.
    const body =
      job.section === "curiosity"
        ? {
            source_image_b64: sourceB64,
            additional_images_b64: [],
            style_id: "realistic",
            experimental_effect: job.effect,
            aspect_ratio: ASPECT,
          }
        : {
            source_image_b64: sourceB64,
            additional_images_b64: [],
            style_id: "realistic",
            preset_id: job.effect,
            environment_id: ENVIRONMENT,
            action_id: ACTION,
            scale: SCALE,
            aspect_ratio: ASPECT,
          };

    const res = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);

    const data = await res.json();
    if (!data?.ok) throw new Error(`engine: ${data?.error ?? "unknown"}`);
    const imageB64 = data?.result?.image_b64;
    if (!imageB64) throw new Error(`no image (final_pass=${data?.result?.final_pass})`);

    const cnt = data?.result?.subject_count;
    const warn = cnt != null && cnt < 2 ? `  [WARN detected ${cnt}, expected 2]` : "";

    fs.mkdirSync(path.dirname(job.dest), { recursive: true });
    await sharp(Buffer.from(imageB64, "base64")).jpeg({ quality: 90 }).toFile(job.dest);
    console.log(`  ok  ${job.effect}/${job.variation}.jpg  <- ${job.src.file} (${job.src.breedA} + ${job.src.breedB})${warn}`);
    return { ...jobMeta(job), status: "ok", subject_count: cnt };
  } catch (err) {
    if (attempt < 3) {
      console.log(`  retry ${attempt + 1}/3 ${job.effect}/${job.variation} (${err.message})`);
      return renderJob(job, attempt + 1);
    }
    console.log(`  FAILED ${job.effect}/${job.variation}: ${err.message}`);
    return { ...jobMeta(job), status: "failed", error: String(err.message) };
  }
}

function jobMeta(job) {
  return {
    effect: job.effect, section: job.section, variation: job.variation,
    source: job.src.file, kind: job.src.kind,
    speciesA: job.src.speciesA, speciesB: job.src.speciesB,
    breedA: job.src.breedA, breedB: job.src.breedB,
  };
}

// ---------------------------------------------------------------- main
async function main() {
  const pool = loadPool();
  const jobs = buildAssignment(pool);

  if (DRY) {
    let cur = "";
    jobs.forEach((j) => {
      if (j.effect !== cur) { cur = j.effect; console.log(`\n${j.effect} [${j.section}]`); }
      console.log(`  ${j.variation}: ${j.src.file}  [${j.src.kind}] ${j.src.breedA} + ${j.src.breedB}`);
    });
    // per-effect species-variety check
    console.log("\n--- spread check (distinct species-pairs within each effect) ---");
    const byEffect = {};
    jobs.forEach((j) => (byEffect[j.effect] ??= new Set()).add(`${j.src.speciesA}+${j.src.speciesB}`));
    const clumped = Object.entries(byEffect).filter(([, set]) => set.size < 2);
    console.log(clumped.length
      ? `Effects whose cards are all one species-pair: ${clumped.map((c) => c[0]).join(", ")}`
      : "Every effect spans >=2 distinct species-pairs. Good.");
    console.log(`\nTotal jobs: ${jobs.length} (${EFFECTS.length} effects x ${VARIATIONS})`);
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Baking ${jobs.length} pet previews -> ${OUT_DIR}\n`);
  const results = [];
  const queue = [...jobs];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) results.push(await renderJob(queue.shift()));
  });
  await Promise.all(workers);

  fs.writeFileSync(path.join(OUT_DIR, "bake-grid-manifest.json"), JSON.stringify(results, null, 2));
  const ok = results.filter((r) => r.status === "ok").length;
  const failed = results.length - ok;
  const undercount = results.filter((r) => r.subject_count != null && r.subject_count < 2).length;
  console.log(`\nDone: ${ok} baked, ${failed} failed.`);
  if (undercount) console.log(`${undercount} render(s) detected <2 pets — analyzer under-count to check.`);
  if (failed) console.log("Re-run to retry only the missing ones.");
  console.log(`\nUpload: drag  previews\\pets  into the Supabase "previews" bucket root.`);
}

main();
