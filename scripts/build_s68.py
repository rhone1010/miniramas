#!/usr/bin/env python3
"""
BUILD s67 -> s68   the featured piece, and the shadow off the Curator
CUI V23 · 2026-07-29 · ruled by Rich in session

WHAT I GOT WRONG IN s67
  Rich said "grid", and in-progress pieces "hold their space with animation in
  the grid until they land". I took that literally, built a flat grid, and wrote
  in the s67 header that r81's featured-plus-filmstrip layout was deliberately
  not ported. That was me overruling a harvest with an inference. The minimap
  IS the grid he meant — the in-progress tile holds its space there.

r81's COLLECTION IS TWO MODES. Read this day from
docs/SURFACES/portraits/litenco-portraits-2026-07-24-r81.html:

    a Series tab  ->  renderLatest()   featured + minimap
    View All      ->  renderAllGrid()  flat grid

  and within the featured mode:

    .coll-latest{ grid-template-columns: minmax(300px,380px) auto }
      .feat        the big one, 1:1. CLICKING IT opens the lightbox.
      .mini-col
        .minimap   repeat(3,160px), 4 above 2000px. Clicking a mini
                   SETS THE FEATURED — it does not open anything.
        .feat-acts Download / Send to Print Shop, always on the glass

  Three details I had missed and are now carried across:
   · both are 1:1, not the card ratio. A collected piece is square.
   · the featured mini carries .on — an oxblood outline, so you can see which
     of the small ones you are looking at large.
   · .mini-check is opacity:0 until hover or selected. The checks do not shout
     at someone who only came to look.

  And .fresh — a sage outline on anything crafted today, on both the featured
  and its mini. Carried, because 'which of these is new' is the first question
  someone asks on arrival.

CHANGE 2 · THE SHADOW OFF THE CURATOR
  .mycoll cast box-shadow:-1.2rem 0 3rem rgba(18,12,8,.4) leftward, and the
  only thing to its left is the Curator. The panel was darkening the one
  element it is meant to leave alone. A hairline and the panel's own ground
  are enough to read as in front.

DEFAULT ON ARRIVAL — my call, flagged
  The featured mode, not the flat grid, with the newest piece featured. We
  arrive here on the FIRST completion with others still rendering; showing
  that new piece large is the reason we came. View All stays as the way to see
  everything at once.
"""

import re, sys, subprocess, os, json, tempfile

SRC = "/home/claude/litenco-stage-2026-07-29-s67.html"
OUT = "/home/claude/litenco-stage-2026-07-29-s68.html"

src = open(SRC, encoding="utf-8").read()

# ══════════════════════════════════════════════════════════════════
# 1 · the shadow comes off
# ══════════════════════════════════════════════════════════════════

SHADOW_OLD = """  background:#1a1613;
  border-left:1px solid rgba(174,133,78,.2);
  box-shadow:-1.2rem 0 3rem rgba(18,12,8,.4);"""

SHADOW_NEW = """  background:#1a1613;
  /* A hairline, and nothing more. The shadow threw 3rem of dark leftward and
     the only thing to the left is the Curator — the panel was dimming the one
     element it exists to leave standing. */
  border-left:1px solid rgba(174,133,78,.26);"""

# ══════════════════════════════════════════════════════════════════
# 2 · CSS — featured + minimap replaces the flat-grid-for-everything
# ══════════════════════════════════════════════════════════════════

GRID_OLD = """/* ---- the grid --------------------------------------------------------- */
.mc-grid{
  flex:1; min-height:0; overflow-y:auto;
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(clamp(150px,11vw,215px),1fr));
  gap:clamp(10px,.8vw,16px);
  padding-bottom:clamp(16px,1.2vw,26px);
  align-content:start;   /* never center: with overflow, centred rows overlap */
}"""

