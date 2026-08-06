/* scripts/name-finish-images.js — 2026-08-04 · CUI V25
 *
 * Names the Print Shop's finish photographs.
 *
 * The exports come out of the design tool as
 * `printshop-images-_0000_Layer-3_0001_Layer-2.png`, which tells nobody
 * anything. The Print Shop wants one image per family, named after the
 * family, so the panel can ask for `canvas` and get the canvas.
 *
 * HOW TO USE IT
 *   1 · Look at the eleven files and decide which one belongs to each of the
 *       six families.
 *   2 * Fill in MAP below. Just the filename — the folder is assumed.
 *   3 · node scripts/name-finish-images.js
 *
 * It COPIES rather than moves, so the originals stay where they are and a
 * wrong guess costs nothing. Run it again after correcting MAP.
 *
 * Output: public/previews/finishes/<family>.jpg — converted to JPEG at 90,
 * because these are photographs and the PNGs are several megabytes each for
 * no gain.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');

/* Where the exports are. Change if they live somewhere else. */
const FROM = path.join(ROOT, 'public', 'previews');

/* Where the Print Shop will look. */
const TO = path.join(ROOT, 'public', 'previews', 'finishes');

/* ── FILL THIS IN ─────────────────────────────────────────────────────────
 *
 * The six families, in the order they appear in the shop. Put the export
 * filename against each one. Leave a family as null and it is skipped —
 * the panel simply shows no photograph for it, which is better than showing
 * the wrong one.
 *
 * From the eleven exports, reading them as described:
 *   · most are matted frames in different mouldings — one of them is the
 *     matted family, and the rest are the frame colours we are not selling
 *     yet
 *   · one is a canvas corner with the wrap visible → canvas
 *   · one is a canvas corner in a frame → framed_canvas
 *   · one is a paper curl → fine_art or premium
 */
const MAP = {
  fine_art:      'printshop-images-_0000_Layer-3_0010_Layer-11.png',
  premium:       'printshop-images-_0000_Layer-3_0010_Layer-11.png',
  canvas:        'printshop-images-_0000_Layer-3_0009_Layer-10.png',
  framed_canvas: 'printshop-images-_0000_Layer-3_0004_Layer-5.png',
  framed:        null,
  matted:        'printshop-images-_0000_Layer-3_0008_Layer-9.png',
};

/* Long edge. These sit at about 300px in the panel; 900 covers a retina
   screen with room and keeps each file under a hundred kilobytes. */
const LONG_EDGE = 900;

(async function main() {
  if (!fs.existsSync(TO)) fs.mkdirSync(TO, { recursive: true });

  const families = Object.keys(MAP);
  const missing = [];
  let done = 0;

  for (const family of families) {
    const file = MAP[family];
    if (!file) {
      missing.push(family);
      continue;
    }

    const src = path.isAbsolute(file) ? file : path.join(FROM, file);
    if (!fs.existsSync(src)) {
      console.log(`  ✗ ${family.padEnd(14)} not found: ${file}`);
      missing.push(family);
      continue;
    }

    const out = path.join(TO, family + '.jpg');
    const meta = await sharp(src).metadata();
    const long = Math.max(meta.width || 0, meta.height || 0);

    /* sharp takes resize(width, height, options) OR resize(options). The
       first cut passed two objects, which it reads as width-then-height and
       refuses. One options object, built here. */
    const resizeOpts = { kernel: 'lanczos3', withoutEnlargement: true };
    if (long > LONG_EDGE) {
      if ((meta.width || 0) >= (meta.height || 0)) resizeOpts.width = LONG_EDGE;
      else resizeOpts.height = LONG_EDGE;
    }

    await sharp(src)
      .resize(resizeOpts)
      // A transparent PNG on a dark background would matte to black. The
      // shop is vellum; flatten to something close to it.
      .flatten({ background: '#f1ece3' })
      .toColourspace('srgb')
      .jpeg({ quality: 90, mozjpeg: true })
      .toFile(out);

    const size = fs.statSync(out).size;
    console.log(
      `  ✓ ${family.padEnd(14)} ${path.basename(out)}  ` +
      `${(size / 1024).toFixed(0)}kb`
    );
    done++;
  }

  console.log(`\n${done} of ${families.length} named.`);
  if (missing.length) {
    console.log('Still to map: ' + missing.join(', '));
    console.log('Fill them into MAP at the top of this script and run it again.');
  }
  console.log('\nWhen they are all named:  python scripts\\build_s118_finish_images.py');
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
