#!/usr/bin/env python3
"""
BUILD s61 -> s62   pose path fix + the Keep My Pose card
CUI V23 · 2026-07-29 · ruled by Rich in session

TWO CHANGES

1 · PATH FIX. s61 loaded pose art from `/pose/`. The files are on disk at
    `public/previews/pose/` (verified from Rich's folder screenshot), so
    nothing rendered. Now `/previews/pose/`. My error, not his.

2 · 'As Photographed' becomes an icon card, per Rich's mockup and CSS.
      id     as_photographed   (unchanged — stable taxonomy)
      label  Keep My Pose
      desc   Preserve your original expression and posture.
    A padlock in a gold ring, no photograph. There are five photographs on
    disk and five photographable poses; this card was never one of them.

RICH'S CSS, IMPLEMENTED — with four declared deviations, each forced by a
collision with what is already on the glass. Every one is flagged to him.

  a) `border-radius:12px` DROPPED.
     `.silo-card` already sets `clamp(.55rem,.55vw,.8rem)` — 8.8px to
     12.8px, tracking the card. A flat 12px would make this one card
     disagree with its five siblings at every band except one.

  b) `.pose-card h3` SCOPED to `.pose-card.preserve h3`.
     `.silo-card__title` IS an h3 (s61:1688). Unscoped, this restyles the
     titles on all five photograph cards to 2rem.

  c) `.pose-card p` SCOPED the same way, same reason.

  d) `.pose-card::before` SCOPED to `.pose-card.preserve::before`.
     Unscoped, the museum spotlight lands on all six cards.

The SVG is mine — Rich's HTML blocks came through empty, so the padlock is
drawn to his stroke spec (#c9a660, 1.8, no fill). Icon, not prompt content.

WATCH AT 1366. The card carries `padding:42px 32px` and a 112px circle in
fixed pixels inside a card that is 176x330 at that band. 64px of horizontal
padding leaves 112px of content width — exactly the circle. The description
will wrap hard. Implemented as written; flagged for Rich's eye.

Gate: assertion-based. Writes output only if every assertion passes.
"""

import re, sys, subprocess, tempfile, os

SRC = "/home/claude/litenco-stage-2026-07-29-s61.html"
OUT = "/home/claude/litenco-stage-2026-07-29-s62.html"

src = open(SRC, encoding="utf-8").read()

# ══════════════════════════════════════════════════════════════════
# 1 · CSS — Rich's rules for the preserve card
# ══════════════════════════════════════════════════════════════════

CSS_ANCHOR = """.workshop-view--poses .crumb-here{ opacity:1 }"""

CSS_NEW = CSS_ANCHOR + """

/* ---- Keep My Pose · the card with no photograph ------------------------ */
/* Five poses can be photographed. Keeping the one you arrived with cannot,
   so it reads as a sealed thing rather than an absent image. Rich's rules,
   scoped to .preserve — unscoped they reach the five photograph cards,
   because .silo-card__title is also an h3. Radius is left to .silo-card so
   this card curves exactly like its siblings at every band. */
.pose-card.preserve{
  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items:center;
  gap:22px;
  padding:42px 32px;
  background:
    radial-gradient(circle at 50% 22%, rgba(255,255,255,.035), transparent 55%),
    linear-gradient(180deg, #372a23 0%, #241b16 100%);
  color:#f3eee8;
  text-align:center;
}
.pose-card.preserve::before{
  content:"";
  position:absolute; inset:0;
  background:radial-gradient(ellipse at top, rgba(255,255,255,.05), transparent 55%);
  pointer-events:none;
}
.pose-card .icon-circle{
  display:flex; align-items:center; justify-content:center;
  width:112px; height:112px;
  border-radius:50%;
  background:rgba(255,255,255,.015);
  border:2px solid rgba(201,166,96,.45);
  box-shadow:inset 0 0 25px rgba(255,255,255,.02),
             0 6px 18px rgba(0,0,0,.28);
}
.pose-card .icon-circle svg{
  width:42px; height:42px;
  stroke:#c9a660; stroke-width:1.8; fill:none;
  stroke-linecap:round; stroke-linejoin:round;
  opacity:.95;
}
.pose-card.preserve h3{
  margin:0;
  font-family:var(--serif);
  font-size:2rem; font-weight:500; letter-spacing:.2px;
  color:#f4efe8;
}
.pose-card.preserve p{
  max-width:250px;
  margin:0;
  font-size:.95rem; line-height:1.65;
  color:rgba(255,255,255,.72);
}"""

