#!/usr/bin/env node
/**
 * generate-portrait-batch.mjs
 * Liten & Co — source portrait library generator
 *
 * Generates 60 photorealistic portrait photos via Replicate google/nano-banana-2:
 *   10 full body · 40 bust (head/torso/arms) · 5 blurry · 5 head-turned
 *   Ages 8–80, mixed gender/ethnicity/setting.
 *
 * Run from the repo root (reads REPLICATE_API_TOKEN from .env.local or env):
 *   PS D:\minramas> node scripts\generate-portrait-batch.mjs
 *
 * Dry run (print the 60 prompts, no API calls):
 *   PS D:\minramas> node scripts\generate-portrait-batch.mjs --dry
 *
 * Output: .\portrait-batch\NN_kind_gAGE.png  +  manifest.json
 */

import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const OUT_DIR = path.join(process.cwd(), "portrait-batch");
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

// ---------------------------------------------------------------- shot list
const ETHNICITIES = [
  "East Asian", "Black", "Latino", "South Asian",
  "white", "Middle Eastern", "Southeast Asian", "mixed-heritage",
];

const SETTINGS = [
  "in front of a plain warm grey studio backdrop, soft window light",
  "on a tree-lined neighborhood sidewalk, late afternoon sun",
  "in a sunlit park with soft green bokeh behind them",
  "in a bright home living room, natural window light",
  "at a beach during golden hour, warm backlight",
  "against a textured brick wall, overcast even light",
  "in a tidy modern kitchen, morning light",
  "in a garden with out-of-focus flowers behind them",
];

const ADULT_DESC = ["strikingly attractive", "naturally attractive and photogenic", "very photogenic with warm features"];
const MINOR_DESC = ["bright-eyed and photogenic", "cheerful and photogenic", "friendly with a natural smile"];

const STYLE =
  "Photorealistic photograph, full-frame DSLR look, true-to-life skin texture, natural color, " +
  "authentic everyday photo as if from a family photo library, no illustration, no CGI, no retouching artifacts";

function spread(count, min, max) {
  return Array.from({ length: count }, (_, i) =>
    Math.round(min + (i * (max - min)) / (count - 1))
  );
}

function noun(age, gender) {
  if (age < 13) return gender === "f" ? "girl" : "boy";
  if (age < 18) return gender === "f" ? "teenage girl" : "teenage boy";
  return gender === "f" ? "woman" : "man";
}

function buildShots() {
  const shots = [];
  const add = (kind, ages) =>
    ages.forEach((age, i) => shots.push({ kind, age, i }));

  add("fullbody", spread(10, 8, 80));
  add("bust", spread(40, 8, 80));
  add("blurry", [12, 28, 44, 60, 76]);
  add("turned", [10, 25, 41, 57, 73]);

  return shots.map((s, idx) => {
    const gender = idx % 2 === 0 ? "f" : "m";
    let eth = ETHNICITIES[idx % ETHNICITIES.length];
    if (eth === "Latino" && gender === "f") eth = "Latina";
    const setting = SETTINGS[(idx * 3) % SETTINGS.length];
    const minor = s.age < 18;
    const descPool = minor ? MINOR_DESC : ADULT_DESC;
    const desc = descPool[idx % descPool.length];
    const subject = `a ${desc} ${s.age}-year-old ${eth} ${noun(s.age, gender)}`;

    let framing, aspect;
    switch (s.kind) {
      case "fullbody":
        framing =
          "full-body photograph, entire person visible from head to toe, standing naturally, " +
          "shot with a 50mm lens from a slight distance";
        aspect = "2:3";
        break;
      case "bust":
        framing =
          "bust portrait framed from the waist up — head, shoulders, torso and arms visible, " +
          "subject facing the camera, 85mm portrait lens, shallow depth of field";
        aspect = "3:4";
        break;
      case "blurry":
        framing =
          "bust portrait framed from the chest up, candid handheld phone snapshot, " +
          "slightly out of focus with mild motion blur, imperfect amateur framing";
        aspect = "3:4";
        break;
      case "turned":
        framing =
          "bust portrait framed from the chest up, head turned to the side in a " +
          "three-quarter profile view, looking away from the camera, 85mm lens";
        aspect = "3:4";
        break;
    }

    const prompt = `${STYLE}. ${framing}. Subject: ${subject}, ${setting}. ` +
      `Relaxed natural pose, casual everyday clothing appropriate to their age.`;

    const file = `${String(idx + 1).padStart(2, "0")}_${s.kind}_${gender}${s.age}.png`;
    return { idx: idx + 1, kind: s.kind, age: s.age, gender, file, aspect, prompt };
  });
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
    shots.forEach((s) =>
      console.log(`${s.file}  [${s.aspect}]\n  ${s.prompt}\n`)
    );
    console.log(`Total: ${shots.length} shots`);
    return;
  }

  if (!TOKEN) {
    console.error("Missing REPLICATE_API_TOKEN (env or .env.local). Aborting.");
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Generating ${shots.length} portraits → ${OUT_DIR}\n`);
  const results = [];
  const queue = [...shots];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const shot = queue.shift();
      results.push(await runShot(shot));
    }
  });
  await Promise.all(workers);

  results.sort((a, b) => a.idx - b.idx);
  fs.writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(results, null, 2)
  );

  const ok = results.filter((r) => r.status === "ok").length;
  console.log(`\nDone: ${ok}/${shots.length} succeeded. Manifest written.`);
  if (ok < shots.length) {
    console.log("Failed shots are flagged in manifest.json — re-run picks them up manually.");
  }
}

main();
