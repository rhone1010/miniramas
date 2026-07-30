#!/usr/bin/env python3
"""
BUILD s68 -> s69   three from Rich on the glass
CUI V23 · 2026-07-29

1 · THE CHECK IS SMALLER — 1.55rem -> 1.2rem, as sent.

    Rich's paste struck three lines: background, color:transparent, opacity:0.
    All three are exactly the properties `.piece.is-picked .piece__pick`
    overrides — that rule sets background to gold, color to #3a2a12, and the
    hover/picked rule sets opacity:1. So DevTools was showing a TICKED check
    and reporting the at-rest declarations as beaten.

    Read as overrides, not deletions. They are kept. Deleting them would make
    every check permanently visible and permanently gold, which is the
    opposite of the "does not shout at someone who came to look" behaviour
    accepted in s68. Flagged to Rich rather than assumed silently.

2 · VIEW ALL GETS THE FEATURED TOO.
    s68 gave View All a flat grid, harvested from r81's renderAllGrid().
    Ruled otherwise: every mode is featured + minimap. So the flat-grid branch
    goes, and with it .mc-allgrid.

    One consequence worth having: the minis carry no caption (the featured
    panel says the name), and View All was the only place a caption showed.
    So the long-name crowding visible in Rich's first screenshot disappears
    from the small tiles entirely, and change 3 handles the large one.

3 · THE FEATURED NAME IS SMALLER — 1.55rem -> 1.3rem, as sent.
    'Portraits - Charcoal & Chalk - Rich - 004' is four segments and a long
    effect name. The silent auto-naming format is fixed, so the type gives way.
"""

import re, sys, subprocess, os, json, tempfile

SRC = "/home/claude/litenco-stage-2026-07-29-s68.html"
OUT = "/home/claude/litenco-stage-2026-07-29-s69.html"

src = open(SRC, encoding="utf-8").read()

# ══════════════════════════════════════════════════════════════════
# 1 · the check, smaller
# ══════════════════════════════════════════════════════════════════

PICK_OLD = """  width:1.55rem; height:1.55rem;
  border:1px solid rgba(243,237,225,.7); border-radius:50%;"""
PICK_NEW = """  width:1.2rem; height:1.2rem;
  border:1px solid rgba(243,237,225,.7); border-radius:50%;"""

# ══════════════════════════════════════════════════════════════════
# 2 · the featured name, smaller
# ══════════════════════════════════════════════════════════════════

NAME_OLD = """.mc-feat__nm{
  font-family:var(--serif); font-style:italic; font-size:1.55rem; line-height:1.2;
}"""
NAME_NEW = """.mc-feat__nm{
  font-family:var(--serif); font-style:italic; font-size:1.3rem; line-height:1.2;
}"""

# ══════════════════════════════════════════════════════════════════
# 3 · View All gains the featured — the flat grid goes
# ══════════════════════════════════════════════════════════════════

ALLCSS_OLD = """/* View All — flat, every piece equal */
.mc-allgrid{
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(clamp(130px,9.5vw,190px),1fr));
  gap:clamp(10px,.8vw,16px);
  align-content:start;   /* never center: with overflow, centred rows overlap */
}

/* a Series — the featured piece, and the small ones that drive it */"""

ALLCSS_NEW = """/* Every mode is featured + minimap, View All included. r81 gave View All a
   flat grid; ruled otherwise — the featured panel is how a piece is read, and
   there is no mode where that stops being true. */"""

RENDER_OLD = """    } else if (MC_FILT === 'all'){
      /* View All — everything the same size, nothing featured. */
      var g = document.createElement('div');
      g.className = 'mc-allgrid';
      list.forEach(function(p){ g.appendChild(pieceTile(p)); });
      mcGrid.appendChild(g);
    } else {
      /* a Series — one large, the rest small and driving it. */"""

RENDER_NEW = """    } else {
      /* One large, the rest small and driving it — in every mode, View All
         included. The minimap is the grid the in-progress tile holds space in. */"""

