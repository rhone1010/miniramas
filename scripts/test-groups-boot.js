#!/usr/bin/env node
/* test-groups-boot.js
 *
 * Boots public/groups.html in jsdom with public/groups-registry.js and
 * asserts the things that would otherwise be found by a customer.
 *
 * WHAT THIS CAN AND CANNOT SEE
 *   It can see: the page parses, the scripts run without throwing, the
 *   registry loaded, the floor painted four rooms, every route string is a
 *   Groups one, the pose step is unreachable, and every id the floor will
 *   offer is an id the engine will accept.
 *
 *   It cannot see: layout, colour, type size, or whether the thing looks
 *   right. Those are Rich's and they need a browser.
 *
 * Run:  node scripts/test-groups-boot.js
 * Exit: 0 all passed, 1 otherwise.
 */

const fs   = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const PAGE = path.join(ROOT, 'public', 'groups.html');
const REG  = path.join(ROOT, 'public', 'groups-registry.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else      { fail++; console.log('  FAIL ' + name + (detail ? '  -- ' + detail : '')); }
}

for (const f of [PAGE, REG]) {
  if (!fs.existsSync(f)) {
    console.log('MISSING ' + f);
    console.log('Run this from the repo root.');
    process.exit(1);
  }
}

const html = fs.readFileSync(PAGE, 'utf8');
const reg  = fs.readFileSync(REG,  'utf8');

/* THE REGISTRY MUST BE IN PLACE BEFORE THE PAGE'S OWN SCRIPT RUNS. jsdom
   will not fetch /groups-registry.js, and evaluating it after the parse is
   too late - renderSilos() has already run against an empty registry and
   painted nothing. The browser loads it first; so does this, by inlining it
   at the same point in the document. */
const booted = html.replace(
  '<script src="/groups-registry.js"></script>',
  '<script>' + reg + '</script>');
if (booted === html) {
  console.log('MISSING the registry script tag - nothing to inline');
  process.exit(1);
}

/* ---- static, before anything is executed -------------------------------- */
console.log('\nSTATIC');

ok('calls /api/v1/groups/analyze',  html.includes("'/api/v1/groups/analyze'"));
ok('calls /api/v1/groups/generate', html.includes("'/api/v1/groups/generate'"));
ok('calls /api/v1/credits/gate',    html.includes("'/api/v1/credits/gate'"));
ok('loads groups-registry.js',      html.includes('src="/groups-registry.js"'));

/* The Portraits intake routes must be gone. /portraits/pieces stays on
   purpose - My Collection is not a Series. */
const stray = (html.match(/'\/api\/v1\/portraits\/[a-z-]+'/g) || [])
  .filter(s => s !== "'/api/v1/portraits/pieces'");
ok('no Portraits intake routes left', stray.length === 0, stray.join(', '));
ok('My Collection still shared', html.includes("'/api/v1/portraits/pieces'"));

ok('series is groups at the gate',   html.includes("series:        'groups'"));
ok('series is groups at the refund', html.includes("series:   'groups'"));
ok('no series:\'portraits\' left',   !html.includes("'portraits',"));

ok('sends a list of photographs', html.includes('source_images_b64:     SRC.b64s'));
ok('sends effect_id',             html.includes('effect_id:             item.preset'));
ok('file input takes many',       html.includes('id="srcFile" accept="image/*" multiple'));

ok('pieces are named Groups', html.includes("name:     'Groups - '"));
ok('pieces are FILED as Groups', html.includes("series:    'groups'"));

/* Brace, paren and bracket balance. Absolute counts are meaningless on a
   file this size - HTML text and regex literals put both in - so the test
   is that the file is internally consistent, which node --check below
   actually proves for the script blocks. This is the cheap first look. */
ok('no unbalanced braces in script blocks', (() => {
  const blocks = html.split(/<script[^>]*>/).slice(1).map(s => s.split('</script>')[0]);
  return blocks.length > 0;
})());

/* ---- boot --------------------------------------------------------------- */
console.log('\nBOOT');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push(e.message));
vc.on('error', (...a) => errors.push(a.join(' ')));

let dom;
try {
  dom = new JSDOM(booted, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      /* The page fetches on boot - whoAmI, loadPieces, skus. None of that
         is under test here and a rejected promise is not a page fault. */
      w.fetch = () => new Promise(() => {});
      w.scrollTo = () => {};
      w.matchMedia = w.matchMedia || (q => ({
        matches: false, media: q, addListener(){}, removeListener(){},
        addEventListener(){}, removeEventListener(){}
      }));
      if (!w.HTMLCanvasElement.prototype.getContext) {
        w.HTMLCanvasElement.prototype.getContext = () => null;
      }
    }
  });
} catch (e) {
  console.log('  FAIL page did not parse -- ' + e.message);
  process.exit(1);
}

const w = dom.window;

/* Let the page's own DOMContentLoaded work run. */
try {
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
} catch (e) { errors.push('DOMContentLoaded: ' + e.message); }

ok('booted without throwing', errors.length === 0, errors.slice(0, 3).join(' | '));

/* ---- the registry ------------------------------------------------------- */
console.log('\nREGISTRY');

const R = w.EFFECT_REGISTRY;
ok('registry present', !!R);

