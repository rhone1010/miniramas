#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-modal-width-r1.py  -  CUI 41A  -  27 August 2026

BETA/MOBILE #3: THE FLOOR-GUARD CARD HANGS OFF A PHONE.

Measured on a 412px viewport: needPhotoModal 440px wide, right edge at
464. The rule says width:440px; max-width:100% - but the card sits in
a centring grid whose auto track sizes itself TO the card, so the 100%
resolves against 440, not the screen. The cap caps nothing.

The cure skips percentages: width:min(440px, calc(100vw - 48px)) -
440 wherever it fits, screen-minus-the-scrim's-padding elsewhere.
Every card riding .m-scrim .modal heals at once: the floor guard, the
sign-in card, the intake states. Six rooms, the canonical block.
"""
import os, sys, io

FILES = ["portraits.html", "pets.html", "groups.html",
         "halloween.html", "pets-halloween.html", "pets-chooser.html"]

OLD = ".m-scrim .modal{width:440px;max-width:100%;"
NEW = (".m-scrim .modal{width:min(440px, calc(100vw - 48px));max-width:100%;"
       "/* the grid's auto track made 100% self-referential - beta #3, the\n"
       "   card off a 412 screen. CUI 41A, 27 Aug 2026. */")

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
            if "min(440px, calc(100vw - 48px))" in text: print("  REFUSED: already applied")
            else: print("  REFUSED: anchor %d times" % n)
            ok=False; continue
        text = text.replace(OLD, NEW, 1)
        print("  ok   the card fits the screen it is on")
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
