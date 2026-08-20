#!/usr/bin/env python3
"""
patch-floor-height.py - stop the wallpaper floor overflowing on tall screens.

  python scripts\\patch-floor-height.py public\\wallpapers.html
  python scripts\\patch-floor-height.py public\\wallpapers.html --apply

Dry run by default. This file is LF, not CRLF - the anchors match that.

THE PROBLEM IS HEIGHT, NOT WIDTH.

Tiles are 9:16. A 300px tile is 533px tall, so two rows plus the masthead,
the stage padding and the floor head want about 1330px of viewport. A
2560x1440 monitor gives roughly 1300 once the browser has taken its bar,
so the second row runs off the bottom by a whisker.

Every existing rule in the band is keyed to width - 1600, 1400, 1180, 980,
640. None of them fire on a 2560-wide screen, which is why this only shows
up on the biggest monitors and looked fine at 1920, 1600 and 1330.

THE FIX. --tile-max becomes the smaller of two things: the width band's
figure, and whatever height is actually left. The width bands keep their
numbers, renamed --tile-cap so they set the ceiling rather than the value.

  --tile-max = min(--tile-cap, (100vh - --floor-chrome) * 9/32)

9/32 is 9/16 halved: two rows share the height. --floor-chrome is everything
that is not floor - masthead 90, stage padding 32 top and 72 bottom, floor
head about 68, and the 20px gap between the two rows. One number, one place,
tune it there if the head grows.

Self-adjusting, so it holds at 1440 tall, at 1080, and on the next monitor
nobody has tested. Nothing is added to the cascade at 1920 and below: the
formula only bites when height is the binding constraint, which at those
sizes it is not.

Covers every floor - Portraits, Pets, the Halloween sets and Halloween's
own Portraits sub-floor all paint through .floor.
"""

import sys
import os

EDITS = [
    (
        "root cap",
        "  --tile-max:300px;\n",
        "  --tile-cap:300px;\n"
        "  /* HEIGHT IS THE BINDING CONSTRAINT ABOVE 1920, NOT WIDTH.\n"
        "     Tiles are 9:16, so a 300px tile is 533px tall and two rows want\n"
        "     about 1330px of viewport. A 2560x1440 screen has roughly 1300\n"
        "     after the browser bar, and the second row ran off the bottom.\n"
        "     Every rule in the band below is keyed to width, so none of them\n"
        "     fired on a screen that wide.\n"
        "     --tile-max is now the smaller of the width band's figure and\n"
        "     what height is left. 9/32 is 9/16 halved - two rows share it. */\n"
        "  --floor-chrome:282px;\n"
        "  --tile-max:min(var(--tile-cap), calc((100vh - var(--floor-chrome)) * 9 / 32));\n",
    ),
    (
        "1600 band",
        "  :root{ --floor-gap:16px; --tile-max:260px }\n",
        "  :root{ --floor-gap:16px; --tile-cap:260px }\n",
    ),
    (
        "1400 band",
        "  :root{ --floor-gap:12px; --tile-max:220px }\n",
        "  :root{ --floor-gap:12px; --tile-cap:220px }\n",
    ),
]

MARKER = "--floor-chrome"


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

    print("patch-floor-height")
    print("  target   " + path)
    print("  mode     " + ("APPLY" if apply_it else "dry run - nothing will be written"))

    if MARKER in original:
        print("  SKIP     already patched")
        return 0

    if "\r\n" in original:
        print("  FAIL     file has CRLF endings; these anchors are LF. Nothing written.")
        return 1

    text = original
    failed = 0
    for name, anchor, new in EDITS:
        n = text.count(anchor)
        if n != 1:
            print("  FAIL     " + name + " - anchor matches " + str(n) + " times")
            failed += 1
            continue
        text = text.replace(anchor, new)
        print("  OK       " + name)

    if failed:
        print("  REFUSED  " + str(failed) + " anchor problem(s). Nothing written.")
        return 1

    # pre-write assertions
    assert text.count("--tile-cap:300px") == 1, "root cap missing"
    assert text.count("--tile-cap:260px") == 1, "1600 cap missing"
    assert text.count("--tile-cap:220px") == 1, "1400 cap missing"
    assert text.count("--floor-chrome:282px") == 1, "chrome token missing or duplicated"
    assert text.count("--tile-max:min(") == 1, "formula missing or duplicated"
    assert "--tile-max:300px" not in text, "old root value left behind"
    assert "--tile-max:260px" not in text, "old 1600 value left behind"
    assert "--tile-max:220px" not in text, "old 1400 value left behind"
    assert text.count("var(--tile-max)") == original.count("var(--tile-max)"), \
        "a consumer of --tile-max was changed"
    assert text.count("--floor-cols") == original.count("--floor-cols"), \
        "column rules were touched"
    assert "\r\n" not in text, "line endings changed"
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
