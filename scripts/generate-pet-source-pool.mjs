#!/usr/bin/env node
/**
 * generate-pet-source-pool.mjs
 * Liten & Co -- balanced TWO-PET studio source photos for multi-pet testing.
 *
 * Same shape as generate-source-pool.mjs (people), adapted for pets:
 *   people spectrum (age/gender/race)  ->  pet spectrum (species/breed/pairing)
 *   single 3/4 headshot                ->  two animals, both fully in frame
 *
 * Each image is TWO pets together, sitting side by side, whole body of each
 * animal visible from head to paws/tail so the Pets pipeline's detection
 * reliably counts 2 and the group prompt fires. Species are spread across
 * dogs / cats / birds / rabbits / reptiles with a market-weighted mix of
 * same-species and cross-species pairs, so the pool reads like a real range
 * of what customers would upload.
 *
 * Run from repo root (reads REPLICATE_API_TOKEN from .env.local or env):
 *   PS D:\minramas> node scripts\generate-pet-source-pool.mjs --dry        # preview prompts + spectrum
 *   PS D:\minramas> node scripts\generate-pet-source-pool.mjs              # full run (default N)
 *   PS D:\minramas> node scripts\generate-pet-source-pool.mjs --n 40       # override count
 *
 * Output: .\pet-source-pool\pet001.png .. petNNN.png  +  pet-pool-manifest.json
 * The manifest records each pair's species + breeds so a downstream bench/
 * render pass can deal them out and tag results.
 */

import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const nFlag = process.argv.indexOf("--n");
const TOTAL = nFlag !== -1 ? Math.max(1, parseInt(process.argv[nFlag + 1], 10) || 24) : 24;

const OUT_DIR = path.join(process.cwd(), "pet-source-pool");
const MODEL_URL = "https://api.replicate.com/v1/models/google/nano-banana-2/predictions";
const CONCURRENCY = 3;
const ASPECT = "4:3"; // landscape frames two pets side by side better than 3:4

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
const TOKEN = ENV.REPLICATE_API_TOKEN;

// ---------------------------------------------------------------- spectrum
// Species with a US-pet-market lean: dogs + cats dominate, a real tail of
// birds / rabbits / reptiles. Breeds within each keep pairs from repeating.
const SPECIES_WEIGHTS = [
  { species: "dog",     weight: 40 },
  { species: "cat",     weight: 34 },
  { species: "bird",    weight: 12 },
  { species: "rabbit",  weight: 8 },
  { species: "reptile", weight: 6 },
];
const BREEDS = {
  dog: [
    "golden retriever dog", "black labrador dog", "beagle", "corgi",
    "german shepherd dog", "pug", "dachshund", "border collie",
    "chihuahua", "standard poodle", "siberian husky", "boxer dog",
    "french bulldog", "shih tzu",
  ],
  cat: [
    "orange tabby cat", "siamese cat", "grey tabby cat", "black cat",
    "calico cat", "maine coon cat", "russian blue cat", "white persian cat",
    "tuxedo cat", "bengal cat",
  ],
  bird: [
    "scarlet macaw parrot", "green budgerigar", "grey cockatiel",
    "african grey parrot", "yellow canary", "peach-faced lovebird",
  ],
  rabbit: [
    "lop-eared rabbit", "dwarf rabbit", "dutch rabbit", "angora rabbit",
  ],
  reptile: [
    "box turtle", "red-eared slider turtle", "bearded dragon lizard",
    "russian tortoise",
  ],
};

const BACKDROPS = [
  {
    backdrop: "a smooth seamless studio backdrop with a soft neutral grey gradient",
    light: "clean studio key light with gentle fill, crisp and even",
  },
  {
    backdrop: "a simple clean indoor setting with a softly blurred neutral background",
    light: "soft natural window light, bright and true-to-life",
  },
  {
    backdrop: "a bright simple outdoor lawn with a softly blurred green background",
    light: "open daylight, clear and natural",
  },
];

const ARRANGEMENTS = [
  "sitting side by side, close together",
  "sitting next to each other, one slightly forward of the other",
  "side by side and both facing the camera",
  "close together, one sitting and one standing beside it",
];

const STYLE =
  "Professional pet photography, tack-sharp focus, true-to-life fur/feather/scale texture, " +
  "clean natural color, no clutter, no props, no text, no watermark";

const FRAMING =
  "BOTH animals fully visible in frame from head to paws and tail with nothing cropped, " +
  "clear separation between the two animals so each is distinct, and each animal's face, " +
  "body, and natural markings sharp and clearly visible";

const AN = (s) => (/^[aeiou]/i.test(s) ? "an " : "a ") + s;

function pickWeightedSpeciesList(len) {
  const flat = [];
  SPECIES_WEIGHTS.forEach((w) => { for (let k = 0; k < w.weight; k++) flat.push(w.species); });
  // sample evenly across the weighted pool with a stride, length = len
  const out = [];
  let j = 0;
  for (let i = 0; i < len; i++) {
    out.push(flat[j % flat.length]);
    j += Math.max(1, Math.floor(flat.length / len)) + 3; // stride + offset avoids clustering
  }
  return out;
}

