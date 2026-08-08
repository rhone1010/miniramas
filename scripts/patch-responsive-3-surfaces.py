#!/usr/bin/env python3
"""
RESPONSIVE · STAGE THREE · THE SURFACES

Stage one gave the frame a phone's proportions and stage two put the band at
the bottom. My Collection, the Print Shop and Your Account still hold their
desktop layouts inside it: a 460px featured column beside a minimap, a wall
of print options in two columns, an account laid out for a wide screen.

They are reachable and readable. They were never laid out for 390px.

WHAT THIS STAGE DOES, UNDER 767 ONLY

  · all three surfaces start at the screen edge and stop above the band,
    rather than being pinned under it
  · My Collection stacks: the featured piece full width, the rest below it
    as a three-across grid
  · the Series filters scroll sideways rather than wrapping to four rows
  · the print wall is one column, and the configure panel sits under the
    piece instead of beside it
  · the account rows stack label over value
  · every action reaches 44px, which is the smallest a thumb reliably hits

WHAT IT DOES NOT DO

  · no markup changes. This is layout only, so nothing behavioural can
    break and it can ship on its own.
  · the tray from the mockup, the step dots and press-and-hold are stage
    four.

Everything is inside the 767 query. Desktop is untouched.

Usage:  python scripts\\patch-responsive-3-surfaces.py public\\portraits.html
"""
import io
import sys

ANCHOR = """/* Small phones. The 390 rules hold; these only stop type from wrapping
   into single words. */"""

CSS = """/* ======================================================================
   THE SURFACES · stage three · phones only
   ======================================================================
   The three full-screen surfaces were positioned against a computed left
   edge — gutter plus spine plus room gap — because on a desktop they slide
   over the workshop and leave the Curator standing. On a phone there is
   nothing to leave standing and nothing to slide over: they are the
   screen, and they have to stop above the band rather than run under it.
   ================================================================== */
@media (max-width:767px){

  /* ---- all three ---------------------------------------------------- */
  .mycoll, .pshop, .acct{
    left:0; right:0;
    top:0;                      /* the masthead is no longer a fixed bar */
    bottom:118px;               /* the band's height, reserved */
    padding:14px 12px 0;
    border-left:0; border-radius:0;
  }

  /* Their heads were a single row: title, count, and a close button that
     had to share the width with both. Stacked, the close button gets a
     full-width target and the title stops truncating. */
  .mc-head{
    flex-wrap:wrap; gap:.4em .6em;
    padding-bottom:.6em;
  }
  .mc-close{
    order:-1; width:100%; height:44px; margin-right:0;
    justify-content:center;
  }
  .mc-title{ font-size:1.5rem }
  .mc-n{ font-size:.72rem }
  .mc-say{ font-size:1.05rem; padding:.6em .1em .1em }

  /* Eight Series across 390px wrapped to four rows of stubs and pushed the
     work off the screen. They keep their size and the row scrolls. */
  .mc-filters{
    flex-wrap:nowrap; overflow-x:auto;
    padding:.7em 0 .8em;
    scrollbar-width:none; -webkit-overflow-scrolling:touch;
    scroll-snap-type:x proximity;
  }
  .mc-filters::-webkit-scrollbar{ display:none }
  .mc-filter{
    flex:0 0 auto; min-height:38px; scroll-snap-align:start;
  }

  /* ---- My Collection ------------------------------------------------- */
  /* Featured above, the rest below. Side by side at this width gave the
     featured piece about 150px, which is smaller than the thumbnails. */
  .mc-latest{
    grid-template-columns:minmax(0,1fr);
    gap:14px;
  }
  .mc-feat{ max-width:none; width:100% }
  .mc-minimap{
    grid-template-columns:repeat(3, minmax(0,1fr));
    gap:8px;
  }
  /* Full width and stacked: two actions side by side at this width are
     two half-width targets, and both matter. */
  .mc-acts{ flex-direction:column; gap:.5em }
  .mc-acts .mc-act{ width:100%; min-height:44px; justify-content:center }

  /* ---- the Print Shop ------------------------------------------------ */
  .ps-wall{ grid-template-columns:minmax(0,1fr) }
  .ps-fly{
    width:auto; max-width:none; max-height:none;
    margin:0 0 1.2rem;
  }
  .pshop .ps-wall{ padding-bottom:1.2rem }

  /* ---- Your Account -------------------------------------------------- */
  /* Label over value. Side by side, a shipping address had about 140px and
     ellipsed to nothing useful. */
  .ac-row, .acct .row{
    flex-direction:column; align-items:flex-start; gap:.25em;
  }
  .ac-row .v, .acct .row .v{
    text-align:left; white-space:normal; max-width:100%;
  }

  /* ---- anything a thumb has to hit ----------------------------------- */
  .mc-act, .ps-act, .ac-act, .btn{ min-height:44px }
}

/* Small phones. The 390 rules hold; these only stop type from wrapping
   into single words. */"""


def crlf(t):
    return t.replace("\n", "\r\n")


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    if "THE SURFACES \u00b7 stage three" in doc:
        raise SystemExit("Already applied. Nothing written.")

    for old, new in ((ANCHOR, CSS), (crlf(ANCHOR), crlf(CSS))):
        n = doc.count(old)
        if n == 1:
            doc = doc.replace(old, new, 1)
            break
        if n > 1:
            raise SystemExit("FAIL: anchor matched %d times, expected 1" % n)
    else:
        raise SystemExit("FAIL: the stage-one anchor was not found. Nothing written.")

    # gates
    if doc.count("THE SURFACES \u00b7 stage three") != 1:
        raise SystemExit("FAIL: the block was not written exactly once")
    if "bottom:118px" not in doc:
        raise SystemExit("FAIL: the surfaces do not clear the band")
    # desktop must be untouched
    for must in [".mc-latest{ grid-template-columns:minmax(230px, 30%) minmax(0,1fr) }",
                 "grid-template-columns:460px minmax(0,1fr)"]:
        if must not in doc:
            raise SystemExit("FAIL: a desktop collection rule changed: " + must[:40])
    if doc.count("@media (max-width:1100px)") != 1:
        raise SystemExit("FAIL: the tablet collapse was disturbed")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  the three surfaces fill the screen and clear the band")
    print("  Collection stacks; filters scroll; print wall is one column")
    print("  account rows stack label over value")
    print("  every action reaches 44px")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-responsive-3-surfaces.py <file.html>")
    main(sys.argv[1])
