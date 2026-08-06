#!/usr/bin/env node
// scripts/gen-pet-sources.js
//
// Generates the reference source photographs for the Pets species toggle —
// 25 images, five species × five variants. These are the SOURCES that every
// effect plate gets shot against, so the same twenty-five animals recur
// across the whole catalog and the previews stay consistent.
//
//   node scripts/gen-pet-sources.js            (all 25)
//   node scripts/gen-pet-sources.js dog cat    (just those species)
//
// Needs REPLICATE_API_TOKEN. Writes to lib/v1/pets/sources/<species>/.
// Filenames are <n>_<slug>.jpg so the species folder sorts predictably and
// the loader can key on the folder, exactly as style-refs does.

const fs   = require('fs');
const path = require('path');

const TOKEN = process.env.REPLICATE_API_TOKEN;
if (!TOKEN) { console.error('REPLICATE_API_TOKEN not set'); process.exit(1); }

const OUT = path.join(process.cwd(), 'lib', 'v1', 'pets', 'sources');

// Every prompt ends with "full body visible" — that is the gate the whole
// catalog depends on. Do not shorten these to head shots.
const SPECIES = {
  dog: [
    ['golden_retriever', 'Natural photograph of an adult golden retriever, warm golden coat, medium-long fur, friendly expressive face. Sitting outdoors in soft natural light, looking toward camera, full body visible.'],
    ['french_bulldog',   'Natural photograph of an adult French bulldog, compact muscular body, short brindle coat, large upright ears and broad expressive face. Standing in soft outdoor light, looking toward camera, full body visible.'],
    ['basset_hound',     'Natural photograph of an adult basset hound, long drooping ears, loose skin, short tricolor coat and soulful expression. Sitting naturally outdoors, full body visible.'],
    ['black_poodle',     'Natural photograph of an adult black standard poodle with dense curly coat, long legs and elegant proportions. Standing naturally in soft daylight, looking toward camera, full body visible.'],
    ['husky',            'Natural photograph of an adult Siberian husky, thick gray-and-white coat, pointed ears, pale blue eyes and athletic build. Standing outdoors in natural light, full body visible.'],
  ],
  cat: [
    ['orange_tabby', 'Natural photograph of an adult orange tabby cat with short striped fur, green eyes and average build. Sitting comfortably in soft natural light, looking toward camera, full body visible.'],
    ['black_cat',    'Natural photograph of an adult solid black short-haired cat with bright yellow-green eyes and sleek build. Standing naturally in soft daylight, full body visible.'],
    ['maine_coon',   'Natural photograph of a large adult Maine Coon with long shaggy brown tabby fur, prominent ear tufts and heavy ruff. Sitting naturally, looking toward camera, full body visible.'],
    ['siamese',      'Natural photograph of an adult Siamese cat with slender build, cream coat, dark face and ears, and vivid blue eyes. Standing naturally in soft daylight, full body visible.'],
    ['persian',      'Natural photograph of an adult Persian cat with long fluffy white-and-gray fur, round face and compact body. Sitting naturally in soft window light, full body visible.'],
  ],
  bird: [
    ['scarlet_macaw', 'Natural photograph of an adult scarlet macaw with brilliant red, yellow and blue plumage and long tail feathers. Perched naturally, body and tail fully visible, soft daylight.'],
    ['african_grey',  'Natural photograph of an adult African grey parrot with finely patterned gray feathers, pale face and red tail. Perched naturally in soft daylight, full body visible.'],
    ['cockatiel',     'Natural photograph of an adult cockatiel with gray body, yellow face, orange cheek patches and upright crest. Perched naturally, full body visible.'],
    ['cockatoo',      'Natural photograph of an adult white cockatoo with bright white plumage and raised yellow crest. Perched naturally in soft daylight, full body visible.'],
    ['budgerigar',    'Natural photograph of a small blue-and-green budgerigar with delicate patterned plumage. Perched naturally, looking toward camera, full body visible.'],
  ],
  reptile: [
    ['bearded_dragon',     'Natural photograph of an adult bearded dragon with sandy textured scales, broad triangular head and sturdy body. Resting naturally on a simple rock, full body and tail visible.'],
    ['leopard_gecko',      'Natural photograph of an adult leopard gecko with yellow spotted skin, large eyes and thick patterned tail. Standing naturally on a simple surface, full body visible.'],
    ['green_iguana',       'Natural photograph of an adult green iguana with vivid green scales, long tail, prominent dewlap and dorsal spines. Perched naturally, full body visible.'],
    ['chameleon',          'Natural photograph of an adult veiled chameleon with textured green skin, curled tail and distinctive casque. Perched naturally on a branch, full body visible.'],
    ['blue_tongued_skink', 'Natural photograph of an adult blue-tongued skink with broad body, smooth patterned scales, short legs and visible blue tongue. Standing naturally, full body visible.'],
  ],
  horse: [
    ['bay_thoroughbred', 'Natural photograph of an adult bay Thoroughbred with rich brown coat, black mane and long athletic legs. Standing naturally outdoors in soft daylight, full body visible.'],
    ['black_friesian',   'Natural photograph of an adult black Friesian horse with powerful build, flowing black mane and feathered lower legs. Standing naturally in soft daylight, full body visible.'],
    ['palomino',         'Natural photograph of an adult palomino horse with warm golden coat and long cream-white mane and tail. Standing naturally outdoors, full body visible.'],
    ['appaloosa',        'Natural photograph of an adult Appaloosa with distinctive spotted coat, muscular build and short mane. Standing naturally outdoors in soft daylight, full body visible.'],
    ['shetland_pony',    'Natural photograph of an adult Shetland pony with compact proportions, thick chestnut coat and shaggy mane. Standing naturally outdoors, looking toward camera, full body visible.'],
  ],
};

