# -*- coding: utf-8 -*-
"""
build_s110_refresh_previews.py  ·  2026-08-03  ·  CUI V25

Re-inlines public/previews/effects-manifest.json into the stage.

WHY THIS EXISTS AS ITS OWN BUILD
    The manifest is inlined rather than fetched — the first paint of a room
    must not wait on a request, and the route count is a gate. The cost of
    that is a step: re-running the emitter updates the json on disk and
    nothing else. The page keeps whatever was inlined the day it was built.

    CENG renamed every preview on 2026-08-03 — untagged `1.jpg` is gone and
    each effect now carries `1_man.jpg` and `2_woman.jpg`. Without this,
    every card in the catalogue 404s.

    So: art changes → emitter → this. Two commands, in that order.

WHAT IT ASSERTS
    That the new manifest is not smaller than the one it replaces, and that
    no effect loses a plate it had. A manifest written from a half-synced
    folder would otherwise blank the catalogue quietly.

Run from the repo root:
    node scripts\\emit-preview-manifest.js
    python scripts\\build_s110_refresh_previews.py
"""

import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s109.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s110.html')
MANIFEST = os.path.join(ROOT, 'public', 'previews', 'effects-manifest.json')

EXPECTED_ROUTES = 15


def die(msg):
    print('GATE FAILED · ' + msg)
    sys.exit(1)


if not os.path.exists(MANIFEST):
    die('effects-manifest.json not found — run node scripts\\emit-preview-manifest.js first')

with open(MANIFEST, encoding='utf-8') as f:
    man = json.load(f)

fx = man.get('effects') or {}
if len(fx) < 40:
    die('the manifest holds only %d effects — refusing to blank the catalogue' % len(fx))

with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

# ── what is inlined today, so nothing is lost silently ──────────────────────
m = re.search(r'window\.EFFECT_PREVIEWS = \{.*?\n\};', src, re.S)
if not m:
    die('no inlined manifest found in the stage')

before = {}
for em in re.finditer(r'"([a-z0-9_]+)": \[([^\]]*)\]', m.group(0)):
    files = [x.strip().strip('"') for x in em.group(2).split(',')]
    before[em.group(1)] = [x for x in files if x]

# ── the new one ─────────────────────────────────────────────────────────────
compact = {}
for eid, rec in sorted(fx.items()):
    compact[eid] = [rec.get('man') or '', rec.get('woman') or '', rec.get('neutral') or '']

lines = ['window.EFFECT_PREVIEWS = {']
lines.append("  base: " + json.dumps(man.get('base') or '/previews/effects/') + ",")
lines.append("  generatedAt: " + json.dumps(man.get('generatedAt') or '') + ",")
lines.append("  /* id: [man, woman, neutral] — empty string where there is none */")
lines.append("  files: {")
keys = list(compact.keys())
for n, eid in enumerate(keys):
    a, b, c = compact[eid]
    lines.append("    %s: [%s, %s, %s]%s" % (
        json.dumps(eid), json.dumps(a), json.dumps(b), json.dumps(c),
        ',' if n < len(keys) - 1 else ''))
lines.append("  }")
lines.append('};')
INLINE = '\r\n'.join(lines)

doc = src[:m.start()] + INLINE + src[m.end():]

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    print('The manifest on disk is already the one in the stage. Nothing to do.')
    sys.exit(0)

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

# nothing may quietly shrink
if len(compact) < len(before):
    die('the manifest lost effects, %d -> %d' % (len(before), len(compact)))

lost = []
for eid, files in before.items():
    if eid not in compact:
        lost.append(eid + ' (gone)')
        continue
    had = len([x for x in files if x])
    now = len([x for x in compact[eid] if x])
    if now < had:
        lost.append('%s (%d -> %d plates)' % (eid, had, now))
if lost:
    die('plates lost:\n  ' + '\n  '.join(lost))

# every effect must have something to draw
blank = [e for e, v in compact.items() if not any(v)]
if blank:
    die('no plate at all for: ' + ', '.join(blank))

if doc.count('window.EFFECT_PREVIEWS = {') != 1:
    die('the manifest is inlined more than once')

if len(re.findall(r'data-s="[0-9]"', doc)) != 8:
    die('intake states are not 8')
for st in re.findall(r'<style[^>]*>(.*?)</style>', doc, re.S):
    if st.count('{') != st.count('}'):
        die('style block brace imbalance')

blocks = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', doc, re.S)
for n, blk in enumerate(blocks):
    fd, path = tempfile.mkstemp(suffix='.js')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(blk)
    r = subprocess.run(['node', '--check', path], capture_output=True, text=True)
    os.unlink(path)
    if r.returncode != 0:
        die('node --check failed on script block %d\n%s' % (n, r.stderr))

boot = None
for name in ('boot.js', 'boot-test.js', 'boot_gate.js', 'boot_check.js'):
    p = os.path.join(ROOT, 'scripts', name)
    if os.path.exists(p):
        boot = p
        break
if boot is None:
    die('boot harness not found in scripts\\ — tell CUI its filename')

with open(OUT, 'w', encoding='utf-8', newline='') as f:
    f.write(doc)

r = subprocess.run(['node', boot, OUT], capture_output=True, text=True)
if r.returncode != 0:
    os.unlink(OUT)
    die('boot harness rejected the output\n%s%s' % (r.stdout, r.stderr))

both = sum(1 for v in compact.values() if v[0] and v[1])
man_only = sum(1 for v in compact.values() if v[0] and not v[1])
woman_only = sum(1 for v in compact.values() if v[1] and not v[0])

print('GATE PASSED · %d effects · %d with both faces' % (len(compact), both))
if man_only:
    print('   %d man only: %s' % (man_only,
          ', '.join(e for e, v in compact.items() if v[0] and not v[1])))
if woman_only:
    print('   %d woman only: %s' % (woman_only,
          ', '.join(e for e, v in compact.items() if v[1] and not v[0])))
print('wrote ' + OUT)
