#!/usr/bin/env node
/**
 * test-targeting.mjs  ·  SUBJECT-PICK targeting validation
 *
 * Question this answers: does the engine honor the subject pick? i.e. when the
 * focal crop targets ONE face in a multi-person source, does the render come
 * back as THAT person — not the auto-picked hero?
 *
 * Mechanism (confirmed in the generate route): focal {x,y,zoom} server-crops the
 * source to a 3:4 region around (x,y) BEFORE render + QA. So targeting = cropping
 * to that face. This test sends three positional crops (left / center / right) of
 * a 3-person source and you eyeball whether each render is the expected person.
 *
 * This is SOLO rendering of ONE targeted person (not multi-output) — it validates
 * the picker→engine link the S1 subject picker depends on. Run it BEFORE wiring
 * the picker UI, so a later end-to-end test can trust the engine half.
 *
 * NOTE: subject_mode is NOT sent here — cropping to one face yields a one-person
 * source, so the normal solo path renders it. skip_redirect IS sent because the
 * uncropped source has multiple faces and would trip Gate 0.
 *
 * Prereqs: npm run dev ; a 3-person source in source-pool-multiface/.
 *
 * Run:
 *   node scripts\test-targeting.mjs                          # first source, bronze
 *   node scripts\test-targeting.mjs --source m01_3adults_pro
 *   node scripts\test-targeting.mjs --effect walnut --zoom 2.0
 *
 * Output: multiface-pilot-out\<source>__target-<pos>__<effect>.png (left/center/right)
 */

import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i > -1 ? argv[i + 1] : d; };

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const GEN_URL = `${BASE_URL}/api/v1/portraits/generate`;
const SRC_DIR = path.join(process.cwd(), "source-pool-multiface");
const OUT_DIR = path.join(process.cwd(), "multiface-pilot-out");

const EFFECT = arg("--effect", "bronze");
const ZOOM = Number(arg("--zoom", "1.8"));       // 1.8 ≈ isolates one of three
const SOURCE = arg("--source", null);

// Three horizontal targets across a left/center/right group. y=0.42 because faces
// sit in the upper-middle of a standing/seated portrait. subjectId is a label only
// (the route logs it; the crop geometry comes from x/y/zoom).
const TARGETS = [
  { pos: "left",   x: 0.25, y: 0.42, subjectId: "subj_left" },
  { pos: "center", x: 0.50, y: 0.42, subjectId: "subj_center" },
  { pos: "right",  x: 0.75, y: 0.42, subjectId: "subj_right" },
];

function pickSource() {
  if (!fs.existsSync(SRC_DIR)) { console.error(`Missing ${SRC_DIR}.`); process.exit(1); }
  const files = fs.readdirSync(SRC_DIR).filter((f) => /^m\d+.*\.png$/i.test(f)).sort();
  if (SOURCE) {
    const hit = files.find((f) => f.replace(/\.png$/i, "") === SOURCE || f === SOURCE);
    if (!hit) { console.error(`Source ${SOURCE} not found in ${SRC_DIR}.`); process.exit(1); }
    return hit;
  }
  if (!files.length) { console.error("no sources found."); process.exit(1); }
  return files[0];
}

async function render(b64, target) {
  const res = await fetch(GEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_image_b64: b64,
      style_id: "realistic",
      preset_id: EFFECT,
      scale: "close_up",
      framing: "signature",
      skip_redirect: true,                                   // bypass Gate 0 (source has multiple faces)
      focal: { x: target.x, y: target.y, zoom: ZOOM, subjectId: target.subjectId },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const result = data.result || data;
  if (result?.status === "redirected") throw new Error("redirected — skip_redirect not honored");
  if (!result?.image_b64) throw new Error(result?.fatal_error || "no image_b64");
  return result.image_b64;
}

async function main() {
  const file = pickSource();
  const b64 = fs.readFileSync(path.join(SRC_DIR, file)).toString("base64");
  const id = file.replace(/\.png$/i, "");
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Targeting test on ${file}  ·  effect=${EFFECT}  zoom=${ZOOM}`);
  console.log(`Crop targets: left(x=0.25) / center(x=0.50) / right(x=0.75)\n`);

  for (const t of TARGETS) {
    const out = `${id}__target-${t.pos}__${EFFECT}.png`;
    const dest = path.join(OUT_DIR, out);
    try {
      const img = await render(b64, t);
      fs.writeFileSync(dest, Buffer.from(img, "base64"));
      console.log(`  ok   ${out}  (crop centered x=${t.x})`);
    } catch (err) {
      console.log(`  FAIL ${out}: ${err.message}`);
    }
  }

  console.log(`\nEyeball: does target-left render the LEFT person, center the CENTER, right the RIGHT?`);
  console.log(`If position → correct person, the engine honors subject-pick targeting.`);
  console.log(`If all three render the same (hero) person, targeting is NOT honored — engine gap.`);
}

main();
