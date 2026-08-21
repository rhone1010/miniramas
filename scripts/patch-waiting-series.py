#!/usr/bin/env python3
"""
patch-waiting-series.py - a Groups craft waits in the Groups room.

  python scripts\\patch-waiting-series.py public\\groups.html
  python scripts\\patch-waiting-series.py public\\groups.html --apply

Dry run by default. CRLF file.

THE FAULT. openWaiting() on the Groups page writes series:'Portraits' on
every waiting tile. So a Groups craft in progress files itself under
Portraits: filter My Collection to Groups and the three spinners vanish,
then the piece appears out of nowhere when it lands.

Two lines apart in the same file, land() already writes series:'Groups'. So
the waiting tile and the piece it becomes disagreed about which room they
were in.

THIS IS THE SAME BUG THE HARNESS CAUGHT IN savePiece and the forty-eight
anchored edits missed here. Both came from cloning portraits.html, and both
are a Series name left behind in a file that is no longer that Series.

CHECK THIS ON EVERY FUTURE SERIES CLONE. The pattern to search for is a
quoted Series name anywhere outside SERIES_LABEL and MC_SERIES - those two
are lookup tables and are meant to carry all of them.
"""

import sys
import os

ANCHOR = (
    "      window.__pieceLanded({\r\n"
    "        id:       'q' + it.id,\r\n"
    "        name:     effectLabel(it.effectId),\r\n"
    "        series:   'Portraits',\r\n"
)

NEW = (
    "      window.__pieceLanded({\r\n"
    "        id:       'q' + it.id,\r\n"
    "        name:     effectLabel(it.effectId),\r\n"
    "        /* THE ROOM IT IS ACTUALLY BEING CRAFTED IN. This said 'Portraits'\r\n"
    "           - left behind by the clone - so a Groups craft waited in the\r\n"
    "           Portraits filter and disappeared from its own. land() a few\r\n"
    "           hundred lines below has always written 'Groups'; the waiting\r\n"
    "           tile and the piece it becomes now agree. */\r\n"
    "        series:   'Groups',\r\n"
)

MARKER = "THE ROOM IT IS ACTUALLY BEING CRAFTED IN"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    apply_it = "--apply" in sys.argv

    if not args:
        print(__doc__)
        return 1

    path = args[0]
    if not os.path.isfile(path):
        print("MISSING   " + path)
        return 1

    with open(path, "r", encoding="utf-8", newline="") as f:
        original = f.read()

    print("patch-waiting-series")
    print("  target   " + path)
    print("  mode     " + ("APPLY" if apply_it else "dry run - nothing will be written"))

    if MARKER in original:
        print("  SKIP     already fixed")
        return 0

    n = original.count(ANCHOR)
    if n != 1:
        print("  FAIL     anchor matches " + str(n) + " times. Nothing written.")
        return 1

    text = original.replace(ANCHOR, NEW, 1)

    # pre-write assertions
    assert text.count("function openWaiting(items)") == 1, "openWaiting disturbed"
    # the waiting tile and the landed piece must now agree
    assert text.count("series:   'Groups',") == 2, \
        "expected two 'Groups' writers, found %d" % text.count("series:   'Groups',")
    # the lookup tables are meant to carry every Series and must be untouched
    assert text.count("var MC_SERIES = ['Action','Groups','Mobile Wallpapers','Pets','Portraits'];") == 1, \
        "the filter list was changed"
    assert "SERIES_LABEL[p.series] || 'Portraits'" in text, \
        "the SERIES_LABEL fallback was changed"
    assert "\r\n" in text, "line endings lost"
    assert len(text) > len(original), "file did not grow"

    print("  OK       the waiting tile files under Groups")

    if not apply_it:
        print("  Would write " + str(len(text) - len(original)) + " more bytes. Re-run with --apply.")
        return 0

    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("  WROTE    " + path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
