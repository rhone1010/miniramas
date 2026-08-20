#!/usr/bin/env python3
"""
patch-middleware-panels.py - stop My Collection and Account 404ing.

  python scripts\\patch-middleware-panels.py middleware.ts
  python scripts\\patch-middleware-panels.py middleware.ts --apply

Dry run by default. CRLF file.

THE FAULT. My Collection, Account and the Print Shop are not pages. They are
slide-overs inside portraits.html, and portraits.html intercepts clicks on
its own masthead so they never navigate. Every other page - the Studio,
Community, and now Gallery - links to them as ordinary URLs. None of the
three is in PAGES, so the request falls through to Next and 404s.

A 404 on My Collection is the worst one of the three. It does not say "sign
in"; it says this page does not exist, to somebody looking for work they
paid for.

THE FIX, HALF ONE. Map all three to portraits.html. Half two is in
patch-portraits-panel-boot.py, which makes the page open the right panel
when it lands on one of these paths - without it this rewrite lands on the
workshop floor and the customer has to find the panel themselves.

BOTH HALVES SHIP TOGETHER. Neither is useful alone.

/print is mapped alongside the other two. It is in the same click map in
portraits.html and has exactly the same fault; it is simply not linked from
a masthead yet, so nobody has hit it.
"""

import sys
import os

ANCHOR = "  '/help': '/help.html',\r\n"

NEW = (
    "  /* THE THREE PANELS. My Collection, Account and the Print Shop are\r\n"
    "     slide-overs inside portraits.html, not pages of their own. The\r\n"
    "     workshop intercepts clicks on its own masthead so they never\r\n"
    "     navigate - but the Studio, Community and Gallery all link to them\r\n"
    "     as ordinary URLs, and without these three lines every one of those\r\n"
    "     links 404s.\r\n"
    "\r\n"
    "     Rewriting here is only half of it. portraits.html has to open the\r\n"
    "     panel it was asked for, or this lands somebody on the workshop\r\n"
    "     floor wondering where their collection went. See\r\n"
    "     scripts/patch-portraits-panel-boot.py. */\r\n"
    "  '/collection': '/portraits.html',\r\n"
    "  '/account': '/portraits.html',\r\n"
    "  '/print': '/portraits.html',\r\n"
    "  '/help': '/help.html',\r\n"
)

MARKER = "THE THREE PANELS"


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

    print("patch-middleware-panels")
    print("  target   " + path)
    print("  mode     " + ("APPLY" if apply_it else "dry run - nothing will be written"))

    if MARKER in original:
        print("  SKIP     already mapped")
        return 0

    n = original.count(ANCHOR)
    if n != 1:
        print("  FAIL     anchor matches " + str(n) + " times. Nothing written.")
        return 1

    text = original.replace(ANCHOR, NEW, 1)

    # pre-write assertions
    assert text.count("'/collection': '/portraits.html'") == 1, "collection not mapped"
    assert text.count("'/account': '/portraits.html'") == 1, "account not mapped"
    assert text.count("'/print': '/portraits.html'") == 1, "print not mapped"
    assert text.count("'/help': '/help.html'") == 1, "help mapping duplicated or lost"
    assert text.count("'/portraits': '/portraits.html'") == 1, "portraits mapping disturbed"
    assert text.count("'/groups': '/groups.html'") == 1, "groups mapping disturbed"
    assert text.index("'/collection'") < text.index("export const config"), \
        "landed outside the PAGES object"
    assert text.count("const PAGES") == 1, "PAGES duplicated"
    assert "\r\n" in text, "line endings lost"
    assert len(text) > len(original), "file did not grow"

    print("  OK       three panel paths mapped")

    if not apply_it:
        print("  Would write " + str(len(text) - len(original)) + " more bytes. Re-run with --apply.")
        return 0

    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("  WROTE    " + path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
