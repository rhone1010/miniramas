# -*- coding: utf-8 -*-
"""
build_s111_no_missing_art.py  ·  2026-08-03  ·  CUI V25

Five 404s on every render of My Collection:

    /previews/onward/print-1.jpg  print-2  print-3  print-4
    /previews/onward/wallpaper.jpg

The two promotional cards were written against marketing art that was ruled
marketing's on 2026-07-31 and has never been made. Each img carried an
onerror that hid it, so nothing looked broken — but the browser still asked
for all five, every time, and the strip left four empty frames where
photographs should be.

THE FIX
    A single switch. OW_ART is false and the strips are not drawn at all,
    so nothing is requested and no empty frames appear. Flip it to true the
    day the five files land and both cards come back with no other edit.

    Not an onerror. An onerror hides the damage after the request has been
    made; this does not make the request.

WHAT THE CARDS LOOK LIKE MEANWHILE
    Title, the line CENG wrote, and the button. Which is a complete card —
    the strip was never carrying the meaning.

    The Curator Recommends is untouched. Its thumbnails are silo art that
    exists on disk.

Run from the repo root:  python scripts\\build_s111_no_missing_art.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s110.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s111.html')

EXPECTED_ROUTES = 15


def die(msg):
    print('GATE FAILED · ' + msg)
    sys.exit(1)


def rep(text, old, new, label):
    for a, b in ((old, new), (old.replace('\r\n', '\n'), new.replace('\r\n', '\n'))):
        if text.count(a) == 1:
            return text.replace(a, b)
    die('anchor "%s" appears %d times, expected 1' % (label, text.count(old)))


with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

doc = src

# ── 1 · the switch ──────────────────────────────────────────────────────────
doc = rep(
    doc,
    "  var OW_WALL  = '/previews/onward/wallpaper.jpg';\r\n"
    "  var OW_HIDE  = 'onerror=\"this.style.visibility=\\'hidden\\'\"';\r\n",

    "  var OW_WALL  = '/previews/onward/wallpaper.jpg';\r\n"
    "\r\n"
    "  /* THE SWITCH. None of the five files above exist, and asking for them\r\n"
    "     produced five 404s on every render of the collection. The onerror\r\n"
    "     that used to sit here hid the damage AFTER the request; this does\r\n"
    "     not make the request.\r\n"
    "\r\n"
    "     Set true the day the art lands and both cards return with no other\r\n"
    "     edit. Nothing else reads it. */\r\n"
    "  var OW_ART = false;\r\n",
    'the switch',
)

# ── 2 · the print card ──────────────────────────────────────────────────────
doc = rep(
    doc,
    "    c2.innerHTML = owHead('frame') +\r\n"
    "      '<div class=\"ow-strip\">' + OW_PRINT.map(function(src, i){\r\n"
    "        return '<div class=\"ow-th' + (i === 2 ? ' is-framed' : '') + '\">' +\r\n"
    "               '<img src=\"' + esc(src) + '\" alt=\"\" loading=\"lazy\" ' + OW_HIDE + '></div>';\r\n"
    "      }).join('') + '</div>' +\r\n"
    "      '<button class=\"ow-go\" type=\"button\">Preview in Your Room \\u2192</button>';\r\n",

    "    c2.innerHTML = owHead('frame') +\r\n"
    "      (OW_ART\r\n"
    "        ? '<div class=\"ow-strip\">' + OW_PRINT.map(function(src, i){\r\n"
    "            return '<div class=\"ow-th' + (i === 2 ? ' is-framed' : '') + '\">' +\r\n"
    "                   '<img src=\"' + esc(src) + '\" alt=\"\" loading=\"lazy\"></div>';\r\n"
    "          }).join('') + '</div>'\r\n"
    "        : '') +\r\n"
    "      '<button class=\"ow-go\" type=\"button\">Preview in Your Room \\u2192</button>';\r\n",
    'print card',
)

# ── 3 · the wallpaper card ──────────────────────────────────────────────────
doc = rep(
    doc,
    "        '<div class=\"phone\">' +\r\n"
    "          '<img src=\"' + esc(OW_WALL) + '\" alt=\"\" ' + OW_HIDE + '>' +\r\n"
    "          '<div class=\"phone-notch\"></div>' +\r\n",

    "        '<div class=\"phone\">' +\r\n"
    "          /* The phone itself is CSS and stays. Only the picture inside\r\n"
    "             it is missing, and an empty phone still reads as a phone. */\r\n"
    "          (OW_ART ? '<img src=\"' + esc(OW_WALL) + '\" alt=\"\">' : '') +\r\n"
    "          '<div class=\"phone-notch\"></div>' +\r\n",
    'wallpaper card',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# the onerror crutch is gone, and nothing else uses it
if 'OW_HIDE' in probe:
    die('the onerror crutch survived')

# every reference to the missing art is behind the switch
if 'var OW_ART = false;' not in doc:
    die('the switch is missing')
if probe.count('OW_ART') != 3:
    die('OW_ART is read %d times, expected 3 — one declaration, two cards'
        % probe.count('OW_ART'))
for frag in ("(OW_ART\r\n        ? '<div class=\"ow-strip\">' + OW_PRINT",
             "(OW_ART ? '<img src=\"' + esc(OW_WALL)"):
    if frag.replace('\r\n', '\n') not in doc.replace('\r\n', '\n'):
        die('an onward image is still drawn unconditionally')

# the card that has real art on disk is untouched
if "'<div class=\"ow-strip\">' + recs.map(function(r){" not in doc:
    die('the Recommends strip was changed and should not have been')

# the switch declared above both readers
at = probe.index('var OW_ART = false;')
for m in re.finditer(r'\bOW_ART\b', probe):
    if m.start() < at:
        die('OW_ART is read above its declaration')

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

print('GATE PASSED · five requests for art that does not exist, gone · %d routes' % routes)
print('wrote ' + OUT)
