#!/usr/bin/env python3
"""
BUILD s59 -> s60   THE POSE LAYER
CUI V23 · 2026-07-29 · ruled by Rich in session

WHAT THIS ADDS
  A third face on the deck. Craft flips the floor one more time and offers
  six poses. Choosing one is the last thing before the paywall.

RULED BY RICH THIS SESSION (supersedes CARRYOVER-CUI-V22 §6, which specced
four moods behind a yes/no question, placed before the rooms):
  · six options, no yes/no gate: as_photographed, smiling, laughing,
    thoughtful, confident, dramatic
  · one pose for the WHOLE QUEUE, never per image — friction is the enemy
  · images at /public/pose/<id>.jpg, taxonomy ids, never sequential
  · fires after Craft, before the paywall
  · Curator lines drafted by CUI, to be replaced by CENG / the Curator AI

FREE FROM THE EXISTING FILE — nothing invented:
  · .floor[data-count="6"] already lays six cards out 3+3 centred (s59:759)
  · turn(from, to, after) already staggers the flip at 38ms (s59:2219)
  · .silo-card carries the 3D flip and hover (s59:926)
  · .silo-card.is-selected already draws the chosen ring (s59:984)

THE ONE THING I CHOSE WITHOUT ASKING
  Clicking a pose card advances immediately — one click, no confirm step.
  That follows Rich's "low friction, volume shop" ruling. If he wants a
  confirm instead, choosePose() stops calling the paywall hook and the
  rail button drives it: a two-line change, flagged rather than buried.

THE SEAM
  choosePose() sets window.__POSE and calls window.__openPaywall() if it
  exists. It does not exist. That is deliberate — the paywall is item 5,
  and this build must not invent its contract. Until then the pose is
  chosen, recorded, and the flow stops there with the Curator responding.

STILL NOT DONE, BY DESIGN
  · six prompt blocks — CENG's, and no route field named here
  · /public/pose/*.jpg — Rich is making them; cards will show broken
    images until they land

Gate: assertion-based. Writes output only if every assertion passes.
"""

import re, sys, subprocess, tempfile, os

SRC = "/home/claude/litenco-stage-2026-07-29-s59.html"
OUT = "/home/claude/litenco-stage-2026-07-29-s60.html"

src = open(SRC, encoding="utf-8").read()

# ══════════════════════════════════════════════════════════════════
# 1 · CSS — the pose face, and the crumb in pose view
# ══════════════════════════════════════════════════════════════════

CSS_ANCHOR = """.workshop-view--effects .face--effects{ opacity:1; visibility:visible; transition-delay:0s,0s }"""

CSS_NEW = CSS_ANCHOR + """

/* ---- the third face · the pose ----------------------------------------- */
/* Craft turns the floor one last time. Six poses, laid out 3+3 by the
   data-count rules already in the floor. One pose covers the whole queue —
   asking per image is friction the shop cannot afford. */
.face--poses{ opacity:0; visibility:hidden }
.workshop-view--poses .face--silos,
.workshop-view--poses .face--effects{ opacity:0; visibility:hidden }
.workshop-view--poses .face--poses{ opacity:1; visibility:visible; transition-delay:0s,0s }
.workshop-view--poses .crumb-here{ opacity:1 }"""

# ══════════════════════════════════════════════════════════════════
# 2 · MARKUP — a label span on the back button, and the third face
# ══════════════════════════════════════════════════════════════════

CRUMB_ANCHOR = """        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>All effects
      </button>"""

CRUMB_NEW = """        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg><span id="crumbLabel">All effects</span>
      </button>"""

FACE_ANCHOR = """      <div class="face face--effects">
        <div class="floor face-floor" id="effectFloor" data-count="0"></div>
      </div>
    </div>"""

FACE_NEW = """      <div class="face face--effects">
        <div class="floor face-floor" id="effectFloor" data-count="0"></div>
      </div>
      <div class="face face--poses">
        <div class="floor face-floor" id="poseFloor" data-count="6"></div>
      </div>
    </div>"""

