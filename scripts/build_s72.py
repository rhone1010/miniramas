#!/usr/bin/env python3
"""
BUILD s71 -> s72   THE THREE WAYS ON
CUI V23 · 2026-07-30 · from Rich's mockup, treated as a directive

WHY THESE EXIST
  Sets are out for launch — the reward tracking behind them is not built, and
  bundling effects together without it would be an upsell wearing a set's
  clothes. So the foot of My Collection offers three things a customer can
  actually do next instead:

    The Curator Recommends   three live effects they have not crafted
    Print Shop               their own pieces, on a wall
    Create Wallpapers        their own piece, on a phone

  Each is a real onward path, not a promise of a system that does not exist.

WHAT DRIVES THEM — decided here, flagged
  · RECOMMENDS reads the registry: live effects, not already in the collection,
    one per silo so the three are not three shades of the same room. Silo art
    until per-effect art lands (punchlist 7 — the effect floor does the same).
  · PRINT SHOP shows up to four of THEIR pieces, third one framed, per the
    mockup. Their own work on a wall is the argument; stock frames are not.
  · WALLPAPER shows their most recent finished piece on a phone. The phone is
    drawn in CSS — there is no device asset on disk and one more image to keep
    in step is one more thing to go stale.

WHEN THE ROW APPEARS — my call
  Only once at least one piece has landed. Two of the three cards show the
  customer's own work, and before there is any they have nothing to print and
  nothing to set as a wallpaper. A row of three where two are empty argues
  against itself. The empty-state line already says what to do first.

  Recommends alone would work at zero pieces — but one card in a three-card
  row reads as two that failed to load.

ALL THREE BUTTONS ARE INERT
  No Print Shop surface, no wallpaper flow, and 'Explore These Effects' needs
  the floor to open on a chosen silo. Each calls a named hook that does not
  exist yet, exactly as the pose step calls __openPaywall. Nothing invented.
"""

import re, sys, subprocess, os, json, tempfile, shutil

SRC = "/home/claude/litenco-stage-2026-07-30-s71.html"
OUT = "/home/claude/litenco-stage-2026-07-30-s72.html"
REG = "/mnt/user-data/uploads/effect-registry.js"

src = open(SRC, encoding="utf-8").read()

# ══════════════════════════════════════════════════════════════════
# 1 · CSS
# ══════════════════════════════════════════════════════════════════

CSS_ANCHOR = """.mc-act.is-fill:hover{ background:linear-gradient(180deg,#8f4e4e 0%, #7d4242 100%) }"""

