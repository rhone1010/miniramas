#!/usr/bin/env python3
"""
patch-hide-footer.py - hide the five lorem bays, keep the markup.

  python scripts\\patch-hide-footer.py public\\portraits.html
  python scripts\\patch-hide-footer.py public\\portraits.html --apply

Dry run by default.

The footer is real markup with real styling and no copy behind it. It is
hidden rather than cut, because writing five bays of copy is a smaller job
than rebuilding the footer, and the day the copy exists this is one rule to
delete.

One CSS block, appended last in the stylesheet so it beats every earlier
.room--footer rule on source order - there are ten of them, including two
inside media queries.

row-gap goes to zero with it. The stage grid is two rows and the second is
now empty; without this there is a 24-ish pixel band of nothing under the
workshop where the footer used to sit. column-gap is restored explicitly so
the three rooms keep their spacing.
"""

import sys
import os

ANCHOR = (
    '/* ======================================================================\r\n'
    '   MEASUREMENT - this block is NOT part of the contract.\r\n'
)

# the file uses an em dash in that heading; match on the stable part instead
ANCHOR = '/* the spine label needs the room the rail has, at any width */\r\n' \
         '@media (max-height:820px){\r\n' \
         '  :root{ --footer-h:70px }\r\n' \
         '  .cur-slot{ aspect-ratio:4/3 }\r\n' \
         '}\r\n'

NEW = ANCHOR + (
    '\r\n'
    '/* ---- FOOTER HIDDEN - NOT REMOVED ------------------------------------\r\n'
    '   Five bays of placeholder heading and lorem. The markup, the stone,\r\n'
    '   the hairline dividers and the icons all stay; there is simply no copy\r\n'
    '   for them yet and placeholder latin on a shop page is worse than a\r\n'
    '   shorter page.\r\n'
    '\r\n'
    '   Last rule in the sheet on purpose. Ten .room--footer rules precede it,\r\n'
    '   two of them inside media queries, and source order is what decides.\r\n'
    '\r\n'
    '   TO BRING IT BACK: delete this block. Nothing else was touched.\r\n'
    '   -------------------------------------------------------------------- */\r\n'
    '.room--footer{ display:none !important }\r\n'
    '.rooms{ row-gap:0; column-gap:var(--room-gap) }\r\n'
)

MARKER = 'FOOTER HIDDEN - NOT REMOVED'


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

    print("patch-hide-footer")
    print("  target   " + path)
    print("  mode     " + ("APPLY" if apply_it else "dry run - nothing will be written"))

    if MARKER in original:
        print("  SKIP     already hidden")
        return 0

    n = original.count(ANCHOR)
    if n != 1:
        print("  FAIL     anchor matches " + str(n) + " times. Nothing written.")
        return 1

    text = original.replace(ANCHOR, NEW)

    # pre-write assertions
    assert MARKER in text, "block not inserted"
    assert text.count('.room--footer{ display:none !important }') == 1, "rule duplicated"
    assert text.index(MARKER) < text.index('</style>'), "block landed outside the stylesheet"
    assert text.count('<footer class="room room--footer">') == 1, "footer markup was touched"
    assert text.count('Here be some text!') == original.count('Here be some text!'), \
        "bay copy was touched"
    assert len(text) > len(original), "file did not grow"

    print("  OK       hide rule appended, last in sheet")

    if not apply_it:
        print("  Would write " + str(len(text) - len(original)) + " more bytes. Re-run with --apply.")
        return 0

    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("  WROTE    " + path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
