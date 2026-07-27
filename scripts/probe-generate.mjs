#!/usr/bin/env node
/**
 * probe-generate.mjs -- fire ONE render, print the real response shape.
 * Run: node scripts\probe-generate.mjs
 */
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SRC_DIR = path.join(process.cwd(), "source-pool-multiface");

const file = fs.readdirSync(SRC_DIR).filter((f) => /^m\d+.*\.png$/i.test(f)).sort()[0];
if (!file) { console.error("no source in " + SRC_DIR); process.exit(1); }
const b64 = fs.readFileSync(path.join(SRC_DIR, file)).toString("base64");
console.log(`probing with ${file} (bronze)…`);

const res = await fetch(`${BASE_URL}/api/v1/portraits/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ source_image_b64: b64, style_id: "realistic", preset_id: "bronze", scale: "close_up", skip_redirect: true }),
});

console.log("HTTP", res.status);
const text = await res.text();
let data;
try { data = JSON.parse(text); } catch { console.log("RAW (not JSON):", text.slice(0, 800)); process.exit(0); }

// Show top-level keys, and result keys, without dumping the giant base64.
function shape(obj, depth = 0) {
  if (obj === null || typeof obj !== "object") return typeof obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out[k] = v.length > 120 ? `<string ${v.length} chars>` : v;
    else if (Array.isArray(v)) out[k] = `<array ${v.length}>`;
    else if (typeof v === "object" && v && depth < 2) out[k] = shape(v, depth + 1);
    else out[k] = typeof v;
  }
  return out;
}
console.log("RESPONSE SHAPE:");
console.log(JSON.stringify(shape(data), null, 2));