GRID_NEW = """/* ---- the body · two modes --------------------------------------------- */
/* A Series shows one piece large with the rest small beside it. View All shows
   everything the same size. Both from r81; the featured mode is the one the
   customer lands in. */
.mc-grid{
  flex:1; min-height:0; overflow-y:auto;
  padding-bottom:clamp(16px,1.2vw,26px);
}

/* View All — flat, every piece equal */
.mc-allgrid{
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(clamp(130px,9.5vw,190px),1fr));
  gap:clamp(10px,.8vw,16px);
  align-content:start;   /* never center: with overflow, centred rows overlap */
}

/* a Series — the featured piece, and the small ones that drive it */
.mc-latest{
  display:grid;
  grid-template-columns:minmax(260px, clamp(300px,24vw,400px)) minmax(0,1fr);
  gap:clamp(14px,1.2vw,24px);
  align-items:start;
}
.mc-feat{
  position:relative; isolation:isolate; overflow:hidden;
  aspect-ratio:1;
  border:1px solid rgba(196,169,110,.24);
  border-radius:6px;
  background:#241c16;
  cursor:pointer;
}
.mc-feat img{
  position:absolute; inset:0; width:100%; height:100%;
  object-fit:cover; object-position:50% 18%;
}
.mc-feat.is-fresh{ outline:2px solid var(--sage, #7f8b6f); outline-offset:-2px }
.mc-feat__meta{
  position:absolute; z-index:2; left:0; right:0; bottom:0;
  padding:2.6em 1.2em 1em;
  background:linear-gradient(transparent, rgba(20,15,12,.84));
  color:#fff;
}
.mc-feat__nm{
  font-family:var(--serif); font-style:italic; font-size:1.55rem; line-height:1.2;
}
.mc-feat__fx{
  margin-top:.1em;
  font-family:var(--serif); font-style:italic; font-size:1.2rem;
  color:rgba(243,237,225,.85);
}
.mc-feat__hint{
  margin-top:.7em;
  font-family:var(--sans); font-size:.68rem; letter-spacing:.12em;
  text-transform:uppercase; color:rgba(243,237,225,.7);
}
.mc-col{ display:flex; flex-direction:column; gap:clamp(10px,.9vw,16px); min-width:0 }
.mc-minimap{
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(clamp(110px,8vw,160px),1fr));
  gap:clamp(8px,.6vw,12px);
  align-content:start;
}
/* The two actions stay on the glass whether or not anything is ticked — the
   bulk bar is for a selection, these are for the piece you are looking at. */
.mc-acts{ display:flex; flex-wrap:wrap; gap:.6em }

@media (max-width:1599px){
  .mc-latest{ grid-template-columns:minmax(230px, 30%) minmax(0,1fr) }
}
@media (max-width:1366px){
  .mc-latest{ grid-template-columns:1fr; gap:12px }
  .mc-feat{ max-width:320px }
}"""

# ── the piece becomes square, and the check stops shouting ─────────
PIECE_OLD = """.piece{
  position:relative; isolation:isolate; overflow:hidden;
  aspect-ratio:var(--card-ratio);
  border:1px solid rgba(88,65,42,.3);
  border-radius:clamp(.55rem,.55vw,.8rem);
  background:#241c16;
  cursor:pointer;
  transition:transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}"""

PIECE_NEW = """/* 1:1, not the card ratio. A finish on the floor is a portrait shape; a piece
   you own is a square in a collection. r81 had this right. */
.piece{
  position:relative; isolation:isolate; overflow:hidden;
  aspect-ratio:1;
  border:1px solid rgba(88,65,42,.3);
  border-radius:4px;
  background:#241c16;
  cursor:pointer;
  transition:transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}
/* the one being shown large */
.piece.is-on{ outline:2px solid var(--oxblood); outline-offset:-2px }
/* crafted today */
.piece.is-fresh{ outline:2px solid var(--sage, #7f8b6f); outline-offset:-2px }
.piece.is-fresh.is-on{ outline-color:var(--oxblood) }"""

CHECK_OLD = """.piece__pick{
  position:absolute; z-index:3; top:.5rem; left:.5rem;
  display:grid; place-items:center;
  width:1.7rem; height:1.7rem;
  border:1px solid rgba(243,237,225,.5); border-radius:50%;
  background:rgba(18,12,8,.5);
  font-family:var(--sans); font-size:.85rem; line-height:1;
  color:transparent;
  transition:background 150ms ease, color 150ms ease, border-color 150ms ease;
}
.piece:hover .piece__pick{ border-color:rgba(243,237,225,.8) }"""

