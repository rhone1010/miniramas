#!/usr/bin/env python3
"""
patch-post-serverid.py  -  22 August 2026  -  CUI V32

WHAT WAS WRONG
  Post to Community sent PIECE.id, which is a CLIENT id and has never been
  a database id. Two shapes exist and neither is a bare uuid:

    q<n>       a piece still being crafted, keyed on the queue item
    srv_<uuid> a piece read back from the server

  The route looks the value up in collection_pieces, finds nothing, and
  answers no_piece. The customer reads "I cannot find that piece any more"
  over a piece that is sitting on the screen in front of them.

  Observed live, 22 August: {piece_id: "q3", consent: true} -> 404.

WHAT THIS DOES, TWICE PER FILE
  1 - sends PIECE.serverId, which savePiece() writes back onto the row the
      moment a craft lands, so a piece just made is postable without a
      reload.

  2 - refuses to open the dialog for a piece that has no serverId. A tile
      still crafting has no row in collection_pieces yet, so posting it
      cannot succeed. Better to not offer it than to offer it and fail.
      The same test guards printing at line ~9927 and archiving at ~9432 -
      p.art && p.serverId - so this is the established shape, not a new
      one.

SIX FILES, INCLUDING THE CHOOSER
  pets-chooser.html has no collection on it, so the dialog cannot open
  there. It is patched anyway: the six copies of this block have drifted
  apart once already and leaving one behind is how the next clone
  reintroduces the bug.

READS   D:\\minramas\\public\\<page>.html
WRITES  %USERPROFILE%\\Downloads\\<page>.html

  Dry run by default. Nothing is written without --apply.
  Refuses to write unless every anchor is found exactly once.
  Refuses to write unless the result verifies.
"""

import os
import sys

REPO = r"D:\minramas\public"
OUT = os.path.join(os.environ.get("USERPROFILE", os.path.expanduser("~")),
                   "Downloads")

PAGES = [
    "portraits.html",
    "pets.html",
    "halloween.html",
    "pets-halloween.html",
    "pets-chooser.html",
    "groups.html",
]

# ---- edit 1: the body ---------------------------------------------------

BODY_ANCHOR = (
    "      body: JSON.stringify({ piece_id: PIECE.id, consent: true })"
)
BODY_REPLACE = (
    "      /* serverId, NOT id. PIECE.id is a client id - 'q3' while the\r\n"
    "         piece is crafting, 'srv_<uuid>' once it has been read back.\r\n"
    "         Neither exists in collection_pieces, so the route answered\r\n"
    "         no_piece over a piece that was plainly there. */\r\n"
    "      body: JSON.stringify({ piece_id: PIECE.serverId, consent: true })"
)

# ---- edit 2: the guard --------------------------------------------------

GUARD_ANCHOR = (
    "  window.openPostToCommunity = function(piece){\r\n"
    "    if (!piece) return;"
)
GUARD_REPLACE = (
    "  window.openPostToCommunity = function(piece){\r\n"
    "    if (!piece) return;\r\n"
    "    /* No serverId means no row in collection_pieces yet - a tile that\r\n"
    "       is still crafting. There is nothing to post, and opening the\r\n"
    "       dialog only to refuse at the end is the worse of the two. The\r\n"
    "       same test guards printing and archiving. */\r\n"
    "    if (!piece.serverId) return;"
)

# Held in pieces so this file does not satisfy its own grep.
GONE = "piece_id: PIECE" + ".id"


def process(page, apply_it):
    src = os.path.join(REPO, page)
    dst = os.path.join(OUT, page)

    if not os.path.isfile(src):
        print("  MISSING  %s" % src)
        return False

    with open(src, "r", encoding="utf-8", newline="") as fh:
        text = fh.read()

    for name, anchor in (("body", BODY_ANCHOR), ("guard", GUARD_ANCHOR)):
        n = text.count(anchor)
        if n != 1:
            print("  REFUSE   %s : %s anchor found %d times, expected 1"
                  % (page, name, n))
            return False

    out = text.replace(BODY_ANCHOR, BODY_REPLACE, 1)
    out = out.replace(GUARD_ANCHOR, GUARD_REPLACE, 1)

    # ---- verification, before disk is touched --------------------------
    if GONE in out:
        print("  REFUSE   %s : the client id is still being sent" % page)
        return False
    if out.count("piece_id: PIECE.serverId") != 1:
        print("  REFUSE   %s : expected exactly one serverId body" % page)
        return False
    if out.count("    if (!piece.serverId) return;") != 1:
        print("  REFUSE   %s : the guard is missing or doubled" % page)
        return False
    if len(out) <= len(text):
        print("  REFUSE   %s : result did not grow" % page)
        return False

    if not apply_it:
        print("  OK       %s : 2 edits, would write %s" % (page, dst))
        return True

    if not os.path.isdir(OUT):
        print("  REFUSE   %s : %s does not exist" % (page, OUT))
        return False

    with open(dst, "w", encoding="utf-8", newline="") as fh:
        fh.write(out)
    print("  WROTE    %s" % dst)
    return True


def main():
    apply_it = "--apply" in sys.argv
    print("patch-post-serverid  -  %s" % ("APPLY" if apply_it else "DRY RUN"))
    print("")

    ok = 0
    for page in PAGES:
        if process(page, apply_it):
            ok += 1

    print("")
    print("  %d of %d pages" % (ok, len(PAGES)))
    if ok != len(PAGES):
        print("  NOT ALL PAGES PASSED. Nothing further should be installed.")
        sys.exit(1)
    if not apply_it:
        print("  Re-run with --apply to write.")


if __name__ == "__main__":
    main()
