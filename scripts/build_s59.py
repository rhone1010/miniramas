#!/usr/bin/env python3
"""
BUILD s58 -> s59
CUI V23 · 2026-07-29

CHANGE (one, ruled by Rich):
  .bay-ic gains `margin:auto`.

WHY:
  .bay at s58:1110 sets `place-items:stretch`, which overrides the
  `place-items:center` declared at s58:414. A stretch cell holding a
  fixed width/height child pins that child to the top-left of its grid
  cell. `margin:auto` absorbs the free space on both axes and re-centres
  the icon.

NOT CHANGED (flagged, not ruled):
  `flex:0 0 auto` on .bay-ic is dead — the parent is grid, not flex.
  Left in place. Removing it is a separate decision.

Gate: assertion-based. Writes output only if every assertion passes.
"""

import re, sys, subprocess, tempfile, os

SRC = "/mnt/user-data/uploads/litenco-stage-2026-07-28-s58.html"
OUT = "/home/claude/litenco-stage-2026-07-29-s59.html"

OLD = """.bay-ic{
  display:grid; place-items:center;"""

NEW = """.bay-ic{
  display:grid; margin:auto; place-items:center;"""

# ── read ──────────────────────────────────────────────────────
src = open(SRC, encoding="utf-8").read()

def count_ids(s):      return len(set(re.findall(r'id="([^"]*)"', s)))
def count_fetch(s):    return len(re.findall(r'\bfetch\s*\(', s))
def count_fns(s):      return len(re.findall(r'^\s*(?:async\s+)?function\s+[A-Za-z_$]', s, re.M))
def count_classes(s):
    out = set()
    for m in re.findall(r'class="([^"]*)"', s):
        out.update(c for c in m.split() if c)
    return len(out)

before = dict(
    ids=count_ids(src), fetch=count_fetch(src),
    fns=count_fns(src), classes=count_classes(src), chars=len(src),
)

# ── pre-flight ────────────────────────────────────────────────
assert src.count(OLD) == 1, f"anchor not unique: found {src.count(OLD)}"
assert "margin:auto" not in OLD, "anchor already carries the change"

# ── apply ─────────────────────────────────────────────────────
out = src.replace(OLD, NEW, 1)

after = dict(
    ids=count_ids(out), fetch=count_fetch(out),
    fns=count_fns(out), classes=count_classes(out), chars=len(out),
)

# ── GATE ──────────────────────────────────────────────────────
fails = []

# must exist
m = re.search(r'\.bay-ic\{(.*?)\}', out, re.S)
if not m or "margin:auto" not in m.group(1):
    fails.append("MUST-EXIST: margin:auto not inside the .bay-ic rule")

# must not exist — nothing else may have gained margin:auto
if out.count("margin:auto") != src.count("margin:auto") + 1:
    fails.append("MUST-NOT-EXIST: margin:auto appeared somewhere unintended")

# structure held
for k in ("ids", "fetch", "fns", "classes"):
    if before[k] != after[k]:
        fails.append(f"STRUCTURE: {k} moved {before[k]} -> {after[k]}")

# the diff is exactly the declaration and nothing more
if after["chars"] - before["chars"] != len("margin:auto; "):
    fails.append(
        f"DIFF SIZE: expected +{len('margin:auto; ')} chars, "
        f"got +{after['chars'] - before['chars']}"
    )

# style braces balanced
for sm in re.findall(r'<style[^>]*>(.*?)</style>', out, re.S):
    if sm.count("{") != sm.count("}"):
        fails.append(f"BRACE: style block unbalanced {sm.count('{')} vs {sm.count('}')}")

# node --check every script block that is not JSON-only data
for i, sm in enumerate(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', out, re.S)):
    if not sm.strip():
        continue
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as fh:
        fh.write(sm); p = fh.name
    r = subprocess.run(["node", "--check", p], capture_output=True, text=True)
    os.unlink(p)
    if r.returncode != 0:
        fails.append(f"NODE --CHECK: script block {i} — {r.stderr.strip().splitlines()[0]}")

# ── report ────────────────────────────────────────────────────
print("BUILD s58 -> s59   .bay-ic margin:auto")
print("-" * 52)
for k in ("ids", "fetch", "fns", "classes"):
    print(f"  {k:<9} {before[k]:>5}  ->  {after[k]:>5}")
print(f"  {'chars':<9} {before['chars']:>5}  ->  {after['chars']:>5}")
print("-" * 52)

if fails:
    print("GATE FAILED — nothing written")
    for f in fails:
        print("  x " + f)
    sys.exit(1)

open(OUT, "w", encoding="utf-8").write(out)
print("GATE PASSED")
print(f"written: {OUT}")
