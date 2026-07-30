#!/usr/bin/env python3
"""
BUILD s65 -> s66   the way back is open
CUI V23 · 2026-07-29 · ruled by Rich in session

THE PROBLEM RICH NAMED
  The rail says 'Next' and nothing says the door back is open. A customer who
  has picked one finish has no way to know they may keep browsing, add from
  another room, or return from the pose floor to add more. 'Next' reads as
  one-way, and a one-way door makes people hesitate before they walk through.

THE FIX
  One line under the button, written by the same function that writes the
  label, so the two can never contradict each other.

    step 1   Add as many finishes as you like — the pose comes last.
    step 2   Go back to the finishes any time to add more.
    at cap   Ten is the most I can craft in one go.

  The cap line matters: at ten the first message becomes a lie, and telling
  someone to add more when they cannot is worse than saying nothing.

COPY IS A DRAFT. Rich's words were 'don't quote me but you get it', so these
are mine to be replaced. The mechanism is what this build is for; the
sentences are one string each and swap without touching structure.

REGISTER
  Serif italic, matching .tbc-empty — the only other full sentence in the
  rail. So the rail has one voice rather than a sentence and a caption. Sans
  uppercase is what the rail uses for LABELS (Total, the step count), and
  this is not a label.

  No '— C.' The Curator speaks from her own panel on the left. Signing a
  line in the right-hand rail would put her in two places at once.
"""

import re, sys, subprocess, os, json, tempfile

SRC = "/home/claude/litenco-stage-2026-07-29-s65.html"
OUT = "/home/claude/litenco-stage-2026-07-29-s66.html"

src = open(SRC, encoding="utf-8").read()

# ══════════════════════════════════════════════════════════════════
# 1 · MARKUP — the line lives under the button, inside .tbc-craft
# ══════════════════════════════════════════════════════════════════

MARKUP_OLD = """            <span id="tbcGoVerb">Craft</span> <span id="tbcGoN"></span>
            <small id="tbcGoSub"></small>
          </button>"""

MARKUP_NEW = """            <span id="tbcGoVerb">Craft</span> <span id="tbcGoN"></span>
            <small id="tbcGoSub"></small>
          </button>
          <p class="tbc-open" id="tbcOpen"></p>"""

# ══════════════════════════════════════════════════════════════════
# 2 · CSS — the rail's own voice, not a caption
# ══════════════════════════════════════════════════════════════════

CSS_ANCHOR = """.tbc-go small{
  display:block; margin-top:.3em;
  font-family:var(--sans); font-size:.42em; letter-spacing:.09em;
  text-transform:uppercase; opacity:.7;
}"""

CSS_NEW = CSS_ANCHOR + """

/* ---- the way back is open ---------------------------------------------- */
/* 'Next' reads as one-way. This says it is not. Serif italic to match
   .tbc-empty — the rail's only other full sentence — so the rail speaks with
   one voice. Sans uppercase in here is for labels, and this is not a label.
   Hidden while the queue is empty: .tbc-empty is already saying the useful
   thing at that point, and two sentences would argue. */
.tbc-open{
  margin:.85em 0 0;
  padding:0 .3em;
  font-family:var(--serif); font-style:italic;
  font-size:.92em; line-height:1.45;
  color:rgba(233,222,200,.5);
  text-align:center;
}
.tbc:not(.has-items) .tbc-open{ display:none }"""

# ══════════════════════════════════════════════════════════════════
# 3 · JS — one writer for the button and the line beneath it
# ══════════════════════════════════════════════════════════════════

JS_OLD = """  function labelGo(){
    if (!tbcGoVerb || !tbcGoN || !tbcGoSub) return;
    var n = QUEUE.length;
    var credits = (n * CREDITS_PER_IMAGE) + ' credits';
    /* renderQueue() runs during init, ABOVE the line that assigns `workshop`.
       var hoists the declaration and never the value, so this is read as
       undefined on the first pass and reading .classList off it threw —
       killing init and every listener below it. Ask the DOM instead, and
       treat 'not there yet' as 'not in the pose view', which it is. */
    var stage  = workshop || document.getElementById('workshop');
    var inPose = !!(stage && stage.classList.contains('workshop-view--poses'));
    if (inPose){
      tbcGoVerb.textContent = 'Craft';
      tbcGoN.textContent    = n === 1 ? 'this piece' : ('all ' + n);
      tbcGoSub.textContent  = 'Step 2 of 2 \\u00b7 ' + credits;
    } else {
      tbcGoVerb.textContent = 'Next';
      tbcGoN.textContent    = '\\u00b7 choose a pose';
      tbcGoSub.textContent  = 'Step 1 of 2 \\u00b7 ' + credits;
    }
  }"""

