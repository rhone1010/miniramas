#!/usr/bin/env python3
"""
build_s81_refund_refid.py  —  CUI V24, 2026-08-01

IN   public/litenco-stage-2026-07-31-s80.html
OUT  public/litenco-stage-2026-08-01-s81.html

The refund returned 400 ref_id_required, four times in one session, and fifty
credits are outstanding on the test account.

WHAT WAS WRONG, IN TWO PLACES

  The refund route matches a ledger row by reason='craft' and ref_id. The gate
  route wrote `ref_id: null`. Verified against the live ledger 2026-08-01: ten
  consecutive craft rows, null on all ten. So no reference the client could
  invent would ever have matched, and my sending none was only the second
  reason it failed.

  The route half is PATCH-credits-gate-refid.md, applied by Rich. This is the
  client half and it is worthless without it — hence the console warning
  below rather than a silent no-op.

THIS BUILD

  · spendCredits keeps the ref_id the gate returns, on the run.
  · refundCredits sends it. No reference, no call — a 400 that spends a round
    trip to be told what we already know helps nobody, and the credits are
    logged as owed either way.
  · The reference is per run, not per item: one gate call charges for the
    whole payload and writes one ref_id across its rows, so one refund
    reverses it.

  Route calls stay at 6.

WHAT IS DELIBERATELY NOT DONE

  No retry, no queueing of failed refunds. If the refund fails the credits are
  logged as owed, loudly, and a human settles it. A client that retries
  payouts on its own initiative is a worse bug than the one being fixed.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-07-31-s80.html'
DST_DEFAULT = 'public/litenco-stage-2026-08-01-s81.html'
REG_DEFAULT = 'public/effect-registry.js'

# ---- hold the reference the gate returns ---------------------------------
SPEND_OLD = '''      items.forEach(function(q){ q.paid = true; });
      console.log('[credits] spent ' + (items.length * CREDITS_PER_IMAGE) +
                  ' — balance now ' + data.balance_after + (data.admin ? ' (admin, no charge)' : ''));
      return true;'''

SPEND_NEW = '''      /* The gate names the charge. Keep it: the refund route matches a
         ledger row on this and refuses without it.

         Held per RUN, not per item — one gate call charges for the whole
         payload and writes one ref_id across its rows, so one refund
         reverses it. */
      RUN_REF = (data && typeof data.ref_id === 'string' && data.ref_id) ? data.ref_id : null;
      if (!RUN_REF && !data.admin){
        console.warn('[credits] the gate returned no ref_id — a failed craft ' +
                     'CANNOT be refunded. Apply PATCH-credits-gate-refid.md.');
      }
      items.forEach(function(q){ q.paid = true; q.ref_id = RUN_REF; });
      console.log('[credits] spent ' + (items.length * CREDITS_PER_IMAGE) +
                  ' — balance now ' + data.balance_after +
                  (data.admin ? ' (admin, no charge)' : '') +
                  (RUN_REF ? ' — ref ' + RUN_REF : ''));
      return true;'''

BUSY_OLD = '''  var BUSY = false;'''
BUSY_NEW = '''  var BUSY = false;

  /* The reference the gate gave this run. Declared here, above spendCredits
     and refundCredits both, because a var assigned below its reader hoists
     the name and never the value — the fault that shipped s63 inert. */
  var RUN_REF = null;

  /* A line that must outlive the reset.

     The refund message was being written and then wiped about half a second
     later: clearFinished() flips the floor back, and turn()'s callback calls
     labelGo() on a timer, which rewrites the same element. The customer saw
     "those credits are back" flash and vanish — which, for a message about
     money, is worse than never showing it.

     So it is sticky. labelGo prints it instead of the step line until the
     customer does something new, and adding a finish is what clears it. */
  var SUB_NOTE = null;'''

REFUND_OLD = '''  function refundCredits(items){
    if (!items.length) return Promise.resolve(false);
    var body = {
      count:    items.length,
      cost_per: CREDITS_PER_IMAGE,
      series:   'portraits',
      reason:   'craft_failed',
      presets:  items.map(function(q){ return q.preset || null; })
    };'''

REFUND_NEW = '''  function refundCredits(items){
    if (!items.length) return Promise.resolve(false);

    /* No reference, no call. The route refuses without one, and a round trip
       to be told what we already know helps nobody. The credits are recorded
       as owed either way, which is the part that matters. */
    var ref = RUN_REF || items[0].ref_id || null;
    if (!ref){
      console.error('[credits] ' + (items.length * CREDITS_PER_IMAGE) +
                    ' credits are owed and CANNOT be reclaimed — the charge was ' +
                    'never given a reference. Apply PATCH-credits-gate-refid.md.');
      return Promise.resolve(false);
    }

    var body = {
      count:    items.length,
      cost_per: CREDITS_PER_IMAGE,
      ref_id:   ref,
      series:   'portraits',
      reason:   'craft_failed',
      presets:  items.map(function(q){ return q.preset || null; })
    };'''

# a refund that was already settled is not a failure
LABEL_OLD = '''    if (inPose){
      tbcGoVerb.textContent = 'Craft';
      tbcGoN.textContent    = n === 1 ? 'this piece' : ('all ' + n);
      tbcGoSub.textContent  = 'Step 2 of 2 \\u00b7 ' + credits;
    } else {
      tbcGoVerb.textContent = 'Next';
      tbcGoN.textContent    = '\\u00b7 choose a pose';
      tbcGoSub.textContent  = 'Step 1 of 2 \\u00b7 ' + credits;
    }'''

LABEL_NEW = '''    if (inPose){
      tbcGoVerb.textContent = 'Craft';
      tbcGoN.textContent    = n === 1 ? 'this piece' : ('all ' + n);
      tbcGoSub.textContent  = 'Step 2 of 2 \\u00b7 ' + credits;
    } else {
      tbcGoVerb.textContent = 'Next';
      tbcGoN.textContent    = '\\u00b7 choose a pose';
      tbcGoSub.textContent  = 'Step 1 of 2 \\u00b7 ' + credits;
    }
    /* A standing note outranks the step line. See SUB_NOTE — this exists so
       a message about money survives the floor flipping back, which calls
       this function again on a timer. */
    if (SUB_NOTE) tbcGoSub.textContent = SUB_NOTE;'''

ADD_OLD = '''  function addToQueue(siloId, effectId){
    if (inQueue(siloId, effectId)) return true;'''

ADD_NEW = '''  function addToQueue(siloId, effectId){
    /* They have moved on. The note about the last run stops standing. */
    SUB_NOTE = null;
    if (inQueue(siloId, effectId)) return true;'''

ALREADY_OLD = '''      if (data && data.ok){
        items.forEach(function(q){ q.refunded = true; });
        return true;
      }'''

ALREADY_NEW = '''      if (data && data.ok){
        items.forEach(function(q){ q.refunded = true; });
        /* `already` means a refund against this reference was written before —
           a replayed call, not a second payout. The route's idempotency
           guarantee, and it reads as success here because it is one. */
        if (data.already) console.log('[credits] already refunded against ' + ref);
        return true;
      }'''

NOTE_OLD = '''          if (!tbcGoSub) return;
          var n = owed.length;
          tbcGoSub.textContent = ok
            ? (n === 1 ? 'One did not hold \\u00b7 those credits are back'
                       : n + ' did not hold \\u00b7 those credits are back')
            : (n === 1 ? 'One did not hold \\u00b7 we are settling the credits'
                       : n + ' did not hold \\u00b7 we are settling the credits');'''

NOTE_NEW = '''          if (!tbcGoSub) return;
          var n = owed.length;
          /* Sticky: clearFinished() flips the floor back and labelGo() runs
             again on that timer, so writing the element directly meant the
             line was gone in half a second. */
          SUB_NOTE = ok
            ? (n === 1 ? 'One did not hold \\u00b7 those credits are back'
                       : n + ' did not hold \\u00b7 those credits are back')
            : (n === 1 ? 'One did not hold \\u00b7 we are settling the credits'
                       : n + ' did not hold \\u00b7 we are settling the credits');
          tbcGoSub.textContent = SUB_NOTE;'''

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
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write(js); tmp = t.name
    r = subprocess.run(['node', 'scripts/strip_comments.js', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    if r.returncode != 0: die('comment strip failed: ' + r.stderr.strip())
    return r.stdout


def gate(before, after):
    a_js = inline_script(after); a_code = strip_comments(a_js)
    b_code = strip_comments(inline_script(before))

    if 'RUN_REF' not in a_code: die('the run reference is not held')
    if a_code.index('var RUN_REF') > a_code.index('function spendCredits'):
        die('RUN_REF declared below spendCredits (TDZ)')
    if a_code.index('var RUN_REF') > a_code.index('function refundCredits'):
        die('RUN_REF declared below refundCredits (TDZ)')
    rf = a_code.index('function refundCredits')
    seg = a_code[rf:rf + 1800]
    if 'ref_id:' not in seg: die('the refund body carries no ref_id')
    if 'if (!ref)' not in seg: die('the refund calls out with no reference')
    if seg.index('if (!ref)') > seg.index('fetch('):
        die('the guard runs after the call it is guarding')

    if 'SUB_NOTE' not in a_code: die('the standing note is missing')
    if a_code.index('var SUB_NOTE') > a_code.index('function labelGo'):
        die('SUB_NOTE declared below labelGo (TDZ)')
    lg = a_code.index('function labelGo')
    if 'if (SUB_NOTE)' not in a_code[lg:lg + 1600]:
        die('labelGo does not honour the standing note — it will wipe it on the flip')

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

    print('  gate: run reference held and returned, no refund without one, 6 routes held')


BOOT = r'''
const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const reg  = fs.readFileSync(process.argv[3], 'utf8');
const errs = [];
const dom = new JSDOM(html, { runScripts:'outside-only', pretendToBeVisual:true, url:'http://localhost/' });
const w = dom.window, d = dom.window.document;
w.addEventListener('error', e => errs.push('window error: ' + e.message));
const fail = m => { console.log('FAIL ' + m); process.exit(1); };

let gateRef = 'craft_abc123';     // the patched gate returns one
let redirect = true;              // the studio declines the work
const calls = [];
const j = o => Promise.resolve({ ok:true, status:200, json:() => Promise.resolve(o) });
w.fetch = (url, opt) => {
  calls.push({ url, body: JSON.parse(opt.body) });
  if (url.includes('/analyze')) return j({ result:{ quality_verdict:'green', smallest_face_min_dim_px:500 } });
  if (url.includes('/portraits/gate')) return j({ status:'ok' });
  if (url.includes('/curate-effects')) return j({ ok:true, recommendations: [] });
  if (url.includes('/credits/gate'))
    return j(gateRef ? { ok:true, ref_id:gateRef, balance_after:490 } : { ok:true, balance_after:490 });
  if (url.includes('/credits/refund')) return j({ ok:true, refunded:10, balance_after:500 });
  if (url.includes('/generate'))
    return redirect ? j({ status:'redirected', redirect:{ series:'groups', message:'three people' } })
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
async function runOnce(){
  if (!d.querySelector('#effectFloor .silo-card[data-effect-id]')) await openARoom();
  d.querySelector('#effectFloor .silo-card[data-effect-id]:not(.is-selected)')
   .dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1100);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1500);
}

(async () => {
  if (!d.getElementById('tbcGoVerb').textContent.trim()) fail('rail button never labelled');
  const f = new w.File([new w.Uint8Array([1,2,3])], 'p.jpg', { type:'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value:[f], configurable:true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(300);
  if (!await openARoom()) fail('no room offers anything craftable');

  // ---- REDIRECTED WORK IS REFUNDED, WITH THE GATE'S OWN REFERENCE
  await runOnce();
  if (hit('/credits/refund') !== 1) fail('a redirected craft was not refunded');
  const rb = calls.find(c => c.url.includes('/credits/refund')).body;
  if (rb.ref_id !== gateRef) fail('refund sent ref_id ' + rb.ref_id + ', expected ' + gateRef);
  if (rb.cost_per !== 10) fail('refund cost_per wrong');
  if (!d.getElementById('tbcGoSub').textContent.match(/credits are back/))
    fail('the refund is not reported — sub reads: "' + d.getElementById('tbcGoSub').textContent + '"');

  // ---- AN UNPATCHED GATE MUST NOT PRODUCE A DOOMED CALL
  gateRef = null;
  const before = hit('/credits/refund');
  await runOnce();
  if (hit('/credits/refund') !== before)
    fail('called the refund with no reference — a guaranteed 400');

  // ---- AND A DELIVERED PIECE IS NEVER REFUNDED
  gateRef = 'craft_def456'; redirect = false;
  const before2 = hit('/credits/refund');
  await runOnce();
  if (hit('/credits/refund') !== before2) fail('a delivered piece was refunded');
  if (!d.getElementById('mycoll').classList.contains('is-open')) fail('the piece did not land');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  redirected refunds with the gate reference · no reference, no call · delivered work is kept');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s81.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s81.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    REG = sys.argv[3] if len(sys.argv) > 3 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    for nm, a in [('busy', BUSY_OLD), ('spend', SPEND_OLD), ('refund', REFUND_OLD),
                  ('already', ALREADY_OLD), ('label', LABEL_OLD), ('add', ADD_OLD),
                  ('note', NOTE_OLD)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (nm, before.count(a)))

    after = before.replace(BUSY_OLD, BUSY_NEW)
    after = after.replace(SPEND_OLD, SPEND_NEW)
    after = after.replace(REFUND_OLD, REFUND_NEW)
    after = after.replace(ALREADY_OLD, ALREADY_NEW)
    after = after.replace(LABEL_OLD, LABEL_NEW)
    after = after.replace(ADD_OLD, ADD_NEW)
    after = after.replace(NOTE_OLD, NOTE_NEW)

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