CHECK_NEW = """/* Hidden until hover, or until it is ticked. Someone who came only to look
   should not be met by a row of checkboxes. */
.piece__pick{
  position:absolute; z-index:3; top:.4rem; right:.4rem;
  display:grid; place-items:center;
  width:1.55rem; height:1.55rem;
  border:1px solid rgba(243,237,225,.7); border-radius:50%;
  background:rgba(20,16,13,.5);
  font-family:var(--sans); font-size:.8rem; line-height:1;
  color:transparent; opacity:0;
  transition:background 150ms ease, color 150ms ease, opacity 150ms ease;
}
.piece:hover .piece__pick, .piece.is-picked .piece__pick{ opacity:1 }"""

# the name/series overlay is too much on a 1:1 mini — the featured carries it
BODY_OLD = """.piece__body{
  position:absolute; z-index:2; left:0; right:0; bottom:0;
  padding:.7em .8em;
}"""

BODY_NEW = """.piece__body{
  position:absolute; z-index:2; left:0; right:0; bottom:0;
  padding:.55em .65em;
}
/* On a mini the caption is noise — the featured panel says the name. It stays
   for View All, where nothing else does. */
.mc-minimap .piece__body,
.mc-minimap .piece__veil{ display:none }
.mc-minimap .piece.is-crafting .piece__body{ display:block }"""

# ══════════════════════════════════════════════════════════════════
# 3 · JS — two render modes, and the featured
# ══════════════════════════════════════════════════════════════════

RENDER_OLD = """  function renderCollection(){
    if (!mcGrid) return;
    var list = mcVisible();
    mcGrid.innerHTML = '';
    if (!list.length){
      var e = document.createElement('p');
      e.className = 'mc-empty';
      e.textContent = PIECES.length
        ? 'Nothing in this Series yet.'
        : 'Nothing crafted yet. What you make will be kept here.';
      mcGrid.appendChild(e);
    } else {
      list.forEach(function(p){ mcGrid.appendChild(pieceTile(p)); });
    }
    var done = PIECES.filter(function(p){ return !p.crafting; }).length;"""

