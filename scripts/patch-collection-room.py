#!/usr/bin/env python3
"""
THE COLLECTION GETS ITS SCREEN BACK

Before a single piece: a title, a count, a status, a two-line sentence, and
seven Series pills wrapped across two rows with Archived on a third. Roughly
half the screen spent on furniture, in a room whose entire purpose is
looking at photographs.

WHAT GOES

  · "Yours to keep. Download any of them, or send one to the Print Shop."
    The largest single block, and it describes what the pieces obviously
    are. On a phone the pieces say it themselves.

  · The pills stop wrapping. Seven Series and an Archived count on one
    scrolling row, the way the effects row already works, so the number of
    Series stops deciding how much of the screen they take.

  · The head compresses. Title and count on one line, the crafting status
    beside them rather than under.

WHAT STAYS

The status line when something is being crafted — "1 ON THE WAY" — because
that is the only thing up there a person cannot see for themselves.

The Curator's line in this room goes too. She is out of the band by the same
reasoning and this is the same sentence: space spent on something the
photographs are already saying.

Usage:  python scripts\\patch-collection-room.py public\\portraits.html
"""
import io
import sys

CSS = """
/* ======================================================================
   PHONE · THE COLLECTION IS FOR LOOKING AT PIECES
   ======================================================================
   Half the screen was furniture. What is left is the title, the count, and
   a row of Series that scrolls instead of wrapping.
   ================================================================== */
@media (max-width:767px){

  /* The sentence describing what the pieces are, above the pieces. */
  .mycoll .mc-say{ display:none !important }

  /* One line: what this is, and how much of it there is. */
  .mycoll .mc-head{
    flex-wrap:nowrap !important;
    align-items:baseline;
    gap:.5em;
    padding:8px 0 6px !important;
    min-height:0;
  }
  .mycoll .mc-title{ font-size:1.35rem; flex:0 0 auto }
  .mycoll .mc-n{
    font-size:.66rem; letter-spacing:.14em;
    flex:1 1 auto; min-width:0;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  }
  /* The close control is in the band's Workshop tab. A second way out of
     this room, at the top, is a second thing to explain. */
  .mycoll .mc-close{ display:none !important }

  /* Seven Series and an archive count wrapped to three rows. One row that
     scrolls, so the number of Series stops deciding how much screen they
     take. */
  .mycoll .mc-filters{
    display:flex !important;
    flex-wrap:nowrap !important;
    overflow-x:auto;
    gap:6px;
    padding:0 0 8px !important;
    margin:0;
    scrollbar-width:none;
    -webkit-overflow-scrolling:touch;
    scroll-snap-type:x proximity;
  }
  .mycoll .mc-filters::-webkit-scrollbar{ display:none }
  .mycoll .mc-filter{
    flex:0 0 auto;
    min-height:34px; height:34px; padding:0 .85em;
    font-size:1rem;
    scroll-snap-align:start;
  }
  /* Archived was pushed to a row of its own by an auto margin. */
  .mycoll .mc-filter.is-archive,
  .mycoll .mc-filters > :last-child{ margin-left:0 !important }

  /* And the pieces take what is left. */
  .mycoll .mc-grid{ padding-top:2px }
  .mycoll .mc-minimap{ gap:6px }
}
"""


def crlf(t):
    return t.replace("\n", "\r\n")


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    if "THE COLLECTION IS FOR LOOKING AT PIECES" in doc:
        raise SystemExit("Already applied. Nothing written.")

    nl = "\r\n" if "\r\n" in doc[:2000] else "\n"
    last = doc.rfind("</style>")
    if last < 0:
        raise SystemExit("FAIL: no stylesheet found. Nothing written.")
    doc = doc[:last] + (CSS if nl == "\n" else crlf(CSS)) + doc[last:]

    # gates
    if ".mycoll .mc-say{ display:none !important }" not in doc:
        raise SystemExit("FAIL: the sentence was not removed")
    if "flex-wrap:nowrap !important" not in doc:
        raise SystemExit("FAIL: the filters still wrap")
    # the count must survive: it carries the crafting status
    if ".mycoll .mc-n{" not in doc:
        raise SystemExit("FAIL: the count was removed rather than compressed")
    # and the room must still be reachable
    if doc.count('data-band="') != 4:
        raise SystemExit("FAIL: the tabs were disturbed")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  the describing sentence goes")
    print("  the Series pills scroll on one row")
    print("  title, count and status share a line")
    print("  about 160px back — most of another row of pieces")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-collection-room.py <file.html>")
    main(sys.argv[1])
