#!/usr/bin/env python3
# scripts/patch-middleware-wallpaper-routes.py
#
# THE FIVE WALLPAPER ROUTES.
#
# middleware maps a clean URL to a file in public/. It matches EXACT paths,
# so every room needs its own line - /wallpapers/halloween is not covered by
# /wallpapers being present.
#
#     /wallpapers             the stage, four rooms      wallpapers.html
#     /wallpapers/portraits   |
#     /wallpapers/pets        |- the same file           wallpapers.html
#     /wallpapers/halloween   |
#     /wallpapers/studio      no photograph, no Curator  wallpaper-studio.html
#
# The first four are one file on purpose: same rail, same upload, same craft
# loop, differing only in which effects they offer. The page reads the room
# off the path and paints it. Four files would be four copies of the rail and
# four places to fix one bug.
#
# Studio is its own because it shares nothing - no photograph, no Curator,
# another model and other money.
#
# ALSO REMOVED: /pet-wallpaper, which points at a file that does not exist.
# It was written when Pets was going to be its own page rather than a room,
# and a route that 404s is worse than no route - it looks like a fault
# rather than a thing not built yet.
#
# THE STUDIO PAGE IS NOT BUILT. /wallpapers/studio will 404 until it is,
# which is the intended state: the room card on the stage links there and it
# is better to have the link right and the page missing than the reverse.
#
# Pure ASCII. CRLF-aware - middleware.ts may be LF where the HTML is CRLF,
# so both are tried. Anchors asserted before any write.
#
#   python scripts/patch-middleware-wallpaper-routes.py            (dry run)
#   python scripts/patch-middleware-wallpaper-routes.py --write

import io
import os
import sys

TARGET = 'middleware.ts'


def both(s):
    return [s.replace('\n', '\r\n'), s]


# The board line landed in the previous patch and is the safest anchor in the
# map - it is recent, it is unique, and it is not something anybody is about
# to reorder.
PAGES_OLD = """  '/community': '/community.html',"""

PAGES_NEW = """  '/community': '/community.html',

  /* MOBILE WALLPAPERS. Exact-match, so every room needs its own line.
     The first four are one file: the page reads the room off the path.
     Studio is separate because it shares nothing with them - no
     photograph, no Curator, another model and other money. */
  '/wallpapers': '/wallpapers.html',
  '/wallpapers/portraits': '/wallpapers.html',
  '/wallpapers/pets': '/wallpapers.html',
  '/wallpapers/halloween': '/wallpapers.html',
  '/wallpapers/studio': '/wallpaper-studio.html',"""


def main():
    write = '--write' in sys.argv

    if not os.path.exists(TARGET):
        print('NOT FOUND: %s  (run from the repo root)' % TARGET)
        return 1

    with io.open(TARGET, 'r', encoding='utf-8', newline='') as fh:
        src = fh.read()

    if "'/wallpapers/halloween'" in src:
        print('Already patched. Nothing to do.')
        return 0

    hit = None
    for o, n in zip(both(PAGES_OLD), both(PAGES_NEW)):
        if src.count(o) == 1:
            hit = (o, n)
            break
    if hit is None:
        print('ANCHOR not found exactly once. Nothing written.')
        print('Expecting the /community line from the previous patch -')
        print('run patch-middleware-community-and-cookie.py first.')
        return 1
    print('anchor ok')

    braces = src.count('{') - src.count('}')
    out = src.replace(hit[0], hit[1], 1)

    # THE OLD ROUTES GO, AND THIS IS THE POINT OF THE PATCH AS MUCH AS THE
    # NEW ONES ARE. '/wallpapers' was already in this map pointing at
    # portrait-wallpaper.html. A duplicate key in an object literal does not
    # error - the later one silently wins - so the page would have worked and
    # the map would have carried a lie. That exact shape (two declarations,
    # the later winning quietly) cost a working session on 2026-08-10 when
    # coinFor was declared twice in portraits.html.
    #
    # pet-wallpaper goes for a different reason: it points at a file that
    # does not exist, and a route that 404s reads as a fault rather than as
    # a thing not built yet.
    dead = []
    for stale in ('/wallpapers', '/portrait-wallpaper', '/pet-wallpaper'):
        for q in ("'", '"'):
            for nl in ('\r\n', '\n'):
                for target in ('/portrait-wallpaper.html', '/pet-wallpaper.html'):
                    line = '  %s%s%s: %s%s%s,%s' % (q, stale, q, q, target, q, nl)
                    if line in out:
                        out = out.replace(line, '', 1)
                        dead.append(stale)

    if out.count('{') - out.count('}') != braces:
        print('BRACE BALANCE CHANGED. Nothing written.')
        return 1

    for want in ("'/wallpapers'", "'/wallpapers/portraits'",
                 "'/wallpapers/pets'", "'/wallpapers/halloween'",
                 "'/wallpapers/studio'"):
        if want not in out:
            print('%s missing after the edit. Nothing written.' % want)
            return 1

    print('  routes added   : 5')
    print('  stale removed  : %s' % (', '.join(dead) if dead else 'none'))

    # No key may appear twice. This is the assertion the whole patch exists
    # for; without it the map compiles and lies.
    for key in ("'/wallpapers':", "'/wallpapers/portraits':",
                "'/wallpapers/studio':"):
        if out.count(key) != 1:
            print('\n%s appears %d times - a duplicate key would silently '
                  'win. Nothing written.' % (key, out.count(key)))
            return 1

    if not write:
        print('\nDRY RUN. Nothing written. Re-run with --write.')
        return 0

    with io.open(TARGET, 'w', encoding='utf-8', newline='') as fh:
        fh.write(out)
    print('\nWritten: %s' % TARGET)
    return 0


if __name__ == '__main__':
    sys.exit(main())
