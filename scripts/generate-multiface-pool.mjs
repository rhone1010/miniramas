#!/usr/bin/env node
/**
 * generate-multiface-pool.mjs
 * Liten & Co -- 2-3 person source portraits for the MULTI-FACE validation run.
 *
 * Fork of generate-source-pool.mjs. Same NB2 text-to-image call, same poll /
 * concurrency / retry. The ONLY differences:
 *   - each source is a GROUP of 2 or 3 people (not one person)
 *   - a composition matrix covers the age/count spread you asked for
 *     (3 adults, 3 teens, child+2 adults, 2 kids+1 adult, couples, seniors,
 *      multigenerational, adult+toddler, etc.), half professional / half candid
 *   - the manifest records people_count + composition per source, so the bench
 *     can roll up fidelity-pass rate BY HEAD-COUNT x effect -- the go/no-go data.
 *
 * Run from repo root (reads REPLICATE_API_TOKEN from .env.local or env):
 *   PS D:\minramas> node scripts\generate-multiface-pool.mjs --dry   # preview prompts
 *   PS D:\minramas> node scripts\generate-multiface-pool.mjs         # full run (20)
 *   PS D:\minramas> node scripts\generate-multiface-pool.mjs --n 4   # pilot (first 4)
 *
 * Output: .\source-pool-multiface\m01..m20.png  +  multiface-manifest.json
 * All content wholesome family-and-friends photography, clothed, faces clear.
 */

import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const nArg = process.argv.indexOf("--n");
const LIMIT = nArg > -1 ? parseInt(process.argv[nArg + 1], 10) : 0;
const OUT_DIR = path.join(process.cwd(), "source-pool-multiface");
const MODEL_URL = "https://api.replicate.com/v1/models/google/nano-banana-2/predictions";
const CONCURRENCY = 3;

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

// ---------------------------------------------------------------- demographics
const RACE_POOL = [
  "white","white","white","Latino","Black","white","Latino","East Asian",
  "white","Black","South Asian","white","Latino","mixed-heritage","white",
  "Middle Eastern","Southeast Asian","Black","white","Latino",
]; // US-weighted-ish, pre-scattered; cycled with a stride so neighbours differ
let raceCursor = 0;
function pickRace(gender) {
  const r = RACE_POOL[(raceCursor += 7) % RACE_POOL.length];
  return r === "Latino" && gender === "f" ? "Latina" : r;
}
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function ageForRole(role) {
  switch (role) {
    case "young":   return R(22, 32);
    case "middle":  return R(38, 52);
    case "adult":   return R(24, 52);
    case "senior":  return R(62, 74);
    case "teen":    return R(13, 19);
    case "child":   return R(6, 11);
    case "child2":  return R(6, 11);   // second child -- forced different below
    case "toddler": return R(2, 4);
    case "baby":    return 1;
    default:        return R(24, 52);
  }
}
function noun(age, gender) {
  if (age <= 1) return "baby";
  if (age < 5)  return gender === "f" ? "toddler girl" : "toddler boy";
  if (age < 13) return gender === "f" ? "girl" : "boy";
  if (age < 18) return gender === "f" ? "teenage girl" : "teenage boy";
  if (age >= 62) return gender === "f" ? "older woman" : "older man";
  return gender === "f" ? "woman" : "man";
}

// ---------------------------------------------------------------- composition matrix (20)
// roles are age-bands; style is professional|candid; people_count derives from roles.length
const COMPOSITIONS = [
  { id: "m01_3adults_pro",         style: "professional", roles: ["adult","adult","adult"] },
  { id: "m02_3adults_candid",      style: "candid",       roles: ["adult","adult","adult"] },
  { id: "m03_3teens_candid",       style: "candid",       roles: ["teen","teen","teen"] },
  { id: "m04_3teens_pro",          style: "professional", roles: ["teen","teen","teen"] },
  { id: "m05_child_2adults_candid",style: "candid",       roles: ["child","adult","adult"] },
  { id: "m06_child_2adults_pro",   style: "professional", roles: ["child","adult","adult"] },
  { id: "m07_2kids_1adult_candid", style: "candid",       roles: ["child","child2","adult"] },
  { id: "m08_2kids_1adult_pro",    style: "professional", roles: ["toddler","child","adult"] },
  { id: "m09_couple_pro",          style: "professional", roles: ["adult","adult"] },
  { id: "m10_2adults_candid",      style: "candid",       roles: ["adult","adult"] },
  { id: "m11_2teens_candid",       style: "candid",       roles: ["teen","teen"] },
  { id: "m12_adult_teen_candid",   style: "candid",       roles: ["adult","teen"] },
  { id: "m13_adult_child_pro",     style: "professional", roles: ["adult","child"] },
  { id: "m14_adult_toddler_candid",style: "candid",       roles: ["adult","toddler"] },
  { id: "m15_3adults_mixedage_pro",style: "professional", roles: ["young","middle","senior"] },
  { id: "m16_2adults_senior_candid",style: "candid",      roles: ["adult","adult","senior"] },
  { id: "m17_teen_2adults_candid", style: "candid",       roles: ["teen","adult","adult"] },
  { id: "m18_2seniors_pro",        style: "professional", roles: ["senior","senior"] },
  { id: "m19_3gen_candid",         style: "candid",       roles: ["senior","adult","child"] },
  { id: "m20_2adults_baby_pro",    style: "professional", roles: ["adult","adult","baby"] },
];