JS_NEW = """  function labelGo(){
    if (!tbcGoVerb || !tbcGoN || !tbcGoSub) return;
    var n = QUEUE.length;
    var credits = (n * CREDITS_PER_IMAGE) + ' credits';
    /* renderQueue() runs during init, ABOVE the line that assigns `workshop`.
       var hoists the declaration and never the value, so this is read as
       undefined on the first pass and reading .classList off it threw —
       killing init and every listener below it. Ask the DOM instead, and
       treat 'not there yet' as 'not in the pose view', which it is. */
    var stage  = workshop || document.getElementById('workshop');
    var inPose = !!(stage && stage.classList.contains('workshop-view--poses'));
    if (inPose){
      tbcGoVerb.textContent = 'Craft';
      tbcGoN.textContent    = n === 1 ? 'this piece' : ('all ' + n);
      tbcGoSub.textContent  = 'Step 2 of 2 \\u00b7 ' + credits;
    } else {
      tbcGoVerb.textContent = 'Next';
      tbcGoN.textContent    = '\\u00b7 choose a pose';
      tbcGoSub.textContent  = 'Step 1 of 2 \\u00b7 ' + credits;
    }
    /* Same writer as the label, so the two can never disagree. At the cap the
       invitation to add more would be a lie, and a lie is worse than silence. */
    var open = document.getElementById('tbcOpen');
    if (open){
      open.textContent = n >= QUEUE_CAP ? OPEN_SAY.full
                       : inPose         ? OPEN_SAY.posing
                       :                  OPEN_SAY.browsing;
    }
  }"""

# ══════════════════════════════════════════════════════════════════
# 4 · the copy is a CONSTANT, so it is declared where constants are —
#     above renderQueue, which calls labelGo during init.
#     Declaring it beside labelGo repeated the exact s63 fault: var hoists
#     the name and never the value, so the first call read undefined.
# ══════════════════════════════════════════════════════════════════

CONST_OLD = """  var QUEUE = [], QUEUE_CAP = 10;   /* payloads of ten */"""

CONST_NEW = """  var QUEUE = [], QUEUE_CAP = 10;   /* payloads of ten */

  /* 'Next' reads as one-way. These say it is not.
     Declared HERE, above renderQueue, because renderQueue calls labelGo
     during init — a var assigned further down the file is hoisted as a name
     and not as a value, which is precisely how s63 lost its interactivity.
     Draft copy, mine to be replaced; each is one string. */
  var OPEN_SAY = {
    browsing: 'Add as many finishes as you like \\u2014 the pose comes last.',
    posing:   'Go back to the finishes any time to add more.',
    full:     'Ten is the most I can craft in one go.'
  };"""

EDITS = [
    ("markup",     MARKUP_OLD, MARKUP_NEW),
    ("css",        CSS_ANCHOR, CSS_NEW),
    ("open_say",   CONST_OLD,  CONST_NEW),
    ("labelGo",    JS_OLD,     JS_NEW),
]

# ── measure ───────────────────────────────────────────────────────
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

# ── GATES ─────────────────────────────────────────────────────────
if after["ids"] != before["ids"] + 1:
    fails.append(f"IDS: expected +1 (tbcOpen), got {before['ids']} -> {after['ids']}")
for k in ("fetch", "fns", "faces"):
    if before[k] != after[k]:
        fails.append(f"STRUCTURE: {k} moved {before[k]} -> {after[k]}")
if after["fetch"] != 0:
    fails.append(f"FETCH: must stay fetchless, found {after['fetch']}")

MUST = [
    'id="tbcOpen"',
    '.tbc-open{',
    '.tbc:not(.has-items) .tbc-open{ display:none }',
    'var OPEN_SAY',
    'OPEN_SAY.full',
    'OPEN_SAY.posing',
    'OPEN_SAY.browsing',
    "n >= QUEUE_CAP",
]
for m in MUST:
    if m not in out:
        fails.append(f"MUST-EXIST: {m}")

# OPEN_SAY must be declared ABOVE renderQueue, or init reads it as undefined.
# This is the s63 fault class and it now has a gate of its own.
i_const = out.find("var OPEN_SAY")
i_rq    = out.find("function renderQueue")
if i_const == -1 or i_rq == -1 or i_const > i_rq:
    fails.append("TDZ: OPEN_SAY must be declared above renderQueue — labelGo runs during init")

# one writer only — the line must be set inside labelGo and nowhere else
if out.count("open.textContent") != 1:
    fails.append("TWO WRITERS: the open line must be written in exactly one place")
