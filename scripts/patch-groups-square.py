#!/usr/bin/env python3
"""
patch-groups-square.py - square cards for square plates.

  python scripts\\patch-groups-square.py public\\groups.html
  python scripts\\patch-groups-square.py public\\groups.html --apply

Dry run by default. CRLF file.

WHY THE CARDS WERE NOT SQUARE. --card-ratio is .78, inherited from
portraits.html, which is right for portrait plates. Groups plates are
1180x1180. So roughly a fifth of every plate's width was being cropped -
and on a group photograph the thing at the edge of the frame is a person.

WHY TRIMMING THE RAILS ALONE DOES NOT FIX IT. The floor is
grid-template-rows:repeat(2, minmax(0,1fr)) inside a room of fixed height,
so row height comes from the viewport and nothing else. At 2560 the cards
were about 350 wide against a row about 437 tall. Taking a third off the
Curator buys about 38px of width. The gap is 87.

So the rows have to stop stretching. With them content-sized and the floor
centred vertically, the card becomes width-driven and square, and the
leftover height sits above and below instead of being forced into the card.

TRIMMED, AS RICH ASKED, AND IT MAKES THE SQUARES BIGGER:

                      was              now        card at 2560   at 1920
  Curator spine    300/20%/460     250/14.5%/330      350 -> 430  247 -> 303
  To Be Crafted    220/14.5%/330   180/10.5%/250
  stage gutter     100px max       64px max
  room gap         20px            16px

Two rows of squares fit at every size checked - 2560x1400, 2560x1300,
1920x1080, 1600x900, 1440x900 - with height to spare in all of them.

ALSO IN HERE, because it is the same file and the same look:

  The lorem footer is hidden. Five bays of placeholder on a page that is
  now live. Same rule as portraits.html, markup untouched.

WHAT IS NOT TOUCHED. The eight-column floor and the span of two. Four
across is right for Groups, and changing the column count changes every
data-count rule underneath it.
"""

import sys
import os

EDITS = [
    (
        "the three widths",
        "  --spine-w:clamp(300px, 20%, 460px);   /* rail + curator together */\r\n"
        "\r\n"
        "  --queue-w:clamp(220px, 14.5%, 330px);   /* To Be Crafted */\r\n"
        "  --room-gap:20px;\r\n",

        "  /* TRIMMED 2026-08-20 so the cards can be square. The plates are\r\n"
        "     1180x1180 and a .78 card was cropping a fifth of every one -\r\n"
        "     which on a group photograph is whoever is standing at the edge.\r\n"
        "     Narrowing these three is what pays for the width. */\r\n"
        "  --spine-w:clamp(250px, 14.5%, 330px);   /* rail + curator together */\r\n"
        "\r\n"
        "  --queue-w:clamp(180px, 10.5%, 250px);   /* To Be Crafted */\r\n"
        "  --room-gap:16px;\r\n",
    ),
    (
        "the gutter",
        "  --stage-gutter-max:100px;\r\n",
        "  --stage-gutter-max:64px;   /* trimmed with the rails, same reason */\r\n",
    ),
    (
        "the card ratio",
        "  --card-ratio:.78;\r\n",
        "  /* SQUARE. The plates are square; .78 was inherited from the\r\n"
        "     portraits clone, where it is correct and here it was not. */\r\n"
        "  --card-ratio:1;\r\n",
    ),
    (
        "the rows stop stretching",
        "  grid-template-columns:repeat(8, minmax(0,1fr));\r\n"
        "  grid-template-rows:repeat(2, minmax(0,1fr));\r\n"
        "  gap:var(--card-gap);\r\n"
        "  align-content:stretch;\r\n",

        "  grid-template-columns:repeat(8, minmax(0,1fr));\r\n"
        "  /* CONTENT-SIZED, NOT STRETCHED. Two 1fr rows in a fixed-height room\r\n"
        "     take their height from the viewport, so a card could never be\r\n"
        "     square however wide the floor got - at 2560 the rows were 437\r\n"
        "     tall against 350 of width, and trimming the rails closed 38 of\r\n"
        "     that 87. With the rows sized to their cards instead, the card is\r\n"
        "     width-driven and square, and the height that is left over sits\r\n"
        "     above and below rather than being forced into the card. */\r\n"
        "  grid-template-rows:repeat(2, auto);\r\n"
        "  gap:var(--card-gap);\r\n"
        "  align-content:center;\r\n",
    ),
    (
        "the card follows its width",
        "  /* height comes from the row, width follows the ratio. the reverse — a\r\n"
        "     fixed ratio against a full-width card — overflows a fixed-height room. */\r\n"
        "  height:100%; width:auto; max-width:100%;\r\n"
        "  aspect-ratio:var(--card-ratio);\r\n",

        "  /* WIDTH FIRST NOW, and the height follows the ratio. The old note\r\n"
        "     here warned that a fixed ratio against a full-width card overflows\r\n"
        "     a fixed-height room, and it was right while the rows stretched to\r\n"
        "     fill that room. They no longer do - see .floor - so the room is as\r\n"
        "     tall as its cards and there is nothing to overflow. max-height is\r\n"
        "     the belt: a viewport short enough to squeeze two rows gets a\r\n"
        "     slightly-not-square card rather than a clipped one. */\r\n"
        "  width:100%; height:auto; max-height:100%;\r\n"
        "  aspect-ratio:var(--card-ratio);\r\n",
    ),
    (
        "the lorem footer",
        ".room--footer{\r\n"
        "  display:grid;\r\n"
        "  grid-template-columns:repeat(5, minmax(0,1fr));\r\n",

        "/* ---- FOOTER HIDDEN - NOT REMOVED ------------------------------------\r\n"
        "   Five bays of placeholder heading and lorem, on a page that is now\r\n"
        "   live. Same ruling as portraits.html: the markup, the stone and the\r\n"
        "   dividers all stay, because writing five bays of copy is a smaller\r\n"
        "   job than rebuilding a footer, and the day the copy exists this is\r\n"
        "   one rule to delete.\r\n"
        "   -------------------------------------------------------------------- */\r\n"
        ".room--footer{ display:none !important }\r\n"
        ".rooms{ row-gap:0; column-gap:var(--room-gap) }\r\n"
        "\r\n"
        ".room--footer{\r\n"
        "  display:grid;\r\n"
        "  grid-template-columns:repeat(5, minmax(0,1fr));\r\n",
    ),
]

