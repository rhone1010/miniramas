#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-mobile-r6.py  -  CUI 41A  -  23 August 2026

  1  THE DRAWER STAYS OPEN OVER MY COLLECTION AND ACCOUNT.
     It closed on three things only: its own hamburger, Escape, and the
     two links this lane wired by hand. Portraits, Groups, Gallery and
     Community are real navigations, so the page reloads and the drawer
     goes with it -- which is why it looked fine on those and broken on
     the other two. My Collection and Account are surfaces on the same
     page. Nothing reloads, so the drawer sat over them.

     Fixed with one delegated handler rather than a listener per link.
     Once the drawer is open, the next click anywhere closes it -- inside
     it, outside it, on the band, on the floor. The only click excepted
     is the hamburger's own, which has to keep toggling.

     This does not replace the existing toggle or the Escape key. It sits
     beside them, so nothing that worked stops working.

  2  THE NAME GOES FROM COMMUNITY TOO.
     r2 took it out of the three rooms it touched. Ruled by Rich today:
     every masthead. community.html is the only other page carrying one --
     gallery, index and wallpapers have no name in the bar at all.

Applies to all six rooms plus community.html.
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
    "community.html",
]

# ----------------------------------------------------------------------
# A . THE HANDLER
# ----------------------------------------------------------------------
# Anchored on the drawer's own opening tag, which is byte-identical in all
# seven files. The two script shapes are not -- the rooms use
# document.getElementById and community uses a $ shorthand -- so anchoring
# on the markup keeps this one patch rather than two.
A_OLD = "<nav class=\"mh-drawer\" id=\"mhDrawer\" hidden>"
A_NEW = (
    "<!-- CUI 41A, 23 Aug 2026. See the script below this nav. -->\n"
    "<nav class=\"mh-drawer\" id=\"mhDrawer\" hidden>"
)

B_OLD = (
    "<!-- CUI 41A, 23 Aug 2026. See the script below this nav. -->\n"
    "<nav class=\"mh-drawer\" id=\"mhDrawer\" hidden>"
)
# Second pass: the script goes after the nav closes. Anchored on the
# comment A just inserted, so the two cannot drift apart.
B_NEW = B_OLD  # replaced below once the closing tag is known


def crlf(s):
    return s.replace("\n", "\r\n")


CLOSER = (
    "\n"
    "<script>\n"
    "/* CUI 41A, 23 Aug 2026. The drawer closes on the next click, whatever\n"
    "   it lands on. It used to close only on its own hamburger, on Escape,\n"
    "   and on the two links wired by hand -- which meant it stayed open\n"
    "   over My Collection and Account, the two drawer entries that change a\n"
    "   surface on this page instead of loading another one.\n"
    "\n"
    "   Delegated rather than bound per link, so a link added to the drawer\n"
    "   later cannot reintroduce this. Capture phase, so it runs before a\n"
    "   handler that stops propagation. The hamburger is excepted or its own\n"
    "   click would close what it just opened. */\n"
    "(function(){\n"
    "  document.addEventListener('click', function(e){\n"
    "    var dw = document.getElementById('mhDrawer');\n"
    "    if (!dw || dw.hasAttribute('hidden')) return;\n"
    "    var t = e.target;\n"
    "    if (t && t.closest && t.closest('#mhMenuBtn')) return;\n"
    "    dw.setAttribute('hidden','');\n"
    "    var mb = document.getElementById('mhMenuBtn');\n"
    "    if (mb) mb.setAttribute('aria-expanded','false');\n"
    "  }, true);\n"
    "})();\n"
    "</script>\n"
)


def build_edits(text):
    """The drawer's closing </nav> differs between files -- r2 added an
    entry to the rooms' copy and community has never had one. Find the
    nav's own end rather than assuming its contents."""
    open_tag = "<nav class=\"mh-drawer\" id=\"mhDrawer\" hidden>"
    i = text.find(crlf(open_tag)) if crlf(open_tag) in text else text.find(open_tag)
    if i < 0:
        return None
    j = text.find("</nav>", i)
    if j < 0:
        return None
    tail = text[i:j + len("</nav>")]
    # Extracted straight from the file, so it is already CRLF. run() calls
    # crlf() on every anchor, which would turn each \r\n into \r\r\n and
    # match nothing. Hand it back in LF and let that one path do the work.
    tail = tail.replace("\r\n", "\n")
    return [("A . the drawer closes on the next click", tail, tail + CLOSER)]


C_OLD = "<span class=\"who\" id=\"mhWho\" hidden>"
C_NEW = "<span class=\"who\" id=\"mhWho\" data-r6-hidden hidden>"

# community has no 767 rule for the name; the rooms got one in r2. One
# attribute selector covers both without needing to find each file's
# mobile block.
D_OLD = "<nav class=\"mh-drawer\" id=\"mhDrawer\" hidden>"
D_NEW = (
    "<style>\n"
    "/* CUI 41A, 23 Aug 2026. Ruled by Rich: no name in any masthead on a\n"
    "   phone. r2 did this for three rooms inside their own mobile block;\n"
    "   this reaches the rest without needing to find seven of them. */\n"
    "@media (max-width:767px){ [data-r6-hidden]{ display:none !important } }\n"
    "</style>\n"
    "<nav class=\"mh-drawer\" id=\"mhDrawer\" hidden>"
)

MUST_APPEAR = [
    "if (t && t.closest && t.closest('#mhMenuBtn')) return;",
    "data-r6-hidden hidden>",
    "@media (max-width:767px){ [data-r6-hidden]{ display:none !important } }",
]


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

        if "data-r6-hidden" in text:
            print("  REFUSED: already applied")
            ok = False
            continue

        edits = build_edits(text)
        if edits is None:
            print("  REFUSED: no drawer found in this file")
            ok = False
            continue
        edits = edits + [
            ("B . the name is marked", C_OLD, C_NEW),
            ("C . and hidden on a phone", D_OLD, D_NEW),
        ]

        halt = False
        probe = text
        for label, old, new in edits:
            n = probe.count(crlf(old))
            if n != 1:
                print("  REFUSED: anchor found %d times, need 1 -- %s" % (n, label))
                halt = True
                break
            probe = probe.replace(crlf(old), crlf(new), 1)
        if halt:
            ok = False
            continue

        text = probe
        for label, old, new in edits:
            print("  ok   %s" % label)

        halt = False
        for s in MUST_APPEAR:
            if crlf(s) not in text:
                print("  REFUSED: missing after edit -- %s" % s)
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
