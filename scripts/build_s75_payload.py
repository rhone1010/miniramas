#!/usr/bin/env python3
"""
build_s75_payload.py  —  CUI V24, 2026-07-31
BUILD 1, LANE 2 OF 3 — the payload.

IN   public/litenco-stage-2026-07-31-s74.html
OUT  public/litenco-stage-2026-07-31-s75.html
MOD  scripts/module_payload.js

WHAT CHANGES

  s74's queue holds {siloId, effectId} — enough to paint a rail row, nothing
  /generate can craft from. This builds the real item.

  THE MERGE. b2 and s72 both declare addToQueue and they are not the same
  function. b2's takes no arguments and reads module state; s72's takes
  (siloId, effectId) and is called that way from the floor. s72's signature
  wins; b2's body becomes buildPayload(), which the same push now carries.

  Script only. No markup, no CSS. Route calls stay at 3 — lane 3 raises them.

ALSO FIXED, one word

  The cap modal says "another queue". Queue is production language and banned
  customer-side. It predates the vocabulary gate, which reads markup and was
  added after this modal was drawn. Corrected here and the gate widened so it
  cannot return.

WHAT IS DELIBERATELY NOT DONE

  framing, plaque_text, subject_selector and focal do not enter the payload.
  Framing is not on the wire; inscriptions were ruled out 2026-07-31; subject
  pick and the focal picker were paused the same day.

  POSE IS SENT AND THE ROUTE HAS NO FIELD FOR IT. Rich is deploying pose
  prompts. Carrying it now is free and costs nothing if the route ignores it;
  discovering at lane 3 that nothing carried it would not be.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-07-31-s74.html'
DST_DEFAULT = 'public/litenco-stage-2026-07-31-s75.html'
MOD_DEFAULT = 'scripts/module_payload.js'
REG_DEFAULT = 'public/effect-registry.js'

# the payload module lands after the Curator machine, so SRC and R are above it
SCRIPT_ANCHOR = '''  (function wireIntakeActions(){'''

PUSH_OLD = '''    QUEUE.push({ siloId:siloId, effectId:effectId });'''
PUSH_NEW = '''    /* Was: two fields, enough to paint a row. Now the whole item — see
       buildPayload. The rail still reads only siloId and effectId, so
       nothing about the row changes. */
    QUEUE.push(buildPayload(siloId, effectId));'''

QUEUE_WORD_OLD = '''then we&rsquo;ll start another queue,'''
QUEUE_WORD_NEW = '''then we&rsquo;ll begin the next ten,'''

EXPECT_FETCHES = 3
EXPECT_IDS     = 71
BANNED = ['sculpt', 'sculpted', 'sculpture', 'discount', 'in-situ', 'in situ',
          'render', 'queue']


def die(m):
    print('GATE FAIL: ' + m); sys.exit(1)


def inline_script(html):
    m = list(re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.S | re.I))
    if len(m) != 1: die('expected one inline script, found %d' % len(m))
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


def gate(before, after):
    a_js = inline_script(after)
    a_code = strip_comments(a_js)
    b_code = strip_comments(inline_script(before))

    if PUSH_OLD in a_js:           die('queue still pushes the two-field row')
    if a_js.count(PUSH_NEW) != 1:  die('push replacement not unique')
    if QUEUE_WORD_OLD in after:    die('cap modal still says "another queue"')

    nf = len(re.findall(r'\bfetch\s*\(', a_code))
    if nf != EXPECT_FETCHES:       die('fetch count %d, expected %d' % (nf, EXPECT_FETCHES))

    def decls(c): return set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', c))
    lost = decls(b_code) - decls(a_code)
    if lost:                       die('functions lost: %s' % sorted(lost))
    for need in ['buildPayload', 'payloadFor', 'stampPose', 'checkLocations']:
        if need not in decls(a_code): die('%s not declared' % need)

    ids = re.findall(r'\bid="([^"]+)"', markup(after))
    if len(ids) != EXPECT_IDS:     die('id count %d, expected %d' % (len(ids), EXPECT_IDS))
    if markup(before) != markup(after).replace(QUEUE_WORD_NEW, QUEUE_WORD_OLD):
        die('markup changed beyond the one banned word')
    if styles(before) != styles(after): die('style block changed')

    # TDZ — the counter must be declared above the function that increments it
    if a_code.index('var QUEUE_SEQ') > a_code.index('function buildPayload'):
        die('QUEUE_SEQ declared below buildPayload (TDZ) — ++undefined is NaN')
    mod_at = a_code.index('var MATERIAL_LOCATIONS')
    for name in ['R', 'QUEUE']:
        d = re.search(r'\bvar\s+' + name + r'\b', a_code)
        if not d or d.start() > mod_at: die('%s declared below the payload module' % name)

    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write(a_js); tmp = t.name
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    if r.returncode != 0:          die('node --check: ' + r.stderr.strip().splitlines()[0])
    st = styles(after)
    if st.count('{') != st.count('}'): die('style braces unbalanced')

    # Vocabulary, in what a customer can actually read. Three passes of
    # narrowing, each earned: HTML comments out (a comment said "Rendered
    # from EFFECT_REGISTRY"), attribute values out (id="queueFullModal" and
    # class="room--queue" are names, not copy), and the metrics readout out
    # (a dev panel whose row label literally reads "curator / workshop /
    # queue"). What is left is text nodes, which is what the rule is about.
    vis = markup(after)
    vis = re.sub(r'<!--.*?-->', '', vis, flags=re.S)
    vis = re.sub(r'<div class="readout">.*?</table>\s*</div>', '', vis, flags=re.S | re.I)
    vis = re.sub(r'<[^>]+>', ' ', vis).lower()
    for w in BANNED:
        if re.search(r'\b' + re.escape(w) + r'\w*', vis):
            hit = re.search(r'.{0,80}\b' + re.escape(w) + r'\w*.{0,40}', vis)
            die('banned vocabulary in customer-visible text: %r near ...%s...'
                % (w, hit.group(0).strip() if hit else ''))

    print('  gate: payload merged, 3 routes held, no functions lost, TDZ clear, "queue" gone')


BOOT = r'''
const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const reg  = fs.readFileSync(process.argv[3], 'utf8');
const errs = [];
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window, d = dom.window.document;
w.addEventListener('error', e => errs.push('window error: ' + e.message));
const fail = m => { console.log('FAIL ' + m); process.exit(1); };

const calls = [];
w.fetch = (url, opt) => {
  calls.push({ url, body: JSON.parse(opt.body) });
  const j = o => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(o) });
  if (url.includes('/analyze')) return j({ result: { quality_verdict: 'green', smallest_face_min_dim_px: 500 } });
  if (url.includes('/gate'))    return j({ status: 'ok' });
  return j({ ok: true, recommendations: [] });
};
w.Image = class { set src(v){ this.naturalWidth = 1200; this.naturalHeight = 1600;
  if (this.onload) setTimeout(() => this.onload(), 0); } };

try { w.eval(reg); } catch (e) { fail('registry: ' + e.message); }
const inline = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1];
try { w.eval(inline); } catch (e) { fail('boot threw: ' + e.message); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  if (!d.getElementById('tbcGoVerb').textContent.trim()) fail('rail button never labelled');
  if (d.querySelectorAll('#siloFloor .silo-card').length !== 8) fail('silo floor not 8');
  if (typeof w.__buildPayload !== 'function') fail('buildPayload not reachable');

  // a photograph, so the payload has a source
  const f = new w.File([new w.Uint8Array([1,2,3])], 'p.jpg', { type: 'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value: [f], configurable: true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(300);
  if (!w.__SRC.b64) fail('source never read');

  // queue one, through the floor, the way a customer does
  const room = [...d.querySelectorAll('#siloFloor .silo-card')]
    .find(c => w.EFFECT_REGISTRY.offerableBySilo(c.dataset.siloId).length);
  room.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(1200);
  const card = d.querySelector('#effectFloor .silo-card[data-effect-id]');
  card.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(60);

  if (d.querySelectorAll('#tbcList .tbc-row').length !== 1) fail('rail did not take the row');

  // the payload is real
  const p = w.__payloadFor(w.__QUEUE_PEEK()[0]);
  for (const k of ['source_image_b64','style_id','preset','location','scale',
                   'aspect_ratio','resolution','pose','advanced'])
    if (p[k] === undefined) fail('payload missing ' + k);
  if (!p.source_image_b64)     fail('payload carries no photograph');
  if (p.preset !== card.dataset.effectId) fail('preset is not the effect id');
  if (p.scale !== 'auto_85')   fail('scale not auto_85');
  if (p.aspect_ratio !== '1:1') fail('aspect not 1:1');
  if (p.style_id !== (card.dataset.siloId === 'artists_gallery' ? 'artists_gallery' : 'realistic'))
    fail('style_id not derived from the room');
  if (!p.location)             fail('no location');

  // a second add must not reuse the first id
  const card2 = d.querySelectorAll('#effectFloor .silo-card[data-effect-id]')[1];
  card2.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  const q = w.__QUEUE_PEEK();
  if (q.length !== 2) fail('second add did not land');
  if (q[0].id === q[1].id) fail('queue ids collide — QUEUE_SEQ hoisted without a value');
  if (!q[0].id || Number.isNaN(q[0].id)) fail('queue id is ' + q[0].id + ' — TDZ on QUEUE_SEQ');

  // pose is stamped onto every item, not read from a global at craft time
  w.__stampPose('smiling');
  if (q.some(it => it.pose !== 'smiling')) fail('pose not stamped across the queue');

  // removing still unticks — s73's fix must survive
  d.querySelector('#tbcList .tbc-row .tbc-x').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  if (w.__QUEUE_PEEK().length !== 1) fail('remove did not take');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  alive · payload built from two ids · ids unique · pose stamped · remove holds'
    + ' · ' + (w.__UNMAPPED.length ? w.__UNMAPPED.length + ' unmapped locations warned' : 'all locations mapped'));
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s75.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s75.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    MOD = sys.argv[3] if len(sys.argv) > 3 else MOD_DEFAULT
    REG = sys.argv[4] if len(sys.argv) > 4 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    module = open(MOD, encoding='utf-8').read()

    for name, a in [('script', SCRIPT_ANCHOR), ('push', PUSH_OLD), ('capword', QUEUE_WORD_OLD)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (name, before.count(a)))

    # the queue must be inspectable for the gate to prove the payload
    peek = ('\n  window.__QUEUE_PEEK = function(){ return QUEUE; };\n')

    after = before.replace(SCRIPT_ANCHOR, module + peek + SCRIPT_ANCHOR)
    after = after.replace(PUSH_OLD, PUSH_NEW)
    after = after.replace(QUEUE_WORD_OLD, QUEUE_WORD_NEW)

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
