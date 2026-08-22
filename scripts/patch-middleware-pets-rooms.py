#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-middleware-pets-rooms.py  --  /pets/halloween and /pets/portraits.

    python scripts\\patch-middleware-pets-rooms.py
    python scripts\\patch-middleware-pets-rooms.py --apply

Dry run by default. Output to %USERPROFILE%\\Downloads\\middleware.ts;
install with Install-File.ps1.

WHY. public/pets-halloween.html exists and is wired -- its own registry,
four rooms, the human Halloween generate route, the pet analyzer -- and
nothing can reach it. PAGES is an exact-match table.

WHAT IS ADDED

  /pets/halloween  ->  /pets-halloween.html    the new room
  /pets/portraits  ->  /pets.html              the room /pets serves today

The second is not redundant. Rich ruled that /pets becomes a two-card
chooser with the two rooms behind it; today it serves the Pets Portraits
room directly. Mapping /pets/portraits now means that URL works before the
chooser exists, and when the chooser lands only ONE line changes -- /pets
repoints at the chooser and both rooms are already addressable.

/pets IS LEFT ALONE. It still serves pets.html. Until the chooser is built,
a customer clicking Pets in the Series menu should land in a room rather
than on a 404 or an empty stage.

THE PATTERN. /wallpapers already does this -- /wallpapers,
/wallpapers/portraits, /wallpapers/pets and /wallpapers/halloween all map
to wallpapers.html and the page reads the path. Nested URLs under a Series
are established here, not invented.
"""

import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DOWNLOADS = os.path.join(
    os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Downloads')
SRC = os.path.join(REPO, 'middleware.ts')

ANCHOR = """  '/pets': '/pets.html',
  '/halloween': '/halloween.html',"""

NEW = """  '/pets': '/pets.html',
  /* THE TWO PET ROOMS. Rich ruled /pets becomes a two-card chooser with
     these behind it. Until that exists /pets serves the Portraits room
     directly, so somebody clicking Pets in the menu lands somewhere real
     rather than on an empty stage.

     /pets/portraits is mapped now, ahead of the chooser, so that when the
     chooser lands only the /pets line above changes and both rooms are
     already addressable. Same shape /wallpapers already uses. */
  '/pets/portraits': '/pets.html',
  '/pets/halloween': '/pets-halloween.html',
  '/halloween': '/halloween.html',"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()

    if not os.path.isfile(SRC):
        sys.exit('FAIL: no middleware.ts at %s' % SRC)
    with open(SRC, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')
    start_len = len(text)

    print('file   : %s  (%d bytes, %s)' % (SRC, len(raw), 'CRLF' if crlf else 'LF'))

    print('\nchecking:')
    checks = [
        ('anchor present once', text.count(ANCHOR) == 1),
        ('not already mapped', "'/pets/halloween'" not in text),
    ]
    for label, ok in checks:
        print('  %-28s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in checks):
        sys.exit('\nNOTHING WRITTEN.')

    # A route to a missing file is a 404 with an extra step. Read, not assumed.
    print('\npage files:')
    missing = []
    for leaf in ('pets-halloween.html', 'pets.html'):
        p = os.path.join(REPO, 'public', leaf)
        there = os.path.isfile(p)
        print('  public/%-24s %s' % (leaf, 'ok' if there else 'MISSING'))
        if not there:
            missing.append(leaf)
    if missing:
        sys.exit('\nNOTHING WRITTEN. Route with no file: %s' % ', '.join(missing))

    # And .vercelignore, which is why /groups 404'd for three rounds.
    vi = os.path.join(REPO, '.vercelignore')
    if os.path.isfile(vi):
        with open(vi, 'r', encoding='utf-8', errors='replace') as fh:
            ig = fh.read()
        print('\n.vercelignore:')
        for leaf in ('pets-halloween.html', 'pets.html'):
            hit = leaf in ig
            print('  %-24s %s' % (leaf, 'EXCLUDED - fix this' if hit else 'not excluded'))
            if hit:
                missing.append(leaf)
        if missing:
            sys.exit('\nNOTHING WRITTEN. A mapped page in .vercelignore never '
                     'reaches the deployment.')
    else:
        print('\n.vercelignore: not at the repo root - check by hand.')

    # The registry has to be there too. The page loads it by name and an
    # empty floor is a harder fault to read than a 404.
    reg = os.path.join(REPO, 'public', 'pets-halloween-registry.js')
    print('\nregistry: %s' % ('ok' if os.path.isfile(reg) else 'MISSING'))
    if not os.path.isfile(reg):
        sys.exit('\nNOTHING WRITTEN. The page would render an empty floor.')

    text = text.replace(ANCHOR, NEW, 1)

    print('\nverifying result:')
    post = [
        ('/pets/halloween mapped',
         "'/pets/halloween': '/pets-halloween.html'," in text),
        ('/pets/portraits mapped',
         "'/pets/portraits': '/pets.html'," in text),
        ('/pets still serves the room', "'/pets': '/pets.html'," in text),
        ('/halloween untouched', "'/halloween': '/halloween.html'," in text),
        ('file did not collapse', len(text) > start_len * 0.9),
    ]
    for label, ok in post:
        print('  %-30s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in post):
        sys.exit('\nNOTHING WRITTEN. Post-write verification failed.')

    out = os.path.join(DOWNLOADS, 'middleware.ts')
    if not args.apply:
        print('\nDRY RUN. Re-run with --apply to write')
        print('  %s' % out)
        return

    if crlf:
        text = text.replace('\n', '\r\n')
    with open(out, 'w', encoding='utf-8', newline='') as fh:
        fh.write(text)
    print('\nWROTE %s  (%d bytes)' % (out, len(text)))
    print('\nInstall-File.ps1 middleware.ts')


if __name__ == '__main__':
    main()