const BACKDROPS = [
  { backdrop: "a smooth seamless studio backdrop with a soft charcoal-to-black radial gradient",
    light: "classic studio key light with a subtle rim light separating the subjects from the backdrop" },
  { backdrop: "a pure matte black studio backdrop, completely clean and featureless",
    light: "crisp butterfly lighting with a large softbox key and gentle fill, gallery-portrait quality" },
];
const CANDID_SETTINGS = [
  "at a kitchen table at home", "in a sunny park", "on a cafe patio",
  "in a cozy living room", "in a leafy backyard", "by a bright window at home",
];

const STYLE_PRO =
  "Professional photography studio portrait, medium-format camera quality, tack-sharp focus, " +
  "true-to-life skin texture, clean color, no environmental clutter, no props";
const STYLE_CANDID =
  "Candid natural-light photograph, authentic and unposed, warm and true-to-life, " +
  "sharp focus on faces, ordinary everyday moment";
const GROUP_FRAMING =
  "framed from roughly the waist up with everyone together in one shot; every person's face is " +
  "large, fully visible, unobstructed and tack sharp; natural well-formed hands where visible";

function subjectPhrase(people) {
  const parts = people.map((p) => {
    const raceWord = p.race;
    return `a ${p.age}-year-old ${raceWord} ${noun(p.age, p.gender)}`;
  });
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function buildGroups() {
  const groups = [];
  COMPOSITIONS.forEach((c, gi) => {
    const seenChildAges = new Set();
    const people = c.roles.map((role, pi) => {
      const gender = (gi + pi) % 2 === 0 ? "f" : "m";
      let age = ageForRole(role);
      if ((role === "child" || role === "child2") ) {
        // force the two kids to be visibly different ages
        while (seenChildAges.has(age)) age = ageForRole(role);
        seenChildAges.add(age);
      }
      return { role, age, gender, race: pickRace(gender) };
    });

    const subj = subjectPhrase(people);
    let prompt;
    if (c.style === "professional") {
      const b = BACKDROPS[gi % BACKDROPS.length];
      prompt =
        `${STYLE_PRO}. A professional group portrait of ${subj}, standing close together, ` +
        `shoulders slightly overlapping, warm natural expressions. ${GROUP_FRAMING}. ` +
        `Backdrop: ${b.backdrop}. Lighting: ${b.light}. Fully clothed, wholesome, ` +
        `a premium studio group session that looks like a real deliverable.`;
    } else {
      const setting = CANDID_SETTINGS[gi % CANDID_SETTINGS.length];
      prompt =
        `${STYLE_CANDID}. A candid photo of ${subj} together ${setting}, gathered naturally, ` +
        `relaxed and happy. ${GROUP_FRAMING}. Warm natural daylight. Fully clothed, wholesome, ` +
        `an authentic family-and-friends snapshot full of personality.`;
    }

    groups.push({
      id: c.id, file: `${c.id}.png`, composition: c.id, style: c.style,
      people_count: people.length, people, prompt, aspect: "3:4",
    });
  });
  return LIMIT > 0 ? groups.slice(0, LIMIT) : groups;
}

// ---------------------------------------------------------------- replicate (unchanged)
async function createPrediction(g) {
  const res = await fetch(MODEL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Prefer: "wait=60" },
    body: JSON.stringify({ input: { prompt: g.prompt, aspect_ratio: g.aspect, output_format: "png" } }),
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
async function runGroup(g, attempt = 1) {
  const dest = path.join(OUT_DIR, g.file);
  if (fs.existsSync(dest)) { console.log(`  skip ${g.file} (exists)`); return { ...g, status: "ok" }; }
  try {
    let pred = await createPrediction(g);
    if (!["succeeded", "failed", "canceled"].includes(pred.status)) pred = await pollPrediction(pred.urls.get);
    if (pred.status !== "succeeded") throw new Error(`status=${pred.status} ${pred.error ?? ""}`);
    const outUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    await downloadTo(outUrl, dest);
    console.log(`  ok  ${g.file}  (${g.people_count}p, ${g.style})`);
    return { ...g, status: "ok" };
  } catch (err) {
    if (attempt < 3) { console.log(`  retry ${attempt + 1}/3 ${g.file} (${err.message})`); return runGroup(g, attempt + 1); }
    console.log(`  FAILED ${g.file}: ${err.message}`);
    return { ...g, status: "failed", error: String(err.message) };
  }
}

// ---------------------------------------------------------------- main
async function main() {
  const groups = buildGroups();
  if (DRY) {
    groups.forEach((g) => console.log(`${g.file}  [${g.people_count}p ${g.style}]\n  ${g.prompt}\n`));
    const byCount = {}, byStyle = {};
    groups.forEach((g) => { byCount[g.people_count] = (byCount[g.people_count]||0)+1; byStyle[g.style]=(byStyle[g.style]||0)+1; });
    console.log(`Total: ${groups.length}`, "| by people_count:", byCount, "| by style:", byStyle);
    return;
  }
  if (!TOKEN) { console.error("Missing REPLICATE_API_TOKEN (env or .env.local). Aborting."); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Generating ${groups.length} multi-face sources -> ${OUT_DIR}\n`);
  const results = [];
  const queue = [...groups];
  const workers = Array.from({ length: CONCURRENCY }, async () => { while (queue.length) results.push(await runGroup(queue.shift())); });
  await Promise.all(workers);
  results.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(path.join(OUT_DIR, "multiface-manifest.json"), JSON.stringify(results, null, 2));
  const ok = results.filter((r) => r.status === "ok").length;
  console.log(`\nDone. ${ok}/${results.length} ok -> ${OUT_DIR}\\multiface-manifest.json`);
  console.log(`Point the bench at this folder; people_count is in the manifest for the head-count roll-up.`);
}
main();