# with no flat grid, every tile is a mini and every click sets the featured
CLICK_OLD = """      var tile = e.target.closest('.piece');
      if (!tile || tile.classList.contains('is-crafting')) return;
      /* In a Series, a mini chooses what to show large. In View All there is
         nothing to feed, so the tile opens straight into the lightbox. */
      if (tile.closest('.mc-minimap')) setFeatured(tile.dataset.piece);
      else openLightbox(tile.dataset.piece);
    });
    mcGrid.addEventListener('keydown', function(e){
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var tile = e.target.closest('.piece');
      if (!tile || tile.classList.contains('is-crafting')) return;
      e.preventDefault();
      if (tile.closest('.mc-minimap')) setFeatured(tile.dataset.piece);
      else openLightbox(tile.dataset.piece);
    });"""

CLICK_NEW = """      var tile = e.target.closest('.piece');
      if (!tile || tile.classList.contains('is-crafting')) return;
      /* A mini chooses what to show large. The featured panel is the only
         thing that opens the lightbox — choosing and looking stay separate. */
      setFeatured(tile.dataset.piece);
    });
    mcGrid.addEventListener('keydown', function(e){
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var tile = e.target.closest('.piece');
      if (!tile || tile.classList.contains('is-crafting')) return;
      e.preventDefault();
      setFeatured(tile.dataset.piece);
    });"""

# the caption-hiding rule was scoped to .mc-minimap and still is — but say why
CAP_OLD = """/* On a mini the caption is noise — the featured panel says the name. It stays
   for View All, where nothing else does. */
.mc-minimap .piece__body,
.mc-minimap .piece__veil{ display:none }"""

CAP_NEW = """/* On a mini the caption is noise — the featured panel says the name, and four
   segments of an auto-generated name will not fit a 160px square without
   crowding the image it is captioning. */
.mc-minimap .piece__body,
.mc-minimap .piece__veil{ display:none }"""

EDITS = [
    ("check size",  PICK_OLD,   PICK_NEW),
    ("feat name",   NAME_OLD,   NAME_NEW),
    ("allgrid css", ALLCSS_OLD, ALLCSS_NEW),
    ("render",      RENDER_OLD, RENDER_NEW),
    ("click",       CLICK_OLD,  CLICK_NEW),
    ("caption why", CAP_OLD,    CAP_NEW),
]

def count_ids(s):   return len(set(re.findall(r'id="([^"]*)"', s)))
def count_fetch(s): return len(re.findall(r'\bfetch\s*\(', s))
def count_fns(s):   return len(re.findall(r'^\s*(?:async\s+)?function\s+[A-Za-z_$]', s, re.M))
def count_faces(s): return len(re.findall(r'class="face face--', s))

before = dict(ids=count_ids(src), fetch=count_fetch(src), fns=count_fns(src),
              faces=count_faces(src))

for name, old, new in EDITS:
    n = src.count(old)
    assert n == 1, f"anchor '{name}' found {n} times, expected 1"

out = src
for name, old, new in EDITS:
    out = out.replace(old, new, 1)

after = dict(ids=count_ids(out), fetch=count_fetch(out), fns=count_fns(out),
             faces=count_faces(out))

fails = []

if after["fetch"] != 0: fails.append(f"FETCH: found {after['fetch']}")
if after["faces"] != 3: fails.append(f"FACES: {after['faces']}")
if after["fns"] < before["fns"]: fails.append(f"FNS: lost, {before['fns']} -> {after['fns']}")

MUST = [
    "width:1.2rem; height:1.2rem;",
    "font-size:1.3rem; line-height:1.2;",
    "setFeatured(tile.dataset.piece);",
]
for m in MUST:
    if m not in out:
        fails.append(f"MUST-EXIST: {m}")

# the three struck properties are OVERRIDES and must survive
seg = re.search(r'\.piece__pick\{(.*?)\}', out, re.S).group(1)
for keep in ("background:rgba(20,16,13,.5)", "color:transparent", "opacity:0"):
    if keep not in seg:
        fails.append(f"OVERRIDE MISREAD: {keep} was struck in DevTools as beaten by "
                     f".is-picked, not disabled — it must survive")
