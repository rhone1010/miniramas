#!/usr/bin/env node
/**
 * bake-preview-grid.mjs
 * Liten & Co -- bake the full Curator preview library.
 *
 * Reads the 104-person source pool + manifest, deals each person to exactly
 * ONE effect/variation slot (104 = 26 effects x 4, fully unique -- no face
 * repeats anywhere in the grid), runs each through the PRODUCTION generate
 * route, and writes:
 *
 *     previews/portraits/{effect}/1.jpg .. 4.jpg
 *
 * Spread guarantee: the pool is split into 4 age quartiles; every effect gets
 * one person from each quartile, so an effect's 4 cards always span young->old.
 * Gender/race are interleaved within quartiles so cards rarely clump.
 *
 * Crop by section:
 *   sculptural + artists  -> tight headshot (face + shoulders)
 *   experimental          -> wider 3/4 crop (show the transformation)
 *
 * SETUP: run generate-source-pool.mjs first (produces source-pool\ + manifest),
 * start the dev server (npm run dev), then from a second window:
 *   PS D:\minramas> node scripts\bake-preview-grid.mjs --dry   # print the assignment, no calls
 *   PS D:\minramas> node scripts\bake-preview-grid.mjs         # bake all 104
 *
 * Re-runs SKIP already-baked files, so a partial/failed run just needs re-running.
 */

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DRY = process.argv.includes("--dry");
const API_URL = "http://127.0.0.1:3000/api/v1/portraits/generate";
const POOL_DIR = path.join(process.cwd(), "source-pool");
const MANIFEST = path.join(POOL_DIR, "pool-manifest.json");
const OUT_DIR = path.join(process.cwd(), "previews", "portraits");
const CONCURRENCY = 2;

// ---------------------------------------------------------------- effects
// Section drives style_id + crop. Order here = deal order.
const EFFECTS = [
  // sculptural (style_id realistic, headshot)
  { id: "ebony",           section: "sculptural" },
  { id: "walnut",          section: "sculptural" },
  { id: "stone",           section: "sculptural" },
  { id: "bronze",          section: "sculptural" },
  { id: "iron",            section: "sculptural" },
  { id: "alabaster",       section: "sculptural" },
  // artists (style_id artists_gallery, headshot)
  { id: "impressionist",   section: "artists" },
  { id: "torn_paper",      section: "artists" },
  { id: "folded_book",     section: "artists" },
  { id: "charcoal_chalk",  section: "artists" },
  { id: "pencil_sketch",   section: "artists" },
  { id: "sheet_music",     section: "artists" },
  // experimental (separate route branch: experimental_effect, WIDER crop)
  // NOTE: these ids must match the ENGINE whitelist in portraits-experimental.ts,
  // NOT the UI's EXPERIMENTAL_FX. kintsugi + geode_druzy dropped (not in engine);
  // living_armor renamed to armor (engine's id). 12 valid experimental effects.
  { id: "deep_sea",        section: "experimental" },
  { id: "circuit",         section: "experimental" },
  { id: "reclaimed_bronze",section: "experimental" },
  { id: "mercury",         section: "experimental" },
  { id: "blown_glass",     section: "experimental" },
  { id: "amber",           section: "experimental" },
  { id: "neon",            section: "experimental" },
  { id: "nebula_resin",    section: "experimental" },
  { id: "dragon_skin",     section: "experimental" },
  { id: "magic_energy",    section: "experimental" },
  { id: "fantasy_crystal", section: "experimental" }, // folder fantasy_crystal, label "Enchanted Crystal"
  { id: "armor",           section: "experimental" }, // engine id; UI label "Living Armor"
];
const VARIATIONS = 4;

const ARTISTS = new Set([
  "impressionist", "torn_paper", "folded_book",
  "charcoal_chalk", "pencil_sketch", "sheet_music",
]);

function styleFor(effect) {
  return ARTISTS.has(effect.id) ? "artists_gallery" : "realistic";
}

// Focal matches the UI's default item focal. A non-meaningful focal
// ({x:0.5,y:0.5,zoom:1,subjectId:null}) triggers NO server crop, so the full
// studio-3/4 source passes through -- exactly what a UI craft does when the
// user hasn't panned/zoomed. Composition otherwise comes from `framing`.
const FOCAL = { x: 0.5, y: 0.5, zoom: 1.0, subjectId: null };

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

