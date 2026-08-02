#!/usr/bin/env python3
"""
build_s76_craft.py  —  CUI V24, 2026-07-31
BUILD 1, LANE 3 OF 3 — the craft. This closes the loop.

IN   public/litenco-stage-2026-07-31-s75.html
OUT  public/litenco-stage-2026-07-31-s76.html
MOD  scripts/module_craft.js

WHAT CHANGES

  Craft stopped at __openPaywall, a named hook s72 deliberately left undone.
  It now spends credits and calls /generate, and what comes back lands in
  My Collection.

  ROUTE CALLS 3 -> 5.  /credits/gate and /portraits/generate.
  Seven was the number in b2. The two /qa/settings and /raw-pipeline are cut,
  and b2's second /generate served the raw branch, which is also cut. Five is
  the whole surviving set for Portraits. THE GATE ASSERTS 5 FROM HERE.

  ORDER. Credits move first. If they do not move, nothing is crafted. That
  ordering is the reason this lane is last.

  PROGRESS. b2 reported into gDot / gStatus / stageProgress, none of which
  exist here. The rail reports instead: each row carries data-craft, and the
  button counts down. One place to look, and it is the place they are already
  looking. Three CSS rules, added with the module that writes the attribute.

  SEEDS OFF. SEED_ON goes false. Five fictional pieces existed so the landing
  animation could be judged before anything real could land; something real
  can land now, and a customer's first Crafted Image should not arrive fifth
  behind four that are not theirs. One word to put back.

WHAT IS DELIBERATELY NOT DONE

  The shortfall. b2 called alert(). Item 1.3 is the purchase screen and it is
  unbuilt, so a shortfall calls __openPaywall if anything has provided one and
  otherwise says so on the button and stops. Nothing crafted, nothing charged.
  Inventing that contract here is precisely what s72 refused to do.

  likeness_score is read off the response and held on the item. Nothing stores
  it — board 3.5, and the column does not exist.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-07-31-s75.html'
DST_DEFAULT = 'public/litenco-stage-2026-07-31-s76.html'
MOD_DEFAULT = 'scripts/module_craft.js'
REG_DEFAULT = 'public/effect-registry.js'

# the craft module lands after the payload module — it calls payloadFor
SCRIPT_ANCHOR = '''  window.__QUEUE_PEEK = function(){ return QUEUE; };'''

# the Craft button: stop at the stub, or run
GO_OLD = '''      if (typeof window.__openPaywall === 'function') window.__openPaywall(POSE);'''
GO_NEW = '''      /* Was: a named hook that did not exist, which is where the flow
         stopped. Now the run. Credits move inside runAll before anything
         is crafted; __openPaywall survives as the shortfall's destination
         and is still nobody's invention here. */
      window.__runAll();'''

# pose is chosen after items are queued, so every item is restamped
POSE_OLD = '''    POSE = id;
    window.__POSE = id;'''
POSE_NEW = '''    POSE = id;
    window.__POSE = id;
    /* One pose, every piece, ruled 2026-07-29. Items already in the rail
       were built before this choice, so they are restamped rather than
       reading a global at craft time — an item must carry its own pose. */
    if (typeof stampPose === 'function') stampPose(id);'''

SEED_OLD = '''  var SEED_ON = true;'''
SEED_NEW = '''  var SEED_ON = false;   /* real pieces can land now — see build s76 */'''

CSS_ANCHOR = '''@keyframes tbcIn{ from{ opacity:0; transform:translateY(-.4em) } to{ opacity:1; transform:none } }'''
CSS_ADD = '''
/* The rail reports the craft. Added with s76, which writes data-craft.
   Border weight only — the row must not move or resize while it works, or
   ten rows shifting at once reads as a fault rather than as progress. */
.tbc-row[data-craft="running"]{ border-color:rgba(196,169,110,.5) }
.tbc-row[data-craft="running"] .tbc-nm{ opacity:.72 }
.tbc-row[data-craft="done"]{ border-color:rgba(140,170,120,.45) }
.tbc-row[data-craft="failed"],
.tbc-row[data-craft="rejected"]{ border-color:rgba(160,90,90,.5) }'''

EXPECT_FETCHES_BEFORE = 3
EXPECT_FETCHES_AFTER  = 5
EXPECT_IDS            = 71
EXPECT_ROUTES = ['/api/v1/portraits/gate', '/api/v1/portraits/analyze',
                 '/api/v1/portraits/curate-effects', '/api/v1/credits/gate',
                 '/api/v1/portraits/generate']
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

    if GO_OLD in a_js:                  die('Craft still stops at the paywall stub')
    if a_js.count('window.__runAll();') != 1: die('run trigger not unique')
    if SEED_OLD in a_js:                die('seeds still on')

    nf = len(re.findall(r'\bfetch\s*\(', a_code))
    if nf != EXPECT_FETCHES_AFTER:      die('fetch count %d, expected %d' % (nf, EXPECT_FETCHES_AFTER))
    for r in EXPECT_ROUTES:
        if a_code.count("'" + r + "'") != 1:
            die('route %s not declared exactly once' % r)

    def decls(c): return set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', c))
    lost = decls(b_code) - decls(a_code)
    if lost:                            die('functions lost: %s' % sorted(lost))
    for need in ['spendCredits', 'runQueueItem', 'craftPending', 'runAll', 'land', 'paintRow']:
        if need not in decls(a_code):   die('%s not declared' % need)

    # credits before craft — the ordering this lane exists for
    ra = a_code.index('function runAll')
    seg = a_code[ra:ra + 1400]
    if 'spendCredits' not in seg:       die('runAll does not spend credits')
    if seg.index('spendCredits') > seg.index('craftPending'):
        die('runAll crafts before it charges')

    ids = re.findall(r'\bid="([^"]+)"', markup(after))
    if len(ids) != EXPECT_IDS:          die('id count %d, expected %d' % (len(ids), EXPECT_IDS))
    if markup(before) != markup(after): die('markup changed; this build declares none')

    sb, sa = styles(before), styles(after)
    if sa.replace(CSS_ADD, '') != sb:   die('style block changed beyond the declared rules')
    if sa.count('{') != sa.count('}'):  die('style braces unbalanced')

    mod_at = a_code.index('var CREDITS_GATE_URL')
    for name in ['QUEUE', 'CREDITS_PER_IMAGE', 'SRC', 'tbcGoVerb']:
        d = re.search(r'\bvar\s+' + name + r'\b', a_code)
        if not d or d.start() > mod_at: die('%s declared below the craft module (TDZ)' % name)

    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write(a_js); tmp = t.name
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    if r.returncode != 0:               die('node --check: ' + r.stderr.strip().splitlines()[0])

    vis = re.sub(r'<!--.*?-->', '', markup(after), flags=re.S)
    vis = re.sub(r'<div class="readout">.*?</table>\s*</div>', '', vis, flags=re.S | re.I)
    vis = re.sub(r'<[^>]+>', ' ', vis).lower()
    for w in BANNED:
        if re.search(r'\b' + re.escape(w) + r'\w*', vis):
            die('banned vocabulary in customer-visible text: %r' % w)

    print('  gate: 5 routes, credits before craft, no functions lost, TDZ clear, seeds off')


BOOT = r'''
const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const reg  = fs.readFileSync(process.argv[3], 'utf8');
const errs = [];
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, d = dom.window.document;
w.addEventListener('error', e => errs.push('window error: ' + e.message));
const fail = m => { console.log('FAIL ' + m); process.exit(1); };

let credits = { ok: true, balance_after: 490 };
const calls = [];
const j = o => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(o) });
w.fetch = (url, opt) => {
  calls.push({ url, body: JSON.parse(opt.body) });
  if (url.includes('/analyze')) return j({ result: { quality_verdict: 'green', smallest_face_min_dim_px: 500 } });
  if (url.includes('/portraits/gate')) return j({ status: 'ok' });
  if (url.includes('/curate-effects')) return j({ ok: true, recommendations: [] });
  if (url.includes('/credits/gate')) return j(credits);
  if (url.includes('/generate')) return j({ result: { image_b64: 'AAAA', duration_ms: 900,
                                                      scores: { likeness: 8.6 } } });
  return j({});
};
w.Image = class { set src(v){ this.naturalWidth = 1200; this.naturalHeight = 1600;
  if (this.onload) setTimeout(() => this.onload(), 0); } };

try { w.eval(reg); } catch (e) { fail('registry: ' + e.message); }
try { w.eval(html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1]); }
catch (e) { fail('boot threw: ' + e.message); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const hit = u => calls.filter(c => c.url.includes(u)).length;

(async () => {
  if (!d.getElementById('tbcGoVerb').textContent.trim()) fail('rail button never labelled');
  if (d.querySelectorAll('#siloFloor .silo-card').length !== 8) fail('silo floor not 8');
  if (d.querySelectorAll('#mcGrid .mc-tile').length) fail('seeds still showing');

  // photograph, then one piece into the rail
  const f = new w.File([new w.Uint8Array([1,2,3])], 'p.jpg', { type: 'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value: [f], configurable: true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(300);
  const room = [...d.querySelectorAll('#siloFloor .silo-card')]
    .find(c => w.EFFECT_REGISTRY.offerableBySilo(c.dataset.siloId).length);
  room.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(1200);
  d.querySelector('#effectFloor .silo-card[data-effect-id]')
   .dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  if (w.__QUEUE_PEEK().length !== 1) fail('nothing in the rail');

  // step 1 -> pose floor, choose a pose, and it must restamp
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(1200);
  const pose = d.querySelector('#poseFloor [data-pose="smiling"]');
  if (!pose) fail('pose floor did not open');
  pose.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  if (w.__QUEUE_PEEK()[0].pose !== 'smiling') fail('pose not restamped onto a queued item');

  // ---- SHORTFALL FIRST: nothing may be crafted when credits do not move
  credits = { ok: false, reason: 'insufficient_credits', balance: 0, needed: 10 };
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(200);
  if (hit('/generate')) fail('CRAFTED WITHOUT CREDITS — the ordering is broken');
  if (hit('/credits/gate') !== 1) fail('credits gate not called');
  if (!d.getElementById('tbcGoSub').textContent.includes('10')) fail('shortfall not reported');
  if (w.__BUSY()) fail('stuck busy after a refused charge');

  // ---- now with credits
  credits = { ok: true, balance_after: 490 };
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(1500);

  if (hit('/credits/gate') !== 2) fail('credits gate called ' + hit('/credits/gate') + ' times');
  if (hit('/generate') !== 1) fail('generate called ' + hit('/generate') + ' times');
  const sent = calls.find(c => c.url.includes('/generate')).body;
  for (const k of ['source_image_b64','style_id','preset','location','scale','pose'])
    if (sent[k] === undefined) fail('/generate payload missing ' + k);
  if (sent.pose !== 'smiling') fail('pose did not reach the wire');

  const item = w.__QUEUE_PEEK()[0];
  if (item.status !== 'done') fail('item status ' + item.status);
  if (item.likeness_score !== 8.6) fail('likeness not read off the response');
  if (!item.paid) fail('item not marked paid');

  const tiles = d.querySelectorAll('#mcGrid .mc-tile, #mcGrid .mc-feat');
  if (!tiles.length) fail('the piece never landed in My Collection');
  if (w.__BUSY()) fail('still busy after the run finished');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  alive · pose restamped · refused charge crafts nothing · 5 routes · piece landed');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s76.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s76.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    MOD = sys.argv[3] if len(sys.argv) > 3 else MOD_DEFAULT
    REG = sys.argv[4] if len(sys.argv) > 4 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    module = open(MOD, encoding='utf-8').read()

    for nm, a in [('script', SCRIPT_ANCHOR), ('go', GO_OLD), ('pose', POSE_OLD),
                  ('seed', SEED_OLD), ('css', CSS_ANCHOR)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (nm, before.count(a)))

    nf = len(re.findall(r'\bfetch\s*\(', strip_comments(inline_script(before))))
    if nf != EXPECT_FETCHES_BEFORE:
        die('input has %d fetches, expected %d — wrong base file' % (nf, EXPECT_FETCHES_BEFORE))

    after = before.replace(SCRIPT_ANCHOR, SCRIPT_ANCHOR + module)
    after = after.replace(GO_OLD, GO_NEW)
    after = after.replace(POSE_OLD, POSE_NEW)
    after = after.replace(SEED_OLD, SEED_NEW)
    after = after.replace(CSS_ANCHOR, CSS_ANCHOR + CSS_ADD)

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
