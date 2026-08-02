#!/usr/bin/env python3
"""
build_s78_refund_and_reconcile.py  —  CUI V24, 2026-07-31

IN   public/litenco-stage-2026-07-31-s77.html
OUT  public/litenco-stage-2026-07-31-s78.html
READS lib/v1/portraits/portraits-shared.ts   (live source, that day)

Rich crafted nebula_resin. /generate returned 400 in 15ms and ten credits
were gone. Two faults, and the second is the one that matters.

FAULT 1 — a failed craft kept the money.

  runAll charges before it crafts, which is right: nothing should be crafted
  that has not been paid for. But nothing gave the credits back when the
  craft did not happen. /api/v1/credits/refund exists and was never called
  from anywhere.

  Refunded now for failed, rejected and redirected — every end state where no
  piece reached the customer. Not for done.

  THE REFUND ROUTE'S REQUEST SHAPE IS NOT DOCUMENTED ANYWHERE. It mirrors the
  gate's here, which is the likeliest shape and is still a guess. The call
  logs its exact body and the exact response, so one craft against a bad
  preset tells you whether it is right. VERIFY THAT BEFORE A CUSTOMER SEES IT.

FAULT 2 — the floor offered eleven effects the route refuses.

  The registry marks 26 effects live. PRESET_LABELS in portraits-shared.ts
  holds 17 ids and the route 400s on anything else, at line 227, before the
  engine is ever reached.

  Live in the registry, refused by the route:
    blown_glass · amber · mercury · fantasy_crystal · dragon_skin ·
    magic_energy · armor · reclaimed_bronze · nebula_resin · neon · elizabethan

  Which leaves four rooms open with nothing in them that can be crafted:
    Myth & Legend 4 live -> 0 · Far & Future 2 -> 0 · Another Age 1 -> 0 ·
    Living World 0 -> 0. And Light & Glass at 5 -> 1.

  THE FIX IS NOT HERE. Three maps in portraits-shared.ts — PRESET_LABELS,
  PRESET_TIER, STYLE_MATERIALS — need the eleven ids. That is CENG's and
  Rich's, not the glass's.

  What the glass does meanwhile is refuse to offer them. This script reads
  PRESET_LABELS FROM THE LIVE .ts EACH TIME IT RUNS and bakes the accepted
  set into the file, so the floor offers exactly what can be crafted. Add the
  eleven to the route and the next build picks them up with no edit here.

  Fails closed, visibly, and undoes itself the moment the route learns them.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT   = 'public/litenco-stage-2026-07-31-s77.html'
DST_DEFAULT   = 'public/litenco-stage-2026-07-31-s78.html'
SHARED_DEFAULT= 'lib/v1/portraits/portraits-shared.ts'
REG_DEFAULT   = 'public/effect-registry.js'

# ---- fault 2: the accepted set, baked from live source -------------------
OFFER_ANCHOR = '''  var CAP = 7;   /* seven effects; the eighth slot is the upsell */'''

def offer_block(accepted, hidden):
    lst = ', '.join("'" + a + "'" for a in accepted)
    return ('''  /* ==================================================================
     WHAT THE ROUTE WILL ACTUALLY ACCEPT
     ==================================================================
     Read out of lib/v1/portraits/portraits-shared.ts by the build script
     that produced this file, on the day it produced it. Not hand-kept.

     The registry decides what EXISTS and whether it is finished. The route
     decides what it will CRAFT, at line 227 of the generate route, and it
     400s on anything absent from PRESET_LABELS — before the engine, in
     fifteen milliseconds, after the credits have gone.

     %d live effects were refused when this was built. Offering them is
     charging for a certain failure, so the floor does not.

     THIS IS A GUARD, NOT A DECISION. The answer is the eleven ids reaching
     PRESET_LABELS, PRESET_TIER and STYLE_MATERIALS. When they do, the next
     build reads them and this list grows on its own. */
  var ROUTE_ACCEPTS = [%s];
  function craftable(e){ return e && e.body === 'live' && ROUTE_ACCEPTS.indexOf(e.id) >= 0; }

''' % (len(hidden), lst))

# every place the floor asks the registry what to offer
OFFERABLE_OLD = '''    var list   = R.offerableBySilo(siloId).slice(0, CAP);'''
OFFERABLE_NEW = '''    /* offerableBySilo answers "finished?"; craftable also answers "will the
       route take it?". Both must be true or the customer pays for a 400. */
    var list   = R.offerableBySilo(siloId).filter(craftable).slice(0, CAP);'''

RECS_OLD = '''      var live = R.offerableBySilo(s.id);'''
RECS_NEW = '''      var live = R.offerableBySilo(s.id).filter(craftable);'''

# ---- fault 1: refund -----------------------------------------------------
REFUND_ANCHOR = '''  function craftPending(){'''
REFUND_ADD = '''  /* ---- /credits/refund ---------------------------------------------------
     Charged, nothing delivered. The credits go back.

     Called for failed, rejected and redirected — every end state where no
     piece reached the customer — and never for done.

     THE SHAPE IS A GUESS. Nothing documents this route's request body, so it
     mirrors /credits/gate, which is the likeliest and is still not knowledge.
     Both the body sent and the response received are logged in full: one
     craft against a refused preset will tell you whether this is right, and
     until someone has read that line it is not proven. */
  function refundCredits(items){
    if (!items.length) return Promise.resolve(false);
    var body = {
      count:    items.length,
      cost_per: CREDITS_PER_IMAGE,
      series:   'portraits',
      reason:   'craft_failed',
      presets:  items.map(function(q){ return q.preset || null; })
    };
    console.log('[credits] refund requested', JSON.stringify(body));
    return fetch(CREDITS_REFUND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(res){
      var st = res.status;
      return res.json().catch(function(){ return { ok: false, reason: 'bad_response' }; })
               .then(function(d){ return { st: st, d: d }; });
    }).then(function(r){
      var data = r.d;
      console.log('[credits] refund response', r.st, JSON.stringify(data));
      if (data && data.ok){
        items.forEach(function(q){ q.refunded = true; });
        return true;
      }
      /* Loud. A refund that silently fails is the original fault wearing a
         different coat. */
      console.error('[credits] REFUND FAILED — ' + (items.length * CREDITS_PER_IMAGE) +
                    ' credits are owed and were not returned', data);
      return false;
    }).catch(function(e){
      console.error('[credits] REFUND UNREACHABLE — ' + (items.length * CREDITS_PER_IMAGE) +
                    ' credits are owed', e);
      return false;
    });
  }

'''

# runAll's tail: refund whatever did not become a piece
TAIL_OLD = '''      return craftPending().then(function(){
        BUSY = false;
        labelBusy();
        var failed = QUEUE.filter(function(q){ return q.status === 'failed'; }).length;
        if (failed && tbcGoSub){
          tbcGoSub.textContent = failed === 1
            ? 'One did not hold \\u00b7 nothing further was charged'
            : (failed + ' did not hold \\u00b7 nothing further was charged');
        }
      });'''

TAIL_NEW = '''      return craftPending().then(function(){
        BUSY = false;
        labelBusy();
        /* Anything that was paid for and did not become a piece is refunded.
           'redirected' counts: the studio declined the work, so it keeps
           none of the money. */
        var owed = QUEUE.filter(function(q){
          return q.paid && !q.refunded &&
                 (q.status === 'failed' || q.status === 'rejected' || q.status === 'redirected');
        });
        if (!owed.length) return;
        return refundCredits(owed).then(function(ok){
          if (!tbcGoSub) return;
          var n = owed.length;
          tbcGoSub.textContent = ok
            ? (n === 1 ? 'One did not hold \\u00b7 those credits are back'
                       : n + ' did not hold \\u00b7 those credits are back')
            : (n === 1 ? 'One did not hold \\u00b7 we are settling the credits'
                       : n + ' did not hold \\u00b7 we are settling the credits');
        });
      });'''

URL_OLD = '''  var GENERATE_URL     = '/api/v1/portraits/generate';'''
URL_NEW = '''  var GENERATE_URL     = '/api/v1/portraits/generate';
  var CREDITS_REFUND_URL = '/api/v1/credits/refund';'''

EXPECT_FETCHES_BEFORE = 5
EXPECT_FETCHES_AFTER  = 6
EXPECT_IDS = 71
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


def read_accepted(path):
    """PRESET_LABELS, from the live .ts. Never a copy, never remembered."""
    if not os.path.exists(path):
        die('cannot read %s — the accepted set is not guessable' % path)
    s = open(path, encoding='utf-8', errors='replace').read()
    m = re.search(r'export const PRESET_LABELS[^{]*\{(.*?)\n\}', s, re.S)
    if not m: die('PRESET_LABELS not found in %s' % path)
    ids = re.findall(r'^\s*([a-z0-9_]+)\s*:', m.group(1), re.M)
    if not ids: die('PRESET_LABELS parsed empty')
    return ids


def read_live(path):
    s = open(path, encoding='utf-8', errors='replace').read()
    return [m.group(1) for m in re.finditer(r'"id":\s*"([a-z0-9_]+)"[^}]*?"body":\s*"live"', s, re.S)]


def gate(before, after, accepted, hidden):
    a_js = inline_script(after); a_code = strip_comments(a_js)
    b_code = strip_comments(inline_script(before))

    if 'ROUTE_ACCEPTS' not in a_code: die('accepted set not baked in')
    if 'function craftable' not in a_code: die('craftable not declared')
    if OFFERABLE_OLD in a_js: die('the floor still offers unfiltered')
    if RECS_OLD in a_js:      die('recommendations still unfiltered')
    # constants above their callers
    if a_code.index('var ROUTE_ACCEPTS') > a_code.index('function openSilo'):
        die('ROUTE_ACCEPTS declared below openSilo (TDZ)')
    if a_code.index('function craftable') > a_code.index('function recommendEffects'):
        die('craftable declared below recommendEffects')
    for h in hidden:
        if "'" + h + "'" in a_code.split('var ROUTE_ACCEPTS')[1].split(']')[0]:
            die('%s is refused by the route but present in the accepted set' % h)

    if 'function refundCredits' not in a_code: die('refundCredits not declared')
    if a_code.index('function refundCredits') > a_code.index('function runAll'):
        die('refundCredits declared below runAll')
    ra = a_code.index('function runAll')
    if 'refundCredits(owed)' not in a_code[ra:ra + 2200]: die('runAll never refunds')
    if "q.status === 'redirected'" not in a_code[ra:ra + 2200]:
        die('redirected pieces are not refunded')

    nf = len(re.findall(r'\bfetch\s*\(', a_code))
    if nf != EXPECT_FETCHES_AFTER: die('fetch count %d, expected %d' % (nf, EXPECT_FETCHES_AFTER))

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

    print('  gate: %d accepted baked from live source, %d refused and not offered, '
          'refund wired, 6 routes' % (len(accepted), len(hidden)))


BOOT = r'''
const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const reg  = fs.readFileSync(process.argv[3], 'utf8');
const errs = [];
const dom = new JSDOM(html, { runScripts:'outside-only', pretendToBeVisual:true, url:'http://localhost/' });
const w = dom.window, d = dom.window.document;
w.addEventListener('error', e => errs.push('window error: ' + e.message));
const fail = m => { console.log('FAIL ' + m); process.exit(1); };

let genFails = true;
const calls = [];
const j = (o, ok=true, st=200) => Promise.resolve({ ok, status: st, json: () => Promise.resolve(o) });
w.fetch = (url, opt) => {
  calls.push({ url, body: JSON.parse(opt.body) });
  if (url.includes('/analyze')) return j({ result:{ quality_verdict:'green', smallest_face_min_dim_px:500 } });
  if (url.includes('/portraits/gate')) return j({ status:'ok' });
  if (url.includes('/curate-effects')) return j({ ok:true, recommendations: [] });
  if (url.includes('/credits/gate')) return j({ ok:true, balance_after:490 });
  if (url.includes('/credits/refund')) return j({ ok:true, balance_after:500 });
  if (url.includes('/generate')) return genFails
      ? j({ error:'unknown preset_id' }, false, 400)
      : j({ result:{ image_b64:'AAAA', duration_ms:900, scores:{ likeness:8.4 } } });
  return j({});
};
w.Image = class { set src(v){ this.naturalWidth=1200; this.naturalHeight=1600;
  if (this.onload) setTimeout(() => this.onload(), 0); } };

try { w.eval(reg); } catch (e) { fail('registry: ' + e.message); }
try { w.eval(html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1]); }
catch (e) { fail('boot threw: ' + e.message); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const hit = u => calls.filter(c => c.url.includes(u)).length;
const ACCEPTED = JSON.parse(process.argv[4]);

(async () => {
  if (!d.getElementById('tbcGoVerb').textContent.trim()) fail('rail button never labelled');
  if (d.querySelectorAll('#siloFloor .silo-card').length !== 8) fail('silo floor not 8');

  // --- NOTHING THE ROUTE REFUSES MAY BE REACHABLE
  const rooms = [...d.querySelectorAll('#siloFloor .silo-card')];
  for (const r of rooms){
    r.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
    await sleep(900);
    for (const c of d.querySelectorAll('#effectFloor .silo-card[data-effect-id]')){
      if (!ACCEPTED.includes(c.dataset.effectId))
        fail('the floor offers ' + c.dataset.effectId + ', which the route will refuse');
    }
    const back = d.getElementById('crumbLabel');
    if (back) back.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
    await sleep(900);
  }

  // --- A REFUSED CRAFT MUST GIVE THE CREDITS BACK
  const f = new w.File([new w.Uint8Array([1,2,3])], 'p.jpg', { type:'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value:[f], configurable:true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(300);
  const room = rooms.find(c => w.EFFECT_REGISTRY.offerableBySilo(c.dataset.siloId)
                                .some(e => ACCEPTED.includes(e.id)));
  room.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1100);
  d.querySelector('#effectFloor .silo-card[data-effect-id]')
   .dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1100);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1200);

  if (hit('/credits/gate') !== 1) fail('credits not charged');
  if (hit('/generate') !== 1)     fail('generate not called');
  if (hit('/credits/refund') !== 1)
    fail('a 400 kept the money — refund called ' + hit('/credits/refund') + ' times');
  const rb = calls.find(c => c.url.includes('/credits/refund')).body;
  if (rb.count !== 1) fail('refund count wrong');
  if (!d.getElementById('tbcGoSub').textContent.match(/credits are back/))
    fail('the refund is not reported to the customer');
  if (!w.__QUEUE_PEEK()[0].refunded) fail('item not marked refunded');

  // --- AND A SUCCESSFUL CRAFT MUST NOT REFUND
  genFails = false;
  w.__QUEUE_PEEK()[0].status = 'pending';
  w.__QUEUE_PEEK()[0].refunded = false;
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1400);
  if (hit('/credits/refund') !== 1) fail('a successful craft was refunded');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  no refused effect reachable · 400 refunds · success does not');
  process.exit(0);
})();
'''


def boot(path, registry, accepted):
    import json
    open('.boot_gate_s78.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s78.js', path, registry, json.dumps(accepted)],
                       capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC    = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST    = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    SHARED = sys.argv[3] if len(sys.argv) > 3 else SHARED_DEFAULT
    REG    = sys.argv[4] if len(sys.argv) > 4 else REG_DEFAULT

    accepted = read_accepted(SHARED)
    live     = read_live(REG)
    hidden   = [e for e in live if e not in accepted]

    print('  read %s: %d presets accepted by the route' % (SHARED, len(accepted)))
    print('  registry: %d live' % len(live))
    if hidden:
        print('  REFUSED BY THE ROUTE, NOT OFFERED (%d): %s' % (len(hidden), ', '.join(hidden)))
        print('  -> fix is PRESET_LABELS / PRESET_TIER / STYLE_MATERIALS in portraits-shared.ts')

    before = open(SRC, encoding='utf-8').read()
    for nm, a in [('offer', OFFER_ANCHOR), ('offerable', OFFERABLE_OLD), ('recs', RECS_OLD),
                  ('refund', REFUND_ANCHOR), ('tail', TAIL_OLD), ('url', URL_OLD)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (nm, before.count(a)))

    nf = len(re.findall(r'\bfetch\s*\(', strip_comments(inline_script(before))))
    if nf != EXPECT_FETCHES_BEFORE:
        die('input has %d fetches, expected %d — wrong base file' % (nf, EXPECT_FETCHES_BEFORE))

    after = before.replace(OFFER_ANCHOR, offer_block(accepted, hidden) + OFFER_ANCHOR)
    after = after.replace(OFFERABLE_OLD, OFFERABLE_NEW)
    after = after.replace(RECS_OLD, RECS_NEW)
    after = after.replace(URL_OLD, URL_NEW)
    after = after.replace(REFUND_ANCHOR, REFUND_ADD + REFUND_ANCHOR)
    after = after.replace(TAIL_OLD, TAIL_NEW)

    gate(before, after, accepted, hidden)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG, accepted)
    os.replace(cand, DST)
    print('  written: %s' % DST)
