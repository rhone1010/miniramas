#!/usr/bin/env python3
"""
patch-invite-grant-50.py

The launch grant drops from 80 credits to 50.

Rich, 24 August: "i am thinking 50 credits to open. Its not that we are
doing free in and of itself. its more i want people to consider the value."

Five crafts at ten credits: enough to feel the product, few enough that a
craft feels spent.

-- WHO GETS WHAT AFTER THIS RUNS -------------------------------------------

The grant is written onto the launch_invites row at invite time and claimed
at first sign-in, so:

  already invited, already claimed   keep their 80. Spent or sitting in a
                                     balance; nothing here reaches back.
  already invited, not yet claimed   keep the 80 on their row. Their claim
                                     pays what their row says, and repricing
                                     a promise already made is not this
                                     patch's call.
  invited after this deploys         get 50.

If Rich wants the unclaimed 80s repriced to 50, that is one UPDATE against
launch_invites where claimed_at is null - deliberately not done here.

-- DISCIPLINE ---------------------------------------------------------------
  Dry run by default. --write to write.
  Both anchors must match exactly once.
  Line ending read off the file, never assumed.

USAGE
  python scripts/patch-invite-grant-50.py
  python scripts/patch-invite-grant-50.py --write
"""

import os
import sys

PATH = os.path.join('app', 'api', 'v1', 'invite', 'route.ts')

OLD_CONST = "const GRANT_CREDITS = 80    // eight crafts at ten credits each"
NEW_CONST = "const GRANT_CREDITS = 50    // five crafts at ten credits each"

# The header narrates the grant; a header that says 80 over a constant that
# says 50 is the kind of lie that outlives everyone's memory of this patch.
OLD_HDR = "//   2. Hold the 80-credit launch grant against it, so that when the person"
NEW_HDR = "//   2. Hold the 50-credit launch grant against it, so that when the person"


def main():
    write = '--write' in sys.argv

    if not os.path.exists(PATH):
        raise SystemExit('REFUSED: %s not found. Run from the repo root of the CENG worktree.' % PATH)

    with open(PATH, 'r', encoding='utf-8', newline='') as f:
        src = f.read()

    before_len = len(src)

    for name, anchor in (('constant', OLD_CONST), ('header', OLD_HDR)):
        n = src.count(anchor)
        if n != 1:
            raise SystemExit(
                'REFUSED: %s anchor appears %d times, expected 1. Nothing written.' % (name, n))

    out = src.replace(OLD_CONST, NEW_CONST, 1).replace(OLD_HDR, NEW_HDR, 1)

    if out.count('GRANT_CREDITS = 50') != 1 or 'GRANT_CREDITS = 80' in out:
        raise SystemExit('REFUSED: constant not changed cleanly. Nothing written.')
    if '80-credit' in out:
        raise SystemExit('REFUSED: an 80-credit mention survives. Nothing written.')
    # "80" -> "50" is same length; "eight" -> "five" is one byte shorter.
    # The first version of this check asserted zero change and refused its
    # own correct edit.
    if len(out) != before_len - 1:
        raise SystemExit('REFUSED: byte count moved by %d, expected -1. Nothing written.'
                         % (len(out) - before_len))

    print('  %s' % PATH)
    print('  GRANT_CREDITS 80 -> 50, header updated, %d bytes unchanged' % before_len)

    if not write:
        print('')
        print('  DRY RUN. Nothing written. Re-run with --write.')
        return

    with open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(out)

    print('')
    print('  WRITTEN.')
    print('  Verify: findstr /N /C:"GRANT_CREDITS" app\\api\\v1\\invite\\route.ts')


if __name__ == '__main__':
    main()
