#!/usr/bin/env python3
"""
build_s73_removefromqueue.py  —  CUI V24, 2026-07-31

IN   public/litenco-stage-2026-07-30-s72.html      (accepted, committed)
OUT  public/litenco-stage-2026-07-31-s73.html      (written only if the gate passes)

WHAT CHANGES
  One line in removeFromQueue(). Two faults on it:

    if (card && card.dataset.silo === silo) card.classList.remove('is-selected');

  1. `silo` is not bound in that scope. The only binding is a var inside
     openSilo(). Removing a queued effect while its card is on the floor threw
     ReferenceError, after the row had already gone from QUEUE — so the rail
     and the floor disagreed from that point on and nothing said so.
  2. `card.dataset.silo` is undefined regardless. effectCard() writes
     data-effect-id and data-silo-id, so the property is dataset.siloId.

  Both are fixed by reading the arguments the function already receives.

NOTHING ELSE CHANGES. No markup, no CSS, no other script line.

GATE  see gate() — cumulative set, plus one new driven interaction.
"""

import os, re, sys, json, subprocess, tempfile

SRC = 'public/litenco-stage-2026-07-30-s72.html'
DST = 'public/litenco-stage-2026-07-31-s73.html'

OLD = "    if (card && card.dataset.silo === silo) card.classList.remove('is-selected');"
NEW = "    if (card && card.dataset.siloId === siloId) card.classList.remove('is-selected');"

# ---- expectations carried forward from s72 -------------------------------
EXPECT_FETCHES   = 0      # the stage still talks to nothing. Build 1 raises this.
EXPECT_FN_DECLS  = 51
EXPECT_IDS       = 70
BANNED = ['sculpt', 'sculpted', 'sculpture', 'discount', ' off ', 'in-situ', 'in situ']


def die(msg):
    print('GATE FAIL: ' + msg)
    sys.exit(1)


def script_block(html):
    m = list(re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.S | re.I))
    if len(m) != 1:
        die('expected exactly one inline script block, found %d' % len(m))
    return m[0].group(1)


def style_block(html):
    return ''.join(m.group(1) for m in re.finditer(r'<style[^>]*>(.*?)</style>', html, re.S | re.I))


def markup_only(html):
    h = re.sub(r'<script[^>]*>.*?</script>', '<script></script>', html, flags=re.S | re.I)
    return re.sub(r'<style[^>]*>.*?</style>', '<style></style>', h, flags=re.S | re.I)


def strip_comments(js):
    """Comments are removed before any code assertion. Two earlier gates fired on
    the comment that explained their own fix."""
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
    b_js, a_js = script_block(before), script_block(after)
    a_code = strip_comments(a_js)

    # 1 · the change landed, and only it
    if OLD in a_js:                     die('old line still present')
    if NEW not in a_js:                 die('new line not present')
    if a_js.count(NEW) != 1:            die('new line appears %d times' % a_js.count(NEW))
    if markup_only(before) != markup_only(after):
        die('markup changed; this build declares no markup change')
    if style_block(before) != style_block(after):
        die('style block changed; this build declares no style change')
    if len(a_js.splitlines()) != len(b_js.splitlines()):
        die('script line count moved')

    # 2 · the free identifier is gone from that function
    fn = re.search(r'function removeFromQueue\(siloId, effectId\)\{(.*?)\n  \}', a_code, re.S)
    if not fn:                          die('removeFromQueue not found after edit')
    if re.search(r'[^.\w]silo\b(?!Id)', fn.group(1)):
        die('a free `silo` still remains inside removeFromQueue')

    # 3 · counts not lost
    nf = len(re.findall(r'\bfetch\s*\(', a_code))
    if nf != EXPECT_FETCHES:            die('fetch count %d, expected %d' % (nf, EXPECT_FETCHES))
    nd = len(re.findall(r'\bfunction\s+[A-Za-z_$][\w$]*\s*\(', a_code))
    if nd != EXPECT_FN_DECLS:           die('function declarations %d, expected %d' % (nd, EXPECT_FN_DECLS))
    ids = re.findall(r'\bid="([^"]+)"', markup_only(after))
    if len(ids) != EXPECT_IDS:          die('id count %d, expected %d' % (len(ids), EXPECT_IDS))
    if len(set(ids)) != len(ids):       die('duplicate ids: %s' % [i for i in ids if ids.count(i) > 1])

    # 4 · syntax and balance
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write(a_js); tmp = t.name
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    if r.returncode != 0:               die('node --check: ' + r.stderr.strip().splitlines()[0])
    st = style_block(after)
    if st.count('{') != st.count('}'):  die('style block braces unbalanced')

    # 5 · vocabulary
    low = markup_only(after).lower()
    for w in BANNED:
        if w in low:                    die('banned vocabulary in markup: %r' % w)

    print('  gate: change isolated, counts held, syntax clean, vocabulary clean')


