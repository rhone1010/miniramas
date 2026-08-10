#!/usr/bin/env python3
# scripts/patch-middleware-community-and-cookie.py
#
# TWO EDITS TO middleware.ts
#
# 1 · /community joins the extensionless page map, so the board can be
#     served the same way every other page is.
#
# 2 · THE GATE COOKIE STOPS DYING WHEN THE BROWSER CLOSES.
#
#     It was written as a session cookie with a one-hour idle window,
#     whichever came first. That is why the passcode has to be typed again
#     on every visit and often twice in a day, which Rich raised on
#     2026-08-10 as friction.
#
#     Now: thirty days, re-stamped on every page request. Still one cookie,
#     still httpOnly, still ended by /logout.
#
#     WHAT THIS COSTS. The gate is a soft-launch courtesy, not a security
#     boundary - the page behind it is real HTML and readable by anyone who
#     views source, which was Rich's call on 2026-08-06 and is accepted. So
#     a thirty-day cookie gives away nothing that a one-hour cookie was
#     protecting. What it does give away is a SHARED COMPUTER: somebody who
#     came in on a friend's laptop stays in for a month. At forty invited
#     accounts that is the intended behaviour, not a leak.
#
#     If the gate ever has to be a real boundary, this is the line to
#     revisit, and the answer then is a real session, not a shorter cookie.
#
# Pure ASCII. CRLF-aware. Anchors asserted before any write.
#
#   python scripts/patch-middleware-community-and-cookie.py            (dry run)
#   python scripts/patch-middleware-community-and-cookie.py --write

import io
import os
import sys

TARGET = 'middleware.ts'


def variants(s):
    """The repo is mixed: middleware.ts may be LF where the HTML is CRLF.
       Try both rather than guessing wrong and reporting a missing anchor."""
    return [s.replace('\n', '\r\n'), s]


# ---------------------------------------------------------------- 1
PAGES_OLD = """  '/gallery': '/gallery.html',
  '/help': '/help.html',
};"""

PAGES_NEW = """  '/gallery': '/gallery.html',
  /* THE BOARD. A page rather than a panel: it is somewhere you go and spend
     time, it wants a URL somebody can send to a friend, and it is the only
     page here that could bring a stranger in. */
  '/community': '/community.html',
  '/help': '/help.html',
};"""


# ---------------------------------------------------------------- 2
IDLE_OLD = """const IDLE_MS = 60 * 60 * 1000; // 1 hour of inactivity"""

IDLE_NEW = """/* Thirty days, re-stamped on every page request, so this is idle time and
   not total. It was one hour and a session cookie, which meant the passcode
   had to be typed again on nearly every visit - friction on a door that is
   a courtesy rather than a boundary. See the note in the patch script. */
const IDLE_MS = 30 * 24 * 60 * 60 * 1000;"""


COOKIE_OLD = """/* Cookie value is the code and the time it was last seen, so the idle
   window is checked without any server-side store. No maxAge: the
   cookie dies when the browser closes. */
function issue(res: NextResponse, code: string) {
  res.cookies.set(COOKIE, code + '|' + Date.now(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}"""

COOKIE_NEW = """/* Cookie value is the code and the time it was last seen, so the idle
   window is checked without any server-side store.

   IT NOW HAS A maxAge. Without one it was a session cookie and died with
   the browser, which is why an invited guest met the passcode card again
   every morning. Thirty days, re-stamped on every page request. /logout
   still ends it immediately. */
function issue(res: NextResponse, code: string) {
  res.cookies.set(COOKIE, code + '|' + Date.now(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: IDLE_MS / 1000,
  });
}"""


EDITS = [
    ('community page map', PAGES_OLD,  PAGES_NEW),
    ('idle window',        IDLE_OLD,   IDLE_NEW),
    ('cookie lifetime',    COOKIE_OLD, COOKIE_NEW),
]


def main():
    write = '--write' in sys.argv

    if not os.path.exists(TARGET):
        print('NOT FOUND: %s  (run from the repo root)' % TARGET)
        return 1

    with io.open(TARGET, 'r', encoding='utf-8', newline='') as fh:
        src = fh.read()

    if "'/community'" in src and 'maxAge: IDLE_MS' in src:
        print('Already patched. Nothing to do.')
        return 0

    resolved = []
    fail = False
    for name, old, new in EDITS:
        hit = None
        for o, n in zip(variants(old), variants(new)):
            if src.count(o) == 1:
                hit = (o, n)
                break
        if hit is None:
            print('ANCHOR %-20s not found exactly once' % name)
            fail = True
        else:
            print('anchor %-20s ok' % name)
            resolved.append(hit)
    if fail:
        print('\nNothing written. An anchor has moved - read the live file.')
        return 1

    braces_before = src.count('{') - src.count('}')
    out = src
    for o, n in resolved:
        out = out.replace(o, n, 1)

    if out.count('{') - out.count('}') != braces_before:
        print('\nBRACE BALANCE CHANGED. Nothing written.')
        return 1

    print('\n  gate cookie: session -> 30 days, idle-refreshed')
    print('  /community -> /community.html')

    if not write:
        print('\nDRY RUN. Nothing written. Re-run with --write.')
        return 0

    with io.open(TARGET, 'w', encoding='utf-8', newline='') as fh:
        fh.write(out)
    print('\nWritten: %s' % TARGET)
    return 0


if __name__ == '__main__':
    sys.exit(main())