# ══════════════════════════════════════════════════════════════════
# 3 · JS — the pose step, inserted after backToSilos so it shares scope
# ══════════════════════════════════════════════════════════════════

JS_ANCHOR = """  function backToSilos(){
    turn(effFloor, siloFloor, function(){
      if (cur && cur.dataset.state !== 'empty') say(SAY.photo);
      workshop.classList.remove('workshop-view--effects');
      workshop.classList.add('workshop-view--silos');
    });
  }"""

JS_NEW = JS_ANCHOR + """

  /* ==================================================================
     THE POSE · the last card flip before the paywall
     ==================================================================
     Ruled 2026-07-29. Six poses, one for the whole queue. The photograph
     gives one pose already; 'As Photographed' keeps it, and is a card
     rather than a skip link so there is no null state to design around.

     Placement: after Craft, before the paywall. The floor turns a third
     time — the same gesture it already makes, so nothing new to learn. */

  var POSES = [
    { id:'as_photographed', label:'As Photographed' },
    { id:'smiling',         label:'Smiling'         },
    { id:'laughing',        label:'Laughing'        },
    { id:'thoughtful',      label:'Thoughtful'      },
    { id:'confident',       label:'Confident'       },
    { id:'dramatic',        label:'Dramatic'        }
  ];

  /* CUI draft, in the Curator's register. To be replaced by CENG and then
     by the live Curator. Second person, one concrete observation, then a
     move forward — the pattern SAY.empty and SAY.photo already set. */
  var POSE_SAY = {
    intro:
      'One last thing before I begin. Your photograph gives me a pose already &mdash; ' +
      'but I needn&rsquo;t keep it. Tell me how you would like to be held, and I&rsquo;ll ' +
      'carry it through every finish you have chosen.' +
      '<span class="sign">&mdash; C.</span>',
    as_photographed:
      'As photographed, then. There is a real case for it &mdash; it is the face ' +
      'people already recognise, and I will keep it exactly.' +
      '<span class="sign">&mdash; C.</span>',
    smiling:
      'A smile. It softens the whole piece, and the eyes go with it &mdash; ' +
      'they always do.' +
      '<span class="sign">&mdash; C.</span>',
    laughing:
      'Laughing. That is the brave choice, and the one people keep on the shelf. ' +
      'It carries best in the softer materials.' +
      '<span class="sign">&mdash; C.</span>',
    thoughtful:
      'Thoughtful. The gaze goes a little past the viewer and the piece gets ' +
      'quieter for it. My own favourite in stone.' +
      '<span class="sign">&mdash; C.</span>',
    confident:
      'Confident. Chin level, shoulders squared &mdash; it reads as someone who ' +
      'has decided something.' +
      '<span class="sign">&mdash; C.</span>',
    dramatic:
      'Dramatic, then. Deeper shadow, more weight through the brow. ' +
      'The bronzes love it.' +
      '<span class="sign">&mdash; C.</span>'
  };

  var poseFloor  = document.getElementById('poseFloor');
  var crumbLabel = document.getElementById('crumbLabel');
  var POSE_FROM  = 'effects';   /* which face Craft was pressed from */
  var POSE       = null;        /* the chosen pose id, queue-wide */

  /* A pose card is a silo card. It inherits the flip, the hover lift and
     the chosen ring, so there is no second card system to keep in step. */
  function poseCard(p){
    var a = document.createElement('article');
    a.className = 'silo-card';
    a.tabIndex  = 0;
    a.dataset.pose = p.id;
    a.innerHTML =
      '<img class="silo-card__image" src="/pose/' + p.id + '.jpg" alt="" loading="lazy">' +
      '<div class="silo-card__overlay"></div>' +
      '<div class="silo-card__content"><h3 class="silo-card__title">' + p.label + '</h3></div>';
    return a;
  }

  function openPoses(){
    if (!QUEUE.length) return;                 /* nothing to pose */
    if (workshop.classList.contains('workshop-view--poses')) return;
    POSE_FROM = workshop.classList.contains('workshop-view--effects') ? 'effects' : 'silos';
    var from  = POSE_FROM === 'effects' ? effFloor : siloFloor;
    turn(from, poseFloor, function(){
      poseFloor.innerHTML = '';
      POSES.forEach(function(p){
        var el = poseCard(p);
        if (p.id === POSE) el.classList.add('is-selected');
        poseFloor.appendChild(el);
      });
      poseFloor.dataset.count = POSES.length;
      if (crumbHere)  crumbHere.textContent  = 'The pose';
      if (crumbLabel) crumbLabel.textContent = 'Back to the queue';
      say(POSE_SAY.intro);
      workshop.classList.remove('workshop-view--' + POSE_FROM);
      workshop.classList.add('workshop-view--poses');
    });
  }

  function backFromPoses(){
    var to = POSE_FROM === 'effects' ? effFloor : siloFloor;
    turn(poseFloor, to, function(){
      if (crumbLabel) crumbLabel.textContent = 'All effects';
      if (POSE_FROM === 'silos' && cur && cur.dataset.state !== 'empty') say(SAY.photo);
      workshop.classList.remove('workshop-view--poses');
      workshop.classList.add('workshop-view--' + POSE_FROM);
    });
  }

  /* One click. The pose is recorded and the paywall takes over.
     __openPaywall does not exist yet — that is item 5, and this build
     does not invent its contract. Until it lands the flow stops here
     with the Curator answering, which is honest rather than broken. */
  function choosePose(id){
    POSE = id;
    window.__POSE = id;
    [].forEach.call(poseFloor.children, function(el){
      el.classList.toggle('is-selected', el.dataset.pose === id);
    });
    say(POSE_SAY[id] || POSE_SAY.intro);
    if (typeof window.__openPaywall === 'function') window.__openPaywall(id);
  }

  if (poseFloor){
    poseFloor.addEventListener('click', function(e){
      var c = e.target.closest('.silo-card');
      if (c && c.dataset.pose) choosePose(c.dataset.pose);
    });
    poseFloor.addEventListener('keydown', function(e){
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var c = e.target.closest('.silo-card');
      if (c && c.dataset.pose){ e.preventDefault(); choosePose(c.dataset.pose); }
    });
  }

  var tbcGo = document.getElementById('tbcGo');
  if (tbcGo) tbcGo.addEventListener('click', openPoses);

  window.POSES  = POSES;
  window.__POSE = POSE;"""