RENDER_NEW = """  /* ---- the featured piece ---------------------------------------------
     Clicking a mini sets this. Clicking THIS opens the lightbox. Two
     different acts: choosing what to look at, and looking at it properly. */
  var FEAT = null;

  function setFeatured(id){
    var p = null;
    mcVisible().forEach(function(x){ if (x.id === id) p = x; });
    if (!p || p.crafting) return;
    FEAT = id;
    var box = document.getElementById('mcFeat');
    if (box){
      box.className = 'mc-feat' + (p.fresh ? ' is-fresh' : '');
      box.innerHTML =
        '<img src="' + esc(p.art) + '" alt="">' +
        '<div class="mc-feat__meta">' +
          '<div class="mc-feat__nm">' + esc(p.name) + '</div>' +
          '<div class="mc-feat__fx">' + esc(p.series) + (p.fresh ? ' \\u00b7 crafted today' : '') + '</div>' +
          '<div class="mc-feat__hint">Click to view full \\u2192</div>' +
        '</div>';
    }
    [].forEach.call(mcGrid.querySelectorAll('.mc-minimap .piece'), function(el){
      el.classList.toggle('is-on', el.dataset.piece === id);
    });
  }

  function renderCollection(){
    if (!mcGrid) return;
    var list = mcVisible();
    mcGrid.innerHTML = '';
    if (!list.length){
      var e = document.createElement('p');
      e.className = 'mc-empty';
      e.textContent = PIECES.length
        ? 'Nothing in this Series yet.'
        : 'Nothing crafted yet. What you make will be kept here.';
      mcGrid.appendChild(e);
    } else if (MC_FILT === 'all'){
      /* View All — everything the same size, nothing featured. */
      var g = document.createElement('div');
      g.className = 'mc-allgrid';
      list.forEach(function(p){ g.appendChild(pieceTile(p)); });
      mcGrid.appendChild(g);
    } else {
      /* a Series — one large, the rest small and driving it. */
      var wrap = document.createElement('div');
      wrap.className = 'mc-latest';
      wrap.innerHTML =
        '<div class="mc-feat" id="mcFeat"></div>' +
        '<div class="mc-col">' +
          '<div class="mc-minimap" id="mcMini"></div>' +
          '<div class="mc-acts">' +
            '<button class="mc-act is-fill" id="mcDl1" type="button">Download</button>' +
            '<button class="mc-act" id="mcPr1" type="button">Send to Print Shop</button>' +
          '</div>' +
        '</div>';
      mcGrid.appendChild(wrap);
      var mini = wrap.querySelector('#mcMini');
      list.forEach(function(p){ mini.appendChild(pieceTile(p)); });

      var first = null;
      list.forEach(function(p){ if (!first && !p.crafting) first = p; });
      var keep = null;
      list.forEach(function(p){ if (p.id === FEAT && !p.crafting) keep = p; });
      if (keep || first) setFeatured((keep || first).id);

      var f = wrap.querySelector('#mcFeat');
      if (f) f.addEventListener('click', function(){ if (FEAT) openLightbox(FEAT); });
      var d1 = wrap.querySelector('#mcDl1'), p1 = wrap.querySelector('#mcPr1');
      if (d1) d1.addEventListener('click', function(){ flash(d1, 'Downloading \\u2713', 'Download'); });
      if (p1) p1.addEventListener('click', function(){ flash(p1, 'Sent to the Print Shop \\u2713', 'Send to Print Shop'); });
    }
    var done = PIECES.filter(function(p){ return !p.crafting; }).length;"""

# a mini click sets the featured; only View All opens the lightbox directly
CLICK_OLD = """      var tile = e.target.closest('.piece');
      if (tile && !tile.classList.contains('is-crafting')) openLightbox(tile.dataset.piece);
    });
    mcGrid.addEventListener('keydown', function(e){
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var tile = e.target.closest('.piece');
      if (tile && !tile.classList.contains('is-crafting')){ e.preventDefault(); openLightbox(tile.dataset.piece); }
    });"""

CLICK_NEW = """      var tile = e.target.closest('.piece');
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

# the fresh outline needs the flag on a tile
TILE_OLD = """    a.className = 'piece' + (p.crafting ? ' is-crafting' : '') + (PICKED[p.id] ? ' is-picked' : '');"""
TILE_NEW = """    a.className = 'piece'
      + (p.crafting ? ' is-crafting' : '')
      + (p.fresh    ? ' is-fresh'    : '')
      + (PICKED[p.id] ? ' is-picked' : '');"""

# default filter: the featured mode, not the flat grid
FILT_OLD = """  var MC_FILT = 'all';"""
FILT_NEW = """  /* We arrive here on the FIRST completion with others still rendering, so the
     default is the featured mode showing that new piece — not a flat grid.
     View All remains the way to see everything at once. */
  var MC_FILT = 'Portraits';"""

# flash() is used by renderCollection now, so it must be declared above it
FLASH_OLD = """  function flash(btn, said, back){
    btn.textContent = said;
    setTimeout(function(){ btn.textContent = back; }, 1600);
  }
