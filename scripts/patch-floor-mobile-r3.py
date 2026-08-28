#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-floor-mobile-r3.py  -  CUI 41A  -  27 August 2026

MOBILE #1: THE DOTS. Measured on a 412 viewport: .floor 28x50, cards
2x3, count 8 - the whole floor collapsed to card-border specks.

The mechanism: the fit-content hug (25 Aug) was cut for the desktop
stage, where the floor inherits a definite height. The mobile blocks
were never taught about it - on a phone the floor keeps fit-content
width and height:100% of a parent with no height. Both collapse; the
specks are the borders. Intermittent because the parent's height
depends on load order. The r1 sizer correctly stands down below 768px
- but standing down left broken fit-content in charge.

The cure: below 768px the floor returns to pre-hug geometry -
width:auto, height:auto - exactly what the working one-column mobile
layout was built against. Same five carriers as the hug.
"""
import os, sys, io

FILES = ["portraits.html", "pets.html",
         "wallpapers-portraits.html", "wallpapers-pets.html",
         "wallpapers-halloween-pets.html"]

OLD = "  padding:var(--card-gap);\n  font-size:var(--card-type);\n}"
NEW = ("  padding:var(--card-gap);\n  font-size:var(--card-type);\n}\n"
       "/* The hug is a desktop garment. Below 768 the floor wears its pre-hug\n"
       "   geometry - the one-column mobile layout was built against it, and\n"
       "   fit-content against an unsized parent collapses to specks (mobile\n"
       "   #1, the dots). Matches the sizer's 768 guard. CUI 41A, 27 Aug. */\n"
       "@media (max-width:767.98px){\n"
       "  .floor{ width:auto; height:auto }\n"
       "}")

def normalise(s): return s.replace("\r\n", "\n").replace("\r", "\n")

def run(src_dir, out_dir, apply):
    ok = True
    for name in FILES:
        src = os.path.join(src_dir, name)
        print("\n" + "="*66 + "\n" + name + "\n" + "="*66)
        if not os.path.isfile(src): print("  REFUSED: not found"); ok=False; continue
        text = normalise(io.open(src,"rb").read().decode("utf-8"))
        before = len(text)
        n = text.count(OLD)
        if n != 1:
            if "the dots). Matches the sizer's 768 guard" in text: print("  REFUSED: already applied")
            else: print("  REFUSED: anchor %d times" % n)
            ok=False; continue
        text = text.replace(OLD, NEW, 1)
        print("  ok   mobile floor wears pre-hug geometry")
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
