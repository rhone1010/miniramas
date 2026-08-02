#!/usr/bin/env python3
"""
build_s80_round_trip.py  —  CUI V24, 2026-07-31

IN   public/litenco-stage-2026-07-31-s79.html
OUT  public/litenco-stage-2026-07-31-s80.html

Rich: renders land in My Collection, but a SECOND run does not open it, and
the studio never returns to a state a customer can start from again.

Two faults, one shape: nothing about the flow was per-run.

FAULT 1 — the collection opens once, ever.

  __pieceLanded decides whether to open by counting every finished piece the
  session has ever produced:

      var firstLanding = PIECES.filter(p => !p.crafting).length === 1;

  True on the first piece of the session and never again. Correct for one
  run and wrong for the second, where the count starts at whatever the first
  run left behind.

  The question was never "is this the first piece?" — it is "is this the
  first piece OF THIS RUN?". A per-run flag, cleared when a run starts and
  set when a piece lands.

FAULT 2 — the rail keeps crafted work.

  Items stayed in QUEUE after they were crafted, so the rail still listed
  them, the button still quoted their credits, and the customer was looking
  at a bill for pieces already in their collection. Worse, runAll only ever
  crafts status 'pending', so pressing it again spent nothing and did
  nothing — the studio looked stuck.

  Every item that reached an end state now leaves the rail when the run
  finishes. Done pieces are in the collection; failed and rejected ones have
  been refunded. Nothing that ends is still owed anything.

  Cleared AFTER the run, never during: rows disappearing mid-craft would
  read as work being lost.

  With the rail empty the floor returns to the rooms, the effect cards lose
  their ticks, and the button says what it says at the start. The
  photograph stays — it is still their sitting, and asking for it again
  would be the studio forgetting them.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-07-31-s79.html'
DST_DEFAULT = 'public/litenco-stage-2026-07-31-s80.html'
REG_DEFAULT = 'public/effect-registry.js'

LANDED_OLD = '''    var firstLanding = PIECES.filter(function(p){ return !p.crafting; }).length === 1;
    if (firstLanding) showCollection(); else renderCollection();'''

LANDED_NEW = '''    /* Was: the first piece of the SESSION, counted across all of PIECES.
       True once and never again, so a second run landed silently behind a
       workshop the customer was still looking at.

       The question is per-run. RUN_LANDED is cleared when a run starts. */
    if (!window.__RUN_LANDED){
      window.__RUN_LANDED = true;
      showCollection();
    } else {
      renderCollection();
    }'''

# runAll — clear the flag at the start, clear the rail at the end
START_OLD = '''    BUSY = true;
    labelBusy();
    return spendCredits(pending).then(function(paid){'''

START_NEW = '''    BUSY = true;
    /* A new run. The next piece to land is this run's first, whatever the
       collection already holds. */
    window.__RUN_LANDED = false;
    labelBusy();
    return spendCredits(pending).then(function(paid){'''

TAIL_OLD = '''        if (!owed.length) return;
        return refundCredits(owed).then(function(ok){
          if (!tbcGoSub) return;
          var n = owed.length;
          tbcGoSub.textContent = ok
            ? (n === 1 ? 'One did not hold \\u00b7 those credits are back'
                       : n + ' did not hold \\u00b7 those credits are back')
            : (n === 1 ? 'One did not hold \\u00b7 we are settling the credits'
                       : n + ' did not hold \\u00b7 we are settling the credits');
        });'''

TAIL_NEW = '''        if (!owed.length){ clearFinished(); return; }
        return refundCredits(owed).then(function(ok){
          clearFinished();
          if (!tbcGoSub) return;
          var n = owed.length;
          tbcGoSub.textContent = ok
            ? (n === 1 ? 'One did not hold \\u00b7 those credits are back'
                       : n + ' did not hold \\u00b7 those credits are back')
            : (n === 1 ? 'One did not hold \\u00b7 we are settling the credits'
                       : n + ' did not hold \\u00b7 we are settling the credits');
        });'''

CLEAR_ANCHOR = '''  function runAll(){'''
CLEAR_ADD = '''  /* ---- the studio is ready again ----------------------------------------
     Everything that reached an end state leaves the rail. Done pieces are in
     the collection; failed and rejected ones have been refunded. Nothing
     that has ended is still owed anything, so nothing that has ended should
     still be listed as work to pay for.

     After the run, never during it: a row vanishing mid-craft reads as work
     being lost rather than work being finished.

     THE PHOTOGRAPH STAYS. It is still their sitting. Asking for it again
     because the studio finished a piece would be the studio forgetting them. */
  function clearFinished(){
    var ENDED = { done:1, failed:1, rejected:1, redirected:1 };
    var keep = QUEUE.filter(function(q){ return !ENDED[q.status]; });
    if (keep.length === QUEUE.length) return;
    QUEUE.length = 0;
    keep.forEach(function(q){ QUEUE.push(q); });
    renderQueue();

    /* the ticks belong to a rail that no longer holds them */
    if (effFloor){
      [].forEach.call(effFloor.querySelectorAll('.silo-card[data-effect-id]'), function(el){
        if (!inQueue(el.dataset.siloId, el.dataset.effectId)) el.classList.remove('is-selected');
      });
    }
    /* and the floor goes back to the rooms, which is where a next piece
       starts. Only if nothing is left to pose. */
    if (!QUEUE.length && workshop && workshop.classList.contains('workshop-view--poses')){
      backFromPoses();
    }
    labelGo();
  }

'''

EXPECT_FETCHES = 6
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
    """Blank every comment with a real parser — see scripts/strip_comments.js."""
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write(js); tmp = t.name
    r = subprocess.run(['node', 'scripts/strip_comments.js', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    if r.returncode != 0: die('comment strip failed: ' + r.stderr.strip())
    return r.stdout


def gate(before, after):
    a_js = inline_script(after); a_code = strip_comments(a_js)
    b_code = strip_comments(inline_script(before))

    if 'PIECES.filter(function(p){ return !p.crafting; }).length === 1' in a_code:
        die('the landing test still counts the whole session')
    if '__RUN_LANDED' not in a_code: die('per-run flag missing')
    if a_code.index('window.__RUN_LANDED = false') > a_code.index('spendCredits(pending)'):
        die('the flag is cleared after the run has already started')
    if 'function clearFinished' not in a_code: die('clearFinished not declared')
    if a_code.index('function clearFinished') > a_code.index('function runAll'):
        die('clearFinished declared below runAll')
    ra = a_code.index('function runAll')
    if a_code[ra:ra + 2600].count('clearFinished()') != 2:
        die('clearFinished must be called on both the refund and no-refund paths')

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

    print('  gate: landing is per-run, rail clears on both paths, 6 routes held')


BOOT = r'''
const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const reg  = fs.readFileSync(process.argv[3], 'utf8');
const errs = [];
const dom = new JSDOM(html, { runScripts:'outside-only', pretendToBeVisual:true, url:'http://localhost/' });
const w = dom.window, d = dom.window.document;
w.addEventListener('error', e => errs.push('window error: ' + e.message));
const fail = m => { console.log('FAIL ' + m); process.exit(1); };

let seq = 0;
const j = o => Promise.resolve({ ok:true, status:200, json:() => Promise.resolve(o) });
w.fetch = (url) => {
  if (url.includes('/analyze')) return j({ result:{ quality_verdict:'green', smallest_face_min_dim_px:500 } });
  if (url.includes('/portraits/gate')) return j({ status:'ok' });
  if (url.includes('/curate-effects')) return j({ ok:true, recommendations: [] });
  if (url.includes('/credits/gate')) return j({ ok:true, balance_after:490 });
  if (url.includes('/generate')) return j({ result:{ image_b64:'PIECE' + (++seq), duration_ms:900,
                                                     scores:{ likeness:8.4 } } });
  return j({});
};
w.Image = class { set src(v){ this.naturalWidth=1200; this.naturalHeight=1600;
  if (this.onload) setTimeout(() => this.onload(), 0); } };

try { w.eval(reg); } catch (e) { fail('registry: ' + e.message); }
try { w.eval(html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1]); }
catch (e) { fail('boot threw: ' + e.message); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const mycoll = () => d.getElementById('mycoll');

async function openARoom(){
  const rooms = [...d.querySelectorAll('#siloFloor .silo-card')];
  for (const c of rooms){
    c.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
    await sleep(900);
    if (d.querySelector('#effectFloor .silo-card[data-effect-id]')) return true;
    const back = d.getElementById('crumbLabel');
    if (back) back.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
    await sleep(900);
  }
  return false;
}

async function runOnce(){
  if (!d.querySelector('#effectFloor .silo-card[data-effect-id]')){
    if (!await openARoom()) fail('no room offers anything craftable');
  }
  d.querySelector('#effectFloor .silo-card[data-effect-id]:not(.is-selected)')
   .dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));  // -> pose
  await sleep(1100);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));  // craft
  await sleep(1500);
}

(async () => {
  if (!d.getElementById('tbcGoVerb').textContent.trim()) fail('rail button never labelled');

  const f = new w.File([new w.Uint8Array([1,2,3])], 'p.jpg', { type:'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value:[f], configurable:true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(300);

  // ---- ROUND ONE
  if (!await openARoom()) fail('no room offers anything craftable');
  await runOnce();
  if (!mycoll().classList.contains('is-open')) fail('round 1 did not open the collection');
  if (w.__QUEUE_PEEK().length !== 0) fail('round 1 left ' + w.__QUEUE_PEEK().length + ' in the rail');
  if (d.querySelectorAll('#tbcList .tbc-row').length !== 0) fail('rail still shows rows');
  const tiles1 = d.querySelectorAll('#mcGrid .mc-feat, #mcGrid .piece').length;
  if (!tiles1) fail('round 1 piece never reached the collection');
  if (d.getElementById('tbcGoVerb').textContent === 'Crafting') fail('button stuck on Crafting');

  // back to the workshop, exactly as a customer would
  d.getElementById('mcClose').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(120);
  if (mycoll().classList.contains('is-open')) fail('Back to the workshop did not close it');
  if (d.querySelectorAll('#effectFloor .silo-card.is-selected').length)
    fail('an effect card is still ticked for a piece already crafted');

  // the photograph must still be theirs — no second upload
  if (!w.__SRC.b64) fail('the source photograph was discarded between runs');

  // ---- ROUND TWO
  await runOnce();
  if (!mycoll().classList.contains('is-open'))
    fail('round 2 landed silently — the collection did not open again');
  if (w.__QUEUE_PEEK().length !== 0) fail('round 2 left work in the rail');
  const tiles2 = d.querySelectorAll('#mcGrid .mc-feat, #mcGrid .piece').length;
  if (tiles2 <= tiles1) fail('round 2 piece did not join the collection');

  // ---- ROUND THREE, to prove it is not an even/odd trick
  d.getElementById('mcClose').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(120);
  await runOnce();
  if (!mycoll().classList.contains('is-open')) fail('round 3 did not open the collection');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  three runs · collection opens each time · rail empties · photograph kept');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s80.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s80.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    REG = sys.argv[3] if len(sys.argv) > 3 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    for nm, a in [('landed', LANDED_OLD), ('start', START_OLD), ('tail', TAIL_OLD),
                  ('clear', CLEAR_ANCHOR)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (nm, before.count(a)))

    after = before.replace(LANDED_OLD, LANDED_NEW)
    after = after.replace(START_OLD, START_NEW)
    after = after.replace(TAIL_OLD, TAIL_NEW)
    after = after.replace(CLEAR_ANCHOR, CLEAR_ADD + CLEAR_ANCHOR)

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
