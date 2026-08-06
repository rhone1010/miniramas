# -*- coding: utf-8 -*-
"""
build_s106_curator_seven.py  ·  2026-08-03  ·  CUI V25

CENG-TO-CUI-2026-08-03 §4. A2 stops being a question and becomes an offer.

    The old line asked "what kind of finish are you thinking about today?"
    over a floor of eight rooms — a fair question, and one most customers
    cannot answer on arrival. Rich's replacement reframes the moment around
    wandering, and gives the undecided a door.

WHAT LANDS

  · CENG's A2, verbatim.
  · A button under the Curator's letter. First press "Suggest seven
    finishes"; every press after "Show me seven more", and that second label
    holds for the session.
  · Seven tiles from across all eight rooms, dealt from a shuffled deck.
    Fifty-six tiles is eight rounds before anything repeats, so the deck
    reshuffles rather than exhausting — no dead end to design for.
  · The seven are TILES, so the subject changes the face on each card and
    not the set, exactly as in a room. craftIdFor still resolves the variant.

DECISIONS TAKEN, FOR RICH

  · Each card carries its own silo, because these come from eight different
    rooms. Choosing one queues it against the room it belongs to, so the
    rail and My Collection read the same as if it had been picked in there.
  · No "take the room entire" card on this floor. There is no room to take.
  · The crumb reads "Chosen for You". CENG did not name it — say the word
    and it changes.
  · The button shows only once a photograph is in. Offering seven finishes
    to an empty panel is offering nothing.

Run from the repo root:  python scripts\\build_s106_curator_seven.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s105.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s106.html')

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

# ───────────────────────────────────────────────────────────────────── 1 · CSS

doc = rep(
    doc,
    ".cur-change:hover{ background:linear-gradient(180deg,#9d8043 0%,#836f42 100%); "
    "border-color:var(--gold) }\r\n",

    ".cur-change:hover{ background:linear-gradient(180deg,#9d8043 0%,#836f42 100%); "
    "border-color:var(--gold) }\r\n"
    "\r\n"
    "/* The Curator's offer. Sits under the letter rather than under the\r\n"
    "   photograph — it answers what the letter just said, and it is a\r\n"
    "   different kind of act from changing the source. Oxblood outline\r\n"
    "   rather than the brass fill, so it reads as an invitation and not as\r\n"
    "   the primary control of the panel. */\r\n"
    ".cur-seven{\r\n"
    "  display:block; width:100%; margin-top:clamp(14px,1.1vw,22px);\r\n"
    "  height:46px; border-radius:4px;\r\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.1875rem; line-height:1;\r\n"
    "  color:var(--oxblood);\r\n"
    "  background:rgba(125,66,66,.05);\r\n"
    "  border:1px solid rgba(125,66,66,.34);\r\n"
    "  cursor:pointer;\r\n"
    "  transition:background .4s var(--ease-nav), border-color .4s var(--ease-nav),\r\n"
    "             color .4s var(--ease-nav);\r\n"
    "}\r\n"
    ".cur-seven:hover{\r\n"
    "  background:var(--oxblood); border-color:var(--oxblood); color:var(--vellum-100);\r\n"
    "}\r\n"
    ".cur-seven:focus-visible{ outline:2px solid var(--gold); outline-offset:2px }\r\n"
    "/* No photograph, nothing to suggest against. */\r\n"
    ".cur[data-state=\"empty\"] .cur-seven{ display:none }\r\n",
    'cur-seven css',
)

# ────────────────────────────────────────────────────────────────── 2 · markup

doc = rep(
    doc,
    "        <div class=\"cur-letter\">\r\n"
    "          <p id=\"curSay\"></p>\r\n"
    "        </div>\r\n",

    "        <div class=\"cur-letter\">\r\n"
    "          <p id=\"curSay\"></p>\r\n"
    "          <button class=\"cur-seven\" id=\"curSeven\" type=\"button\">Suggest seven finishes</button>\r\n"
    "        </div>\r\n",
    'cur-seven markup',
)

# ─────────────────────────────────────────────────────────────── 3 · CENG's A2

doc = rep(
    doc,
    "    photo:  'So &mdash; what kind of finish are you thinking about today? There&rsquo;s a ' +\r\n"
    "            'floor of rooms below, and I&rsquo;m glad to choose for you if nothing calls.' +\r\n"
    "            '<span class=\"sign\">&mdash; C.</span>',",

    "    /* CENG §4, 2026-08-03. The line before this one asked a question most\r\n"
    "       customers cannot answer on arrival. This one offers a way in, and\r\n"
    "       the button under it is the door. */\r\n"
    "    photo:  'Have a wander through the rooms &mdash; there&rsquo;s more here than ' +\r\n"
    "            'you&rsquo;d guess. Or let me put seven in front of you and we&rsquo;ll ' +\r\n"
    "            'start there.' +\r\n"
    "            '<span class=\"sign\">&mdash; C.</span>',",
    'A2',
)

# ─────────────────────────────────────────────────────────────────── 4 · the JS

JS = (
    "  /* ---- the Curator's seven ------------------------------------------------\r\n"
    "     CENG §4. Seven tiles from across all eight rooms, for the customer who\r\n"
    "     does not know what they want — which is most of them, on arrival.\r\n"
    "\r\n"
    "     Dealt from a shuffled deck rather than drawn at random each time, so\r\n"
    "     seven presses show fifty-six different finishes instead of the same\r\n"
    "     handful with gaps. Fifty-six tiles is eight rounds; the deck\r\n"
    "     reshuffles at the end and carries on, so there is no exhaustion state\r\n"
    "     to design and no dead end to explain.\r\n"
    "\r\n"
    "     These are TILES. The subject changes the face on each card and never\r\n"
    "     the set, exactly as in a room. */\r\n"
    "  var SEVEN = 7;\r\n"
    "  var sevenDeck = [];\r\n"
    "  var sevenAsked = false;\r\n"
    "  var curSeven = document.getElementById('curSeven');\r\n"
    "\r\n"
    "  function allTiles(){\r\n"
    "    var out = [];\r\n"
    "    (R.silos || []).forEach(function(s){\r\n"
    "      siloList(s.id).forEach(function(e){ out.push({ silo:s.id, effect:e }); });\r\n"
    "    });\r\n"
    "    return out;\r\n"
    "  }\r\n"
    "\r\n"
    "  function shuffle(a){\r\n"
    "    for (var i = a.length - 1; i > 0; i--){\r\n"
    "      var j = Math.floor(Math.random() * (i + 1));\r\n"
    "      var t = a[i]; a[i] = a[j]; a[j] = t;\r\n"
    "    }\r\n"
    "    return a;\r\n"
    "  }\r\n"
    "\r\n"
    "  function dealSeven(){\r\n"
    "    if (sevenDeck.length < SEVEN) sevenDeck = shuffle(allTiles());\r\n"
    "    return sevenDeck.splice(0, SEVEN);\r\n"
    "  }\r\n"
    "\r\n"
    "  /* One card per room it came from. A finish chosen here queues against\r\n"
    "     its own silo, so the rail and the collection read the same as if it\r\n"
    "     had been picked inside that room. */\r\n"
    "  function showSeven(){\r\n"
    "    var picks = dealSeven();\r\n"
    "    if (!picks.length) return;\r\n"
    "    var paint = function(){\r\n"
    "      effFloor.innerHTML = '';\r\n"
    "      picks.forEach(function(p){\r\n"
    "        var el = effectCard(p.silo, p.effect);\r\n"
    "        if (inQueue(p.silo, el.dataset.effectId)) el.classList.add('is-selected');\r\n"
    "        effFloor.appendChild(el);\r\n"
    "      });\r\n"
    "      /* No \"take the room entire\" here — there is no room to take. */\r\n"
    "      UPSELL_CTX = null;\r\n"
    "      effFloor.dataset.count = picks.length;\r\n"
    "      crumbHere.textContent = 'Chosen for You';\r\n"
    "      if (ageTog){ ageTog.hidden = !roomHasBoth(picks.map(function(p){ return p.effect; }));\r\n"
    "                   paintAgeTog(); }\r\n"
    "      workshop.classList.remove('workshop-view--silos');\r\n"
    "      workshop.classList.add('workshop-view--effects');\r\n"
    "    };\r\n"
    "    if (workshop.classList.contains('workshop-view--effects')) paint();\r\n"
    "    else turn(siloFloor, effFloor, paint);\r\n"
    "\r\n"
    "    /* \"Show me seven more\" holds for the session once it has been asked\r\n"
    "       for once — CENG §4. */\r\n"
    "    sevenAsked = true;\r\n"
    "    if (curSeven) curSeven.textContent = 'Show me seven more';\r\n"
    "  }\r\n"
    "\r\n"
    "  if (curSeven) curSeven.addEventListener('click', showSeven);\r\n"
    "\r\n"
)

doc = rep(
    doc,
    "  /* Step 1 opens the pose floor. Step 2 crafts. One button, and it never\r\n",
    JS + "  /* Step 1 opens the pose floor. Step 2 crafts. One button, and it never\r\n",
    'seven js',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# CENG's line, and the question it replaced
if 'what kind of finish are you thinking about today' in probe:
    die('the old A2 question survived')
if 'Have a wander through the rooms' not in doc:
    die("CENG's A2 did not land")

# the button, both labels, and the rule about which shows when
if 'id="curSeven"' not in doc:
    die('the button is not in the panel')
if '>Suggest seven finishes<' not in doc:
    die('the first label is wrong')
if "'Show me seven more'" not in doc:
    die('the second label is missing')
if '.cur[data-state="empty"] .cur-seven{ display:none }' not in doc:
    die('the button shows over an empty panel')
for sel in ('.cur-seven{', '.cur-seven:hover{', '.cur-seven:focus-visible{'):
    if sel not in doc:
        die('no rule for %s' % sel)

# seven, from a deck, from tiles
if 'var SEVEN = 7;' not in doc:
    die('the count is not seven')
if 'function dealSeven(' not in doc or 'sevenDeck = shuffle(allTiles())' not in doc:
    die('the seven are not dealt from a shuffled deck')
if 'siloList(s.id)' not in doc:
    die('the deck is not built from tiles')
if 'UPSELL_CTX = null;' not in doc:
    die('the room-entire card can still reach a floor with no room')

# declared above their readers
for name, reader in (('var sevenDeck', 'function dealSeven('),
                     ('var curSeven', 'function showSeven(')):
    if probe.index(name) > probe.index(reader):
        die('%s is declared below %s' % (name, reader))

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

print("GATE PASSED · CENG's A2 · seven from a shuffled deck of tiles · %d routes" % routes)
print('wrote ' + OUT)
