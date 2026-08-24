// upload-wallpaper-previews.mjs
// D:\minramas\scripts\upload-wallpaper-previews.mjs
//
// Uploads the burned-in watermarked previews to the Supabase wallpapers
// bucket, at studio/<section>/preview/<filename> - the paths the live
// registry already points at. Idempotent (upsert): safe to re-run.
//
// USAGE (from D:\minramas):
//   node scripts\upload-wallpaper-previews.mjs
//
// CREDENTIALS: reads .env.local (then .env) at the repo root for
//   NEXT_PUBLIC_SUPABASE_URL   (or SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY  (or SUPABASE_SERVICE_KEY)
// Nothing is sent anywhere except your own Supabase project.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ---- env ------------------------------------------------------------ */
function loadEnv() {
  const out = {};
  for (const f of ['.env.local', '.env']) {
    const p = join(repo, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in out)) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return out;
}
const env = { ...loadEnv(), ...process.env };
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

if (!URL_BASE || !KEY) {
  console.error('Missing Supabase credentials.');
  console.error('Looked for NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL and');
  console.error('SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY in .env.local / .env');
  process.exit(1);
}

/* ---- sources -------------------------------------------------------- */
const JOBS = [
  { local: join(repo, 'wallpaper-batch', 'general',   'preview'), remote: 'studio/general/preview' },
  { local: join(repo, 'wallpaper-batch', 'halloween', 'preview'), remote: 'studio/halloween/preview' },
];

async function put(remotePath, buf) {
  const r = await fetch(
    `${URL_BASE}/storage/v1/object/wallpapers/${remotePath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
      body: buf,
    }
  );
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`${r.status} ${t.slice(0, 200)}`);
  }
}

async function run() {
  let total = 0, done = 0, failed = [];
  for (const job of JOBS) {
    if (!existsSync(job.local)) {
      console.error(`MISSING FOLDER: ${job.local} - skipped`);
      continue;
    }
    const files = readdirSync(job.local).filter(f => /\.jpe?g$/i.test(f));
    total += files.length;
    console.log(`\n${job.remote}  <-  ${files.length} files from ${job.local}`);

    const queue = [...files];
    const workers = Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const f = queue.shift();
        try {
          await put(`${job.remote}/${f}`, readFileSync(join(job.local, f)));
          done++;
          if (done % 50 === 0) console.log(`  ${done} uploaded...`);
        } catch (e) {
          failed.push(`${job.remote}/${f}  -- ${e.message}`);
        }
      }
    });
    await Promise.all(workers);
  }

  console.log(`\nDone. ${done}/${total} uploaded, ${failed.length} failed.`);
  if (failed.length) {
    console.log('FAILED:');
    failed.slice(0, 30).forEach(f => console.log('  ' + f));
    if (failed.length > 30) console.log(`  ... and ${failed.length - 30} more`);
    process.exit(1);
  }
}

run();
