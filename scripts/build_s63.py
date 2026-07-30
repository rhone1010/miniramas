#!/usr/bin/env python3
"""
BUILD s62 -> s63   two named steps, one chosen pose
CUI V23 · 2026-07-29 · ruled by Rich in session

THE PROBLEM RICH NAMED
  The rail said 'Craft this piece' and then did not craft — it opened the
  pose floor and asked again. The friction was never the extra click. It
  was that the first press lied about what it did.

THE FIX
  The button always names the press. 'Craft' is said once, and it crafts.

    effects / silos floor    Next · choose a pose      Step 1 of 2 · N credits
    pose floor               Craft this piece          Step 2 of 2 · N credits

  Credits are quoted at both steps, so the cost is known before the pose is
  asked for and nothing new appears at the end. No percentage, no dollars —
  COMMERCE §2, the ladder belongs to the purchase.

FOUR CHANGES

1 · 'Craft' comes out of the markup into a span so the verb can change.
    It was hardcoded outside #tbcGoN, which is why the label could not move.

2 · KEEP MY POSE IS PRESELECTED. Anyone indifferent to pose lands on the
    floor, sees a choice already made, and presses Craft. The step costs
    them a glance instead of a decision. It also removes the null state.

3 · A pose click SELECTS AND STOPS. In s62 it selected and fired the paywall
    hook, which is exactly what made the second press feel redundant.
    Separating them is what makes the step honest.

4 · The chosen pose is lit and the other five go quiet. Gold, not the
    oxblood of .silo-card.is-selected — oxblood means 'added to the queue',
    which is a running total. Gold means 'this is the one', which is a
    single choice. Two different ideas deserve two different colours, and
    the preserve card already wears gold.

THE SEAM IS UNCHANGED
  window.__openPaywall() still does not exist. It has simply moved from the
  card click to the Craft press, which is where it belongs.

Gate: assertion-based. Writes output only if every assertion passes.
"""

import re, sys, subprocess, tempfile, os

SRC = "/home/claude/litenco-stage-2026-07-29-s62.html"
OUT = "/home/claude/litenco-stage-2026-07-29-s63.html"

src = open(SRC, encoding="utf-8").read()

# ══════════════════════════════════════════════════════════════════
# 1 · MARKUP — the verb becomes addressable
# ══════════════════════════════════════════════════════════════════

BTN_OLD = """          <button class="tbc-go" id="tbcGo" type="button">
            Craft <span id="tbcGoN"></span>
            <small id="tbcGoSub"></small>
          </button>"""

BTN_NEW = """          <button class="tbc-go" id="tbcGo" type="button">
            <span id="tbcGoVerb">Craft</span> <span id="tbcGoN"></span>
            <small id="tbcGoSub"></small>
          </button>"""

# ══════════════════════════════════════════════════════════════════
# 2 · CSS — the chosen pose, and the five that are not
# ══════════════════════════════════════════════════════════════════

CSS_ANCHOR = """.pose-card.preserve p{
  max-width:250px;
  margin:0;
  font-size:.95rem; line-height:1.65;
  color:rgba(255,255,255,.72);
}"""

CSS_NEW = CSS_ANCHOR + """

/* ---- the chosen pose --------------------------------------------------- */
/* One only. Gold rather than the oxblood of .silo-card.is-selected: oxblood
   is 'added to a running total', gold is 'this is the one'. A single choice
   and a growing queue should never look the same. */
.pose-card{ transition:opacity 220ms ease, border-color 180ms ease, box-shadow 180ms ease }
.floor.has-choice .pose-card{ opacity:.58 }
.floor.has-choice .pose-card.is-chosen{ opacity:1 }
.pose-card.is-chosen{
  border-color:rgba(201,166,96,.7);
  box-shadow:
    inset 0 0 0 .16rem rgba(201,166,96,.28),
    inset 0 .8rem 1.8rem rgba(18,12,8,.14),
    0 .5rem 1.1rem rgba(52,36,25,.14);
}
/* the tick is CSS — nothing to keep in step in JavaScript */
.pose-card.is-chosen::after{
  content:"\\2713";
  position:absolute; z-index:5; top:.6rem; right:.6rem;
  display:grid; place-items:center;
  width:1.7rem; height:1.7rem;
  border-radius:50%;
  background:rgba(201,166,96,.94);
  color:#3a2a12;
  font-family:var(--sans); font-size:.9rem; font-weight:700; line-height:1;
  box-shadow:0 .2rem .5rem rgba(18,12,8,.3);
}"""

# ══════════════════════════════════════════════════════════════════
# 3 · JS — the verb element
# ══════════════════════════════════════════════════════════════════

VAR_OLD = """  var tbcGoN = document.getElementById('tbcGoN');"""
VAR_NEW = """  var tbcGoVerb = document.getElementById('tbcGoVerb');
  var tbcGoN = document.getElementById('tbcGoN');"""

# ══════════════════════════════════════════════════════════════════
# 4 · JS — renderQueue hands the label to labelGo
# ══════════════════════════════════════════════════════════════════

