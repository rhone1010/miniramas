# -*- coding: utf-8 -*-
"""
build_s122_pinned_actions.py  ·  2026-08-04  ·  CUI V25

"Add to your order" and "Checkout" are off screen at 1300, 1920 and 2560.

    Not a sizing bug. Six finishes, a photograph, four sizes, a quantity
    stepper and a button do not fit in 900px, and neither do order lines
    plus eight address fields plus five shipping methods plus a total. Both
    panels scroll, which is correct — what is wrong is that the button
    scrolls with them.

    s120 shrank the photograph and it bought a hundred pixels. The next
    thing Rich asks for puts it back.

THE FIX
    The action is pinned to the foot of its own panel and the content
    scrolls behind it. Two panels, two buttons, always in view at every
    width, whatever the content does.

  · The configurator's button carries the current price with it, so the
    number a customer is agreeing to is on the thing they press.
  · The order panel pins the total as well as the button. A checkout button
    without the figure above it is a button asking for a signature on a
    blank cheque.
  · Both footers carry the panel's own ground and a hairline, so content
    passing underneath reads as passing underneath rather than as a
    rendering fault.

Run from the repo root:  python scripts\\build_s122_pinned_actions.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-04-s121.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-04-s122.html')

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

# ── 1 · the configurator's button, pinned ──────────────────────────────────

doc = rep(
    doc,
    ".ps-add{\n"
    "  width:100%; margin-top:.9em; padding:.75em;\n"
    "  border:0; border-radius:8px; background:var(--oxblood);\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.25rem;\n"
    "  color:var(--vellum-100); cursor:pointer;\n"
    "}\n",

    "/* Pinned to the foot of the configurator. Six finishes, a photograph,\n"
    "   four sizes and a stepper do not fit in 900px, so the panel scrolls —\n"
    "   and a button that scrolls out of a scrolling panel is a button nobody\n"
    "   finds. The price rides with it so the figure being agreed to is on\n"
    "   the thing being pressed. */\n"
    ".ps-add{\n"
    "  position:sticky; bottom:0; z-index:2;\n"
    "  display:flex; align-items:center; justify-content:center; gap:.7em;\n"
    "  width:100%; margin-top:.9em; padding:.75em;\n"
    "  border:0; border-radius:8px; background:var(--oxblood);\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.25rem;\n"
    "  color:var(--vellum-100); cursor:pointer;\n"
    "  box-shadow:0 -1rem 1.4rem rgba(255,255,255,.5);\n"
    "}\n"
    ".ps-add .amt{\n"
    "  font-family:var(--sans); font-style:normal; font-size:1.05rem;\n"
    "  opacity:.9;\n"
    "}\n",
    'add button pinned',
)

# the panel must have something to be sticky within
doc = rep(
    doc,
    ".ps-fly{\n"
    "  flex:1 1 36%; min-width:300px; max-width:560px; align-self:flex-start;\n"
    "  max-height:100%; overflow-y:auto;\n"
    "  padding:1.4rem 1.5rem 1.6rem;\n"
    "  background:var(--coffee-700); border:1px solid rgba(196,169,110,.22);\n"
    "  border-radius:10px;\n"
    "}\n",

    ".ps-fly{\n"
    "  flex:1 1 36%; min-width:300px; max-width:560px; align-self:stretch;\n"
    "  max-height:100%; overflow-y:auto;\n"
    "  /* No bottom padding: the pinned button provides it, and padding under\n"
    "     a sticky element is a gap the ground shows through. */\n"
    "  padding:1.4rem 1.5rem 0;\n"
    "  background:var(--coffee-700); border:1px solid rgba(196,169,110,.22);\n"
    "  border-radius:10px;\n"
    "}\n",
    'flyout stretch',
)

# the price moves onto the button
doc = rep(
    doc,
    "      '<div class=\"ps-qrow\">' +\r\n"
    "        '<div class=\"ps-qty\">' +\r\n"
    "          '<button type=\"button\" data-q2=\"-\">\\u2212</button>' +\r\n"
    "          '<span>' + PS_QTY + '</span>' +\r\n"
    "          '<button type=\"button\" data-q2=\"+\">+</button>' +\r\n"
    "        '</div>' +\r\n"
    "        '<span class=\"ps-price\">' + money((size ? size.cents : 0) * PS_QTY) + '</span>' +\r\n"
    "      '</div>' +\r\n"
    "      '<button class=\"ps-add\" id=\"psAdd\" type=\"button\">Add to your order</button>' +\r\n",

    "      '<div class=\"ps-qrow\">' +\r\n"
    "        '<div class=\"ps-qty\">' +\r\n"
    "          '<button type=\"button\" data-q2=\"-\">\\u2212</button>' +\r\n"
    "          '<span>' + PS_QTY + '</span>' +\r\n"
    "          '<button type=\"button\" data-q2=\"+\">+</button>' +\r\n"
    "        '</div>' +\r\n"
    "      '</div>' +\r\n"
    "      '<button class=\"ps-add\" id=\"psAdd\" type=\"button\">Add to your order' +\r\n"
    "        '<span class=\"amt\">' + money((size ? size.cents : 0) * PS_QTY) + '</span>' +\r\n"
    "      '</button>' +\r\n",
    'price on the button',
)

# ── 2 · the order panel's total and button, pinned ─────────────────────────

doc = rep(
    doc,
    ".ps-or-tot{\n"
    "  margin-top:1em; padding-top:.9em; border-top:1px solid rgba(196,169,110,.2);\n"
    "}\n",

    "/* Total and button together, pinned to the foot. A checkout button with\n"
    "   the figure scrolled off above it is a button asking for a signature on\n"
    "   a blank cheque. */\n"
    ".ps-or-foot{\n"
    "  position:sticky; bottom:0; z-index:2;\n"
    "  margin-top:1em; padding-bottom:.2em;\n"
    "  background:linear-gradient(180deg, rgba(27,21,18,.86) 0%, #1b1512 22%);\n"
    "  box-shadow:0 -1.4rem 1.6rem rgba(27,21,18,.9);\n"
    "}\n"
    ".ps-or-tot{\n"
    "  padding-top:.9em; border-top:1px solid rgba(196,169,110,.2);\n"
    "}\n",
    'order footer css',
)

doc = rep(
    doc,
    ".ps-order{\n"
    "  flex:0 0 30%; min-width:320px; max-width:440px;\n"
    "  display:flex; flex-direction:column; min-height:0;\n"
    "  overflow-y:auto;\n"
    "  padding:1.3rem 1.4rem 1.5rem;\n",

    ".ps-order{\n"
    "  flex:0 0 30%; min-width:320px; max-width:440px;\n"
    "  display:flex; flex-direction:column; min-height:0;\n"
    "  overflow-y:auto;\n"
    "  /* No bottom padding — the pinned footer is the bottom. */\n"
    "  padding:1.3rem 1.4rem 0;\n",
    'order panel padding',
)

doc = rep(
    doc,
    "      '<div class=\"ps-or-tot\">' +\n"
    "        '<div class=\"ps-or-row\">Prints (' + count + ')<b>' + money(sub) + '</b></div>' +\n"
    "        '<div class=\"ps-or-row\">Shipping<b>' +\n"
    "          (ship == null ? 'once we have your address' : money(ship)) + '</b></div>' +\n"
    "        '<div class=\"ps-or-row is-total\">Total<b>' +\n"
    "          (tot == null ? '\\u2014' : money(tot)) + '</b></div>' +\n"
    "      '</div>' +\n"
    "      '<button class=\"ps-or-go\" id=\"psCo\" type=\"button\"' +\n"
    "        (ready ? '' : ' disabled') + '>Checkout</button>' +\n"
    "      '<div class=\"ps-or-safe\">Prints are made and posted by our fulfilment lab.</div>';\n",

    "      '<div class=\"ps-or-foot\">' +\n"
    "        '<div class=\"ps-or-tot\">' +\n"
    "          '<div class=\"ps-or-row\">Prints (' + count + ')<b>' + money(sub) + '</b></div>' +\n"
    "          '<div class=\"ps-or-row\">Shipping<b>' +\n"
    "            (ship == null ? 'once we have your address' : money(ship)) + '</b></div>' +\n"
    "          '<div class=\"ps-or-row is-total\">Total<b>' +\n"
    "            (tot == null ? '\\u2014' : money(tot)) + '</b></div>' +\n"
    "        '</div>' +\n"
    "        '<button class=\"ps-or-go\" id=\"psCo\" type=\"button\"' +\n"
    "          (ready ? '' : ' disabled') + '>Checkout</button>' +\n"
    "        '<div class=\"ps-or-safe\">Prints are made and posted by our fulfilment lab.</div>' +\n"
    "      '</div>';\n",
    'order footer markup',
)

# ── 3 · a little more room, since the panels are tight either way ──────────

doc = rep(
    doc,
    ".ps-step{\n"
    "  display:flex; align-items:center; gap:.55em;\n"
    "  margin:1.15em 0 .55em;\n",
    ".ps-step{\n"
    "  display:flex; align-items:center; gap:.55em;\n"
    "  margin:.9em 0 .45em;\n",
    'tighter steps',
)

doc = rep(
    doc,
    ".ps-finish{\n"
    "  margin:.7em 0 .2em; border-radius:8px; overflow:hidden;\n",
    ".ps-finish{\n"
    "  margin:.55em 0 .2em; border-radius:8px; overflow:hidden;\n",
    'tighter finish',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)


def rule(sel):
    """A rule's own block. The selector must be anchored at a line start —
    `.pshop .ps-fly{` contains `.ps-fly{` and would match first, which is
    the same mistake as the scrim that hid every modal for four months."""
    i = doc.index('\n' + sel)
    return doc[i:i + doc[i:].index('}') + 1]


# both actions are pinned, inside a panel that scrolls
for sel, name in (('.ps-add{', 'Add to your order'), ('.ps-or-foot{', 'Checkout')):
    if 'position:sticky; bottom:0;' not in rule(sel):
        die('%s is not pinned' % name)

# The selector must be the rule's own, not a descendant one — `.pshop
# .ps-fly{` contains `.ps-fly{` and matched first, which is the same class
# of mistake as the scrim that hid every modal for four months.
def rule(sel):
    i = doc.index('\n' + sel)
    return doc[i:i + doc[i:].index('}') + 1]

if 'overflow-y:auto;' not in rule('.ps-fly{'):
    die('the configurator does not scroll, so nothing can stick in it')
if 'overflow-y:auto;' not in rule('.ps-order{'):
    die('the order panel does not scroll, so nothing can stick in it')

# the total travels with the button
if "'<div class=\"ps-or-foot\">' +" not in doc:
    die('the total is not inside the pinned footer')
if doc.index('ps-or-foot') > doc.index('id="psCo"') and 'ps-or-foot' not in probe:
    die('the footer does not contain the checkout button')

# the price is on the button rather than above it
if '>Add to your order\' +' not in doc:
    die('the price did not move onto the button')
if "'<span class=\"ps-price\">' + money(" in doc:
    die('the price is still sitting above the button as well')
if '.ps-add .amt{' not in doc:
    die('no rule for the price on the button')

# no bottom padding under a sticky element — it shows the ground through
if 'padding:1.4rem 1.5rem 0;' not in rule('.ps-fly{'):
    die('the configurator still pads below its pinned button')

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

print('GATE PASSED · both actions pinned, content scrolls behind · %d routes' % routes)
print('wrote ' + OUT)
