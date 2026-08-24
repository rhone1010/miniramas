#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-index-r17.py  -  CUI 41A  -  24 August 2026

  1  NAV FONT STILL 21px. The wrong rule was hit. nav a at line 157 untouched.
  2  EMPTY FRAMES ON LOAD. Initial paint has no fallback when images are slow.
"""

import os, sys, io, re

FILES = ["index.html"]

A_OLD = "nav a{font-family:var(--serif);font-size:21px;color:var(--ink-soft);text-decoration:none;transition:color .2s}"
A_NEW = "nav a{font-family:var(--serif);font-size:30px;color:var(--ink-soft);text-decoration:none;transition:color .2s}"

B_OLD = "  /* Initial paint: each column at a different offset within group 0. */\n  painters.forEach(function(paint, c){\n    paint(COLS[c][c % PLATES_PER_GROUP]);\n  });\n  plateInGrp = painters.length - 1;"

B_NEW = "  /* Initial paint: each column at a different offset within group 0.\n     CUI 41A, 24 Aug 2026. Fallback: if still blank after 2s paint the\n     square original so no column is ever empty. */\n  var panels3 = document.querySelectorAll('#trip .trip-panel');\n  painters.forEach(function(paint, c){\n    var filename = COLS[c][c % PLATES_PER_GROUP];\n    paint(filename);\n    var panel3 = panels3[c];\n    setTimeout(function(){\n      if (!panel3) return;\n      var layers = panel3.querySelectorAll('.trip-layer');\n      var painted = [].some.call(layers, function(l){ return !!l.style.backgroundImage; });\n      if (!painted){\n        var plain = S + filename.replace('?v=2','');\n        layers[0].style.backgroundImage = 'url(\"' + plain + '\")';\n        layers[0].classList.add('show');\n      }\n    }, 2000);\n  });\n  plateInGrp = painters.length - 1;"

EDITS = [
    ("A . nav font-size 21px -> 30px", A_OLD, A_NEW),
    ("B . initial paint fallback",      B_OLD, B_NEW),
]

MUST_APPEAR = ["font-size:30px", "if (!painted){"]
MUST_VANISH = ["font-size:21px;color:var(--ink-soft)"]


def normalise(s):
    """Strip all CR so anchors work regardless of mixed line endings."""
    return s.replace("\r\n", "\n").replace("\r", "\n")


def run(src_dir, out_dir, apply):
    ok = True
    for name in FILES:
        src = os.path.join(src_dir, name)
        print("\n" + "="*66 + "\n" + name + "\n" + "="*66)
        if not os.path.isfile(src): print("  REFUSED: not found"); ok=False; continue

        raw = io.open(src, "rb").read()
        text = normalise(raw.decode("utf-8"))

        before = len(text)
        halt = False
        for label, old, new in EDITS:
            n = text.count(old)
            if n != 1:
                print("  REFUSED: anchor %d times -- %s" % (n, label)); halt=True
            elif new in text:
                print("  REFUSED: already applied -- %s" % label); halt=True
        if halt: ok=False; continue

        for label, old, new in EDITS:
            text = text.replace(old, new, 1)
            print("  ok   %s" % label)

        for s in MUST_APPEAR:
            if s not in text: print("  REFUSED: missing -- %s" % s); halt=True
        for s in MUST_VANISH:
            if s in text: print("  REFUSED: still present -- %s" % s); halt=True
        if halt: ok=False; continue

        # Restore CRLF where the original had it, keep LF where it was LF
        # Simplest correct approach: write as LF throughout (Vercel doesn't care)
        print("  %d -> %d (+%d)" % (before, len(text), len(text)-before))
        if apply:
            dst = os.path.join(out_dir, name)
            g = io.open(dst, "w", encoding="utf-8", newline="\n"); g.write(text); g.close()
            print("  WROTE %s" % dst)
        else: print("  DRY RUN -- nothing written")

    print("\n" + ("All files clean." if ok else "ONE OR MORE FILES REFUSED."))
    return 0 if ok else 1

if __name__ == "__main__":
    apply = "--apply" in sys.argv
    home = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)
    out_dir = os.path.join(home,"Downloads"); src_dir = ""
    for a in sys.argv[1:]:
        if a.startswith("--src="): src_dir=a[6:]
        if a.startswith("--out="): out_dir=a[6:]
    if not src_dir: src_dir = os.path.join(repo,"public")
    if not os.path.isdir(src_dir): print("REFUSED: install to scripts\\ first."); sys.exit(1)
    print("\nreading  %s\nwriting  %s" % (src_dir, out_dir))
    sys.exit(run(src_dir, out_dir, apply))
