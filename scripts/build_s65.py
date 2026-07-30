#!/usr/bin/env python3
"""
BUILD s64 -> s65   the queue rail at 1366, and the squashed lock
CUI V23 · 2026-07-29 · ruled by Rich in session

CHANGE 1 · QUEUE RAIL 170px -> 200px AT 1366, PAID FOR BY THE GUTTERS

  Measured in s64 at the <=1366 band: --queue-w:170px, --spine-w:280px,
  --room-gap:12px, gutter 68.3px each side, stage 1229.4px (90%).

  The rail needs 30px. Taking it from the workshop would squeeze the floor;
  Rich ruled it comes from the gutters. So 15px off each side.

    gutter   68.3px -> 53.3px   (5% -> 3.9%)
    stage    1229.4 -> 1259.4   (90% -> 92.2%)
    queue    170    -> 200
    workshop 755    -> 755      unchanged, which is the point

  The stage is now DERIVED from the gutter at this band rather than declared
  alongside it:

    --stage-gutter:3.9%;
    --stage-w:calc(100% - (var(--stage-gutter) * 2));

  In :root the two are stated separately and happen to agree — 90% plus two
  5% gutters is 100% by arithmetic, not by construction. Two independent
  declarations that must sum correctly is a thing that can drift. Deriving
  one from the other means it cannot. The masthead already reads
  --stage-gutter for its inset, so the wordmark follows the new edge with
  no second edit.

CHANGE 2 · THE LOCK WAS AN ELLIPSE

  Visible in Rich's 1366 screenshot. .pose-card.preserve is a flex column;
  flex-shrink defaults to 1 and acts on the MAIN axis, which in a column is
  height. At 1366 the card is 176x330 and its contents — 42px padding, a
  112px circle, a two-line title, a four-line description, 42px padding —
  ask for more than 330. So the circle gave up height and stopped being
  round. `flex:0 0 auto` refuses.

  A circle that is not round is not a small thing. It is the one shape on
  the surface whose correctness is self-evident.

CHANGE 3 · THE PRESERVE CARD FITS AT 1366 — proposed, not ruled

  Refusing to shrink only moves the problem: the content still asks for more
  room than the card has. Rich's values were judged at 1920/2560, where they
  fit. At <=1366 they are scaled down proportionally — padding, gap, circle,
  and the two type sizes. Flagged rather than buried; one block to delete if
  he would rather it clip.

  Rich's original values are untouched at every band above 1366.

DOCUMENT CORRECTION FOR RICH — not a code change
  SURFACE-TOKENS says --mh-h is 90px. The file ramps it 90/76/60 by band and
  Rich has confirmed 60px at 1366 is correct. The token table describes only
  the topmost band. Per PROCEDURES §9 the file wins and the document is
  corrected the same day.
"""

import re, sys, subprocess, os, json

SRC = "/home/claude/litenco-stage-2026-07-29-s64.html"
OUT = "/home/claude/litenco-stage-2026-07-29-s65.html"

src = open(SRC, encoding="utf-8").read()

# ══════════════════════════════════════════════════════════════════
# 1 · the 1366 band — rail to 200px, gutters pay
# ══════════════════════════════════════════════════════════════════

BAND_OLD = """@media (max-width:1366px){
  :root{
    --spine-w:280px;
    --rail-w:48px;
    --queue-w:170px;
    --room-gap:12px;"""

BAND_NEW = """@media (max-width:1366px){
  :root{
    --spine-w:280px;
    --rail-w:48px;
    /* 200px, not 170. The rail holds a thumbnail, a name, a series and a
       remove — 170 was starving it. The 30px comes off the gutters rather
       than the workshop, so the floor keeps its 755px. */
    --queue-w:200px;
    /* 5% -> 3.9%: 68.3px each side becomes 53.3px. The stage is derived from
       the gutter here rather than declared beside it, so the two can never
       disagree. The masthead reads --stage-gutter for its inset, so the
       wordmark follows this edge with no second edit. */
    --stage-gutter:3.9%;
    --stage-w:calc(100% - (var(--stage-gutter) * 2));
    --room-gap:12px;"""

