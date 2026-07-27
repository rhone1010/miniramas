#!/usr/bin/env node
/**
 * generate-source-pool.mjs
 * Liten & Co -- 104 balanced studio source portraits for the preview bake.
 *
 * 104 = 26 effects x 4 variations, every card a UNIQUE person.
 * Spread evenly across age / gender / race so the Curator grid reads as a
 * genuine cross-section of humanity, never a demographic lineup.
 *
 * Studio spec (same as before): crisp key + rim light, gradient or black
 * backdrop, no clutter, Liten 3/4 framing (complete arms, both hands),
 * face large + tack sharp so every source clears Gate 1.
 *
 * Run from repo root (reads REPLICATE_API_TOKEN from .env.local or env):
 *   PS D:\minramas> node scripts\generate-source-pool.mjs --dry   # preview prompts
 *   PS D:\minramas> node scripts\generate-source-pool.mjs         # full run
 *
 * Output: .\source-pool\p001.png .. p104.png  +  pool-manifest.json
 * The manifest records each person's age/gender/race so the bake script can
 * deal them out with a guaranteed spectrum per effect.
 */

import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const OUT_DIR = path.join(process.cwd(), "source-pool");
const MODEL_URL = "https://api.replicate.com/v1/models/google/nano-banana-2/predictions";
const CONCURRENCY = 3;
const TOTAL = 104;

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
// 8 age anchors x alternating gender, cycling 8 races, 2 backdrops, 3 descriptors.
// 104 people land ~13 per age band, 52/52 gender, ~13 per race -- even coverage
// without a rigid grid (the cycling offsets keep neighbors from matching).
// Weighted age distribution (no children under 10, none over 75):
//   10-15 small teen anchor · 16-19 thin bridge ·
//   20-50 the majority evenly spread · 51-75 healthy mature/senior tail.
const AGE_BANDS = [
  { min: 10, max: 15, weight: 10 },
  { min: 16, max: 19, weight: 6 },
  { min: 20, max: 35, weight: 34 },
  { min: 36, max: 50, weight: 28 },
  { min: 51, max: 65, weight: 16 },
  { min: 66, max: 75, weight: 10 },
];
const RACES = [
  "East Asian", "Black", "Latino", "South Asian",
  "white", "Middle Eastern", "Southeast Asian", "mixed-heritage",
];
// US-market weighting: approximate US population shares across 104 people so the
// preview grid reads like a US cross-section (white plurality, then Latino,
// Black, Asian split across the three buckets, plus mixed + Middle Eastern).
// Counts sum to 104. buildRaces() expands + scatters these.
const RACE_WEIGHTS = [
  { race: "white",           count: 50 },
  { race: "Latino",          count: 18 },
  { race: "Black",           count: 13 },
  { race: "East Asian",      count: 5 },
  { race: "South Asian",     count: 4 },
  { race: "Southeast Asian", count: 4 },
  { race: "mixed-heritage",  count: 6 },
  { race: "Middle Eastern",  count: 4 },
];
const BACKDROPS = [
  {
    backdrop: "a smooth seamless studio backdrop with a soft charcoal-to-black radial gradient",
    light: "classic studio key light with a subtle rim light separating the subject from the backdrop",
  },
  {
    backdrop: "a pure matte black studio backdrop, completely clean and featureless",
    light: "crisp butterfly lighting with a large softbox key and gentle fill, gallery-portrait quality",
  },
];
const ADULT_DESC = [
  "strikingly attractive and photogenic",
  "attractive and photogenic with warm, expressive features",
  "photogenic with striking, memorable features",
];
const MINOR_DESC = [
  "bright-eyed and photogenic",
  "cheerful and photogenic with a natural smile",
  "friendly and photogenic",
];

