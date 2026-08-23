#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-mobile-r5.py  -  CUI 41A  -  23 August 2026

THE SERIES PILL COMES OUT OF THE PHONE MASTHEAD.

r1 put it there to give a phone a way between Series. The drawer already
had one -- Portraits, Groups, Mobile Wallpapers, all in the hamburger --
so it was a second navigation on a bar with no width for a first. It
pushed the bar onto two rows, and the label had to shrink so far to fit
that it could not be read anyway.

Ruled by Rich: the hamburger stays and does the navigating. The Series
stops being a control up there and becomes what it actually is -- the name
of the page you are on -- set at a size a phone can read, above the crumb
where the eye already goes.

The heading takes its text from #mhSeriesLabel rather than being written
into each file, so a Series rename stays one edit and this patch is the
same three bytes in all three rooms.

Nothing changes above 767px.

Applies to portraits.html, pets.html, groups.html. Needs r1 and r2.
Reads <repo>\\public. Writes to Downloads. Must be installed to scripts\\.
"""

import os
import sys
import io

FILES = ["portraits.html", "pets.html", "groups.html"]

# ----------------------------------------------------------------------
# A . THE PILL LEAVES THE BAR
# ----------------------------------------------------------------------
A_OLD = (
    "  .mh-nav{\n"
    "    display:flex !important;\n"
    "    justify-self:start; margin-left:10px;\n"
    "    gap:0; min-width:0;\n"
    "  }\n"
    "  .mh-nav > a{ display:none !important }\n"
    "  .mh-series{ min-width:0 }\n"
    "  .mh-series-btn{\n"
    "    max-width:46vw; min-height:38px;\n"
    "    overflow:hidden; text-overflow:ellipsis; white-space:nowrap;\n"
    "  }\n"
    "  /* Two words of a four-word label. The Series name is the part that\n"
    "     changes and the part being read. */\n"
    "  .mh-series-btn .mh-crafted{ display:none }"
)
A_NEW = (
    "  /* CUI 41A, 23 Aug 2026. r1 showed the Series pill here. Ruled out by\n"
    "     Rich the same day: the hamburger already lists every Series, so\n"
    "     this was a second navigation on a bar that had no room for it. It\n"
    "     wrapped the masthead onto two rows and the label shrank past\n"
    "     reading to fit. The room now says its own name -- see .room-name\n"
    "     below. */\n"
    "  .mh-nav{ display:none !important }"
)

# ----------------------------------------------------------------------
# B . THE ROOM SAYS ITS NAME
# ----------------------------------------------------------------------
B_OLD = (
    "    <section class=\"room room--workshop workshop-view--silos\" id=\"workshop\">\n"
    "    <div class=\"crumb\">"
)
B_NEW = (
    "    <section class=\"room room--workshop workshop-view--silos\" id=\"workshop\">\n"
    "    <!-- CUI 41A, 23 Aug 2026. Phone only. Filled from #mhSeriesLabel so\n"
    "         a Series rename stays one edit. -->\n"
    "    <h1 class=\"room-name\" id=\"roomName\"></h1>\n"
    "    <div class=\"crumb\">"
)

# ----------------------------------------------------------------------
# C . AND WHAT IT LOOKS LIKE
# ----------------------------------------------------------------------
C_OLD = "  .mh-series-btn{ max-width:34vw }"
C_NEW = (
    "  .mh-series-btn{ max-width:34vw }   /* dead since r5; the pill is gone */\n"
    "\n"
    "  /* ---- THE ROOM'S NAME  ---------------------------------------------\n"
    "     CUI 41A, 23 Aug 2026. What the pill was carrying, at a size worth\n"
    "     carrying it at. Above the crumb rather than in it: the crumb is two\n"
    "     controls and a toggle, and a title among them reads as a fourth\n"
    "     control. Serif, because it is the studio speaking rather than the\n"
    "     interface labelling itself. */\n"
    "  .room-name{\n"
    "    display:block;\n"
    "    margin:0; padding:14px var(--card-gap) 2px;\n"
    "    font-family:var(--serif); font-weight:400; font-style:normal;\n"
    "    font-size:2.1rem; line-height:1.1;\n"
    "    color:var(--ink);\n"
    "  }\n"
)

# Off everywhere else. Placed at the base rule so it never paints on a
# desktop, where the masthead pill is still the Series.
D_OLD = ".crumb{\n  display:flex; align-items:center; gap:10px;"
D_NEW = (
    "/* CUI 41A, 23 Aug 2026. Phone only -- see the 767 block. On a desktop\n"
    "   the masthead pill is the Series and a heading would say it twice. */\n"
    ".room-name{ display:none }\n"
    "\n"
    ".crumb{\n"
    "  display:flex; align-items:center; gap:10px;"
)

# ----------------------------------------------------------------------
# E . FILLED
# ----------------------------------------------------------------------
E_OLD = (
    "    window.addEventListener('resize', sync);\n"
    "    sync();\n"
    "    window.__phoneStep = step;"
)
E_NEW = (
    "    /* CUI 41A, 23 Aug 2026. The room's name, taken from the masthead\n"
    "       label so there is one source for it. 'Crafted' is the brand half\n"
    "       and lives in its own span; what is wanted is the Series. */\n"
    "    (function(){\n"
    "      var out = document.getElementById('roomName');\n"
    "      var src = document.getElementById('mhSeriesLabel');\n"
    "      if (!out || !src) return;\n"
    "      var full = (src.textContent || '').trim();\n"
    "      var word = src.querySelector('.mh-crafted');\n"
    "      if (word) full = full.replace((word.textContent || '').trim(), '').trim();\n"
    "      out.textContent = full;\n"
    "    })();\n"
    "\n"
    "    window.addEventListener('resize', sync);\n"
    "    sync();\n"
    "    window.__phoneStep = step;"
)

EDITS = [
    ("A . the pill leaves the phone masthead", A_OLD, A_NEW),
    ("B . the room gets a heading",            B_OLD, B_NEW),
    ("C . sized for a phone",                  C_OLD, C_NEW),
    ("D . and off on a desktop",               D_OLD, D_NEW),
    ("E . filled from the masthead label",     E_OLD, E_NEW),
]

MUST_APPEAR = [
    "id=\"roomName\"",
    ".mh-nav{ display:none !important }",
    ".room-name{ display:none }",
    "out.textContent = full;",
]
MUST_VANISH = [
    "max-width:46vw; min-height:38px;",
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
                print("  REFUSED: anchor found %d times, need 1 -- %s" % (n, label))
                halt = True
            if crlf(new) in text:
                print("  REFUSED: replacement already present -- %s" % label)
                halt = True
        if halt:
            print("  (r1 and r2 must be installed before r5.)")
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
