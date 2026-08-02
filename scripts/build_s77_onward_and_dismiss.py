#!/usr/bin/env python3
"""
build_s77_onward_and_dismiss.py  —  CUI V24, 2026-07-31

IN   public/litenco-stage-2026-07-31-s76.html
OUT  public/litenco-stage-2026-07-31-s77.html

Two faults Rich found on the glass. Neither is a copy change.

FAULT 1 — the promotional cards showed the customer's own work.

  Cards 2 and 3 read p.art off the landed pieces: Print Shop showed four of
  their crafts, one framed, and the phone showed their newest. Ruled: the
  content of those cards is marketing's, not product engineering's. They now
  read fixed assets from /previews/onward/ and never touch PIECES.

  Card 1 is untouched — it already reads silo art, which is product art, not
  a customer's piece.

  ASSETS NOT ON DISK YET. Four for the strip and one for the phone:

      public/previews/onward/print-1.jpg
      public/previews/onward/print-2.jpg
      public/previews/onward/print-3.jpg     <- the framed one
      public/previews/onward/print-4.jpg
      public/previews/onward/wallpaper.jpg

  Until they land, each img hides itself on error rather than showing a
  broken-image icon — the three silo files have been showing 404 icons on
  the floor all day and that is the same fault twice.

FAULT 2 — a filter click closed My Collection.

  Not the filter. Clicking one calls renderCollection(), which rebuilds
  mcFilters.innerHTML and destroys the button that was clicked. The
  document-level dismiss listener then runs, asks the now-DETACHED node
  whether it sits inside #mycoll, gets null because it sits in no tree at
  all, concludes the click was outside the panel, and closes it.

  So the bug is in the dismiss listener and every in-panel control that
  re-renders would trip it — the onward buttons next.

  Fixed by deciding containment in the CAPTURE phase, which runs before any
  handler can re-render, while e.target is still attached. The bubble-phase
  listener then reads the recorded answer instead of asking a corpse.

  Failure class: DOM identity tested after a re-render. Gated below.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-07-31-s76.html'
DST_DEFAULT = 'public/litenco-stage-2026-07-31-s77.html'
REG_DEFAULT = 'public/effect-registry.js'

# ---- fault 1 -------------------------------------------------------------
PRINT_OLD = '''    /* 2 · print shop — their own pieces, one of them framed */
    var four = done.slice(0, 4);
    var c2 = owCard('print');
    c2.innerHTML = owHead('frame') +
      '<div class="ow-strip">' + four.map(function(p, i){
        return '<div class="ow-th' + (i === 2 ? ' is-framed' : '') + '">' +
               '<img src="' + esc(p.art) + '" alt="" loading="lazy"></div>';
      }).join('') + '</div>' +'''

PRINT_NEW = '''    /* 2 · print shop — MARKETING ART, never the customer's own pieces.
       Ruled 2026-07-31. This card sells the Print Shop; it is not a view of
       their collection, and their collection is already six inches above it. */
    var c2 = owCard('print');
    c2.innerHTML = owHead('frame') +
      '<div class="ow-strip">' + OW_PRINT.map(function(src, i){
        return '<div class="ow-th' + (i === 2 ? ' is-framed' : '') + '">' +
               '<img src="' + esc(src) + '" alt="" loading="lazy" ' + OW_HIDE + '></div>';
      }).join('') + '</div>' +'''

PHONE_OLD = '''    /* 3 · wallpapers — their newest piece, on a phone drawn in CSS. No device
       asset on disk, and one more image to keep in step is one more to go
       stale. */
    var newest = done[0];
    var c3 = owCard('phone');'''

PHONE_NEW = '''    /* 3 · wallpapers — MARKETING ART on a phone drawn in CSS. Ruled
       2026-07-31, same reason as the card beside it. The device stays CSS:
       one more image to keep in step is one more to go stale. */
    var c3 = owCard('phone');'''

PHONE_IMG_OLD = '''          '<img src="' + esc(newest.art) + '" alt="">' +'''
PHONE_IMG_NEW = '''          '<img src="' + esc(OW_WALL) + '" alt="" ' + OW_HIDE + '>' +'''

# declared above renderOnward, beside OW_ICONS, which is where the file
# already keeps the constants renderOnward reads at init
CONST_ANCHOR = '''  var OW_ICONS = {'''
CONST_ADD = '''  /* Marketing's, not product engineering's — ruled 2026-07-31. Fixed art,
     read by the two promotional cards, which must never show a customer's
     own Crafted Image. Not on disk yet; each img hides itself rather than
     leaving a broken-image icon where a photograph should be. */
  var OW_PRINT = ['/previews/onward/print-1.jpg', '/previews/onward/print-2.jpg',
                  '/previews/onward/print-3.jpg', '/previews/onward/print-4.jpg'];
  var OW_WALL  = '/previews/onward/wallpaper.jpg';
  var OW_HIDE  = 'onerror="this.style.visibility=\\'hidden\\'"';

'''

# ---- fault 2 -------------------------------------------------------------
DISMISS_OLD = '''  addEventListener('click', function(e){
    if (!mycoll || !mycoll.classList.contains('is-open')) return;
    if (lbox && lbox.classList.contains('is-open')) return;  /* it dismisses itself */
    if (e.target.closest('#mycoll')) return;                 /* inside the panel */
    if (e.target.closest('.mh-nav a, .mh-drawer a')) return; /* the link toggles */
    hideCollection();
  });'''

DISMISS_NEW = '''  /* Where the click STARTED, decided in the capture phase.

     The bubble-phase listener below used to ask e.target whether it sat
     inside the panel. By then a filter button has already run its own
     handler, which calls renderCollection() and replaces mcFilters.innerHTML
     — so the node being questioned has been removed from the document, its
     closest() walks a detached fragment, finds no #mycoll, and the panel
     closes on a click that was plainly inside it.

     Capture runs before any handler can re-render. Ask then; answer later. */
  var CLICK_IN_PANEL = false, CLICK_ON_LINK = false;
  addEventListener('click', function(e){
    var t = e.target;
    CLICK_IN_PANEL = !!(t && t.closest && t.closest('#mycoll'));
    CLICK_ON_LINK  = !!(t && t.closest && t.closest('.mh-nav a, .mh-drawer a'));
  }, true);

  addEventListener('click', function(e){
    if (!mycoll || !mycoll.classList.contains('is-open')) return;
    if (lbox && lbox.classList.contains('is-open')) return;  /* it dismisses itself */
    if (CLICK_IN_PANEL) return;                              /* inside the panel */
    if (CLICK_ON_LINK) return;                               /* the link toggles */
    hideCollection();
  });'''

EXPECT_FETCHES = 5
EXPECT_IDS     = 71
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
    out, i, n = [], 0, len(js)
    while i < n:
        c = js[i]
        if c in '"\'`':
            q = c; out.append(c); i += 1
            while i < n:
                if js[i] == '\\': out.append(js[i:i+2]); i += 2; continue
                out.append(js[i])
                if js[i] == q: i += 1; break
                i += 1
            continue
        if js.startswith('//', i):
            while i < n and js[i] != '\n': i += 1
            continue
        if js.startswith('/*', i):
            j = js.find('*/', i + 2); i = (j + 2) if j != -1 else n
            continue
        out.append(c); i += 1
    return ''.join(out)


def gate(before, after):
    a_js = inline_script(after); a_code = strip_comments(a_js)
    b_code = strip_comments(inline_script(before))

    # fault 1 — no customer art may reach the promotional cards
    ro = a_code.index('function renderOnward')
    body = a_code[ro:a_code.index('function owCard') if 'function owCard' in a_code[ro:] else ro + 2600]
    body = a_code[ro:ro + 2600]
    c23 = body[body.index('2 \u00b7 print shop') if '2 \u00b7 print shop' in body else 0:]
    if 'p.art' in c23 or 'newest.art' in c23:
        die('a promotional card still reads a customer piece')
    if 'OW_PRINT' not in a_code or 'OW_WALL' not in a_code:
        die('marketing assets not declared')
    if a_code.count('var newest') != 0:
        die('newest still computed — dead after the change')

    # constants above their caller
    if a_code.index('var OW_PRINT') > ro: die('OW_PRINT declared below renderOnward (TDZ)')
    if a_code.index('var OW_WALL')  > ro: die('OW_WALL declared below renderOnward (TDZ)')

    # fault 2 — containment decided in capture, not after a re-render
    if "if (e.target.closest('#mycoll')) return;" in a_code:
        die('dismiss still questions e.target after handlers have run')
    if a_code.count('}, true);') < 1:
        die('no capture-phase listener')
    cap = a_code.index('CLICK_IN_PANEL = ')
    use = a_code.index('if (CLICK_IN_PANEL) return;')
    if cap > use:                     die('flag read before it is set')

    nf = len(re.findall(r'\bfetch\s*\(', a_code))
    if nf != EXPECT_FETCHES:          die('fetch count %d, expected %d' % (nf, EXPECT_FETCHES))

    def decls(c): return set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', c))
    lost = decls(b_code) - decls(a_code)
    if lost:                          die('functions lost: %s' % sorted(lost))

    ids = re.findall(r'\bid="([^"]+)"', markup(after))
    if len(ids) != EXPECT_IDS:        die('id count %d, expected %d' % (len(ids), EXPECT_IDS))
    if markup(before) != markup(after):  die('markup changed; this build declares none')
    if styles(before) != styles(after):  die('style block changed; this build declares none')

    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write(a_js); tmp = t.name
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    if r.returncode != 0:             die('node --check: ' + r.stderr.strip().splitlines()[0])

    vis = re.sub(r'<!--.*?-->', '', markup(after), flags=re.S)
    vis = re.sub(r'<div class="readout">.*?</table>\s*</div>', '', vis, flags=re.S | re.I)
    vis = re.sub(r'<[^>]+>', ' ', vis).lower()
    for w in BANNED:
        if re.search(r'\b' + re.escape(w) + r'\w*', vis):
            die('banned vocabulary in customer-visible text: %r' % w)

    print('  gate: no customer art on the promo cards, containment in capture, 5 routes held')


BOOT = r'''
const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const reg  = fs.readFileSync(process.argv[3], 'utf8');
const errs = [];
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, d = dom.window.document;
w.addEventListener('error', e => errs.push('window error: ' + e.message));
const fail = m => { console.log('FAIL ' + m); process.exit(1); };

const j = o => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(o) });
w.fetch = (url, opt) => {
  if (url.includes('/analyze')) return j({ result: { quality_verdict:'green', smallest_face_min_dim_px:500 } });
  if (url.includes('/portraits/gate')) return j({ status:'ok' });
  if (url.includes('/curate-effects')) return j({ ok:true, recommendations: [] });
  if (url.includes('/credits/gate')) return j({ ok:true, balance_after:490 });
  if (url.includes('/generate')) return j({ result:{ image_b64:'CUSTOMERPIECE', duration_ms:900,
                                                     scores:{ likeness: 8.4 } } });
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

  // craft one real piece so the promo cards have something to wrongly show
  const f = new w.File([new w.Uint8Array([1,2,3])], 'p.jpg', { type:'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value:[f], configurable:true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(300);
  const room = [...d.querySelectorAll('#siloFloor .silo-card')]
    .find(c => w.EFFECT_REGISTRY.offerableBySilo(c.dataset.siloId).length);
  room.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1200);
  d.querySelector('#effectFloor .silo-card[data-effect-id]')
   .dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1200);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1200);

  const mycoll = d.getElementById('mycoll');
  if (!mycoll.classList.contains('is-open')) fail('collection did not open on first landing');

  // FAULT 1 — the customer's piece must appear in the grid and NOWHERE ELSE
  const grid = d.querySelector('#mcGrid');
  if (!/CUSTOMERPIECE/.test(grid.innerHTML)) fail('the piece never reached the grid');
  const onward = d.getElementById('mcOnward');
  if (/CUSTOMERPIECE/.test(onward.innerHTML))
    fail('a promotional card is showing the customer\'s own piece');
  if (!/previews\/onward\/print-3\.jpg/.test(onward.innerHTML)) fail('print card art missing');
  if (!/previews\/onward\/wallpaper\.jpg/.test(onward.innerHTML)) fail('wallpaper card art missing');
  if ((onward.innerHTML.match(/onerror=/g) || []).length !== 5) fail('marketing images not fail-safe');

  // FAULT 2 — a filter click must NOT close the panel
  const pill = d.querySelector('#mcFilters [data-filter="Portraits"]');
  if (!pill) fail('filters not rendered');
  pill.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  if (!mycoll.classList.contains('is-open'))
    fail('a filter click closed the collection — the dismiss listener still questions a detached node');
  const on = d.querySelector('#mcFilters .mc-filter.is-on');
  if (!on || on.dataset.filter !== 'Portraits') fail('filter did not take');

  // View All too, since it re-renders the same way
  d.querySelector('#mcFilters [data-filter="all"]').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  if (!mycoll.classList.contains('is-open')) fail('View All closed the collection');

  // and the dismiss must still WORK — a fix that never closes is not a fix
  d.body.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  if (mycoll.classList.contains('is-open')) fail('clicking outside no longer dismisses');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  piece in the grid only · promo art fixed & fail-safe · filters hold · outside still dismisses');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s77.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s77.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    REG = sys.argv[3] if len(sys.argv) > 3 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    for nm, a in [('const', CONST_ANCHOR), ('print', PRINT_OLD), ('phone', PHONE_OLD),
                  ('phoneimg', PHONE_IMG_OLD), ('dismiss', DISMISS_OLD)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (nm, before.count(a)))

    after = before.replace(CONST_ANCHOR, CONST_ADD + CONST_ANCHOR)
    after = after.replace(PRINT_OLD, PRINT_NEW)
    after = after.replace(PHONE_OLD, PHONE_NEW)
    after = after.replace(PHONE_IMG_OLD, PHONE_IMG_NEW)
    after = after.replace(DISMISS_OLD, DISMISS_NEW)

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
