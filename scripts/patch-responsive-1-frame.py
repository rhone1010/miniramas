#!/usr/bin/env python3
"""
RESPONSIVE · STAGE ONE · THE FRAME

The workshop was built for 1920 and already bends to a tablet: at 1100px the
three spines collapse to one column and To Be Crafted is hidden. Nobody has
taken it below that, so on a phone the stage keeps a desktop gutter, the
footer holds five bays across 390px, and the masthead hides the one control
that lets a signed-out visitor in.

This stage changes the FRAME ONLY — the outer geometry, the masthead, the
footer. No surface is re-laid-out, nothing inside the workshop moves, and
no behaviour changes. It is the smallest change that makes the studio
usable on a phone, and it can ship on its own.

WHAT IT DOES

  · the gutter closes to 12px under 640, so the stage is the screen
  · the masthead loses its fixed height and the mark shrinks
  · the credits pill STAYS. It was hidden at 767 back when it was only a
    balance. It now carries the name and, signed out, reads 'Sign in' —
    hiding it on a phone removes the only way into an account.
  · the footer's five bays scroll sideways instead of crushing to 78px each
  · the workshop keeps a floor tall enough to hold a card

WHAT IT DOES NOT DO

  · the Curator, Collection, Print Shop and Account keep their desktop
    layouts. They are readable but not yet designed for the width.
  · the bottom band, the tray and the step dots are stages two and four.

Usage:  python scripts\\patch-responsive-1-frame.py public\\portraits.html
"""
import io
import sys

# ── 1 · the credits pill must survive on a phone ──────────────────────
OLD_HIDE = "@media (max-width:767px){ .mh-credits{ display:none } }"
NEW_HIDE = """/* The pill used to be a balance and nothing else, so hiding it on a phone
   cost only information. It now carries the name and, with no session,
   reads 'Sign in' and opens the panel — it is the only way into an
   account on this width and it stays. The word 'credits' goes instead;
   the number was always the point. */
@media (max-width:767px){
  .mh-credits .u{ display:none }
  .mh-credits .who{ max-width:7ch }
}"""

# ── 2 · the frame, under the existing tablet collapse ─────────────────
OLD_1100 = """@media (max-width:1100px){
  .rooms{
    grid-template-columns:minmax(0,1fr);
    grid-template-areas:"curator" "workshop" "footer";
    grid-template-rows:auto minmax(320px,1fr) auto;
    height:auto;
  }
  .room--queue{ display:none }
}"""

NEW_1100 = """@media (max-width:1100px){
  .rooms{
    grid-template-columns:minmax(0,1fr);
    grid-template-areas:"curator" "workshop" "footer";
    grid-template-rows:auto minmax(320px,1fr) auto;
    height:auto;
  }
  .room--queue{ display:none }
}

/* ======================================================================
   THE PHONE · stage one · the frame only
   ======================================================================
   Everything above this line was written for a canvas. These rules stop
   the canvas fighting a 390px screen: the gutter closes, the masthead
   gives up its fixed height, and the footer scrolls rather than crushes.

   Nothing inside a surface is touched here. Read as: the building fits
   on the street now; the rooms are still furnished for a bigger house.
   ================================================================== */
@media (max-width:767px){
  :root{
    /* The stage IS the screen. A 5% gutter is 19px of nothing on each
       side of a phone, and the content needs every pixel. */
    --stage-gutter:12px;
    --stage-w:calc(100% - 24px);
    --room-gap:12px;
    --mh-h:auto;
    --footer-h:auto;
    --footer-pad:12px;
  }

  /* The masthead stops being a fixed bar. At 90px it was a tenth of the
     screen holding three things. */
  .mh{
    height:auto; min-height:56px;
    padding-block:6px;
    column-gap:8px;
  }
  .mh-mark{ font-size:.9em }

  /* The floor needs room to hold a card, and the page scrolls rather
     than the rooms scrolling inside a locked viewport. */
  .rooms{
    grid-template-rows:auto minmax(420px,auto) auto;
    height:auto; min-height:0;
  }
  .room{ min-height:0 }

  /* Five bays across 390px is 78px each, which fits neither an icon nor
     a line of type. They keep their width and the row scrolls. */
  .room--footer{
    grid-template-columns:none;
    grid-auto-flow:column;
    grid-auto-columns:minmax(210px, 1fr);
    overflow-x:auto;
    scroll-snap-type:x proximity;
    -webkit-overflow-scrolling:touch;
    height:auto;
  }
  .room--footer::-webkit-scrollbar{ display:none }
  .room--footer{ scrollbar-width:none }
  .bay{ scroll-snap-align:center; padding-block:14px }

  /* The full-screen surfaces were positioned against a computed left
     edge — gutter plus spine plus a room gap. On a phone there is no
     spine, so they start at the edge. */
  .mycoll, .pshop, .acct{
    left:0; right:0; border-radius:0;
  }
}

/* Small phones. The 390 rules hold; these only stop type from wrapping
   into single words. */
@media (max-width:400px){
  :root{ --stage-gutter:8px; --stage-w:calc(100% - 16px) }
  .mh-mark{ font-size:.82em }
}"""


def crlf(t):
    return t.replace("\n", "\r\n")


def swap(doc, name, old, new):
    for o, n_ in ((old, new), (crlf(old), crlf(new))):
        c = doc.count(o)
        if c == 1:
            return doc.replace(o, n_, 1)
        if c > 1:
            raise SystemExit("FAIL: %s matched %d times, expected 1" % (name, c))
    raise SystemExit("FAIL: %s not found. Nothing was written." % name)


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    doc = swap(doc, "the 767 hide", OLD_HIDE, NEW_HIDE)
    doc = swap(doc, "the 1100 collapse", OLD_1100, NEW_1100)

    # gates
    if "THE PHONE \u00b7 stage one" not in doc:
        raise SystemExit("FAIL: the phone block was not written")
    if ".mh-credits{ display:none }" in doc:
        raise SystemExit("FAIL: the pill is still hidden on a phone")
    if doc.count("@media (max-width:1100px)") != 1:
        raise SystemExit("FAIL: the tablet collapse was duplicated or lost")
    # the desktop must be untouched
    for must in ["--spine-w:clamp(300px, 20%, 460px)",
                 "--queue-w:clamp(220px, 14.5%, 330px)",
                 'grid-template-areas:\n    "curator workshop queue"']:
        if must.replace("\n", "\r\n") not in doc and must not in doc:
            raise SystemExit("FAIL: a desktop token or area changed: " + must[:34])

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  stage is the screen under 767")
    print("  masthead unpins, credits pill survives (it is the way in)")
    print("  footer scrolls sideways instead of crushing")
    print("  desktop layout untouched")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-responsive-1-frame.py <file.html>")
    main(sys.argv[1])
