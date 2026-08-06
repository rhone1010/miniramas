# -*- coding: utf-8 -*-
"""
build_s124_lighter_fields.py  ·  2026-08-04  ·  CUI V25

The address fields and the shipping choices are too dark.

    They were dressed at 5% white on a #1b1512 panel, which is barely a
    field at all — the boxes read as slightly-less-dark rectangles and the
    placeholder text sits at the edge of legible. Rich: lighter, but not
    warm paper.

    Raised to a neutral lift off the panel — light enough to read as
    something you type into, dark enough that the panel is still the panel.
    The chosen shipping method keeps the brass border so the selection is
    still the loudest thing in the group.

Run from the repo root:  python scripts\\build_s124_lighter_fields.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-04-s123.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-04-s124.html')

EXPECTED_ROUTES = 17


def die(msg):
    print('GATE FAILED · ' + msg)
    sys.exit(1)


def rep(text, old, new, label):
    lf = (old.replace('\r\n', '\n'), new.replace('\r\n', '\n'))
    crlf = (lf[0].replace('\n', '\r\n'), lf[1].replace('\n', '\r\n'))
    for a, b in ((old, new), lf, crlf):
        if text.count(a) == 1:
            return text.replace(a, b)
    die('anchor "%s" appears %d times, expected 1' % (label, text.count(old)))


with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

doc = src

doc = rep(
    doc,
    "/* The address lives in the coffee panel now, not on vellum. */\n"
    ".pshop .ps-addr input,.pshop .ps-addr select{\n"
    "  background:rgba(255,255,255,.05); color:var(--vellum-100);\n"
    "  border-color:rgba(196,169,110,.22);\n"
    "}\n"
    ".pshop .ps-addr input::placeholder{ color:rgba(243,237,225,.34) }\n"
    ".pshop .ps-addr input:focus,.pshop .ps-addr select:focus{ outline:1px solid var(--gold) }\n",

    "/* The address lives in the coffee panel, and at 5% white it was barely a\n"
    "   field — the boxes read as slightly-less-dark rectangles and the\n"
    "   placeholders sat at the edge of legible.\n"
    "\n"
    "   Ruled 2026-08-04: lighter, but not warm paper. A neutral lift off the\n"
    "   panel, enough to read as something you type into. */\n"
    ".pshop .ps-addr input,.pshop .ps-addr select{\n"
    "  background:#3a332c; color:#f6f1e8;\n"
    "  border-color:rgba(196,169,110,.3);\n"
    "}\n"
    ".pshop .ps-addr input::placeholder{ color:rgba(246,241,232,.5) }\n"
    ".pshop .ps-addr input:hover,.pshop .ps-addr select:hover{ background:#413a32 }\n"
    ".pshop .ps-addr input:focus,.pshop .ps-addr select:focus{\n"
    "  background:#453e35; border-color:#b88e57; outline:1px solid #b88e57;\n"
    "}\n",
    'address fields',
)

doc = rep(
    doc,
    ".pshop .ps-ship-opt{\n"
    "  background:rgba(255,255,255,.035); border-color:rgba(196,169,110,.18);\n"
    "  color:rgba(243,237,225,.86);\n"
    "}\n"
    ".pshop .ps-ship-opt:hover{ border-color:rgba(196,169,110,.5) }\n"
    ".pshop .ps-ship-opt.is-on{ border-color:var(--gold); background:rgba(196,169,110,.14); color:#fff }\n"
    ".pshop .ps-ship-opt .car{ color:var(--taupe) }\n",

    "/* Same ground as the fields above them — they are the same kind of\n"
    "   choice and were reading as two different surfaces. */\n"
    ".pshop .ps-ship-opt{\n"
    "  background:#3a332c; border-color:rgba(196,169,110,.26);\n"
    "  color:#f6f1e8;\n"
    "}\n"
    ".pshop .ps-ship-opt:hover{ background:#413a32; border-color:rgba(196,169,110,.5) }\n"
    "/* Brass, so the chosen one is still the loudest thing in the group. */\n"
    ".pshop .ps-ship-opt.is-on{\n"
    "  border-color:#b88e57; background:#4a4036; color:#fff;\n"
    "  box-shadow:inset 0 0 0 1px rgba(184,142,87,.4);\n"
    "}\n"
    ".pshop .ps-ship-opt .car{ color:rgba(246,241,232,.58) }\n"
    ".pshop .ps-ship-opt .pr{ color:#f6f1e8 }\n",
    'shipping options',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

# the near-invisible grounds are gone
if 'background:rgba(255,255,255,.05); color:var(--vellum-100);' in doc:
    die('the address fields are still 5% white')
if 'background:rgba(255,255,255,.035); border-color:rgba(196,169,110,.18);' in doc:
    die('the shipping options are still 3.5% white')

# fields and choices share a ground
if doc.count('background:#3a332c;') != 2:
    die('the fields and the shipping choices are not the same ground')

# the chosen method is still the loudest thing
if 'border-color:#b88e57; background:#4a4036; color:#fff;' not in doc:
    die('the chosen shipping method has no emphasis')

# focus is visible
if 'background:#453e35; border-color:#b88e57; outline:1px solid #b88e57;' not in doc:
    die('a focused field is not distinguishable')

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

print('GATE PASSED · fields and shipping lifted off the panel · %d routes' % routes)
print('wrote ' + OUT)