# ══════════════════════════════════════════════════════════════════
# 4 · JS — make the back button and Escape aware of the third view
# ══════════════════════════════════════════════════════════════════

BACK_ANCHOR = """  if (crumbBack) crumbBack.addEventListener('click', backToSilos);
  addEventListener('keydown', function(e){
    if (e.key === 'Escape' && workshop.classList.contains('workshop-view--effects'))
      backToSilos();
  });"""

BACK_NEW = """  if (crumbBack) crumbBack.addEventListener('click', function(){
    if (workshop.classList.contains('workshop-view--poses')) backFromPoses();
    else backToSilos();
  });
  addEventListener('keydown', function(e){
    if (e.key !== 'Escape') return;
    if (workshop.classList.contains('workshop-view--poses')) backFromPoses();
    else if (workshop.classList.contains('workshop-view--effects')) backToSilos();
  });"""

# ── measure ───────────────────────────────────────────────────────
def count_ids(s):   return len(set(re.findall(r'id="([^"]*)"', s)))
def count_fetch(s): return len(re.findall(r'\bfetch\s*\(', s))
def count_fns(s):   return len(re.findall(r'^\s*(?:async\s+)?function\s+[A-Za-z_$]', s, re.M))
def count_faces(s): return len(re.findall(r'class="face face--', s))

before = dict(ids=count_ids(src), fetch=count_fetch(src),
              fns=count_fns(src), faces=count_faces(src), chars=len(src))

# ── pre-flight: every anchor unique ───────────────────────────────
EDITS = [
    ("css face",     CSS_ANCHOR,   CSS_NEW),
    ("crumb label",  CRUMB_ANCHOR, CRUMB_NEW),
    ("third face",   FACE_ANCHOR,  FACE_NEW),
    ("pose js",      JS_ANCHOR,    JS_NEW),
    ("back + esc",   BACK_ANCHOR,  BACK_NEW),
]
for name, old, new in EDITS:
    n = src.count(old)
    assert n == 1, f"anchor '{name}' found {n} times, expected exactly 1"

