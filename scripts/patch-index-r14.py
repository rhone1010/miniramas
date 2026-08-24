#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-index-r14.py  -  CUI 41A  -  23 August 2026

The homepage desktop nav was its own set of links (Portraits / The Finishes /
The Gift / Help / Enter the studio). The rooms show Portraits / Groups / Pets /
Halloween / Wallpapers / Gallery / Community. Ruled by Rich: match the rooms.

My Collection and Account are omitted -- the homepage has no session context
and those links would arrive empty. The CTA pill becomes "Enter the studio"
pointing at /portraits, unchanged.

Reads <repo>\\public. Writes to Downloads. Must be installed to scripts\\.
"""

import os
import sys
import io

FILES = ["index.html"]

A_OLD = (
    "    <a class=\"navlink\" href=\"/portraits\">Portraits</a>\n"
    "    <a class=\"navlink\" href=\"/gallery\">The Finishes</a>\n"
    "    <a class=\"navlink\" href=\"#gift\">The Gift</a>\n"
    "    <a class=\"navlink\" href=\"/help\">Help</a>\n"
    "    <a class=\"pill pill-ghost\" href=\"/portraits\">Enter the studio</a>"
)
A_NEW = (
    "    <!-- CUI 41A, 23 Aug 2026. Ruled by Rich: match the room nav. -->\n"
    "    <a class=\"navlink\" href=\"/portraits\">Portraits</a>\n"
    "    <a class=\"navlink\" href=\"/groups\">Groups</a>\n"
    "    <a class=\"navlink\" href=\"/pets\">Pets</a>\n"
    "    <a class=\"navlink\" href=\"/halloween\">Halloween</a>\n"
    "    <a class=\"navlink\" href=\"/wallpapers\">Wallpapers</a>\n"
    "    <a class=\"navlink\" href=\"/gallery\">Gallery</a>\n"
    "    <a class=\"navlink\" href=\"/community\">Community</a>\n"
    "    <a class=\"pill pill-ghost\" href=\"/portraits\">Enter the studio</a>"
)

EDITS = [("A . nav links match the rooms", A_OLD, A_NEW)]
MUST_APPEAR = ["href=\"/groups\">Groups</a>", "href=\"/community\">Community</a>"]
MUST_VANISH = [
    "class=\"navlink\" href=\"#gift\">The Gift</a>",
    "class=\"navlink\" href=\"/gallery\">The Finishes</a>",
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
        for label, old, new in EDITS:
            n = text.count(crlf(old))
            if n != 1:
                if crlf(new) in text:
                    print("  REFUSED: already applied -- %s" % label)
                else:
                    print("  REFUSED: anchor %d times, need 1 -- %s" % (n, label))
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
                print("  REFUSED: missing -- %s" % s)
                halt = True
        for s in MUST_VANISH:
            if crlf(s) in text:
                print("  REFUSED: still present -- %s" % s)
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
        print("ONE OR MORE FILES REFUSED.")
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
        print("Install to scripts\\ first.")
        sys.exit(1)

    print("")
    print("reading  %s" % src_dir)
    print("writing  %s" % out_dir)
    sys.exit(run(src_dir, out_dir, apply))
