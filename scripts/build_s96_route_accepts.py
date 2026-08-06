# -*- coding: utf-8 -*-
"""
build_s96_route_accepts.py  ·  2026-08-02  ·  CUI V25

The s78 re-run. CENG reconciled the registry and PRESET_LABELS on 2026-08-02
at 22:50 — 63 effects, 51 of them live, and every live id now present in
PRESET_LABELS. The guard baked into s78 held seventeen ids and was shutting
rooms that have been craftable for hours.

  ROUTE_ACCEPTS  17 -> 63, read out of lib/v1/portraits/portraits-shared.ts
                 the day this ran.

Nothing else changes. The floor still offers body === 'live' only, so the
twelve todo effects stay out of sight; the guard's job is to catch the case
where the registry says finished and the route says 400.

NOT ADDRESSED HERE — Another Age now carries 14 effects, 12 of them live,
against a CAP of 7. Until the men/women toggle lands that room shows the
first seven of twelve. Toggle is the next build and needs one ruling: which
side it opens on.

Run from the repo root:  python scripts\\build_s96_route_accepts.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-02-s95.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-02-s96.html')
SHARED = os.path.join(ROOT, 'lib', 'v1', 'portraits', 'portraits-shared.ts')

EXPECTED_ROUTES = 10


def die(msg):
    print('GATE FAILED · ' + msg)
    sys.exit(1)


# ── read the route's own truth, today, not a copy of it ─────────────────────
if not os.path.exists(SHARED):
    die('portraits-shared.ts not found at ' + SHARED)

with open(SHARED, encoding='utf-8') as f:
    ts = f.read()

i = ts.find('export const PRESET_LABELS')
if i < 0:
    die('PRESET_LABELS not found in portraits-shared.ts')
b = ts.find('{', i)
depth = 0
end = -1
for k in range(b, len(ts)):
    if ts[k] == '{':
        depth += 1
    elif ts[k] == '}':
        depth -= 1
        if depth == 0:
            end = k
            break
if end < 0:
    die('PRESET_LABELS block is unbalanced')

ACCEPTS = re.findall(r'^\s*([A-Za-z0-9_]+)\s*:', ts[b:end], re.M)
if len(ACCEPTS) < 40:
    die('only %d ids read from PRESET_LABELS — refusing to shrink the floor' % len(ACCEPTS))

lines = []
cur = '  var ROUTE_ACCEPTS = ['
for n, x in enumerate(ACCEPTS):
    frag = "'" + x + "'" + (', ' if n < len(ACCEPTS) - 1 else '];')
    if len(cur) + len(frag) > 96:
        lines.append(cur)
        cur = '    '
    cur += frag
lines.append(cur)
literal = '\r\n'.join(lines)

# ── apply ───────────────────────────────────────────────────────────────────
with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

m = re.search(r'^  var ROUTE_ACCEPTS = \[.*?\];', src, re.M | re.S)
if not m:
    die('ROUTE_ACCEPTS not found in the stage')

old_ids = re.findall(r"'([a-z0-9_]+)'", m.group(0))
doc = src[:m.start()] + literal + src[m.end():]

# ── gate ────────────────────────────────────────────────────────────────────
if doc == src:
    die('nothing changed')

if len(ACCEPTS) < len(old_ids):
    die('the accepted list shrank, %d -> %d' % (len(old_ids), len(ACCEPTS)))

# An id may leave PRESET_LABELS — CENG retired four this session. That is
# only safe if the registry has retired it too. An id the floor still calls
# live while the route refuses it is the exact failure this guard exists for.
REG = os.path.join(ROOT, 'public', 'effect-registry.js')
if not os.path.exists(REG):
    die('effect-registry.js not found at ' + REG)
with open(REG, encoding='utf-8') as f:
    reg = f.read()
live_ids = set()
for blk in re.findall(r'\{[^{}]*"id"\s*:\s*"([a-z0-9_]+)"[^{}]*\}', reg):
    pass
for chunk in re.findall(r'\{[^{}]+\}', reg):
    mid = re.search(r'"id"\s*:\s*"([a-z0-9_]+)"', chunk)
    mbody = re.search(r'"body"\s*:\s*"([a-z]+)"', chunk)
    if mid and mbody and mbody.group(1) == 'live':
        live_ids.add(mid.group(1))
if not live_ids:
    die('read no live effects out of effect-registry.js')

dropped = [x for x in old_ids if x not in ACCEPTS]
for lost in dropped:
    if lost in live_ids:
        die('%s is live in the registry and no longer accepted by the route' % lost)

orphans = sorted(live_ids - set(ACCEPTS))
if orphans:
    die('live in the registry, refused by the route: ' + ', '.join(orphans))

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

if len(re.findall(r'data-s="[0-9]"', doc)) != 8:
    die('intake states are not 8')
for st in re.findall(r'<style[^>]*>(.*?)</style>', doc, re.S):
    if st.count('{') != st.count('}'):
        die('style block brace imbalance')

blocks = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', doc, re.S)
if not blocks:
    die('no script blocks found')
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

print('GATE PASSED · ROUTE_ACCEPTS %d -> %d · %d live · dropped %s · %d routes'
      % (len(old_ids), len(ACCEPTS), len(live_ids),
         (', '.join(dropped) or 'none'), routes))
print('wrote ' + OUT)
