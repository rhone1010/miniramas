#!/usr/bin/env python3
"""
build_s89_curators_note.py  —  CUI V24, 2026-08-01
IN   public/litenco-stage-2026-08-01-s88.html
OUT  public/litenco-stage-2026-08-01-s89.html

Rich supplied a mockup of the Curator's Note. This builds it.

WHAT WAS WRONG
  s82 and s84 wrote markup against class names — .m-cur, .m-cur-mark,
  .m-cur-say, .m-safe, .m-x — that do not exist in the style block. I assumed
  a modal vocabulary rather than reading for one. The intake states use a
  different set, and those have no rules either.

  So the card had a bare letter C where the mark should be, body copy at
  browser default sans in a Garamond product, and buttons stacked full-width.
  It was legible and it was not the studio.

RICH'S SPEC, read from the mockup:
  · the oxblood mark, then "Curator's Note" in Garamond, and a close at the
    right
  · a hairline, broken by a fleuron
  · the message, ranged left, signed
  · a second hairline
  · the photograph LEFT, the two actions stacked to its RIGHT — the
    photograph is the evidence and the buttons answer it, so they sit
    together on one line
  · the caution below, quiet, sans

WHAT THIS IS
  Not one modal's styling — the shell every modal uses. The intake states,
  the cap and the sign-in panel all inherit it, which is why the classes are
  named for the note and not for the redirect.

  Those states have never been seen: the overlay bug hid them from r02 until
  s88 tonight. Rich judges them next; this is the ground they stand on.

Route calls stay at 8.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-08-01-s88.html'
DST_DEFAULT = 'public/litenco-stage-2026-08-01-s89.html'
REG_DEFAULT = 'public/effect-registry.js'

CSS_ANCHOR = '''.m-scrim{ display:none }'''
CSS_ADD = '''/* ===================================================================
   THE CURATOR'S NOTE — the shell every modal wears
   ===================================================================
   Built to Rich's mockup, 2026-08-01.

   s82 and s84 wrote markup against .m-cur, .m-cur-mark, .m-cur-say, .m-safe
   and .m-x, none of which had a rule anywhere. The card rendered at browser
   defaults: a bare letter C, sans body copy in a Garamond product, buttons
   stacked at full width. Written here, once, so every modal shares it.

   Garamond runs about a third smaller than sans at the same size, so the
   body sits at 1.28rem — under that it reads as fine print, which is the
   recurring fault in this file. */

.m-card{
  width:min(560px, 100%);
  background:linear-gradient(180deg,#faf6ec,#f3ecdd);
  border:1px solid rgba(147,111,67,.34);
  border-radius:6px;
  padding:2rem 2.2rem 1.9rem;
  position:relative;
  box-shadow:0 24px 60px rgba(31,27,20,.42), 0 4px 12px rgba(31,27,20,.24),
             inset 0 1px 0 rgba(255,255,255,.75);
}

/* header — mark, title, close */
.m-head{ display:flex; align-items:center; gap:.7rem; }
.m-head .m-mark{
  width:2rem; height:2rem; flex:0 0 auto; border-radius:50%;
  background:var(--oxblood); color:var(--vellum-100);
  display:grid; place-items:center;
  font-family:var(--serif, 'Cormorant Garamond', Georgia, serif);
  font-size:1.15rem; font-style:italic; line-height:1;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.28);
}
.m-head .m-title{
  font-family:var(--serif, 'Cormorant Garamond', Georgia, serif);
  font-size:1.7rem; font-weight:400; color:var(--ink); letter-spacing:.01em;
}
.m-x{
  position:absolute; top:1.1rem; right:1.2rem;
  width:2rem; height:2rem; border:0; border-radius:50%;
  background:none; color:var(--taupe); font-size:1.4rem; line-height:1;
  cursor:pointer; transition:color .15s, background .15s;
}
.m-x:hover{ color:var(--ink); background:rgba(42,36,30,.06) }

/* the divided rule, with its fleuron */
.m-rule{
  display:flex; align-items:center; gap:.8rem;
  margin:1.15rem 0;
  color:rgba(147,111,67,.5);
}
.m-rule::before, .m-rule::after{
  content:""; flex:1; height:1px;
  background:linear-gradient(90deg, transparent, rgba(147,111,67,.45), transparent);
}
.m-rule .m-fleuron{
  font-family:var(--serif, 'Cormorant Garamond', Georgia, serif);
  font-size:.95rem; color:rgba(147,111,67,.75); line-height:1;
}
.m-rule--plain{ margin:1.3rem 0 1.15rem }
.m-rule--plain::before, .m-rule--plain::after{ background:rgba(147,111,67,.28) }

/* the letter */
.m-say{
  font-family:var(--serif, 'Cormorant Garamond', Georgia, serif);
  font-size:1.28rem; line-height:1.55; color:var(--ink);
}
.m-say .sig{
  display:block; margin-top:.75rem;
  font-size:1.15rem; color:var(--ink-soft); font-style:italic;
}

/* the evidence, and the answer to it, side by side */
.m-body{ display:flex; gap:1.1rem; align-items:stretch }
.m-body .m-photo{
  flex:0 0 46%;
  border-radius:4px; overflow:hidden;
  border:1px solid rgba(147,111,67,.32);
  background:var(--vellum-300);
  box-shadow:0 2px 8px rgba(31,27,20,.16);
}
.m-body .m-photo img{ width:100%; height:100%; object-fit:cover; display:block }
.m-body .acts{ flex:1; display:flex; flex-direction:column; gap:.6rem; justify-content:center; margin:0 }

/* actions — serif pills with real weight, never micro-links */
.m-card .btn{
  font-family:var(--serif, 'Cormorant Garamond', Georgia, serif);
  font-style:italic; font-size:1.22rem; line-height:1.2;
  padding:.62rem .9rem; border-radius:5px; text-align:center; cursor:pointer;
  border:1px solid transparent; transition:filter .15s, background .15s;
}
.m-card .btn.fill{ background:var(--oxblood); color:var(--vellum-100) }
.m-card .btn.fill:hover{ background:#6a3737 }
.m-card .btn.ghost{
  background:linear-gradient(180deg,#8a6c38,#6f5629); color:#fbf1d6;
  border-color:rgba(60,44,20,.5); text-shadow:0 1px 0 rgba(40,28,12,.45);
}
.m-card .btn.ghost:hover{ filter:brightness(1.1) }

/* the quiet part — the caution, and anything about money */
.m-safe{
  margin-top:1.15rem;
  font-family:var(--sans, system-ui, sans-serif);
  font-size:.82rem; line-height:1.5; color:var(--ink-soft);
}

@media (max-width:560px){
  .m-body{ flex-direction:column }
  .m-body .m-photo{ flex:none; height:150px }
}

'''

# the redirect modal, rebuilt to the mockup
MODAL_OLD = '''<div class="scrim m-scrim" id="redirectModal" data-role="modal">
  <div class="modal m-card">
    <button class="m-x" id="redirectX" aria-label="Close">&times;</button>
    <div class="m-cur"><div class="m-cur-mark">C</div>
      <div class="m-cur-say" id="redirectSay"></div></div>
    <div class="pieceframe reject">
      <img class="art" id="redirectPhoto" data-role="their-photo" alt="">
    </div>
    <div class="acts">
      <div class="btn fill" id="redirectNew">Use a different photograph</div>
      <div class="btn ghost" id="redirectAnyway">Craft it in Portraits anyway</div>
    </div>
    <div class="m-safe" id="redirectWarn">A group photograph crafted as a Portrait
      will follow the most prominent person &mdash; the results can be unexpected.
      Nothing further is charged if you would rather not.</div>
  </div>
</div>'''

MODAL_NEW = '''<div class="scrim m-scrim" id="redirectModal" data-role="modal">
  <div class="modal m-card">
    <button class="m-x" id="redirectX" aria-label="Close">&times;</button>
    <div class="m-head"><div class="m-mark">C</div>
      <div class="m-title">Curator&rsquo;s Note</div></div>
    <div class="m-rule"><span class="m-fleuron">&#10086;</span></div>
    <div class="m-say" id="redirectSay"></div>
    <div class="m-rule m-rule--plain"><span class="m-fleuron"></span></div>
    <div class="m-body">
      <div class="m-photo"><img id="redirectPhoto" alt=""></div>
      <div class="acts">
        <div class="btn fill" id="redirectNew">Use a different photograph</div>
        <div class="btn ghost" id="redirectAnyway">Craft it in Portraits anyway</div>
      </div>
    </div>
    <div class="m-safe" id="redirectWarn">A group photograph crafted as a Portrait
      will follow the most prominent person &mdash; the results can be unexpected.
      Nothing further is charged if you would rather not.</div>
  </div>
</div>'''

# sign-in, to the same shell
SIGNIN_OLD = '''    <div id="signinAsk">
      <div class="m-cur"><div class="m-cur-mark">C</div>
        <div class="m-cur-say">Before I begin &mdash; where shall I send your work?
          I&rsquo;ll email you a link to sign in. There is no password to remember.
          <span class="sig">&mdash;&thinsp;C.</span></div></div>'''

SIGNIN_NEW = '''    <div id="signinAsk">
      <div class="m-head"><div class="m-mark">C</div>
        <div class="m-title">Curator&rsquo;s Note</div></div>
      <div class="m-rule"><span class="m-fleuron">&#10086;</span></div>
      <div class="m-say">Before I begin &mdash; where shall I send your work?
          I&rsquo;ll email you a link to sign in. There is no password to remember.
          <span class="sig">&mdash;&thinsp;C.</span></div>'''

SENT_OLD = '''    <div id="signinSent" hidden>
      <div class="m-cur"><div class="m-cur-mark">C</div>
        <div class="m-cur-say">The link is on its way to <b id="signinAddr"></b>.
          Open it and I&rsquo;ll have everything just as you left it &mdash; the
          link works on any device.<span class="sig">&mdash;&thinsp;C.</span></div></div>'''

SENT_NEW = '''    <div id="signinSent" hidden>
      <div class="m-head"><div class="m-mark">C</div>
        <div class="m-title">Curator&rsquo;s Note</div></div>
      <div class="m-rule"><span class="m-fleuron">&#10086;</span></div>
      <div class="m-say">The link is on its way to <b id="signinAddr"></b>.
          Open it and I&rsquo;ll have everything just as you left it &mdash; the
          link works on any device.<span class="sig">&mdash;&thinsp;C.</span></div>'''

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

    # every class the markup uses must now have a rule — the fault being fixed
    for cls in ['.m-card', '.m-head', '.m-title', '.m-rule', '.m-say', '.m-x',
                '.m-photo', '.m-safe', '.m-body']:
        if not re.search(r'(?<![\w-])' + re.escape(cls) + r'[\s,{:]', sa):
            die('%s is used in markup and has no rule' % cls)
    if '.m-cur-say' in markup(after) or '.m-cur-mark' in markup(after):
        die('the invented class names survive in markup')

    # Garamond floor. Undersized type is the recurring rejection in this file.
    m = re.search(r'\.m-say\{([^}]*)\}', sa)
    size = re.search(r'font-size:([\d.]+)rem', m.group(1))
    if not size or float(size.group(1)) < 1.25:
        die('the letter is set below the Garamond floor')
    b = re.search(r'\.m-card \.btn\{([^}]*)\}', sa)
    bs = re.search(r'font-size:([\d.]+)rem', b.group(1))
    if not bs or float(bs.group(1)) < 1.1:
        die('the actions are set below 1.1rem — micro-links')

    # photograph and actions on one line, per the mockup
    mb = re.search(r'\.m-body\{([^}]*)\}', sa)
    if 'display:flex' not in mb.group(1): die('the photograph and actions are not side by side')

    if inline_script(before) != inline_script(after): die('script changed; this build declares none')
    ids = re.findall(r'\bid="([^"]+)"', markup(after))
    if len(ids) != EXPECT_IDS: die('id count %d, expected %d' % (len(ids), EXPECT_IDS))
    if len(set(ids)) != len(ids): die('duplicate ids')
    if sa.count('{') != sa.count('}'): die('style braces unbalanced')

    vis = re.sub(r'<!--.*?-->', '', markup(after), flags=re.S)
    vis = re.sub(r'<div class="readout">.*?</table>\s*</div>', '', vis, flags=re.S | re.I)
    vis = re.sub(r'<[^>]+>', ' ', vis).lower()
    for w in BANNED:
        if re.search(r'\b' + re.escape(w) + r'\w*', vis):
            die('banned vocabulary in customer-visible text: %r' % w)

    print('  gate: every class has a rule, Garamond above its floor, evidence beside the answer')


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

const MSG = 'We see three women posing in a room in your photograph.';
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

  const m = d.getElementById('redirectModal');
  if (!m.classList.contains('is-open')) fail('the note did not open');
  if (w.getComputedStyle(m).position !== 'fixed') fail('not an overlay');

  const card = m.querySelector('.m-card');
  if (parseFloat(w.getComputedStyle(card).opacity) !== 1) fail('the card is transparent');

  // the note is assembled the way the mockup says
  if (!m.querySelector('.m-head .m-mark')) fail('no Curator mark');
  if (m.querySelector('.m-title').textContent.indexOf('Curator') !== 0) fail('no title');
  if (m.querySelectorAll('.m-rule').length !== 2) fail('expected two rules');
  if (!m.querySelector('.m-body .m-photo img')) fail('the photograph is not in the body row');
  if (m.querySelectorAll('.m-body .acts .btn').length !== 2) fail('expected two actions beside it');

  // it says what it should, over their photograph
  if (d.getElementById('redirectSay').textContent.indexOf(MSG) !== 0) fail('message not shown');
  if (d.getElementById('redirectPhoto').getAttribute('src').slice(0,5) !== 'data:')
    fail('their photograph is not shown');
  if (!d.getElementById('redirectWarn').textContent.match(/unexpected/)) fail('caution missing');

  // the mark is a mark, not a stray letter on the page
  const mk = w.getComputedStyle(m.querySelector('.m-mark'));
  if (mk.borderRadius.indexOf('50%') < 0) fail('the mark is not a disc');
  if (!/rgb/.test(mk.backgroundColor)) fail('the mark has no ground');

  // sign-in wears the same shell
  const s = d.getElementById('signinModal');
  if (!s.querySelector('.m-head .m-mark')) fail('sign-in did not inherit the note header');
  if (!s.querySelector('.m-say')) fail('sign-in letter not restyled');

  // the buttons still work after the rebuild
  d.getElementById('redirectNew').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(80);
  if (m.classList.contains('is-open')) fail('the actions lost their listeners in the rebuild');

  if (errs.length) fail(errs.join(' | '));
  console.log("OK  Curator's Note: mark, rules, letter, photograph beside its answer · sign-in inherits");
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s89.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s89.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    REG = sys.argv[3] if len(sys.argv) > 3 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    for nm, a in [('css', CSS_ANCHOR), ('modal', MODAL_OLD), ('signin', SIGNIN_OLD),
                  ('sent', SENT_OLD)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (nm, before.count(a)))

    after = before.replace(CSS_ANCHOR, CSS_ADD + CSS_ANCHOR)
    after = after.replace(MODAL_OLD, MODAL_NEW)
    after = after.replace(SIGNIN_OLD, SIGNIN_NEW)
    after = after.replace(SENT_OLD, SENT_NEW)

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
