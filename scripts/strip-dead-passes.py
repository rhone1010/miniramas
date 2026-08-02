#!/usr/bin/env python3
"""
strip-dead-passes.py — CENG · 2026-08-01

Removes portraits-pass2.ts, portraits-expand.ts and portraits-gpt-image.ts
from the Portraits generator, then deletes the three files.

All three are dead at runtime already:
  STYLE_PIPELINE: passTwoEnabled=false, expandEnabled=false, generator='nb2'
for every style. They are imported and called, so the files cannot simply be
deleted — the call sites go first.

DELIBERATELY NOT REMOVED:
  lastRefined / lastRefineMs / lastExpanded / lastExpandMs / lastExpandSkip
  and the refined / refine_ms / expanded / expand_ms / expand_skip result
  fields. Those are in PortraitsGenerateResult and reach the route and the
  front end. Changing the response shape is a separate job.

  input.stabilityApiKey stays on the input type — line 77 already marks it
  "accepted for shape parity with Groups; unused".

Usage:
    python strip-dead-passes.py                 # dry run, prints the diff
    python strip-dead-passes.py --apply         # rewrite + delete files

Run from D:\\minramas
"""

import sys, os, shutil, re
from datetime import date

APPLY = '--apply' in sys.argv
ROOT  = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else '.'
GEN   = os.path.join(ROOT, 'lib', 'v1', 'portraits', 'portraits-generator.ts')

DELETE = [
    'lib/v1/portraits/portraits-pass2.ts',
    'lib/v1/portraits/portraits-expand.ts',
    'lib/v1/portraits/portraits-gpt-image.ts',
]

def die(m):
    print(f"  FAIL  {m}")
    sys.exit(1)

if not os.path.isfile(GEN):
    die(f"not found: {GEN}  — run from the repo root")

src = open(GEN, encoding='utf-8').read()
orig = src
nl = '\r\n' if '\r\n' in src else '\n'

# ── MUST EXIST BEFORE ────────────────────────────────────────────
before_required = [
    "import { callGptImage1 } from './portraits-gpt-image'",
    "import { refinePortraitsImage } from './portraits-pass2'",
    "import { expandPortraitImage } from './portraits-expand'",
    "if (pipeline.generator === 'gpt-image-1')",
    "const r = await refinePortraitsImage({",
    "const r = await expandPortraitImage({",
]
for s in before_required:
    if s not in src:
        die(f"anchor missing, file has drifted: {s!r}")
print("  ok    6 anchors found")

# ── 1. IMPORTS ───────────────────────────────────────────────────
for imp in [
    "import { callGptImage1 } from './portraits-gpt-image'",
    "import { refinePortraitsImage } from './portraits-pass2'",
    "import { expandPortraitImage } from './portraits-expand'",
]:
    src = src.replace(imp + nl, '')
print("  ok    3 imports removed")

# ── 2. STAGE 1 — collapse the gpt-image-1 branch ─────────────────
stage1_old = re.search(
    r"[ \t]*if \(pipeline\.generator === 'gpt-image-1'\) \{.*?\n([ \t]*)\} else \{\n(.*?)\n[ \t]*\}\n",
    src, re.S)
if not stage1_old:
    die("could not match the Stage 1 generator branch")

indent, else_body = stage1_old.group(1), stage1_old.group(2)
# de-indent the else body by two spaces
deindented = nl.join(l[2:] if l.startswith('  ') else l for l in else_body.split('\n'))
src = src[:stage1_old.start()] + deindented + nl + src[stage1_old.end():]
print("  ok    Stage 1 collapsed to callNB2 only")

# ── 3. STAGE 2 — remove the refine block ─────────────────────────
stage2 = re.search(
    r"[ \t]*// ── Stage 2: gpt-image-1 refine.*?"
    r"\n[ \t]*\} else if \(refineEnabled && !input\.openaiApiKey\) \{.*?\n[ \t]*\}\n",
    src, re.S)
if not stage2:
    die("could not match the Stage 2 refine block")

