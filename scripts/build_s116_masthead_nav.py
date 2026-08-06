# -*- coding: utf-8 -*-
"""
build_s116_masthead_nav.py  ·  2026-08-03  ·  CUI V116

The masthead links go nowhere, and Account has no door.

    `<a href="/collection">My Collection</a>` and the rest are plain links to
    routes that do not exist. Clicking one leaves the workshop — the queue,
    the photograph and the pose — and lands on a 404. They have looked like
    navigation since r02 and have never been navigation.

    Everything they name is a slide-over in this file. The links now open it.

WHAT LANDS

  · Account is added to the masthead and the mobile drawer, ruled today.
  · My Collection, Print Shop and Account open their surface instead of
    navigating. The Series menu is untouched — those are real pages.
  · The one that is open is marked, so the masthead says where you are.
  · Gallery and Help still lead nowhere. They are NOT intercepted, because a
    link that swallows the click and does nothing is worse than one that
    fails honestly. Left for whoever builds them.

Run from the repo root:  python scripts\\build_s116_masthead_nav.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s115.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s116.html')

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

# ── 1 · Account in the masthead ─────────────────────────────────────────────

doc = rep(
    doc,
    "    <a href=\"/gallery\">Gallery</a>\r\n"
    "    <a href=\"/print\">Print Shop</a>\r\n"
    "    <a href=\"/collection\">My Collection</a>\r\n"
    "    <a href=\"/help\">Help</a>\r\n"
    "  </nav>\r\n"
    "  <div class=\"mh-right\">",

    "    <a href=\"/gallery\">Gallery</a>\r\n"
    "    <a href=\"/print\">Print Shop</a>\r\n"
    "    <a href=\"/collection\">My Collection</a>\r\n"
    "    <a href=\"/account\">Account</a>\r\n"
    "    <a href=\"/help\">Help</a>\r\n"
    "  </nav>\r\n"
    "  <div class=\"mh-right\">",
    'masthead account link',
)

# and in the drawer, which is the same list on a narrow screen
doc = rep(
    doc,
    "    <a href=\"/print\">Print Shop</a>\r\n"
    "    <a href=\"/collection\">My Collection</a>\r\n"
    "    <a href=\"/help\">Help</a>\r\n"
    "  </nav>\r\n"
    "</header>",

    "    <a href=\"/print\">Print Shop</a>\r\n"
    "    <a href=\"/collection\">My Collection</a>\r\n"
    "    <a href=\"/account\">Account</a>\r\n"
    "    <a href=\"/help\">Help</a>\r\n"
    "  </nav>\r\n"
    "</header>",
    'drawer account link',
)

# ── 2 · they open things now ────────────────────────────────────────────────

JS = (
    "  /* ---- the masthead opens what it names ----------------------------------\n"
    "     These have been plain links to routes that do not exist since r02.\n"
    "     Clicking one left the workshop — the queue, the photograph, the pose —\n"
    "     and landed on a 404. Everything they name is a slide-over in this\n"
    "     file.\n"
    "\n"
    "     Gallery and Help are deliberately NOT here. Neither is built, and a\n"
    "     link that swallows the click and does nothing is worse than one that\n"
    "     fails honestly. */\n"
    "  var MAST_OPENS = {\n"
    "    '/collection': function(){ if (typeof showCollection === 'function') showCollection(); },\n"
    "    '/print':      function(){ if (typeof showPrintShop === 'function') showPrintShop(); },\n"
    "    '/account':    function(){ if (typeof showAccount === 'function') showAccount(); }\n"
    "  };\n"
    "\n"
    "  function paintMastOpen(){\n"
    "    var open =\n"
    "      (acct   && acct.classList.contains('is-open'))   ? '/account' :\n"
    "      (pshop  && pshop.classList.contains('is-open'))  ? '/print' :\n"
    "      (mycoll && mycoll.classList.contains('is-open')) ? '/collection' : null;\n"
    "    document.querySelectorAll('.mh-nav a, .mh-drawer a').forEach(function(a){\n"
    "      var href = a.getAttribute('href');\n"
    "      if (MAST_OPENS[href]) a.classList.toggle('is-open', href === open);\n"
    "    });\n"
    "  }\n"
    "\n"
    "  document.addEventListener('click', function(e){\n"
    "    var a = e.target.closest('.mh-nav a, .mh-drawer a');\n"
    "    if (!a) return;\n"
    "    var go = MAST_OPENS[a.getAttribute('href')];\n"
    "    if (!go) return;          /* Gallery, Help, and the Series pages */\n"
    "    e.preventDefault();\n"
    "    go();\n"
    "    paintMastOpen();\n"
    "  });\n"
    "\n"
    "  /* The surfaces can also be closed from inside themselves, so the mark\n"
    "     is repainted after anything that moves one. */\n"
    "  ['acClose', 'psClose', 'mcClose'].forEach(function(id){\n"
    "    var b = document.getElementById(id);\n"
    "    if (b) b.addEventListener('click', function(){ setTimeout(paintMastOpen, 0); });\n"
    "  });\n"
    "\n"
)

doc = rep(
    doc,
    "  window.__showAccount = showAccount;\r\n",
    "  window.__showAccount = showAccount;\r\n\r\n" + JS,
    'masthead js',
)

# the Curator's way back should clear the mark too
doc = rep(
    doc,
    "    if (typeof hideAccount === 'function' &&\r\n"
    "        acct && acct.classList.contains('is-open')){ hideAccount(); moved = true; }\r\n"
    "    return moved;\r\n",
    "    if (typeof hideAccount === 'function' &&\r\n"
    "        acct && acct.classList.contains('is-open')){ hideAccount(); moved = true; }\r\n"
    "    if (moved && typeof paintMastOpen === 'function') paintMastOpen();\r\n"
    "    return moved;\r\n",
    'curator back repaints',
)


# ── 3 · one surface at a time ───────────────────────────────────────────────
# showAccount closed the other two and showPrintShop closed the collection,
# but showCollection closed nothing — so opening it from the masthead left the
# Account still open underneath, and the mark stayed on Account. Each of the
# three now closes the others through one function rather than three separate
# lists that were already inconsistent.

doc = rep(
    doc,
    "  function showCollection(){\r\n",
    "  /* Three slide-overs, one at a time. They occupy the same space and the\r\n"
    "     masthead marks one of them; two open at once is a lie in both. */\r\n"
    "  function closeOtherSurfaces(keep){\r\n"
    "    if (keep !== 'collection' && typeof hideCollection === 'function' &&\r\n"
    "        mycoll && mycoll.classList.contains('is-open')) hideCollection();\r\n"
    "    if (keep !== 'print' && typeof hidePrintShop === 'function' &&\r\n"
    "        pshop && pshop.classList.contains('is-open')) hidePrintShop();\r\n"
    "    if (keep !== 'account' && typeof hideAccount === 'function' &&\r\n"
    "        acct && acct.classList.contains('is-open')) hideAccount();\r\n"
    "  }\r\n"
    "\r\n"
    "  function showCollection(){\r\n"
    "    closeOtherSurfaces('collection');\r\n",
    'showCollection closes others',
)

doc = rep(
    doc,
    "  function showPrintShop(){\r\n"
    "    if (!pshop) return;\r\n"
    "    if (typeof hideCollection === 'function') hideCollection();\r\n",
    "  function showPrintShop(){\r\n"
    "    if (!pshop) return;\r\n"
    "    closeOtherSurfaces('print');\r\n",
    'showPrintShop closes others',
)

doc = rep(
    doc,
    "  function showAccount(){\r\n"
    "    if (!acct) return;\r\n"
    "    if (typeof hideCollection === 'function') hideCollection();\r\n"
    "    if (typeof hidePrintShop === 'function') hidePrintShop();\r\n",
    "  function showAccount(){\r\n"
    "    if (!acct) return;\r\n"
    "    closeOtherSurfaces('account');\r\n",
    'showAccount closes others',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# Account has a door, in both lists
if doc.count('<a href="/account">Account</a>') != 2:
    die('the Account link is not in both the masthead and the drawer')

# the three that exist open, and are the only three intercepted
for href in ("'/collection':", "'/print':", "'/account':"):
    if href not in doc:
        die('%s does not open anything' % href)
for href in ('/gallery', '/help'):
    if "'" + href + "':" in doc:
        die('%s is intercepted and leads nowhere — worse than failing honestly' % href)

if 'e.preventDefault();' not in probe.split('MAST_OPENS[a.getAttribute')[1][:200]:
    die('the link still navigates away')

# the masthead says where you are
if 'function paintMastOpen(' not in doc:
    die('nothing marks the open surface')
if doc.count('paintMastOpen()') < 3:
    die('the mark is not repainted when a surface closes')

# one surface at a time, through one function
if doc.count('function closeOtherSurfaces(') != 1:
    die('closeOtherSurfaces is not the single closer')
for keep in ("closeOtherSurfaces('collection')", "closeOtherSurfaces('print')",
             "closeOtherSurfaces('account')"):
    if keep not in doc:
        die('%s is not called' % keep)
if "if (typeof hidePrintShop === 'function') hidePrintShop();\r\n    renderWall();" in doc:
    die('a show function still keeps its own list of what to close')

# declared above their readers
at = probe.index('var MAST_OPENS')
for m in re.finditer(r'\bMAST_OPENS\b', probe):
    if m.start() < at:
        die('MAST_OPENS is read above its declaration')

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

print('GATE PASSED · the masthead opens what it names · %d routes' % routes)
print('wrote ' + OUT)