"""
FLASH_MOVE_TO = """  function mcVisible(){"""

EDITS = [
    ("shadow",      SHADOW_OLD, SHADOW_NEW),
    ("grid css",    GRID_OLD,   GRID_NEW),
    ("piece css",   PIECE_OLD,  PIECE_NEW),
    ("check css",   CHECK_OLD,  CHECK_NEW),
    ("body css",    BODY_OLD,   BODY_NEW),
    ("default filt",FILT_OLD,   FILT_NEW),
    ("tile class",  TILE_OLD,   TILE_NEW),
    ("render",      RENDER_OLD, RENDER_NEW),
    ("click",       CLICK_OLD,  CLICK_NEW),
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

# hoist flash() above renderCollection — it is called from there now
assert out.count(FLASH_OLD) == 1, "flash() anchor not unique"
out = out.replace(FLASH_OLD, "", 1)
assert out.count(FLASH_MOVE_TO) == 1
out = out.replace(FLASH_MOVE_TO,
    "  /* Declared here, above renderCollection, which calls it. A function\n"
    "     declaration hoists, but keeping it above its caller is how the s63\n"
    "     class of fault stops being possible rather than merely absent. */\n"
    + FLASH_OLD + "\n" + FLASH_MOVE_TO, 1)

after = dict(ids=count_ids(out), fetch=count_fetch(out), fns=count_fns(out),
             faces=count_faces(out))

fails = []

if after["fetch"] != 0:  fails.append(f"FETCH: found {after['fetch']}")
if after["faces"] != 3:  fails.append(f"FACES: {after['faces']}")
if after["fns"] < before["fns"]: fails.append(f"FNS: lost, {before['fns']} -> {after['fns']}")

MUST = [
    'function setFeatured', 'id="mcFeat"', 'id="mcMini"',
    '.mc-latest{', '.mc-allgrid{', '.mc-feat{', '.mc-minimap{', '.mc-acts{',
    'aspect-ratio:1;', '.piece.is-on{', '.piece.is-fresh{',
    ".piece:hover .piece__pick, .piece.is-picked .piece__pick{ opacity:1 }",
    "if (tile.closest('.mc-minimap')) setFeatured(tile.dataset.piece);",
    "var MC_FILT = 'Portraits'",
    'Click to view full',
]
for m in MUST:
    if m not in out:
        fails.append(f"MUST-EXIST: {m}")

# the shadow is gone
if "box-shadow:-1.2rem 0 3rem" in out:
    fails.append("SHADOW: the panel still throws a shadow onto the Curator")
seg = re.search(r'\.mycoll\{(.*?)\n\}', out, re.S).group(1)
if "box-shadow" in seg:
    fails.append("SHADOW: .mycoll must cast nothing leftward")

# a mini must never open the lightbox directly
if re.search(r"mc-minimap'\)\) openLightbox", out):
    fails.append("INTERACTION: a mini sets the featured, it does not open the lightbox")

# the piece is square in the collection
if "aspect-ratio:var(--card-ratio)" in out.split('MY COLLECTION')[-1]:
    fails.append("RATIO: a collected piece is 1:1, not the card ratio")

# flash must be declared above renderCollection
if out.find("function flash") > out.find("function renderCollection"):
    fails.append("TDZ: flash() must be declared above renderCollection, which calls it")

for bad in ("Museum-grade", "museum-grade", "sculpt", "Sculpt", "sculpture", "In-Situ", "In Situ"):
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
  const txt = id => { const e = d.getElementById(id); return e ? e.textContent.trim() : null; };
  const a = {};
  try {
    a.verb = txt('tbcGoVerb'); a.silos = q('.face--silos .silo-card'); a.faces = q('.face');
    w.__showCollection();
    // default is the featured mode
    a.featured   = q('#mcFeat');
    a.minis      = q('#mcMini .piece');
    a.crafting   = q('#mcMini .piece.is-crafting');
    a.acts       = q('.mc-acts .mc-act');
    a.onCount    = q('#mcMini .piece.is-on');
    a.featHasImg = q('#mcFeat img');
    a.featName   = (d.querySelector('.mc-feat__nm')||{}).textContent;
    // a mini sets the featured, it does not open the lightbox
    const target = [...d.querySelectorAll('#mcMini .piece:not(.is-crafting)')][2];
    target.click();
    a.lboxAfterMini = d.getElementById('lbox').classList.contains('is-open');
    a.featAfterMini = (d.querySelector('.mc-feat__nm')||{}).textContent;
    a.onAfterMini   = q('#mcMini .piece.is-on');
    // the featured opens the lightbox
    d.getElementById('mcFeat').click();
    a.lboxAfterFeat = d.getElementById('lbox').classList.contains('is-open');
    a.lboxActs = q('#lboxActs .mc-act');
    d.getElementById('lboxX').click();
    // View All is the flat grid
    [...d.querySelectorAll('#mcFilters .mc-filter')].find(b => b.dataset.filter === 'all').click();
    a.allgrid  = q('.mc-allgrid');
    a.allTiles = q('.mc-allgrid .piece');
    a.featGone = q('#mcFeat');
    // and a tile there goes straight to the lightbox
    d.querySelector('.mc-allgrid .piece:not(.is-crafting)').click();
    a.lboxFromAll = d.getElementById('lbox').classList.contains('is-open');
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
    if a.get("error"):            fails.append(f"BOOT DRIVE: {a['error']}")
    if a.get("verb") != "Next":   fails.append(f"BOOT: verb {a.get('verb')!r}")
    if a.get("silos") != 8:       fails.append(f"BOOT: silo cards {a.get('silos')}")
    if a.get("faces") != 3:       fails.append(f"BOOT: faces {a.get('faces')}")
    if a.get("featured") != 1:    fails.append("BOOT: no featured panel in the default mode")
    if a.get("minis") != 5:       fails.append(f"BOOT: expected 5 minis, got {a.get('minis')}")
    if a.get("crafting") != 1:    fails.append(f"BOOT: expected 1 in-progress mini, got {a.get('crafting')}")
    if a.get("acts") != 2:        fails.append(f"BOOT: expected 2 always-on actions, got {a.get('acts')}")
    if a.get("onCount") != 1:     fails.append(f"BOOT: exactly one mini carries is-on, got {a.get('onCount')}")
    if a.get("featHasImg") != 1:  fails.append("BOOT: the featured panel has no image")
    if a.get("lboxAfterMini"):    fails.append("BOOT: a mini click opened the lightbox — it must only set the featured")
    if a.get("featAfterMini") == a.get("featName"):
        fails.append("BOOT: the featured did not change when a different mini was clicked")
    if a.get("onAfterMini") != 1: fails.append(f"BOOT: is-on should follow the click, got {a.get('onAfterMini')}")
    if not a.get("lboxAfterFeat"):fails.append("BOOT: clicking the featured did not open the lightbox")
    if a.get("lboxActs") != 3:    fails.append(f"BOOT: expected 3 lightbox actions, got {a.get('lboxActs')}")
    if a.get("allgrid") != 1:     fails.append("BOOT: View All did not render the flat grid")
    if a.get("allTiles") != 5:    fails.append(f"BOOT: flat grid should hold 5, got {a.get('allTiles')}")
    if a.get("featGone") != 0:    fails.append("BOOT: the featured panel survived into View All")
    if not a.get("lboxFromAll"):  fails.append("BOOT: a tile in View All should open the lightbox directly")

print("BUILD s67 -> s68   featured + minimap, shadow off the Curator")
print("-" * 60)
for k in ("ids", "fetch", "fns", "faces"):
    print(f"  {k:<7} {before[k]:>6}  ->  {after[k]:>6}")
if rep:
    a = rep["a"]
    print("-" * 60)
    print(f"  boot errors     {len(rep['errors'])}")
    print(f"  default mode    featured={a.get('featured')} minis={a.get('minis')} ({a.get('crafting')} wip)")
    print(f"  featured        {str(a.get('featName'))[:44]!r}")
    print(f"  after mini      {str(a.get('featAfterMini'))[:44]!r}")
    print(f"  mini -> lbox    {a.get('lboxAfterMini')}  (must be False)")
    print(f"  feat -> lbox    {a.get('lboxAfterFeat')}")
    print(f"  View All        grid={a.get('allgrid')} tiles={a.get('allTiles')} feat={a.get('featGone')}")
print("-" * 60)

if fails:
    print("GATE FAILED — nothing written")
    for f_ in fails: print("  x " + f_)
    sys.exit(1)

open(OUT, "w", encoding="utf-8").write(out)
print("GATE PASSED")
print(f"written: {OUT}")
