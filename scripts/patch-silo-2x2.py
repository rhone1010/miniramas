#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-silo-2x2.py  --  the four-silo floor becomes a centred 2x2.

    python scripts\\patch-silo-2x2.py public\\groups.html
    python scripts\\patch-silo-2x2.py public\\groups.html --apply

Dry run by default. Output to %USERPROFILE%\\Downloads\\<leafname>; install
with Install-File.ps1.

WHAT CHANGES. Rich, 21 August, from a mockup: the silo cards scaled up and
laid 2x2 and centred rather than four across. 320px at 1920.

The floor is an eight-column grid and every card spans two, so four silos
fill one row and reach both edges -- .floor[data-count="4"] has explicit
rules putting the first card hard left and the fourth hard right. At 1920
that made each card about 280 wide with the whole second row standing
empty beneath it.

HOW. A scoped override rather than an edit to .floor, because the effects
floor and the pose floor share those rules and neither is moving. The id
selector also outranks the justify-self:start/end pair above without
needing them touched, so they stay in place for any other four-up floor.

THE 320. Given for 1920, so it is written as vw and clamped: 16.7vw is
320.6 at 1920. A fixed 320px would be a third of the floor on a laptop and
a postage stamp at 2560, and the room is meant to hold at 2550. The clamp
floors at 240 and ceilings at 420 -- both a guess at the ends of a range
Rich has not seen yet, and both one number to change.

WHAT IS NOT TOUCHED. --card-ratio, so the cards keep whatever shape the
room already gives them. Rich ruled 21 August that Pets does not need
square; this patch has no opinion either way and inherits.

SCOPE. #siloFloor[data-count="4"] only. Groups is the only room with four
silos today. Pets and Halloween each have one, so their floors are
untouched -- and a one-card silo stage is arguably a stage that should not
exist at all, which is a separate ruling.
"""

import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DOWNLOADS = os.path.join(
    os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Downloads')

ANCHOR = """/* a room with fewer than eight keeps the second row's height — the empty
   space is intentional, not a collapse. */"""

NEW = """/* a room with fewer than eight keeps the second row's height — the empty
   space is intentional, not a collapse. */

/* ---- FOUR SILOS LAY 2x2, CENTRED --------------------------------------
   Rich, 21 August, from a mockup. Four silos were filling one row of the
   eight-column grid and reaching both edges, which left the whole second
   row empty and held each card to about 280 at 1920.

   Scoped to the silo floor by id on purpose. The effects floor and the
   pose floor share every .floor rule above and neither is moving, and the
   id also outranks the justify-self:start/end pair for data-count="4"
   without those needing to be edited -- they stay correct for any other
   four-up floor.

   THE WIDTH. 320 at 1920, given. Written as vw so the room still holds at
   2550, where a fixed 320 would be a postage stamp. 16.7vw is 320.6 at
   1920. The two ends of the clamp are a guess at a range not yet seen and
   are the numbers to change. */
:root{ --silo-w:clamp(240px, 16.7vw, 420px); }

#siloFloor[data-count="4"]{
  grid-template-columns:repeat(2, var(--silo-w));
  grid-template-rows:repeat(2, auto);
  justify-content:center;
  align-content:center;
}
#siloFloor[data-count="4"] > *{
  /* auto, not `auto / span 2` -- the columns are now the card width
     rather than eighths of the floor, so a span of two would take both. */
  grid-column:auto;
  justify-self:stretch;
  width:var(--silo-w);
}"""


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
        ('not already applied', '#siloFloor[data-count="4"]' not in text),
        ('--silo-w not already taken', '--silo-w:' not in text),
    ]
    for label, ok in checks:
        print('  %-28s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in checks):
        sys.exit('\nNOTHING WRITTEN.')

    # The markup carries data-count as an attribute AND the renderer sets
    # it. Read what the file actually ships with rather than assume four.
    import re
    m = re.search(r'id="siloFloor" data-count="(\d+)"', text)
    shipped = m.group(1) if m else '?'
    print('\n  siloFloor ships with data-count="%s"' % shipped)
    if shipped != '4':
        print('  NOTE: the rule only fires at 4. The renderer rewrites this')
        print('  attribute from the registry, so check the room really has')
        print('  four silos before expecting to see any change.')

    text = text.replace(ANCHOR, NEW, 1)

    print('\nverifying result:')
    post = [
        ('2x2 rule present', '#siloFloor[data-count="4"]{' in text),
        ('card width variable set', '--silo-w:clamp(240px' in text),
        ('span override present',
         '#siloFloor[data-count="4"] > *{' in text),
        ('generic floor rules intact',
         '.floor[data-count="4"] > :nth-child(1),' in text),
        ('card ratio untouched', '--card-ratio' in text),
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
