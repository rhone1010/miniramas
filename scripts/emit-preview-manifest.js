/* scripts/emit-preview-manifest.js — 2026-08-02 · CUI V25
 *
 * Walks public/previews/effects/<id>/ and writes
 * public/previews/effects-manifest.json.
 *
 * WHY THIS EXISTS
 *   The filenames carry no rule. elizabethan starts at 2, victorian holds
 *   three women against one man, balloon_face puts the woman at 1 and the
 *   man at 2, and half the tree is an ungendered 1.jpg. Nothing can derive
 *   a path from an id, so the stage stops trying and reads this instead.
 *
 *   Run it whenever the art changes. It is generated; never hand-edit the
 *   json.
 *
 *   node scripts/emit-preview-manifest.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'public', 'previews', 'effects');
const OUT = path.join(ROOT, 'public', 'previews', 'effects-manifest.json');

if (!fs.existsSync(DIR)) {
  console.error('no such directory: ' + DIR);
  process.exit(1);
}

const IMG = /\.(jpe?g|png|webp)$/i;

/* The gender is a suffix on the stem, not a position. Anything without one
   serves both subjects. _male/_female were a duplicate spelling in
   renaissance and are read here so a stray one never silently disappears. */
function subjectOf(name) {
  const stem = name.replace(IMG, '');
  if (/_(man|male)$/i.test(stem)) return 'man';
  if (/_(woman|female)$/i.test(stem)) return 'woman';
  return 'neutral';
}

/* Lowest-numbered file wins where there are several of one subject, so the
   choice is stable across runs and obvious on disk. */
function rank(name) {
  const m = name.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 9999;
}

const out = {};
const notes = [];

fs.readdirSync(DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))
  .forEach((d) => {
    const files = fs
      .readdirSync(path.join(DIR, d.name))
      .filter((f) => IMG.test(f))
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

    if (!files.length) {
      notes.push(d.name + ' — folder is empty');
      return;
    }

    const pick = { man: null, woman: null, neutral: null };
    files.forEach((f) => {
      const s = subjectOf(f);
      if (!pick[s]) pick[s] = f;
    });

    out[d.name] = {
      man: pick.man,
      woman: pick.woman,
      neutral: pick.neutral,
      all: files,
    };

    if (pick.man && !pick.woman) notes.push(d.name + ' — man only');
    if (pick.woman && !pick.man) notes.push(d.name + ' — woman only');
  });

const json = {
  generatedAt: new Date().toISOString(),
  base: '/previews/effects/',
  effects: out,
};

fs.writeFileSync(OUT, JSON.stringify(json, null, 2) + '\n', 'utf8');

const ids = Object.keys(out);
const gendered = ids.filter((id) => out[id].man || out[id].woman);
console.log(
  'wrote ' + path.relative(ROOT, OUT) + ' — ' + ids.length + ' effects, ' +
  gendered.length + ' with a gendered plate'
);
notes.forEach((n) => console.log('  · ' + n));
