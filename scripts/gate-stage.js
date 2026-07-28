#!/usr/bin/env node
/* gate-stage.js — the stage contract cannot drift
 * CUI V22 · 2026-07-28
 *
 *   node scripts/gate-stage.js [path]
 *   default path: public/litenco-stage-2026-07-28-s1.html
 *
 * Run against the contract file, and against any surface that has adopted it.
 * Every assertion here exists because the opposite shipped and broke geometry.
 */
const fs = require('fs');
const file = process.argv[2] || 'public/litenco-stage-2026-07-28-s1.html';
if (!fs.existsSync(file)) { console.error('FAIL — not found: ' + file); process.exit(1); }
const s = fs.readFileSync(file, 'utf8');
/* markup with all <style> and <script> removed — a selector is not an element */
const markup = s.replace(/<style>[\s\S]*?<\/style>/g, '')
                .replace(/<script[\s\S]*?<\/script>/g, '');
let css = (s.match(/<style>([\s\S]*?)<\/style>/g) || []).join('\n');
/* strip CSS comments first — a rule quoted in a comment is not a rule */
css = css.replace(/\/\*[\s\S]*?\*\//g, '');

const fails = [];
const check = (c, m) => { if (!c) fails.push(m); };

/* 1 · body must be a block.
   body{display:flex;gap:40px;justify-content:center} made the stage a flex
   item, so width:86% competed with flex distribution and auto margins.
   Gutters were then different at every viewport. */
const bodyRules = [...css.matchAll(/(^|[};\s])body\s*\{([^}]*)\}/g)].map(m => m[2]);
bodyRules.forEach(r => {
  if (/display\s*:\s*(flex|grid|inline-flex|inline-grid)/.test(r))
    fails.push('body is a flex/grid container — the stage becomes a flex item and width stops being authoritative');
});

/* 2 · type base is fixed at 16px.
   clamp(12px,0.38vw+6px,15px) resolved to 13px, so every rem came out ~20%
   small. That was the recurring type complaint. */
