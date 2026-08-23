#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-mobile-r8.py  -  CUI 41A  -  23 August 2026

  1  THE FOUR-CARD FLOOR RUNS OFF BOTH EDGES.

     #siloFloor[data-count="4"] lays out two columns of var(--silo-w),
     which is clamp(240px, 16.7vw, 420px). Two of those and a gap is 500px
     at its narrowest, on a screen that is 390. The cards were cut on the
     left and the right and the page scrolled sideways.

     The phone block already says repeat(2, minmax(0,1fr)) and has been
     losing: an id selector outranks a class, whatever order they are in
     and whatever media query holds them. Fixed at the id, where the
     specificity is, rather than by piling !important onto the class.

     Ruled by Rich: one column, four rows. A group photograph is wide, and
     half of a 390px screen is not enough of it to choose by.

  2  THE FILTER RAIL SITS ON TOP OF THE COLLECTION'S HEAD.

     r7 seated the surface below the masthead and gave the rail 6px above
     it, which was not enough -- the pills still read as jammed into the
     ceiling. More room above, and the head keeps its own.

Applies to all six rooms. 1 shows on Groups; the rule is shared, so it is
patched everywhere rather than in the one file where it is visible today.
Reads <repo>\\public. Writes to Downloads. Must be installed to scripts\\.
"""

import os
import sys
import io

FILES = [
    "portraits.html",
    "pets.html",
    "groups.html",
    "halloween.html",
    "pets-halloween.html",
    "pets-chooser.html",
]

# ----------------------------------------------------------------------
# A . ONE COLUMN ON A PHONE
# ----------------------------------------------------------------------
# Appended at the id rule rather than added to the phone block, because
# the phone block's .floor rule is a class and loses to #siloFloor no
# matter where it sits.
A_OLD = (
    "#siloFloor[data-count=\"4\"] > *{\n"
    "  /* auto, not `auto / span 2` -- the columns are now the card width\n"
    "     rather than eighths of the floor, so a span of two would take both. */\n"
    "  grid-column:auto;\n"
    "  justify-self:stretch;\n"
    "  width:var(--silo-w);\n"
    "}"
)
A_NEW = (
    "#siloFloor[data-count=\"4\"] > *{\n"
    "  /* auto, not `auto / span 2` -- the columns are now the card width\n"
    "     rather than eighths of the floor, so a span of two would take both. */\n"
    "  grid-column:auto;\n"
    "  justify-self:stretch;\n"
    "  width:var(--silo-w);\n"
    "}\n"
    "\n"
    "/* CUI 41A, 23 Aug 2026. On a phone, one column and four rows.\n"
    "\n"
    "   Two columns of var(--silo-w) is 500px at the clamp's floor, against a\n"
    "   390px screen -- the cards were cut at both edges and the page\n"
    "   scrolled sideways. The phone block has said repeat(2, minmax(0,1fr))\n"
    "   the whole time and lost every time, because an id outranks a class\n"
    "   regardless of order or media query. The fix belongs here, at the same\n"
    "   specificity, not under an !important on the class.\n"
    "\n"
    "   One rather than two, ruled by Rich: a group photograph is wide, and\n"
    "   half a phone is not enough of one to choose by. */\n"
    "@media (max-width:767px){\n"
    "  #siloFloor[data-count=\"4\"]{\n"
    "    grid-template-columns:minmax(0,1fr);\n"
    "    grid-template-rows:none;\n"
    "    grid-auto-rows:auto;\n"
    "    justify-content:stretch;\n"
    "  }\n"
    "  #siloFloor[data-count=\"4\"] > *{\n"
    "    width:auto;\n"
    "    justify-self:stretch;\n"
    "  }\n"
    "}"
)

# ----------------------------------------------------------------------
# B . THE RAIL BREATHES
# ----------------------------------------------------------------------
B_OLD = (
    "    padding:0 12px 8px !important;\n"
    "    margin:6px 0 0;"
)
B_NEW = (
    "    padding:0 12px 10px !important;\n"
    "    /* CUI 41A, 23 Aug 2026. 6px was not enough -- the pills still read\n"
    "       as pressed against the ceiling. */\n"
    "    margin:16px 0 0;"
)

EDITS = [
    ("A . the four-card floor goes to one column", A_OLD, A_NEW),
    ("B . the filter rail clears the head",        B_OLD, B_NEW),
]

MUST_APPEAR = [
    "grid-template-columns:minmax(0,1fr);",
    "margin:16px 0 0;",
]
MUST_VANISH = [
    "margin:6px 0" + " 0;",
]


def crlf(s):
    return s.replace("\n", "\r\n")


def run(src_dir, out_dir, apply):
    ok = True
    for name in FILES:
        src = os.path.join(src_dir, name)
        print("")
        print("=" * 66)
        print(name)
        print("=" * 66)

        if not os.path.isfile(src):
            print("  REFUSED: not found -- %s" % src)
            ok = False
            continue

        f = io.open(src, "r", encoding="utf-8", newline="")
        text = f.read()
        f.close()
        before = len(text)

        halt = False
        # The four-card floor rule is not in every room -- it belongs to
        # the rooms that lay out four silos, and the others never had it.
        # Its absence is a fact about the file, not a failure.
        edits = []
        for label, old, new in EDITS:
            if label.startswith("A") and crlf(old) not in text:
                print("  --   no four-card floor in this file, skipped")
                continue
            edits.append((label, old, new))

        for label, old, new in edits:
            n = text.count(crlf(old))
            if n != 1:
                if crlf(new) in text:
                    print("  REFUSED: already applied -- %s" % label)
                else:
                    print("  REFUSED: anchor found %d times, need 1 -- %s" % (n, label))
                halt = True
        if halt:
            ok = False
            continue

        for label, old, new in edits:
            text = text.replace(crlf(old), crlf(new), 1)
            print("  ok   %s" % label)

        halt = False
        for s in MUST_APPEAR:
            if s == "grid-template-columns:minmax(0,1fr);":
                continue          # only where A applied; checked above
            if crlf(s) not in text:
                print("  REFUSED: missing after edit -- %s" % s)
                halt = True
        for s in MUST_VANISH:
            if crlf(s) in text:
                print("  REFUSED: still present after edit -- %s" % s)
                halt = True
        if halt:
            ok = False
            continue

        print("  %d bytes -> %d  (+%d)" % (before, len(text), len(text) - before))

        if apply:
            dst = os.path.join(out_dir, name)
            g = io.open(dst, "w", encoding="utf-8", newline="")
            g.write(text)
            g.close()
            print("  WROTE %s" % dst)
        else:
            print("  DRY RUN -- nothing written")

    print("")
    if not ok:
        print("ONE OR MORE FILES REFUSED. Nothing partial was written.")
        return 1
    print("All files clean.")
    return 0


if __name__ == "__main__":
    apply = "--apply" in sys.argv
    home = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    downloads = os.path.join(home, "Downloads")

    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)

    out_dir = downloads
    src_dir = ""
    for a in sys.argv[1:]:
        if a.startswith("--src="):
            src_dir = a[6:]
        if a.startswith("--out="):
            out_dir = a[6:]

    if not src_dir:
        src_dir = os.path.join(repo, "public")

    if not os.path.isdir(src_dir):
        print("")
        print("REFUSED: no public/ at %s" % src_dir)
        print("This script derives the repo from its own location and must")
        print("be installed to scripts\\ before it is run.")
        sys.exit(1)

    print("")
    print("reading  %s" % src_dir)
    print("writing  %s" % out_dir)
    sys.exit(run(src_dir, out_dir, apply))
