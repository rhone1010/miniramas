#!/usr/bin/env python3
"""
BUILD s60 -> s61   POSE SWAP: confident out, goofy in
CUI V23 · 2026-07-29 · ruled by Rich in session

The six poses are now:
  as_photographed · smiling · laughing · thoughtful · goofy · dramatic

Position 5 in the array, so the floor layout is untouched — still 3+3.

Curator line drafted in the same register as the other five. CENG replaces
all six when the live Curator lands.
"""

import re, sys, subprocess, tempfile, os

SRC = "/home/claude/litenco-stage-2026-07-29-s60.html"
OUT = "/home/claude/litenco-stage-2026-07-29-s61.html"

src = open(SRC, encoding="utf-8").read()

# ── 1 · the POSES array entry ─────────────────────────────────────
ARR_OLD = """    { id:'confident',       label:'Confident'       },"""
ARR_NEW = """    { id:'goofy',           label:'Goofy'           },"""

# ── 2 · the Curator line ──────────────────────────────────────────
SAY_OLD = """    confident:
      'Confident. Chin level, shoulders squared &mdash; it reads as someone who ' +
      'has decided something.' +
      '<span class="sign">&mdash; C.</span>',"""

SAY_NEW = """    goofy:
      'Goofy. I like this one more than I should &mdash; it never photographs well ' +
      'and it always sculpts well. Something about a face that is not behaving.' +
      '<span class="sign">&mdash; C.</span>',"""

EDITS = [
    ("poses array", ARR_OLD, SAY_OLD and ARR_NEW),
    ("curator line", SAY_OLD, SAY_NEW),
]

def count_ids(s):   return len(set(re.findall(r'id="([^"]*)"', s)))
def count_fetch(s): return len(re.findall(r'\bfetch\s*\(', s))
def count_fns(s):   return len(re.findall(r'^\s*(?:async\s+)?function\s+[A-Za-z_$]', s, re.M))
def count_faces(s): return len(re.findall(r'class="face face--', s))
def poses(s):
    m = re.search(r'var POSES = \[(.*?)\];', s, re.S)
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

# still six, so the 3+3 layout is untouched
if len(after["poses"]) != 6:
    fails.append(f"COUNT: six poses required, got {len(after['poses'])}")

# every pose has a Curator line
for p in EXPECTED:
    if not re.search(r'^\s+' + p + r':\s*$', out, re.M):
        fails.append(f"MUST-EXIST: POSE_SAY line for {p}")

# confident is gone everywhere
for term in ("confident", "Confident"):
    if term in out:
        fails.append(f"MUST-NOT-EXIST: {term} still present")

# structure held
for k in ("ids", "fetch", "fns", "faces"):
    if before[k] != after[k]:
        fails.append(f"STRUCTURE: {k} moved {before[k]} -> {after[k]}")

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

print("BUILD s60 -> s61   confident out, goofy in")
print("-" * 56)
print(f"  poses before: {', '.join(before['poses'])}")
print(f"  poses after : {', '.join(after['poses'])}")
for k in ("ids", "fetch", "fns", "faces"):
    print(f"  {k:<7} {before[k]:>6}  ->  {after[k]:>6}")
print("-" * 56)

if fails:
    print("GATE FAILED — nothing written")
    for f_ in fails:
        print("  x " + f_)
    sys.exit(1)

open(OUT, "w", encoding="utf-8").write(out)
print("GATE PASSED")
print(f"written: {OUT}")
