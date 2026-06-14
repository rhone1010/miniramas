#!/usr/bin/env node
/**
 * generate-preview-sources.mjs
 * Liten & Co — STUDIO-GRADE source photos for the baked preview library (engine item 11)
 *
 * 12 demographic bins (6 age bands × m/f) × 2 candidates = 24 images.
 * Pick the best candidate per bin, then run each through
 * /api/v1/portraits/generate with is_preview_bake:true →
 * previews/portraits/{preset}/{bin}.jpg
 *
 * Studio spec: crisp key + rim lighting, smooth gradient or pure black backdrop,
 * zero environmental clutter, Liten 3/4 framing (complete arms, both hands visible),
 * face large and tack sharp (clears Gate 1 at any strictness).
 *
 * Run from repo root (reads REPLICATE_API_TOKEN from .env.local or env):
 *   PS D:\minramas> node scripts\generate-preview-sources.mjs --dry   # preview prompts
 *   PS D:\minramas> node scripts\generate-preview-sources.mjs         # full run
 *
 * Output: .\preview-sources\{bin}_{a|b}.png  +  manifest.json
 */

import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const OUT_DIR = path.join(process.cwd(), "preview-sources");
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

// ---------------------------------------------------------------- bins
// Bin ids are designed to drop straight into previews/portraits/{preset}/{bin}.jpg
const BINS = [
  { bin: "f_child",  age: 8,  gender: "f" },
  { bin: "m_child",  age: 8,  gender: "m" },
  { bin: "f_teen",   age: 15, gender: "f" },
  { bin: "m_teen",   age: 15, gender: "m" },
  { bin: "f_young",  age: 25, gender: "f" },
  { bin: "m_young",  age: 25, gender: "m" },
  { bin: "f_adult",  age: 38, gender: "f" },
  { bin: "m_adult",  age: 38, gender: "m" },
  { bin: "f_mature", age: 55, gender: "f" },
  { bin: "m_mature", age: 55, gender: "m" },
  { bin: "f_senior", age: 72, gender: "f" },
  { bin: "m_senior", age: 72, gender: "m" },
];

// Candidate A and B differ in backdrop + lighting + ethnicity so each bin
// gets two genuinely different picks. Wardrobe stays simple and timeless —
// solid colors, clean silhouettes — so material presets read cleanly.
const CANDIDATES = [
  {
    tag: "a",
    backdrop: "a smooth seamless studio backdrop with a soft charcoal-to-black radial gradient",
    light: "classic studio key light with a subtle rim light separating the subject from the backdrop",
    eth: ["East Asian", "Black", "Latina", "white", "South Asian", "Middle Eastern",
          "mixed-heritage", "Southeast Asian", "white", "Black", "East Asian", "Latino"],
  },
  {
    tag: "b",
    backdrop: "a pure matte black studio backdrop, completely clean and featureless",
    light: "crisp butterfly lighting with a large softbox key and gentle fill, gallery-portrait quality",
    eth: ["white", "South Asian", "mixed-heritage", "Black", "Latina", "East Asian",
          "Middle Eastern", "white", "Southeast Asian", "Latino", "Black", "South Asian"],
  },
];

function noun(age, gender) {
  if (age < 13) return gender === "f" ? "girl" : "boy";
  if (age < 18) return gender === "f" ? "teenage girl" : "teenage boy";
  return gender === "f" ? "woman" : "man";
}

const STYLE =
  "Professional photography studio portrait, medium-format camera quality, tack-sharp focus, " +
  "true-to-life skin texture, clean color, no environmental clutter, no props";

// The Liten 3/4 — torso with COMPLETE arms and both hands fully visible.
// Never a shoulders-cut bust, never a limb terminated mid-forearm.
const FRAMING =
  "framed from the hips up in a three-quarter portrait: torso with complete arms and " +
  "BOTH hands fully visible in frame, hands relaxed and naturally posed (folded, resting, " +
  "or loosely clasped) with well-formed natural fingers; never crop or terminate an arm " +
  "mid-forearm; face large in the frame and tack sharp, subject facing the camera with a " +
  "warm natural expression";

function buildShots() {
  const shots = [];
  BINS.forEach((b, bi) => {
    CANDIDATES.forEach((c) => {
      const minor = b.age < 18;
      const desc = minor
        ? "bright-eyed and photogenic"
        : "strikingly attractive and photogenic";
      let eth = c.eth[bi];
      if (eth === "Latina" && b.gender === "m") eth = "Latino";
      if (eth === "Latino" && b.gender === "f") eth = "Latina";
      const subject = `a ${desc} ${b.age}-year-old ${eth} ${noun(b.age, b.gender)}`;
      const wardrobe = minor
        ? "wearing a simple solid-color top, neat and age-appropriate"
        : "wearing simple, timeless clothing in a solid color with a clean silhouette, no logos or busy patterns";

      const prompt =
        `${STYLE}. Subject: ${subject}, ${wardrobe}, ${FRAMING}. ` +
        `Backdrop: ${c.backdrop}. Lighting: ${c.light}. ` +
        `The image should look like a premium studio session deliverable.`;

      shots.push({
        bin: b.bin,
        candidate: c.tag,
        age: b.age,
        gender: b.gender,
        file: `${b.bin}_${c.tag}.png`,
        aspect: "3:4",
        prompt,
      });
    });
  });
  return shots;
}

// ---------------------------------------------------------------- replicate
async function createPrediction(shot) {
  const res = await fetch(MODEL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
    },
    body: JSON.stringify({
      input: {
        prompt: shot.prompt,
        aspect_ratio: shot.aspect,
        output_format: "png",
      },
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

async function runShot(shot, attempt = 1) {
  try {
    let pred = await createPrediction(shot);
    if (!["succeeded", "failed", "canceled"].includes(pred.status)) {
      pred = await pollPrediction(pred.urls.get);
    }
    if (pred.status !== "succeeded") {
      throw new Error(`status=${pred.status} ${pred.error ?? ""}`);
    }
    const outUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    await downloadTo(outUrl, path.join(OUT_DIR, shot.file));
    console.log(`  ✔ ${shot.file}`);
    return { ...shot, status: "ok" };
  } catch (err) {
    if (attempt < 3) {
      console.log(`  ↻ retry ${attempt + 1}/3 ${shot.file} (${err.message})`);
      return runShot(shot, attempt + 1);
    }
    console.log(`  ✖ FAILED ${shot.file}: ${err.message}`);
    return { ...shot, status: "failed", error: String(err.message) };
  }
}

// ---------------------------------------------------------------- main
async function main() {
  const shots = buildShots();

  if (DRY) {
    shots.forEach((s) => console.log(`${s.file}  [${s.aspect}]\n  ${s.prompt}\n`));
    console.log(`Total: ${shots.length} shots across ${BINS.length} bins`);
    return;
  }

  if (!TOKEN) {
    console.error("Missing REPLICATE_API_TOKEN (env or .env.local). Aborting.");
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Generating ${shots.length} studio sources → ${OUT_DIR}\n`);
  const results = [];
  const queue = [...shots];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const shot = queue.shift();
      results.push(await runShot(shot));
    }
  });
  await Promise.all(workers);

  results.sort((a, b) => a.file.localeCompare(b.file));
  fs.writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(results, null, 2)
  );

  const ok = results.filter((r) => r.status === "ok").length;
  console.log(`\nDone: ${ok}/${shots.length} succeeded. Manifest written.`);
  console.log("Next: pick the best candidate per bin, then bake via is_preview_bake.");
}

main();
