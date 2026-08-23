#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-mobile-r9.py  -  CUI 41A  -  23 August 2026

THE FLOOR RUNS OFF BOTH EDGES, AND r8 FIXED THE WRONG FLOOR.

r8 went after #siloFloor. The screen in front of Rich is #effectFloor --
same symptom, different element, and the cards were still cut.

THE ACTUAL CAUSE, which covers both floors and every count:

The floor is eight columns on a desktop, and a set of rules centres a
short row by placing its cards on explicit lines:

    .floor[data-count="5"] > :nth-child(1){ grid-column:2 / span 2 }
    .floor[data-count="5"] > :nth-child(4){ grid-column:3 / span 2 }

The phone block narrows the floor to two columns and saw the danger in
the span -- there is a comment about a card that spanned two of eight
wanting to span two of two. It did not see the start line. `3 / span 2`
on a two-column grid asks for columns three and four, and the grid
obligingly creates them outside the container. That is the overflow: the
cards are not too wide, they are placed off the end.

Groups shows it because its effects floor lands on count five -- four
effects and the upsell card, from `effFloor.dataset.count = list.length +
1`. Every count from 1 to 7 has one of these rules, so this is not
particular to Groups.

One line, at the same specificity the phone block already uses, and it
covers the silo floor, the effects floor and the pose floor together.

Applies to all six rooms.
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

A_OLD = "  .floor > *{ justify-self:stretch !important }"
A_NEW = (
    "  .floor > *{ justify-self:stretch !important }\n"
    "  /* CUI 41A, 23 Aug 2026. And placed by the grid, not by the\n"
    "     eight-column centring rules above.\n"
    "\n"
    "     Those give a short row explicit lines -- grid-column:2 / span 2 for\n"
    "     a floor of five, 3 / span 2 for its fourth card. Two columns is all\n"
    "     there is here, so a card asking for line three creates columns\n"
    "     outside the container and the floor overflows in both directions.\n"
    "     The comment above caught the span and not the start.\n"
    "\n"
    "     Covers all three floors -- silos, effects and poses -- and every\n"
    "     count from one to eight. */\n"
    "  .floor > *{ grid-column:auto !important; grid-row:auto !important }"
)

EDITS = [
    ("A . cards are placed by the grid, not by eight-column rules", A_OLD, A_NEW),
]

MUST_APPEAR = [
    ".floor > *{ grid-column:auto !important; grid-row:auto !important }",
]
MUST_VANISH = []


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
        for label, old, new in EDITS:
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

        for label, old, new in EDITS:
            text = text.replace(crlf(old), crlf(new), 1)
            print("  ok   %s" % label)

        halt = False
        for s in MUST_APPEAR:
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
