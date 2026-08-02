#!/usr/bin/env python3
"""
build_s85_redirect_visible.py  —  CUI V24, 2026-08-01
IN   public/litenco-stage-2026-08-01-s84.html
OUT  public/litenco-stage-2026-08-01-s85.html

s84 detected the redirect, refunded, and logged it. The customer saw nothing.

WHY
  Two builds an hour apart, each right on its own.

  s83 opens My Collection the moment the credits clear, so the customer
  watches the pieces arrive instead of staring at a workshop. s84 raises the
  studio's objection when the run settles.

  The collection is a full-height slide-over. The offer opened underneath it,
  against a panel whose tiles had just been withdrawn — so what Rich saw was
  My Collection, briefly holding a piece, then empty. The console had the
  whole story and the glass had none of it.

  Neither build was wrong. Nothing asked what should be in front.

NOW
  A run that delivers nothing closes the collection before the studio speaks.
  There is nothing in it to look at — the tiles have just been withdrawn —
  and the objection is about the photograph, which lives in the workshop.

  A run that delivers something leaves the collection exactly where it is.

  The gate asserts both: the offer is open AND the collection is shut, on the
  same tick. Asserting the modal alone is what let this ship — it was open,
  and invisible.

Route calls stay at 8. No new markup, no CSS.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-08-01-s84.html'
DST_DEFAULT = 'public/litenco-stage-2026-08-01-s85.html'
REG_DEFAULT = 'public/effect-registry.js'

OPEN_OLD = '''  function openRedirect(item){
    if (!redirectModal || !item || !item.redirect) return;
    REDIRECTED = item;'''

OPEN_NEW = '''  function openRedirect(item){
    if (!redirectModal || !item || !item.redirect) return;
    /* The collection opened when the credits cleared — s83, so the customer
       could watch the pieces arrive. This run delivered none, its tiles have
       just been withdrawn, and the objection is about the photograph, which
       is in the workshop. Leaving the panel up puts the studio's explanation
       behind an empty gallery, which is exactly what Rich saw: a piece, then
       nothing, and no reason given. */
    if (typeof hideCollection === 'function' &&
        mycoll && mycoll.classList.contains('is-open')) hideCollection();
    REDIRECTED = item;'''

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
    a_js = inline_script(after); a_code = strip_comments(a_js)
    b_code = strip_comments(inline_script(before))

    orx = a_code.index('function openRedirect')
    seg = a_code[orx:orx + 700]
    if 'hideCollection' not in seg: die('the offer can still open behind the collection')
    if seg.index('hideCollection') > seg.index('is-open'):
        die('the panel is closed after the offer is raised')

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

    print('  gate: the offer closes the collection before it speaks, 8 routes held')


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
let redirecting = true;
const calls = [];
const j = (o, ok=true, st=200) => Promise.resolve({ ok, status:st, json:() => Promise.resolve(o) });
w.fetch = (url, opt) => {
  calls.push({ url, body: opt && opt.body ? JSON.parse(opt.body) : null });
  if (url.includes('/auth/me')) return j({ user:{ id:'uid-1', email:'r@x.com' } });
  if (url.includes('/analyze')) return j({ result:{ quality_verdict:'green', smallest_face_min_dim_px:500 } });
  if (url.includes('/portraits/gate')) return j({ status:'ok' });
  if (url.includes('/curate-effects')) return j({ ok:true, recommendations: [] });
  if (url.includes('/credits/gate')) return j({ ok:true, ref_id:'craft_x', balance_after:490 });
  if (url.includes('/credits/refund')) return j({ ok:true, refunded:10, balance_after:500 });
  if (url.includes('/generate')){
    const b = JSON.parse(opt.body);
    if (redirecting && !b.skip_redirect)
      return j({ status:'redirected', redirect:{ series:'groups', message:MSG,
                 ctaLabel:'Step Inside Groups', stayLabel:'Craft it in Portrait anyway' } });
    return j({ result:{ image_b64:'AAAA', duration_ms:900, scores:{ likeness:8.4 } } });
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
const hit = u => calls.filter(c => c.url.includes(u)).length;
const modal  = () => d.getElementById('redirectModal');
const mycoll = () => d.getElementById('mycoll');

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
async function craft(){
  d.querySelector('#effectFloor .silo-card[data-effect-id]:not(.is-selected)')
   .dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1100);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1700);
}

(async () => {
  await sleep(80);
  const f = new w.File([new w.Uint8Array([1,2,3])], 'g.jpg', { type:'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value:[f], configurable:true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(300);
  if (!await openARoom()) fail('no room offers anything craftable');
  await craft();

  // ---- THE WHOLE POINT: open AND actually in front
  if (!modal().classList.contains('is-open')) fail('the offer never opened');
  if (mycoll().classList.contains('is-open'))
    fail('the offer is behind My Collection — open, and invisible');
  if (d.getElementById('redirectSay').textContent.indexOf(MSG) !== 0)
    fail('the engine message is not shown');
  if (d.getElementById('redirectPhoto').getAttribute('src').slice(0,5) !== 'data:')
    fail('their photograph is not shown');

  // ---- anyway still works from here, and the collection comes back with it
  d.getElementById('redirectAnyway').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1900);
  if (modal().classList.contains('is-open')) fail('the offer stayed open');
  const sent = calls.filter(c => c.url.includes('/generate')).pop().body;
  if (sent.skip_redirect !== true) fail('skip_redirect did not reach the wire');
  if (!mycoll().classList.contains('is-open')) fail('the piece landed with the collection shut');
  if (!d.querySelectorAll('#mcGrid .piece__img, #mcGrid .mc-feat').length)
    fail('the piece never appeared');

  // ---- a delivering run must NOT close the collection
  redirecting = false;
  d.getElementById('mcClose').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(120);
  if (!d.querySelector('#effectFloor .silo-card[data-effect-id]:not(.is-selected)')) await openARoom();
  await craft();
  if (!mycoll().classList.contains('is-open')) fail('a good run left the collection shut');
  if (modal().classList.contains('is-open')) fail('a good run raised the offer');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  offer in front, not behind · anyway still crafts · a good run keeps the collection');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s85.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s85.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    REG = sys.argv[3] if len(sys.argv) > 3 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    if before.count(OPEN_OLD) != 1:
        die('openRedirect anchor appears %d times, expected 1' % before.count(OPEN_OLD))

    after = before.replace(OPEN_OLD, OPEN_NEW)

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
