#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-series-lookup.py  --  My Collection learns the word Halloween.

    python scripts\\patch-series-lookup.py public\\portraits.html
    python scripts\\patch-series-lookup.py public\\portraits.html --apply

Run it against portraits, pets, groups and halloween. Dry run by default;
output to %USERPROFILE%\\Downloads\\<leafname>; install with
Install-File.ps1.

THE FAULT, and it is mine, shipped this morning.

Two lookup tables govern My Collection. Neither knows Halloween exists.

    var MC_SERIES = ['Action','Groups','Mobile Wallpapers','Pets','Portraits'];

    var SERIES_LABEL = { portraits:'Portraits', pets:'Pets', groups:'Groups',
                         action:'Action', actionmini:'Action',
                         wallpapers:'Mobile Wallpapers' };

build-halloween-page.py set that room to store series 'halloween' -- which
was right -- and did not add it to either table, which was not. So a piece
crafted in the Halloween room since this morning:

  - has no filter to appear under. MC_SERIES draws the filter row, and a
    series absent from it is reachable only by View All. The customer's
    Halloween work is in their collection and cannot be filtered to.
  - comes back from the server unnamed. SERIES_LABEL turns the stored
    series into what the piece is called, and a missing key falls through
    to the room's own default -- so the same piece reads 'Portraits' in one
    room and 'Pets' in another depending on which page loaded it.

BOTH TABLES LIVE IN EVERY ROOM. The collection is not per-Series -- it
holds every piece whatever made it -- so all four pages need this, not just
the Halloween one. A customer with the Pets room open when a Halloween
piece lands reads it through pets.html's copy of the table.

pets-halloween.html already has both, from its build script.

WHY 'halloween' AND NOT 'pets_halloween'. Pets Halloween stores its pieces
under 'pets', with the two pet rooms sharing one filter -- see
build-pets-halloween-page.py. Only the human Halloween room stores
'halloween'. One key covers it.

WHERE Halloween SITS IN THE ROW. Alphabetical, between Groups and Mobile
Wallpapers, because that is how the existing five are ordered. Not by
importance, and not appended -- an appended entry would read as an
afterthought in the one place a customer scans quickly.
"""

import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DOWNLOADS = os.path.join(
    os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Downloads')

ROOMS = ('portraits.html', 'pets.html', 'groups.html', 'halloween.html')

OLD_MC = "  var MC_SERIES = ['Action','Groups','Mobile Wallpapers','Pets','Portraits'];"
NEW_MC = """  /* Halloween was missing, so every piece from that room had no filter to
     appear under and was reachable only by View All. Alphabetical, like
     the rest -- an appended entry reads as an afterthought. */
  var MC_SERIES = ['Action','Groups','Halloween','Mobile Wallpapers','Pets','Portraits'];"""

OLD_SL = """  var SERIES_LABEL = { portraits:'Portraits', pets:'Pets', groups:'Groups',
                       action:'Action', actionmini:'Action',
                       wallpapers:'Mobile Wallpapers' };"""
NEW_SL = """  /* halloween was missing, so a piece stored under it fell through to the
     room's own default and read as Portraits on one page and Pets on
     another. Pets Halloween is not here on purpose: it stores 'pets', so
     both pet rooms share one filter. */
  var SERIES_LABEL = { portraits:'Portraits', pets:'Pets', groups:'Groups',
                       halloween:'Halloween',
                       action:'Action', actionmini:'Action',
                       wallpapers:'Mobile Wallpapers' };"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('target')
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()

    target = args.target.replace('/', os.sep).replace('\\', os.sep)
    path = target if os.path.isabs(target) else os.path.join(REPO, target)
    if not os.path.isfile(path):
        sys.exit('FAIL: no file at %s' % path)

    leaf = os.path.basename(path)
    if leaf not in ROOMS:
        sys.exit('FAIL: %s is not a room with these tables. Known: %s'
                 % (leaf, ', '.join(ROOMS)))

    with open(path, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')
    start_len = len(text)

    print('file   : %s  (%d bytes, %s)' % (path, len(raw), 'CRLF' if crlf else 'LF'))

    done_mc = "'Groups','Halloween'," in text
    done_sl = "halloween:'Halloween'," in text
    if done_mc and done_sl:
        print('\nAlready correct. Nothing to do.')
        return

    edits = []
    if not done_mc:
        edits.append(('MC_SERIES', OLD_MC, NEW_MC))
    if not done_sl:
        edits.append(('SERIES_LABEL', OLD_SL, NEW_SL))

    print('\nchecking anchors:')
    bad = []
    for label, old, new in edits:
        found = text.count(old)
        ok = found == 1
        print('  %-16s %s  (found %d, expected 1)' %
              (label, 'ok ' if ok else 'FAIL', found))
        if not ok:
            bad.append(label)
    if bad:
        print('\nNOTHING WRITTEN. Failed: %s' % ', '.join(bad))
        print('This room has drifted from the others - read it before forcing.')
        sys.exit(1)

    for label, old, new in edits:
        text = text.replace(old, new, 1)

    print('\nverifying result:')
    post = [
        ('Halloween has a filter', "'Groups','Halloween'," in text),
        ('halloween has a label', "halloween:'Halloween'," in text),
        ('six filters, not five', text.count("'Mobile Wallpapers','Pets'") == 1),
        ('pets_halloween not added', 'pets_halloween:' not in text),
        ('file did not collapse', len(text) > start_len * 0.9),
    ]
    for label, ok in post:
        print('  %-30s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in post):
        sys.exit('\nNOTHING WRITTEN. Post-write verification failed.')

    out = os.path.join(DOWNLOADS, leaf)
    if not args.apply:
        print('\nDRY RUN. Re-run with --apply to write')
        print('  %s' % out)
        return

    if crlf:
        text = text.replace('\n', '\r\n')
    with open(out, 'w', encoding='utf-8', newline='') as fh:
        fh.write(text)
    print('\nWROTE %s  (%d bytes)' % (out, len(text)))
    print('\nInstall-File.ps1 %s' % target)


if __name__ == '__main__':
    main()