const rootFs = css.match(/:root\s*\{[^}]*font-size\s*:\s*([^;]+);/);
check(rootFs, 'no :root font-size declared');
if (rootFs) {
  const v = rootFs[1].trim();
  check(v === '16px', `root font-size is "${v}" — the contract is a fixed 16px, never a clamp`);
}
check(!/font-size\s*:\s*clamp\(/.test(css),
      'a clamp() font-size exists — fluid type is what produced 13px');

/* 3 · one stage width, expressed once */
const stageW = [...css.matchAll(/\.stage\s*\{[^}]*?width\s*:\s*([^;]+);/g)].map(m => m[1].trim());
check(stageW.length === 1, `.stage width declared ${stageW.length} times — it must be declared once`);
if (stageW.length) check(stageW[0] === 'var(--stage-w)',
      `.stage width is "${stageW[0]}" — it must read the token`);
check(/--stage-w\s*:\s*max\(90%/.test(css), '--stage-w is not max(90%, ...)');
check(/--stage-gutter-max\s*:\s*100px/.test(css), 'gutter cap is not 100px');
check(!/\.stage\s*\{[^}]*max-width/.test(css),
      '.stage carries a max-width — growth is governed by the gutter cap, not a hard stop');
check(/\.stage\s*\{[^}]*margin-inline\s*:\s*auto/.test(css), '.stage is not centred');

/* 4 · the ground is edge to edge and behind the stage */
check(/\.ground\s*\{[^}]*position\s*:\s*fixed/.test(css), '.ground is not fixed full-bleed');
check(/\.ground\s*\{[^}]*inset\s*:\s*0/.test(css), '.ground does not cover the viewport');
const gz = css.match(/\.ground\s*\{[^}]*z-index\s*:\s*(-?\d+)/);
const sz = css.match(/\.stage\s*\{[^}]*z-index\s*:\s*(-?\d+)/);
check(gz && sz && +gz[1] < +sz[1], 'the ground is not behind the stage');
check(/\.ground\s*\{[^}]*url\("\/textures\/limestone\.(png|jpg)"\)/.test(css),
      'limestone is not on the ground layer');
check(!/\.stage\s*\{[^}]*limestone/.test(css),
      'limestone is on .stage — it must be edge to edge, not stage-width');

/* 5 · no horizontal floor without a release below it */
for (const m of css.matchAll(/min-width\s*:\s*(\d+)px/g)) {
  const v = +m[1];
  if (v >= 1200 && !css.replace(/\s/g,'').includes(`max-width:${v-1}px`))
    fails.push(`unreleased min-width:${v}px — clips with no scroll`);
}

/* 6 · radius ceiling. 999px only where the constrained dimension is <=72px */
for (const m of css.matchAll(/([^{}]{0,160})border-radius\s*:\s*999(px|rem)/g)) {
  const d = m[1].match(/(?:min-)?height\s*:\s*(\d+)px/);
  if (d && +d[1] > 72) fails.push(`999px radius on a ${d[1]}px element`);
  if (!d && !/50%/.test(m[1])) fails.push('999px radius with no height constraint — cannot verify it is a pill');
}

/* 7 · type floors, for anything the contract sizes */
for (const m of css.matchAll(/([^{}]+)\{[^}]*font-size\s*:\s*(\d+)px/g)) {
  const sel = m[1].trim().split('\n').pop().trim();
  const px = +m[2];
  if (px < 13) fails.push(`${sel} at ${px}px — below every floor`);
}

/* 8 · bench and measurement scaffolding must not reach a surface */
const isContract = /litenco-stage-2026-07-28-s\d/.test(file) || /STAGE CONTRACT ·/.test(s);
if (!isContract) {
  check(!/class="readout"/.test(s), 'measurement readout ported into a surface');
  check(!/class="rule"/.test(s),    'measurement frame ported into a surface');
}

/* 8b · masthead, when present, obeys MASTHEAD-DIRECTIVE-v1 */
if (/class="mh"/.test(markup)) {
  check(/--mh-h\s*:\s*90px/.test(css), 'masthead is not 90px');
  check(/\.mh\s*\{[^}]*padding-inline\s*:\s*var\(--stage-gutter\)/.test(css),
        'masthead inset does not read --stage-gutter — a flat padding drifts from the stage edge');
  check(/\.mh\s*\{[^}]*position\s*:\s*sticky/.test(css), 'masthead is not sticky');
  check(/\.mh\s*\{[^}]*background\s*:\s*var\(--espresso\)/.test(css),
        'masthead ground is not espresso');
  check(/grid-template-columns\s*:\s*minmax\(0,1fr\) auto minmax\(0,1fr\)/.test(css),
        'masthead is not three zones with the nav optically centred');
  check(/data-empty="true"/.test(markup), 'cart badge has no muted empty state');
  check(/id="mhCreditsBtn"[^>]*hidden/.test(markup), 'credits does not ship hidden');
  /* series switcher */
  if (/mh-series-btn/.test(markup)) {
    check(/--series\s*:\s*#d7bd89/i.test(css), 'series colour is not #d7bd89');
    check(/\.mh-series-btn\s*\{[^}]*color\s*:\s*var\(--series\)/.test(css),
          'series button does not read --series');
    check(/aria-expanded="false"/.test(markup), 'series button has no initial aria-expanded');
    check(/id="mhSeriesMenu"[^>]*hidden/.test(markup), 'series menu does not ship hidden');
    const items = markup.match(/role="menuitem"/g) || [];
    check(items.length === 5, `series menu must list the five locked Series — found ${items.length}`);
    for (const gone of ['Houses', 'Landscapes'])
      check(!new RegExp('>'+gone+'<').test(markup), `${gone} is out for Aug 9 but appears in the series menu`);
    const cur = (markup.match(/aria-current="page"/g) || []);
    check(cur.length === 1, `exactly one series must be current — found ${cur.length}`);
  }
  check(!/\.mh-nav\s*a\s*\{[^}]*font-weight\s*:\s*[5-9]00/.test(css),
        'Cormorant is bolded in the nav — hierarchy is size, never weight');
  check(/\.mh-nav\s*a\s*\{[^}]*font-size\s*:\s*[\d.]+em/.test(css),
        'nav font-size is not in em — it must scale from one number');
}

/* 8c · noise blend discipline
   multiply on light grounds, soft-light on dark. The wrong one either
   washes out the tone or crushes the shadows into mud. */
for (const m of css.matchAll(/([.#][\w-]+(?:\s*,\s*[.#][\w-]+)*)::before\s*\{([^}]*)\}/g)) {
  const sel = m[1], body = m[2];
  if (!/textures\/noise/.test(body)) continue;
  const blend = (body.match(/mix-blend-mode\s*:\s*([\w-]+)/) || [])[1];
  check(blend === 'multiply' || blend === 'soft-light',
        `${sel} applies noise with blend "${blend}" — only multiply or soft-light`);
  const op = parseFloat((body.match(/opacity\s*:\s*([\d.]+)/) || [])[1]);
  if (blend === 'multiply' && op > 0.08)
    fails.push(`${sel} noise at ${op} on multiply — grain becomes tone above ~0.08`);
  if (blend === 'soft-light' && op > 0.20)
    fails.push(`${sel} noise at ${op} on soft-light — overpowers the surface above ~0.20`);
}

/* 9 · braces */
check((css.match(/{/g)||[]).length === (css.match(/}/g)||[]).length, 'style braces unbalanced');

if (fails.length) {
  console.log(`GATE FAIL — ${file}`);
  fails.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
console.log(`STAGE CONTRACT HOLDS — ${file}`);
console.log('  body: block · root: 16px · stage: 90% capped at 100px gutters · ground: fixed, edge to edge');
