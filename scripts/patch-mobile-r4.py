#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-mobile-r4.py  -  CUI 41A  -  23 August 2026

r3 put the gate on addToQueue, which is the door every other route uses.
The effects floor has its own guard ahead of it, ruled 2026-08-09, and it
returns before addToQueue is ever called -- so on a phone the modal never
opened and a toast said 'Please upload an image first' with no way to go
and do it. askForPhoto() pulses the Curator slot, which on a phone is on
the other step and cannot be seen.

The toast and the pulse are right on a desktop, where the slot is on the
screen and pulsing. On a phone the modal is the only thing that can
actually take somebody somewhere, so it takes over.

The 'Add all' card is unaffected -- it returns above this guard and calls
addToQueue itself, so r3's gate already covers it.

Applies to portraits.html, pets.html, groups.html. Needs r3.
Reads <repo>\\public. Writes to Downloads. Must be installed to scripts\\.
"""

import os
import sys
import io

FILES = ["portraits.html", "pets.html", "groups.html"]

A_OLD = (
    "    if (!hasSource()){\n"
    "      nudge(c, 'Please upload an image first');\n"
    "      askForPhoto(true);\n"
    "      return;\n"
    "    }"
)
A_NEW = (
    "    if (!hasSource()){\n"
    "      /* CUI 41A, 23 Aug 2026. On a phone this guard fired ahead of the\n"
    "         gate r3 put on addToQueue, so the modal never opened. The\n"
    "         toast is honest and the pulse is not -- curSlot is on the\n"
    "         upload step, off screen, so nothing visibly answered the\n"
    "         press. The modal is the only one of the three that offers a\n"
    "         way to go and fix it. */\n"
    "      if (phoneNeedsPhoto()){ openNeedPhoto(); return; }\n"
    "      nudge(c, 'Please upload an image first');\n"
    "      askForPhoto(true);\n"
    "      return;\n"
    "    }"
)

EDITS = [
    ("A . the floor's guard defers to the modal on a phone", A_OLD, A_NEW),
]

MUST_APPEAR = [
    "if (phoneNeedsPhoto()){ openNeedPhoto(); return; }",
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

        # r3 must be in, or openNeedPhoto does not exist to be called.
        if "function openNeedPhoto()" not in text:
            print("  REFUSED: r3 is not installed -- no openNeedPhoto in this file")
            ok = False
            continue

        halt = False
        for label, old, new in EDITS:
            n = text.count(crlf(old))
            if n != 1:
                print("  REFUSED: anchor found %d times, need 1 -- %s" % (n, label))
                halt = True
            if crlf(new) in text:
                print("  REFUSED: replacement already present -- %s" % label)
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
