#!/usr/bin/env python3
"""
BUILD s63 -> s64   TDZ FIX + a boot gate that would have caught it
CUI V23 · 2026-07-29

THE FAULT I SHIPPED
  s63 lost all interactivity. renderQueue() is called during init at
  s63:2190. `var workshop` is not assigned until s63:2284. labelGo() reads
  workshop.classList, so at that moment it read `undefined.classList` and
  threw. The throw killed the init sequence at line 2190, which meant every
  addEventListener below it never ran. The file rendered and did nothing.

  Same class as the PREVIEW_BASE fault in the V22 notes: a symbol used above
  the line that assigns it. `var` hoists the declaration, never the value.

  My s63 gate could not see it. `node --check` proves syntax, and the syntax
  was flawless. Nothing in the gate ever executed the file.

TWO CHANGES

1 · labelGo() no longer assumes workshop exists. It asks.
    The pose view is a fact about the DOM, so read it from the DOM, and
    treat 'the element is not there yet' as 'not in the pose view'.

2 · A JSDOM BOOT GATE, added permanently.
    Every build from here loads the output in a real DOM, runs the scripts,
    and fails on any uncaught error. Per PROCEDURES §10 the gate is the
    deliverable, not the fix — a class of fault that has now cost time twice
    must not be able to recur silently a third time.

    The gate also asserts the file is ALIVE after boot, not merely quiet:
    the rail button must have been labelled by labelGo, and the silo floor
    must have been populated. A file that throws early is silent too.
"""

import re, sys, subprocess, tempfile, os, json

SRC = "/home/claude/litenco-stage-2026-07-29-s63.html"
OUT = "/home/claude/litenco-stage-2026-07-29-s64.html"

src = open(SRC, encoding="utf-8").read()

# ══════════════════════════════════════════════════════════════════
# THE FIX
# ══════════════════════════════════════════════════════════════════

FIX_OLD = """  function labelGo(){
    if (!tbcGoVerb || !tbcGoN || !tbcGoSub) return;
    var n = QUEUE.length;
    var credits = (n * CREDITS_PER_IMAGE) + ' credits';
    if (workshop.classList.contains('workshop-view--poses')){"""

FIX_NEW = """  function labelGo(){
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
    if (inPose){"""

n = src.count(FIX_OLD)
assert n == 1, f"fix anchor found {n} times, expected 1"
out = src.replace(FIX_OLD, FIX_NEW, 1)

# ── measure ───────────────────────────────────────────────────────
def count_ids(s):   return len(set(re.findall(r'id="([^"]*)"', s)))
def count_fetch(s): return len(re.findall(r'\bfetch\s*\(', s))
def count_fns(s):   return len(re.findall(r'^\s*(?:async\s+)?function\s+[A-Za-z_$]', s, re.M))
def count_faces(s): return len(re.findall(r'class="face face--', s))

before = dict(ids=count_ids(src), fetch=count_fetch(src), fns=count_fns(src),
              faces=count_faces(src))
after  = dict(ids=count_ids(out), fetch=count_fetch(out), fns=count_fns(out),
              faces=count_faces(out))

fails = []

# ══════════════════════════════════════════════════════════════════
# STANDING GATES
# ══════════════════════════════════════════════════════════════════

for k in ("ids", "fetch", "fns", "faces"):
    if before[k] != after[k]:
        fails.append(f"STRUCTURE: {k} moved {before[k]} -> {after[k]}")
if after["fetch"] != 0:
    fails.append(f"FETCH: must stay fetchless, found {after['fetch']}")

# the unguarded read must be gone
if re.search(r"if \(workshop\.classList\.contains\('workshop-view--poses'\)\)\{\n      tbcGoVerb", out):
    fails.append("TDZ: labelGo still reads workshop.classList unguarded")
for m in ("var stage  = workshop || document.getElementById('workshop')",
          "var inPose = !!(stage && stage.classList"):
    if m not in out:
        fails.append(f"MUST-EXIST: {m}")

# style braces
for sm in re.findall(r'<style[^>]*>(.*?)</style>', out, re.S):
    if sm.count("{") != sm.count("}"):
        fails.append("BRACE: style block unbalanced")