# ── apply ─────────────────────────────────────────────────────────
out = src
for name, old, new in EDITS:
    out = out.replace(old, new, 1)

after = dict(ids=count_ids(out), fetch=count_fetch(out),
             fns=count_fns(out), faces=count_faces(out), chars=len(out))

# ── GATE ──────────────────────────────────────────────────────────
fails = []

# the file stays glass
if after["fetch"] != 0:
    fails.append(f"FETCH: s60 must stay fetchless, found {after['fetch']}")

# nothing lost
if after["ids"] < before["ids"]:
    fails.append(f"IDS: lost ids {before['ids']} -> {after['ids']}")
if after["fns"] < before["fns"]:
    fails.append(f"FNS: lost functions {before['fns']} -> {after['fns']}")

# the third face exists, and there are exactly three
if after["faces"] != 3:
    fails.append(f"FACES: expected 3, found {after['faces']}")

# must exist
MUST = [
    'class="face face--poses"',
    'id="poseFloor"',
    'id="crumbLabel"',
    '.workshop-view--poses .face--poses',
    'function poseCard',
    'function openPoses',
    'function backFromPoses',
    'function choosePose',
    "tbcGo.addEventListener('click', openPoses)",
    'window.__openPaywall',
]
for m in MUST:
    if m not in out:
        fails.append(f"MUST-EXIST: {m}")

# all six poses present as ids and as Curator lines
for p in ("as_photographed", "smiling", "laughing", "thoughtful", "confident", "dramatic"):
    if f"id:'{p}'" not in out.replace(" ", "").replace("id:'", "id:'"):
        if f"'{p}'" not in out:
            fails.append(f"MUST-EXIST: pose id {p}")
    if f"{p}:" not in out:
        fails.append(f"MUST-EXIST: POSE_SAY line for {p}")

# must not exist — no prompt text invented, no route field named
FORBIDDEN = [
    "POSE_PROMPT",          # prompt blocks are CENG's
    "/previews/moods/",     # the superseded path from CARRYOVER §6
    "Heroic", "Playful",    # the superseded four-mood set
]
for f_ in FORBIDDEN:
    if f_ in out:
        fails.append(f"MUST-NOT-EXIST: {f_}")

# the old single-purpose back wiring is gone
if "crumbBack.addEventListener('click', backToSilos)" in out:
    fails.append("STALE: crumbBack still hard-wired to backToSilos")

# images point at the ruled directory
if out.count("src=\"/pose/") == 0 and "'/pose/'" not in out:
    fails.append("PATH: pose art must load from /pose/")

# style braces balanced
for sm in re.findall(r'<style[^>]*>(.*?)</style>', out, re.S):
    if sm.count("{") != sm.count("}"):
        fails.append(f"BRACE: style block unbalanced {sm.count('{')} vs {sm.count('}')}")

# node --check every inline script
for i, sm in enumerate(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', out, re.S)):
    if not sm.strip():
        continue
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as fh:
        fh.write(sm); p = fh.name
    r = subprocess.run(["node", "--check", p], capture_output=True, text=True)
    os.unlink(p)
    if r.returncode != 0:
        fails.append(f"NODE --CHECK: script block {i} — {r.stderr.strip().splitlines()[0]}")

# ── report ────────────────────────────────────────────────────────
print("BUILD s59 -> s60   the pose layer")
print("-" * 56)
for k in ("ids", "fetch", "fns", "faces"):
    print(f"  {k:<7} {before[k]:>6}  ->  {after[k]:>6}")
print(f"  {'chars':<7} {before['chars']:>6}  ->  {after['chars']:>6}")
print("-" * 56)

if fails:
    print("GATE FAILED — nothing written")
    for f_ in fails:
        print("  x " + f_)
    sys.exit(1)

open(OUT, "w", encoding="utf-8").write(out)
print("GATE PASSED")
print(f"written: {OUT}")
