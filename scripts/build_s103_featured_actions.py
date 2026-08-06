# -*- coding: utf-8 -*-
"""
build_s103_featured_actions.py  ·  2026-08-03  ·  CUI V25

Download and Send to Print Shop on the featured piece did nothing.

    Both handlers referenced `feat`. There is no such variable. FEAT is an
    id string, and the piece object in that scope is `keep || first`. So
    both threw a ReferenceError on the first line and the click died there —
    silently, because a listener that throws does not report anywhere the
    customer or the log will see.

    My fault twice over: introduced in s100 with the real download, repeated
    in s101 when the Print Shop button was wired to the same wrong name.

THE FIX
    The featured piece is resolved by id at click time rather than closed
    over. FEAT can change between render and click — a piece landing behind
    the panel moves it — and a stale closure would have saved the wrong file.

THE GATE
    Every identifier a listener in the collection block reads must be
    declared somewhere in the file. The boot harness never caught this
    because nothing clicks that button; the jsdom drive now does.

Run from the repo root:  python scripts\\build_s103_featured_actions.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s102.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s103.html')

EXPECTED_ROUTES = 15


def die(msg):
    print('GATE FAILED · ' + msg)
    sys.exit(1)


def rep(text, old, new, label):
    n = text.count(old)
    if n != 1:
        die('anchor "%s" appears %d times, expected 1' % (label, n))
    return text.replace(old, new)


with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

doc = src

doc = rep(
    doc,
    "      var d1 = wrap.querySelector('#mcDl1'), p1 = wrap.querySelector('#mcPr1');\r\n"
    "      if (d1) d1.addEventListener('click', function(){\r\n"
    "        flash(d1, 'Saving \\u2713', 'Download');\r\n"
    "        downloadPiece(feat);\r\n"
    "      });\r\n"
    "      if (p1) p1.addEventListener('click', function(){\r\n"
    "        if (printable(feat)){ PS_PIECE = feat; PS_OPT = 0; }\r\n"
    "        psView('wall');\r\n"
    "        showPrintShop();\r\n"
    "      });",

    "      var d1 = wrap.querySelector('#mcDl1'), p1 = wrap.querySelector('#mcPr1');\r\n"
    "      /* Resolved at click, never closed over. FEAT moves when a piece\r\n"
    "         lands behind the panel, and a captured one would have saved the\r\n"
    "         piece that used to be featured. */\r\n"
    "      function featuredPiece(){\r\n"
    "        var found = null;\r\n"
    "        PIECES.forEach(function(p){ if (p.id === FEAT) found = p; });\r\n"
    "        return found;\r\n"
    "      }\r\n"
    "      if (d1) d1.addEventListener('click', function(){\r\n"
    "        var one = featuredPiece();\r\n"
    "        if (!one || !one.art) return;\r\n"
    "        flash(d1, 'Saving \\u2713', 'Download');\r\n"
    "        downloadPiece(one);\r\n"
    "      });\r\n"
    "      if (p1) p1.addEventListener('click', function(){\r\n"
    "        var one = featuredPiece();\r\n"
    "        if (one && printable(one)){ PS_PIECE = one; PS_OPT = 0; }\r\n"
    "        psView('wall');\r\n"
    "        showPrintShop();\r\n"
    "      });",
    'featured handlers',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

# the name that never existed must be gone from every call
for bad in ('downloadPiece(feat)', 'printable(feat)', 'PS_PIECE = feat'):
    if bad in doc:
        die('%s survived' % bad)
# `.mc-feat` in the stylesheet is not this variable — the lookbehind keeps
# a class name from tripping the check.
probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)
m = re.search(r'(?<![\w.\-])feat(?![\w\-])', probe)
if m:
    die('a bare `feat` is still read: ...%s...'
        % probe[max(0, m.start() - 50):m.start() + 50].strip())

if doc.count('function featuredPiece(') != 1:
    die('featuredPiece is not declared exactly once')
if doc.count('featuredPiece()') != 3:
    die('featuredPiece is not called by both handlers')

# a download with nothing behind it must not report success
if 'if (!one || !one.art) return;' not in doc:
    die('the download can still flash over nothing')

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

print('GATE PASSED · the featured piece resolves at click · %d routes' % routes)
print('wrote ' + OUT)