# and the rule that beats them must still be there
if ".piece:hover .piece__pick, .piece.is-picked .piece__pick{ opacity:1 }" not in out:
    fails.append("MUST-EXIST: the hover/picked rule that reveals the check")

# the flat grid is gone, in CSS and in JS
if ".mc-allgrid" in out:
    fails.append("VIEW ALL: .mc-allgrid survived — every mode is featured + minimap")
if "MC_FILT === 'all'" in out.split('MY COLLECTION')[-1].split('function renderCollection')[-1][:2000]:
    fails.append("VIEW ALL: renderCollection still branches on the filter")

# no tile may open the lightbox directly any more
if re.search(r"tile\.dataset\.piece\);\s*\n\s*else openLightbox", out):
    fails.append("INTERACTION: a tile must set the featured, never open the lightbox")
# the featured still does
if "if (FEAT) openLightbox(FEAT)" not in out:
    fails.append("MUST-EXIST: the featured panel opens the lightbox")

if out.find("function flash") > out.find("function renderCollection"):
    fails.append("TDZ: flash() must stay above renderCollection")

for bad in ("Museum-grade", "sculpt", "Sculpt", "sculpture", "In-Situ", "In Situ"):
    if bad in out:
        fails.append(f"POSITIONING: '{bad}' must not appear")

for v in re.findall(r'border-radius:\s*(\d+)px', out):
    if 13 < int(v) < 99:
        fails.append(f"RADIUS: {v}px is neither a card curve nor a pill")

for sm in re.findall(r'<style[^>]*>(.*?)</style>', out, re.S):
    if sm.count("{") != sm.count("}"):
        fails.append(f"BRACE: unbalanced {sm.count('{')} vs {sm.count('}')}")

