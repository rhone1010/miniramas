#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-beta-5-6-r1.py  -  CUI 41A  -  26 August 2026

Two beta notes, one pass, six rooms. CSS only - nothing for the coming
system change to collide with.

  A  Beta #6, "All effects doesn't seem to work": it is the breadcrumb's
     way back, correctly inert on the silo floor - but at opacity .82
     inert is indistinguishable from active, which IS the tester's
     confusion. The idle deepens to .38: plainly asleep, waking the
     moment a silo opens (the --effects view already restores it).

  B  Beta #5, "Take implies the computer's camera": on a fine-pointer
     hover device the pill just opens the picker - a duplicate of the
     slot wearing a misleading label. Hidden where hover:hover and
     pointer:fine; phones and tablets keep it exactly as shipped.
"""
import os, sys, io

FILES = ["portraits.html", "pets.html", "groups.html",
         "halloween.html", "pets-halloween.html", "pets-chooser.html"]

EDITS = [

("A . the idle crumb reads as idle (beta #6)",
 ".workshop-view--silos .crumb-back{\n"
 "  /* the way back stays on the glass. only the room name arrives and leaves \u2014\n"
 "     both fading together read as the whole bar blinking. */\n"
 "  opacity:.82; pointer-events:none;\n"
 "}",
 ".workshop-view--silos .crumb-back{\n"
 "  /* the way back stays on the glass. only the room name arrives and leaves \u2014\n"
 "     both fading together read as the whole bar blinking.\n"
 "     .38, not .82: at .82 inert was indistinguishable from active and a\n"
 "     tester pressed it - beta #6. CUI 41A, 26 Aug 2026. */\n"
 "  opacity:.38; pointer-events:none;\n"
 "}"),

("B . the camera pill is a phone thing (beta #5)",
 '.cur.has-photo .cur-camera, .cur[data-state="ready"] .cur-camera{ display:none }',
 '.cur.has-photo .cur-camera, .cur[data-state="ready"] .cur-camera{ display:none }\n'
 "/* A device with hover and a fine pointer has no camera worth offering -\n"
 "   the pill just reopened the picker under a misleading label (beta #5).\n"
 "   Phones and tablets keep it. CUI 41A, 26 Aug 2026. */\n"
 "@media (hover:hover) and (pointer:fine){ .cur-camera{ display:none } }"),
]

MUST_APPEAR = ["opacity:.38; pointer-events:none;",
               "@media (hover:hover) and (pointer:fine){ .cur-camera{ display:none } }"]
MUST_VANISH = ["opacity:.82; pointer-events:none;"]

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
