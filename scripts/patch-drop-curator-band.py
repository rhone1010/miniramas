#!/usr/bin/env python3
"""
TWO THINGS OPENING AT ONCE, AND A BAND THAT PAYS NOTHING BACK

**1 · The collection could not get back to the grid.**

Tapping a piece opened two overlays. The lightbox this build already had —
with its arrows, Download, Send to Print Shop and Craft this again — and a
second full-view layer I added on top of the collection, driven by
`is-viewing`.

Closing the lightbox revealed mine underneath, which looked exactly like a
close that had done nothing. Then closing that revealed the grid. Two X's
for one photograph, and only the first was ever visible.

The lightbox is the better of the two: it navigates between pieces and it
carries the actions. Mine goes entirely — the class, the rules, the close
control and the handler that set it. The collection is a grid, and a tap
opens the lightbox, which is what it did before I got involved.

**2 · The Curator comes out of the band.**

Ruled 2026-08-08: she is taking the height and not yet paying it back. The
line goes; the tabs stay and the band is a navigation bar.

Nothing is deleted. She keeps her card on the photograph step, which is the
one place she is saying something useful about something the person is
looking at. The band's line, the fold, the tuck and the six-second timer all
go with her — a tuck exists to give back space that a line was taking, and
there is no line.

Usage:  python scripts\\patch-drop-curator-band.py public\\portraits.html
"""
import io
import re
import sys

CSS = """
/* ======================================================================
   PHONE · THE BAND IS NAVIGATION, AND ONE THING OPENS AT A TIME
   ======================================================================
   Last in the file. Both of these turn earlier rules off, and turning a
   rule off from above it is how the last two evenings were spent.
   ================================================================== */
@media (max-width:767px){

  /* 1 · The collection is a grid. The lightbox does full size — it has
        the arrows and the actions, and it already existed. A second
        full-view layer meant two closes for one photograph. */
  .mycoll .mc-feat{ display:none !important }
  .mycoll .mc-col{ display:flex !important; width:100% }
  .mycoll .mc-minimap{
    display:grid !important;
    grid-template-columns:repeat(3, minmax(0,1fr)) !important;
    gap:8px;
  }
  .mycoll .mc-acts{ display:none !important }
  .mycoll .mc-head,
  .mycoll .mc-say,
  .mycoll .mc-filters{ display:flex !important }
  .mycoll .mc-say{ display:block !important }
  .mc-mode{ display:none !important }

  /* 2 · She is not in the band. Her card keeps her, on the step where
        she is talking about something the person is looking at. */
  .band-cur{ display:none !important }
  .band{ transform:none !important }
  .band-tabs{ padding-top:2px }
}
"""


def crlf(t):
    return t.replace("\n", "\r\n")


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    if "THE BAND IS NAVIGATION" in doc:
        raise SystemExit("Already applied. Nothing written.")

    nl = "\r\n" if "\r\n" in doc[:2000] else "\n"

    # ── the handler that opened the second layer ──────────────────────
    old_handler = """    /* Tapping a piece is the other way in. It already features the piece;
       this only says which mode that means on a phone. */
    var grid = document.getElementById('mcGrid');
    if (grid) grid.addEventListener('click', function(e){
      if (!e.target.closest('[data-piece]')) return;
      if (window.matchMedia && window.matchMedia('(max-width:767px)').matches){
        mycoll.classList.add('is-viewing');
      }
    });"""
    new_handler = """    /* Removed 2026-08-08. Tapping a piece already opens the lightbox,
       which navigates between pieces and carries the actions. This added
       a second full-view layer underneath it, so closing the lightbox
       revealed another full view and read as a close that did nothing. */"""

    found = False
    for o, n_ in ((old_handler, new_handler), (crlf(old_handler), crlf(new_handler))):
        if doc.count(o) == 1:
            doc = doc.replace(o, n_, 1)
            found = True
            break
    if not found:
        raise SystemExit("FAIL: the phone view handler was not found. Nothing written.")

    # ── the CSS, last ─────────────────────────────────────────────────
    last = doc.rfind("</style>")
    if last < 0:
        raise SystemExit("FAIL: no stylesheet found. Nothing written.")
    doc = doc[:last] + (CSS if nl == "\n" else crlf(CSS)) + doc[last:]

    # gates
    if "mycoll.classList.add('is-viewing')" in doc:
        raise SystemExit("FAIL: something still opens the second layer")
    if ".band-cur{ display:none !important }" not in doc:
        raise SystemExit("FAIL: the band still carries her line")
    if "function openLightbox" not in doc:
        raise SystemExit("FAIL: the lightbox was disturbed")
    # her card must be untouched
    if 'class="cur-say"' not in doc and "cur-say" not in doc:
        raise SystemExit("FAIL: the Curator's card was disturbed")
    # the tabs must survive
    if doc.count('data-band="') != 4:
        raise SystemExit("FAIL: the tabs were disturbed")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  one full view: the lightbox, which already had the actions")
    print("  the collection stays a grid behind it")
    print("  the Curator is out of the band; her card keeps her")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-drop-curator-band.py <file.html>")
    main(sys.argv[1])
