#!/usr/bin/env python3
"""
build_s86_redirect_at_upload.py  —  CUI V24, 2026-08-01
IN   public/litenco-stage-2026-08-01-s85.html
OUT  public/litenco-stage-2026-08-01-s86.html

Rich: "1. Image upload of 3 people. 2. Curator analyzes. 3. detects three
people. 4. Launches Modal — Redirect or Proceed."

He is right, and s84 and s85 both put it in the wrong place.

WHAT WAS WRONG
  I hung the offer off /generate, so a group photograph went:

    upload → choose finishes → choose a pose → sign in → CHARGE 10 CREDITS
    → generate declines → refund → collection opens on nothing → offer

  The customer paid, waited, watched a tile appear and vanish, and only then
  learned the studio would rather this were a Groups piece. Every step after
  the upload was wasted, and one of them took their money.

  The studio knew at the upload. /portraits/gate answers with
  status 'redirected' and the same redirect object — series, message,
  ctaLabel, stayLabel — the moment the photograph lands. It has been
  answering that all along; precheckSourceGate stored it and passed it to
  raiseFault(), which only understands intake faults and ignored it.

  The evidence was in Rich's own log, twenty lines before the charge:

    [portraits/gate] redirected→groups in 1727ms

NOW
    upload → the studio looks → offer

  No credits, no queue, no pose, no sign-in, no collection, no refund. The
  photograph lands, the Curator says what it sees, and the customer chooses
  before spending anything.

  'Craft it in Portraits anyway' now sets the intent on SRC rather than on a
  queue item — there is no queue item yet — and every craft from that
  photograph carries skip_redirect. Choosing a different photograph clears
  it, because the consent was about that photograph and not a standing
  preference for ignoring the studio.

  The /generate path stays. It is the second net: a redirect can still be
  returned there if the gate was unreachable, and a customer who has already
  consented never sees it, because skip_redirect is on the wire.

Route calls stay at 8. No new markup, no CSS.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-08-01-s85.html'
DST_DEFAULT = 'public/litenco-stage-2026-08-01-s86.html'
REG_DEFAULT = 'public/effect-registry.js'

# ---- the gate already knows. Act on it. ---------------------------------
GATE_OLD = '''      if (!v || SRC.gateFp !== fp) return;
      SRC.gate = v;
      raiseFault();'''

GATE_NEW = '''      if (!v || SRC.gateFp !== fp) return;
      SRC.gate = v;
      /* The studio has looked at the photograph and would rather it were
         another Series. It says so HERE — before a finish is chosen, before
         a pose, before an account, and above all before ten credits move.

         This answer has always been in the response. It was stored and
         handed to raiseFault(), which only understands intake faults, so a
         group photograph walked the whole path and was declined at the far
         end after being charged for. Rich's own log had
         "[portraits/gate] redirected→groups" twenty lines above the charge. */
      if (v.status === 'redirected' && v.redirect && !SRC.skipRedirect){
        console.log('[intake] the studio would rather this were ' +
                    (v.redirect.series || 'another Series'));
        offerRedirect(v.redirect);
        return;
      }
      raiseFault();'''

# the offer, rehung on the photograph rather than on a queue item
OPEN_OLD = '''  function openRedirect(item){
    if (!redirectModal || !item || !item.redirect) return;'''

OPEN_NEW = '''  /* Raised at the upload, from the gate's answer. There is no queue item at
     this point and there should not be — nothing has been chosen and nothing
     has been charged. The consent lives on the photograph. */
  function offerRedirect(redirect){
    openRedirect({ redirect: redirect });
  }

  function openRedirect(item){
    if (!redirectModal || !item || !item.redirect) return;'''

# consent belongs to the photograph, not to one queued piece
ANYWAY_OLD = '''  function craftAnyway(){
    if (!REDIRECTED) return;
    var item = REDIRECTED;
    closeRedirect();
    item.skipRedirect = true;
    item.status       = 'pending';
    item.paid         = false;
    item.refunded     = false;
    item.redirect     = null;
    item.error        = null;
    if (QUEUE.indexOf(item) < 0) QUEUE.push(item);
    renderQueue();
    labelGo();
    runAll();
  }'''

ANYWAY_NEW = '''  /* The consent is about THIS PHOTOGRAPH, and it is given before anything is
     chosen. So it is recorded on the source, and every piece built from that
     photograph carries it — see buildPayload. Choosing a different
     photograph clears it: agreeing that one group shot may be crafted as a
     Portrait is not a standing instruction to ignore the studio.

     Two entry points, because the gate is not guaranteed to answer first:

       · from the upload — no queue item exists, and none is made. The
         customer carries on choosing finishes as they would have.
       · from a craft that was declined at /generate — the item is put back
         to pending and re-run, which charges once through the ordinary gate. */
  function craftAnyway(){
    var item = REDIRECTED;
    closeRedirect();
    SRC.skipRedirect = true;

    if (!item || !item.id){
      /* Raised at the upload. Nothing to re-run — let them carry on. */
      if (typeof say === 'function' && typeof SAY !== 'undefined') say(SAY.photo);
      return;
    }
    item.skipRedirect = true;
    item.status       = 'pending';
    item.paid         = false;
    item.refunded     = false;
    item.redirect     = null;
    item.error        = null;
    if (QUEUE.indexOf(item) < 0) QUEUE.push(item);
    renderQueue();
    labelGo();
    runAll();
  }'''

# every piece from a consented photograph carries the override
PAYLOAD_OLD = '''      skip_redirect:         item.skipRedirect === true'''
PAYLOAD_NEW = '''      /* Either the customer consented to this photograph at the upload, or
         to this one piece after it was declined at /generate. */
      skip_redirect:         item.skipRedirect === true || SRC.skipRedirect === true'''

# a new photograph is a new question
CLEAR_OLD = '''      SRC.gate = null;  SRC.recs = null;  SRC.gateFp = null;
      SRC.overridden = false;'''
CLEAR_NEW = '''      SRC.gate = null;  SRC.recs = null;  SRC.gateFp = null;
      SRC.overridden = false;
      /* A different photograph asks the question again. */
      SRC.skipRedirect = false;'''

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

    if 'function offerRedirect' not in a_code: die('the upload path cannot raise the offer')
    pg = a_code.index('function precheckSourceGate')
    seg = a_code[pg:pg + 1400]
    if 'offerRedirect' not in seg: die('the gate answer is still ignored')
    if "v.status === 'redirected'" not in seg: die('the redirect status is not read at the gate')
    if 'SRC.skipRedirect' not in a_code: die('consent is not held on the photograph')
    # NOT a position check. The TDZ rule is about `var`, which hoists the
    # name and never the value; a function DECLARATION hoists whole and is
    # callable from above its own text. Asserting position here would be
    # cargo-culting the rule rather than applying it.
    if not re.search(r'\bfunction offerRedirect\s*\(', a_code):
        die('offerRedirect is not a hoisted declaration')
    if 'SRC.skipRedirect = false' not in a_code:
        die('a new photograph does not clear the consent')

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

    print('  gate: the offer is raised at the upload, consent held on the photograph, 8 routes')


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

const MSG = 'We see three women in dresses, bride & bridesmaids in your photograph.';
let isGroup = true;
const calls = [];
const j = (o, ok=true, st=200) => Promise.resolve({ ok, status:st, json:() => Promise.resolve(o) });
w.fetch = (url, opt) => {
  calls.push({ url, body: opt && opt.body ? JSON.parse(opt.body) : null });
  if (url.includes('/auth/me')) return j({ user:{ id:'uid-1', email:'r@x.com' } });
  if (url.includes('/analyze')) return j({ result:{ quality_verdict:'green', smallest_face_min_dim_px:500 } });
  if (url.includes('/portraits/gate'))
    return isGroup ? j({ status:'redirected', redirect:{ series:'groups', message:MSG,
                         ctaLabel:'Step Inside Groups', stayLabel:'Craft it in Portrait anyway' } })
                   : j({ status:'ok' });
  if (url.includes('/curate-effects')) return j({ ok:true, recommendations: [] });
  if (url.includes('/credits/gate')) return j({ ok:true, ref_id:'craft_x', balance_after:490 });
  if (url.includes('/credits/refund')) return j({ ok:true, refunded:10, balance_after:500 });
  if (url.includes('/generate')) return j({ result:{ image_b64:'AAAA', duration_ms:900, scores:{ likeness:8.4 } } });
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
const modal = () => d.getElementById('redirectModal');

async function upload(name){
  const f = new w.File([new w.Uint8Array([1,2,3])], name, { type:'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value:[f], configurable:true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(400);
}
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

  // ---- 1..4: upload a group. The offer appears. NOTHING has been spent.
  await upload('group.jpg');
  if (!modal().classList.contains('is-open'))
    fail('the offer did not appear at the upload — the whole point of this build');
  if (d.getElementById('redirectSay').textContent.indexOf(MSG) !== 0) fail('message not shown');
  if (d.getElementById('redirectPhoto').getAttribute('src').slice(0,5) !== 'data:')
    fail('their photograph is not shown');
  if (hit('/credits/gate'))   fail('CREDITS SPENT before the offer');
  if (hit('/generate'))       fail('CRAFTED before the offer');
  if (hit('/credits/refund')) fail('a refund happened — nothing should have been charged');
  if (d.getElementById('mycoll').classList.contains('is-open')) fail('the collection opened');
  if (w.__QUEUE_PEEK().length) fail('something was queued');

  // ---- proceed anyway: no charge, no craft, just carry on
  d.getElementById('redirectAnyway').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(200);
  if (modal().classList.contains('is-open')) fail('the offer stayed open');
  if (hit('/credits/gate')) fail('proceeding charged something');
  if (!w.__SRC.skipRedirect) fail('the consent was not recorded on the photograph');

  // ---- and now an ordinary craft carries the override
  if (!await openARoom()) fail('no room offers anything craftable');
  d.querySelector('#effectFloor .silo-card[data-effect-id]')
   .dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1100);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1700);
  const sent = calls.filter(c => c.url.includes('/generate')).pop().body;
  if (sent.skip_redirect !== true) fail('the consent did not reach the wire');
  if (!d.querySelectorAll('#mcGrid .piece__img, #mcGrid .mc-feat').length) fail('the piece never landed');

  // ---- A DIFFERENT PHOTOGRAPH ASKS AGAIN
  await upload('group2.jpg');
  if (!modal().classList.contains('is-open'))
    fail('a new group photograph did not ask again — the consent leaked');
  d.getElementById('redirectNew').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(120);

  // ---- a single-subject photograph is never asked
  isGroup = false;
  await upload('single.jpg');
  if (modal().classList.contains('is-open')) fail('a single-subject photograph raised the offer');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  offered at upload · nothing spent · consent per photograph · single subjects untouched');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s86.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s86.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:500]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    REG = sys.argv[3] if len(sys.argv) > 3 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    for nm, a in [('gate', GATE_OLD), ('open', OPEN_OLD), ('anyway', ANYWAY_OLD),
                  ('payload', PAYLOAD_OLD), ('clear', CLEAR_OLD)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (nm, before.count(a)))

    after = before.replace(GATE_OLD, GATE_NEW)
    after = after.replace(OPEN_OLD, OPEN_NEW)
    after = after.replace(ANYWAY_OLD, ANYWAY_NEW)
    after = after.replace(PAYLOAD_OLD, PAYLOAD_NEW)
    after = after.replace(CLEAR_OLD, CLEAR_NEW)

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