# node --check — syntax only. It did not catch this fault and never could.
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
# THE NEW GATE — boot it in a real DOM and prove it is alive
# ══════════════════════════════════════════════════════════════════

BOOT_HARNESS = r"""
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push(e.message.split('\n')[0] + ' | ' + (e.stack||'').split('\n')[1]));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(fs.readFileSync(process.argv[2], 'utf8'), {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
});

setTimeout(() => {
  const d = dom.window.document;
  const g = id => d.getElementById(id);
  const txt = id => (g(id) ? g(id).textContent.trim() : null);

  // ALIVE, not merely quiet. A file that throws at line 1 is also silent.
  const probes = {
    verb:        txt('tbcGoVerb'),
    sub:         txt('tbcGoSub'),
    siloCards:   d.querySelectorAll('.face--silos .silo-card').length,
    faces:       d.querySelectorAll('.face').length,
    poseFloor:   !!g('poseFloor'),
    crumbLabel:  txt('crumbLabel'),
    poseGlobals: typeof dom.window.POSES,
  };
  console.log(JSON.stringify({ errors, probes }));
}, 700);
"""

# The harness must live beside node_modules — node resolves requires from the
# script's own directory, not from cwd. Writing it to /tmp made the gate
# unable to find jsdom, which it correctly reported as a failure rather than
# quietly skipping.
html_path = "/home/claude/.gate-boot.html"
harness   = "/home/claude/.gate-boot.js"
open(html_path, "w", encoding="utf-8").write(out)
open(harness,   "w", encoding="utf-8").write(BOOT_HARNESS)

boot = subprocess.run(["node", harness, html_path],
                      capture_output=True, text=True, cwd="/home/claude")
os.unlink(harness); os.unlink(html_path)

boot_report = None
line = [l for l in boot.stdout.splitlines() if l.startswith("{")]
if not line:
    fails.append(f"BOOT GATE: harness produced no report — {boot.stderr.strip()[:200]}")
else:
    boot_report = json.loads(line[-1])
    if boot_report["errors"]:
        for e in boot_report["errors"]:
            fails.append(f"BOOT ERROR: {e}")
    p = boot_report["probes"]
    # the label was written — proves init reached labelGo and past it
    if p["verb"] != "Next":
        fails.append(f"BOOT ALIVE: tbcGoVerb should read 'Next' at rest, got {p['verb']!r}")
    if not p["sub"] or "Step 1 of 2" not in p["sub"]:
        fails.append(f"BOOT ALIVE: tbcGoSub should carry 'Step 1 of 2', got {p['sub']!r}")
    # the floor was populated — proves the silo render ran
    if p["siloCards"] != 8:
        fails.append(f"BOOT ALIVE: expected 8 silo cards, got {p['siloCards']}")
    if p["faces"] != 3:
        fails.append(f"BOOT ALIVE: expected 3 faces, got {p['faces']}")
    if not p["poseFloor"]:
        fails.append("BOOT ALIVE: #poseFloor absent")
    # the pose block ran to its end — window.POSES is its last statement
    if p["poseGlobals"] != "object":
        fails.append(f"BOOT ALIVE: window.POSES should be an object, got {p['poseGlobals']!r}")

# ── report ────────────────────────────────────────────────────────
print("BUILD s63 -> s64   TDZ fix + jsdom boot gate")
print("-" * 58)
for k in ("ids", "fetch", "fns", "faces"):
    print(f"  {k:<7} {before[k]:>6}  ->  {after[k]:>6}")
if boot_report:
    p = boot_report["probes"]
    print("-" * 58)
    print(f"  boot errors     {len(boot_report['errors'])}")
    print(f"  button          {p['verb']!r} / {p['sub']!r}")
    print(f"  silo cards      {p['siloCards']}")
    print(f"  faces           {p['faces']}")
    print(f"  window.POSES    {p['poseGlobals']}")
print("-" * 58)

if fails:
    print("GATE FAILED — nothing written")
    for f_ in fails:
        print("  x " + f_)
    sys.exit(1)

open(OUT, "w", encoding="utf-8").write(out)
print("GATE PASSED")
print(f"written: {OUT}")
