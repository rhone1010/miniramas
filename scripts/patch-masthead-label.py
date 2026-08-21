#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-masthead-label.py  --  the masthead says which room you are in.

    python scripts\\patch-masthead-label.py public\\pets.html
    python scripts\\patch-masthead-label.py public\\pets.html --apply

Dry run by default. Output to %USERPROFILE%\\Downloads\\<leafname>; install
with Install-File.ps1.

WHY. build-pets-page.py and build-halloween-page.py changed the <title> and
left #mhSeriesLabel alone, so both new rooms wear the Portraits name at the
top of every screen. Mine, and it should have been in the clone.

Read off the live files, 21 August:

  portraits.html              Crafted Portraits    correct
  groups.html                 Crafted Groups       correct
  halloween.html              Crafted Portraits    WRONG
  pets.html                   (to be read)
  community.html              Crafted Portraits    WRONG, and see below

  gallery.html                no label
  wallpapers.html             no label
  wallpaper-studio-V002.html  no label

The last three carry a different masthead with no Series name in it. They
are not in ROOMS and this script refuses them rather than inventing a slot.

COMMUNITY IS NOT A ROOM. It says "Crafted Portraits" today, which is simply
wrong -- the board holds work from every Series. But what it SHOULD say is
a question for Rich, not a default to pick here: the label doubles as the
dropdown's own button, so it cannot just be emptied. Left alone
deliberately. Raised, not fixed.

THE MARKUP. The label carries an inner span:

    <span id="mhSeriesLabel"><span class="mh-crafted">Crafted </span>Pets</span>

"Crafted " is separate because a media query hides it on narrow screens --
#mhSeriesLabel .mh-crafted { display:none }. The word disappears and the
Series name stays. Keep the span; a flat string breaks that quietly and the
only symptom is a masthead that overflows on a phone.
"""

import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DOWNLOADS = os.path.join(
    os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Downloads')

ROOMS = {
    'pets.html':      'Pets',
    'halloween.html': 'Halloween',
    'portraits.html': 'Portraits',
    'groups.html':    'Groups',
}


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
        sys.exit('FAIL: %s is not a room with a Series label. Known: %s'
                 % (leaf, ', '.join(sorted(ROOMS))))
    want = ROOMS[leaf]

    with open(path, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')

    print('file   : %s  (%d bytes, %s)' % (path, len(raw), 'CRLF' if crlf else 'LF'))

    m = re.search(r'(<span id="mhSeriesLabel">)(.*?)(</span>)\s*<svg', text, re.S)
    print('\nchecking:')
    print('  %-28s %s' % ('label found', 'ok' if m else 'FAIL'))
    if not m:
        sys.exit('\nNOTHING WRITTEN. No #mhSeriesLabel in this file, or its '
                 'markup has drifted. Read it before scripting it.')

    inner = m.group(2)
    print('  reads   : %s' % re.sub(r'<[^>]+>', '', inner))
    print('  should  : Crafted %s' % want)

    has_span = 'mh-crafted' in inner
    print('  %-28s %s' % ('narrow-screen span intact',
                          'ok' if has_span else 'FAIL'))
    if not has_span:
        sys.exit('\nNOTHING WRITTEN. The mh-crafted span is gone, which means '
                 'this label has already been rewritten by something else.')

    if re.sub(r'<[^>]+>', '', inner).strip() == 'Crafted %s' % want:
        print('\nAlready correct. Nothing to do.')
        return

    new_inner = '<span class="mh-crafted">Crafted </span>%s' % want
    text = text[:m.start(2)] + new_inner + text[m.end(2):]

    print('\nverifying result:')
    post = [
        ('label reads the room',
         '<span id="mhSeriesLabel"><span class="mh-crafted">Crafted </span>%s</span>'
         % want in text),
        ('only one label', text.count('id="mhSeriesLabel"') == 1),
        ('the hide rule still exists',
         '#mhSeriesLabel .mh-crafted{ display:none }' in text),
        ('page length unchanged but for the name',
         abs(len(text) - len(raw.replace('\r\n', '\n'))) < 40),
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