MARKER = "TRIMMED 2026-08-20"


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

    print("patch-groups-square")
    print("  target   " + path)
    print("  mode     " + ("APPLY" if apply_it else "dry run - nothing will be written"))

    if MARKER in original:
        print("  SKIP     already square")
        return 0

    text = original
    failed = 0
    for name, anchor, new in EDITS:
        n = text.count(anchor)
        if n != 1:
            print("  FAIL     " + name + " - anchor matches " + str(n) + " times")
            failed += 1
            continue
        text = text.replace(anchor, new, 1)
        print("  OK       " + name)

    if failed:
        print("  REFUSED  " + str(failed) + " anchor problem(s). Nothing written.")
        return 1

    # pre-write assertions
    assert text.count("--card-ratio:1;") == 1, "ratio not set"
    assert "--card-ratio:.78" not in text, "old ratio survives"
    assert text.count("--spine-w:clamp(250px, 14.5%, 330px)") == 1, "spine not trimmed"
    assert text.count("--queue-w:clamp(180px, 10.5%, 250px)") == 1, "queue not trimmed"
    assert text.count("--stage-gutter-max:64px") == 1, "gutter not trimmed"
    # the 1599px block already carries a 16px room gap, so this is one MORE
    assert text.count("--room-gap:16px") == original.count("--room-gap:16px") + 1, \
        "room gap not trimmed"
    # the mobile block reads var(--card-ratio, .78) and follows the root, so
    # it needs no edit - but it must still be there
    assert text.count("aspect-ratio:var(--card-ratio, .78);") == 1, \
        "the mobile ratio consumer was disturbed"
    assert text.count("grid-template-rows:repeat(2, auto);") == 1, "rows still stretch"
    assert "grid-template-rows:repeat(2, minmax(0,1fr));" not in text, "old row rule survives"
    assert text.count("width:100%; height:auto; max-height:100%;") == 1, "card not width-driven"
    assert text.count(".room--footer{ display:none !important }") == 1, "footer not hidden"
    # the floor shape must be untouched - every data-count rule depends on it
    assert text.count("grid-template-columns:repeat(8, minmax(0,1fr));") == \
        original.count("grid-template-columns:repeat(8, minmax(0,1fr));"), "the floor columns changed"
    assert text.count("grid-column:auto / span 2;") == 1, "the card span changed"
    assert text.count('<footer class="room room--footer">') == 1, "footer markup was touched"
    assert "\r\n" in text, "line endings lost"
    assert len(text) > len(original), "file did not grow"

    if not apply_it:
        print("  Would write " + str(len(text) - len(original)) + " more bytes. Re-run with --apply.")
        return 0

    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("  WROTE    " + path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
