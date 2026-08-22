#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-silo-five.py  --  five rooms lay two over three.

    python scripts\\patch-silo-five.py public\\pets.html
    python scripts\\patch-silo-five.py public\\pets.html --apply

Dry run by default. Output to %USERPROFILE%\\Downloads\\<leafname>; install
with Install-File.ps1.

WHAT CHANGES. Rich, 21 August, from a marked-up screen: the top row two
wide, the bottom row three, and the whole thing centred on the middle card
of the bottom row.

The floor already has a rule for five and it does the opposite -- three
over two:

    .floor[data-count="5"] > :nth-child(1){ grid-column:2 / span 2 }
    .floor[data-count="5"] > :nth-child(4){ grid-column:3 / span 2; grid-row:2 }

That is left in place. It is the generic rule and the effects floor and the
pose floor both read it; a room of five effects should still lay three over
two. This overrides the SILO floor only, by id, which also outranks the
generic rule without touching it.

THE ARITHMETIC. The floor is eight columns and every card spans two, so the
centre of the grid is the line between column 4 and column 5.

    row 1     cols 3-4   5-6          two cards, the gap on the centre line
    row 2     cols 2-3   4-5   6-7    three cards, the middle one straddling it

So the middle card of the bottom row is centred on the axis and the two
above it sit either side of it. That is the shape in the markup Rich sent.

DOES IT BREAK ANYTHING. No, and it was worth checking rather than saying
so. Three things read the floor:

  - The keyboard walk at rooms[j] iterates the DOM, not the visual order.
    DOM order is unchanged -- first two on the top row, last three below --
    so tabbing still runs left to right, top to bottom.
  - The card's own height comes from the row and its width from
    --card-ratio. Neither is touched.
  - .floor[data-count="5"] itself is untouched, so every other five-up
    floor keeps its present layout.

FIVE IS PETS ONLY, today. Halloween has four rooms and takes the generic
four-across. Groups has four and was given a centred 2x2 this morning, in
groups.html alone. If Halloween should match Groups rather than the
generic, that is a separate ruling and a two-line patch -- raised here
because two rooms of four now lay out differently from each other.
"""

import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DOWNLOADS = os.path.join(
    os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Downloads')

ANCHOR = """/* a room with fewer than eight keeps the second row's height — the empty
   space is intentional, not a collapse. */"""

NEW = """/* a room with fewer than eight keeps the second row's height — the empty
   space is intentional, not a collapse. */

/* ---- FIVE ROOMS LAY TWO OVER THREE ------------------------------------
   Rich, 21 August. The generic rule above puts three on the top row and
   two below; this is the other way up, and centred on the middle card of
   the bottom row.

   Eight columns, every card spanning two, so the grid's centre is the line
   between column 4 and column 5:

     row 1    3-4   5-6           the gap between them sits on that line
     row 2    2-3   4-5   6-7     the middle card straddles it

   Scoped to the silo floor by id. The effects floor and the pose floor
   share .floor and a room of five effects should still read three over
   two, so the generic rule is overridden here rather than edited. */
#siloFloor[data-count="5"] > :nth-child(1){ grid-column:3 / span 2; grid-row:1 }
#siloFloor[data-count="5"] > :nth-child(2){ grid-column:5 / span 2; grid-row:1 }
#siloFloor[data-count="5"] > :nth-child(3){ grid-column:2 / span 2; grid-row:2 }
#siloFloor[data-count="5"] > :nth-child(4){ grid-column:4 / span 2; grid-row:2 }
#siloFloor[data-count="5"] > :nth-child(5){ grid-column:6 / span 2; grid-row:2 }"""


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
    with open(path, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')
    start_len = len(text)

    print('file   : %s  (%d bytes, %s)' % (path, len(raw), 'CRLF' if crlf else 'LF'))

    print('\nchecking:')
    checks = [
        ('anchor present once', text.count(ANCHOR) == 1),
        ('siloFloor exists', 'id="siloFloor"' in text),
        ('generic five rule present',
         '.floor[data-count="5"] > :nth-child(1)' in text),
        ('not already applied', '#siloFloor[data-count="5"]' not in text),
    ]
    for label, ok in checks:
        print('  %-30s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in checks):
        sys.exit('\nNOTHING WRITTEN.')

    # The rule only fires at five. Say what this room actually has rather
    # than let it be a surprise after the deploy.
    reg = re.search(r'<script src="/([a-z-]+-registry)\.js"></script>', text)
    print('\n  registry: %s' % (reg.group(1) + '.js' if reg else 'not found'))
    print('  The renderer sets data-count from R.silos.length. This rule')
    print('  fires only when that is 5 - Pets today, nothing else.')

    text = text.replace(ANCHOR, NEW, 1)

    print('\nverifying result:')
    post = [
        ('five cards placed',
         all(('#siloFloor[data-count="5"] > :nth-child(%d)' % n) in text
             for n in range(1, 6))),
        ('two on the top row',
         text.count('grid-row:1 }') >= 2),
        ('three on the bottom row',
         len(re.findall(r'#siloFloor\[data-count="5"\][^\n]*grid-row:2 \}', text)) == 3),
        ('middle card on the centre line',
         'nth-child(4){ grid-column:4 / span 2; grid-row:2 }' in text),
        ('generic rule untouched',
         '.floor[data-count="5"] > :nth-child(1){ grid-column:2 / span 2 }' in text),
        ('card ratio untouched', '--card-ratio' in text),
        ('file did not collapse', len(text) > start_len * 0.9),
    ]
    for label, ok in post:
        print('  %-34s %s' % (label, 'ok' if ok else 'FAIL'))
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