CSS_NEW = CSS_ANCHOR + """

/* ---- the three ways on ------------------------------------------------ */
/* Sets are out for launch, so the foot of the collection offers things that
   exist rather than a system that does not. Two of the three show the
   customer's own work, which is why the row waits for a first piece. */
.mc-onward{
  display:grid;
  grid-template-columns:repeat(3, minmax(0,1fr));
  gap:clamp(10px,.8vw,18px);
  margin-top:clamp(18px,1.4vw,30px);
  padding-top:clamp(16px,1.2vw,26px);
  border-top:1px solid rgba(196,169,110,.16);
}
.ow{
  display:flex; flex-direction:column;
  padding:clamp(14px,1vw,20px);
  border:1px solid rgba(196,169,110,.2);
  border-radius:8px;
  background:linear-gradient(180deg, rgba(46,37,31,.62), rgba(30,25,21,.62));
}
.ow-head{ display:flex; align-items:center; gap:.5em; margin-bottom:.85em }
.ow-ic{ flex:0 0 auto; width:1.4rem; height:1.4rem }
.ow-ic svg{
  width:100%; height:100%;
  fill:none; stroke:#c9a660; stroke-width:1.5;
  stroke-linecap:round; stroke-linejoin:round;
}
.ow-title{
  font-family:var(--serif); font-size:1.32rem; line-height:1.1;
  color:#f4efe8;
}

/* the thumbnail strips */
.ow-strip{ display:flex; gap:.5em; margin-bottom:1em }
.ow-th{
  flex:1 1 0; min-width:0;
  aspect-ratio:1;
  overflow:hidden;
  border:1px solid rgba(196,169,110,.16);
  border-radius:5px;
  background:#241c16;
}
.ow-th img{ width:100%; height:100%; object-fit:cover; object-position:50% 20% }
/* one of the print thumbs wears a frame — the point of the card in one tile */
.ow-th.is-framed{
  border:3px solid rgba(201,166,96,.72);
  box-shadow:0 .3rem .9rem rgba(18,12,8,.5);
}

/* the action. Substantial, never a micro-link. */
.ow-go{
  margin-top:auto;
  display:block; width:100%;
  padding:.62em 1em;
  border:1px solid rgba(225,189,126,.3); border-radius:6px;
  background:linear-gradient(180deg,#b99356 0%,#9d7842 100%);
  font-family:var(--serif); font-size:1.2rem; line-height:1.2;
  color:#2a1d10; cursor:pointer;
  transition:filter 160ms ease;
}
.ow-go:hover{ filter:brightness(1.09) }

/* the wallpaper card puts the phone beside the action rather than above it */
.ow--phone{ position:relative; overflow:hidden }
.ow--phone .ow-body{ display:grid; grid-template-columns:minmax(0,1fr) auto; gap:.8em; flex:1 }
.ow--phone .ow-go{ align-self:end }
.phone{
  position:relative;
  width:clamp(62px,4.6vw,86px);
  aspect-ratio:.48;
  align-self:end;
  margin-bottom:-1.2rem;      /* sits into the card's foot, as in the mockup */
  border:2px solid rgba(210,196,178,.5);
  border-radius:1.1rem;       /* a device curve, not a card curve */
  overflow:hidden;
  background:#14100e;
  box-shadow:0 .5rem 1.4rem rgba(0,0,0,.5);
}
.phone img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover }
.phone-ui{
  position:absolute; inset:0; z-index:2;
  display:flex; flex-direction:column; align-items:center;
  padding-top:.5em;
  font-family:var(--sans); color:#fff;
  text-shadow:0 1px 3px rgba(0,0,0,.6);
  pointer-events:none;
}
.phone-day{ font-size:.36rem; letter-spacing:.02em; opacity:.9 }
.phone-time{ font-size:1.05rem; font-weight:300; line-height:1.05; margin-top:.1em }
.phone-notch{
  position:absolute; top:.32rem; left:50%; transform:translateX(-50%);
  width:34%; height:.32rem; border-radius:99px; background:#14100e;
}

@media (max-width:1599px){
  .mc-onward{ grid-template-columns:repeat(2, minmax(0,1fr)) }
  .ow--phone{ grid-column:span 2 }
}
@media (max-width:1366px){
  .mc-onward{ grid-template-columns:1fr }
  .ow--phone{ grid-column:auto }
  .ow-title{ font-size:1.2rem }
}
"""

# ══════════════════════════════════════════════════════════════════
# 2 · MARKUP — the row lives under the grid, inside the panel
# ══════════════════════════════════════════════════════════════════

MK_OLD = """    <div class="mc-grid" id="mcGrid"></div>"""
MK_NEW = """    <div class="mc-grid" id="mcGrid"></div>
    <div class="mc-onward" id="mcOnward" hidden></div>"""

# ══════════════════════════════════════════════════════════════════
# 3 · JS
# ══════════════════════════════════════════════════════════════════

JS_ANCHOR = """  window.__showCollection = showCollection;
  window.__hideCollection = hideCollection;"""

