# -*- coding: utf-8 -*-
"""
build_s118_finish_images.py  ·  2026-08-04  ·  CUI V25

A photograph of the finish, under the family row.

    "Framed Canvas, from $79" asks a customer to imagine something. These are
    corner shots — the wrap on a stretched canvas, the mount between the
    moulding and the picture — which is exactly the part nobody can picture
    and the part that justifies the price.

    One image, changing with the family. Not a swatch grid: the decision is
    which finish, and six photographs at once is a second decision nobody
    asked for.

READ FROM DISK AT BUILD TIME
    public/previews/finishes/<family>.jpg, whatever is actually there. A
    family with no photograph shows none — no broken frame, no 404, no
    placeholder pretending to be a product. `framed` has no shot today
    because every framed export has a mount, which makes it the matted
    product; drop a file in and re-run and it appears.

    Same rule as everywhere else in this file: nothing builds a path from an
    id and hopes.

Run from the repo root:
    node scripts\\name-finish-images.js
    python scripts\\build_s118_finish_images.py
"""

import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-04-s117.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-04-s118.html')
FIN = os.path.join(ROOT, 'public', 'previews', 'finishes')

EXPECTED_ROUTES = 17
IMG = re.compile(r'\.(jpe?g|png|webp)$', re.I)


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


# ── what is actually on disk ────────────────────────────────────────────────
if not os.path.isdir(FIN):
    die('public/previews/finishes/ does not exist — run node scripts\\name-finish-images.js')

found = {}
for f in sorted(os.listdir(FIN)):
    if not IMG.search(f):
        continue
    found[IMG.sub('', f)] = f

if not found:
    die('no finish photographs in public/previews/finishes/')

FINISH_JS = 'window.FINISH_ART = ' + json.dumps(
    {'base': '/previews/finishes/', 'files': found}, indent=2) + ';'

# ── apply ───────────────────────────────────────────────────────────────────
with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

doc = src

# 1 · the map, beside the preview manifest
doc = rep(
    doc,
    "window.EFFECT_PREVIEWS = {",
    "/* GENERATED — the finish photographs actually on disk, read at build\n"
    "   time by scripts/build_s118_finish_images.py. A family absent from\n"
    "   `files` shows no photograph, which is the honest state until one is\n"
    "   shot. Nothing builds a path from a family name and hopes. */\n"
    + FINISH_JS + "\n\n"
    "window.EFFECT_PREVIEWS = {",
    'finish map',
)

# 2 · CSS
doc = rep(
    doc,
    ".ps-fams{ display:grid; grid-template-columns:repeat(auto-fit,minmax(112px,1fr)); gap:.45em }\n",

    "/* the finish, photographed. Sits under the family row and changes with\n"
    "   it — the corner detail is the part a customer cannot imagine and the\n"
    "   part that earns the price difference. */\n"
    ".ps-finish{\n"
    "  margin:.7em 0 .2em; border-radius:8px; overflow:hidden;\n"
    "  border:1px solid rgba(137,105,67,.22);\n"
    "  background:rgba(255,255,255,.4);\n"
    "}\n"
    ".ps-finish:empty{ display:none }\n"
    ".ps-finish img{\n"
    "  display:block; width:100%; aspect-ratio:16/9; object-fit:cover;\n"
    "  object-position:center 40%;\n"
    "}\n"
    ".ps-finish figcaption{\n"
    "  padding:.5em .8em; font-family:var(--sans); font-size:.74rem;\n"
    "  color:var(--ink-soft); line-height:1.4;\n"
    "}\n"
    ".ps-fams{ display:grid; grid-template-columns:repeat(auto-fit,minmax(112px,1fr)); gap:.45em }\n",
    'finish css',
)

# 3 · in the flyout, under the families
doc = rep(
    doc,
    "      '<div class=\"ps-step\"><b>2</b> Select size</div>' +\r\n",
    "      finishArt(fam) +\r\n"
    "      '<div class=\"ps-step\"><b>2</b> Select size</div>' +\r\n",
    'finish in flyout',
)

doc = rep(
    doc,
    "  function fromPrice(fam){\r\n",
    "  /* The photograph for a family, or nothing. Not a placeholder — an\r\n"
    "     empty frame reads as a broken product, and a stand-in photograph\r\n"
    "     reads as a lie about what arrives. */\r\n"
    "  function finishArt(fam){\r\n"
    "    var FA = window.FINISH_ART;\r\n"
    "    if (!FA || !FA.files || !fam) return '';\r\n"
    "    var file = FA.files[fam.id];\r\n"
    "    if (!file) return '';\r\n"
    "    return '<figure class=\"ps-finish\">' +\r\n"
    "      '<img src=\"' + esc(FA.base + file) + '\" alt=\"\" loading=\"lazy\">' +\r\n"
    "      (fam.note ? '<figcaption>' + esc(fam.note) + '</figcaption>' : '') +\r\n"
    "      '</figure>';\r\n"
    "  }\r\n"
    "\r\n"
    "  function fromPrice(fam){\r\n",
    'finishArt',
)

# 4 · the note moves out of the header — it is the caption now
doc = rep(
    doc,
    "        '<div><h3>' + esc(PS_PIECE.name || 'Crafted Image') + '</h3>' +\r\n"
    "        (fam.note ? '<p>' + esc(fam.note) + '</p>' : '') + '</div>' +\r\n",
    "        /* The family's note is the photograph's caption now. Saying it\r\n"
    "           twice on one panel is saying it once, badly. */\r\n"
    "        '<div><h3>' + esc(PS_PIECE.name || 'Crafted Image') + '</h3></div>' +\r\n",
    'note moves',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# only what exists reaches the page
if 'window.FINISH_ART = ' not in doc:
    die('the finish map was not inlined')
for fam, file in found.items():
    if json.dumps(file) not in doc:
        die('%s did not reach the map' % fam)
if re.search(r"'/previews/finishes/'\s*\+", probe):
    die('a finish path is being built from a name rather than read')

# a family with no photograph shows none
if "if (!file) return '';" not in doc:
    die('a missing photograph is not handled')
if '.ps-finish:empty{ display:none }' not in doc:
    die('an empty figure would still draw a frame')

# one writer, called once
if doc.count('function finishArt(') != 1:
    die('finishArt is not declared exactly once')
# Declared once, called once from renderFly. The declaration line itself
# contains the name, so the raw count is two.
if doc.count('      finishArt(fam) +') != 1:
    die('finishArt is not called exactly once from the flyout')

# the note is not said twice
if "(fam.note ? '<p>' + esc(fam.note) + '</p>' : '')" in doc:
    die('the family note is still printed in the header as well')

for sel in ('.ps-finish{', '.ps-finish img{', '.ps-finish figcaption{'):
    if sel not in doc:
        die('no rule for %s' % sel)

# declared above its reader
if probe.index('window.FINISH_ART = ') > probe.index('function finishArt('):
    die('the map is declared below its reader')

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

print('GATE PASSED · %d finish photographs · %d routes' % (len(found), routes))
for k in sorted(found):
    print('   %-14s %s' % (k, found[k]))
missing = [f for f in ('fine_art', 'premium', 'canvas', 'framed_canvas', 'framed', 'matted')
           if f not in found]
if missing:
    print('   no photograph, shows none: ' + ', '.join(missing))
print('wrote ' + OUT)