# ══════════════════════════════════════════════════════════════════
# 2 · JS — the POSES table gains a description
# ══════════════════════════════════════════════════════════════════

ARR_OLD = """  var POSES = [
    { id:'as_photographed', label:'As Photographed' },
    { id:'smiling',         label:'Smiling'         },
    { id:'laughing',        label:'Laughing'        },
    { id:'thoughtful',      label:'Thoughtful'      },
    { id:'goofy',           label:'Goofy'           },
    { id:'dramatic',        label:'Dramatic'        }
  ];"""

ARR_NEW = """  /* Five of the six are photographs on disk at /previews/pose/<id>.jpg.
     The sixth keeps what the customer arrived with, so it carries a sealed
     padlock rather than a picture of a pose it is not asking them to adopt. */
  var POSES = [
    { id:'as_photographed', label:'Keep My Pose', preserve:true,
      desc:'Preserve your original expression and posture.' },
    { id:'smiling',         label:'Smiling'         },
    { id:'laughing',        label:'Laughing'        },
    { id:'thoughtful',      label:'Thoughtful'      },
    { id:'goofy',           label:'Goofy'           },
    { id:'dramatic',        label:'Dramatic'        }
  ];"""

# ══════════════════════════════════════════════════════════════════
# 3 · JS — poseCard branches, and the path is corrected
# ══════════════════════════════════════════════════════════════════

CARD_OLD = """  function poseCard(p){
    var a = document.createElement('article');
    a.className = 'silo-card';
    a.tabIndex  = 0;
    a.dataset.pose = p.id;
    a.innerHTML =
      '<img class="silo-card__image" src="/pose/' + p.id + '.jpg" alt="" loading="lazy">' +
      '<div class="silo-card__overlay"></div>' +
      '<div class="silo-card__content"><h3 class="silo-card__title">' + p.label + '</h3></div>';
    return a;
  }"""

CARD_NEW = """  var LOCK_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<rect x="5" y="10.4" width="14" height="10.1" rx="2"/>' +
      '<path d="M8.2 10.4V7.7a3.8 3.8 0 0 1 7.6 0v2.7"/>' +
      '<circle cx="12" cy="14.9" r="1.5"/>' +
      '<path d="M12 16.4v1.7"/>' +
    '</svg>';

  function poseCard(p){
    var a = document.createElement('article');
    a.className = 'silo-card pose-card' + (p.preserve ? ' preserve' : '');
    a.tabIndex  = 0;
    a.dataset.pose = p.id;
    if (p.preserve){
      a.innerHTML =
        '<div class="icon-circle">' + LOCK_SVG + '</div>' +
        '<h3>' + p.label + '</h3>' +
        '<p>' + p.desc + '</p>';
    } else {
      a.innerHTML =
        '<img class="silo-card__image" src="/previews/pose/' + p.id + '.jpg" alt="" loading="lazy">' +
        '<div class="silo-card__overlay"></div>' +
        '<div class="silo-card__content"><h3 class="silo-card__title">' + p.label + '</h3></div>';
    }
    return a;
  }"""

# ══════════════════════════════════════════════════════════════════
# 4 · the Curator line follows the new label
# ══════════════════════════════════════════════════════════════════

SAY_OLD = """    as_photographed:
      'As photographed, then. There is a real case for it &mdash; it is the face ' +
      'people already recognise, and I will keep it exactly.' +
      '<span class="sign">&mdash; C.</span>',"""

SAY_NEW = """    as_photographed:
      'We keep it, then. There is a real case for that &mdash; it is the face ' +
      'people already recognise, and I will not touch it.' +
      '<span class="sign">&mdash; C.</span>',"""

EDITS = [
    ("preserve css",  CSS_ANCHOR, CSS_NEW),
    ("poses table",   ARR_OLD,    ARR_NEW),
    ("poseCard",      CARD_OLD,   CARD_NEW),
    ("curator line",  SAY_OLD,    SAY_NEW),
]

