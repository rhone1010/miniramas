#!/usr/bin/env python3
"""
patch-rooms-masthead.py  -  22 August 2026  -  CUI V32

WHAT THIS DOES
  The masthead label on the two non-Series pages reads "Crafted Portraits".
  Community is not Portraits and neither is Gallery, so the label names a
  Series the customer is not standing in. Ruled 21 August: a Series page
  keeps its name, community and gallery read Rooms.

  The collapse behaviour is kept. Wide, the label reads "Crafted Rooms";
  below 1320px the "Crafted " span is hidden and it reads "Rooms", exactly
  as "Crafted Portraits" collapses to "Portraits" today.

TWO PAGES, THREE EDITS, BECAUSE THE MARKUP DIFFERS
  Community already carries #mhSeriesLabel, the .mh-crafted span and the
  1320px rule that hides it. One edit: the word.

  Gallery carries none of them - a bare <span> and no breakpoint above
  900px. Two edits: the span structure, and the media query that makes the
  collapse happen. Without the second, Gallery would read "Crafted Rooms"
  at every width while Community collapsed, and the two mastheads would
  disagree on the same site.

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

# ---- community: one edit -------------------------------------------------

COMM_ANCHOR = (
    '        <span id="mhSeriesLabel">'
    '<span class="mh-crafted">Crafted </span>Portraits</span>'
)
COMM_REPLACE = (
    '        <span id="mhSeriesLabel">'
    '<span class="mh-crafted">Crafted </span>Rooms</span>'
)

# ---- gallery: two edits --------------------------------------------------

GALL_LABEL_ANCHOR = "        <span>Crafted Portraits</span>"
GALL_LABEL_REPLACE = (
    '        <span id="mhSeriesLabel">'
    '<span class="mh-crafted">Crafted </span>Rooms</span>'
)

GALL_CSS_ANCHOR = ".mh-series-btn:hover{ color:#e6d2a8 }"
GALL_CSS_REPLACE = (
    ".mh-series-btn:hover{ color:#e6d2a8 }\r\n"
    "/* The label collapses the way Community's does, at the same width and\r\n"
    "   by the same mechanism. Gallery had no breakpoint above 900px, so the\r\n"
    "   query is new here rather than a rule added to an existing one. */\r\n"
    "@media (max-width:1320px){\r\n"
    "  #mhSeriesLabel .mh-crafted{ display:none }\r\n"
    "}"
)

PLAN = {
    "community.html": [(COMM_ANCHOR, COMM_REPLACE)],
    "gallery.html": [(GALL_LABEL_ANCHOR, GALL_LABEL_REPLACE),
                     (GALL_CSS_ANCHOR, GALL_CSS_REPLACE)],
}

# Held in pieces so this file does not satisfy its own grep.
GONE = "Crafted " + "Portraits"


def process(page, edits, apply_it):
    src = os.path.join(REPO, page)
    dst = os.path.join(OUT, page)

    if not os.path.isfile(src):
        print("  MISSING  %s" % src)
        return False

    with open(src, "r", encoding="utf-8", newline="") as fh:
        text = fh.read()

    out = text
    for i, (anchor, replace) in enumerate(edits):
        n = out.count(anchor)
        if n != 1:
            print("  REFUSE   %s : anchor %d found %d times, expected 1"
                  % (page, i + 1, n))
            return False
        out = out.replace(anchor, replace, 1)

    # ---- verification, before disk is touched --------------------------
    if GONE in out:
        print("  REFUSE   %s : the old Series name survived" % page)
        return False
    if out.count('id="mhSeriesLabel"') != 1:
        print("  REFUSE   %s : expected exactly one mhSeriesLabel" % page)
        return False
    if out.count('class="mh-crafted"') != 1:
        print("  REFUSE   %s : expected exactly one mh-crafted span" % page)
        return False
    if out.count("#mhSeriesLabel .mh-crafted{ display:none }") != 1:
        print("  REFUSE   %s : the collapse rule is missing or doubled" % page)
        return False
    if ">Rooms<" not in out:
        print("  REFUSE   %s : the new label is not present" % page)
        return False
    # "Rooms" is four characters shorter than "Portraits", so a small
    # shrink is correct here. Anything beyond that is a lost block.
    if len(out) < len(text) - 8:
        print("  REFUSE   %s : result shrank by more than the word" % page)
        return False

    if not apply_it:
        print("  OK       %s : %d edit(s), would write %s"
              % (page, len(edits), dst))
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
    print("patch-rooms-masthead  -  %s"
          % ("APPLY" if apply_it else "DRY RUN"))
    print("")

    ok = 0
    for page, edits in PLAN.items():
        if process(page, edits, apply_it):
            ok += 1

    print("")
    print("  %d of %d pages" % (ok, len(PLAN)))
    if ok != len(PLAN):
        print("  NOT ALL PAGES PASSED. Nothing further should be installed.")
        sys.exit(1)
    if not apply_it:
        print("  Re-run with --apply to write.")


if __name__ == "__main__":
    main()