# ══════════════════════════════════════════════════════════════════
# 2 · the circle refuses to shrink
# ══════════════════════════════════════════════════════════════════

CIRCLE_OLD = """.pose-card .icon-circle{
  display:flex; align-items:center; justify-content:center;
  width:112px; height:112px;"""

CIRCLE_NEW = """.pose-card .icon-circle{
  display:flex; align-items:center; justify-content:center;
  /* flex-shrink defaults to 1 and acts on the column's main axis — height.
     Where the card's contents ask for more room than the card has, the
     circle was the thing that gave, and it stopped being a circle. */
  flex:0 0 auto;
  width:112px; height:112px;"""

# ══════════════════════════════════════════════════════════════════
# 3 · the preserve card at 1366 — proposed
# ══════════════════════════════════════════════════════════════════

FIT_ANCHOR = """  .tbc{ padding:14px 10px }"""

FIT_NEW = """  .tbc{ padding:14px 10px }
  /* PROPOSED, not ruled. Rich's preserve-card values were judged at 1920 and
     2560, where they fit. At 176x330 they ask for more height than the card
     has — the circle refusing to shrink is correct but does not create room.
     Scaled proportionally here and nowhere else. Delete this block to go
     back to clipping. */
  .pose-card.preserve{ padding:24px 16px; gap:12px }
  .pose-card .icon-circle{ width:82px; height:82px }
  .pose-card .icon-circle svg{ width:32px; height:32px }
  .pose-card.preserve h3{ font-size:1.45rem }
  .pose-card.preserve p{ font-size:.82rem; line-height:1.5; max-width:none }"""