// Appended to every prompt. These are customer-photograph stand-ins, so they
// must look like something a person took, not like stock photography or a
// studio shoot — the effects are calibrated against ordinary snapshots.
const TAIL = ' Ordinary amateur photograph, plain uncluttered background, ' +
             'even daylight, sharp focus on the animal, no people, no text, no watermark.';

const want = process.argv.slice(2).filter(a => SPECIES[a]);
const list = want.length ? want : Object.keys(SPECIES);

async function nb2(prompt) {
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait' },
    body: JSON.stringify({
      version: 'google/nano-banana-2',
      input: { prompt, aspect_ratio: '1:1' },
    }),
  });
  const j = await res.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  let out = j.output;
  if (Array.isArray(out)) out = out[0];
  if (!out) throw new Error('no output: ' + JSON.stringify(j).slice(0, 200));
  const img = await fetch(out);
  return Buffer.from(await img.arrayBuffer());
}

(async () => {
  let ok = 0, fail = 0;
  for (const sp of list) {
    const dir = path.join(OUT, sp);
    fs.mkdirSync(dir, { recursive: true });
    console.log(`\n--- ${sp} ---`);

    for (let i = 0; i < SPECIES[sp].length; i++) {
      const [slug, prompt] = SPECIES[sp][i];
      const file = path.join(dir, `${i + 1}_${slug}.jpg`);

      if (fs.existsSync(file)) { console.log(`  ${slug.padEnd(20)} exists, skipped`); continue; }

      process.stdout.write(`  ${slug.padEnd(20)} ... `);
      try {
        fs.writeFileSync(file, await nb2(prompt + TAIL));
        console.log('ok');
        ok++;
      } catch (e) {
        console.log('FAILED — ' + e.message.slice(0, 100));
        fail++;
      }
    }
  }
  console.log(`\ndone — ${ok} written, ${fail} failed`);
  console.log('output: ' + path.relative(process.cwd(), OUT));
})();
