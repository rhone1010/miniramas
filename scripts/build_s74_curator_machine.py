#!/usr/bin/env python3
"""
build_s74_curator_machine.py  —  CUI V24, 2026-07-31
BUILD 1, LANE 1 OF 3 — the Curator machine.

IN   public/litenco-stage-2026-07-31-s73.html
OUT  public/litenco-stage-2026-07-31-s74.html
ALSO scripts/module_curator_machine.js  (the inserted block, kept beside this script so the
     JS can be node --check'd on its own before it is ever embedded)

WHAT CHANGES

  s73 has no photograph in it. The Curator slot set a mood; the panel showed a
  demo bust. This build puts a real file in and fires the three read-side
  routes b2 owns.

  MARKUP — one hidden file input beside the Curator slot. That is all.

  SCRIPT — one module inserted after the Curator-speaks block, carrying four
  ports read from public/portraits-b2.html on 2026-07-31:

      localPhotoCheck        b2 4831   verbatim
      precheckSourceGate     b2 5288   /portraits/gate
      runAnalyze             b2 6585   /portraits/analyze
      curatorEnterEffects    b2 7225   /portraits/curate-effects

  ROUTE CALLS 0 -> 3. Asserted. The remaining four arrive in lanes 2 and 3.

WHAT IS DELIBERATELY NOT DONE

  No Curator copy is authored. Every line spoken here already existed —
  SAY.photo, SAY.reject, and the intake states drawn in r02. PROCEDURES §2
  gives the voice to CENG and board 3.7 already flags this lane for drifting
  into writing it. The analyze route's `recommendation` string is received
  and NOT displayed: engine copy is not Curator copy.

  b2's renderEffectCards is not ported. The floor already paints cards; the
  recommendation only decides which. Recommendations are filtered against the
  registry and anything not body==='live' is dropped — the registry governs
  what may be offered and a recommendation is not an exception.

  No credits, no queue change, no craft. Craft still stops at __openPaywall.
"""

import os, re, sys, subprocess

SRC_DEFAULT = 'public/litenco-stage-2026-07-31-s73.html'
DST_DEFAULT = 'public/litenco-stage-2026-07-31-s74.html'
MOD_DEFAULT = 'scripts/module_curator_machine.js'
REG_DEFAULT = 'public/effect-registry.js'

# --- anchors, each asserted unique before anything is applied -------------
MARKUP_ANCHOR = '''          <div class="cur-slot" id="curSlot" role="button" tabindex="0">'''
MARKUP_INSERT = '''          <input type="file" id="srcFile" accept="image/*" hidden>
'''

# the Curator-speaks block ends here; the module goes directly after it
SCRIPT_ANCHOR = '''  if (curChange) curChange.addEventListener('click', function(){
    curatorState('empty', SAY.empty);
  });
'''

# curSlot currently only sets a mood. It must open the picker instead.
TAKE_OLD = '''    var take = function(){ curatorState('photo', SAY.photo); };'''
TAKE_NEW = '''    /* Was: set the mood and show a demo bust. Now: open the picker. The
       Curator changes state when a file actually lands, not when the slot
       is clicked — see onSourceFile. */
    var take = function(){ pickSource(); };'''

EXPECT_FETCHES_BEFORE = 0
EXPECT_FETCHES_AFTER  = 3
EXPECT_IDS_BEFORE     = 70
EXPECT_IDS_AFTER      = 71          # + srcFile
EXPECT_ROUTES = ['/api/v1/portraits/gate',
                 '/api/v1/portraits/analyze',
                 '/api/v1/portraits/curate-effects']

BANNED = ['sculpt', 'sculpted', 'sculpture', 'discount', 'in-situ', 'in situ', 'render']


def die(m):
    print('GATE FAIL: ' + m); sys.exit(1)


def inline_script(html):
    m = list(re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.S | re.I))
    if len(m) != 1:
        die('expected one inline script block, found %d' % len(m))
    return m[0].group(1)


def styles(html):
    return ''.join(m.group(1) for m in re.finditer(r'<style[^>]*>(.*?)</style>', html, re.S | re.I))


def markup(html):
    h = re.sub(r'<script[^>]*>.*?</script>', '<script></script>', html, flags=re.S | re.I)
    return re.sub(r'<style[^>]*>.*?</style>', '<style></style>', h, flags=re.S | re.I)


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