EDITS = [
    ("1366 band",    BAND_OLD,   BAND_NEW),
    ("icon circle",  CIRCLE_OLD, CIRCLE_NEW),
    ("preserve fit", FIT_ANCHOR, FIT_NEW),
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

# ══════════════════════════════════════════════════════════════════
# GATES
# ══════════════════════════════════════════════════════════════════

for k in ("ids", "fetch", "fns", "faces"):
    if before[k] != after[k]:
        fails.append(f"STRUCTURE: {k} moved {before[k]} -> {after[k]}")
if after["fetch"] != 0:
    fails.append(f"FETCH: must stay fetchless, found {after['fetch']}")

MUST = [
    "--queue-w:200px",
    "--stage-gutter:3.9%",
    "--stage-w:calc(100% - (var(--stage-gutter) * 2))",
    "flex:0 0 auto;\n  width:112px; height:112px;",
]
for m in MUST:
    if m not in out:
        fails.append(f"MUST-EXIST: {m}")

if "--queue-w:170px" in out:
    fails.append("STALE: the 170px rail survives")

# the gutter and stage must still sum to the viewport at 1366
# 92.2% + 2 * 3.9% = 100%
band = re.search(r'@media \(max-width:1366px\)\{\s*:root\{(.*?)\n  \}', out, re.S).group(1)
g = re.search(r'--stage-gutter:([\d.]+)%', band)
if not g:
    fails.append("GEOMETRY: no gutter override in the 1366 band")
else:
    gut = float(g.group(1))
    if abs((100 - 2 * gut) - 92.2) > 0.05:
        fails.append(f"GEOMETRY: gutter {gut}% leaves {100-2*gut}% stage, expected 92.2%")
    # the rail must actually gain 30px at 1366
    stage_px = 1366 * (100 - 2 * gut) / 100
    if abs(stage_px - 1259.4) > 1.5:
        fails.append(f"GEOMETRY: stage resolves to {stage_px:.1f}px at 1366, expected ~1259.4")
    # and the workshop must be unchanged: 1259.4 - 280 - 24 - 200 = 755.4
    workshop_px = stage_px - 280 - 24 - 200
    if abs(workshop_px - 755.4) > 1.5:
        fails.append(f"GEOMETRY: workshop resolves to {workshop_px:.1f}px, expected ~755.4 (unchanged)")

# masthead untouched — Rich confirmed 60px at 1366 is right
if "--mh-h:60px" not in out:
    fails.append("MASTHEAD: the confirmed 60px at 1366 must not move")

# radius gate. The standing rule is <=8px, EXCEPT a pill radius where the
# constrained dimension is <=72px, or a true circle. So three legal bands:
# card curves (<=13px, covering the .silo-card clamp's 12.8px ceiling),
# pills (>=99px, which resolve to a capsule at any height), and 50%.
# The illegal range is the middle — neither a curve nor a capsule.
for m in re.findall(r'border-radius:\s*(\d+)px', out):
    v = int(m)
    if 13 < v < 99:
        fails.append(f"RADIUS: {v}px is neither a card curve nor a pill")

# style braces
for sm in re.findall(r'<style[^>]*>(.*?)</style>', out, re.S):
    if sm.count("{") != sm.count("}"):
        fails.append(f"BRACE: style block unbalanced {sm.count('{')} vs {sm.count('}')}")

# node --check
import tempfile
for i, sm in enumerate(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', out, re.S)):
    if not sm.strip():
        continue
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as fh:
        fh.write(sm); p = fh.name
    r = subprocess.run(["node", "--check", p], capture_output=True, text=True)
    os.unlink(p)
    if r.returncode != 0:
        fails.append(f"NODE --CHECK: block {i} — {r.stderr.strip().splitlines()[0]}")

# ══════════════════════════════════════════════════════════════════
# BOOT GATE — added in s64, and it stays
# ══════════════════════════════════════════════════════════════════

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
  console.log(JSON.stringify({ errors, probes: {
    verb:        txt('tbcGoVerb'),
    sub:         txt('tbcGoSub'),
    siloCards:   d.querySelectorAll('.face--silos .silo-card').length,
    faces:       d.querySelectorAll('.face').length,
    poseFloor:   !!d.getElementById('poseFloor'),
    poseGlobals: typeof dom.window.POSES,
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
        fails.append(f"BOOT ALIVE: tbcGoVerb should read 'Next', got {p['verb']!r}")
    if not p["sub"] or "Step 1 of 2" not in p["sub"]:
        fails.append(f"BOOT ALIVE: tbcGoSub should carry 'Step 1 of 2', got {p['sub']!r}")
    if p["siloCards"] != 8:
        fails.append(f"BOOT ALIVE: expected 8 silo cards, got {p['siloCards']}")
    if p["faces"] != 3:
        fails.append(f"BOOT ALIVE: expected 3 faces, got {p['faces']}")
    if p["poseGlobals"] != "object":
        fails.append(f"BOOT ALIVE: window.POSES should be object, got {p['poseGlobals']!r}")

# ── report ────────────────────────────────────────────────────────
print("BUILD s64 -> s65   queue rail 200 at 1366, round lock")
print("-" * 58)
for k in ("ids", "fetch", "fns", "faces"):
    print(f"  {k:<7} {before[k]:>6}  ->  {after[k]:>6}")
print("-" * 58)
print("  at 1366, computed:")
print("    gutter    68.3px  ->  53.3px   each side")
print("    stage    1229.4   -> 1259.4")
print("    queue     170     ->  200")
print("    workshop  755     ->  755      unchanged")
if boot_report:
    print("-" * 58)
    print(f"  boot errors  {len(boot_report['errors'])}")
    print(f"  button       {boot_report['probes']['verb']!r} / {boot_report['probes']['sub']!r}")
print("-" * 58)

if fails:
    print("GATE FAILED — nothing written")
    for f_ in fails:
        print("  x " + f_)
    sys.exit(1)

open(OUT, "w", encoding="utf-8").write(out)
print("GATE PASSED")
print(f"written: {OUT}")
