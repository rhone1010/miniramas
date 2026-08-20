#!/usr/bin/env python3
"""
patch-community-toggles.py - the two view toggles at 1.5rem.

  python scripts\\patch-community-toggles.py public\\community.html
  python scripts\\patch-community-toggles.py public\\community.html --apply

Dry run by default. CRLF file.

The Board and Ideas are the only way to switch what this page shows, and at
1.1rem they sit closer to a caption than a control. Same note as the Gallery
filters and the same fix - 1.5rem, padding opened to match so the pill grows
with the text rather than gripping it.

Matches the Gallery filter bar exactly, which is the point: two pages, one
kind of control, one size.
"""

import sys
import os

ANCHOR = (
    ".views button{\r\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.1rem;\r\n"
)

NEW = (
    "/* 1.5rem, matching the Gallery filter pills. These two are the only way\r\n"
    "   to change what the page shows and should read as controls. */\r\n"
    ".views button{\r\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.5rem;\r\n"
)

PAD_ANCHOR = "  padding:.5rem 1.2rem; border-radius:999px;\r\n"
PAD_NEW = "  padding:.5rem 1.15rem; border-radius:999px;\r\n"

MARKER = "matching the Gallery filter pills"


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

    print("patch-community-toggles")
    print("  target   " + path)
    print("  mode     " + ("APPLY" if apply_it else "dry run - nothing will be written"))

    if MARKER in original:
        print("  SKIP     already at 1.5rem")
        return 0

    text = original
    failed = 0
    for name, anchor, new in (
        ("toggle size", ANCHOR, NEW),
        ("toggle padding", PAD_ANCHOR, PAD_NEW),
    ):
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
    assert text.count(".views button{") == 1, "rule duplicated"
    assert "font-size:1.1rem;\r\n  color" not in text.split(".views button{")[1][:200], \
        "old size left behind"
    assert text.count('id="vBoard"') == 1 and text.count('id="vIdeas"') == 1, \
        "the toggles themselves were touched"
    assert "\r\n" in text, "line endings lost"

    if not apply_it:
        print("  Would write " + str(len(text) - len(original)) + " more bytes. Re-run with --apply.")
        return 0

    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("  WROTE    " + path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