def gate(before, after, module):
    a_js = inline_script(after)
    a_code = strip_comments(a_js)
    b_code = strip_comments(inline_script(before))

    # 1 · the module landed exactly once, whole
    if a_js.count(module.strip()[:120]) != 1:
        die('module head not found exactly once')
    if TAKE_OLD in a_js:              die('curSlot still only sets a mood')
    if a_js.count(TAKE_NEW) != 1:     die('take() replacement not unique')

    # 2 · routes
    nf = len(re.findall(r'\bfetch\s*\(', a_code))
    if nf != EXPECT_FETCHES_AFTER:
        die('fetch count %d, expected %d' % (nf, EXPECT_FETCHES_AFTER))
    for r in EXPECT_ROUTES:
        if a_code.count("'" + r + "'") != 1:
            die('route %s not declared exactly once' % r)

    # 3 · nothing lost
    def decls(code): return set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', code))
    lost = decls(b_code) - decls(a_code)
    if lost:                          die('functions lost: %s' % sorted(lost))
    ids = re.findall(r'\bid="([^"]+)"', markup(after))
    if len(ids) != EXPECT_IDS_AFTER:  die('id count %d, expected %d' % (len(ids), EXPECT_IDS_AFTER))
    if len(set(ids)) != len(ids):     die('duplicate ids: %s' % sorted({i for i in ids if ids.count(i) > 1}))
    if 'srcFile' not in ids:          die('srcFile input not in markup')
    if styles(before) != styles(after):
        die('style block changed; this build declares no style change')

    # 4 · TDZ — every var the module reads at init must be declared above it
    mod_at = a_code.index('var GATE_URL')
    for name in ['QUEUE', 'R', 'SAY', 'cur', 'curSay']:
        d = re.search(r'\bvar\s+' + name + r'\b', a_code)
        if not d:                     die('cannot locate declaration of %s' % name)
        if d.start() > mod_at:        die('%s declared below the module that reads it (TDZ)' % name)

    # 5 · syntax and balance
    import tempfile
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write(a_js); tmp = t.name
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    if r.returncode != 0:             die('node --check: ' + r.stderr.strip().splitlines()[0])
    st = styles(after)
    if st.count('{') != st.count('}'): die('style braces unbalanced')

    # 6 · vocabulary, in what the customer can actually read.
    #     HTML comments are stripped first, for the same reason the JS gate
    #     strips its own: s73 carries "<!-- Rendered from EFFECT_REGISTRY -->",
    #     which is a note to the next reader of the file, not copy. Two gates
    #     have already fired on the comment explaining their own fix; this is
    #     that fault class in the markup.
    vis = re.sub(r'<!--.*?-->', '', markup(after), flags=re.S).lower()
    for w in BANNED:
        if re.search(r'\b' + re.escape(w) + r'\w*', vis):
            die('banned vocabulary in customer-visible markup: %r' % w)

    print('  gate: module landed, 3 routes, no functions lost, 71 ids, TDZ clear, syntax clean')


