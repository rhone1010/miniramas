#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-floor-safari-r1.py  -  CUI 41A  -  26 August 2026

BETA #2/#3: SAFARI RENDERS THE FLOORS AS VERTICAL SLIVERS.

The circle: rows take their height from the stage, cards derive width
from that height via aspect-ratio, tracks are minmax(0,1fr), and
width:fit-content asks the grid to learn its width from the cards.
Chrome resolves the loop; Safari takes the 0-minimums literally and
eight near-zero tracks paint as slivers. Portraits and Pets have the
fit-content floor; Groups and Halloween never got it, which is why the
tester saw exactly two broken rooms.

The cure: say the width instead of asking. A sizer measures each
floor's real height and sets --floor-w = 4*cardW + 3*gap + 2*pad; the
CSS consumes it with fit-content as the fallback. Chrome's layout is
pixel-identical; Safari gets a definite width and resolves. Mobile
(<768px, single-column floor) is left alone. ResizeObserver keeps it
honest through stage resizes and step changes; no per-paint wiring.

Two edits per room, portraits and pets.
"""
import os, sys, io

FILES = ["portraits.html", "pets.html"]

EDITS = [

("A . the floor consumes a said width, fit-content stays the fallback",
 "  width:fit-content; max-width:100%; margin-inline:auto;",
 "  /* Safari cannot resolve fit-content against height-derived cards -\n"
 "     beta #2/#3, the sliver floors. A measured --floor-w is set by the\n"
 "     sizer below the silo paint; fit-content remains the fallback and\n"
 "     Chrome's layout is unchanged. CUI 41A, 26 Aug 2026. */\n"
 "  width:var(--floor-w, fit-content); max-width:100%; margin-inline:auto;"),

("B . the sizer, beside the silo paint",
 "    siloFloor.dataset.count = R.silos.length;\n"
 "  }",
 "    siloFloor.dataset.count = R.silos.length;\n"
 "  }\n"
 "\n"
 "  /* THE FLOOR SIZER. Says the floor's width so Safari need not derive\n"
 "     it (see the .floor CSS note). Width = four cards + three gaps +\n"
 "     the padding, from the floor's measured height. Skips and clears\n"
 "     below 768px where the floor is single-column. CUI 41A, 26 Aug. */\n"
 "  function sizeFloors(){\n"
 "    var wide = window.matchMedia('(min-width: 768px)').matches;\n"
 "    document.querySelectorAll('.floor').forEach(function(f){\n"
 "      if (!wide){ f.style.removeProperty('--floor-w'); return; }\n"
 "      var cs  = getComputedStyle(f);\n"
 "      var pad = parseFloat(cs.paddingTop) || 0;\n"
 "      var gap = parseFloat(cs.rowGap) || 0;\n"
 "      var ratio = parseFloat(cs.getPropertyValue('--card-ratio')) || .78;\n"
 "      var rowH = (f.clientHeight - pad*2 - gap) / 2;\n"
 "      if (rowH <= 0){ f.style.removeProperty('--floor-w'); return; }\n"
 "      var cardW = rowH * ratio;\n"
 "      f.style.setProperty('--floor-w', (4*cardW + 3*gap + 2*pad) + 'px');\n"
 "    });\n"
 "  }\n"
 "  (function(){\n"
 "    if (!('ResizeObserver' in window)){\n"
 "      window.addEventListener('resize', sizeFloors);\n"
 "      sizeFloors(); return;\n"
 "    }\n"
 "    var ro = new ResizeObserver(sizeFloors);\n"
 "    document.querySelectorAll('.floor').forEach(function(f){ ro.observe(f); });\n"
 "    window.addEventListener('resize', sizeFloors);\n"
 "    sizeFloors();\n"
 "  })();"),
]

MUST_APPEAR = ["var(--floor-w, fit-content)", "function sizeFloors()"]

def normalise(s): return s.replace("\r\n", "\n").replace("\r", "\n")

def run(src_dir, out_dir, apply):
    ok = True
    for name in FILES:
        src = os.path.join(src_dir, name)
        print("\n" + "="*66 + "\n" + name + "\n" + "="*66)
        if not os.path.isfile(src): print("  REFUSED: not found"); ok=False; continue
        text = normalise(io.open(src,"rb").read().decode("utf-8"))
        before = len(text)
        halt = False
        for label, old, new in EDITS:
            n = text.count(old)
            if n != 1:
                if new in text: print("  REFUSED: already applied -- %s" % label)
                else: print("  REFUSED: anchor %d times -- %s" % (n, label))
                halt = True
        if halt: ok=False; continue
        for label, old, new in EDITS:
            text = text.replace(old, new, 1)
            print("  ok   %s" % label)
        for s in MUST_APPEAR:
            if s not in text: print("  REFUSED: missing -- %s" % s); halt=True
        if halt: ok=False; continue
        print("  %d -> %d (+%d)" % (before, len(text), len(text)-before))
        if apply:
            io.open(os.path.join(out_dir,name),"w",encoding="utf-8",newline="\n").write(text)
            print("  WROTE %s" % os.path.join(out_dir,name))
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
