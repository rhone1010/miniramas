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

setTimeout(()=>{ dom.window.close(); process.exit(process.exitCode||0); }, 900);
