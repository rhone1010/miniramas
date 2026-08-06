# -*- coding: utf-8 -*-
"""
build_s117_print_shop_dress.py  ·  2026-08-04  ·  CUI V25

Rich's ruling and his measurements.

 1 · THE SHOP SHOWS WHAT WAS SENT TO IT, NOT EVERYTHING
      Fifty-three pieces on the wall is not a shop, it is the collection
      again. Ruled: nothing appears here that was not assigned to it. A
      piece lives in My Collection or in the archive; the Print Shop is
      where you take the ones you want on paper.

      "Send to Print Shop" now means something. The wall is empty until
      something is sent, and says so.

      SESSION-HELD, NOT PERSISTED. What has been sent is not a property of
      the piece — it is what this customer is shopping for right now, and it
      should not still be waiting for them next week. If that turns out to be
      wrong it is a column, not a redesign.

 2 · THE ART IS THE POINT
      Four columns, not five. Square, because Portraits crafts 1:1 and the
      thumbnails were rendering as strips — Rich: "we're shopping for
      foreheads." No label under every tile; the piece is the label.

 3 · THE CHOSEN PIECE HAS PRESENCE
      Oxblood border and a lift, rather than a hairline that reads as
      nothing at this size.

 4 · THE PANEL SIZES TO CONTENT
      It was stretching the full height and leaving a field of white below
      the button. 35% wide, per Rich's own measurement, and it stops where
      it stops.

 5 · Rich's spacing, verbatim: .ps-body margin 30px 30px 20px, gap 4rem,
      .ps-fly width 35%.

 6 · THE HEADER SAYS WHAT TO DO
      "53 PIECES" was a count of things the customer already knew they had.

NOT BUILT, AND WHY
    The merchandising strip under the button — "Archival papers · Museum-grade
    inks · Hand-finished framing" — is three claims about manufacturing, and
    I have no idea which of them are true of Prodigi's Enhanced Matte Art. A
    line about the goods must come from someone who knows what the goods are.
    Space is left for it.

    The lorem panels along the foot are the workshop's, not the shop's, and
    CENG owes five lines. Out of scope here rather than fixed in one place.

Run from the repo root:  python scripts\\build_s117_print_shop_dress.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s116.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-04-s117.html')

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

# ───────────────────────────────────────────────────────────── 1 · the layout

doc = rep(
    doc,
    ".ps-body{ flex:1; min-height:0; display:flex; gap:1.1rem; overflow:hidden }\n"
    ".ps-body[hidden]{ display:none }\n"
    ".ps-wall{\n"
    "  flex:1; min-width:0; overflow-y:auto; padding-bottom:1.4rem;\n"
    "  display:grid; grid-template-columns:repeat(auto-fill, minmax(190px,1fr));\n"
    "  gap:1rem; align-content:start;\n"
    "}\n",

    "/* Rich's measurements, 2026-08-04. */\n"
    ".ps-body{\n"
    "  flex:1; min-height:0; display:flex; gap:4rem; overflow:hidden;\n"
    "  margin:30px 30px 20px 30px;\n"
    "}\n"
    ".ps-body[hidden]{ display:none }\n"
    "/* Four columns, not five. The tiles were rendering as strips and the\n"
    "   art is the whole point of the screen — Rich: \"we're shopping for\n"
    "   foreheads.\" */\n"
    ".ps-wall{\n"
    "  flex:1; min-width:0; overflow-y:auto; padding-bottom:1.4rem;\n"
    "  display:grid; grid-template-columns:repeat(4, minmax(0,1fr));\n"
    "  gap:1.4rem; align-content:start;\n"
    "}\n"
    "@media (max-width:1500px){ .ps-wall{ grid-template-columns:repeat(3, minmax(0,1fr)) } }\n"
    "@media (max-width:1100px){ .ps-wall{ grid-template-columns:repeat(2, minmax(0,1fr)) } }\n",
    'ps-body and wall',
)

# ── 2 · the tile: square, no label, real presence when chosen ───────────────

doc = rep(
    doc,
    ".ps-pc img{ width:100%; aspect-ratio:1; object-fit:cover; display:block }\n"
    ".ps-pc .nm{\n"
    "  padding:.5em .7em; font-family:var(--serif); font-style:italic;\n"
    "  font-size:1.05rem; color:rgba(243,237,225,.86); text-align:center;\n"
    "}\n",

    "/* Square, and enforced against the box as well as the image. A 1:1 craft\n"
    "   was arriving as a letterbox strip. */\n"
    ".ps-pc{ aspect-ratio:1 }\n"
    ".ps-pc img{\n"
    "  width:100%; height:100%; aspect-ratio:1; object-fit:cover; display:block;\n"
    "}\n"
    "/* No label under every tile. The piece is the label, and fifty-three\n"
    "   captions were competing with fifty-three pictures. */\n"
    ".ps-pc .nm{ display:none }\n",
    'tile square',
)

doc = rep(
    doc,
    ".pshop .ps-pc:hover{ border-color:rgba(125,66,66,.45) }\n"
    ".pshop .ps-pc.is-on{ border-color:var(--oxblood); box-shadow:0 0 0 1px var(--oxblood) inset }\n",

    ".pshop .ps-pc{\n"
    "  transition:transform .22s ease, box-shadow .22s ease, border-color .22s ease;\n"
    "}\n"
    ".pshop .ps-pc:hover{ border-color:rgba(125,66,66,.45); transform:translateY(-2px) }\n"
    "/* Chosen. A hairline reads as nothing at this size — it wants weight and\n"
    "   a little lift off the wall. */\n"
    ".pshop .ps-pc.is-on{\n"
    "  border-color:var(--oxblood);\n"
    "  box-shadow:0 0 0 2px var(--oxblood), 0 .7rem 1.4rem rgba(59,41,25,.2);\n"
    "  transform:translateY(-3px);\n"
    "}\n",
    'tile chosen',
)

# ── 3 · the panel: 35%, and it stops where it stops ─────────────────────────

doc = rep(
    doc,
    ".ps-fly{\n"
    "  width:clamp(280px, 24%, 380px); flex:0 0 auto;\n"
    "  overflow-y:auto; padding:1rem 1.1rem 1.4rem;\n"
    "  background:var(--coffee-700); border:1px solid rgba(196,169,110,.22);\n"
    "  border-radius:10px;\n"
    "}\n",

    "/* 35%, Rich's measurement. align-self:start so it sizes to its content —\n"
    "   it was stretching the full height and leaving a field of white below\n"
    "   the button. */\n"
    ".ps-fly{\n"
    "  width:35%; flex:0 0 auto; align-self:flex-start;\n"
    "  max-height:100%; overflow-y:auto;\n"
    "  padding:1.4rem 1.5rem 1.6rem;\n"
    "  background:var(--coffee-700); border:1px solid rgba(196,169,110,.22);\n"
    "  border-radius:10px;\n"
    "}\n",
    'flyout width',
)

doc = rep(
    doc,
    ".ps-fly-head img{\n"
    "  width:74px; height:74px; flex:0 0 auto; object-fit:cover;\n"
    "  border-radius:6px; border:1px solid rgba(137,105,67,.28);\n"
    "}\n"
    ".ps-fly-head h3{\n"
    "  font-family:var(--serif); font-style:italic; font-weight:400;\n"
    "  font-size:1.32rem; line-height:1.15; color:var(--ink);\n"
    "}\n",

    ".ps-fly-head img{\n"
    "  width:80px; height:80px; flex:0 0 auto; object-fit:cover;\n"
    "  border-radius:6px; border:1px solid rgba(137,105,67,.28);\n"
    "}\n"
    ".ps-fly-head h3{\n"
    "  font-family:var(--serif); font-style:italic; font-weight:400;\n"
    "  font-size:1.5rem; line-height:1.15; color:var(--ink);\n"
    "}\n",
    'flyout head',
)

# ── 4 · only what was sent ─────────────────────────────────────────────────

doc = rep(
    doc,
    "  var PS_LID   = 0;\r\n",
    "  var PS_LID   = 0;\r\n"
    "  /* Ruled 2026-08-04: the shop shows what was sent to it and nothing\r\n"
    "     else. Fifty-three pieces on the wall is the collection again.\r\n"
    "\r\n"
    "     Held for the session rather than stored: this is what the customer\r\n"
    "     is shopping for now, not a property of the piece, and it should not\r\n"
    "     still be waiting for them next week. If that is wrong it is a\r\n"
    "     column, not a redesign. */\r\n"
    "  var PS_SENT  = {};\r\n"
    "\r\n"
    "  function sendToPrintShop(list){\r\n"
    "    (list || []).forEach(function(p){ if (p && printable(p)) PS_SENT[p.id] = true; });\r\n"
    "  }\r\n",
    'PS_SENT',
)

doc = rep(
    doc,
    "    var list = PIECES.filter(function(p){ return p.art && !p.crafting; });\r\n"
    "    if (n) n.textContent = list.length + (list.length === 1 ? ' PIECE' : ' PIECES');\r\n"
    "    if (say){\r\n"
    "      say.textContent = list.length\r\n"
    "        ? 'Choose a piece, a size, and how it should be framed.'\r\n"
    "        : 'Nothing to print yet. Craft something first and it will appear here.';\r\n"
    "    }\r\n",

    "    /* Only what was sent. */\r\n"
    "    var list = PIECES.filter(function(p){\r\n"
    "      return p.art && !p.crafting && PS_SENT[p.id];\r\n"
    "    });\r\n"
    "    /* A count of pieces the customer already knows they have told them\r\n"
    "       nothing. Say what to do instead. */\r\n"
    "    if (n) n.textContent = '';\r\n"
    "    if (say){\r\n"
    "      say.textContent = list.length\r\n"
    "        ? 'Choose a piece, a size, and how it should be framed.'\r\n"
    "        : 'Nothing here yet. Send a piece over from My Collection and it ' +\r\n"
    "          'will be waiting for you.';\r\n"
    "    }\r\n",
    'wall list',
)

# every door into the shop sends what it was pointing at
doc = rep(
    doc,
    "  if (mcPrint) mcPrint.addEventListener('click', function(){\r\n"
    "    var picked = PIECES.filter(function(p){ return PICKED[p.id] && printable(p); });\r\n"
    "    if (picked.length === 1){ PS_PIECE = picked[0]; PS_OPT = 0; }\r\n",

    "  if (mcPrint) mcPrint.addEventListener('click', function(){\r\n"
    "    var picked = PIECES.filter(function(p){ return PICKED[p.id] && printable(p); });\r\n"
    "    sendToPrintShop(picked);\r\n"
    "    if (picked.length === 1){ PS_PIECE = picked[0]; PS_OPT = 0; }\r\n",
    'bulk send',
)

doc = rep(
    doc,
    "      var piece = lbList()[LB_AT];\r\n"
    "      if (printable(piece)){ PS_PIECE = piece; PS_OPT = 0; }\r\n",
    "      var piece = lbList()[LB_AT];\r\n"
    "      sendToPrintShop([piece]);\r\n"
    "      if (printable(piece)){ PS_PIECE = piece; PS_OPT = 0; }\r\n",
    'lightbox send',
)

doc = rep(
    doc,
    "        var one = featuredPiece();\r\n"
    "        if (one && printable(one)){ PS_PIECE = one; PS_OPT = 0; }\r\n",
    "        var one = featuredPiece();\r\n"
    "        sendToPrintShop([one]);\r\n"
    "        if (one && printable(one)){ PS_PIECE = one; PS_OPT = 0; }\r\n",
    'featured send',
)

# ── 5 · room under the button, and a header that says what to do ───────────

doc = rep(
    doc,
    "      '<button class=\"ps-add\" id=\"psAdd\" type=\"button\">Add to your order</button>';\r\n",
    "      '<button class=\"ps-add\" id=\"psAdd\" type=\"button\">Add to your order</button>' +\r\n"
    "      /* Space held for a line about the goods — \"archival papers,\r\n"
    "         museum-grade inks\". Those are claims about manufacturing and I do\r\n"
    "         not know which are true of Prodigi's Enhanced Matte Art. Someone\r\n"
    "         who knows what the goods are writes it. */\r\n"
    "      '<div class=\"ps-made\" id=\"psMade\"></div>';\r\n",
    'made block',
)

doc = rep(
    doc,
    ".ps-add:disabled{ opacity:.45; cursor:default }\n",
    ".ps-add:disabled{ opacity:.45; cursor:default }\n"
    "/* Empty until there is something true to put in it. */\n"
    ".ps-made{ margin-top:1.2em }\n"
    ".ps-made:empty{ display:none }\n",
    'made css',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# only what was sent
if 'var PS_SENT' not in doc:
    die('the shop still shows everything')
if 'PS_SENT[p.id];' not in doc:
    die('the wall does not filter by what was sent')
# One declaration and three doors: the multi-select bar, the lightbox, and
# the featured piece.
if doc.count('function sendToPrintShop(') != 1:
    die('sendToPrintShop is not declared exactly once')
if doc.count('sendToPrintShop([') + doc.count('sendToPrintShop(picked)') != 3:
    die('the three doors into the shop do not all send the piece')
if 'Send a piece over from My Collection' not in doc:
    die('an empty shop does not say how to fill it')

# Rich's measurements, exactly
if 'margin:30px 30px 20px 30px;' not in doc:
    die('the body margin is not what Rich set')
if 'gap:4rem;' not in doc:
    die('the gap is not what Rich set')
if 'width:35%; flex:0 0 auto; align-self:flex-start;' not in doc:
    die('the panel is not 35% and sizing to content')

# the art
if 'grid-template-columns:repeat(4, minmax(0,1fr));' not in doc:
    die('the wall is not four columns')
if '.ps-pc{ aspect-ratio:1 }' not in doc:
    die('the tile is not square')
if '.ps-pc .nm{ display:none }' not in doc:
    die('every tile still carries a label')
if 'box-shadow:0 0 0 2px var(--oxblood)' not in doc:
    die('the chosen tile has no presence')

# the count is gone
if "n.textContent = list.length + (list.length === 1 ? ' PIECE'" in doc:
    die('the header still counts pieces')

# declared above its readers
at = probe.index('var PS_SENT')
for m in re.finditer(r'\bPS_SENT\b', probe):
    if m.start() < at:
        die('PS_SENT is read above its declaration')

for sel in ('.ps-made{', '.ps-made:empty{'):
    if sel not in doc:
        die('no rule for %s' % sel)

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

print('GATE PASSED · the shop shows what was sent to it · four square columns'
      ' · %d routes' % routes)
print('wrote ' + OUT)