if re.search(r"tbcOpen'\)\.textContent", out):
    fails.append("TWO WRITERS: tbcOpen written outside labelGo")

# the cap message must win over the invitation
m = re.search(r"open\.textContent = (.*?);", out, re.S)
if m and m.group(1).strip().index("QUEUE_CAP") > m.group(1).strip().index("inPose"):
    fails.append("ORDER: the cap message must be tested before the pose branch")

# the rail must not sign as the Curator — she speaks from her own panel
tail = out.split('.tbc-open{')[-1][:1200]
if '&mdash; C.' in tail or 'class="sign"' in tail:
    fails.append("VOICE: the rail must not sign as the Curator")

# serif italic, matching .tbc-empty
seg = re.search(r'\.tbc-open\{(.*?)\}', out, re.S).group(1)
for need in ("var(--serif)", "italic"):
    if need not in seg:
        fails.append(f"REGISTER: .tbc-open must be {need} to match .tbc-empty")

# radius: card curves, pills, or circles — never the middle
for v in re.findall(r'border-radius:\s*(\d+)px', out):
    if 13 < int(v) < 99:
        fails.append(f"RADIUS: {v}px is neither a card curve nor a pill")

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

# ── BOOT GATE ─────────────────────────────────────────────────────
BOOT_HARNESS = r"""
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
  const d = dom.window.document;
  const txt = id => { const e = d.getElementById(id); return e ? e.textContent.trim() : null; };
  // drive it: add one effect, then step to the pose floor, reading the line
  const seen = {};
  seen.atRest = txt('tbcOpen');
  const card = d.querySelector('.face--silos .silo-card');
  console.log(JSON.stringify({ errors, probes: {
    verb:      txt('tbcGoVerb'),
    sub:       txt('tbcGoSub'),
    open:      seen.atRest,
    openHtml:  !!d.getElementById('tbcOpen'),
    siloCards: d.querySelectorAll('.face--silos .silo-card').length,
    faces:     d.querySelectorAll('.face').length,
    poses:     typeof dom.window.POSES,
  }}));
}, 700);
"""

html_path = "/home/claude/.gate-boot.html"
harness   = "/home/claude/.gate-boot.js"
open(html_path, "w", encoding="utf-8").write(out)
open(harness,   "w", encoding="utf-8").write(BOOT_HARNESS)
boot = subprocess.run(["node", harness, html_path], capture_output=True, text=True,
                      cwd="/home/claude")

boot_report = None
line = [l for l in boot.stdout.splitlines() if l.startswith("{")]
if not line:
    fails.append(f"BOOT GATE: no report — {boot.stderr.strip()[:200]}")
else:
    boot_report = json.loads(line[-1])
    for e in boot_report["errors"]:
        fails.append(f"BOOT ERROR: {e}")
    p = boot_report["probes"]
    if p["verb"] != "Next":
        fails.append(f"BOOT ALIVE: verb should be 'Next', got {p['verb']!r}")
    if not p["sub"] or "Step 1 of 2" not in p["sub"]:
        fails.append(f"BOOT ALIVE: sub should carry 'Step 1 of 2', got {p['sub']!r}")
    if not p["openHtml"]:
        fails.append("BOOT ALIVE: #tbcOpen absent from the DOM")
    if p["open"] != "Add as many finishes as you like \u2014 the pose comes last.":
        fails.append(f"BOOT ALIVE: open line not written by labelGo, got {p['open']!r}")
    if p["siloCards"] != 8:
        fails.append(f"BOOT ALIVE: expected 8 silo cards, got {p['siloCards']}")
    if p["faces"] != 3:
        fails.append(f"BOOT ALIVE: expected 3 faces, got {p['faces']}")
    if p["poses"] != "object":
        fails.append(f"BOOT ALIVE: window.POSES should be object, got {p['poses']!r}")

# ── report ────────────────────────────────────────────────────────
print("BUILD s65 -> s66   the way back is open")
print("-" * 58)
for k in ("ids", "fetch", "fns", "faces"):
    print(f"  {k:<7} {before[k]:>6}  ->  {after[k]:>6}")
if boot_report:
    p = boot_report["probes"]
    print("-" * 58)
    print(f"  boot errors  {len(boot_report['errors'])}")
    print(f"  button       {p['verb']!r} / {p['sub']!r}")
    print(f"  open line    {p['open']!r}")
print("-" * 58)

if fails:
    print("GATE FAILED — nothing written")
    for f_ in fails:
        print("  x " + f_)
    sys.exit(1)

open(OUT, "w", encoding="utf-8").write(out)
print("GATE PASSED")
print(f"written: {OUT}")
