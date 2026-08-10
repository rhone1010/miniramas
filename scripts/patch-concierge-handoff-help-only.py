#!/usr/bin/env python3
# scripts/patch-concierge-handoff-help-only.py
#
# THE MESSAGE BOX BELONGS ON /help AND NOWHERE ELSE.
#
# concierge.js now takes data-handoff on its script tag, and offers to
# take a message only where that attribute is present, and only after she
# has genuinely had three goes at answering. Without it she answers
# questions and points at the room, which is what somebody in the middle
# of a craft actually wants.
#
# So: /help opts in. The workshop and the gallery do not.
#
#   python scripts/patch-concierge-handoff-help-only.py            (dry run)
#   python scripts/patch-concierge-handoff-help-only.py --write

import io
import os
import sys

TARGET = os.path.join('public', 'help.html')

ANCHOR = '<script src="/concierge.js" defer></script>'
NEW = '<script src="/concierge.js" defer data-handoff></script>'


def main():
    write = '--write' in sys.argv

    if not os.path.exists(TARGET):
        print('NOT FOUND: %s  (run from the repo root)' % TARGET)
        return 1

    with io.open(TARGET, 'r', encoding='utf-8', newline='') as fh:
        src = fh.read()

    if 'data-handoff' in src:
        print('Already patched. Nothing to do.')
        return 0

    n = src.count(ANCHOR)
    if n != 1:
        print('ANCHOR expected 1, found %d. Nothing written.' % n)
        return 1
    print('anchor ok')

    out = src.replace(ANCHOR, NEW, 1)

    if '\n' in out.replace('\r\n', ''):
        print('BARE NEWLINE INTRODUCED. Nothing written.')
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