RQ_OLD = """    tbcGoN.textContent = n === 1 ? 'this piece' : ('all ' + n);
    if (UPSELL_CTX && effFloor.querySelector('.is-upsell')) repaintUpsell(UPSELL_CTX.silo, UPSELL_CTX.list);
    /* No percentage, no dollars. The ladder belongs to the credit purchase —
       quoting it again here charges the customer once and credits them twice. */
    tbcGoSub.textContent = (n * CREDITS_PER_IMAGE) + ' credits';"""

RQ_NEW = """    if (UPSELL_CTX && effFloor.querySelector('.is-upsell')) repaintUpsell(UPSELL_CTX.silo, UPSELL_CTX.list);
    /* The button names the press, and which press depends on the floor.
       One writer for that label — see labelGo(). */
    labelGo();"""

# ══════════════════════════════════════════════════════════════════
# 5 · JS — preselect, single-select, labelGo, and the press dispatcher
# ══════════════════════════════════════════════════════════════════

POSE_OLD = """  var poseFloor  = document.getElementById('poseFloor');
  var crumbLabel = document.getElementById('crumbLabel');
  var POSE_FROM  = 'effects';   /* which face Craft was pressed from */
  var POSE       = null;        /* the chosen pose id, queue-wide */"""

POSE_NEW = """  var poseFloor  = document.getElementById('poseFloor');
  var crumbLabel = document.getElementById('crumbLabel');
  var POSE_FROM  = 'effects';   /* which face the Next press came from */
  /* Preselected. Someone who does not care about pose sees a choice already
     made and presses Craft — the step costs a glance, not a decision. It
     also means there is no null state to design around. */
  var POSE       = 'as_photographed';

  /* ---- the label on the rail button ------------------------------------
     Sole writer. 'Craft' is said once, on the floor where pressing it
     crafts. Anywhere else the button says what it actually does. */
  function labelGo(){
    if (!tbcGoVerb || !tbcGoN || !tbcGoSub) return;
    var n = QUEUE.length;
    var credits = (n * CREDITS_PER_IMAGE) + ' credits';
    if (workshop.classList.contains('workshop-view--poses')){
      tbcGoVerb.textContent = 'Craft';
      tbcGoN.textContent    = n === 1 ? 'this piece' : ('all ' + n);
      tbcGoSub.textContent  = 'Step 2 of 2 \\u00b7 ' + credits;
    } else {
      tbcGoVerb.textContent = 'Next';
      tbcGoN.textContent    = '\\u00b7 choose a pose';
      tbcGoSub.textContent  = 'Step 1 of 2 \\u00b7 ' + credits;
    }
  }"""

# ── choosePose: select only, no advance ───────────────────────────
CHOOSE_OLD = """  /* One click. The pose is recorded and the paywall takes over.
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
  }"""

CHOOSE_NEW = """  /* Selects, and stops. In the first cut this also fired the paywall, which
     is what made the following Craft press feel like being asked twice.
     The press belongs to the rail button; the card only chooses. */
  function choosePose(id){
    POSE = id;
    window.__POSE = id;
    poseFloor.classList.add('has-choice');
    [].forEach.call(poseFloor.children, function(el){
      el.classList.toggle('is-chosen', el.dataset.pose === id);
    });
    say(POSE_SAY[id] || POSE_SAY.intro);
  }"""

# ── openPoses: light the preselection, name the step ──────────────
OPEN_OLD = """      poseFloor.innerHTML = '';
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
      workshop.classList.add('workshop-view--poses');"""

OPEN_NEW = """      poseFloor.innerHTML = '';
      POSES.forEach(function(p){
        var el = poseCard(p);
        if (p.id === POSE) el.classList.add('is-chosen');
        poseFloor.appendChild(el);
      });
      poseFloor.dataset.count = POSES.length;
      poseFloor.classList.add('has-choice');   /* one is already chosen */
      if (crumbHere)  crumbHere.textContent  = 'Step 2 \\u00b7 the pose';
      if (crumbLabel) crumbLabel.textContent = 'Back to the finishes';
      say(POSE_SAY.intro);
      workshop.classList.remove('workshop-view--' + POSE_FROM);
      workshop.classList.add('workshop-view--poses');
      labelGo();"""

# ── backFromPoses: restore the step-1 label ───────────────────────
BACK_OLD = """      if (crumbLabel) crumbLabel.textContent = 'All effects';
      if (POSE_FROM === 'silos' && cur && cur.dataset.state !== 'empty') say(SAY.photo);
      workshop.classList.remove('workshop-view--poses');
      workshop.classList.add('workshop-view--' + POSE_FROM);"""

BACK_NEW = """      if (crumbLabel) crumbLabel.textContent = 'All effects';
      if (POSE_FROM === 'silos' && cur && cur.dataset.state !== 'empty') say(SAY.photo);
      workshop.classList.remove('workshop-view--poses');
      workshop.classList.add('workshop-view--' + POSE_FROM);
      labelGo();"""

# ── the press dispatcher ──────────────────────────────────────────
GO_OLD = """  var tbcGo = document.getElementById('tbcGo');
  if (tbcGo) tbcGo.addEventListener('click', openPoses);"""