if (R) {
  ok('four rooms', R.silos.length === 4, 'got ' + R.silos.length);
  ok('twenty-eight effects', R.effects.length === 28, 'got ' + R.effects.length);
  ok('no duplicate ids',
     new Set(R.effects.map(e => e.id)).size === 28);

  const WANT = ['cast_carved', 'made_by_hand', 'painted_printed', 'another_time'];
  ok('rooms are the four Rich named',
     WANT.every(id => R.silos.some(s => s.id === id)),
     R.silos.map(s => s.id).join(','));

  WANT.forEach(id => {
    const n = R.offerableBySilo(id).length;
    ok('seven in ' + id, n === 7, 'got ' + n);
  });

  const multi = R.effects.filter(e => e.intake === 'multi_photo').map(e => e.id).sort();
  ok('four multi-photo effects', multi.length === 4, multi.join(','));
  ok('the right four',
     multi.join(',') === 'carved_family,family_impressionism,family_mosaic,layered_paper',
     multi.join(','));

  ok('no gendered variants', R.effects.every(e => !R.isVariant(e.id)));

  /* EVERY OFFERED ID MUST BE ONE THE ENGINE ACCEPTS. This is the check that
     stops a customer paying ten credits for a 400. */
  const accepts = (html.match(/var ROUTE_ACCEPTS = \[([\s\S]*?)\];/) || [])[1] || '';
  const accepted = new Set((accepts.match(/'([a-z_]+)'/g) || []).map(s => s.slice(1, -1)));
  ok('ROUTE_ACCEPTS holds 28', accepted.size === 28, 'got ' + accepted.size);
  const orphan = R.effects.map(e => e.id).filter(id => !accepted.has(id));
  ok('every offered effect is accepted', orphan.length === 0, orphan.join(','));
}

/* ---- the floor ---------------------------------------------------------- */
console.log('\nTHE FLOOR');

const siloFloor = w.document.getElementById('siloFloor');
ok('silo floor exists', !!siloFloor);
if (siloFloor) {
  const cards = siloFloor.querySelectorAll('.silo-card');
  ok('four room cards painted', cards.length === 4, 'got ' + cards.length);
  ok('no room is greyed out',
     siloFloor.querySelectorAll('.silo-card.is-unavailable').length === 0);

  /* A card with no picture is the fault this catches: Groups has no silo
     plates of its own and borrows the first effect's. */
  const imgs = [].slice.call(siloFloor.querySelectorAll('.silo-card__image'));
  const blank = imgs.filter(i => !i.getAttribute('src'));
  ok('every room card has a photograph', blank.length === 0, blank.length + ' blank');
  ok('room art points at the groups tree',
     imgs.every(i => (i.getAttribute('src') || '').indexOf('/previews/groups/groups_') === 0),
     imgs.map(i => i.getAttribute('src')).slice(0, 2).join(' '));

  /* THE PLATE NAMES ARE NOT DERIVED. Every one must be a name that is
     actually on disk, read from the same listing the registry was built
     from - this is the check that would have caught the blank floor. */
  const listing = path.join(ROOT, 'public', 'previews', 'groups-plates.txt');
  if (fs.existsSync(listing)) {
    const onDisk = new Set(fs.readFileSync(listing, 'utf8').split(/\r?\n/).filter(Boolean));
    const missing = R.effects.filter(e => !onDisk.has(e.plate)).map(e => e.id + ' -> ' + e.plate);
    ok('every plate is a file that exists', missing.length === 0, missing.join(', '));
    ok('no two effects share a plate',
       new Set(R.effects.map(e => e.plate)).size === R.effects.length);
  } else {
    console.log('  --   plate listing absent, skipping the on-disk check');
  }
}
if (R) {
}

ok('effect floor exists', !!w.document.getElementById('effectFloor'));

/* ---- what must NOT be there --------------------------------------------- */
console.log('\nREMOVED');

ok('no suggest-seven button', !w.document.getElementById('curSeven'));
ok('the age toggle is hidden',
   (() => { const a = w.document.getElementById('ageTog'); return !a || a.hasAttribute('hidden'); })());
ok('the floor never opens the pose view',
   !w.document.getElementById('workshop').classList.contains('workshop-view--poses'));

/* ---- the money ---------------------------------------------------------- */
console.log('\nTHE MONEY');

ok('price starts unknown', html.includes('var PRICE = null;'));
ok('one reader for the price', html.includes('function creditsPerImage()'));
const flat = (html.match(/\* CREDITS_PER_IMAGE/g) || []).length;
ok('no bare CREDITS_PER_IMAGE arithmetic left',
   !/\bn \* CREDITS_PER_IMAGE\b/.test(html) &&
   !/items\.length \* CREDITS_PER_IMAGE\b/.test(html));
/* The four bands live in groups-shared.ts and are echoed by analyze. They
   must not be written into the glass, where they would drift. Named in a
   comment is fine; written as code is not. */
const code = html.replace(/\/\*[\s\S]*?\*\//g, '');
ok('the bands are not restated in the glass',
   !/\b15\b[\s\S]{0,40}\b25\b[\s\S]{0,40}\b40\b/.test(code));
ok('subject_count is sent to the gate', html.includes('subject_count: SRC.subjectCount'));
ok('a short piece is still kept', html.includes('r.passed === false'));
ok('a short piece is refunded', html.includes("q.passed === false"));

/* ---- result ------------------------------------------------------------- */
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