for i, sm in enumerate(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', out, re.S)):
    if not sm.strip(): continue
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as fh:
        fh.write(sm); p = fh.name
    r = subprocess.run(["node", "--check", p], capture_output=True, text=True)
    os.unlink(p)
    if r.returncode != 0:
        fails.append(f"NODE --CHECK: block {i} — {r.stderr.strip().splitlines()[0]}")

# ── BOOT GATE ─────────────────────────────────────────────────────
BOOT = r"""
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push(e.message.split('\n')[0]));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
const dom = new JSDOM(fs.readFileSync(process.argv[2], 'utf8'), {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
});
setTimeout(() => {
  const w = dom.window, d = w.document;
  const q = s => d.querySelectorAll(s).length;
  const a = {};
  try {
    a.verb = (d.getElementById('tbcGoVerb')||{}).textContent;
    a.silos = q('.face--silos .silo-card'); a.faces = q('.face');
    w.__showCollection();
    a.featDefault = q('#mcFeat');
    a.minisDefault = q('#mcMini .piece');
    // View All must ALSO be featured + minimap now
    [...d.querySelectorAll('#mcFilters .mc-filter')].find(b => b.dataset.filter === 'all').click();
    a.featAll   = q('#mcFeat');
    a.minisAll  = q('#mcMini .piece');
    a.noFlatGrid = q('.mc-allgrid');
    a.featNameAll = (d.querySelector('.mc-feat__nm')||{}).textContent;
    a.actsAll   = q('.mc-acts .mc-act');
    // a tile sets the featured and does NOT open the lightbox
    const t = [...d.querySelectorAll('#mcMini .piece:not(.is-crafting)')][3];
    t.click();
    a.lboxAfterTile = d.getElementById('lbox').classList.contains('is-open');
    a.featAfterTile = (d.querySelector('.mc-feat__nm')||{}).textContent;
    a.onCount = q('#mcMini .piece.is-on');
    // the featured does
    d.getElementById('mcFeat').click();
    a.lboxAfterFeat = d.getElementById('lbox').classList.contains('is-open');
    d.getElementById('lboxX').click();
    // the check is hidden at rest and revealed when ticked
    const chk = d.querySelector('#mcMini .piece:not(.is-crafting) [data-pick]');
    a.pickAtRest = w.getComputedStyle(chk).opacity;
    chk.click();
    a.pickWhenOn = w.getComputedStyle(chk).opacity;
    a.bulkUp = d.getElementById('mcBulk').classList.contains('is-up');
  } catch (e) { a.error = e.message + ' @ ' + (e.stack||'').split('\n')[1]; }
  console.log(JSON.stringify({ errors, a }));
}, 800);
"""
hp, hj = "/home/claude/.gate-boot.html", "/home/claude/.gate-boot.js"
open(hp, "w", encoding="utf-8").write(out)
open(hj, "w", encoding="utf-8").write(BOOT)
boot = subprocess.run(["node", hj, hp], capture_output=True, text=True, cwd="/home/claude")

rep = None
ln = [l for l in boot.stdout.splitlines() if l.startswith("{")]
if not ln:
    fails.append(f"BOOT GATE: no report — {boot.stderr.strip()[:250]}")
else:
    rep = json.loads(ln[-1]); a = rep["a"]
    for e in rep["errors"]: fails.append(f"BOOT ERROR: {e}")
    if a.get("error"):             fails.append(f"BOOT DRIVE: {a['error']}")
    if a.get("verb") != "Next":    fails.append(f"BOOT: verb {a.get('verb')!r}")
    if a.get("silos") != 8:        fails.append(f"BOOT: silos {a.get('silos')}")
    if a.get("faces") != 3:        fails.append(f"BOOT: faces {a.get('faces')}")
    if a.get("featDefault") != 1:  fails.append("BOOT: no featured in the default mode")
    if a.get("featAll") != 1:      fails.append("BOOT: View All has no featured panel")
    if a.get("minisAll") != 5:     fails.append(f"BOOT: View All minis {a.get('minisAll')}")
    if a.get("noFlatGrid") != 0:   fails.append("BOOT: the flat grid survived into View All")
    if a.get("actsAll") != 2:      fails.append(f"BOOT: View All actions {a.get('actsAll')}")
    if a.get("lboxAfterTile"):     fails.append("BOOT: a tile opened the lightbox — it must only set the featured")
    if a.get("featAfterTile") == a.get("featNameAll"):
        fails.append("BOOT: the featured did not change on a tile click")
    if a.get("onCount") != 1:      fails.append(f"BOOT: is-on count {a.get('onCount')}")
    if not a.get("lboxAfterFeat"): fails.append("BOOT: the featured did not open the lightbox")
    if a.get("pickAtRest") not in ("0", 0):
        fails.append(f"BOOT: the check must be invisible at rest, opacity={a.get('pickAtRest')!r}")
    if a.get("pickWhenOn") not in ("1", 1):
        fails.append(f"BOOT: the check must show when ticked, opacity={a.get('pickWhenOn')!r}")
    if not a.get("bulkUp"):        fails.append("BOOT: bulk bar did not rise")

print("BUILD s68 -> s69   smaller check, featured everywhere, smaller name")
print("-" * 60)
for k in ("ids", "fetch", "fns", "faces"):
    print(f"  {k:<7} {before[k]:>6}  ->  {after[k]:>6}")
if rep:
    a = rep["a"]
    print("-" * 60)
    print(f"  boot errors      {len(rep['errors'])}")
    print(f"  default          feat={a.get('featDefault')} minis={a.get('minisDefault')}")
    print(f"  View All         feat={a.get('featAll')} minis={a.get('minisAll')} flatgrid={a.get('noFlatGrid')}")
    print(f"  tile -> lbox     {a.get('lboxAfterTile')}  (must be False)")
    print(f"  feat -> lbox     {a.get('lboxAfterFeat')}")
    print(f"  check opacity    rest={a.get('pickAtRest')!r} ticked={a.get('pickWhenOn')!r}")
print("-" * 60)

if fails:
    print("GATE FAILED — nothing written")
    for f_ in fails: print("  x " + f_)
    sys.exit(1)

open(OUT, "w", encoding="utf-8").write(out)
print("GATE PASSED")
print(f"written: {OUT}")
