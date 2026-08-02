#!/usr/bin/env python3
"""
BUILD 1a — STRIP b2
CUI V23 · 2026-07-31

Removes from portraits-b2.html every function that is certainly dead, and
nothing else. The output is the engine that build 1b merges into s72.

WHY THIS IS NOT THE WHOLE STRIP
  The surviving /generate payload reads from QUEUE ITEM fields:

      source_image_b64, additional_images_b64, style_id, preset,
      location, scale, aspect_ratio, resolution, plaque_text?

  Several functions on the cut list write to state that ends up on those
  items. Cutting them in the same pass as the obviously-dead ones would mix
  a safe change with a risky one, and if the result broke there would be no
  way to tell which half did it.

  So this pass takes only what has NO path to the payload. Quality tiers,
  preview, plaque, aspect and the sculpture-era staging wait for 1b, where
  each is checked against the payload individually.

WHAT GOES — 30 functions, five groups

  TOUR (12)            onboarding walkthrough. The Curator does this job now.
  RETIRED (3)          named _retired_* by whoever wrote them.
  DEAD ON ARRIVAL (7)  declared once, called nowhere. Verified by call count,
                       not assumed.
  RAW MODE (4)         toggleRawMode, clearRawRef, handleRawRefUpload,
                       updateRawPromptCounter. Takes /raw-pipeline with it.
  QA SLIDERS (2)       loadQaLocal, saveQaSettings — the source_strictness /
                       render_strictness tuner. Takes both /qa/settings calls.

  ⚠ qaAccept, qaRefund and qaRerender DO NOT GO. They are named as QA and are
    not: they set user_decision on a queue item, and qaRerender already
    carries `if ((original.rerender_count || 0) >= 1) return` — the one
    gate-re-render-per-piece rule Rich ruled on 7/29. Misnamed, load-bearing.

ROUTES: 10 → 7. raw-pipeline and both qa/settings go; nothing else moves.
"""

import re, sys, subprocess, os, tempfile

SRC = "/mnt/user-data/uploads/portraits-b2.html"
OUT = "/home/claude/portraits-b2-stripped.html"

src = open(SRC, encoding="utf-8").read()

TOUR = ['startTour','endTour','nextTourStep','showTourStep','maybeAutoTour',
        'tourCookieSet','tourPromptNo','tourPromptYes','tourRestoreRegions',
        'tourRevealRegions','tourSetCookie','_tourReposition']
RETIRED = ['_retired_renderQueueGrid_bigCards','_retired_updateQueueCard_bigCards',
           '_retired_updateQueueMeta']
DEAD = ['addCuratorQueueIcon','applyCuratorSuggestion','curatorReset','makeVariation',
        'setSpinesVisible','updateCuratorLine','queueCollapse']
RAW = ['toggleRawMode','clearRawRef','handleRawRefUpload','updateRawPromptCounter']
QA_SLIDERS = ['loadQaLocal','saveQaSettings']

KEEP = ['qaAccept','qaRefund','qaRerender']

CUT = TOUR + RETIRED + DEAD + RAW + QA_SLIDERS

# ── measure ───────────────────────────────────────────────────
def fns(s):   return re.findall(r'^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)', s, re.M)
def fetches(s): return len(re.findall(r'\bfetch\s*\(', s))
def ids(s):   return len(set(re.findall(r'id="([^"]*)"', s)))

before = dict(fns=len(fns(src)), fetch=fetches(src), ids=ids(src), lines=src.count('\n'))

# ── verify the DEAD list really is dead, do not take it on trust ──
for name in DEAD:
    n = len(re.findall(r'\b' + re.escape(name) + r'\s*\(', src))
    if n != 1:
        print(f"REFUSED: {name} is called {n-1} time(s) besides its declaration")
        sys.exit(1)

# ── excise ────────────────────────────────────────────────────
# A function runs from its `function name(` to the line whose closing brace
# sits at the same indent. Brace counting rather than regex, because a regex
# that spans a function body will eat the next one.
def cut_function(text, name):
    """Cut from `function name(` to the closing brace at the SAME INDENT.

    The first version counted braces and handled string literals but not
    comments or regex literals — a `//` containing a brace walked it straight
    past the end of the function and into the next. It removed 78 functions
    when asked for 25. Indentation is dumber and, in a file this consistently
    formatted, correct."""
    m = re.search(r'^([ \t]*)(?:async\s+)?function\s+' + re.escape(name) + r'\s*\(', text, re.M)
    if not m: return text, False
    indent = m.group(1)
    close = '\n' + indent + '}'
    end = text.find(close, m.end())
    if end == -1: return text, False
    end += len(close)
    while end < len(text) and text[end] in ' \t': end += 1
    if end < len(text) and text[end] == '\n': end += 1
    return text[:m.start()] + text[end:], True

out = src
removed, missing = [], []
for name in CUT:
    out, ok = cut_function(out, name)
    (removed if ok else missing).append(name)

# ── call sites left behind ────────────────────────────────────
# A removed function whose call survives is a runtime error waiting for a
# click. Neutralise the call rather than leave it.
orphan_calls = []
for name in removed:
    for m in re.finditer(r'\b' + re.escape(name) + r'\s*\(', out):
        line_start = out.rfind('\n', 0, m.start()) + 1
        line_end = out.find('\n', m.start())
        orphan_calls.append((name, out[line_start:line_end].strip()[:90]))

after = dict(fns=len(fns(out)), fetch=fetches(out), ids=ids(out), lines=out.count('\n'))

# ── GATE ──────────────────────────────────────────────────────
fails = []
if missing: fails.append(f"NOT FOUND: {missing}")
if after['fetch'] != 7:
    fails.append(f"ROUTES: expected 7, got {after['fetch']}")
for k in KEEP:
    if k not in fns(out):
        fails.append(f"REMOVED A KEEPER: {k} — it is product, not bench")
if 'rerender_count' not in out:
    fails.append("POLICY: the one-gate-re-render guard was lost with qaRerender")
if re.search(r"fetch\([^)]*raw-pipeline", out):
    fails.append("ROUTE: raw-pipeline survives")
if 'QA_SETTINGS_URL' in out and re.search(r'fetch\([^)]*QA_SETTINGS_URL', out):
    fails.append("ROUTE: a qa/settings call survives")
if after['fns'] != before['fns'] - len(removed):
    fails.append(f"COUNT: removed {len(removed)} but fns moved {before['fns']}->{after['fns']}")
if orphan_calls:
    fails.append(f"ORPHAN CALLS: {len(orphan_calls)} call(s) to removed functions survive")

with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as fh:
    blocks = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', out, re.S)
    fh.write(max(blocks, key=len)); p = fh.name
r = subprocess.run(["node","--check",p], capture_output=True, text=True); os.unlink(p)
if r.returncode != 0:
    fails.append("NODE --CHECK: " + r.stderr.strip().splitlines()[0])

print("BUILD 1a — strip b2")
print("-"*58)
for k in ("lines","fns","fetch","ids"):
    print(f"  {k:<6} {before[k]:>6}  ->  {after[k]:>6}")
print("-"*58)
print(f"  removed {len(removed)} functions")
print(f"  kept    {', '.join(KEEP)}")
if orphan_calls:
    print("-"*58)
    for n,l in orphan_calls[:12]: print(f"  ! {n}: {l}")
print("-"*58)

if fails:
    print("GATE FAILED — nothing written")
    for f in fails: print("  x "+f)
    sys.exit(1)
open(OUT,"w",encoding="utf-8").write(out)
print("GATE PASSED")
print("written:", OUT)
