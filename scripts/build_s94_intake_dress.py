# -*- coding: utf-8 -*-
"""
build_s94_intake_dress.py  ·  2026-08-02  ·  CUI V25

Three dress faults in the eight intake states, all of the same class the
handoff names: markup and CSS written against tokens and class names that
have no definition anywhere in the file.

  1 · state 3's button is `.btn.sage`. `--sage` is not a token in this file,
      so `background:var(--sage)` is invalid at computed-value time and the
      declaration drops to nothing, while `color:var(--vellum)` resolves to
      cream. Cream text on a cream card. Ruled: oxblood ground.
      Two `:hover` rules fail the same way — `--oxblood-d` and
      `--oxblood-deep` are not tokens either, so `.btn.fill` has had no
      hover state since r02.

  2 · state 3's address line — `.field`, `.inp` — and state 4's amount line
      — `.refund-line` — have no rule anywhere. They render at browser
      defaults: block, serif, hard against the letter above, and the amount
      butts straight onto the label ("your card$9.99"). Ruled: centred,
      10px above.

  3 · the address reads as two stacked lines. Ruled: one line, em dash.

No JavaScript changes. Route count is unchanged at 10.

Run from the repo root:  python scripts\\build_s94_intake_dress.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-02-s93.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-02-s94.html')

EXPECTED_ROUTES = 10


def die(msg):
    print('GATE FAILED · ' + msg)
    sys.exit(1)


def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        die('anchor "%s" appears %d times, expected exactly 1' % (label, n))
    return text.replace(old, new)


with open(SRC, encoding='utf-8') as f:
    src = f.read()

doc = src

# ---------------------------------------------------------------- 1 · buttons

doc = replace_once(
    doc,
    ".m-scrim .m-modal .btn.sage{background:var(--sage);color:var(--vellum)}\n"
    ".m-scrim .m-modal .btn.sage:hover{filter:brightness(1.07)}",
    "/* `--sage` is not a token in this file. The background dropped and the\n"
    "   cream text stayed, so \"Keep me posted\" was cream on cream. A light\n"
    "   label takes an oxblood ground. */\n"
    ".m-scrim .m-modal .btn.sage{background:var(--oxblood);color:var(--vellum-100)}\n"
    ".m-scrim .m-modal .btn.sage:hover{background:#6a3737}",
    'btn.sage',
)

doc = replace_once(
    doc,
    ".m-scrim .m-modal .btn.fill:hover{background:var(--oxblood-d)}",
    ".m-scrim .m-modal .btn.fill:hover{background:#6a3737}",
    'm-modal fill hover',
)

doc = replace_once(
    doc,
    ".m-scrim .btn.fill:hover{background:var(--oxblood-deep)}",
    ".m-scrim .btn.fill:hover{background:#6a3737}",
    'm-scrim fill hover',
)

# ------------------------------------------------------------- 2 · fact lines

doc = replace_once(
    doc,
    ".m-scrim .modal .safe svg{ width:1rem; height:1rem; flex:0 0 auto; "
    "margin-top:.12rem; color:var(--brass) }",
    ".m-scrim .modal .safe svg{ width:1rem; height:1rem; flex:0 0 auto; "
    "margin-top:.12rem; color:var(--brass) }\n"
    "\n"
    "/* the fact line — an address, an amount. Second register: sans, quiet,\n"
    "   centred, and never the Curator's voice.\n"
    "\n"
    "   .field, .inp and .refund-line came across from r02 with no rule\n"
    "   anywhere in this file, so they rendered as browser-default blocks\n"
    "   sitting hard against the letter, and the amount ran straight onto its\n"
    "   label with nothing between them. Same fault class as .m-cur in s89. */\n"
    ".m-scrim .modal .field,\n"
    ".m-scrim .modal .refund-line{\n"
    "  display:flex; align-items:baseline; justify-content:center; gap:.4rem;\n"
    "  margin-top:10px;\n"
    "  font-family:var(--sans, system-ui, sans-serif);\n"
    "  font-size:.9rem; line-height:1.5; color:var(--ink-soft);\n"
    "}\n"
    ".m-scrim .modal .field .inp{ color:var(--ink) }\n"
    ".m-scrim .modal .field .dash{ color:var(--taupe) }\n"
    ".m-scrim .modal .refund-line b{ font-weight:600; color:var(--ink) }",
    'safe svg',
)

# ---------------------------------------------------------- 3 · address, one line

doc = replace_once(
    doc,
    '<div class="field"><label>We&rsquo;ll send it here</label>'
    '<div class="inp">rich@email.com</div></div>',
    '<div class="field"><span>We&rsquo;ll send it here</span>'
    '<span class="dash">&mdash;</span>'
    '<span class="inp">rich@email.com</span></div>',
    'state 3 address line',
)

# ===================================================================== THE GATE

if doc == src:
    die('nothing changed')

# routes — 10, deliberately or not at all
routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

# no undefined custom property may survive in the modal dress
for token in ('background:var(--sage)', 'var(--oxblood-d)', 'var(--oxblood-deep)'):
    if token in doc:
        die('undefined token %s still present' % token)

# assert what the cascade has to work with, not what the class says:
# every class used in the two lines under review must now carry a rule
for sel in ('.m-scrim .modal .field,',
            '.m-scrim .modal .refund-line{',
            '.m-scrim .modal .field .inp{',
            '.m-scrim .modal .field .dash{',
            '.m-scrim .modal .refund-line b{',
            '.m-scrim .m-modal .btn.sage{'):
    if sel not in doc:
        die('no rule for %s' % sel)

# the fill button must have a resolvable hover ground
if doc.count('.btn.fill:hover{background:#6a3737}') != 2:
    die('fill hover not repaired in both scopes')

# the address is one line, and the amount is separated from its label
if 'We&rsquo;ll send it here</span><span class="dash">' not in doc:
    die('address line not joined')
if '<label>' in doc.split('data-s="3"')[1].split('data-s="4"')[0]:
    die('state 3 still carries a bare label')

# structure
if len(re.findall(r'data-s="[0-9]"', doc)) != 8:
    die('intake states are not 8')
for st in re.findall(r'<style[^>]*>(.*?)</style>', doc, re.S):
    if st.count('{') != st.count('}'):
        die('style block brace imbalance')

# every script block still parses
blocks = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', doc, re.S)
if not blocks:
    die('no script blocks found')
for i, b in enumerate(blocks):
    fd, path = tempfile.mkstemp(suffix='.js')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(b)
    r = subprocess.run(['node', '--check', path], capture_output=True, text=True)
    os.unlink(path)
    if r.returncode != 0:
        die('node --check failed on script block %d\n%s' % (i, r.stderr))

# boot harness — the file must still boot and still drive
boot = None
for name in ('boot.js', 'boot-test.js', 'boot_gate.js', 'boot_check.js'):
    p = os.path.join(ROOT, 'scripts', name)
    if os.path.exists(p):
        boot = p
        break
if boot is None:
    die('boot harness not found in scripts\\ — tell CUI its filename')

with open(OUT, 'w', encoding='utf-8') as f:
    f.write(doc)

r = subprocess.run(['node', boot, OUT], capture_output=True, text=True)
if r.returncode != 0:
    os.unlink(OUT)
    die('boot harness rejected the output\n%s%s' % (r.stdout, r.stderr))

print('GATE PASSED · 8 states · %d routes · %d script blocks' % (routes, len(blocks)))
print('wrote ' + OUT)
