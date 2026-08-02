#!/usr/bin/env python3
"""
build_s83_craft_opens_collection.py  —  CUI V24, 2026-08-01
IN   public/litenco-stage-2026-08-01-s82.html
OUT  public/litenco-stage-2026-08-01-s83.html

Rich, on the glass: "there is a big disconnect between clicking the craft
button and arriving at My Collection for the finished piece."

WHAT WAS WRONG
  The collection opened when the FIRST PIECE LANDED — around thirty seconds
  after Craft, and longer when the likeness gate retries, which it does. In
  between, nothing. The rail changed a border colour and the button counted
  down, and the customer sat in the workshop wondering whether the click had
  registered at all.

  Thirty seconds of silence directly after taking someone's money is the
  worst place in the product to have nothing to look at.

NOW
  The collection opens the moment the credits clear, with a tile already
  there for every piece — waiting, named, spinning. They watch their work
  arrive instead of wondering whether it will.

  Nothing new was needed to draw it. pieceTile() has carried an is-crafting
  branch since s72 — ring, veil, "Crafting…" — and it has only ever been seen
  on seed data. __pieceLanded already replaces a tile in place. The pieces
  simply never had anywhere to wait.

ORDER MATTERS, AND IT IS EXACT
  After spendCredits resolves true. Not before.

    · not on the click, because sign-in may intervene, or the balance may be
      short, and opening the collection onto pieces that will never be
      crafted is a lie told in the customer's own gallery.
    · not on the first landing, which is the fault being fixed.

  Credits clearing is the moment the work is certain. That is when it shows.

AND IF ONE DOES NOT ARRIVE
  A waiting tile whose craft failed must not spin for ever. Failed, rejected
  and redirected pieces are withdrawn as their run ends — the refund message
  on the rail already says what happened, and a permanent spinner would
  contradict it.

Route calls stay at 8. No markup, no CSS.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-08-01-s82.html'
DST_DEFAULT = 'public/litenco-stage-2026-08-01-s83.html'
REG_DEFAULT = 'public/effect-registry.js'

# ---- the pieces take their place, and the collection opens ---------------
SPEND_OK_OLD = '''      return craftPending().then(function(){'''
SPEND_OK_NEW = '''      /* The credits have cleared, so the work is certain. Show them where it
         will appear, with a place already held for every piece. */
      openWaiting(pending);
      return craftPending().then(function(){'''

WAIT_ANCHOR = '''  function craftPending(){'''
WAIT_ADD = '''  /* ---- a place held for each piece --------------------------------------
     pieceTile() has drawn an is-crafting tile since s72 — ring, veil,
     "Crafting…" — and it has only ever been seen on seed data. The pieces
     never had anywhere to wait; they arrived or they did not.

     __pieceLanded replaces a tile of the same id in place, so a waiting tile
     becomes the finished piece exactly where the customer was already
     looking. The id is the queue item's, which is what land() uses. */
  function openWaiting(items){
    items.forEach(function(it){
      window.__pieceLanded({
        id:       'q' + it.id,
        name:     effectLabel(it.effectId),
        series:   'Portraits',
        art:      null,
        crafting: true
      });
    });
    if (typeof showCollection === 'function') showCollection();
  }

  /* A tile whose craft never arrived must not spin for ever. The rail has
     already said what happened and offered the credits back; a spinner that
     outlives that would contradict it in the customer's own gallery. */
  function withdrawWaiting(items){
    if (!items.length) return;
    var gone = {};
    items.forEach(function(it){ gone['q' + it.id] = true; });
    for (var i = PIECES.length - 1; i >= 0; i--){
      if (gone[PIECES[i].id] && PIECES[i].crafting) PIECES.splice(i, 1);
    }
    renderCollection();
  }

'''

# withdraw the ones that never arrived, wherever the run ends
TAIL_OLD = '''        if (!owed.length){ clearFinished(); return; }'''
TAIL_NEW = '''        withdrawWaiting(owed);
        if (!owed.length){ clearFinished(); return; }'''

EXPECT_FETCHES = 8
EXPECT_IDS     = 80
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
    a_js = inline_script(after); a_code = strip_comments(a_js)
    b_code = strip_comments(inline_script(before))

    for need in ['openWaiting', 'withdrawWaiting']:
        if 'function ' + need not in a_code: die('%s not declared' % need)
    if a_code.index('function openWaiting') > a_code.index('function runAll'):
        die('openWaiting declared below runAll')

    # the ordering this build exists for: after the charge clears, never before
    ra = a_code.index('function runAll')
    seg = a_code[ra:ra + 2600]
    if 'openWaiting(pending)' not in seg: die('runAll never opens the collection')
    if seg.index('spendCredits') > seg.index('openWaiting('):
        die('the collection opens before the credits clear')
    if seg.index('openWaiting(') > seg.index('craftPending()'):
        die('the collection opens after the crafting has begun')
    if 'withdrawWaiting(owed)' not in seg: die('failed pieces would spin for ever')

    nf = len(re.findall(r'\bfetch\s*\(', a_code))
    if nf != EXPECT_FETCHES: die('fetch count %d, expected %d' % (nf, EXPECT_FETCHES))

    def decls(c): return set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', c))
    lost = decls(b_code) - decls(a_code)
    if lost: die('functions lost: %s' % sorted(lost))

    ids = re.findall(r'\bid="([^"]+)"', markup(after))
    if len(ids) != EXPECT_IDS: die('id count %d, expected %d' % (len(ids), EXPECT_IDS))
    if markup(before) != markup(after): die('markup changed; this build declares none')
    if styles(before) != styles(after): die('style block changed; this build declares none')

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

    print('  gate: opens after the charge and before the crafting, failures withdrawn, 8 routes')


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
  setItem: (k,v) => { store[k]=String(v); },
  removeItem: k => { delete store[k]; }
}, configurable: true });

let genOk = true, hold = null;
const j = (o, ok=true, st=200) => Promise.resolve({ ok, status:st, json:() => Promise.resolve(o) });
w.fetch = (url) => {
  if (url.includes('/auth/me')) return j({ user:{ id:'uid-1', email:'r@x.com' } });
  if (url.includes('/analyze')) return j({ result:{ quality_verdict:'green', smallest_face_min_dim_px:500 } });
  if (url.includes('/portraits/gate')) return j({ status:'ok' });
  if (url.includes('/curate-effects')) return j({ ok:true, recommendations: [] });
  if (url.includes('/credits/gate')) return j({ ok:true, ref_id:'craft_x', balance_after:490 });
  if (url.includes('/credits/refund')) return j({ ok:true, refunded:10, balance_after:500 });
  if (url.includes('/generate')){
    if (!genOk) return j({ status:'redirected', redirect:{ series:'groups' } });
    // held open so the WAITING state can be observed mid-flight
    return new Promise(res => { hold = () => res({ ok:true, status:200,
      json:() => Promise.resolve({ result:{ image_b64:'AAAA', duration_ms:900, scores:{ likeness:8.4 } } }) }); });
  }
  return j({});
};
w.Image = class { set src(v){ this.naturalWidth=1200; this.naturalHeight=1600;
  if (this.onload) setTimeout(() => this.onload(), 0); } };

try { w.eval(reg); } catch (e) { console.log('FAIL registry'); process.exit(1); }
try { w.eval(html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1]); }
catch (e) { console.log('FAIL boot threw: ' + e.message); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { console.log('FAIL ' + m); process.exit(1); };
const mycoll = () => d.getElementById('mycoll');
const waiting = () => d.querySelectorAll('#mcGrid .piece.is-crafting').length;

async function openARoom(){
  for (const c of d.querySelectorAll('#siloFloor .silo-card')){
    c.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
    await sleep(900);
    if (d.querySelector('#effectFloor .silo-card[data-effect-id]')) return true;
    const b = d.getElementById('crumbLabel');
    if (b) b.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
    await sleep(900);
  }
  return false;
}

(async () => {
  await sleep(80);
  if (!d.getElementById('tbcGoVerb').textContent.trim()) fail('rail button never labelled');

  const f = new w.File([new w.Uint8Array([1,2,3])], 'p.jpg', { type:'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value:[f], configurable:true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(300);
  if (!await openARoom()) fail('no room offers anything craftable');
  d.querySelector('#effectFloor .silo-card[data-effect-id]')
   .dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1100);

  // ---- the collection must NOT be open before Craft
  if (mycoll().classList.contains('is-open')) fail('collection open before Craft');

  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(400);

  // ---- MID-FLIGHT: open, with a place held, and nothing finished yet
  if (!mycoll().classList.contains('is-open'))
    fail('the collection did not open when the credits cleared');
  if (waiting() !== 1) fail('waiting tiles: ' + waiting() + ', expected 1');
  if (d.querySelectorAll('#mcGrid .piece__img').length) fail('a finished image showed before it landed');

  // ---- and the piece replaces its own waiting tile
  hold();
  await sleep(600);
  if (waiting() !== 0) fail('the tile is still waiting after the piece landed');
  const done = d.querySelectorAll('#mcGrid .piece__img, #mcGrid .mc-feat').length;
  if (!done) fail('the finished piece never appeared');

  // ---- A RUN THAT DELIVERS NOTHING MUST NOT LEAVE A TILE SPINNING
  genOk = false;
  d.getElementById('mcClose').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(120);
  if (!d.querySelector('#effectFloor .silo-card[data-effect-id]:not(.is-selected)')) await openARoom();
  d.querySelector('#effectFloor .silo-card[data-effect-id]:not(.is-selected)')
   .dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1100);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1400);
  if (waiting() !== 0) fail('a redirected piece is still spinning in the collection');
  if (!d.getElementById('tbcGoSub').textContent.match(/credits are back/))
    fail('the rail did not report the refund');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  opens on the charge · place held · tile becomes the piece · failures withdrawn');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s83.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s83.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    REG = sys.argv[3] if len(sys.argv) > 3 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    for nm, a in [('spend', SPEND_OK_OLD), ('wait', WAIT_ANCHOR), ('tail', TAIL_OLD)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (nm, before.count(a)))

    after = before.replace(WAIT_ANCHOR, WAIT_ADD + WAIT_ANCHOR)
    after = after.replace(SPEND_OK_OLD, SPEND_OK_NEW)
    after = after.replace(TAIL_OLD, TAIL_NEW)

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
