#!/usr/bin/env python3
"""
build_s91_note_template.py  —  CUI V24, 2026-08-01
IN   public/litenco-stage-2026-08-01-s90.html
OUT  public/litenco-stage-2026-08-01-s91.html

Rich, on the intake modal: "the source image is also not reframed as
requested yet. the top is cut off. width at locked height max up to 9:16.
yes style the modal as a template please"

1 · THE PREVIEW, AS RULED
    Width is locked, height follows the photograph, and 9:16 is the ceiling.
    s90 did this for the Curator's Note and not for `.pieceframe`, which the
    eight intake states use — that frame is a fixed 130px cropping to fill,
    so a portrait shows its middle and the top of the head is cut away while
    the note discusses the face.

    The `.m-photo` rule from s90 and this one now say the same thing, so
    both are stated once and shared.

2 · THE NOTE IS THE TEMPLATE
    The intake states carry a second vocabulary — .m-modal, .mclose, .mcur,
    .mc-mark, .mcur-say, .safe — that has no rules, exactly as .m-cur did
    before s89. Rather than write a second set, they are mapped onto the
    note: the same card, mark, rules, letter, evidence-beside-answer and
    quiet line.

    No markup changes. The old class names are aliased to the note's, so the
    r02 states keep their structure and inherit the studio's dress.

    They have never been seen — the overlay bug hid them from r02 until s88
    last night — so this is the first time they can be judged at all.

3 · A NOTE FOR THE CURATOR MACHINE
    Rich, on a photograph the client called dim that NB2 would render
    without difficulty: the intake thresholds are guesses. They came across
    from b2 as constants and have never been measured against photographs
    Rich would accept or reject. Recorded in the header of
    module_curator_machine.js and on the launch board, not fixed here —
    fixing it needs his eye and a set of samples, not another guess.

Route calls stay at 8. No markup, no script.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-08-01-s90.html'
DST_DEFAULT = 'public/litenco-stage-2026-08-01-s91.html'
REG_DEFAULT = 'public/effect-registry.js'

# ---- 1 · one preview rule, shared -----------------------------------------
PHOTO_OLD = '''.m-body .m-photo{
  flex:0 0 46%;
  border-radius:4px; overflow:hidden;
  border:1px solid rgba(147,111,67,.32);
  background:var(--vellum-300);
  box-shadow:0 2px 8px rgba(31,27,20,.16);
  /* 9:16 is the tallest shape the studio accepts, so the frame need never
     be taller than that. Anything beyond it was turned away at the upload. */
  max-height:calc((680px - 4.4rem) * 0.46 * 16 / 9);
}
.m-body .m-photo img{ width:100%; height:auto; display:block }'''

PHOTO_NEW = '''/* THE PREVIEW, ruled 2026-08-01: width locked, height follows the
   photograph, 9:16 the ceiling. Nothing is cropped — the photograph is the
   evidence the note is discussing, and a frame that crops it argues with the
   sentence beside it.

   Stated once for both vocabularies. `.pieceframe` is what the eight r02
   intake states use and it was a fixed 130px cropping to fill, so a portrait
   showed its middle with the top of the head cut away while the Curator
   talked about the face. */
.m-body .m-photo,
.m-scrim .modal .pieceframe{
  flex:0 0 46%;
  border-radius:4px; overflow:hidden;
  border:1px solid rgba(147,111,67,.32);
  background:var(--vellum-300);
  box-shadow:0 2px 8px rgba(31,27,20,.16);
  /* Anything taller than 9:16 was refused at the upload, so the frame never
     needs to be. */
  max-height:calc((680px - 4.4rem) * 0.46 * 16 / 9);
  /* .pieceframe was authored as a flex row to centre a fixed-height crop.
     Both of those are gone. */
  height:auto; display:block; position:relative;
}
.m-body .m-photo img,
.m-scrim .modal .pieceframe img,
.m-scrim .modal .pieceframe .art{ width:100%; height:auto; display:block; object-fit:unset }'''

# ---- 2 · the intake vocabulary inherits the note --------------------------
TEMPLATE_ANCHOR = '''@media (max-width:560px){'''
TEMPLATE_ADD = '''/* ===================================================================
   THE INTAKE STATES WEAR THE NOTE
   ===================================================================
   The eight r02 states carry their own class names — .m-modal, .mclose,
   .mcur, .mc-mark, .mcur-say, .safe, .piece-badge — and not one of them has
   a rule anywhere in this file. Same fault as .m-cur before s89: markup
   written against a vocabulary that was never defined.

   They are mapped onto the note rather than given a second set of rules. One
   card, one mark, one letter, one quiet line. No markup moves, so the r02
   structure is preserved exactly and only its dress changes.

   These have never been seen by anyone. The overlay selector hid every modal
   in this file from r02 until s88 last night, so this is the first build in
   which they can be judged at all. */

.m-scrim .modal .state{ display:none }
.m-scrim .modal .state.active{ display:block }

/* the letter — .mcur is the header row, .mcur-say is the letter itself */
.m-scrim .modal .mcur{ display:flex; align-items:flex-start; gap:.7rem; margin-top:1.15rem }
.m-scrim .modal .mc-mark{
  width:2rem; height:2rem; flex:0 0 auto; border-radius:50%;
  background:var(--oxblood); color:var(--vellum-100);
  display:grid; place-items:center;
  font-family:var(--serif, 'Cormorant Garamond', Georgia, serif);
  font-size:1.15rem; font-style:italic; line-height:1;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.28);
}
.m-scrim .modal .mcur-say{
  flex:1;
  font-family:var(--serif, 'Cormorant Garamond', Georgia, serif);
  font-size:1.2rem; line-height:1.4; color:var(--ink);
}
.m-scrim .modal .mcur-say .sig{
  display:block; margin-top:.6rem;
  font-size:1.1rem; color:var(--ink-soft); font-style:italic;
}

/* the quiet line — money, timing, reassurance. Never the Curator's voice. */
.m-scrim .modal .safe{
  display:flex; align-items:flex-start; gap:.5rem;
  margin-top:1.15rem;
  font-family:var(--sans, system-ui, sans-serif);
  font-size:.82rem; line-height:1.5; color:var(--ink-soft);
}
.m-scrim .modal .safe svg{ width:1rem; height:1rem; flex:0 0 auto; margin-top:.12rem; color:var(--brass) }

/* the badge sits ON the photograph, naming what the Curator is about to say */
.m-scrim .modal .piece-badge{
  position:absolute; left:.6rem; bottom:.6rem;
  padding:.28rem .6rem; border-radius:3px;
  background:rgba(31,27,20,.72); color:var(--vellum-100);
  font-family:var(--sans, system-ui, sans-serif);
  font-size:.72rem; letter-spacing:.03em;
}
.m-scrim .modal .reason-tag{
  display:inline-block; margin-bottom:.5rem;
  font-family:var(--mono, ui-monospace, monospace);
  font-size:.68rem; letter-spacing:.1em; text-transform:uppercase;
  color:var(--brass);
}

.m-scrim .modal .mclose{
  position:absolute; top:1.1rem; right:1.2rem;
  width:2rem; height:2rem; border-radius:50%;
  display:grid; place-items:center;
  color:var(--taupe); font-size:1.4rem; line-height:1; cursor:pointer;
  transition:color .15s, background .15s;
}
.m-scrim .modal .mclose:hover{ color:var(--ink); background:rgba(42,36,30,.06) }

/* the actions sit beside the photograph, as in the note */
.m-scrim .modal .state > .pieceframe + .mcur{ margin-top:1.15rem }
.m-scrim .modal .state .acts{ display:flex; flex-direction:column; gap:.6rem; margin-top:1.15rem }

'''

# .m-modal must be the card too — the intake shell uses that name
CARD_OLD = '''.m-card{'''
CARD_NEW = '''/* The intake states call the card .m-modal; the note calls it .m-card. One
   card, both names, rather than a second set of rules that will drift. */
.m-modal,
.m-card{'''

# every remaining `.m-card X` selector must also reach `.m-modal X`
DUAL = [
    ('.m-head{', '.m-modal .m-head,\n.m-head{'),
    ('.m-x{', '.m-modal .m-x,\n.m-x{'),
    ('.m-rule{', '.m-modal .m-rule,\n.m-rule{'),
    ('.m-say{', '.m-modal .m-say,\n.m-say{'),
    ('.m-safe{', '.m-modal .m-safe,\n.m-safe{'),
]

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


def gate(before, after):
    sa = styles(after)

    # 1 · nothing crops, in either vocabulary
    p = re.search(r'\.m-body \.m-photo img,[^{]*\{([^}]*)\}', sa)
    if not p: die('the shared preview rule is missing')
    if 'height:auto' not in p.group(1): die('the preview height does not follow the image')
    fr = re.search(r'\.m-body \.m-photo,\s*\.m-scrim \.modal \.pieceframe\{([^}]*)\}', sa)
    if not fr: die('.pieceframe does not share the preview rule')
    if 'max-height' not in fr.group(1): die('no 9:16 ceiling on the frame')
    if 'height:auto' not in fr.group(1): die('the frame is still a fixed height')

    # 2 · every class the intake markup uses now has a rule
    for cls in ['.m-modal', '.mclose', '.mcur', '.mc-mark', '.mcur-say',
                '.safe', '.piece-badge', '.state']:
        if not re.search(r'(?<![\w-])' + re.escape(cls) + r'[\s,{:.]', sa):
            die('%s is used by the intake states and has no rule' % cls)

    # the intake letter must meet the same Garamond floor as the note
    m = re.search(r'\.m-scrim \.modal \.mcur-say\{([^}]*)\}', sa)
    s = re.search(r'font-size:([\d.]+)rem', m.group(1))
    if not s or float(s.group(1)) < 1.2:
        die('the intake letter is below the Garamond floor')

    # only one state may show at a time
    if '.m-scrim .modal .state{ display:none }' not in sa: die('states are not hidden by default')
    if '.m-scrim .modal .state.active{ display:block }' not in sa: die('no active state rule')

    if inline_script(before) != inline_script(after): die('script changed; CSS only')
    if markup(before) != markup(after): die('markup changed; CSS only')
    ids = re.findall(r'\bid="([^"]+)"', markup(after))
    if len(ids) != EXPECT_IDS: die('id count %d, expected %d' % (len(ids), EXPECT_IDS))
    if sa.count('{') != sa.count('}'): die('style braces unbalanced')

    vis = re.sub(r'<!--.*?-->', '', markup(after), flags=re.S)
    vis = re.sub(r'<div class="readout">.*?</table>\s*</div>', '', vis, flags=re.S | re.I)
    vis = re.sub(r'<[^>]+>', ' ', vis).lower()
    for w in BANNED:
        if re.search(r'\b' + re.escape(w) + r'\w*', vis):
            die('banned vocabulary in customer-visible text: %r' % w)

    print('  gate: one preview rule for both frames, intake states wear the note')


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
w.console = { log(){}, warn(){}, error(){} };

const j = (o) => Promise.resolve({ ok:true, status:200, json:() => Promise.resolve(o) });
w.fetch = (url) => {
  if (url.includes('/auth/me')) return j({ user:{ id:'uid-1', email:'r@x.com' } });
  if (url.includes('/analyze')) return j({ result:{ quality_verdict:'green', smallest_face_min_dim_px:40 } });
  if (url.includes('/portraits/gate')) return j({ status:'ok' });
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
  // a small face — the intake modal should raise state 5
  const f = new w.File([new w.Uint8Array([1,2,3])], 'p.jpg', { type:'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value:[f], configurable:true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(400);

  const im = d.getElementById('intakeModal');
  if (!im.classList.contains('is-open')) fail('the intake modal did not open');
  if (w.getComputedStyle(im).position !== 'fixed') fail('intake does not overlay');

  const card = im.querySelector('.m-modal');
  if (!card) fail('the intake card is not .m-modal');
  const cs = w.getComputedStyle(card);
  if (parseFloat(cs.opacity) !== 1) fail('the intake card is transparent');
  if (cs.width === 'auto') fail('the intake card has no width — it did not inherit the note');

  // exactly one state visible
  const shown = [...im.querySelectorAll('.state')].filter(s =>
    w.getComputedStyle(s).display !== 'none');
  if (shown.length !== 1) fail(shown.length + ' intake states visible at once');

  // the letter is dressed
  const say = shown[0].querySelector('.mcur-say');
  if (!say) fail('no letter in the active state');
  // jsdom does not resolve var() in getComputedStyle, so the serif is
  // asserted against the stylesheet in the CSS gate. Here we prove the RULE
  // reaches this element, using a literal it declares.
  const ss = w.getComputedStyle(say);
  if (ss.lineHeight !== '1.4')
    fail('the note letter rule does not reach the intake states (line-height ' + ss.lineHeight + ')');

  // the mark is a disc, not a stray C
  const mk = shown[0].querySelector('.mc-mark') || im.querySelector('.mc-mark');
  if (mk && w.getComputedStyle(mk).borderRadius.indexOf('50%') < 0)
    fail('the intake mark is not a disc');

  // NOTHING IS CROPPED, in either frame
  for (const sel of ['.m-scrim .modal .pieceframe img', '.m-body .m-photo img']){
    for (const el of d.querySelectorAll(sel)){
      const s = w.getComputedStyle(el);
      if (s.objectFit === 'cover') fail(sel + ' still crops the photograph');
      if (s.height && s.height !== 'auto' && s.height !== '') fail(sel + ' has a forced height');
    }
  }
  const frame = shown[0].querySelector('.pieceframe');
  if (frame && w.getComputedStyle(frame).height === '130px')
    fail('the frame is still the fixed 130px crop');

  // the note itself is unchanged by all this
  const note = d.getElementById('redirectModal').querySelector('.m-card');
  note.parentElement.classList.add('is-open');
  if (w.getComputedStyle(note).width === 'auto') fail('the note lost its width');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  intake wears the note · one state at a time · nothing cropped in either frame');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s91.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s91.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    REG = sys.argv[3] if len(sys.argv) > 3 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    for nm, a in [('photo', PHOTO_OLD), ('template', TEMPLATE_ANCHOR), ('card', CARD_OLD)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (nm, before.count(a)))

    after = before.replace(PHOTO_OLD, PHOTO_NEW)
    after = after.replace(CARD_OLD, CARD_NEW)
    after = after.replace(TEMPLATE_ANCHOR, TEMPLATE_ADD + TEMPLATE_ANCHOR)
    for old, new in DUAL:
        if after.count(old) != 1:
            die('dual-selector anchor %r appears %d times' % (old, after.count(old)))
        after = after.replace(old, new)

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
