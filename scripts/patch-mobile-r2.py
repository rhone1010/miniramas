#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-mobile-r2.py  -  CUI 41A  -  23 August 2026

The masthead on a phone. Rich's five, 23 August.

  1  The username goes.
  2  The credit balance stays.
  3  Sign out moves into the hamburger.
  4  Help and cart sit next to each other.
  5  The logo stays. See the note below.

WHY THE LOGO STAYS. Hiding the wordmark saves no width at all -- the SVG
holds the quill and the lettering in one viewBox, so its width is fixed by
its aspect ratio however much of it is painted. The width was being eaten
by the username pill and the Sign out link, which is what 1 and 3 remove.
The word 'Cart' goes too; the trolley says it. Between them that is about
190px back on a 366px bar, which is the whole of the overlap.

Applies to portraits.html, pets.html, groups.html.
Reads <repo>\\public. Writes to Downloads. Must be installed to scripts\\.
"""

import os
import sys
import io

FILES = ["portraits.html", "pets.html", "groups.html"]

# ----------------------------------------------------------------------
# A . SIGN OUT, IN THE DRAWER
# ----------------------------------------------------------------------
A_OLD = (
    "    <a href=\"#\" data-concierge>Ask the Concierge</a>\n"
    "  </nav>\n"
    "</header>"
)
A_NEW = (
    "    <a href=\"#\" data-concierge>Ask the Concierge</a>\n"
    "    <!-- CUI 41A, 23 Aug 2026. The way out, on a phone. The real\n"
    "         control is #mhSignOut in the right cluster, which has no room\n"
    "         at this width; this entry clicks it rather than holding a\n"
    "         second copy of the fetch. Hidden with it when there is nobody\n"
    "         to sign out. -->\n"
    "    <a href=\"#\" id=\"mhDrawerOut\" data-signout hidden>Sign out</a>\n"
    "  </nav>\n"
    "</header>"
)

# ----------------------------------------------------------------------
# B . AND IT APPEARS AND GOES WITH THE REAL ONE
# ----------------------------------------------------------------------
B_OLD = "    if (mhSignOut) mhSignOut.hidden = !ME;"
B_NEW = (
    "    if (mhSignOut) mhSignOut.hidden = !ME;\n"
    "    /* CUI 41A, 23 Aug 2026. The drawer's copy follows it. A dead\n"
    "       'Sign out' in a menu is worse than none. */\n"
    "    var drawerOut = document.getElementById('mhDrawerOut');\n"
    "    if (drawerOut) drawerOut.hidden = !ME;"
)

# ----------------------------------------------------------------------
# C . THE CLICK
# ----------------------------------------------------------------------
C_OLD = (
    "document.addEventListener('click', function(e){\n"
    "  if (!e.target.closest('.mh-drawer [data-concierge]')) return;\n"
    "  var dw = document.getElementById('mhDrawer');\n"
    "  var mb = document.getElementById('mhMenuBtn');\n"
    "  if (dw) dw.setAttribute('hidden','');\n"
    "  if (mb) mb.setAttribute('aria-expanded','false');\n"
    "});"
)
C_NEW = (
    "document.addEventListener('click', function(e){\n"
    "  if (!e.target.closest('.mh-drawer [data-concierge]')) return;\n"
    "  var dw = document.getElementById('mhDrawer');\n"
    "  var mb = document.getElementById('mhMenuBtn');\n"
    "  if (dw) dw.setAttribute('hidden','');\n"
    "  if (mb) mb.setAttribute('aria-expanded','false');\n"
    "});\n"
    "\n"
    "/* CUI 41A, 23 Aug 2026. Same shape for the way out. The drawer closes\n"
    "   and the real button is clicked -- one signout path, not two. */\n"
    "document.addEventListener('click', function(e){\n"
    "  if (!e.target.closest('.mh-drawer [data-signout]')) return;\n"
    "  e.preventDefault();\n"
    "  var dw = document.getElementById('mhDrawer');\n"
    "  var mb = document.getElementById('mhMenuBtn');\n"
    "  if (dw) dw.setAttribute('hidden','');\n"
    "  if (mb) mb.setAttribute('aria-expanded','false');\n"
    "  var real = document.getElementById('mhSignOut');\n"
    "  if (real) real.click();\n"
    "});"
)

# ----------------------------------------------------------------------
# D . THE BAR ITSELF
# ----------------------------------------------------------------------
# r1 turned the hamburger off and put the Series pill in its place. The
# hamburger has to come back to carry Sign out, so this replaces r1's line
# rather than sitting next to it.
D_OLD = "  .mh-menu, .mh-drawer{ display:none !important }"
D_NEW = (
    "  /* CUI 41A, 23 Aug 2026. r1 turned the hamburger off and gave its\n"
    "     place to the Series pill. Sign out now lives in the drawer, so the\n"
    "     hamburger comes back and the two share the bar. */\n"
    "  .mh-menu{ display:flex !important; margin-left:0 }\n"
)

# The right cluster, reordered and tightened.
E_OLD = "  .mh-series-btn .mh-crafted{ display:none }"
E_NEW = (
    "  .mh-series-btn .mh-crafted{ display:none }\n"
    "\n"
    "  /* ---- THE RIGHT CLUSTER  -------------------------------------------\n"
    "     CUI 41A, 23 Aug 2026. Rich's five.\n"
    "\n"
    "     The name goes. The balance stays -- it is the only number on the\n"
    "     bar that changes and the only one anybody checks. Sign out goes to\n"
    "     the drawer. Help and cart end up beside each other, which is where\n"
    "     they belonged: one asks the studio something, the other holds what\n"
    "     is being bought, and neither is the balance.\n"
    "\n"
    "     Order, left to right: credits, help, cart. DOM order is help,\n"
    "     credits, cart, so the flex order property does the move rather\n"
    "     than the markup -- the desktop arrangement is untouched. */\n"
    "  .mh-credits .who{ display:none !important }\n"
    "  .mh-out{ display:none !important }\n"
    "\n"
    "  .mh-right{ gap:8px }\n"
    "  .mh-credits{ order:1 }\n"
    "  .mh-ask{ order:2 }\n"
    "  .mh-cart{ order:3 }\n"
    "\n"
    "  /* The trolley says cart. The word is 44px of a 366px bar. */\n"
    "  .mh-cart .lbl{ display:none }\n"
    "\n"
    "  /* Pills at 16px of padding each side were sized for a canvas. */\n"
    "  .mh-credits, .mh-cart{ padding:0 11px; gap:7px }\n"
    "\n"
    "  /* With the hamburger back, the pill takes what is left rather than a\n"
    "     share of the viewport. 46vw was 179px and it ran under the help\n"
    "     mark on a 390px screen. */\n"
    "  .mh-series-btn{ max-width:34vw }\n"
)

EDITS = [
    ("A . Sign out drawn in the drawer",        A_OLD, A_NEW),
    ("B . and hidden with the real control",    B_OLD, B_NEW),
    ("C . and acted on",                        C_OLD, C_NEW),
    ("D . the hamburger comes back",            D_OLD, D_NEW),
    ("E . right cluster reordered, name gone",  E_OLD, E_NEW),
]

MUST_APPEAR = [
    "id=\"mhDrawerOut\" data-signout hidden",
    "if (drawerOut) drawerOut.hidden = !ME;",
    "data-signout]')) return;",
    ".mh-credits .who{ display:none !important }",
    ".mh-cart .lbl{ display:none }",
]
# r1's line must be gone -- D replaces it. Split so this check cannot be
# satisfied by the patch's own comment text.
MUST_VANISH = [
    ".mh-menu, .mh-drawer{ display" + ":none !important }",
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
            print("  (r1 must be installed before r2.)")
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