// Variety pools -- each person draws a different combination so 104 portraits
// read like a real gallery of real people, not a uniform headshot wall.
// Studio quality stays fixed; only expression / pose / wardrobe vary.
const EXPRESSIONS = [
  "a huge genuine smile, caught mid-laugh",
  "a warm, relaxed closed-mouth smile",
  "a thoughtful, contemplative look, eyes soft",
  "a quiet confident half-smile",
  "a bright candid grin, looking slightly off-camera",
  "a calm, serene expression",
  "an amused, playful expression with a raised brow",
  "a gentle, kind expression, fully at ease",
];
const POSES = [
  "arms loosely crossed, relaxed and open",
  "one hand resting near the chin in a thoughtful gesture, the other arm relaxed",
  "hands clasped comfortably in front, leaning very slightly toward the camera",
  "turned a few degrees to one side with the face toward the lens, one hand on the opposite forearm",
  "both hands relaxed at the sides, shoulders squared and easy",
  "one hand tucked casually near a pocket, the other relaxed, weight on one hip",
  "hands gently resting one over the other, an open candid posture",
  "leaning back slightly with a natural, unposed ease, hands visible and relaxed",
];
const WARDROBE_ADULT = [
  "a simple solid-color crewneck sweater",
  "a crisp button-down shirt in a solid muted tone, collar open",
  "a fine-knit turtleneck in a warm neutral",
  "a relaxed linen shirt in a soft solid color",
  "a well-fitted plain t-shirt under an open casual overshirt",
  "a tailored blazer over a plain top, smart-casual",
  "a soft cardigan over a simple tee",
  "a clean henley in a solid earthy tone",
];
const WARDROBE_MINOR = [
  "a simple solid-color hoodie",
  "a plain crewneck t-shirt in a bright solid color",
  "a soft knit sweater in a cheerful solid tone",
  "a clean button-up shirt, casual and neat",
  "a plain long-sleeve tee in a solid color",
  "a simple denim shirt over a plain tee",
];

const STYLE =
  "Professional photography studio portrait, medium-format camera quality, tack-sharp focus, " +
  "true-to-life skin texture, clean color, no environmental clutter, no props";

const FRAMING =
  "framed from the hips up in a three-quarter portrait: torso with complete arms and BOTH hands " +
  "fully visible in frame, with well-formed natural fingers; never crop or terminate an arm " +
  "mid-forearm; face large in the frame and tack sharp";

function noun(age, gender) {
  if (age < 13) return gender === "f" ? "girl" : "boy";
  if (age < 18) return gender === "f" ? "teenage girl" : "teenage boy";
  return gender === "f" ? "woman" : "man";
}

function buildRaces() {
  // Expand weighted counts into a flat list, then scatter so neighbors differ.
  const flat = [];
  RACE_WEIGHTS.forEach((w) => { for (let k = 0; k < w.count; k++) flat.push(w.race); });
  while (flat.length < TOTAL) flat.push("white");
  flat.length = TOTAL;
  // scatter with a stride so runs of the same race don't cluster
  const out = [];
  const used = new Array(flat.length).fill(false);
  let j = 0;
  for (let i = 0; i < flat.length; i++) {
    while (used[j]) j = (j + 1) % flat.length;
    out.push(flat[j]);
    used[j] = true;
    j = (j + 11) % flat.length;
  }
  return out;
}

function buildAges() {
  // Expand weighted bands into a flat list of exactly TOTAL ages, spreading
  // ages evenly across each band's range (no clumping on one exact age).
  const totalWeight = AGE_BANDS.reduce((s, b) => s + b.weight, 0);
  const ages = [];
  AGE_BANDS.forEach((b) => {
    const n = Math.round((b.weight / totalWeight) * TOTAL);
    for (let k = 0; k < n; k++) {
      const span = b.max - b.min;
      const age = b.min + Math.round((k * span) / Math.max(1, n - 1));
      ages.push(age);
    }
  });
  while (ages.length > TOTAL) ages.pop();
  while (ages.length < TOTAL) ages.push(20 + (ages.length % 16));
  // scatter so adjacent people aren't the same age (round-robin stride)
  ages.sort((a, z) => a - z);
  const spread = [];
  const used = new Array(ages.length).fill(false);
  let j = 0;
  for (let i = 0; i < ages.length; i++) {
    while (used[j]) j = (j + 1) % ages.length;
    spread.push(ages[j]);
    used[j] = true;
    j = (j + 13) % ages.length;
  }
  return spread;
}