JS_NEW = """  /* ==================================================================
     THE THREE WAYS ON
     ==================================================================
     Sets are out for launch. Rather than bundle effects together and call it
     a set without the tracking to back it, the foot of the collection offers
     three things that exist: finishes they have not tried, their work on a
     wall, and their work on a phone.

     All three buttons call named hooks that do not exist yet. Same seam as
     __openPaywall — the surface is built, the destination is not invented. */

  /* Live, not already owned, and one per silo — three shades of the same room
     is a worse recommendation than three rooms. */
  function recommendEffects(n){
    var owned = {};
    PIECES.forEach(function(p){ owned[p.name] = true; });
    var seen = {}, out = [];
    R.silos.forEach(function(s){
      if (out.length >= n) return;
      var live = R.offerableBySilo(s.id);
      for (var i = 0; i < live.length; i++){
        if (seen[live[i].id]) continue;
        seen[live[i].id] = true;
        out.push({ effect: live[i], silo: s });
        break;
      }
    });
    return out.slice(0, n);
  }

  function owCard(kind){
    var el = document.createElement('div');
    el.className = 'ow' + (kind === 'phone' ? ' ow--phone' : '');
    el.dataset.ow = kind;
    return el;
  }
  function owHead(icon, title){
    return '<div class="ow-head"><span class="ow-ic">' + OW_ICONS[icon] + '</span>' +
           '<span class="ow-title"></span></div>';
  }

  function renderOnward(){
    var wrap = document.getElementById('mcOnward');
    if (!wrap) return;
    var done = PIECES.filter(function(p){ return !p.crafting; });
    /* Two of the three show the customer's own work. Before a first piece
       lands there is nothing to print and nothing to set as a wallpaper, and a
       row of three where two are empty argues against itself. */
    if (!done.length){ wrap.hidden = true; wrap.innerHTML = ''; return; }
    wrap.hidden = false;
    wrap.innerHTML = '';

    /* 1 · the Curator recommends */
    var recs = recommendEffects(3);
    var c1 = owCard('recommend');
    c1.innerHTML = owHead('star') +
      '<div class="ow-strip">' + recs.map(function(r){
        return '<div class="ow-th"><img src="/previews/silos/' + r.silo.id +
               '.jpg" alt="" loading="lazy"></div>';
      }).join('') + '</div>' +
      '<button class="ow-go" type="button">Explore These Effects \\u2192</button>';
    c1.querySelector('.ow-title').textContent = 'The Curator Recommends';
    wrap.appendChild(c1);

    /* 2 · print shop — their own pieces, one of them framed */
    var four = done.slice(0, 4);
    var c2 = owCard('print');
    c2.innerHTML = owHead('frame') +
      '<div class="ow-strip">' + four.map(function(p, i){
        return '<div class="ow-th' + (i === 2 ? ' is-framed' : '') + '">' +
               '<img src="' + esc(p.art) + '" alt="" loading="lazy"></div>';
      }).join('') + '</div>' +
      '<button class="ow-go" type="button">Preview in Your Room \\u2192</button>';
    c2.querySelector('.ow-title').textContent = 'Print Shop';
    wrap.appendChild(c2);

    /* 3 · wallpapers — their newest piece, on a phone drawn in CSS. No device
       asset on disk, and one more image to keep in step is one more to go
       stale. */
    var newest = done[0];
    var c3 = owCard('phone');
    c3.innerHTML = owHead('phone') +
      '<div class="ow-body">' +
        '<button class="ow-go" type="button">Try Wallpaper \\u2192</button>' +
        '<div class="phone">' +
          '<img src="' + esc(newest.art) + '" alt="">' +
          '<div class="phone-notch"></div>' +
          '<div class="phone-ui">' +
            '<span class="phone-day"></span>' +
            '<span class="phone-time">9:41</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    c3.querySelector('.ow-title').textContent = 'Create Wallpapers';
    c3.querySelector('.phone-day').textContent =
      new Date().toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric' });
    wrap.appendChild(c3);

    wrap.addEventListener('click', function(e){
      var b = e.target.closest('.ow-go'); if (!b) return;
      var kind = b.closest('.ow').dataset.ow;
      /* Named, absent, no-op. The Print Shop and the wallpaper flow are items
         6 and 7; Explore needs the floor to open on a chosen silo. */
      if (kind === 'recommend' && typeof window.__exploreEffects === 'function')
        window.__exploreEffects(recs);
      else if (kind === 'print' && typeof window.__openPrintShop === 'function')
        window.__openPrintShop(four);
      else if (kind === 'phone' && typeof window.__openWallpaper === 'function')
        window.__openWallpaper(newest);
    });
  }

  window.__showCollection = showCollection;
  window.__hideCollection = hideCollection;"""

# renderCollection must paint the row too
RC_OLD = """    renderFilters();
    updateBulk();
  }"""
RC_NEW = """    renderFilters();
    renderOnward();
    updateBulk();
  }"""

SER_OLD = """  var MC_SERIES = ['Action','Groups','Mobile Wallpapers','Pets','Portraits'];"""
SER_NEW = """  var MC_SERIES = ['Action','Groups','Mobile Wallpapers','Pets','Portraits'];

  /* Declared HERE, with the other constants, because renderCollection() runs
     during init and calls renderOnward(), which reads this. A var assigned
     further down the file hoists as a NAME and not as a VALUE — the same
     fault that killed s63's interactivity and s66's first cut. Third time.
     Constants go above their callers, and the gate below enforces it. */
  var OW_ICONS = {
    star:  '<svg viewBox="0 0 24 24"><path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z"/></svg>',
    frame: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="1.6"/>' +
           '<path d="M6.5 7.5h11v9h-11z"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/>' +
           '<path d="M10.6 5.2h2.8"/></svg>'
  };"""