// ---------------------------------------------------------------- deal
function loadPool() {
  if (!fs.existsSync(MANIFEST)) {
    console.error(`Manifest not found: ${MANIFEST}`);
    console.error("Run generate-source-pool.mjs first.");
    process.exit(1);
  }
  const pool = JSON.parse(fs.readFileSync(MANIFEST, "utf8")).filter((p) => p.status === "ok");
  const present = pool.filter((p) => fs.existsSync(path.join(POOL_DIR, p.file)));
  if (present.length < EFFECTS.length * VARIATIONS) {
    console.error(
      `Need ${EFFECTS.length * VARIATIONS} source images, found ${present.length}. ` +
        `Finish the source run first (re-run generate-source-pool.mjs to fill gaps).`
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
  // Sort by age, split into VARIATIONS quartiles, shuffle each (seeded),
  // then effect e gets quartile[q][e] for q in 0..3.
  const byAge = [...pool].sort((a, b) => a.age - b.age);
  const perQuartile = Math.floor(byAge.length / VARIATIONS); // 26
  const quartiles = [];
  for (let q = 0; q < VARIATIONS; q++) {
    const slice = byAge.slice(q * perQuartile, (q + 1) * perQuartile);
    quartiles.push(seededShuffle(slice, 42 + q));
  }
  const jobs = [];
  EFFECTS.forEach((effect, e) => {
    for (let v = 0; v < VARIATIONS; v++) {
      const person = quartiles[v][e];
      jobs.push({
        effect: effect.id,
        section: effect.section,
        variation: v + 1,
        person,
        style_id: styleFor(effect),
        srcFile: path.join(POOL_DIR, person.file),
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

    // Bodies mirror the UI craft request EXACTLY (per route trace) so previews
    // match customer output. Key parity rules:
    //  - do NOT send `advanced` (UI never does; it wouldn't reach the model)
    //  - do NOT send `qa_override` (customers run at default strictness)
    //  - composition is driven by `framing`, not aspect_ratio/upper_body_concept
    //  - send FULL source + `focal`; the route server-crops to the focal region
    //  - use the short `preset` key (UI convention)
    // Framing: 'signature' = the Liten headshot-ish crop the UI uses for cards.
    const body =
      job.section === "experimental"
        ? {
            source_image_b64: sourceB64,
            additional_images_b64: [],
            experimental_effect: job.effect,
            framing: "signature",
            focal: FOCAL,
          }
        : {
            source_image_b64: sourceB64,
            additional_images_b64: [],
            style_id: job.style_id,
            preset: job.effect,
            location: "auto",
            scale: "auto_85",
            resolution: "1k",
            framing: "signature",
            focal: FOCAL,
          };

    const res = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);

    const data = await res.json();
    // Standard preset branch wraps the image in { result: { image_b64 } };
    // experimental branch returns image_b64 at the top level. Accept either.
    const imageB64 = data?.result?.image_b64 ?? data?.image_b64;
    if (!imageB64) throw new Error(`no image (status: ${data?.result?.status ?? data?.status ?? "?"})`);

    fs.mkdirSync(path.dirname(job.dest), { recursive: true });
    await sharp(Buffer.from(imageB64, "base64")).jpeg({ quality: 90 }).toFile(job.dest);
    console.log(`  ok  ${job.effect}/${job.variation}.jpg  <- ${job.person.file} (${job.person.age}${job.person.gender})`);
    return { ...jobMeta(job), status: "ok" };
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
    source: job.person.file, age: job.person.age, gender: job.person.gender, race: job.person.race,
  };
}

// ---------------------------------------------------------------- main
async function main() {
  const pool = loadPool();
  const jobs = buildAssignment(pool);

  if (DRY) {
    let cur = "";
    jobs.forEach((j) => {
      if (j.effect !== cur) { cur = j.effect; console.log(`\n${j.effect} [${j.section}, ${j.style_id}]`); }
      console.log(`  ${j.variation}: ${j.person.file}  ${j.person.age}${j.person.gender} ${j.person.race}`);
    });
    // per-effect spread check
    console.log("\n--- spread check (age range within each effect) ---");
    const byEffect = {};
    jobs.forEach((j) => (byEffect[j.effect] ??= []).push(j.person.age));
    let worst = 0;
    Object.entries(byEffect).forEach(([id, ages]) => {
      const range = Math.max(...ages) - Math.min(...ages);
      worst = Math.max(worst, 99 - range); // smaller range = tighter clump
    });
    const clumped = Object.entries(byEffect).filter(([, a]) => Math.max(...a) - Math.min(...a) < 15);
    console.log(clumped.length ? `Effects with <15yr age spread: ${clumped.map((c) => c[0]).join(", ")}` : "Every effect spans >=15yr of age. Good.");
    console.log(`\nTotal jobs: ${jobs.length} (${EFFECTS.length} effects x ${VARIATIONS})`);
    return;
  }

  if (!INTERNAL_KEY) {
    console.log("NOTE: LITEN_INTERNAL_KEY not set -- qa_override skipped, renders run at table strictness.\n");
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Baking ${jobs.length} previews -> ${OUT_DIR}\n`);
  const results = [];
  const queue = [...jobs];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) results.push(await renderJob(queue.shift()));
  });
  await Promise.all(workers);

  fs.writeFileSync(path.join(OUT_DIR, "bake-grid-manifest.json"), JSON.stringify(results, null, 2));
  const ok = results.filter((r) => r.status === "ok").length;
  const failed = results.length - ok;
  console.log(`\nDone: ${ok} baked, ${failed} failed.`);
  if (failed) console.log("Re-run to retry only the missing ones.");
  console.log(`\nUpload: drag  previews\\portraits  into the Supabase "previews" bucket root.`);
}

main();
