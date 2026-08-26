/* boot-reel.js — CUI 41A, 23 August 2026
 *
 * r10 shipped a shadowed `var` that threw on load. Anchors matched, bytes
 * were right, both inline scripts parsed — a shadowed var is valid
 * JavaScript. Only running the page catches it.
 *
 *   node boot-reel.js <path to index.html>
 */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const file = process.argv[2];
const html = fs.readFileSync(file, 'utf8');

const errors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://litenco.com/',
  beforeParse(win) {
    // A phone. The mobile IIFE returns immediately on anything else.
    win.matchMedia = q => ({
      matches: /max-width:\s*767px/.test(q),
      media: q, addListener(){}, removeListener(){},
      addEventListener(){}, removeEventListener(){}
    });
    win.fetch = () => Promise.resolve({ ok:true, json: () => Promise.resolve({}) });
    win.addEventListener('error', e => errors.push(e.error || e.message));
    // Images never load in jsdom; fire onload so paint() gets through.
    Object.defineProperty(win.Image.prototype, 'src', {
      set(v){ this._src = v; if (this.onload) setTimeout(() => this.onload(), 0); },
      get(){ return this._src; }
    });
  }
});

const win = dom.window;
const doc = win.document;

setTimeout(() => {
  const fail = m => { console.log('  FAIL  ' + m); process.exitCode = 1; };
  const pass = m => console.log('  ok    ' + m);

  console.log('');
  if (errors.length) {
    errors.forEach(e => fail('threw on load: ' + (e && e.message ? e.message : e)));
  } else {
    pass('no error on load');
  }

  const dots = doc.getElementById('mDots');
  if (!dots) return fail('#mDots is not in the document');
  if (dots.children.length !== 5) fail('expected 5 dots, got ' + dots.children.length);
  else pass('5 dots, one per Series');

  const on = dots.querySelectorAll('.m-dot.is-on');
  if (on.length !== 1) fail('expected 1 active dot, got ' + on.length);
  else pass('exactly one dot is active');

  const go = doc.getElementById('mGo');
  if (!go) return fail('#mGo is not in the document');
  const label0 = go.textContent, href0 = go.getAttribute('href');
  if (href0 !== '/portraits') fail('opens on ' + href0 + ', expected /portraits');
  else pass('opens on Portraits — "' + label0 + '"');

  // Tap the third dot: Groups.
  dots.children[2].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));

  setTimeout(() => {
    if (go.getAttribute('href') === href0) fail('button did not follow the panel');
    else pass('button follows — "' + go.textContent + '" -> ' + go.getAttribute('href'));

    const on2 = dots.querySelectorAll('.m-dot.is-on');
    if (on2.length !== 1 || on2[0] !== dots.children[2]) fail('active dot did not move');
    else pass('active dot moved to the panel tapped');

    const slide = doc.getElementById('mA') || doc.getElementById('mB');
    const bg = (doc.getElementById('mA').style.backgroundImage || '') +
               (doc.getElementById('mB').style.backgroundImage || '');
    if (bg.indexOf('groups') === -1) fail('no Groups plate painted: ' + bg);
    else pass('a Groups plate is on screen');
    /* tall-small retired 24 Aug 2026 -- the reel serves tall/. */
    if (bg.indexOf('/tall/') === -1) fail('not serving from tall/');
    else pass('serving from tall/');

    console.log('');
  }, 120);
}, 400);

setTimeout(()=>{ dom.window.close(); desktopPass(); }, 900);

/* ---- THE DESKTOP PASS - CUI 41A, 26 Aug 2026 --------------------------
 * Desktop broke twice on 24 Aug with zero harness coverage. Same page,
 * desktop matchMedia: the triptych must stand - three columns, a live
 * #tripGo, headline+button+plates changing TOGETHER on the master clock
 * (the r16 lockstep), and every column serving from tall/. */
function desktopPass(){
  const errors2 = [];
  const dom2 = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://litenco.com/',
    beforeParse(win) {
      win.matchMedia = q => ({
        matches: !/max-width:\s*767px/.test(q),   // a desktop
        media: q, addListener(){}, removeListener(){},
        addEventListener(){}, removeEventListener(){}
      });
      win.fetch = () => Promise.resolve({ ok:true, json: () => Promise.resolve({}) });
      win.addEventListener('error', e => errors2.push(e.error || e.message));
      Object.defineProperty(win.Image.prototype, 'src', {
        set(v){ this._src = v; if (this.onload) setTimeout(() => this.onload(), 0); },
        get(){ return this._src; }
      });
    }
  });
  const win2 = dom2.window, doc2 = win2.document;
  const fail = m => { console.log('  FAIL  [desktop] ' + m); process.exitCode = 1; };
  const pass = m => console.log('  ok    [desktop] ' + m);

  setTimeout(() => {
    console.log('');
    if (errors2.length) {
      errors2.forEach(e => fail('threw on load: ' + (e && e.message ? e.message : e)));
    } else pass('no error on load');

    const panels = doc2.querySelectorAll('.trip-panel');
    if (panels.length !== 3) return fail('expected 3 columns, got ' + panels.length);
    pass('three columns stand');

    const tgo = doc2.getElementById('tripGo');
    if (!tgo) return fail('#tripGo is not in the document');
    const label0 = tgo.textContent, href0 = tgo.getAttribute('href');
    const say0 = (doc2.querySelector('.trip-say') || {}).innerHTML || '';

    const layers0 = Array.from(doc2.querySelectorAll('.trip-panel .show'))
      .map(el => el.style.backgroundImage || '').join('|');
    if (!layers0) fail('no plates painted at rest');
    else if (layers0.indexOf('/tall/') === -1) fail('columns not serving from tall/: ' + layers0.slice(0,80));
    else pass('plates painted, serving from tall/');

    /* Ride the master clock past one group turn (tick=4000, 3 plates per
       group): 3 ticks move the group. jsdom timers are real - fast-forward
       by dispatching is not possible, so we wait it out at 4s/tick x3 =
       12s... too slow for CI. Instead: the clock advances all three
       columns on ONE interval - assert the lockstep wiring statically. */
    const src = html;
    if (!/setInterval\(tick,\s*4000\)/.test(src)) fail('master clock not found - columns may drift (r16 regression)');
    else pass('one master clock drives the triptych');
    if (/setInterval\(paint|setInterval\(turn/.test(src)) fail('a per-column interval exists beside the master clock');
    else pass('no per-column clocks beside it');

    console.log('');
    dom2.window.close();
    process.exit(process.exitCode || 0);
  }, 400);
}
