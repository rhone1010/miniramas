#!/usr/bin/env python3
"""
build_s79_feat_size_and_exits.py  —  CUI V24, 2026-07-31

IN   public/litenco-stage-2026-07-31-s78.html
OUT  public/litenco-stage-2026-07-31-s79.html

Two rulings from Rich on the glass.

RULING 1 — the featured tile is 500px at 2560, and locked.

  It was capped at 400px by clamp(300px, 24vw, 400px), and had been since s72
  — nothing since then touched the style block. It read smaller today because
  the seeds went off in s76 and the minimap beside it emptied out, not
  because it shrank.

  Now a fixed ladder, in px, one value per breakpoint. Not vw arithmetic: a
  locked size should be readable in the file and assertable in the gate, and
  a viewport unit is neither.

      >= 2400   500px
      1920      460px
      1600      420px
      1367      30% of the panel   (unchanged)
      <= 1366   360px max          (was 320px)

  The gate asserts all five. They cannot drift silently.

RULING 2 — My Collection closes on the Back button or the masthead link. Only.

  Rich clicked outside the full-size view and landed in the workshop with the
  collection shut.

  Cause, and it is the same failure class as the filter bug two builds ago:
  state read after another handler changed it. The lightbox dismisses itself
  on an outside click and removes is-open. The collection's document listener
  then runs, checks whether the lightbox is open, finds it is not — because it
  just closed — decides the click was loose on the page, and closes the panel
  too. One click, two dismissals, and the guard was true when it was written
  and false by the time it was read.

  Capture phase would fix the reading. It would not fix the ruling: the panel
  should not close on a stray click at all. So the outside-click dismiss is
  removed entirely, and with it the whole class of accident.

  Escape goes too. Rich said only those two ways out. Escape still closes the
  lightbox — that listener is untouched and is the one that should have it.

  Removed with it: CLICK_IN_PANEL and CLICK_ON_LINK, the capture-phase flags
  added in s77 for the listener that no longer exists.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-07-31-s78.html'
DST_DEFAULT = 'public/litenco-stage-2026-07-31-s79.html'
REG_DEFAULT = 'public/effect-registry.js'

# ---- ruling 1 ------------------------------------------------------------
CSS_OLD = '''.mc-latest{
  display:grid;
  grid-template-columns:minmax(260px, clamp(300px,24vw,400px)) minmax(0,1fr);
  gap:clamp(14px,1.2vw,24px);
  align-items:start;
}'''

CSS_NEW = '''/* LOCKED 2026-07-31 by Rich: 500px at 2560, stepped down per breakpoint.
   Fixed px on purpose — a locked measurement should be legible in the file
   and assertable by the gate, and a vw expression is neither. The ladder
   below is the whole of it; there is no other rule that sizes this tile. */
.mc-latest{
  display:grid;
  grid-template-columns:500px minmax(0,1fr);
  gap:clamp(14px,1.2vw,24px);
  align-items:start;
}
@media (max-width:2399px){ .mc-latest{ grid-template-columns:460px minmax(0,1fr) } }
@media (max-width:1919px){ .mc-latest{ grid-template-columns:420px minmax(0,1fr) } }'''

BP_OLD = '''@media (max-width:1599px){
  .mc-latest{ grid-template-columns:minmax(230px, 30%) minmax(0,1fr) }
}
@media (max-width:1366px){
  .mc-latest{ grid-template-columns:1fr; gap:12px }
  .mc-feat{ max-width:320px }
}'''

BP_NEW = '''@media (max-width:1599px){
  .mc-latest{ grid-template-columns:minmax(230px, 30%) minmax(0,1fr) }
}
@media (max-width:1366px){
  .mc-latest{ grid-template-columns:1fr; gap:12px }
  .mc-feat{ max-width:360px }
}'''

# ---- ruling 2 ------------------------------------------------------------
ESC_OLD = '''  addEventListener('keydown', function(e){
    if (e.key !== 'Escape') return;
    if (lbox && lbox.classList.contains('is-open')) return;   /* lightbox first */
    if (mycoll && mycoll.classList.contains('is-open')) hideCollection();
  });'''

ESC_NEW = '''  /* Escape no longer closes the collection — ruled 2026-07-31, two ways out
     and no others. It still closes the lightbox; that listener is elsewhere
     and untouched, and it is the one that should have the key. */'''

# everything from the old preamble through the end of the dismiss listener
DISMISS_START = '''  /* The workshop is its own way out.'''
DISMISS_END   = '''    hideCollection();
  });

  renderCollection();'''

DISMISS_NEW = '''  /* MY COLLECTION CLOSES TWO WAYS. Ruled 2026-07-31.

       Back to the workshop  ·  the masthead link

     Nothing else. There was a document-level listener here that closed the
     panel on any click outside it, and it cost Rich his place: clicking
     outside the full-size view dismissed the lightbox, and the same click
     then reached this listener, which asked whether the lightbox was open,
     was told no — because it had just closed — and shut the collection as
     well.

     The same shape as the filter fault in s77: a guard that was true when it
     was written and false by the time it was read. That one was fixed by
     asking in the capture phase. This one is fixed by not asking, because
     the panel should not answer a stray click in the first place.

     Removed with it: CLICK_IN_PANEL and CLICK_ON_LINK, which existed only to
     feed the listener that is gone. */

  renderCollection();'''

EXPECT_FETCHES = 6
EXPECT_IDS     = 71
BANNED = ['sculpt', 'sculpted', 'sculpture', 'discount', 'in-situ', 'in situ',
          'render', 'queue']
LADDER = [('500px', None), ('460px', 2399), ('420px', 1919), ('360px', 1366)]


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
    """Blank every comment, using a real parser.

    The hand-rolled stripper this replaces tracked quotes by hand and could
    not tell a regex literal from a division. `.replace(/"/g, '&quot;')`
    inside esc() read as an unterminated string, and every assertion made
    against the text after it was searching garbage. Comments are blanked,
    not deleted, so offsets and line numbers still match the input."""
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write(js); tmp = t.name
    r = subprocess.run(['node', 'scripts/strip_comments.js', tmp],
                       capture_output=True, text=True)
    os.unlink(tmp)
    if r.returncode != 0:
        die('comment strip failed: ' + r.stderr.strip())
    return r.stdout


def gate(before, after):
    a_js = inline_script(after); a_code = strip_comments(a_js)
    b_code = strip_comments(inline_script(before))
    sa = styles(after)

    # ruling 1 — the ladder, every rung
    if 'clamp(300px,24vw,400px)' in sa: die('the old 400px cap survives')
    if 'grid-template-columns:500px minmax(0,1fr)' not in sa: die('500px rung missing')
    for px, bp in LADDER:
        if px not in sa: die('%s rung missing from the ladder' % px)
    for bp in [2399, 1919]:
        if '@media (max-width:%dpx)' % bp not in sa: die('breakpoint %d missing' % bp)
    if 'max-width:320px' in sa: die('the 1366 tile is still 320px')
    # nothing else may size this tile
    # five rungs: base, 2399, 1919, 1599, 1366. Any sixth is a rule nobody
    # declared and the ladder stops being the whole story.
    if len(re.findall(r'\.mc-latest\{[^}]*grid-template-columns', sa)) != 5:
        die('mc-latest is sized in %d places, expected 5'
            % len(re.findall(r'\.mc-latest\{[^}]*grid-template-columns', sa)))

    # ruling 2 — no loose dismissal remains
    if re.search(r'\bvar\s+CLICK_IN_PANEL\b', a_code):
        die('the capture-phase flags are still declared with no consumer')
    if re.search(r"addEventListener\('click',[^;]*?\}, true\);", a_code, re.S):
        die('the capture-phase click listener survives')
    if re.search(r"if \(mycoll && mycoll\.classList\.contains\('is-open'\)\) hideCollection\(\);\s*\}\);\s*$",
                 a_code, re.M):
        pass
    esc = re.search(r"e\.key !== 'Escape'[\s\S]{0,240}", a_code)
    if esc and 'hideCollection' in esc.group(0):
        die('Escape still closes the collection')
    # exactly two callers of hideCollection: the Back button and the masthead link
    # leading \b matters: without it, window.__hideCollection matches twice
    callers = len(re.findall(r'\bhideCollection\b', a_code))
    if callers != 4:   # 1 declaration + 2 callers + 1 window export
        die('hideCollection referenced %d times, expected 4 '
            '(declaration, Back, masthead, export)' % callers)

    nf = len(re.findall(r'\bfetch\s*\(', a_code))
    if nf != EXPECT_FETCHES: die('fetch count %d, expected %d' % (nf, EXPECT_FETCHES))

    def decls(c): return set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', c))
    lost = decls(b_code) - decls(a_code)
    if lost: die('functions lost: %s' % sorted(lost))

    ids = re.findall(r'\bid="([^"]+)"', markup(after))
    if len(ids) != EXPECT_IDS: die('id count %d, expected %d' % (len(ids), EXPECT_IDS))
    if markup(before) != markup(after): die('markup changed; this build declares none')
    if sa.count('{') != sa.count('}'): die('style braces unbalanced')

    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write(a_js); tmp = t.name
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    if r.returncode != 0: die('node --check: ' + r.stderr.strip().splitlines()[0])

    vis = re.sub(r'<!--.*?-->', '', markup(after), flags=re.S)
    vis = re.sub(r'<div class="readout">.*?</table>\s*</div>', '', vis, flags=re.S | re.I)
    vis = re.sub(r'<[^>]+>', ' ', vis).lower()
    for w in BANNED:
        if re.search(r'\b' + re.escape(w) + r'\w*', vis):
            die('banned vocabulary in customer-visible text: %r' % w)

    print('  gate: ladder 500/460/420/30%/360 locked, no loose dismissal, 6 routes held')


BOOT = r'''
const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const reg  = fs.readFileSync(process.argv[3], 'utf8');
const errs = [];
const dom = new JSDOM(html, { runScripts:'outside-only', pretendToBeVisual:true, url:'http://localhost/' });
const w = dom.window, d = dom.window.document;
w.addEventListener('error', e => errs.push('window error: ' + e.message));
const fail = m => { console.log('FAIL ' + m); process.exit(1); };

const j = o => Promise.resolve({ ok:true, status:200, json:() => Promise.resolve(o) });
w.fetch = (url) => {
  if (url.includes('/analyze')) return j({ result:{ quality_verdict:'green', smallest_face_min_dim_px:500 } });
  if (url.includes('/portraits/gate')) return j({ status:'ok' });
  if (url.includes('/curate-effects')) return j({ ok:true, recommendations: [] });
  if (url.includes('/credits/gate')) return j({ ok:true, balance_after:490 });
  if (url.includes('/generate')) return j({ result:{ image_b64:'AAAA', duration_ms:900, scores:{ likeness:8.4 } } });
  return j({});
};
w.Image = class { set src(v){ this.naturalWidth=1200; this.naturalHeight=1600;
  if (this.onload) setTimeout(() => this.onload(), 0); } };

try { w.eval(reg); } catch (e) { fail('registry: ' + e.message); }
try { w.eval(html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1]); }
catch (e) { fail('boot threw: ' + e.message); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  if (!d.getElementById('tbcGoVerb').textContent.trim()) fail('rail button never labelled');

  // craft one so the collection opens with a piece in it
  const f = new w.File([new w.Uint8Array([1,2,3])], 'p.jpg', { type:'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value:[f], configurable:true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(300);
  const rooms = [...d.querySelectorAll('#siloFloor .silo-card')];
  // ROUTE_ACCEPTS is inside the IIFE and not reachable from here, so drive
  // the floor instead: open rooms until one actually renders a card.
  let room = null;
  for (const c of rooms){
    c.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
    await sleep(900);
    if (d.querySelector('#effectFloor .silo-card[data-effect-id]')){ room = c; break; }
    const back = d.getElementById('crumbLabel');
    if (back) back.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
    await sleep(900);
  }
  if (!room) fail('no room offers anything the route accepts');
  d.querySelector('#effectFloor .silo-card[data-effect-id]')
   .dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1100);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1300);

  const mycoll = d.getElementById('mycoll');
  if (!mycoll.classList.contains('is-open')) fail('collection did not open on landing');

  // --- NO STRAY CLICK MAY CLOSE IT
  d.body.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(40);
  if (!mycoll.classList.contains('is-open')) fail('a click on the page body closed the collection');

  const cur = d.getElementById('cur');
  if (cur){ cur.dispatchEvent(new w.MouseEvent('click', { bubbles:true })); await sleep(40); }
  if (!mycoll.classList.contains('is-open')) fail('clicking the Curator closed the collection');

  // the reported fault: open the full-size view, click outside it
  const feat = d.querySelector('#mcGrid .mc-feat');
  if (!feat) fail('no featured tile');
  feat.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(120);
  const lbox = d.getElementById('lbox');
  if (!lbox || !lbox.classList.contains('is-open')) fail('full-size view did not open');
  lbox.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(120);
  if (lbox.classList.contains('is-open')) fail('full-size view did not dismiss');
  if (!mycoll.classList.contains('is-open'))
    fail('dismissing the full-size view also closed the collection — the reported fault');

  // Escape closes the lightbox, never the collection
  feat.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(120);
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  await sleep(80);
  if (lbox.classList.contains('is-open')) fail('Escape did not close the full-size view');
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  await sleep(80);
  if (!mycoll.classList.contains('is-open')) fail('Escape closed the collection');

  // --- AND THE TWO REAL EXITS STILL WORK
  d.getElementById('mcClose').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(80);
  if (mycoll.classList.contains('is-open')) fail('Back to the workshop no longer closes it');

  const link = [...d.querySelectorAll('.mh-nav a, .mh-drawer a')]
    .find(a => (a.textContent||'').trim().toLowerCase() === 'my collection');
  link.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(80);
  if (!mycoll.classList.contains('is-open')) fail('the masthead link no longer opens it');
  link.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(80);
  if (mycoll.classList.contains('is-open')) fail('the masthead link no longer closes it');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  stray clicks ignored · lightbox dismiss is isolated · Back and masthead still work');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s79.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s79.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    REG = sys.argv[3] if len(sys.argv) > 3 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    for nm, a in [('css', CSS_OLD), ('bp', BP_OLD), ('esc', ESC_OLD),
                  ('dstart', DISMISS_START), ('dend', DISMISS_END)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (nm, before.count(a)))

    i = before.index(DISMISS_START)
    jx = before.index(DISMISS_END) + len(DISMISS_END)
    after = before[:i] + DISMISS_NEW + before[jx:]
    after = after.replace(CSS_OLD, CSS_NEW)
    after = after.replace(BP_OLD, BP_NEW)
    after = after.replace(ESC_OLD, ESC_NEW)

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