# ── measure ───────────────────────────────────────────────────────
def count_ids(s):   return len(set(re.findall(r'id="([^"]*)"', s)))
def count_fetch(s): return len(re.findall(r'\bfetch\s*\(', s))
def count_fns(s):   return len(re.findall(r'^\s*(?:async\s+)?function\s+[A-Za-z_$]', s, re.M))
def count_faces(s): return len(re.findall(r'class="face face--', s))
def poses(s):
    m = re.search(r'var POSES = \[(.*?)\n  \];', s, re.S)
    return re.findall(r"id:'([a-z_]+)'", m.group(1)) if m else []

before = dict(ids=count_ids(src), fetch=count_fetch(src), fns=count_fns(src),
              faces=count_faces(src), chars=len(src), poses=poses(src))

for name, old, new in EDITS:
    n = src.count(old)
    assert n == 1, f"anchor '{name}' found {n} times, expected 1"

out = src
for name, old, new in EDITS:
    out = out.replace(old, new, 1)

after = dict(ids=count_ids(out), fetch=count_fetch(out), fns=count_fns(out),
             faces=count_faces(out), chars=len(out), poses=poses(out))

# ── GATE ──────────────────────────────────────────────────────────
fails = []

EXPECTED = ['as_photographed','smiling','laughing','thoughtful','goofy','dramatic']
if after["poses"] != EXPECTED:
    fails.append(f"POSES: expected {EXPECTED}, got {after['poses']}")

# the path is fixed, and the old one is gone
if 'src="/previews/pose/' not in out:
    fails.append("PATH: photograph cards must load from /previews/pose/")
if 'src="/pose/' in out:
    fails.append("PATH: the old /pose/ path survives")

# the preserve card exists and is the only one
if out.count("' preserve'") != 1:
    fails.append("PRESERVE: expected exactly one preserve branch")
for m in ('class="icon-circle"', 'LOCK_SVG', 'Keep My Pose',
          'Preserve your original expression and posture.',
          '.pose-card.preserve{', '.pose-card.preserve::before{',
          '.pose-card .icon-circle{', '.pose-card.preserve h3{',
          '.pose-card.preserve p{'):
    if m not in out:
        fails.append(f"MUST-EXIST: {m}")

# the four scoping deviations held — no unscoped rule may reach the photo cards
for bad in ('.pose-card h3{', '.pose-card p{', '.pose-card::before{'):
    if bad in out:
        fails.append(f"SCOPE LEAK: {bad} would restyle the five photograph cards")

# radius left to .silo-card
if re.search(r'\.pose-card[^{]*\{[^}]*border-radius:\s*12px', out):
    fails.append("RADIUS: 12px would disagree with .silo-card's clamp")

# every pose still has a Curator line
for p in EXPECTED:
    if not re.search(r'^\s+' + p + r':\s*$', out, re.M):
        fails.append(f"MUST-EXIST: POSE_SAY line for {p}")

# structure held
for k in ("ids", "fetch", "faces"):
    if before[k] != after[k]:
        fails.append(f"STRUCTURE: {k} moved {before[k]} -> {after[k]}")
if after["fns"] < before["fns"]:
    fails.append(f"FNS: lost functions {before['fns']} -> {after['fns']}")
if after["fetch"] != 0:
    fails.append(f"FETCH: must stay fetchless, found {after['fetch']}")

# style braces
for sm in re.findall(r'<style[^>]*>(.*?)</style>', out, re.S):
    if sm.count("{") != sm.count("}"):
        fails.append("BRACE: style block unbalanced")

# node --check
for i, sm in enumerate(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', out, re.S)):
    if not sm.strip():
        continue
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as fh:
        fh.write(sm); p = fh.name
    r = subprocess.run(["node", "--check", p], capture_output=True, text=True)
    os.unlink(p)
    if r.returncode != 0:
        fails.append(f"NODE --CHECK: block {i} — {r.stderr.strip().splitlines()[0]}")

print("BUILD s61 -> s62   pose path + Keep My Pose card")
print("-" * 58)
print(f"  poses: {', '.join(after['poses'])}")
for k in ("ids", "fetch", "fns", "faces"):
    print(f"  {k:<7} {before[k]:>6}  ->  {after[k]:>6}")
print(f"  {'chars':<7} {before['chars']:>6}  ->  {after['chars']:>6}")
print("-" * 58)

if fails:
    print("GATE FAILED — nothing written")
    for f_ in fails:
        print("  x " + f_)
    sys.exit(1)

open(OUT, "w", encoding="utf-8").write(out)
print("GATE PASSED")
print(f"written: {OUT}")
