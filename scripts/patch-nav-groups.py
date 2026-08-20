#!/usr/bin/env python3
"""
patch-nav-groups.py - put Groups into the main navigation.

  python scripts\\patch-nav-groups.py public\\portraits.html
  python scripts\\patch-nav-groups.py public\\portraits.html --apply

Dry run by default. Prints what it would change and writes nothing.

Two edits per page:
  1. The Series dropdown - Groups after Portraits, before the separator.
     The comment explaining why Groups was absent is replaced, because
     middleware maps /groups now and a stale reason is worse than none.
  2. The mobile drawer - the same link, same position.

Idempotent: if Groups is already in a block, that edit reports SKIP
rather than adding a second one.

Asserts before writing. Every anchor must appear exactly once; if one
matches twice the file is left alone, because the wrong of two identical
comments is the classic way this goes wrong here.
"""

import sys
import os

MENU_ANCHOR = (
    '        <a href="/portraits" role="menuitem" aria-current="page">Portraits</a>\r\n'
    '        <!-- Action, Groups and Pets were listed here and are not in\r\n'
    '             middleware\'s PAGES map, so all three 404. A Series menu that\r\n'
    '             offers four rooms and opens one is worse than a menu that\r\n'
    '             offers one: the first is a broken shop, the second is a small\r\n'
    '             one. They come back when they exist. -->\r\n'
)

MENU_NEW = (
    '        <a href="/portraits" role="menuitem" aria-current="page">Portraits</a>\r\n'
    '        <a href="/groups" role="menuitem">Groups</a>\r\n'
    '        <!-- Action and Pets were listed here too and are still not in\r\n'
    '             middleware\'s PAGES map, so both 404. A Series menu that\r\n'
    '             offers four rooms and opens two is worse than a menu that\r\n'
    '             offers two: the first is a broken shop, the second is a small\r\n'
    '             one. They come back when they exist. -->\r\n'
)

DRAWER_ANCHOR = (
    '    <a href="/portraits" class="on">Portraits</a>\r\n'
    '    <a href="/wallpapers">Mobile Wallpapers</a>\r\n'
)

DRAWER_NEW = (
    '    <a href="/portraits" class="on">Portraits</a>\r\n'
    '    <a href="/groups">Groups</a>\r\n'
    '    <a href="/wallpapers">Mobile Wallpapers</a>\r\n'
)

EDITS = [
    ("series dropdown", MENU_ANCHOR, MENU_NEW, '<a href="/groups" role="menuitem">'),
    ("mobile drawer", DRAWER_ANCHOR, DRAWER_NEW, '    <a href="/groups">Groups</a>'),
]


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

    print("patch-nav-groups")
    print("  target   " + path)
    print("  mode     " + ("APPLY" if apply_it else "dry run - nothing will be written"))

    text = original
    changed = 0
    failed = 0

    for name, anchor, new, already in EDITS:
        if already in text:
            print("  SKIP     " + name + " - Groups already present")
            continue
        n = text.count(anchor)
        if n == 0:
            print("  FAIL     " + name + " - anchor not found")
            failed += 1
            continue
        if n > 1:
            print("  FAIL     " + name + " - anchor matches " + str(n) + " times")
            failed += 1
            continue
        text = text.replace(anchor, new)
        print("  OK       " + name)
        changed += 1

    if failed:
        print("  REFUSED  " + str(failed) + " anchor problem(s). Nothing written.")
        return 1

    if changed == 0:
        print("  Nothing to do.")
        return 0

    # pre-write assertions
    assert text.count('href="/groups"') >= 2, "groups link missing after patch"
    assert text.count('href="/portraits"') == original.count('href="/portraits"'), \
        "portraits links changed"
    assert text.count('href="/wallpapers"') == original.count('href="/wallpapers"'), \
        "wallpapers links changed"
    assert len(text) > len(original), "file did not grow"
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
