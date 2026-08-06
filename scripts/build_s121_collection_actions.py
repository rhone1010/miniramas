# -*- coding: utf-8 -*-
"""
build_s121_collection_actions.py  ·  2026-08-04  ·  CUI V25

Rich's five, 2026-08-04.

 1 · THE BRASS IS WRONG. Ruled: linear from the bottom, #9c7848 to #b88e57.
     Applied to the checkout button and to the labels in the order panel,
     which were reading as --gold and did not match the mockup either.

 2 · THE ORDER LINE CARDS ARE THE WRONG COLOUR AND THE WRONG HEIGHT.
     Ground is #2c251e with light text. The height was nobody's decision:
     a 56px thumbnail beside a column holding a two-line title, a size, a
     finish and a quantity stepper, all centred, so the row was as tall as
     whichever piece had the longest name. Restructured — the thumbnail
     sets the height, the stepper sits on the same line as the price, and
     the title has one line rather than two.

 3 · THE PIECE IS THE CONTROL. Clicking a piece selects it, features it,
     and brings its actions up. The tick in the corner and the row of
     buttons at the foot were two separate ideas about the same thing.
     The actions are centred on screen now rather than parked at the
     bottom of the panel.

 4 · ARCHIVE SITS UNDER THE PIECE, and only when it is selected. It was
     floating over the top-right corner on hover, which is a different
     control language from everything else here.

 5 · BATCH SELECTION IS OUT FOR V1. One piece at a time. It was two
     mechanisms — a tick for many and a click for one — and every question
     Rich has asked about this screen has been about the one.

Run from the repo root:  python scripts\\build_s121_collection_actions.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-04-s120.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-04-s121.html')

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

# ── 1 · the brass ──────────────────────────────────────────────────────────

doc = rep(
    doc,
    ".ps-or-go{\n"
    "  width:100%; margin-top:1em; padding:.85em;\n"
    "  border:0; border-radius:8px; cursor:pointer;\n"
    "  background:linear-gradient(180deg,#c4a96e 0%, #a3874d 100%);\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.3rem;\n"
    "  color:#241a12;\n"
    "  box-shadow:inset 0 1px 0 rgba(255,255,255,.28);\n"
    "}\n"
    ".ps-or-go:hover{ background:linear-gradient(180deg,#d3ba80 0%, #b0935a 100%) }\n",

    "/* Rich's brass, 2026-08-04: linear from the bottom, #9c7848 to #b88e57.\n"
    "   The old pair was lighter and read as gold rather than brass. */\n"
    ".ps-or-go{\n"
    "  width:100%; margin-top:1em; padding:.85em;\n"
    "  border:0; border-radius:8px; cursor:pointer;\n"
    "  background:linear-gradient(0deg,#9c7848 0%, #b88e57 100%);\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.3rem;\n"
    "  color:#241a12;\n"
    "  box-shadow:inset 0 1px 0 rgba(255,255,255,.22);\n"
    "}\n"
    ".ps-or-go:hover{ background:linear-gradient(0deg,#ab8551 0%, #c69a60 100%) }\n",
    'brass button',
)

doc = rep(
    doc,
    ".ps-or-lab{\n"
    "  font-family:var(--serif); font-size:1.15rem; color:var(--gold);\n"
    "  margin:.2em 0 .6em;\n"
    "}\n",
    "/* Brass, not gold — the same family as the button below them. */\n"
    ".ps-or-lab{\n"
    "  font-family:var(--serif); font-size:1.15rem; color:#b88e57;\n"
    "  margin:.2em 0 .6em;\n"
    "}\n",
    'brass labels',
)

doc = rep(
    doc,
    ".ps-or-h .n{\n"
    "  font-family:var(--sans); font-size:.7rem; letter-spacing:.14em;\n"
    "  text-transform:uppercase; color:var(--gold);\n"
    "}\n",
    ".ps-or-h .n{\n"
    "  font-family:var(--sans); font-size:.7rem; letter-spacing:.14em;\n"
    "  text-transform:uppercase; color:#b88e57;\n"
    "}\n",
    'brass count',
)

# ── 2 · the order line ─────────────────────────────────────────────────────

doc = rep(
    doc,
    ".ps-or-line{\n"
    "  display:flex; align-items:center; gap:.8em;\n"
    "  padding:.7em; margin-bottom:.6em; border-radius:8px;\n"
    "  background:rgba(255,255,255,.035);\n"
    "  border:1px solid rgba(196,169,110,.14);\n"
    "}\n"
    ".ps-or-line img{\n"
    "  width:56px; height:56px; flex:0 0 auto; object-fit:cover; border-radius:5px;\n"
    "}\n",

    "/* #2c251e with light text, ruled 2026-08-04.\n"
    "\n"
    "   The height was nobody's decision: a 56px thumbnail beside a centred\n"
    "   column carrying a two-line title, a size, a finish and a stepper, so\n"
    "   the row was as tall as the longest name in the order. The thumbnail\n"
    "   sets the height now and the column sits against the top of it. */\n"
    ".ps-or-line{\n"
    "  display:flex; align-items:flex-start; gap:.75em;\n"
    "  padding:.7em; margin-bottom:.55em; border-radius:8px;\n"
    "  background:#2c251e;\n"
    "  border:1px solid rgba(196,169,110,.16);\n"
    "}\n"
    ".ps-or-line img{\n"
    "  width:64px; height:64px; flex:0 0 auto; object-fit:cover; border-radius:5px;\n"
    "}\n",
    'order line card',
)

doc = rep(
    doc,
    "/* Two lines, then it clips. The full label runs to five words and a\n"
    "   number, and left to itself it wrapped to six lines and shoved the\n"
    "   price out of the row. */\n"
    ".ps-or-line .ti{\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.05rem;\n"
    "  color:var(--vellum-100); line-height:1.2;\n"
    "  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;\n"
    "  overflow:hidden;\n"
    "}\n",

    "/* One line. Two was still enough to make every card a different height,\n"
    "   and the piece is beside it in the thumbnail. */\n"
    ".ps-or-line .ti{\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.02rem;\n"
    "  color:#f3ede1; line-height:1.25;\n"
    "  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;\n"
    "}\n"
    "/* The stepper and the price share the bottom line, so the card is the\n"
    "   height of its thumbnail and no taller. */\n"
    ".ps-or-line .foot{\n"
    "  display:flex; align-items:center; gap:.7em; margin-top:.35em;\n"
    "}\n"
    ".ps-or-line .foot .lp{ margin-left:auto }\n",
    'order line title one',
)

doc = rep(
    doc,
    ".ps-or-line .pf{\n"
    "  font-family:var(--sans); font-size:.72rem; color:var(--taupe); margin-top:.25em;\n"
    "}\n",
    ".ps-or-line .pf{\n"
    "  font-family:var(--sans); font-size:.72rem; color:rgba(243,237,225,.55);\n"
    "  margin-top:.2em;\n"
    "}\n",
    'order line meta',
)

doc = rep(
    doc,
    "          '<div class=\"ps-qty\" style=\"margin-top:.45em\">' +\n"
    "            '<button type=\"button\" data-q=\"-\">\\u2212</button>' +\n"
    "            '<span>' + l.copies + '</span>' +\n"
    "            '<button type=\"button\" data-q=\"+\">+</button>' +\n"
    "          '</div>' +\n"
    "        '</div>' +\n"
    "        '<div class=\"lp\">' + money(l.cents * l.copies) + '</div>' +\n"
    "        '<button class=\"ps-rm\" type=\"button\" data-rm=\"1\">\\u00d7</button>' +\n",

    "          '<div class=\"foot\">' +\n"
    "            '<div class=\"ps-qty\">' +\n"
    "              '<button type=\"button\" data-q=\"-\">\\u2212</button>' +\n"
    "              '<span>' + l.copies + '</span>' +\n"
    "              '<button type=\"button\" data-q=\"+\">+</button>' +\n"
    "            '</div>' +\n"
    "            '<div class=\"lp\">' + money(l.cents * l.copies) + '</div>' +\n"
    "          '</div>' +\n"
    "        '</div>' +\n"
    "        '<button class=\"ps-rm\" type=\"button\" data-rm=\"1\">\\u00d7</button>' +\n",
    'order line markup',
)

# ── 3 · one piece at a time, and the actions come to the middle ────────────

doc = rep(
    doc,
    ".mc-bulk{\n"
    "  position:absolute; z-index:4; left:50%; bottom:1.2rem;\n"
    "  transform:translate(-50%, 150%);\n",
    "/* Centred on the screen, not parked at the foot of the panel. It appears\n"
    "   when a piece is chosen and it is about that piece. */\n"
    ".mc-bulk{\n"
    "  position:fixed; z-index:60; left:50%; top:50%;\n"
    "  transform:translate(-50%, -50%) scale(.96);\n"
    "  opacity:0; pointer-events:none;\n"
    "  transition:opacity .28s ease, transform .28s cubic-bezier(.16,1,.3,1);\n"
    "}\n"
    ".mc-bulk.is-up{ opacity:1; pointer-events:auto; transform:translate(-50%,-50%) scale(1) }\n"
    ".mc-bulk-unused{\n",
    'bulk centred',
)

doc = rep(
    doc,
    "  transition:transform .34s cubic-bezier(.16,1,.3,1);\n"
    "}\n",
    "}\n",
    'bulk old transition',
)

# the tick is gone with batch selection
doc = rep(
    doc,
    ".piece:hover .piece__pick, .piece.is-picked .piece__pick{ opacity:1 }\n",
    "/* Batch selection is out for V1 — one piece at a time, and the piece\n"
    "   itself is the control. The tick was a second way to say the same\n"
    "   thing. */\n"
    ".piece__pick{ display:none !important }\n",
    'tick gone',
)

# archive moves under the piece, on selection
doc = rep(
    doc,
    ".pc-arch{\n"
    "  position:absolute; top:.4em; right:.4em; z-index:2;\n"
    "  display:inline-flex; align-items:center; gap:.3em;\n"
    "  padding:.25em .55em; border-radius:999px; border:0; cursor:pointer;\n"
    "  background:rgba(20,16,13,.72); color:rgba(243,237,225,.9);\n"
    "  font-family:var(--sans); font-size:.68rem; letter-spacing:.04em;\n"
    "  opacity:0; transition:opacity .22s ease, background .22s ease;\n"
    "}\n"
    ".piece:hover .pc-arch,\n"
    ".piece:focus-within .pc-arch,\n"
    ".pc-arch:focus-visible{ opacity:1 }\n"
    ".pc-arch:hover{ background:var(--oxblood) }\n",

    "/* Under the piece, and only when it is the chosen one. It was floating\n"
    "   over the corner on hover, which is a different control language from\n"
    "   everything else on this screen. */\n"
    ".pc-arch{\n"
    "  display:none;\n"
    "  width:100%; margin-top:.35em;\n"
    "  align-items:center; justify-content:center; gap:.35em;\n"
    "  padding:.4em; border-radius:5px; border:1px solid rgba(196,169,110,.26);\n"
    "  background:rgba(255,255,255,.04); color:rgba(243,237,225,.8);\n"
    "  font-family:var(--sans); font-size:.72rem; letter-spacing:.03em;\n"
    "  cursor:pointer; transition:background .22s ease, border-color .22s ease;\n"
    "}\n"
    ".piece.is-featured .pc-arch{ display:flex }\n"
    ".pc-arch:hover{ background:var(--oxblood); border-color:var(--oxblood); color:#fff }\n",
    'archive under',
)

doc = rep(
    doc,
    "@media (hover:none){ .pc-arch{ opacity:.85 } }\n",
    "",
    'archive touch rule gone',
)

# ── 4 · the wiring ─────────────────────────────────────────────────────────

doc = rep(
    doc,
    "    mcGrid.addEventListener('click', function(e){\r\n"
    "      var chk = e.target.closest('[data-pick]');\r\n"
    "      if (chk){ e.stopPropagation(); togglePick(chk.dataset.pick); return; }\r\n"
    "      var tile = e.target.closest('.piece');\r\n"
    "      if (!tile || tile.classList.contains('is-crafting')) return;\r\n"
    "      /* A mini chooses what to show large. The featured panel is the only\r\n"
    "         thing that opens the lightbox — choosing and looking stay separate. */\r\n"
    "      setFeatured(tile.dataset.piece);\r\n"
    "    });\r\n",

    "    mcGrid.addEventListener('click', function(e){\r\n"
    "      /* Archive has its own handler and must not also choose the piece. */\r\n"
    "      if (e.target.closest('[data-arch]')) return;\r\n"
    "      var tile = e.target.closest('.piece');\r\n"
    "      if (!tile || tile.classList.contains('is-crafting')) return;\r\n"
    "      /* One click does all of it: this is the piece, show it large, and\r\n"
    "         bring up what can be done with it. Batch selection is out for\r\n"
    "         V1 — a tick for many and a click for one were two mechanisms\r\n"
    "         answering the same question. */\r\n"
    "      choosePiece(tile.dataset.piece);\r\n"
    "    });\r\n",
    'tile click',
)

doc = rep(
    doc,
    "      setFeatured(tile.dataset.piece);\r\n"
    "    });\r\n"
    "  }\r\n",
    "      choosePiece(tile.dataset.piece);\r\n"
    "    });\r\n"
    "  }\r\n",
    'tile keydown',
)

doc = rep(
    doc,
    "  function togglePick(id){\r\n"
    "    if (PICKED[id]) delete PICKED[id]; else PICKED[id] = true;\r\n"
    "    var el = mcGrid.querySelector('[data-piece=\"' + id + '\"]');\r\n"
    "    if (el) el.classList.toggle('is-picked', !!PICKED[id]);\r\n"
    "    updateBulk();\r\n"
    "  }\r\n",

    "  /* One piece at a time. PICKED still exists because Download and Send\r\n"
    "     read it, but it never holds more than one — so nothing downstream\r\n"
    "     had to change and there is no second code path to keep in step. */\r\n"
    "  function choosePiece(id){\r\n"
    "    PICKED = {};\r\n"
    "    PICKED[id] = true;\r\n"
    "    setFeatured(id);\r\n"
    "    updateBulk();\r\n"
    "  }\r\n"
    "\r\n"
    "  function togglePick(id){ choosePiece(id); }\r\n",
    'choosePiece',
)

doc = rep(
    doc,
    "  function updateBulk(){\r\n"
    "    if (!mcBulk) return;\r\n"
    "    var n = mcCount();\r\n"
    "    if (mcBulkN) mcBulkN.textContent = n + ' selected';\r\n"
    "    mcBulk.classList.toggle('is-up', n > 0);\r\n"
    "  }\r\n",

    "  function updateBulk(){\r\n"
    "    if (!mcBulk) return;\r\n"
    "    var n = mcCount();\r\n"
    "    /* \"1 selected\" is a count of a thing that can only be one. The name\r\n"
    "       of the piece is the useful label. */\r\n"
    "    if (mcBulkN){\r\n"
    "      var one = null;\r\n"
    "      PIECES.forEach(function(p){ if (PICKED[p.id]) one = p; });\r\n"
    "      mcBulkN.textContent = one ? (one.name || 'Crafted Image') : '';\r\n"
    "    }\r\n"
    "    mcBulk.classList.toggle('is-up', n > 0);\r\n"
    "  }\r\n",
    'bulk label',
)

# the featured tile is marked so archive shows under it
doc = rep(
    doc,
    "    FEAT = id;\r\n",
    "    FEAT = id;\r\n"
    "    /* The chosen tile carries the mark, so its archive control shows. */\r\n"
    "    if (mcGrid){\r\n"
    "      mcGrid.querySelectorAll('.piece').forEach(function(t){\r\n"
    "        t.classList.toggle('is-featured', t.dataset.piece === id);\r\n"
    "      });\r\n"
    "    }\r\n",
    'featured mark',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# 1 · Rich's brass, and the old pair gone
if 'linear-gradient(0deg,#9c7848 0%, #b88e57 100%)' not in doc:
    die('the brass is not the ruled gradient')
if '#c4a96e' in doc or '#a3874d' in doc:
    die('the old brass survived')

# 2 · the card
if 'background:#2c251e;' not in doc:
    die('the order line is not #2c251e')
# Scoped to the order line. Another rule elsewhere in the file clamps at two
# and has nothing to do with this.
oline = doc[doc.index('.ps-or-line .ti{'):]
oline = oline[:oline.index('}') + 1]
if 'line-clamp' in oline:
    die('the order line title still runs to two lines')
if 'text-overflow:ellipsis' not in oline:
    die('the order line title does not clip to one line')
if '.ps-or-line .foot{' not in doc:
    die('the stepper and price do not share a line')

# 3 · one piece at a time
if doc.count('function choosePiece(') != 1:
    die('choosePiece is not the single selector')
if 'PICKED = {};\r\n    PICKED[id] = true;' not in doc and 'PICKED = {};\n    PICKED[id] = true;' not in doc:
    die('more than one piece can be selected')
if '.piece__pick{ display:none !important }' not in doc:
    die('the batch tick is still visible')

# the actions are centred on screen
if 'position:fixed; z-index:60; left:50%; top:50%;' not in doc:
    die('the actions are not centred on screen')

# 4 · archive under the piece, on selection only
if '.piece.is-featured .pc-arch{ display:flex }' not in doc:
    die('archive does not sit under the chosen piece')
if 'position:absolute; top:.4em; right:.4em' in doc:
    die('archive is still floating over the corner')

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

print('GATE PASSED · brass, one piece at a time, actions in the middle · %d routes' % routes)
print('wrote ' + OUT)
