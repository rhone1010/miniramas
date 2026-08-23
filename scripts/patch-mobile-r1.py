#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-mobile-r1.py  -  CUI 41A  -  23 August 2026

Three mobile repairs, applied to portraits.html, pets.html, groups.html.

  1  THE TRAY SEATS ON THE BAND AFTER SEVEN SECONDS.
     seat() drops the tray to bottom:26px when the band carries is-tucked.
     The tuck transform was later disabled outright -- .band{transform:none
     !important} in the phone block -- so the class still lands on the 7s
     timer, the band does not move, and the tray falls onto the tabs.
     Seat on the measured height, always.

  2  NO SERIES NAVIGATION BELOW 767px.
     .mh-nav goes at the 900 breakpoint, the hamburger replaces it, and the
     phone block hides the hamburger too. Nothing is left. The Series
     picker already exists and works -- #mhSeriesBtn and #mhSeriesMenu.
     Show that pill on a phone and nothing else from the bar.

  3  POST TO COMMUNITY IS UNREACHABLE ON A PHONE.
     paintActs() builds it into #mcActs. The phone hides .mc-acts and opens
     the lightbox instead, and paintLightbox() never built the button.
     Same guard as the featured pane: only where the modal exists.

Dry run by default. --apply to write.
Pre-write assertions refuse on any anchor that is not present exactly once.
Post-write verification refuses to keep a file that does not read back clean.
Output goes to %USERPROFILE%\\Downloads.
"""

import os
import sys
import io

FILES = ["portraits.html", "pets.html", "groups.html"]

# ----------------------------------------------------------------------
# 1 . THE TRAY
# ----------------------------------------------------------------------
T1_OLD = (
    "      var h = band.classList.contains('is-tucked') ? 26 : band.offsetHeight;"
)
T1_NEW = (
    "      /* CUI 41A, 23 Aug 2026. Was: is-tucked ? 26 : offsetHeight. The\n"
    "         tuck transform is disabled in the last phone block, so the\n"
    "         class arrives on the 7s timer while the band stays put and the\n"
    "         tray dropped 36px onto the tabs. The measured height is the\n"
    "         only true one. */\n"
    "      var h = band.offsetHeight;"
)

# ----------------------------------------------------------------------
# 2 . THE SERIES PILL
# ----------------------------------------------------------------------
T2_OLD = "  .mh-menu, .mh-drawer{ display:none !important }"
T2_NEW = (
    "  .mh-menu, .mh-drawer{ display:none !important }\n"
    "\n"
    "  /* ---- SERIES, ON A PHONE  ------------------------------------------\n"
    "     CUI 41A, 23 Aug 2026. Below 767 there was no way to another Series\n"
    "     at all: this bar goes at 900, the hamburger takes over, and the\n"
    "     line above then hides the hamburger. The picker was built and\n"
    "     working the whole time, sitting inside the hidden bar.\n"
    "\n"
    "     The bar comes back holding one thing. The pill says the room you\n"
    "     are in and opens the list. Gallery, Community, My Collection and\n"
    "     Account stay out -- three of the four are tabs in the band, and\n"
    "     Gallery is not worth the width up here. */\n"
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
    "  .mh-series-btn .mh-crafted{ display:none }\n"
)

# ----------------------------------------------------------------------
# 3a . THE BUTTON
# ----------------------------------------------------------------------
T3A_OLD = (
    "    if (left > 0){\n"
    "      acts += '<button class=\"mc-act\" data-lb=\"re\">' +\n"
    "              (left === 1 ? 'Craft this again \\u00b7 last one' : 'Craft this again') +\n"
    "              '</button>';\n"
    "    }\n"
    "    lboxActs.innerHTML = acts;"
)
T3A_NEW = (
    "    if (left > 0){\n"
    "      acts += '<button class=\"mc-act\" data-lb=\"re\">' +\n"
    "              (left === 1 ? 'Craft this again \\u00b7 last one' : 'Craft this again') +\n"
    "              '</button>';\n"
    "    }\n"
    "    /* CUI 41A, 23 Aug 2026. The fourth action, which the featured pane\n"
    "       has had since the modal shipped. On a phone .mc-acts is hidden\n"
    "       and this is the only place a piece is looked at, so the button\n"
    "       was simply not reachable. Same guard as paintActs -- a button\n"
    "       that opens nothing is worse than no button -- plus serverId,\n"
    "       because a piece still crafting has no row to post. */\n"
    "    if (p.serverId && typeof window.openPostToCommunity === 'function'){\n"
    "      acts += '<button class=\"mc-act\" data-lb=\"post\">Post to Community</button>';\n"
    "    }\n"
    "    lboxActs.innerHTML = acts;"
)

# ----------------------------------------------------------------------
# 3b . THE HANDLER
# ----------------------------------------------------------------------
T3B_OLD = (
    "      if (typeof window.__requestRerender === 'function') window.__requestRerender(lbList()[LB_AT]);\n"
    "      paintLightbox();\n"
    "    }\n"
    "  });"
)
T3B_NEW = (
    "      if (typeof window.__requestRerender === 'function') window.__requestRerender(lbList()[LB_AT]);\n"
    "      paintLightbox();\n"
    "    }\n"
    "    else if (what === 'post'){\n"
    "      /* Straight across from the featured pane's handler. */\n"
    "      var post = lbList()[LB_AT];\n"
    "      if (typeof window.openPostToCommunity === 'function') window.openPostToCommunity(post);\n"
    "    }\n"
    "  });"
)

EDITS = [
    ("1 . tray seats on the measured band height", T1_OLD, T1_NEW),
    ("2 . Series pill returns below 767px",        T2_OLD, T2_NEW),
    ("3a. Post to Community drawn in the lightbox", T3A_OLD, T3A_NEW),
    ("3b. Post to Community acted on",              T3B_OLD, T3B_NEW),
]

# What must be true afterwards, and what must be gone.
MUST_APPEAR = [
    "var h = band.offsetHeight;",
    ".mh-nav > a{ display:none !important }",
    "data-lb=\\\"post\\\"",
    "else if (what === 'post'){",
]
MUST_VANISH = [
    "band.classList.contains('is-tucked') ? 26 : band.offsetHeight",
]


def crlf(s):
    """Anchors are written LF. These files are CRLF throughout."""
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

        # ---- pre-write assertions -----------------------------------
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

        # ---- the edits ----------------------------------------------
        for label, old, new in EDITS:
            text = text.replace(crlf(old), crlf(new), 1)
            print("  ok   %s" % label)

        # ---- post-write assertions ----------------------------------
        halt = False
        for s in MUST_APPEAR:
            if crlf(s.replace('\\"', '"')) not in text:
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

    # Reads public/ in the repo, writes to Downloads. Install-File.ps1 puts
    # each file back and archives what it displaced.
    #
    # The repo root is this script's parent's parent -- the same derivation
    # Install-File.ps1 uses -- so this runs the same from any working
    # directory. It follows that this script must be installed to
    # scripts\ before it is run. Run from Downloads it will refuse, which
    # is the intended failure: Downloads has no public/ under it.
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