stage2_note = (
    f"{nl}    // ── Stage 2: REMOVED 2026-08-01 ──{nl}"
    f"    // gpt-image-1 Pass 2 deleted. It was dead in every STYLE_PIPELINE{nl}"
    f"    // (passTwoEnabled=false) and could not hold face identity against{nl}"
    f"    // gpt-image-1's regen prior. lastRefined stays false; the `refined`{nl}"
    f"    // and `refine_ms` response fields are retained for shape parity.{nl}"
)
src = src[:stage2.start()] + stage2_note + src[stage2.end():]
print("  ok    Stage 2 refine block removed")

# ── 4. STAGE 3 — remove the expand block ─────────────────────────
stage3 = re.search(
    r"[ \t]*// ── Stage 3 \(post-attempt\).*?"
    r"\n[ \t]*\} else \{\n[ \t]*lastExpandSkip = req\.scale === 'fill'.*?\n[ \t]*\}\n",
    src, re.S)
if not stage3:
    die("could not match the Stage 3 expand block")

stage3_note = (
    f"{nl}  // ── Stage 3: REMOVED 2026-08-01 ──{nl}"
    f"  // Local canvas-pad outpaint deleted. expandEnabled was false on every{nl}"
    f"  // style — the mirrored blurred margin read as a defect. The `expanded`,{nl}"
    f"  // `expand_ms` and `expand_skip` response fields are retained.{nl}"
    f"  lastExpandSkip = 'stage removed 2026-08-01'{nl}"
)
src = src[:stage3.start()] + stage3_note + src[stage3.end():]
print("  ok    Stage 3 expand block removed")

# ── MUST NOT EXIST AFTER ─────────────────────────────────────────
banned = [
    'portraits-pass2', 'portraits-expand', 'portraits-gpt-image',
    'callGptImage1', 'refinePortraitsImage', 'expandPortraitImage',
]
for b in banned:
    if b in src:
        die(f"still present after edit: {b!r}")
print("  ok    no references to the three modules remain")

# ── MUST STILL EXIST ─────────────────────────────────────────────
kept = [
    'callNB2(', 'lastRefined', 'lastExpandSkip', 'refine_decision',
    'expand_skip:', 'scoreSingleFaceFidelity', 'buildPortraitsPrompt',
]
for k in kept:
    if k not in src:
        die(f"removed something it should not have: {k!r} is gone")
print("  ok    7 must-keep symbols intact")

# ── BRACE BALANCE ────────────────────────────────────────────────
def balance(s):
    d = 0; i = 0; ins = None; inc = None
    while i < len(s):
        c, n, p = s[i], s[i+1] if i+1 < len(s) else '', s[i-1] if i else ''
        if inc == '//':
            if c == '\n': inc = None
        elif inc == '/*':
            if c == '*' and n == '/': inc = None; i += 1
        elif ins:
            if c == '\\': i += 1
            elif c == ins: ins = None
        elif c == '/' and n == '/': inc = '//'; i += 1
        elif c == '/' and n == '*': inc = '/*'; i += 1
        elif c in '"\'`': ins = c
        elif c == '{': d += 1
        elif c == '}': d -= 1
        i += 1
    return d

b = balance(src)
if b != 0:
    die(f"brace balance is {b:+d}, expected 0 — edit corrupted the file")
print("  ok    braces balanced")

print(f"\n  {len(orig)} -> {len(src)} chars  ({len(orig)-len(src)} removed)")

if not APPLY:
    print("\n  DRY RUN — nothing written. Add --apply.\n")
    print("  Would also delete:")
    for d in DELETE:
        p = os.path.join(ROOT, *d.split('/'))
        print(f"    {'x' if os.path.isfile(p) else '-'} {d}")
    print()
    sys.exit(0)

bak = GEN + '.bak-' + date.today().isoformat()
shutil.copy2(GEN, bak)
open(GEN, 'w', encoding='utf-8', newline='').write(src)
print(f"\n  backup:  {bak}")
print(f"  written: {GEN}")

for d in DELETE:
    p = os.path.join(ROOT, *d.split('/'))
    if os.path.isfile(p):
        os.remove(p)
        print(f"  deleted: {d}")
    else:
        print(f"  absent:  {d}")

print("\n  NEXT:  npx tsc --noEmit      (baseline 71; expect FEWER, never more)")
print("         git status            (named files only, never -A)\n")
