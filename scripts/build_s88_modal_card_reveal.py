#!/usr/bin/env python3
"""
build_s88_modal_card_reveal.py  —  CUI V24, 2026-08-01
IN   public/litenco-stage-2026-08-01-s87.html
OUT  public/litenco-stage-2026-08-01-s88.html

Rich: "took 3-4 seconds for the muted screen cover to show up.. then no modal"

Exactly right, and exactly diagnostic: the backdrop is mine from s87 and it
works. The card is transparent.

`.m-scrim .modal` ends with

    transform:translateY(14px) scale(.97); opacity:0; transition:…

It is the closed half of an entrance animation. The open half lived in

    .m-scrim .scrim.show .modal{ transform:translateY(0) scale(1); opacity:1 }

which s87 deleted as unmatchable. It was unmatchable — but it was also the
only thing that ever set the card back to opacity 1. I removed a rule that
could not fire without noticing that its absence left the card permanently
invisible.

The s87 gate asserted the SCRIM was fixed, pinned, above the page and
backdropped, and that the card kept its width. Width is not visibility. It
checked the container and the thing inside it stayed at zero.

NOW
    .m-scrim.is-open > .modal{ transform:none; opacity:1 }

matched against the class the script actually writes. The entrance animation
survives — the card still rises and fades in, which is what the transform and
transition were for.

The gate now reads computed opacity on the CARD, not just on the scrim.

Route calls stay at 8. CSS only.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-08-01-s87.html'
DST_DEFAULT = 'public/litenco-stage-2026-08-01-s88.html'
REG_DEFAULT = 'public/effect-registry.js'

ANCHOR = '''.m-scrim.is-open > .modal{ margin:auto }'''
REPLACE = '''.m-scrim.is-open > .modal{
  margin:auto;
  /* The card is authored closed — `.m-scrim .modal` ends with
     transform:translateY(14px) scale(.97); opacity:0 — and the rule that
     opened it was `.m-scrim .scrim.show .modal`, which s87 removed as
     unmatchable. It was unmatchable. It was also the only thing that ever
     set the card visible, so the backdrop appeared over a transparent card
     and Rich saw the screen dim and nothing arrive.

     Re-hung on the class the script actually writes. The transition on the
     card is left alone: it still rises and fades in, which is what the
     transform was written for. */
  transform:none;
  opacity:1;
}'''

EXPECT_FETCHES = 8
EXPECT_IDS     = 87


def die(m):
    print('GATE FAIL: ' + m); sys.exit(1)


def inline_script(h):
    m = list(re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', h, re.S | re.I))
    if len(m) != 1: die('expected one inline script, found %d' % len(m))
    return m[0].group(1)


def styles(h):
    return ''.join(m.group(1) for m in re.finditer(r'<style[^>]*>(.*?)</style>', h, re.S | re.I))


def markup(h):
    x = re.sub(r'<script[^>]*>.*?</script>', '<script></script>', h, flags=re.S | re.I)
    return re.sub(r'<style[^>]*>.*?</style>', '<style></style>', x, flags=re.S | re.I)


def gate(before, after):
    sa = styles(after)
    m = re.search(r'\.m-scrim\.is-open > \.modal\{([^}]*)\}', sa)
    if not m: die('the card rule is gone')
    if 'opacity:1' not in m.group(1): die('the card is still transparent when open')
    if 'transform:none' not in m.group(1): die('the card is still offset when open')
    if markup(before) != markup(after): die('markup changed; this build declares none')
    if inline_script(before) != inline_script(after): die('script changed; CSS only')
    if sa.count('{') != sa.count('}'): die('style braces unbalanced')
    print('  gate: the card is opaque and in place when its scrim is open')


BOOT = r'''
const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const reg  = fs.readFileSync(process.argv[3], 'utf8');
const errs = [], store = {};
const dom = new JSDOM(html, { runScripts:'outside-only', pretendToBeVisual:true, url:'http://localhost/s.html' });
const w = dom.window, d = dom.window.document;
w.addEventListener('error', e => errs.push('window error: ' + e.message));
Object.defineProperty(w, 'localStorage', { value: {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k,v) => { store[k]=String(v); }, removeItem: k => { delete store[k]; }
}, configurable: true });

const MSG = 'We see three women in dresses in your photograph.';
const j = (o) => Promise.resolve({ ok:true, status:200, json:() => Promise.resolve(o) });
w.fetch = (url) => {
  if (url.includes('/auth/me')) return j({ user:{ id:'uid-1', email:'r@x.com' } });
  if (url.includes('/analyze')) return j({ result:{ quality_verdict:'green', smallest_face_min_dim_px:500 } });
  if (url.includes('/portraits/gate'))
    return j({ status:'redirected', redirect:{ series:'groups', message:MSG,
               ctaLabel:'Step Inside Groups', stayLabel:'Craft it in Portrait anyway' } });
  if (url.includes('/curate-effects')) return j({ ok:true, recommendations: [] });
  return j({});
};
w.Image = class { set src(v){ this.naturalWidth=1200; this.naturalHeight=1600;
  if (this.onload) setTimeout(() => this.onload(), 0); } };

try { w.eval(reg); } catch (e) { console.log('FAIL registry'); process.exit(1); }
try { w.eval(html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1]); }
catch (e) { console.log('FAIL boot threw: ' + e.message); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { console.log('FAIL ' + m); process.exit(1); };

(async () => {
  await sleep(80);
  const f = new w.File([new w.Uint8Array([1,2,3])], 'group.jpg', { type:'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value:[f], configurable:true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(400);

  // Every modal must be visible in every sense — the container AND the card.
  // s87 checked the container and the card inside it stayed at opacity 0.
  for (const id of ['redirectModal','intakeModal','queueFullModal','signinModal']){
    const el = d.getElementById(id);
    if (!el) fail(id + ' missing');
    el.classList.add('is-open');
    const scrim = w.getComputedStyle(el);
    if (scrim.position !== 'fixed') fail(id + ' does not overlay');
    const card = el.querySelector('.modal');
    if (!card) fail(id + ' has no card');
    const cs = w.getComputedStyle(card);
    if (parseFloat(cs.opacity) !== 1) fail(id + ' card opacity is ' + cs.opacity + ' — invisible');
    if (cs.transform && cs.transform !== 'none' && cs.transform !== '')
      fail(id + ' card is still offset: ' + cs.transform);
    if (cs.width === 'auto') fail(id + ' card lost its width');
    if (id !== 'redirectModal') el.classList.remove('is-open');
  }

  // and closed is still closed
  if (w.getComputedStyle(d.getElementById('intakeModal')).display !== 'none')
    fail('a closed modal is showing');

  // the offer still says what it should
  if (d.getElementById('redirectSay').textContent.indexOf(MSG) !== 0) fail('message not shown');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  all four cards opaque, in place, over a fixed backdrop');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s88.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s88.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    REG = sys.argv[3] if len(sys.argv) > 3 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    if before.count(ANCHOR) != 1:
        die('anchor appears %d times, expected 1' % before.count(ANCHOR))
    after = before.replace(ANCHOR, REPLACE)

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
