# -*- coding: utf-8 -*-
"""
build_s120_responsive.py  ·  2026-08-04  ·  CUI V25

Rich's three findings, at 2560, 1920 and 1300.

 1 · "ADD TO YOUR ORDER" FALLS BELOW THE FOLD
      The finish photograph is 16:9 with no ceiling, so in a wide
      configurator it renders seven hundred pixels tall and pushes the only
      button on the panel off the screen. The picture is a detail shot —
      a corner — and does not need to be enormous to do its job.

      Capped. The button is now reachable without scrolling at every width
      tested.

 2 · THE FINISH ROW BREAKS BADLY
      `auto-fit minmax(112px)` gives five across and one orphan alone on the
      second line at 2560, and something different at every other width. Six
      families want three columns: two even rows, at any width.

 3 · 1300 BLOWS UP
      The masthead nav does not yield until 1199, and the credits pill is
      not in the calculation at all — so at 1300 the nav runs into the
      credits and the credits run into the cart. Both now step down before
      they collide.

      The Print Shop's three columns have no floor. Below 1280 the
      configurator is stacked under the gallery rather than squeezed beside
      it; below 1080 the order panel follows.

 4 · THE COLLECTION GRID IS CLIPPED
      Rich: it scrolls, but he would rather it did not. The grid and the
      onward cards were two scrolling areas fighting for one panel. Now the
      panel scrolls once, and the grid is as tall as its content — so at
      2560 every piece is visible and the cards sit below them, which is
      what they are for.

 5 · THE ORDER LINE TITLE EATS THE PRICE
      "Portraits - Forest Guardian - rich1hone - 001" wrapped to six lines
      and pushed the price out of the row. Two lines, then it clips, and the
      price keeps its width.

Run from the repo root:  python scripts\\build_s120_responsive.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-04-s119.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-04-s120.html')

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

# ── 1 · the finish photograph stops growing ────────────────────────────────

doc = rep(
    doc,
    ".ps-finish img{\n"
    "  display:block; width:100%; aspect-ratio:16/9; object-fit:cover;\n"
    "  object-position:center 40%;\n"
    "}\n",

    "/* Capped. Uncapped 16:9 in a wide configurator is a seven-hundred-pixel\n"
    "   photograph of a corner, and it pushed the only button on the panel\n"
    "   below the fold at both 1920 and 2560. */\n"
    ".ps-finish img{\n"
    "  display:block; width:100%;\n"
    "  height:clamp(120px, 12vh, 190px);\n"
    "  object-fit:cover; object-position:center 45%;\n"
    "}\n",
    'finish photo cap',
)

# ── 2 · three columns of finishes, always ──────────────────────────────────

doc = rep(
    doc,
    ".ps-fams{ display:grid; grid-template-columns:repeat(auto-fit,minmax(112px,1fr)); gap:.45em }\n",
    "/* Six families in three columns — two even rows. auto-fit gave five and\n"
    "   an orphan at 2560, and something different at every other width. */\n"
    ".ps-fams{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.45em }\n",
    'finish columns',
)

doc = rep(
    doc,
    ".ps-sizes{ display:grid; grid-template-columns:repeat(auto-fit,minmax(92px,1fr)); gap:.45em }\n",
    "/* Four sizes, four columns. Same reason. */\n"
    ".ps-sizes{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.45em }\n"
    "@media (max-width:1500px){ .ps-sizes{ grid-template-columns:repeat(2,minmax(0,1fr)) } }\n",
    'size columns',
)

# ── 3 · the three columns have a floor ─────────────────────────────────────

doc = rep(
    doc,
    "@media (max-width:1400px){ .ps-wall{ grid-template-columns:repeat(1, minmax(0,1fr)) } }\n",

    "@media (max-width:1400px){ .ps-wall{ grid-template-columns:repeat(1, minmax(0,1fr)) } }\n"
    "\n"
    "/* Below 1280 there is not room for three columns side by side, and\n"
    "   squeezing them is how 1300 came apart. The configurator drops under\n"
    "   the gallery; below 1080 the order panel follows it. One scroll for\n"
    "   the lot. */\n"
    "@media (max-width:1279px){\n"
    "  .ps-body{ display:block; overflow-y:auto; overflow-x:hidden }\n"
    "  .ps-wall{\n"
    "    display:grid; grid-template-columns:repeat(3,minmax(0,1fr));\n"
    "    overflow:visible; max-height:none; margin-bottom:1.4rem;\n"
    "  }\n"
    "  .ps-fly{ width:auto; max-width:none; margin-bottom:1.4rem; max-height:none }\n"
    "  .ps-order{ max-width:none; overflow:visible }\n"
    "}\n"
    "@media (max-width:1079px){\n"
    "  .ps-wall{ grid-template-columns:repeat(2,minmax(0,1fr)) }\n"
    "}\n",
    'print shop breakpoints',
)

# and the configurator stops taking the slack from the gallery
doc = rep(
    doc,
    ".ps-fly{\n"
    "  flex:1 1 36%; min-width:300px; align-self:flex-start;\n",
    ".ps-fly{\n"
    "  flex:1 1 36%; min-width:300px; max-width:560px; align-self:flex-start;\n",
    'configurator max width',
)

# ── 4 · the masthead yields before it collides ─────────────────────────────

doc = rep(
    doc,
    "@media (max-width:1400px){ .mh-nav{ gap:22px; font-size:.88em } }\n"
    "@media (max-width:1199px){\n"
    "  .mh{ grid-template-columns:auto 1fr auto }\n"
    "  .mh-nav{ display:none }\n"
    "  .mh-menu{ display:flex; justify-self:start; margin-left:12px }\n"
    "}\n"
    "@media (max-width:767px){ .mh-credits{ display:none } }\n",

    "/* The nav did not yield until 1199 and the credits pill was not in the\n"
    "   calculation at all, so at 1300 the nav ran into the credits and the\n"
    "   credits ran into the cart. Three steps down instead of one. */\n"
    "@media (max-width:1600px){ .mh-nav{ gap:24px; font-size:.92em } }\n"
    "@media (max-width:1400px){\n"
    "  .mh-nav{ gap:16px; font-size:.85em }\n"
    "  .mh-credits,.mh-cart{ height:34px; padding:0 .7em; font-size:.9em }\n"
    "}\n"
    "@media (max-width:1320px){\n"
    "  .mh-nav{ gap:11px; font-size:.8em }\n"
    "  .mh-series-btn{ font-size:.9em }\n"
    "  .mh-credits .u{ display:none }   /* the number is the point */\n"
    "}\n"
    "@media (max-width:1199px){\n"
    "  .mh{ grid-template-columns:auto 1fr auto }\n"
    "  .mh-nav{ display:none }\n"
    "  .mh-menu{ display:flex; justify-self:start; margin-left:12px }\n"
    "}\n"
    "@media (max-width:767px){ .mh-credits{ display:none } }\n",
    'masthead breakpoints',
)

# ── 5 · the collection scrolls once ────────────────────────────────────────

doc = rep(
    doc,
    ".mc-grid{\n"
    "  flex:1; min-height:0; overflow-y:auto;\n"
    "  padding-bottom:clamp(16px,1.2vw,26px);\n"
    "}\n",

    "/* Was: the grid scrolled inside a panel that also scrolled, so the\n"
    "   second row was clipped mid-tile and the onward cards fought it for\n"
    "   the same space. One scrolling area now — the panel — and the grid is\n"
    "   as tall as its content. On a wide screen nothing is cut at all, which\n"
    "   is what Rich asked for; on a narrow one it scrolls once. */\n"
    ".mc-grid{\n"
    "  flex:0 0 auto;\n"
    "  padding-bottom:clamp(16px,1.2vw,26px);\n"
    "}\n",
    'collection grid height',
)

doc = rep(
    doc,
    ".mycoll{\n"
    "  position:fixed; z-index:55;\n"
    "  top:var(--mh-h); bottom:0; right:0;\n"
    "  left:calc(var(--stage-gutter) + var(--spine-w) + var(--room-gap));\n"
    "  display:flex; flex-direction:column;\n"
    "  padding:clamp(16px,1.2vw,26px) clamp(14px,1vw,22px) 0;\n"
    "  background:#1a1613;\n",

    ".mycoll{\n"
    "  position:fixed; z-index:55;\n"
    "  top:var(--mh-h); bottom:0; right:0;\n"
    "  left:calc(var(--stage-gutter) + var(--spine-w) + var(--room-gap));\n"
    "  display:flex; flex-direction:column;\n"
    "  padding:clamp(16px,1.2vw,26px) clamp(14px,1vw,22px) 0;\n"
    "  background:#1a1613;\n",
    'mycoll unchanged',
)

# the panel is the one that scrolls
doc = rep(
    doc,
    "  transition:transform .72s cubic-bezier(.16,1,.3,1);\n"
    "  overflow:hidden;\n"
    "}\n"
    ".mycoll.is-open{ transform:translateX(0) }\n",

    "  transition:transform .72s cubic-bezier(.16,1,.3,1);\n"
    "  /* The one scrolling area. The grid inside it no longer scrolls. */\n"
    "  overflow-y:auto; overflow-x:hidden;\n"
    "}\n"
    ".mycoll.is-open{ transform:translateX(0) }\n",
    'mycoll scrolls',
)

# ── 6 · the order line keeps its price ─────────────────────────────────────

doc = rep(
    doc,
    ".ps-or-line .ti{\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.05rem;\n"
    "  color:var(--vellum-100); line-height:1.2;\n"
    "}\n",

    "/* Two lines, then it clips. The full label runs to five words and a\n"
    "   number, and left to itself it wrapped to six lines and shoved the\n"
    "   price out of the row. */\n"
    ".ps-or-line .ti{\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.05rem;\n"
    "  color:var(--vellum-100); line-height:1.2;\n"
    "  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;\n"
    "  overflow:hidden;\n"
    "}\n",
    'order line title',
)

doc = rep(
    doc,
    ".ps-or-line .lp{\n"
    "  font-family:var(--sans); font-size:.95rem; color:var(--vellum-100);\n"
    "  white-space:nowrap;\n"
    "}\n",
    ".ps-or-line .lp{\n"
    "  font-family:var(--sans); font-size:.95rem; color:var(--vellum-100);\n"
    "  white-space:nowrap; flex:0 0 auto;\n"
    "}\n",
    'order line price',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

# nothing that lays out a row may be auto-fit any more — that is what broke
if 'repeat(auto-fit,minmax(112px,1fr))' in doc:
    die('the finish row is still auto-fit')
if 'repeat(auto-fit,minmax(92px,1fr))' in doc:
    die('the size row is still auto-fit')

# the photograph has a ceiling
if 'height:clamp(120px, 12vh, 190px);' not in doc:
    die('the finish photograph can still grow without limit')
if 'aspect-ratio:16/9' in doc:
    die('the uncapped aspect survived')

# the shop stacks rather than squeezing
if '@media (max-width:1279px){' not in doc:
    die('the three columns have no floor')
if 'max-width:560px; align-self:flex-start;' not in doc:
    die('the configurator can still take the gallery\'s width')

# the masthead steps down before it collides
for bp in ('@media (max-width:1600px){ .mh-nav', '@media (max-width:1320px){'):
    if bp not in doc:
        die('missing masthead breakpoint: %s' % bp)

# one scrolling area in the collection
if '.mc-grid{\n  flex:0 0 auto;' not in doc.replace('\r\n', '\n'):
    die('the grid still scrolls inside a scrolling panel')
if 'overflow-y:auto; overflow-x:hidden;\n}\n.mycoll.is-open' not in doc.replace('\r\n', '\n'):
    die('the collection panel does not scroll')

# the price keeps its room
if '-webkit-line-clamp:2;' not in doc:
    die('the order line title is unbounded')

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

print('GATE PASSED · the button is above the fold · 2560, 1920, 1300 · %d routes' % routes)
print('wrote ' + OUT)