def boot(path):
    """Alive, not merely quiet — then drive the interaction this build fixes."""
    harness = r'''
const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const reg  = fs.readFileSync(process.argv[3], 'utf8');
const errs = [];
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
w.addEventListener('error', e => errs.push('window error: ' + e.message));
w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }));
try { w.eval(reg); } catch (e) { console.log('FAIL registry: ' + e.message); process.exit(1); }
const inline = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1];
try { w.eval(inline); } catch (e) { console.log('FAIL boot threw: ' + e.message); process.exit(1); }
const d = w.document;
const fail = m => { console.log('FAIL ' + m); process.exit(1); };

// --- ALIVE, not silent
const verb = d.getElementById('tbcGoVerb');
if (!verb || !verb.textContent.trim()) fail('rail button never labelled — init did not complete');
const silos = d.querySelectorAll('#siloFloor .silo-card');
if (silos.length !== 8) fail('silo floor rendered ' + silos.length + ' cards, expected 8');
if (!Array.isArray(w.POSES) || !w.POSES.length) fail('window.POSES unreachable');
if (typeof w.__openIntake !== 'function') fail('__openIntake missing');

// --- DRIVE the path this build fixes: open a room, queue an effect, remove it
// turn() flips the floor on a timer (FLIP 420 / STEP 38), so the drive is async.
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const room = [...silos].find(c => w.EFFECT_REGISTRY.offerableBySilo(c.dataset.siloId).length);
  if (!room) fail('no silo has a live effect — cannot drive the path');
  room.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(1200);

  const card = d.querySelector('#effectFloor .silo-card[data-effect-id]');
  if (!card) fail('effect floor empty after opening a room');
  card.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(60);

  const rows = d.querySelectorAll('#tbcList .tbc-row');
  if (rows.length !== 1) fail('queue holds ' + rows.length + ' rows after one add, expected 1');
  if (!card.classList.contains('is-selected')) fail('card not ticked after add');

  const x = rows[0].querySelector('.tbc-x');
  try { x.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); }
  catch (e) { fail('remove threw: ' + e.message); }
  await sleep(60);

  if (errs.length) fail(errs.join(' | '));
  if (d.querySelectorAll('#tbcList .tbc-row').length !== 0) fail('row survived removal');
  if (card.classList.contains('is-selected')) fail('card still ticked after removal — the untick never ran');
  if (d.getElementById('tbcN').textContent !== '') fail('rail count not cleared');

  console.log('OK  boot alive · 8 silos · add ticked · remove unticked, no throw');
  process.exit(0);
})();
'''
    # written into the repo root, not /tmp — node resolves node_modules upward
    # from the harness, and jsdom lives in the repo.
    h = '.boot_gate_s73.js'
    open(h, 'w', encoding='utf-8').write(harness)
    r = subprocess.run(['node', h, path, REGISTRY], capture_output=True, text=True)
    os.unlink(h)
    print('  ' + (r.stdout.strip() or r.stderr.strip()))
    if r.returncode != 0 or 'FAIL' in r.stdout:
        die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC
    DST = sys.argv[2] if len(sys.argv) > 2 else DST
    REGISTRY = sys.argv[3] if len(sys.argv) > 3 else 'public/effect-registry.js'

    before = open(SRC, encoding='utf-8').read()
    if before.count(OLD) != 1:
        die('anchor appears %d times in %s — expected exactly 1' % (before.count(OLD), SRC))
    after = before.replace(OLD, NEW)

    gate(before, after)

    tmp_out = DST + '.candidate'
    open(tmp_out, 'w', encoding='utf-8', newline='').write(after)
    boot(tmp_out)
    os.replace(tmp_out, DST)
    print('  written: %s' % DST)
