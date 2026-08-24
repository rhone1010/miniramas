#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-index-r18.py  -  CUI 41A  -  24 August 2026
Preload ALL plates on load, not just the first 4.
Black screens after plate 3 were a loading race.
"""
import os, sys, io

FILES = ["index.html"]

OLD = "  /* Warm the next few plates. */\n  painters.forEach(function(paint, c){\n    COLS[c].slice(0, 4).forEach(function(f){\n      var hasFolder = f.indexOf('/') > -1;\n      new Image().src = S + (hasFolder ? 'tall-small/' : 'tall/') + f;\n    });\n  });"

NEW = "  /* Preload ALL plates on load -- the tick fires every 4s and any\n     plate not ready goes black. CUI 41A, 24 Aug 2026. */\n  painters.forEach(function(paint, c){\n    COLS[c].forEach(function(f){\n      var hasFolder = f.indexOf('/') > -1;\n      var img1 = new Image(); img1.src = S + (hasFolder ? 'tall-small/' : 'tall/') + f;\n      var img2 = new Image(); img2.src = S + (hasFolder ? 'tall/' : '') + f.replace('?v=2','');\n    });\n  });"

def normalise(s): return s.replace("\r\n", "\n").replace("\r", "\n")

def run(src_dir, out_dir, apply):
    ok = True
    for name in FILES:
        src = os.path.join(src_dir, name)
        print("\n" + "="*66 + "\n" + name + "\n" + "="*66)
        if not os.path.isfile(src): print("  REFUSED: not found"); ok=False; continue
        text = normalise(io.open(src,"rb").read().decode("utf-8"))
        before = len(text)
        if OLD not in text:
            if NEW in text: print("  REFUSED: already applied"); ok=False; continue
            print("  REFUSED: anchor not found"); ok=False; continue
        text = text.replace(OLD, NEW, 1)
        print("  ok   preload all plates")
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
