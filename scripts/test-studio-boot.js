/* scripts/test-studio-boot.js
 *
 *   node scripts/test-studio-boot.js public/wallpaper-studio-V001.html
 *
 * Boots the merged Studio page with the routes stubbed and asserts on the DOM
 * that results. Syntax checking catches none of the four faults that keep
 * breaking these pages; this catches three of them outright.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = path.join(process.cwd(),
  process.argv[2] || 'public/wallpaper-studio-V001.html');

let failures = 0;
function ok(label, cond, detail) {
  if (cond) { console.log('  PASS  ' + label); return; }
  failures++;
  console.log('  FAIL  ' + label + (detail ? '  \u2014 ' + detail : ''));
}

const IMAGES = [0, 1, 2, 3].map((n) => ({
  id: 'img' + n, url: 'https://example.test/' + n + '.jpg',
  preview: 'https://example.test/' + n + '-p.jpg',
  energy: 'flow', energy_label: 'Flow',
}));

function stubFetch(url, opt) {
  const u = String(url);
  const j = (body) => Promise.resolve({
    ok: true, status: 200, json: () => Promise.resolve(body),
  });
  if (u.indexOf('/api/v1/credits/balance') === 0) return j({ signed_in: true, balance: 42 });
  if (u.indexOf('/api/v1/wallpapers/studio/kept') === 0) return j({ kept: 2 });
  if (u.indexOf('/api/v1/wallpapers/studio/generate') === 0) {
    if (stubFetch.capped) return j({ ok: false, reason: 'capped' });
    return j({ ok: true, images: IMAGES });
  }
  if (u.indexOf('/api/v1/wallpapers/studio/keep') === 0) {
    return j({ ok: true, url: 'https://example.test/clean.jpg', kept: 3 });
  }
  return j({ ok: true });
}

(async function () {
  if (!fs.existsSync(FILE)) { console.error('MISSING: ' + FILE); process.exit(1); }
  const html = fs.readFileSync(FILE, 'utf8');

  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message));

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://litenco.com/wallpapers/studio',
    virtualConsole: vc,
    beforeParse(w) {
      w.fetch = stubFetch;
      // No WebGL in jsdom. The SDK is stubbed so the has-scene path can be
      // exercised - without it the scene silently never starts and the whole
      // reason for this merge goes untested.
      w.UnicornStudio = {
        addScene: () => Promise.resolve({ destroy() { w.__destroyed = true; } }),
      };
      w.matchMedia = (q) => ({
        matches: false, media: q,
        addEventListener() {}, removeEventListener() {},
        addListener() {}, removeListener() {},
      });
      w.scrollTo = () => {};
    },
  });

  const w = dom.window;
  const d = w.document;
  w.HTMLElement.prototype.scrollIntoView = function () {};

  await new Promise((r) => setTimeout(r, 80));

  console.log('\n' + path.basename(FILE) + ' \u00b7 boot\n');

  ok('no jsdom errors', errors.length === 0, errors.join(' | '));

  // ---- THE FAULT THAT KILLED A PAGE ONCE --------------------------------
  ok('no CSS inside a script block', !Array.prototype.some.call(
    d.querySelectorAll('script:not([src])'),
    (s) => /^\s*\.[a-zA-Z][\w-]*\s*\{/m.test(s.textContent)));

  // ---- SOURCE ORDER -----------------------------------------------------
  // .grid.has-scene .smoke-field and .grid.is-making .smoke-field are three
  // classes each. Whichever is declared LAST wins. Declared first, the
  // override loses silently and nothing on the glass changes.
  const css = Array.prototype.map.call(d.querySelectorAll('style'),
    (s) => s.textContent).join('\n');
  ok('has-scene override sits below the making rule',
    css.indexOf('.grid.has-scene .smoke-field') >
    css.indexOf('.grid.is-making .smoke-field'),
    'has-scene must come last');

  // ---- THE SHELL SURVIVED ----------------------------------------------
  ok('masthead kept', !!d.getElementById('mhSeriesBtn'));
  ok('credits pill kept', !!d.getElementById('mhCredits'));
  ok('viewer kept', !!d.getElementById('viewer'));
  ok('unlock kept', !!d.getElementById('unlock'));
  ok('results has an id now', !!d.getElementById('results'));
  ok('smoke filter is in the document', !!d.querySelector('filter#smoke'));
  ok('field layers present', !!d.getElementById('sceneField')
    && !!d.querySelector('.smoke-field'));

  // ---- THE ACCORDION ----------------------------------------------------
  const steps = d.querySelectorAll('#steps .step');
  ok('four steps drawn', steps.length === 4, 'got ' + steps.length);
  ok('only the first is open',
    d.querySelectorAll('#steps .step.is-open').length === 1
    && steps[0].classList.contains('is-open'));
  ok('the old fixed ids are gone',
    !d.getElementById('axWorld') && !d.getElementById('axPalette'));
  ok('go is disabled with nothing chosen', d.getElementById('go').disabled === true);
  ok('goSay counts what is left',
    /4 left/.test(d.getElementById('goSay').textContent));

  function pick(stepIdx, n) {
    const opts = d.querySelectorAll('#steps .step')[stepIdx]
      .querySelectorAll('.opt');
    opts[n || 0].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  }

  pick(0, 0);
  ok('choosing advances to step two',
    d.querySelectorAll('#steps .step')[1].classList.contains('is-open'));
  ok('the answer rides on the closed bar',
    !!d.querySelectorAll('#steps .step')[0].querySelector('.step-answer span'));

  // Toggle-to-clear, which the live page had and the merge must not lose.
  pick(0, 0);
  ok('an unreached step cannot be opened', (() => {
    const bars = d.querySelectorAll('#steps .step-bar');
    bars[3].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    return !d.querySelectorAll('#steps .step')[3].classList.contains('is-open');
  })());

  pick(0, 0); pick(1, 0); pick(2, 0); pick(3, 0);
  ok('go enables when all four are answered',
    d.getElementById('go').disabled === false);
  ok('goSay changes when ready',
    /Free to look at/.test(d.getElementById('goSay').textContent));

  // ---- THE ROUND --------------------------------------------------------
  d.getElementById('go').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));

  const grid = d.getElementById('grid');
  ok('four images landed', grid.querySelectorAll('.shot img').length === 4);
  ok('THE FIELD LAYERS SURVIVED THE ROUND',
    !!d.getElementById('sceneField') && !!grid.querySelector('.smoke-field'),
    'frames() wiped the grid');
  ok('the making state is over', !grid.classList.contains('is-making'));
  ok('remix is offered', d.getElementById('further').hidden === false);

  // ---- THE CAP WALL -----------------------------------------------------
  stubFetch.capped = true;
  d.getElementById('go').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  ok('the wall appears', !!d.querySelector('#grid .wall'));
  ok('THE FIELD LAYERS SURVIVED THE WALL',
    !!d.getElementById('sceneField') && !!d.querySelector('#grid .smoke-field'),
    'wall() wiped the grid');
  stubFetch.capped = false;

  console.log('\n' + (failures ? failures + ' FAILED' : 'all passed') + '\n');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error('harness threw:', e && e.message);
  process.exit(1);
});
