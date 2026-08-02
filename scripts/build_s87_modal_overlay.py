#!/usr/bin/env python3
"""
build_s87_modal_overlay.py  —  CUI V24, 2026-08-01
IN   public/litenco-stage-2026-08-01-s86.html
OUT  public/litenco-stage-2026-08-01-s87.html

Rich uploaded a group photograph. The console printed

    [intake] the studio would rather this were groups

and the glass showed nothing. Three builds chased this — s84 put the offer in
the wrong place, s85 stacked it behind the collection, s86 moved it to the
upload — and all three were fixing the wrong thing. The offer was opening
every time.

THE ACTUAL FAULT, AND IT IS OLDER THAN TODAY

  The overlay CSS is written as a DESCENDANT selector:

      .m-scrim .scrim{ position:fixed; inset:0; z-index:120; background:… }
      .m-scrim .scrim.show{ opacity:1; pointer-events:auto }

  The markup puts both classes on ONE element:

      <div class="scrim m-scrim" id="intakeModal">

  `.m-scrim .scrim` means "a .scrim INSIDE a .m-scrim". There is no such
  element in this file, so that rule — the one carrying position, inset,
  z-index, backdrop and the transition — has never matched anything.

  The rule that does match is:

      .m-scrim{ display:none }
      .m-scrim.is-open{ display:grid }

  Nothing but display. So an opened modal is an ordinary block in normal
  flow, laid out after the onward cards at the very bottom of the page,
  with no backdrop and nothing to lift it. It renders perfectly, far below
  the fold, and the customer sees nothing.

  It also expects `.show`; the script has always written `.is-open`. Two
  vocabularies for the same state, and the one the CSS was written for is
  never used.

  THIS AFFECTS EVERY MODAL — intake states 1 to 8, the ten-piece cap, the
  sign-in panel, and the redirect offer. Not one of them has ever appeared
  over the page. The intake states have been in the file since r02.

WHAT CHANGES

  The properties intended for the overlay are moved onto the element that
  actually carries the class. `.m-scrim .modal` is left exactly as it is —
  the card IS a child, so that selector was always correct and the card has
  always been styled. Only the overlay was orphaned.

  The dead `.m-scrim .scrim` rules are removed rather than left in place.
  A rule that cannot match is a rule the next reader will trust.

WHAT THIS BUILD DOES NOT DO

  It does not change a single line of JavaScript, or any markup. Every modal
  was already opening. This is the CSS that lets them be seen, and Rich is
  the judge of whether they now look right.

  Nothing about the redirect logic is revisited. s86 put it at the upload,
  which is where it belongs, and the console proves it fires.

Route calls stay at 8.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-08-01-s86.html'
DST_DEFAULT = 'public/litenco-stage-2026-08-01-s87.html'
REG_DEFAULT = 'public/effect-registry.js'

DEAD_1 = '''.m-scrim .scrim{position:fixed;inset:0;z-index:120;background:rgba(31,27,20,.52);'''
SHOW_1 = '''.m-scrim .scrim.show{opacity:1;pointer-events:auto}'''
SHOW_2 = '''.m-scrim .scrim.show .modal{transform:translateY(0) scale(1);opacity:1}'''

OPEN_OLD = '''.m-scrim{ display:none }
.m-scrim.is-open{ display:grid }'''

OPEN_NEW = '''/* THE OVERLAY. Corrected 2026-08-01.

   This was written as `.m-scrim .scrim{ position:fixed; … }` — a descendant
   selector — while the markup puts both classes on one element:
   <div class="scrim m-scrim" id="intakeModal">. There is no .scrim inside a
   .m-scrim anywhere in this file, so the rule carrying position, inset,
   z-index and the backdrop matched nothing, and every modal since r02 opened
   as an ordinary block at the bottom of the page. It rendered; it was simply
   never over anything.

   It also keyed on `.show`, and the script has only ever written `.is-open`.

   The card rule `.m-scrim .modal` is untouched — the card really is a child,
   so that selector was always right, which is why the modals were correctly
   styled and invisible at the same time. */
.m-scrim{ display:none }
.m-scrim.is-open{
  display:grid; place-items:center;
  /* top/right/bottom/left rather than the `inset` shorthand: the boot gate
     asks the cascade what it computed, and inset is not resolved everywhere
     that asks. A rule that cannot be verified is how this fault survived. */
  position:fixed; top:0; right:0; bottom:0; left:0; z-index:1200;
  background:rgba(31,27,20,.52);
  padding:24px;
  overflow-y:auto;
}
/* A tall modal — the eight intake states, the five credit blocks — must be
   able to scroll rather than centre itself off the top of the window. */
.m-scrim.is-open > .modal{ margin:auto }'''

EXPECT_FETCHES = 8
EXPECT_IDS     = 87
BANNED = ['sculpt', 'sculpted', 'sculpture', 'discount', 'in-situ', 'in situ',
          'render', 'queue']


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


def strip_comments(js):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write(js); tmp = t.name
    r = subprocess.run(['node', 'scripts/strip_comments.js', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    if r.returncode != 0: die('comment strip failed: ' + r.stderr.strip())
    return r.stdout


def gate(before, after):
    sa, sb = styles(after), styles(before)

    # the overlay properties must be on the element that carries the class
    m = re.search(r'\.m-scrim\.is-open\{([^}]*)\}', sa)
    if not m: die('the open rule is gone')
    body = m.group(1)
    for prop in ['position:fixed', 'top:0', 'bottom:0', 'z-index', 'background:', 'display:grid']:
        if prop not in body: die('the open rule is missing %s' % prop)

    # and no dead descendant rule may remain
    if '.m-scrim .scrim' in sa:
        die('a rule that can never match survives — .m-scrim .scrim')
    if re.search(r'\.scrim\.show\b', sa):
        die('the .show vocabulary survives; the script writes .is-open')

    # the card rule was always correct and must be left exactly alone
    ca = re.search(r'\.m-scrim \.modal\{([^}]*)\}', sa)
    cb = re.search(r'\.m-scrim \.modal\{([^}]*)\}', sb)
    if not ca or not cb or ca.group(1) != cb.group(1):
        die('the card rule changed; this build declares only the overlay')

    # nothing else at all
    if markup(before) != markup(after): die('markup changed; this build declares none')
    if inline_script(before) != inline_script(after):
        die('script changed; this build declares CSS only')

    nf = len(re.findall(r'\bfetch\s*\(', strip_comments(inline_script(after))))
    if nf != EXPECT_FETCHES: die('fetch count %d, expected %d' % (nf, EXPECT_FETCHES))
    ids = re.findall(r'\bid="([^"]+)"', markup(after))
    if len(ids) != EXPECT_IDS: die('id count %d, expected %d' % (len(ids), EXPECT_IDS))
    if sa.count('{') != sa.count('}'): die('style braces unbalanced')

    print('  gate: the overlay is on the element that carries the class, dead rules removed')


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
const j = (o, ok=true, st=200) => Promise.resolve({ ok, status:st, json:() => Promise.resolve(o) });
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

  const m = d.getElementById('redirectModal');
  if (!m.classList.contains('is-open')) fail('the offer did not open');

  // THE ASSERTION THAT WAS MISSING. Open is not the same as visible: every
  // modal in this file has been opening correctly and rendering at the foot
  // of the page. Ask the cascade what it computes, not what the class says.
  const cs = w.getComputedStyle(m);
  if (cs.display === 'none')      fail('open, but display:none');
  if (cs.position !== 'fixed')    fail('open, but position is ' + cs.position + ' — it sits in normal flow');
  if (cs.top !== '0px')           fail('open, but not pinned to the viewport');
  if (parseInt(cs.zIndex || '0', 10) < 100) fail('open, but z-index ' + cs.zIndex);
  if (!/rgba?\(/.test(cs.backgroundColor)) fail('open, but no backdrop');

  // and the card inside it kept its own styling
  const card = m.querySelector('.modal');
  if (!card) fail('no card');
  if (w.getComputedStyle(card).width === 'auto') fail('the card lost its width');

  // every other modal must be able to do the same
  for (const id of ['intakeModal','queueFullModal','signinModal']){
    const el = d.getElementById(id);
    if (!el) fail(id + ' missing');
    el.classList.add('is-open');
    if (w.getComputedStyle(el).position !== 'fixed') fail(id + ' still does not overlay');
    el.classList.remove('is-open');
  }

  // closed modals stay closed
  if (w.getComputedStyle(d.getElementById('intakeModal')).display !== 'none')
    fail('a closed modal is showing');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  the offer is fixed, pinned, above the page, over a backdrop · all four modals overlay');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s87.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s87.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    REG = sys.argv[3] if len(sys.argv) > 3 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    if before.count(OPEN_OLD) != 1:
        die('open-rule anchor appears %d times, expected 1' % before.count(OPEN_OLD))

    after = before.replace(OPEN_OLD, OPEN_NEW)

    # remove the rules that can never match, whole
    css = styles(after)
    dead = []
    for m in re.finditer(r'\.m-scrim \.scrim[^{}]*\{[^}]*\}', css):
        dead.append(m.group(0))
    if not dead:
        die('the dead descendant rules were not found — has the CSS moved?')
    for rule in dead:
        after = after.replace(rule, '')
    print('  removed %d rule(s) that could never match' % len(dead))

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