GO_NEW = """  /* Step 1 opens the pose floor. Step 2 crafts. One button, and it never
     claims to do the other one's job.
     __openPaywall does not exist — that is item 5, and this build must not
     invent its contract. Until it lands, Craft on the pose floor is where
     the flow stops. */
  var tbcGo = document.getElementById('tbcGo');
  if (tbcGo) tbcGo.addEventListener('click', function(){
    if (workshop.classList.contains('workshop-view--poses')){
      if (typeof window.__openPaywall === 'function') window.__openPaywall(POSE);
    } else {
      openPoses();
    }
  });"""

EDITS = [
    ("verb span",     BTN_OLD,    BTN_NEW),
    ("chosen css",    CSS_ANCHOR, CSS_NEW),
    ("verb var",      VAR_OLD,    VAR_NEW),
    ("renderQueue",   RQ_OLD,     RQ_NEW),
    ("preselect",     POSE_OLD,   POSE_NEW),
    ("choosePose",    CHOOSE_OLD, CHOOSE_NEW),
    ("openPoses",     OPEN_OLD,   OPEN_NEW),
    ("backFromPoses", BACK_OLD,   BACK_NEW),
    ("dispatcher",    GO_OLD,     GO_NEW),
]

# ── measure ───────────────────────────────────────────────────────
def count_ids(s):   return len(set(re.findall(r'id="([^"]*)"', s)))
def count_fetch(s): return len(re.findall(r'\bfetch\s*\(', s))
def count_fns(s):   return len(re.findall(r'^\s*(?:async\s+)?function\s+[A-Za-z_$]', s, re.M))
def count_faces(s): return len(re.findall(r'class="face face--', s))

before = dict(ids=count_ids(src), fetch=count_fetch(src), fns=count_fns(src),
              faces=count_faces(src), chars=len(src))

for name, old, new in EDITS:
    n = src.count(old)
    assert n == 1, f"anchor '{name}' found {n} times, expected 1"

out = src
for name, old, new in EDITS:
    out = out.replace(old, new, 1)

after = dict(ids=count_ids(out), fetch=count_fetch(out), fns=count_fns(out),
             faces=count_faces(out), chars=len(out))

# ── GATE ──────────────────────────────────────────────────────────
fails = []

MUST = [
    'id="tbcGoVerb"',
    'function labelGo',
    "var POSE       = 'as_photographed'",       # preselected
    "poseFloor.classList.add('has-choice')",
    "el.classList.toggle('is-chosen'",
    '.pose-card.is-chosen{',
    '.pose-card.is-chosen::after{',
    '.floor.has-choice .pose-card{ opacity:.58 }',
    'Step 1 of 2',
    'Step 2 of 2',
    "tbcGoVerb.textContent = 'Craft'",
    "tbcGoVerb.textContent = 'Next'",
    'window.__openPaywall',
]
for m in MUST:
    if m not in out:
        fails.append(f"MUST-EXIST: {m}")

# the card click must no longer advance
if re.search(r"function choosePose\(id\)\{(?:(?!\n  \})[\s\S])*__openPaywall", out):
    fails.append("ADVANCE: choosePose still fires the paywall — the second press will read as being asked twice")

# 'Craft' must be said in exactly one place in the label logic
if out.count("tbcGoVerb.textContent = 'Craft'") != 1:
    fails.append("VERB: 'Craft' must be written by exactly one branch")

# the verb is no longer hardcoded loose in the markup
if re.search(r'>\s*\n\s+Craft <span id="tbcGoN">', out):
    fails.append("MARKUP: 'Craft' still hardcoded outside a span")

# renderQueue must not write the label directly any more — one writer only
if re.search(r"tbcGoN\.textContent = n === 1 \? 'this piece'[\s\S]{0,400}?tbcGoSub\.textContent = \(n \* CREDITS_PER_IMAGE\)", out):
    fails.append("TWO WRITERS: renderQueue still sets the label alongside labelGo")

# is-selected must not be used for pose — that is the queue's colour
if re.search(r"pose[\s\S]{0,200}?classList\.toggle\('is-selected'", out):
    fails.append("COLOUR: pose cards must use is-chosen, not the queue's is-selected")

# no dollars, no percentages on the craft path
for bad in ('% saved', '$'):
    if bad in out.split('THE POSE ·')[-1]:
        fails.append(f"COMMERCE §2: '{bad}' must not appear on the craft path")

# structure held
for k in ("ids", "fetch", "faces"):
    if k == "ids":
        if after[k] != before[k] + 1:
            fails.append(f"IDS: expected +1 (tbcGoVerb), got {before[k]} -> {after[k]}")
    elif before[k] != after[k]:
        fails.append(f"STRUCTURE: {k} moved {before[k]} -> {after[k]}")
if after["fetch"] != 0:
    fails.append(f"FETCH: must stay fetchless, found {after['fetch']}")
if after["fns"] != before["fns"] + 1:
    fails.append(f"FNS: expected +1 (labelGo), got {before['fns']} -> {after['fns']}")

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

print("BUILD s62 -> s63   two named steps, one chosen pose")
print("-" * 58)
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