BOOT = r'''
const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const reg  = fs.readFileSync(process.argv[3], 'utf8');
const errs = [];
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, d = dom.window.document;
w.addEventListener('error', e => errs.push('window error: ' + e.message));
const fail = m => { console.log('FAIL ' + m); process.exit(1); };

// --- routes are stubbed. This proves the wiring, never the engine.
const calls = [];
w.fetch = (url, opt) => {
  calls.push({ url, body: JSON.parse(opt.body) });
  const j = o => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(o) });
  if (url.includes('/analyze')) return j({ result: { quality_verdict: 'green', smallest_face_min_dim_px: 420 } });
  if (url.includes('/gate'))    return j({ status: 'ok' });
  if (url.includes('/curate-effects')) return j({ ok: true, recommendations: [
      { preset: 'bronze', preset_label: 'Bronze' },
      { preset: 'not_a_real_effect', preset_label: 'Ghost' } ] });
  return j({});
};
// jsdom has no canvas backend; localPhotoCheck must degrade, not throw.
w.Image = class { set src(v){ this.naturalWidth = 1200; this.naturalHeight = 1600;
  if (this.onload) setTimeout(() => this.onload(), 0); } };

try { w.eval(reg); } catch (e) { fail('registry: ' + e.message); }
const inline = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1];
try { w.eval(inline); } catch (e) { fail('boot threw: ' + e.message); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  // --- ALIVE, not merely silent
  if (!d.getElementById('tbcGoVerb').textContent.trim()) fail('rail button never labelled');
  if (d.querySelectorAll('#siloFloor .silo-card').length !== 8) fail('silo floor not 8');
  if (!Array.isArray(w.POSES) || !w.POSES.length) fail('window.POSES unreachable');
  if (!d.getElementById('srcFile')) fail('file input missing');
  if (!w.__SRC) fail('source state not exposed');

  // --- clicking the slot must open the picker, not set a mood
  let picked = false;
  d.getElementById('srcFile').click = () => { picked = true; };
  d.getElementById('curSlot').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  if (!picked) fail('curSlot did not open the file picker');
  if (d.getElementById('cur').dataset.state === 'photo')
    fail('Curator changed state on click — it must wait for a file');

  // --- drive a real file through
  const f = new w.File([new w.Uint8Array([1,2,3])], 'p.jpg', { type: 'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value: [f], configurable: true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(400);

  if (!w.__SRC.b64) fail('source never read');
  if (d.getElementById('cur').dataset.state !== 'photo') fail('Curator did not take the photograph');
  if (d.getElementById('curThumb').src.slice(0, 5) !== 'data:') fail('thumb still shows the demo image');

  const hit = u => calls.filter(c => c.url.includes(u)).length;
  if (hit('/analyze') !== 1) fail('analyze called ' + hit('/analyze') + ' times');
  if (hit('/gate') !== 1)    fail('gate called ' + hit('/gate') + ' times');
  if (hit('/curate-effects') !== 1) fail('curate-effects called ' + hit('/curate-effects') + ' times');
  if (!calls[0].body.source_image_b64) fail('payload carries no image');

  // --- the registry governs: a recommended id that is not live is dropped
  if (!Array.isArray(w.__RECS)) fail('recommendations not stored');
  if (w.__RECS.length !== 1) fail('expected 1 live rec, got ' + w.__RECS.length);
  if (w.__RECS[0].id !== 'bronze') fail('wrong rec survived');

  const modal = d.getElementById('intakeModal');
  if (modal.classList.contains('is-open')) fail('a clean photograph raised a fault');

  // --- a rejected photograph must raise the state that was drawn for it,
  //     over the customer's own image, not a stock one.
  w.fetch = (url, opt) => {
    calls.push({ url, body: JSON.parse(opt.body) });
    const j = o => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(o) });
    if (url.includes('/gate')) return j({ status: 'intake_rejected',
      intake: { reasons: ['the face is too small and far from the camera'] } });
    if (url.includes('/analyze')) return j({ result: { quality_verdict: 'green' } });
    return j({ ok: true, recommendations: [] });
  };
  const f2 = new w.File([new w.Uint8Array([9,9,9])], 'far.jpg', { type: 'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value: [f2], configurable: true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(400);

  if (!modal.classList.contains('is-open')) fail('a rejected photograph raised nothing');
  const on = [...modal.querySelectorAll('.state')].filter(s => s.classList.contains('active'));
  if (on.length !== 1) fail(on.length + ' intake states active at once');
  if (on[0].dataset.s !== '5') fail('face rejection opened state ' + on[0].dataset.s + ', expected 5');
  const shown = on[0].querySelector('img[data-role="their-photo"]');
  if (!shown || shown.getAttribute('src').slice(0, 5) !== 'data:')
    fail('the fault is shown over a stock image, not their photograph');

  // --- 'Use this one anyway' is honoured and remembered
  on[0].querySelector('.btn.ghost').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  if (modal.classList.contains('is-open')) fail('override did not close the modal');
  if (!w.__SRC.overridden) fail('override not remembered');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  alive · picker · 3 routes · ghost rec dropped · reject -> state 5 over their photo · override held');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s74.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s74.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout:
        die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    MOD = sys.argv[3] if len(sys.argv) > 3 else MOD_DEFAULT
    REG = sys.argv[4] if len(sys.argv) > 4 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    module = open(MOD, encoding='utf-8').read()

    for name, a in [('markup', MARKUP_ANCHOR), ('script', SCRIPT_ANCHOR), ('take', TAKE_OLD)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (name, before.count(a)))

    nf = len(re.findall(r'\bfetch\s*\(', strip_comments(inline_script(before))))
    if nf != EXPECT_FETCHES_BEFORE:
        die('input has %d fetches, expected %d — wrong base file' % (nf, EXPECT_FETCHES_BEFORE))

    after = before.replace(MARKUP_ANCHOR, MARKUP_INSERT + MARKUP_ANCHOR)
    after = after.replace(SCRIPT_ANCHOR, SCRIPT_ANCHOR + module)
    after = after.replace(TAKE_OLD, TAKE_NEW)

    gate(before, after, module)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
