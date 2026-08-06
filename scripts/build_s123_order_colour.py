# -*- coding: utf-8 -*-
"""
build_s123_order_colour.py  ·  2026-08-04  ·  CUI V25

The order card is the wrong colour because a more specific rule was winning.

    The line carries two classes — `ps-or-line ps-line` — and the light
    dress from s109 has `.pshop .ps-line{ background:rgba(255,255,255,.5) }`.
    Two selectors beat one, so the card painted white-on-vellum inside a
    coffee panel and #2c251e never applied at all.

    `ps-line` was only there so the existing quantity and remove handler,
    which looks for `.ps-line`, would keep working. It is gone, and the
    handler is told the real name.

    Same fault class as the scrim that hid every modal for four months: a
    rule that looked right, was never matching, and nothing checked what the
    cascade actually computed.

AND THE CHECKOUT BUTTON
    It is not the wrong brass — it is disabled, because the address is
    empty, and 40% opacity on brass reads as sludge. Disabled now keeps its
    colour and loses its contrast instead, so it reads as "not yet" rather
    than "broken".

Run from the repo root:  python scripts\\build_s123_order_colour.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-04-s122.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-04-s123.html')

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

# ── 1 · one class, so nothing outbids it ───────────────────────────────────

doc = rep(
    doc,
    "      return '<div class=\"ps-or-line ps-line\" data-lid=\"' + l.lid + '\">' +\n",
    "      /* NOT `ps-line` as well. `.pshop .ps-line` is two selectors to this\n"
    "         one's one, so the light dress won and painted this card white\n"
    "         inside a coffee panel. */\n"
    "      return '<div class=\"ps-or-line\" data-lid=\"' + l.lid + '\">' +\n",
    'one class',
)

# the handler asked for the class that has just gone
doc = rep(
    doc,
    "    var line = e.target.closest('.ps-line');\r\n",
    "    /* Was '.ps-line' — the class the order line no longer carries. */\r\n"
    "    var line = e.target.closest('.ps-or-line');\r\n",
    'handler class',
)

# ── 2 · and make the rule immune to being outbid again ─────────────────────

doc = rep(
    doc,
    ".ps-or-line{\n"
    "  display:flex; align-items:flex-start; gap:.75em;\n"
    "  padding:.7em; margin-bottom:.55em; border-radius:8px;\n"
    "  background:#2c251e;\n"
    "  border:1px solid rgba(196,169,110,.16);\n"
    "}\n",

    "/* Scoped to the panel, so it carries the same weight as anything in the\n"
    "   light dress that might reach it. A single-class rule sitting in a file\n"
    "   full of `.pshop .x` rules is a rule waiting to lose. */\n"
    ".pshop .ps-or-line{\n"
    "  display:flex; align-items:flex-start; gap:.75em;\n"
    "  padding:.7em; margin-bottom:.55em; border-radius:8px;\n"
    "  background:#2c251e;\n"
    "  border:1px solid rgba(196,169,110,.16);\n"
    "}\n",
    'scoped card',
)

doc = rep(
    doc,
    ".ps-or-line .lp{\n"
    "  font-family:var(--sans); font-size:.95rem; color:var(--vellum-100);\n"
    "  white-space:nowrap; flex:0 0 auto;\n"
    "}\n",
    ".pshop .ps-or-line .lp{\n"
    "  font-family:var(--sans); font-size:.95rem; color:#f3ede1;\n"
    "  white-space:nowrap; flex:0 0 auto;\n"
    "}\n",
    'scoped price',
)

doc = rep(
    doc,
    ".ps-or-line .ti{\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.02rem;\n"
    "  color:#f3ede1; line-height:1.25;\n"
    "  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;\n"
    "}\n",
    ".pshop .ps-or-line .ti{\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.02rem;\n"
    "  color:#f3ede1; line-height:1.25;\n"
    "  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;\n"
    "}\n",
    'scoped title',
)

doc = rep(
    doc,
    ".ps-or-line .pf{\n"
    "  font-family:var(--sans); font-size:.72rem; color:rgba(243,237,225,.55);\n"
    "  margin-top:.2em;\n"
    "}\n",
    ".pshop .ps-or-line .pf{\n"
    "  font-family:var(--sans); font-size:.72rem; color:rgba(243,237,225,.55);\n"
    "  margin-top:.2em;\n"
    "}\n",
    'scoped meta',
)

# the stepper and the remove button inside the order line are coffee too
doc = rep(
    doc,
    ".pshop .ps-qty{ border-color:rgba(137,105,67,.3) }\n"
    ".pshop .ps-qty button{ background:rgba(125,66,66,.08); color:var(--ink) }\n"
    ".pshop .ps-qty span{ color:var(--ink) }\n",

    ".pshop .ps-qty{ border-color:rgba(137,105,67,.3) }\n"
    ".pshop .ps-qty button{ background:rgba(125,66,66,.08); color:var(--ink) }\n"
    ".pshop .ps-qty span{ color:var(--ink) }\n"
    "/* Inside the order card the ground is coffee, so the stepper and the\n"
    "   remove button take the light treatment rather than the ink one. */\n"
    ".pshop .ps-or-line .ps-qty{ border-color:rgba(196,169,110,.26) }\n"
    ".pshop .ps-or-line .ps-qty button{\n"
    "  background:rgba(255,255,255,.07); color:rgba(243,237,225,.86);\n"
    "}\n"
    ".pshop .ps-or-line .ps-qty span{ color:#f3ede1 }\n"
    ".pshop .ps-or-line .ps-rm{ color:rgba(243,237,225,.5) }\n"
    ".pshop .ps-or-line .ps-rm:hover{ color:#c48b8b }\n",
    'stepper on coffee',
)

# ── 3 · disabled brass reads as "not yet", not as broken ───────────────────

doc = rep(
    doc,
    ".ps-or-go:disabled{ opacity:.4; cursor:default }\n",
    "/* 40% opacity on brass over a dark panel is sludge, and it read as a\n"
    "   colour mistake rather than as a state. Keep the colour, lose the\n"
    "   contrast. */\n"
    ".ps-or-go:disabled{\n"
    "  cursor:default;\n"
    "  background:linear-gradient(0deg,#5c4830 0%, #6b5438 100%);\n"
    "  color:rgba(243,237,225,.45);\n"
    "  box-shadow:none;\n"
    "}\n"
    ".ps-or-go:disabled:hover{ background:linear-gradient(0deg,#5c4830 0%, #6b5438 100%) }\n",
    'disabled brass',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# the class that was losing is gone, and the handler knows
if 'class=\\"ps-or-line ps-line\\"' in doc or 'class="ps-or-line ps-line"' in doc:
    die('the order line still carries the class that outbid it')
if "closest('.ps-line')" in doc:
    die('the handler still asks for a class the line does not carry')
if "closest('.ps-or-line')" not in doc:
    die('the handler cannot find the order line')

# every rule that dresses the card is scoped to the panel, so nothing in the
# light dress can outbid it again
for sel in ('.pshop .ps-or-line{', '.pshop .ps-or-line .ti{',
            '.pshop .ps-or-line .pf{', '.pshop .ps-or-line .lp{'):
    if sel not in doc:
        die('%s is not scoped to the panel' % sel)
for sel in ('\n.ps-or-line{', '\n.ps-or-line .ti{', '\n.ps-or-line .lp{'):
    if sel in doc.replace('\r\n', '\n'):
        die('an unscoped rule survived and can be outbid: %s' % sel.strip())

# the ground is what was ruled
if 'background:#2c251e;' not in doc:
    die('the order card is not #2c251e')

# disabled keeps its colour
if 'opacity:.4; cursor:default' in doc:
    die('the disabled button is still faded to sludge')
if 'linear-gradient(0deg,#5c4830 0%, #6b5438 100%)' not in doc:
    die('the disabled state has no colour of its own')

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

print('GATE PASSED · the card is #2c251e and nothing can outbid it · %d routes' % routes)
print('wrote ' + OUT)