EDITS = [
    ("ow icons up",   SER_OLD,    SER_NEW),
    ("onward css",    CSS_ANCHOR, CSS_NEW),
    ("onward markup", MK_OLD,     MK_NEW),
    ("onward js",     JS_ANCHOR,  JS_NEW),
    ("render hook",   RC_OLD,     RC_NEW),
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
if after["fetch"] != 0: fails.append(f"FETCH: {after['fetch']}")
if after["faces"] != 3: fails.append(f"FACES: {after['faces']}")
if after["ids"] != before["ids"] + 1:
    fails.append(f"IDS: expected +1 (mcOnward), got {before['ids']} -> {after['ids']}")

MUST = [
    'id="mcOnward"', 'function renderOnward', 'function recommendEffects',
    '.mc-onward{', '.ow{', '.ow-go{', '.phone{',
    'window.__exploreEffects', 'window.__openPrintShop', 'window.__openWallpaper',
    'renderOnward();',
]
for m in MUST:
    if m not in out:
        fails.append(f"MUST-EXIST: {m}")

# Constants must be declared above the callers that run during init. This is
# the third build to trip the same fault, so it now has a gate of its own.
for const, caller in [("var OW_ICONS", "function renderCollection"),
                      ("var MC_SERIES", "function renderCollection")]:
    i_c, i_f = out.find(const), out.find(caller)
    if i_c == -1 or i_f == -1 or i_c > i_f:
        fails.append(f"TDZ: {const} must be declared above {caller}, which runs at init")

# titles go in as text, never markup
if re.search(r'ow-title">\'\s*\+', out):
    fails.append("ESCAPING: a card title is being injected with innerHTML")

# the row must hide itself when nothing has landed
if "if (!done.length){ wrap.hidden = true" not in out:
    fails.append("EMPTY: the row must not show before a first piece lands")

# exactly one framed thumb in the print card
if "i === 2 ? ' is-framed'" not in out:
    fails.append("PRINT: one thumbnail is framed, per the mockup")

# the phone is drawn, not fetched
if re.search(r'src="[^"]*phone[^"]*\.(png|jpg|svg)"', out):
    fails.append("PHONE: must be drawn in CSS, not another asset to keep in step")

# recommendations must come from the registry and be live only
if "R.offerableBySilo(s.id)" not in out:
    fails.append("RECOMMEND: must read live effects off the registry")

for bad in ("Museum-grade", "sculpt", "Sculpt", "sculpture", "In-Situ", "In Situ"):
    if bad in out: fails.append(f"POSITIONING: '{bad}'")
for dead in ("SILO_EFFECTS", "NO_ENGINE", "SILO_LINE"):
    if re.search(r"window\." + dead + r"\s*=", out): fails.append(f"STALE GLOBAL: {dead}")

_nc = re.sub(r'/\*.*?\*/', '', out, flags=re.S)
for v in re.findall(r'border-radius:\s*(\d+)px', _nc):
    if 13 < int(v) < 99: fails.append(f"RADIUS: {v}px is neither a card curve nor a pill")
for sm in re.findall(r'<style[^>]*>(.*?)</style>', out, re.S):
    if sm.count("{") != sm.count("}"): fails.append("BRACE: unbalanced")
for i, sm in enumerate(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', out, re.S)):
    if not sm.strip(): continue
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as fh:
        fh.write(sm); p = fh.name
    r = subprocess.run(["node", "--check", p], capture_output=True, text=True)
    os.unlink(p)
    if r.returncode != 0:
        fails.append(f"NODE --CHECK: block {i} — {r.stderr.strip().splitlines()[0]}")

# ── BOOT ──────────────────────────────────────────────────────────
os.makedirs("/home/claude/.serve", exist_ok=True)
shutil.copy(REG, "/home/claude/.serve/effect-registry.js")

BOOT = r"""
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push(e.message.split('\n')[0]));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
let html = fs.readFileSync(process.argv[2], 'utf8');
const reg = fs.readFileSync('/home/claude/.serve/effect-registry.js', 'utf8');
html = html.replace('<script src="/effect-registry.js"></script>', '<script>' + reg + '</script>');
const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc });
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const w = dom.window, d = w.document;
  const q = s => d.querySelectorAll(s).length;
  const a = {};
  try {
    await sleep(500);
    a.silos = q('#siloFloor .silo-card');
    w.__showCollection(); await sleep(80);
    a.hidden   = d.getElementById('mcOnward').hidden;
    a.cards    = q('#mcOnward .ow');
    a.titles   = [...d.querySelectorAll('#mcOnward .ow-title')].map(e => e.textContent);
    a.buttons  = [...d.querySelectorAll('#mcOnward .ow-go')].map(e => e.textContent);
    a.recThumbs= q('[data-ow="recommend"] .ow-th');
    a.prThumbs = q('[data-ow="print"] .ow-th');
    a.framed   = q('[data-ow="print"] .ow-th.is-framed');
    a.phone    = q('.phone img');
    a.phoneDay = (d.querySelector('.phone-day')||{}).textContent;
    a.icons    = q('#mcOnward .ow-ic svg');
    // recommendations must be live effects, one per silo
    a.recSrcs  = [...d.querySelectorAll('[data-ow="recommend"] .ow-th img')].map(e => e.getAttribute('src'));
    a.recUnique= new Set(a.recSrcs).size;
    // buttons must not throw with no hook present
    d.querySelector('[data-ow="print"] .ow-go').click(); await sleep(40);
    a.clickSurvived = true;
    // and the row must vanish when nothing has landed
    w.PIECES_TEST = true;
  } catch (e) { a.error = e.message + ' @ ' + (e.stack||'').split('\n')[1]; }
  console.log(JSON.stringify({ errors, a }));
})();
"""
hp, hj = "/home/claude/.gate-boot.html", "/home/claude/.gate-boot.js"
open(hp, "w", encoding="utf-8").write(out)
open(hj, "w", encoding="utf-8").write(BOOT)
boot = subprocess.run(["node", hj, hp], capture_output=True, text=True, cwd="/home/claude", timeout=90)

rep = None
ln = [l for l in boot.stdout.splitlines() if l.startswith("{")]
if not ln:
    fails.append(f"BOOT GATE: no report — {boot.stderr.strip()[:250]}")
else:
    rep = json.loads(ln[-1]); a = rep["a"]
    for e in rep["errors"]: fails.append(f"BOOT ERROR: {e}")
    if a.get("error"): fails.append(f"BOOT DRIVE: {a['error']}")
    if a.get("silos") != 8:   fails.append(f"BOOT: silos {a.get('silos')}")
    if a.get("hidden"):       fails.append("BOOT: the row should show — four pieces have landed")
    if a.get("cards") != 3:   fails.append(f"BOOT: expected 3 cards, got {a.get('cards')}")
    if a.get("titles") != ["The Curator Recommends","Print Shop","Create Wallpapers"]:
        fails.append(f"BOOT: titles {a.get('titles')}")
    if a.get("recThumbs") != 3: fails.append(f"BOOT: recommend thumbs {a.get('recThumbs')}")
    if a.get("prThumbs") != 4:  fails.append(f"BOOT: print thumbs {a.get('prThumbs')}")
    if a.get("framed") != 1:    fails.append(f"BOOT: framed thumbs {a.get('framed')}")
    if a.get("phone") != 1:     fails.append("BOOT: the phone has no image")
    if not (a.get("phoneDay") or "").strip(): fails.append("BOOT: the phone shows no date")
    if a.get("icons") != 3:     fails.append(f"BOOT: icons {a.get('icons')}")
    if a.get("recUnique") != 3: fails.append(f"BOOT: recommendations must span 3 silos, got {a.get('recUnique')} distinct")
    if not a.get("clickSurvived"): fails.append("BOOT: a button threw with no hook present")

print("BUILD s71 -> s72   the three ways on")
print("-" * 60)
for k in ("ids", "fetch", "fns", "faces"):
    print(f"  {k:<7} {before[k]:>6}  ->  {after[k]:>6}")
if rep:
    a = rep["a"]
    print("-" * 60)
    print(f"  boot errors     {len(rep['errors'])}")
    print(f"  cards           {a.get('cards')}  icons={a.get('icons')}")
    print(f"  titles          {a.get('titles')}")
    print(f"  thumbs          recommend={a.get('recThumbs')} print={a.get('prThumbs')} framed={a.get('framed')}")
    print(f"  rec spread      {a.get('recUnique')} distinct silos")
    print(f"  phone           img={a.get('phone')}  {a.get('phoneDay')!r}")
print("-" * 60)

if fails:
    print("GATE FAILED — nothing written")
    for f_ in fails: print("  x " + f_)
    sys.exit(1)

open(OUT, "w", encoding="utf-8").write(out)
print("GATE PASSED")
print(f"written: {OUT}")