function buildPairs() {
  // One weighted species draw per image drives species A. Even images are
  // SAME-species pairs (two of one species, different breeds); odd images are
  // CROSS-species (a different weighted species for B). ~50/50, market-real.
  const speciesA = pickWeightedSpeciesList(TOTAL);
  const speciesB = pickWeightedSpeciesList(TOTAL).reverse(); // decorrelate from A
  const pairs = [];
  for (let i = 0; i < TOTAL; i++) {
    const sameSpecies = i % 2 === 0;
    const a = speciesA[i];
    const b = sameSpecies ? a : (speciesB[i] === a ? nextSpecies(a) : speciesB[i]);

    const breedsA = BREEDS[a], breedsB = BREEDS[b];
    let breedA = breedsA[(i * 3) % breedsA.length];
    let breedB = breedsB[(i * 5 + 2) % breedsB.length];
    if (sameSpecies && breedA === breedB) breedB = breedsB[(i * 5 + 3) % breedsB.length];

    const arr = ARRANGEMENTS[i % ARRANGEMENTS.length];
    const bk = BACKDROPS[i % BACKDROPS.length];

    const prompt =
      `${STYLE}. A single clear photograph of two pets together: ${AN(breedA)} and ${AN(breedB)}, ` +
      `${arr}. ${FRAMING}. Backdrop: ${bk.backdrop}. Lighting: ${bk.light}. ` +
      `A candid, natural photo that looks exactly like a real photograph a pet owner would upload.`;

    const id = `pet${String(i + 1).padStart(3, "0")}`;
    pairs.push({
      id, file: `${id}.png`, kind: sameSpecies ? "same" : "cross",
      speciesA: a, speciesB: b, breedA, breedB, arrangement: arr, prompt, aspect: ASPECT,
    });
  }
  return pairs;
}

function nextSpecies(s) {
  const order = SPECIES_WEIGHTS.map((w) => w.species);
  return order[(order.indexOf(s) + 1) % order.length];
}

// ---------------------------------------------------------------- replicate
async function createPrediction(job) {
  const res = await fetch(MODEL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
    },
    body: JSON.stringify({
      input: { prompt: job.prompt, aspect_ratio: job.aspect, output_format: "png" },
    }),
  });
  if (!res.ok) throw new Error(`create ${res.status}: ${await res.text()}`);
  return res.json();
}

async function pollPrediction(url) {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) throw new Error(`poll ${res.status}`);
    const data = await res.json();
    if (["succeeded", "failed", "canceled"].includes(data.status)) return data;
  }
  throw new Error("poll timeout");
}

async function downloadTo(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function runJob(job, attempt = 1) {
  const dest = path.join(OUT_DIR, job.file);
  if (fs.existsSync(dest)) {
    console.log(`  skip ${job.file} (exists)`);
    return { ...job, status: "ok" };
  }
  try {
    let pred = await createPrediction(job);
    if (!["succeeded", "failed", "canceled"].includes(pred.status)) {
      pred = await pollPrediction(pred.urls.get);
    }
    if (pred.status !== "succeeded") throw new Error(`status=${pred.status} ${pred.error ?? ""}`);
    const outUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    await downloadTo(outUrl, dest);
    console.log(`  ok  ${job.file}  (${job.kind}: ${job.breedA} + ${job.breedB})`);
    return { ...job, status: "ok" };
  } catch (err) {
    if (attempt < 3) {
      console.log(`  retry ${attempt + 1}/3 ${job.file} (${err.message})`);
      return runJob(job, attempt + 1);
    }
    console.log(`  FAILED ${job.file}: ${err.message}`);
    return { ...job, status: "failed", error: String(err.message) };
  }
}

// ---------------------------------------------------------------- main
async function main() {
  const jobs = buildPairs();

  if (DRY) {
    jobs.forEach((j) => console.log(`${j.file}  [${j.kind}] ${j.breedA} + ${j.breedB} [${j.aspect}]\n  ${j.prompt}\n`));
    const bySpecies = {}, byKind = { same: 0, cross: 0 };
    jobs.forEach((j) => {
      byKind[j.kind]++;
      [j.speciesA, j.speciesB].forEach((s) => { bySpecies[s] = (bySpecies[s] || 0) + 1; });
    });
    console.log(`Total images: ${jobs.length}  (${jobs.length * 2} animals)`);
    console.log("Pair kind:", byKind);
    console.log("Species (animal count):", bySpecies);
    return;
  }

  if (!TOKEN) {
    console.error("Missing REPLICATE_API_TOKEN (env or .env.local). Aborting.");
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Generating ${jobs.length} two-pet source photos -> ${OUT_DIR}\n`);
  const results = [];
  const queue = [...jobs];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) results.push(await runJob(queue.shift()));
  });
  await Promise.all(workers);

  results.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(path.join(OUT_DIR, "pet-pool-manifest.json"), JSON.stringify(results, null, 2));

  const ok = results.filter((r) => r.status === "ok").length;
  console.log(`\nDone: ${ok}/${jobs.length} succeeded. pet-pool-manifest.json written.`);
  if (ok < jobs.length) console.log("Re-run to fill the gaps -- existing files are skipped.");
}

main();
