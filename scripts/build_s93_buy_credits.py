#!/usr/bin/env python3
"""
build_s93_buy_credits.py  —  CUI V24, 2026-08-02
IN   public/litenco-stage-2026-08-02-s92.html
OUT  public/litenco-stage-2026-08-02-s93.html
MOD  scripts/module_buy.js

Board 1.3. The shortfall stops being a dead end.

WHAT WAS WRONG
  The gate answers insufficient_credits and the client wrote one line under
  the button — "0 credits · this needs 10" — and stopped. A customer who
  wants to spend money and cannot is the worst state in the product, and it
  has been the state since credits landed.

  __openPaywall was the named hook s72 left undone for exactly this. It has a
  destination now.

WHERE IT OPENS
  A slide-out from the rail. That is where the shortfall was found and where
  their chosen pieces are sitting; sending them to a page would mean leaving
  the thing they were in the middle of.

STRIPE IS EMBEDDED — ruled by Rich, 2026-08-02
  Hosted checkout takes the whole window, so buying meant leaving the studio
  mid-craft. ui_mode 'embedded' renders the form inside our own panel. The
  purchase route was rewritten for it the same day and returns a
  client_secret and the publishable key instead of a url.

  Stripe.js loads on first use, not on every page view. A third-party script
  on the critical path of every visit, for a panel most customers never open,
  is a cost with no return.

PRICES COME FROM THE ROUTE
  /api/v1/skus, the same rows the purchase route checks against Stripe before
  a session exists. ladderPct() is in this file and disagrees with the locked
  ladder above ten images; it is not consulted. A price in two places is a
  price that will disagree with itself.

  Per-image is shown because it is the honest comparison and the customer can
  check it against the top of the column. No percentages: 'save', 'off' and
  'discount' are banned customer-side and this build's own gate rejects them.

ROUTE CALLS 8 -> 10.  /api/v1/skus and /api/v1/credits/purchase.

THE RETURN
  Stripe sends them back with ?credits=1. The webhook lands the credits; this
  page clears the flag and restores their work through the same machinery the
  magic link uses. It never reads a balance out of the address bar.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-08-02-s92.html'
DST_DEFAULT = 'public/litenco-stage-2026-08-02-s93.html'
MOD_DEFAULT = 'scripts/module_buy.js'
REG_DEFAULT = 'public/effect-registry.js'

MARKUP_ANCHOR = '''<div class="scrim m-scrim" id="signinModal" data-role="modal">'''
MARKUP_ADD = '''<aside class="buy" id="buyPanel" aria-label="Buy credits">
  <div class="buy-card">
    <button class="buy-x" id="buyX" aria-label="Close">&times;</button>
    <div class="buy-head">
      <img class="buy-mark" src="/icons/curator-c.svg" alt="">
      <span class="buy-title">Credits</span>
    </div>
    <p class="buy-say" id="buySay"></p>
    <div class="buy-err" id="buyErr"></div>
    <div class="buy-list" id="buyList"></div>
    <div class="buy-form" id="buyForm"></div>
    <button class="buy-back" id="buyBack" hidden>&larr; Choose a different block</button>
    <div class="buy-fine">Credits do not expire. Ten credits craft one piece.</div>
  </div>
</aside>

'''

CSS_ANCHOR = '''.m-scrim{ display:none }'''
CSS_ADD = '''/* ===================================================================
   BUYING CREDITS — a slide-out at the rail
   ===================================================================
   It comes from the right because that is where the shortfall was found and
   where the customer's chosen pieces are sitting. Not a page: leaving the
   workshop was the whole problem with the hosted form. */
.buy{
  position:fixed; top:0; right:0; bottom:0; z-index:1300;
  width:min(440px, 100%);
  transform:translateX(100%);
  transition:transform .34s cubic-bezier(.32,.72,.32,1);
  display:flex; pointer-events:none;
}
.buy.is-open{ transform:none; pointer-events:auto }
.buy-card{
  flex:1; overflow-y:auto;
  background:linear-gradient(180deg,#faf6ec,#f1e8d7);
  border-left:1px solid rgba(147,111,67,.4);
  box-shadow:-24px 0 60px rgba(31,27,20,.4);
  padding:1.9rem 1.7rem 2.2rem;
  position:relative;
}
.buy-x{
  position:absolute; top:1.1rem; right:1.2rem;
  width:2rem; height:2rem; border:0; border-radius:50%;
  background:none; color:var(--taupe); font-size:1.4rem; line-height:1; cursor:pointer;
}
.buy-x:hover{ color:var(--ink); background:rgba(42,36,30,.06) }
.buy-head{ display:flex; align-items:center; gap:.7rem; margin-bottom:1rem }
.buy-mark{ width:2.4rem; height:2.4rem; flex:0 0 auto; display:block }
.buy-title{
  font-family:var(--serif, 'Cormorant Garamond', Georgia, serif);
  font-size:1.7rem; color:var(--ink);
}

/* The shortfall is a fact about money, so it is stated in the second
   register — sans, unsigned, no charm. The Curator does not sell. */
.buy-say{
  font-family:var(--sans, system-ui, sans-serif);
  font-size:.92rem; line-height:1.55; color:var(--ink-soft);
  margin-bottom:1.1rem;
}
.buy-err{
  min-height:1.2em;
  font-family:var(--sans, system-ui, sans-serif);
  font-size:.82rem; color:#a05a5a;
}

.buy-list{ display:flex; flex-direction:column; gap:.55rem }
.buy-block{
  display:grid; grid-template-columns:1fr auto; gap:.15rem .8rem;
  align-items:baseline; text-align:left;
  padding:.85rem 1rem; cursor:pointer;
  background:rgba(255,255,255,.5);
  border:1px solid rgba(147,111,67,.3); border-radius:5px;
  transition:border-color .15s, background .15s;
}
.buy-block:hover{ border-color:var(--brass); background:rgba(255,255,255,.8) }
.buy-block__n{
  font-family:var(--serif, 'Cormorant Garamond', Georgia, serif);
  font-size:1.35rem; color:var(--ink);
}
.buy-block__p{
  font-family:var(--sans, system-ui, sans-serif);
  font-size:1.05rem; font-variant-numeric:tabular-nums; color:var(--ink);
  text-align:right;
}
.buy-block__i, .buy-block__e{
  font-family:var(--sans, system-ui, sans-serif);
  font-size:.78rem; color:var(--ink-soft);
}
.buy-block__e{ text-align:right; font-variant-numeric:tabular-nums }
.buy-block__tag{
  grid-column:1 / -1; margin-top:.35rem;
  font-family:var(--mono, ui-monospace, monospace);
  font-size:.62rem; letter-spacing:.1em; text-transform:uppercase;
  color:var(--brass);
}
.buy-block.is-pick{ border-color:var(--brass); background:rgba(255,255,255,.85) }
/* A block that cannot clear the shortfall is still offered — they may be
   buying for later — but it does not pretend to solve the problem in front
   of them. */
.buy-block.is-short{ opacity:.62 }
.buy-block.is-short:hover{ opacity:1 }

.buy-form{ margin-top:.4rem }
.buy-back{
  margin-top:1rem; border:0; background:none; cursor:pointer;
  font-family:var(--serif, 'Cormorant Garamond', Georgia, serif);
  font-style:italic; font-size:1.1rem; color:var(--oxblood);
}
.buy-fine{
  margin-top:1.4rem;
  font-family:var(--sans, system-ui, sans-serif);
  font-size:.76rem; color:var(--taupe);
}

'''

EXPECT_FETCHES_BEFORE = 8
EXPECT_FETCHES_AFTER  = 10
EXPECT_IDS_BEFORE     = 87
EXPECT_IDS_AFTER      = 94   # 87 + the seven the panel adds
BANNED = ['sculpt', 'sculpted', 'sculpture', 'discount', 'in-situ', 'in situ',
          'render', 'queue', 'save', ' off ']


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
    sa = styles(after)

    if 'window.__openPaywall = function' not in a_code:
        die('the shortfall hook still has no destination')
    for need in ['openBuy', 'beginPurchase', 'loadBlocks', 'blockRow', 'loadStripeJs']:
        if 'function ' + need not in a_code: die('%s not declared' % need)

    # prices come from the route and are never computed
    lb = a_code.index('function blockRow')
    seg = a_code[lb:lb + 1500]
    if 'ladderPct' in seg: die('the blocks are priced by the local ladder')
    if 'priceOf(s)' not in seg and 'cents' not in seg:
        die('the price does not come from the row')
    if '/api/v1/skus' not in a_code: die('the blocks are not fetched')

    # the work is held before the customer leaves for a payment
    bp = a_code.index('function beginPurchase')
    seg2 = a_code[bp:bp + 1800]
    if 'saveResume()' not in seg2: die('the work is not held before payment')
    if seg2.index('saveResume()') > seg2.index('fetch('):
        die('the work is held after the session is created')

    # embedded, not hosted
    if 'initEmbeddedCheckout' not in a_code: die('not using embedded checkout')
    if re.search(r'location\.href\s*=\s*\w*\.url', a_code): die('still redirecting to Stripe')

    # the return trusts the webhook, not the address bar
    if re.search(r'credits=1[\s\S]{0,400}balance\s*=', a_code):
        die('the return reads a balance from the query string')

    nf = len(re.findall(r'\bfetch\s*\(', a_code))
    if nf != EXPECT_FETCHES_AFTER: die('fetch count %d, expected %d' % (nf, EXPECT_FETCHES_AFTER))

    def decls(c): return set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', c))
    lost = decls(b_code) - decls(a_code)
    if lost: die('functions lost: %s' % sorted(lost))

    ids = re.findall(r'\bid="([^"]+)"', markup(after))
    if len(ids) != EXPECT_IDS_AFTER: die('id count %d, expected %d' % (len(ids), EXPECT_IDS_AFTER))
    if len(set(ids)) != len(ids):
        die('duplicate ids: %s' % sorted({i for i in ids if ids.count(i) > 1}))
    for cls in ['.buy', '.buy-card', '.buy-block', '.buy-say', '.buy-form', '.buy-back']:
        if not re.search(r'(?<![\w-])' + re.escape(cls) + r'[\s,{:.]', sa):
            die('%s is used in markup and has no rule' % cls)
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
        if re.search(r'\b' + re.escape(w.strip()) + r'\w*', vis):
            die('banned vocabulary in customer-visible text: %r' % w)

    print('  gate: shortfall has a destination, prices from the route, embedded, work held, 10 routes')


BOOT = r'''
const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const reg  = fs.readFileSync(process.argv[3], 'utf8');
const errs = [], store = {}, logs = [];
const dom = new JSDOM(html, { runScripts:'outside-only', pretendToBeVisual:true,
                              url:'http://localhost/s.html' });
const w = dom.window, d = dom.window.document;
w.addEventListener('error', e => errs.push('window error: ' + e.message));
Object.defineProperty(w, 'localStorage', { value: {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k,v) => { store[k]=String(v); }, removeItem: k => { delete store[k]; }
}, configurable: true });
w.console = { log:(...a)=>logs.push(a.join(' ')), warn(){}, error(){} };

// the real prices, as they sit in skus today
// THE SHAPE THE ROUTE ACTUALLY SENDS, copied from a live response on
// 2026-08-02. The previous stub used the database's snake_case and so
// asserted against a response the server has never produced — five blocks
// read $NaN on the glass and this gate said OK. It also carries the two
// non-credit rows, because the real response does and the filter has to
// earn its place.
const SKUS = [
  { id:'single',      displayName:'Single Generation', kind:'single',  count:1,   priceCents:199,  active:true },
  { id:'credits_10',  displayName:'10 Credits',  kind:'credits', count:10,  priceCents:499,  active:true, recommended:false },
  { id:'pack_4',      displayName:'Four-pack',   kind:'bundle',  count:4,   priceCents:599,  active:true },
  { id:'credits_30',  displayName:'30 Credits',  kind:'credits', count:30,  priceCents:1299, active:true, recommended:false },
  { id:'credits_60',  displayName:'60 Credits',  kind:'credits', count:60,  priceCents:2299, active:true, recommended:false },
  { id:'credits_120', displayName:'120 Credits', kind:'credits', count:120, priceCents:3999, active:true, recommended:true  },
  { id:'credits_300', displayName:'300 Credits', kind:'credits', count:300, priceCents:8499, active:true, recommended:false },
];

let broke = true;                    // the gate refuses the first craft
const calls = [];
const j = (o) => Promise.resolve({ ok:true, status:200, json:() => Promise.resolve(o) });
w.fetch = (url, opt) => {
  calls.push({ url, body: opt && opt.body ? JSON.parse(opt.body) : null });
  if (url.includes('/auth/me')) return j({ user:{ id:'uid-1', email:'r@x.com' } });
  if (url.includes('/analyze')) return j({ result:{ quality_verdict:'green', smallest_face_min_dim_px:500 } });
  if (url.includes('/portraits/gate')) return j({ status:'ok' });
  if (url.includes('/curate-effects')) return j({ ok:true, recommendations: [] });
  if (url.includes('/api/v1/skus')) return j({ skus: SKUS });
  if (url.includes('/credits/purchase'))
    return j({ clientSecret:'cs_test_secret', publishableKey:'pk_test_x',
               sessionId:'cs_1', credits:120, amountCents:3999 });
  if (url.includes('/credits/gate'))
    return broke ? j({ ok:false, reason:'insufficient_credits', balance:0, needed:10 })
                 : j({ ok:true, ref_id:'craft_x', balance_after:110 });
  if (url.includes('/generate')) return j({ result:{ image_b64:'AAAA', duration_ms:900, scores:{ likeness:8.4 } } });
  return j({});
};
w.Image = class { set src(v){ this.naturalWidth=1200; this.naturalHeight=1600;
  if (this.onload) setTimeout(() => this.onload(), 0); } };

// Stripe.js, stubbed. Loading the real script would make this gate depend on
// the network, and a gate that needs the internet is a gate that goes amber.
let mounted = null;
w.Stripe = function(k){
  return { initEmbeddedCheckout: (o) => Promise.resolve({
    mount: (sel) => { mounted = { key:k, secret:o.clientSecret, sel }; },
    destroy: () => { mounted = null; }
  }) };
};

try { w.eval(reg); } catch (e) { console.log('FAIL registry'); process.exit(1); }
try { w.eval(html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1]); }
catch (e) { console.log('FAIL boot threw: ' + e.message); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { console.log('FAIL ' + m); process.exit(1); };
const hit = u => calls.filter(c => c.url.includes(u)).length;
const panel = () => d.getElementById('buyPanel');

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

  if (panel().classList.contains('is-open')) fail('the panel was open before the shortfall');

  // ---- SHORT ON CREDITS: the dead end becomes a way through
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(500);
  if (!panel().classList.contains('is-open')) fail('the shortfall is still a dead end');
  if (hit('/generate')) fail('CRAFTED WITHOUT CREDITS');
  if (!d.getElementById('buySay').textContent.match(/needs 10 credits/))
    fail('the shortfall is not stated');

  // five blocks, priced from the route, per-image shown, no percentages
  const blocks = d.querySelectorAll('#buyList .buy-block');
  if (blocks.length !== 5) fail(blocks.length + ' blocks, expected 5');
  const first = blocks[0], last = blocks[4];
  if (!first.textContent.match(/\$4\.99/)) fail('10-credit block is not $4.99');
  if (!last.textContent.match(/\$84\.99/)) fail('300-credit block is not $84.99');
  if (!last.textContent.match(/\$2\.83 each/)) fail('per-image is wrong on the largest block');
  const picked = d.querySelectorAll('#buyList .buy-block.is-pick');
  if (picked.length !== 1) fail(picked.length + ' recommended blocks');
  if (picked[0].dataset.sku !== 'credits_120') fail('the wrong block is recommended');
  if (d.getElementById('buyList').textContent.match(/save|discount|% off/i))
    fail('a percentage claim reached the blocks');
  // The fault this stub was rewritten for: a price the client could not read.
  if (d.getElementById('buyList').textContent.match(/NaN|undefined|\$0\.00/))
    fail('a block rendered without a price');
  if (blocks.length !== 5) fail('a non-credit sku reached the panel');

  // ---- CHOOSING ONE: work held, session made, form mounted IN OUR PANEL
  picked[0].dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(400);
  if (!store['liten_resume_v1']) fail('the work was not held before payment');
  if (hit('/credits/purchase') !== 1) fail('no session was created');
  const sent = calls.find(c => c.url.includes('/credits/purchase')).body;
  if (sent.skuId !== 'credits_120') fail('the wrong sku was sent');
  if (sent.ownerKey !== 'uid-1') fail('no owner on the purchase');
  if (sent.amount || sent.price || sent.credits) fail('the client sent a price');
  if (!mounted) fail('the payment form never mounted');
  if (mounted.sel !== '#buyForm') fail('the form mounted outside our panel: ' + mounted.sel);
  if (mounted.key !== 'pk_test_x') fail('the publishable key did not reach Stripe');
  if (!panel().classList.contains('is-open')) fail('the panel closed under the form');
  if (!d.getElementById('buyList').hidden) fail('the blocks are still showing behind the form');

  // ---- BACK: the form is torn down, the blocks return
  d.getElementById('buyBack').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(120);
  if (mounted) fail('the form was not destroyed');
  if (d.getElementById('buyList').hidden) fail('the blocks did not come back');

  // ---- and with credits, the craft goes through and the panel stays shut
  broke = false;
  d.getElementById('buyX').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(120);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1500);
  if (panel().classList.contains('is-open')) fail('the panel opened on a craft that could pay');
  if (hit('/generate') !== 1) fail('the craft did not run');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  shortfall opens the panel · 5 blocks from the route · 120 recommended · form mounts in place · nothing crafted unpaid');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s93.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s93.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    MOD = sys.argv[3] if len(sys.argv) > 3 else MOD_DEFAULT
    REG = sys.argv[4] if len(sys.argv) > 4 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    module = open(MOD, encoding='utf-8').read()

    for nm, a in [('markup', MARKUP_ANCHOR), ('css', CSS_ANCHOR)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (nm, before.count(a)))

    nf = len(re.findall(r'\bfetch\s*\(', strip_comments(inline_script(before))))
    if nf != EXPECT_FETCHES_BEFORE:
        die('input has %d fetches, expected %d — wrong base file' % (nf, EXPECT_FETCHES_BEFORE))

    after = before.replace(MARKUP_ANCHOR, MARKUP_ADD + MARKUP_ANCHOR)
    after = after.replace(CSS_ANCHOR, CSS_ADD + CSS_ANCHOR)

    # the module reads ME, SRC, saveResume and CREDITS_PER_IMAGE — all above
    # the sign-in module, which is itself above the Craft listener.
    TAIL = "  (function wireIntakeActions(){"
    if after.count(TAIL) != 1:
        die('module anchor appears %d times' % after.count(TAIL))
    after = after.replace(TAIL, module + '\n' + TAIL)

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