function buildPeople() {
  const ages = buildAges();
  const races = buildRaces();
  const people = [];
  for (let i = 0; i < TOTAL; i++) {
    const age = ages[i];
    const gender = i % 2 === 0 ? "f" : "m";
    let race = races[i];
    const b = BACKDROPS[i % BACKDROPS.length];
    const minor = age < 18;
    const desc = (minor ? MINOR_DESC : ADULT_DESC)[i % 3];

    let raceWord = race;
    if (race === "Latino" && gender === "f") raceWord = "Latina";

    const article = /^[aeiou]/i.test(desc) ? "an" : "a";
    const subject = `${article} ${desc} ${age}-year-old ${raceWord} ${noun(age, gender)}`;

    // Draw expression / pose / wardrobe from the variety pools with different
    // strides so each person gets a distinct combination (not lockstepped).
    const expression = EXPRESSIONS[(i * 3) % EXPRESSIONS.length];
    const pose = POSES[(i * 5) % POSES.length];
    const wardrobe = minor
      ? WARDROBE_MINOR[(i * 2) % WARDROBE_MINOR.length]
      : WARDROBE_ADULT[(i * 3) % WARDROBE_ADULT.length];

    const prompt =
      `${STYLE}. Subject: ${subject}, wearing ${wardrobe}. ` +
      `Expression: ${expression}. Pose: ${pose}. ` +
      `${FRAMING}. Backdrop: ${b.backdrop}. Lighting: ${b.light}. ` +
      `A candid, natural studio portrait that looks like a premium session deliverable, ` +
      `authentic and full of personality.`;

    const id = `p${String(i + 1).padStart(3, "0")}`;
    people.push({
      id, file: `${id}.png`, age, gender, race,
      expression, pose, wardrobe, prompt, aspect: "3:4",
    });
  }
  return people;
}

// ---------------------------------------------------------------- replicate
async function createPrediction(person) {
  const res = await fetch(MODEL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
    },
    body: JSON.stringify({
      input: { prompt: person.prompt, aspect_ratio: person.aspect, output_format: "png" },
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

async function runPerson(person, attempt = 1) {
  const dest = path.join(OUT_DIR, person.file);
  if (fs.existsSync(dest)) {
    console.log(`  skip ${person.file} (exists)`);
    return { ...person, status: "ok" };
  }
  try {
    let pred = await createPrediction(person);
    if (!["succeeded", "failed", "canceled"].includes(pred.status)) {
      pred = await pollPrediction(pred.urls.get);
    }
    if (pred.status !== "succeeded") throw new Error(`status=${pred.status} ${pred.error ?? ""}`);
    const outUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    await downloadTo(outUrl, dest);
    console.log(`  ok  ${person.file}  (${person.age}${person.gender} ${person.race})`);
    return { ...person, status: "ok" };
  } catch (err) {
    if (attempt < 3) {
      console.log(`  retry ${attempt + 1}/3 ${person.file} (${err.message})`);
      return runPerson(person, attempt + 1);
    }
    console.log(`  FAILED ${person.file}: ${err.message}`);
    return { ...person, status: "failed", error: String(err.message) };
  }
}

// ---------------------------------------------------------------- main
async function main() {
  const people = buildPeople();

  if (DRY) {
    people.forEach((p) => console.log(`${p.file}  ${p.age}${p.gender} ${p.race} [${p.aspect}]\n  ${p.prompt}\n`));
    // spectrum summary
    const byAge = {}, byRace = {}, byGender = { f: 0, m: 0 };
    people.forEach((p) => {
      const band = p.age <= 15 ? "10-15" : p.age <= 19 ? "16-19" : p.age <= 35 ? "20-35" : p.age <= 50 ? "36-50" : p.age <= 65 ? "51-65" : "66-75";
      byAge[band] = (byAge[band] || 0) + 1;
      byRace[p.race] = (byRace[p.race] || 0) + 1;
      byGender[p.gender]++;
    });
    console.log(`Total: ${people.length}`);
    console.log("Age bands:", byAge);
    console.log("Gender:", byGender);
    console.log("Race:", byRace);
    return;
  }

  if (!TOKEN) {
    console.error("Missing REPLICATE_API_TOKEN (env or .env.local). Aborting.");
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Generating ${people.length} source portraits -> ${OUT_DIR}\n`);
  const results = [];
  const queue = [...people];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) results.push(await runPerson(queue.shift()));
  });
  await Promise.all(workers);

  results.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(path.join(OUT_DIR, "pool-manifest.json"), JSON.stringify(results, null, 2));

  const ok = results.filter((r) => r.status === "ok").length;
  console.log(`\nDone: ${ok}/${people.length} succeeded. pool-manifest.json written.`);
  if (ok < people.length) console.log("Re-run to fill the gaps -- existing files are skipped.");
}

main();
