#!/usr/bin/env python3
"""
ONE CARD A SCREEN

The floor went to two columns and the cards became a screen tall each. Three
causes, and they compound.

**1 · The card takes its height from the row, not its width.**

    .silo-card{ height:100%; width:auto; aspect-ratio:var(--card-ratio) }

That is right for a fixed-height room: the row sets the height and the ratio
gives the width. It is circular the moment the row is sized by content —
the row asks the card, the card asks the row — and it resolves enormous.

On a phone it works the other way round: the column sets the width and the
ratio gives the height.

**2 · The three faces are absolutely positioned.**

    .face{ position:absolute; inset:0 }

Silos, effects and poses are stacked in the same space and swapped by
opacity. Absolute children have no height, so `.deck` collapses and the
floor spills past it. On a phone they come into the flow and the hidden two
are display:none — the swap is instant rather than a cross-fade, which on a
phone reads as a page change and is the better behaviour anyway.

**3 · The Curator's photograph is a full-width square.**

366px tall before her letter begins, so the workshop starts below the fold
on every visit. It is capped, and cropped from the top where a face is.

Usage:  python scripts\\patch-phone-cards.py public\\portraits.html
"""
import io
import sys

ANCHOR = """  /* ---- anything a thumb has to hit ----------------------------------- */
  .mc-act, .ps-act, .ac-act, .btn{ min-height:44px }
}"""

CSS = """  /* ---- the card takes its size from the column ----------------------- */
  /* On a canvas the row sets the height and the ratio gives the width.
     With rows sized by content that is circular — the row asks the card,
     the card asks the row — and it resolves to a card a screen tall.
     Here the column sets the width and the ratio gives the height. */
  .silo-card, .fx-card, .pose-card, .floor > *{
    height:auto !important;
    width:100% !important;
    max-width:none !important;
    aspect-ratio:var(--card-ratio, .78);
  }
  .floor{ grid-auto-rows:auto }

  /* ---- the deck holds its own height --------------------------------- */
  /* The three faces are stacked absolutely and swapped by opacity, so the
     deck has no height of its own and the floor spills past it. In the
     flow, with the two that are not showing removed: the change reads as
     a page turn rather than a cross-fade, which is what a phone expects. */
  .deck{ min-height:0; perspective:none }
  .face{
    position:relative; inset:auto;
    display:none; opacity:1; visibility:visible;
    transition:none;
  }
  .workshop-view--silos   .face--silos,
  .workshop-view--effects .face--effects,
  .workshop-view--poses   .face--poses{ display:block }
  .room--workshop{ grid-template-rows:auto auto }

  /* ---- the Curator's photograph -------------------------------------- */
  /* A full-width square is 366px before her letter starts, which put the
     workshop below the fold on every visit. Cropped from the top, where a
     face is. */
  .cur-thumb img{
    aspect-ratio:auto;
    max-height:200px; width:100%;
    object-fit:cover; object-position:50% 22%;
  }
  .cur-slot{ aspect-ratio:auto; min-height:150px }
  .cur{ padding-bottom:12px }

  /* ---- anything a thumb has to hit ----------------------------------- */
  .mc-act, .ps-act, .ac-act, .btn{ min-height:44px }
}"""


def crlf(t):
    return t.replace("\n", "\r\n")


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    if "the card takes its size from the column" in doc:
        raise SystemExit("Already applied. Nothing written.")

    for old, new in ((ANCHOR, CSS), (crlf(ANCHOR), crlf(CSS))):
        n = doc.count(old)
        if n == 1:
            doc = doc.replace(old, new, 1)
            break
        if n > 1:
            raise SystemExit("FAIL: the anchor matched %d times, expected 1" % n)
    else:
        raise SystemExit("FAIL: the anchor was not found. Nothing was written.")

    # gates
    for must in ["height:auto !important",
                 ".workshop-view--silos   .face--silos",
                 "object-position:50% 22%"]:
        if must not in doc:
            raise SystemExit("FAIL: %s was not written" % must[:40])
    # desktop must be intact
    if "height:100%; width:auto; max-width:100%;" not in doc:
        raise SystemExit("FAIL: the desktop card sizing changed")
    if ".face{\n  position:absolute; inset:0;" not in doc and \
       ".face{\r\n  position:absolute; inset:0;" not in doc:
        raise SystemExit("FAIL: the desktop face stacking changed")
    if doc.count("@media (max-width:1100px)") != 1:
        raise SystemExit("FAIL: the tablet collapse was disturbed")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  cards size from the column, not the row")
    print("  the deck holds its height; faces swap as a page turn")
    print("  the Curator's photograph capped at 200px")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-phone-cards.py <file.html>")
    main(sys.argv[1])
