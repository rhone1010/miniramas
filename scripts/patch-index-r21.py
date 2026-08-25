#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-index-r21.py  -  CUI 41A  -  24 August 2026

tall-small RETIRED FROM THE REEL, FOR NOW.

The tall-small folders on disk turned out to be empty and only one file
ever reached git, so every subfoldered plate was 404ing against
tall-small/ and falling back to tall/ on each turn -- pictures fine,
console loud. Both painters and the preloader now go straight to tall/.

When the 250K set is regenerated, committed, and VERIFIED ON MAIN
(git ls-tree origin/main -r <path> | count), reintroducing the tier is
these same three lines in reverse.
"""
import os, sys, io

FILES = ["index.html"]

EDITS = [

("A . mobile builder serves tall/",
 """          var fresh = p[0].indexOf('?') > -1;
          return {
            big:   S + (fresh ? 'tall/' : 'tall-small/') + s.dir + p[0],""",
 """          var fresh = p[0].indexOf('?') > -1;
          return {
            /* tall-small retired 24 Aug 2026 -- folders were empty and
               nothing but noise came of preferring them. CUI 41A. */
            big:   S + 'tall/' + s.dir + p[0],"""),

("B . desktop painter serves tall/",
 """      var fresh  = filename.indexOf('?') > -1;
      var first  = S + ((hasFolder && !fresh) ? 'tall-small/' : 'tall/') + filename;
      var second = (hasFolder && !fresh) ? S + 'tall/' + filename : null;""",
 """      var fresh  = filename.indexOf('?') > -1;
      /* tall-small retired 24 Aug 2026 -- see the mobile builder. */
      var first  = S + 'tall/' + filename;
      var second = null;"""),

("C . desktop preloader warms tall/",
 """      var img1 = new Image(); img1.src = S + (hasFolder ? 'tall-small/' : 'tall/') + f;""",
 """      var img1 = new Image(); img1.src = S + 'tall/' + f;"""),
]

MUST_APPEAR = ["big:   S + 'tall/' + s.dir + p[0],", "var second = null;"]
MUST_VANISH = ["'tall-small/'"]

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
        for s in MUST_VANISH:
            if s in text: print("  REFUSED: still present -- %s" % s); halt=True
        if halt: ok=False; continue
        print("  %d -> %d (%+d)" % (before, len(text), len(text)-before))
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
