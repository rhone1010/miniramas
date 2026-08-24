#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-index-reel-r11.py  -  CUI 41A  -  23 August 2026

  1  r10 THREW ON LOAD. MY FAULT, AND A PLAIN ONE.

     start() already declares `var SERIES` for the Series picker, six
     hundred lines below where r10 put its own `var SERIES` in the outer
     scope. `var` hoists to the top of the function it is in, so inside
     start() the name meant the picker's array -- which has not been
     assigned yet at the point the reel reads it. `SERIES.map(...)` threw
     "Cannot read properties of undefined" and everything after it in
     start() died with it.

     r10's own checks could not have caught this. The anchors matched, the
     bytes were right, and both inline scripts parsed -- a shadowed `var`
     is valid JavaScript. It needed the page to run.

     Renamed to REEL_SERIES. The picker keeps SERIES; it was there first
     and it is referenced by name further down.

  2  AUTO-ADVANCE BETWEEN PANELS.

     Ruled by Rich: sequential is right, because somebody who does nothing
     should still see every Series. The swipe is for people who want to
     get on. So the panel now turns over on its own once its plates have
     been round once, and a manual swipe buys ten seconds of quiet before
     the automatic one resumes -- otherwise it drags them off the panel
     they just chose, which is worse than not having it.

Applies to index.html. Needs r10.
Reads <repo>\\public. Writes to Downloads. Must be installed to scripts\\.
"""

import os
import sys
import io

FILES = ["index.html"]

# ----------------------------------------------------------------------
# A . THE NAME
# ----------------------------------------------------------------------
A_OLD = (
    "     unmarked is carried over from the old REEL, plate for plate. */\n"
    "  var SERIES = [\n"
    "    { id:'portraits', label:'Portraits', href:'/portraits',"
)
A_NEW = (
    "     unmarked is carried over from the old REEL, plate for plate.\n"
    "\n"
    "     REEL_SERIES, not SERIES. start() declares its own `var SERIES` for\n"
    "     the Series picker further down, and `var` hoists to the top of the\n"
    "     function -- so inside start() the bare name meant the picker's\n"
    "     array, unassigned at the point the reel read it. r10 shipped that\n"
    "     and threw on load. CUI 41A, 23 Aug 2026. */\n"
    "  var REEL_SERIES = [\n"
    "    { id:'portraits', label:'Portraits', href:'/portraits',"
)

B_OLD = "    var PANELS = SERIES.map(function(s){"
B_NEW = "    var PANELS = REEL_SERIES.map(function(s){"

# ----------------------------------------------------------------------
# C . THE PANEL TURNS OVER ON ITS OWN
# ----------------------------------------------------------------------
C_OLD = (
    "    function clock(){\n"
    "      if (timer) clearInterval(timer);\n"
    "      timer = setInterval(function(){\n"
    "        i = (i + 1) % frames.length;\n"
    "        paint(frames[i]);\n"
    "      }, 3000);\n"
    "    }"
)
C_NEW = (
    "    /* CUI 41A, 23 Aug 2026. The panel advances by itself once its\n"
    "       plates have been round once. Somebody who never touches the\n"
    "       screen still sees every Series; the swipe is for people who want\n"
    "       to get on rather than the only way to move.\n"
    "\n"
    "       A manual swipe buys HOLD milliseconds of quiet. Without it the\n"
    "       automatic turn drags them off the panel they have just chosen,\n"
    "       which is worse than not having it at all. */\n"
    "    var HOLD = 10000, held = 0;\n"
    "\n"
    "    function clock(){\n"
    "      if (timer) clearInterval(timer);\n"
    "      timer = setInterval(function(){\n"
    "        /* Last plate of the panel, and nobody has touched it lately. */\n"
    "        if (i === frames.length - 1 && Date.now() > held){\n"
    "          go(panel + 1, 1);\n"
    "          return;\n"
    "        }\n"
    "        i = (i + 1) % frames.length;\n"
    "        paint(frames[i]);\n"
    "      }, 3000);\n"
    "    }"
)

# ----------------------------------------------------------------------
# D . AND A TOUCH QUIETENS IT
# ----------------------------------------------------------------------
D_OLD = (
    "    function go(next, dirn){\n"
    "      next = (next + PANELS.length) % PANELS.length;\n"
    "      panel = next;"
)
D_NEW = (
    "    function go(next, dirn){\n"
    "      /* dirn is 0 only for the first paint. Anything else came from a\n"
    "         thumb or a dot, so the automatic turn stands off for a while. */\n"
    "      if (dirn) held = Date.now() + HOLD;\n"
    "      next = (next + PANELS.length) % PANELS.length;\n"
    "      panel = next;"
)

EDITS = [
    ("A . REEL_SERIES, not SERIES",            A_OLD, A_NEW),
    ("B . and the panels read the new name",   B_OLD, B_NEW),
    ("C . the panel turns over on its own",    C_OLD, C_NEW),
    ("D . unless a thumb has just been there", D_OLD, D_NEW),
]

MUST_APPEAR = [
    "var REEL_SERIES = [",
    "var PANELS = REEL_SERIES.map(function(s){",
    "if (i === frames.length - 1 && Date.now() > held){",
    "if (dirn) held = Date.now() + HOLD;",
]
MUST_VANISH = [
    "PANELS = SERIES.map",
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
                    print("  REFUSED: anchor found %d times, need 1 -- %s" % (n, label))
                halt = True
        if halt:
            print("  (r10 must be installed before r11.)")
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

        # The fault r10 shipped: two `var SERIES` in one scope. Checked
        # here explicitly, because it is valid JavaScript and no parser
        # will complain about it.
        #
        # Counted as whole lines. Counting the substring double-counts:
        # the picker's line is indented four spaces and contains the
        # two-space form inside it.
        decls = [ln for ln in text.split("\r\n") if ln.strip().startswith("var SERIES")]
        if len(decls) > 1:
            print("  REFUSED: %d `var SERIES` declarations remain" % len(decls))
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
