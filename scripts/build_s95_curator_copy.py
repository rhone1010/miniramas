# -*- coding: utf-8 -*-
"""
build_s95_curator_copy.py  ·  2026-08-02  ·  CUI V25

CENG's Curator copy, from CURATOR-COPY-2026-08-02.md, verbatim.
Nothing here is CUI's wording.

  A2   the letter said over every photograph. It claimed light on hair the
       machine has never observed and cannot.
  A3   one letter covered all four faults and contradicted the card beside
       it in three of them. Now four, keyed to the fault state raiseFault
       already computes.
  B4   promised a card refund under a credit model.
  B1   "a re-craft is never charged" was broader than the 7/29 ruling.
  G1   the shortfall spoke in the Curator's voice about money.
  E1   an empty collection said nothing.
  D1   the cap letter ran to three sentences.
  A6   the pose letter ran to three.
  F1-3 three onward cards with a title and no body.

NOT BUILT — G2, the buy panel. CENG's ladder reads 20·40·60·100·200 and the
blocks are 10·30·60·120·300, and "most people take 60" has no data behind it.
Rich's ruling, then a later build.

Run from the repo root:  python scripts\\build_s95_curator_copy.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-02-s94.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-02-s95.html')

EXPECTED_ROUTES = 10


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
NL = '\r\n' if '\r\n' in src else '\n'

# ─────────────────────────────────────────────────────── A2 · photograph accepted

doc = rep(
    doc,
    "    photo:  'The light across her hair is doing something lovely &mdash; that will carry ' +\r\n"
    "            'into almost anything. So: what kind of effect are you thinking about today?' +\r\n"
    "            '<span class=\"sign\">&mdash; C.</span>',",
    "    /* CENG, 2026-08-02. The line it replaced observed light on hair over\r\n"
    "       every photograph anyone uploads — a man, a kitchen snapshot, a\r\n"
    "       funeral portrait. The analyze response contains no such signal and\r\n"
    "       never will. This one claims nothing. Voice bible §3. */\r\n"
    "    photo:  'So &mdash; what kind of finish are you thinking about today? There&rsquo;s a ' +\r\n"
    "            'floor of rooms below, and I&rsquo;m glad to choose for you if nothing calls.' +\r\n"
    "            '<span class=\"sign\">&mdash; C.</span>',",
    'A2',
)

# ────────────────────────────────────────────────────────── A3 · four fault lines

doc = rep(
    doc,
    "    reject: 'That one is a little soft for me. Something sharper, and closer to the face, ' +\r\n"
    "            'and I can do considerably better by you.' +\r\n"
    "            '<span class=\"sign\">&mdash; C.</span>'",
    "    /* CENG, 2026-08-02. One letter used to cover all four faults, so a\r\n"
    "       face-too-small rejection was answered with the word \"soft\" while\r\n"
    "       the card two inches away said the face sat small. Keyed to the\r\n"
    "       state faultState() already returns. Voice bible §4. */\r\n"
    "    reject: {\r\n"
    "      5: 'This one keeps the face at a distance. Bring me something closer and ' +\r\n"
    "         'I&rsquo;ll have far more to work with.' +\r\n"
    "         '<span class=\"sign\">&mdash; C.</span>',\r\n"
    "      6: 'This photograph is a little soft for me. Something sharper, and I can ' +\r\n"
    "         'do considerably better by you.' +\r\n"
    "         '<span class=\"sign\">&mdash; C.</span>',\r\n"
    "      7: 'There isn&rsquo;t much light in this one. A brighter photograph gives me ' +\r\n"
    "         'detail I can actually craft with.' +\r\n"
    "         '<span class=\"sign\">&mdash; C.</span>',\r\n"
    "      8: 'I can&rsquo;t get hold of this one at all. Bring me another and we&rsquo;ll ' +\r\n"
    "         'start again &mdash; they usually behave.' +\r\n"
    "         '<span class=\"sign\">&mdash; C.</span>'\r\n"
    "    }",
    'A3 lines',
)

doc = rep(
    doc,
    "    say(SAY.reject);",
    "    say(SAY.reject[n] || SAY.reject[8]);",
    'A3 caller',
)

# ───────────────────────────────────────────────── B1 · state 1, second register

doc = rep(
    doc,
    "        Your payment is safe. A re-craft is never charged.</div>",
    "        Your credits are safe. This re-craft isn&rsquo;t charged.</div>",
    'B1',
)

# ───────────────────────────────────────────────── B4 · state 4, credits not card

doc = rep(
    doc,
    "        <div class=\"mcur-say\">I couldn&rsquo;t make this one the way it deserves "
    "&mdash; so I won&rsquo;t send it. It&rsquo;s refunded. No piece reaches you unless "
    "it&rsquo;s right.</div></div>\r\n"
    "      <div class=\"refund-line\"><span>Refunded to your card</span><b>$9.99</b></div>",
    "        <div class=\"mcur-say\">I couldn&rsquo;t make this one the way it deserves "
    "&mdash; so I won&rsquo;t send it. No piece reaches you unless it&rsquo;s right. "
    "<span class=\"sig\">&mdash;&thinsp;C.</span></div></div>\r\n"
    "      <div class=\"refund-line\"><span>Returned to your balance</span><b>10 credits</b></div>",
    'B4 letter',
)

doc = rep(
    doc,
    "        Refunds settle in 5&ndash;10 days, on the card you used.</div>",
    "        Your credits have been returned to your balance.</div>",
    'B4 safe line',
)

# ─────────────────────────────────────────────────────────── D1 · the cap letter

doc = rep(
    doc,
    "        <div class=\"mcur-say\">Ten pieces will keep the studio busy for a good while.\r\n"
    "          Let me craft these first &mdash; then we&rsquo;ll begin the next ten,\r\n"
    "          and you won&rsquo;t be left waiting on the whole lot at once.\r\n"
    "          <span class=\"sig\">&mdash;&thinsp;C.</span></div></div>",
    "        <div class=\"mcur-say\">Ten pieces will keep the studio busy for a good while.\r\n"
    "          Let me craft these first &mdash; then we&rsquo;ll begin the next set.\r\n"
    "          <span class=\"sig\">&mdash;&thinsp;C.</span></div></div>",
    'D1',
)

# ─────────────────────────────────────────────────────────── A6 · the pose letter

doc = rep(
    doc,
    "      'One last thing before I begin. Your photograph gives me a pose already &mdash; ' +\r\n"
    "      'but I needn&rsquo;t keep it. Tell me how you would like to be held, and I&rsquo;ll ' +\r\n"
    "      'carry it through every finish you have chosen.' +\r\n"
    "      '<span class=\"sign\">&mdash; C.</span>',",
    "      'One last thing before I begin. Your photograph gives me a pose already, ' +\r\n"
    "      'but I needn&rsquo;t keep it.' +\r\n"
    "      '<span class=\"sign\">&mdash; C.</span>',",
    'A6',
)

# ───────────────────────────────────────────────────────── G1 · the shortfall, ×2

short_old = (
    "buySay.textContent = 'This craft needs ' + SHORT.needed + ' credits and you have ' +\r\n"
    "                           (SHORT.balance || 0) + '. Choose a block and I will hold your ' +\r\n"
    "                           'pieces while you do.';"
)
short_new = (
    "buySay.textContent = 'This craft needs ' + SHORT.needed + ' credits. Your balance is ' +\r\n"
    "                           (SHORT.balance || 0) + '. Your pieces are held while you decide.';"
)
if doc.count(short_old) != 1:
    die('G1 anchor A appears %d times' % doc.count(short_old))
doc = doc.replace(short_old, short_new)

short2_old = (
    "buySay.textContent = 'This craft needs ' + SHORT.needed + ' credits and you have ' +\r\n"
    "                           (SHORT.balance || 0) + '.';"
)
short2_new = (
    "buySay.textContent = 'This craft needs ' + SHORT.needed + ' credits. Your balance is ' +\r\n"
    "                           (SHORT.balance || 0) + '.';"
)
if doc.count(short2_old) != 1:
    die('G1 anchor B appears %d times' % doc.count(short2_old))
doc = doc.replace(short2_old, short2_new)

# ────────────────────────────────────────────────────── E1 · the empty collection

doc = rep(
    doc,
    "      e.textContent = PIECES.length\r\n"
    "        ? 'Nothing in this Series yet.'\r\n"
    "        : 'Nothing crafted yet. What you make will be kept here.';",
    "      /* The filtered case is a fact about a filter and stays flat. The\r\n"
    "         truly-empty case is the one moment the Curator has something to\r\n"
    "         say and said nothing. CENG, 2026-08-02. */\r\n"
    "      if (PIECES.length){\r\n"
    "        e.textContent = 'Nothing in this Series yet.';\r\n"
    "      } else {\r\n"
    "        e.innerHTML = 'Nothing here yet. Whatever you craft lands in this room and ' +\r\n"
    "                      'stays yours.<span class=\"sign\">&mdash; C.</span>';\r\n"
    "      }",
    'E1',
)

# ───────────────────────────────────────────────────────── F1-F3 · onward bodies

doc = rep(
    doc,
    ".ow-title{\r\n"
    "  font-family:var(--serif); font-size:1.32rem; line-height:1.1;\r\n"
    "  color:#f4efe8;\r\n"
    "}",
    ".ow-title{\r\n"
    "  font-family:var(--serif); font-size:1.32rem; line-height:1.1;\r\n"
    "  color:#f4efe8;\r\n"
    "}\r\n"
    "/* one line under each card title saying why the customer would want it.\r\n"
    "   All three shipped with a headline and nothing beneath it. */\r\n"
    ".ow-line{\r\n"
    "  font-family:var(--sans); font-size:.92rem; line-height:1.45;\r\n"
    "  color:rgba(244,239,232,.62);\r\n"
    "  margin:.55em 0 1em;\r\n"
    "}",
    'ow-line rule',
)

doc = rep(
    doc,
    "    return '<div class=\"ow-head\"><span class=\"ow-ic\">' + OW_ICONS[icon] + '</span>' +\r\n"
    "           '<span class=\"ow-title\"></span></div>';",
    "    return '<div class=\"ow-head\"><span class=\"ow-ic\">' + OW_ICONS[icon] + '</span>' +\r\n"
    "           '<span class=\"ow-title\"></span></div>' +\r\n"
    "           '<p class=\"ow-line\"></p>';",
    'ow-line markup',
)

for title, line, label in [
    ("c1.querySelector('.ow-title').textContent = 'The Curator Recommends';",
     "Three finishes that would sit well beside what you\\u2019ve already made.", 'F1'),
    ("c2.querySelector('.ow-title').textContent = 'Print Shop';",
     "Choose a piece, a size, and how it should be framed.", 'F2'),
    ("c3.querySelector('.ow-title').textContent = 'Create Wallpapers';",
     "Your pieces sized for a phone. Yours to download and keep.", 'F3'),
]:
    var = title.split('.')[0]
    doc = rep(
        doc,
        title,
        title + "\r\n    " + var + ".querySelector('.ow-line').textContent =\r\n      '" + line + "';",
        label,
    )

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

# the copy that was wrong must be gone, all of it
for gone in ('light across her hair',
             'A re-craft is never charged',
             'Refunds settle in 5',
             'Refunded to your card',
             'It&rsquo;s refunded',
             'the next ten',
             'and you have '):
    if gone in doc:
        die('old copy still present: %s' % gone)

# banned vocabulary, customer-facing
body = doc.split('<body', 1)[1] if '<body' in doc else doc
for banned in ('sculpt', 'in-situ', 'in situ'):
    if banned in body.lower():
        die('banned word in markup: %s' % banned)

# four fault letters, and the caller keyed to the state
for k in ("      5: 'This one keeps the face", "      6: 'This photograph is a little soft",
          "      7: 'There isn&rsquo;t much light", "      8: 'I can&rsquo;t get hold"):
    if k not in doc:
        die('missing fault letter %s' % k[6:7])
if 'say(SAY.reject[n] || SAY.reject[8]);' not in doc:
    die('fault caller not keyed to the state')

# every Curator letter is signed
if doc.count('&mdash;&thinsp;C.') < 4:
    die('a Curator letter lost its signature')

# the class introduced this build carries a rule
if '.ow-line{' not in doc:
    die('no rule for .ow-line')

if len(re.findall(r'data-s="[0-9]"', doc)) != 8:
    die('intake states are not 8')
for st in re.findall(r'<style[^>]*>(.*?)</style>', doc, re.S):
    if st.count('{') != st.count('}'):
        die('style block brace imbalance')

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

print('GATE PASSED · 8 states · %d routes · 4 fault letters · %d script blocks'
      % (routes, len(blocks)))
print('wrote ' + OUT)
