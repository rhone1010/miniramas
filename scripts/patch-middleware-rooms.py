#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-middleware-rooms.py  --  put /pets and /halloween on the map.

    python scripts\\patch-middleware-rooms.py
    python scripts\\patch-middleware-rooms.py --apply

Dry run by default. Output to %USERPROFILE%\\Downloads\\middleware.ts; put
it back with Install-File.ps1 so the version it replaces is archived.

WHY. PAGES is an exact-match table and anything absent 404s honestly.
public/pets.html and public/halloween.html both exist, are both wired to
their own engines, and neither is reachable -- the same fault that had
/groups 404ing for three rounds of theorising in August, which turned out
to be one line in a file nobody had opened.

WHAT IS NOT ADDED, and why.

  /pets/portraits and /pets/halloween
      Ruled: /pets becomes a two-card chooser and today's pets.html is
      really the Pets Portraits room. Neither the chooser nor a renamed
      room file exists yet, so a line here would point at nothing. They
      arrive together, in one patch, when the chooser is built.

  Pets Halloween
      27 effects in a catalogue, no square plates on disk, no route -- the
      generate route is to be extended to take the pethw_ prefix. Nothing
      to point at.

  Studio's two galleries
      Ruled: they are the two cards you land on at /wallpapers/studio,
      not URLs of their own.
"""

import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DOWNLOADS = os.path.join(
    os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Downloads')
SRC = os.path.join(REPO, 'middleware.ts')

ANCHOR = "  '/groups': '/groups.html',"

NEW = """  '/groups': '/groups.html',
  /* PETS AND HALLOWEEN, 21 August. Both files exist and both are wired to
     their own engines -- pets/analyze and pets/generate for one,
     portraits/analyze plus halloween/generate for the other.

     /pets serves the room as built today. It becomes the two-card chooser
     when that exists, at which point this line changes and
     /pets/portraits and /pets/halloween join it. Adding those two now
     would put a room in the Series menu that opens onto nothing, which is
     the fault the Portraits menu comment above was written about. */
  '/pets': '/pets.html',
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
        ("/pets not already mapped", "'/pets':" not in text),
        ("/halloween not already mapped", "'/halloween':" not in text),
    ]
    for label, ok in checks:
        print('  %-32s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in checks):
        sys.exit('\nNOTHING WRITTEN.')

    # The page files have to be there. A route to a missing file is a
    # 404 with an extra step, and this is the exact class of claim that
    # has cost the most this month -- so it is read, not assumed.
    print('\npage files:')
    missing = []
    for leaf in ('pets.html', 'halloween.html'):
        p = os.path.join(REPO, 'public', leaf)
        there = os.path.isfile(p)
        print('  public/%-18s %s' % (leaf, 'ok' if there else 'MISSING'))
        if not there:
            missing.append(leaf)
    if missing:
        sys.exit('\nNOTHING WRITTEN. Route with no file: %s' % ', '.join(missing))

    # .vercelignore is why /groups 404'd. Check it before, not after.
    vi = os.path.join(REPO, '.vercelignore')
    if os.path.isfile(vi):
        with open(vi, 'r', encoding='utf-8', errors='replace') as fh:
            ig = fh.read()
        print('\n.vercelignore:')
        for leaf in ('pets.html', 'halloween.html'):
            hit = leaf in ig
            print('  %-20s %s' % (leaf, 'EXCLUDED - fix this' if hit else 'not excluded'))
            if hit:
                missing.append(leaf)
        if missing:
            sys.exit('\nNOTHING WRITTEN. A mapped page in .vercelignore never '
                     'reaches the deployment.')
    else:
        print('\n.vercelignore: not found at repo root - check by hand.')

    text = text.replace(ANCHOR, NEW, 1)

    print('\nverifying result:')
    post = [
        ("/pets mapped", "'/pets': '/pets.html'," in text),
        ("/halloween mapped", "'/halloween': '/halloween.html'," in text),
        ("/groups still mapped", "'/groups': '/groups.html'," in text),
        ("no /pets/ subroute added", "'/pets/" not in text),
        ("file did not collapse", len(text) > start_len * 0.9),
    ]
    for label, ok in post:
        print('  %-28s %s' % (label, 'ok' if ok else 'FAIL'))
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
