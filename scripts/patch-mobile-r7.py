#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-mobile-r7.py  -  CUI 41A  -  23 August 2026

THE COLLECTION STARTS UNDERNEATH THE MASTHEAD.

.mycoll, .pshop and .acct are fixed surfaces. Their base rule seats them
at top:var(--mh-h), which is right. The phone block sets --mh-h:auto so
the masthead can size to its own content -- and 'auto' is not a length, so
top:var(--mh-h) resolves to nothing. Whoever met that reached for
top:0 !important, which is why the filter rail and the collection's head
sit behind the bar with no way to scroll them out.

Print Shop and Account have the same fault; only the collection shows it
plainly, because the other two open with a heading that survives being
clipped.

Fixed the way the band already was: measure it and publish the number.
--mh-real-h is set from the masthead's own offsetHeight on load, on
resize, and whenever the masthead changes -- it wraps to two rows at some
widths, so a constant would be wrong again the moment it did.

Also: the filter rail scrolls sideways, which is right for seven Series,
but its first and last pill sat flush against the screen edge, so a rail
that had more to show looked like a rail that was cut off. A pill's width
of padding at each end says which it is.

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

# ----------------------------------------------------------------------
# A . SEAT THEM
# ----------------------------------------------------------------------
A_OLD = (
    "  .mycoll, .pshop, .acct{\n"
    "    top:0 !important;\n"
    "    bottom:var(--lg-band-h, 62px) !important;\n"
    "    left:0 !important; right:0 !important;\n"
    "    display:flex !important; flex-direction:column;\n"
    "  }"
)
A_NEW = (
    "  .mycoll, .pshop, .acct{\n"
    "    /* CUI 41A, 23 Aug 2026. Was top:0, which put all three of these\n"
    "       underneath the masthead -- the collection's filter rail and its\n"
    "       head were behind the bar and could not be scrolled out. The base\n"
    "       rule seats them at var(--mh-h), but this block sets that to\n"
    "       'auto' so the bar can size to its content, and 'auto' is not a\n"
    "       length. Measured instead, the same way the band below is. */\n"
    "    top:var(--mh-real-h, 60px) !important;\n"
    "    bottom:var(--lg-band-h, 62px) !important;\n"
    "    left:0 !important; right:0 !important;\n"
    "    display:flex !important; flex-direction:column;\n"
    "  }"
)

# ----------------------------------------------------------------------
# B . THE RAIL'S EDGES
# ----------------------------------------------------------------------
B_OLD = (
    "  .mycoll .mc-filters{\n"
    "    display:flex !important;\n"
    "    flex-wrap:nowrap !important;\n"
    "    overflow-x:auto;\n"
    "    gap:6px;\n"
    "    padding:0 0 8px !important;\n"
    "    margin:0;"
)
B_NEW = (
    "  .mycoll .mc-filters{\n"
    "    display:flex !important;\n"
    "    flex-wrap:nowrap !important;\n"
    "    overflow-x:auto;\n"
    "    gap:6px;\n"
    "    /* CUI 41A, 23 Aug 2026. Was 0 at both ends. The first pill sat\n"
    "       against the screen edge and the last was sliced mid-word, so a\n"
    "       rail with more to show read as a rail running off the page.\n"
    "       Room at each end, and a top margin so it clears the head. */\n"
    "    padding:0 12px 8px !important;\n"
    "    margin:6px 0 0;"
)

# ----------------------------------------------------------------------
# C . THE MEASUREMENT
# ----------------------------------------------------------------------
C_OLD = (
    "  var mb = document.getElementById('mhMenuBtn'), dw = document.getElementById('mhDrawer');"
)
C_NEW = (
    "  /* CUI 41A, 23 Aug 2026. The masthead's real height, published for the\n"
    "     three fixed surfaces that have to start below it. --mh-h is 'auto'\n"
    "     on a phone so the bar can size to its content, which means nothing\n"
    "     can position against it. The bar also wraps to two rows at some\n"
    "     widths, so this is watched rather than read once. */\n"
    "  (function(){\n"
    "    var head = document.querySelector('.mh');\n"
    "    if (!head) return;\n"
    "    function measure(){\n"
    "      var h = head.offsetHeight;\n"
    "      if (h > 0) document.documentElement.style.setProperty('--mh-real-h', h + 'px');\n"
    "    }\n"
    "    measure();\n"
    "    addEventListener('resize', measure);\n"
    "    addEventListener('load', measure);\n"
    "    if (window.ResizeObserver) new ResizeObserver(measure).observe(head);\n"
    "  })();\n"
    "\n"
    "  var mb = document.getElementById('mhMenuBtn'), dw = document.getElementById('mhDrawer');"
)

EDITS = [
    ("A . the surfaces sit below the masthead", A_OLD, A_NEW),
    ("B . the rail gets room at both ends",     B_OLD, B_NEW),
    ("C . the masthead is measured",            C_OLD, C_NEW),
]

MUST_APPEAR = [
    "top:var(--mh-real-h, 60px) !important;",
    "padding:0 12px 8px !important;",
    "new ResizeObserver(measure).observe(head);",
]
MUST_VANISH = [
    "    top:0 !impor" + "tant;",
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
