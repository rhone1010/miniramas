#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-credits-return.py  --  the queue survives a credits purchase.

    python scripts\\patch-credits-return.py public\\portraits.html
    python scripts\\patch-credits-return.py public\\portraits.html --apply

Run it against every room. Dry run by default; nothing is written if an
assertion fails. Output goes to %USERPROFILE%\\Downloads\\<leafname>, and
Install-File.ps1 puts it back so the version it replaces is archived.

THE FAULT, confirmed on /groups 21 August 2026.

  beginPurchase sends the bare path as its returnUrl:

      returnUrl: location.origin + location.pathname

  and nothing downstream adds anything to it. Stripe therefore returns the
  customer to /groups with no query string at all.

  afterPurchase is the function that puts their work back, and its first
  line is:

      if (location.search.indexOf('credits=1') < 0) return;

  So it returns immediately. restoreResume() is never called. The queue,
  the pose and the photograph are all still sitting in localStorage and
  nobody reads them. The customer pays, lands on an empty floor, and has
  to choose every effect again -- at the exact moment they have just
  decided to spend money.

  printCheckout, thirty lines further down the same file, already does
  this correctly:

      successUrl: back + '?print=1&session={CHECKOUT_SESSION_ID}'

  This patch makes the credits path match it. One line.

WHAT ELSE IS IN HERE

  2. RESUME_KEY is 'liten_resume_v1' in every room, so Portraits, Groups,
     Pets and Halloween share one localStorage slot. Buy credits in Groups
     with a queue held, open Portraits within two hours, and Portraits
     restores the Groups queue -- or drops it, since R.byId() will not know
     the ids. The key gets the room's name appended.

     This is deliberately a SEPARATE flag. Changing the key orphans
     anything already held under the old one, so a customer mid-purchase
     when this deploys loses the very thing the first fix protects. Ship
     fix 1 alone, then this a day later.

  3. restoreResume() calls clearResume() unconditionally, so the saved
     copy is consumed even when the photograph was too large for
     localStorage and only the effects came back. The customer is then
     asked for the photograph -- and if they close the tab instead, the
     effects are gone too. Held under --keep-on-partial for the same
     reason: it is a behaviour change, not a repair.
"""

import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DOWNLOADS = os.path.join(
    os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Downloads')

OLD_RETURN = "          returnUrl: location.origin + location.pathname"

NEW_RETURN = """          /* THE FLAG TRAVELS WITH THEM. Was the bare path, and
             afterPurchase's first line is a test for credits=1 -- so it
             returned immediately, restoreResume() never ran, and a
             customer who had just paid landed on an empty floor with
             their queue still sitting in localStorage unread.
             printCheckout below has always done this correctly. */
          returnUrl: location.origin + location.pathname + '?credits=1'"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('target', help='e.g. public\\portraits.html')
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--room-key', action='store_true',
                    help='fix 2: give each room its own resume key')
    ap.add_argument('--keep-on-partial', action='store_true',
                    help='fix 3: do not consume the resume on a partial restore')
    args = ap.parse_args()

    target = args.target.replace('/', os.sep).replace('\\', os.sep)
    path = target if os.path.isabs(target) else os.path.join(REPO, target)
    if not os.path.isfile(path):
        sys.exit('FAIL: no file at %s' % path)

    leaf = os.path.basename(path)
    room = os.path.splitext(leaf)[0]
    out = os.path.join(DOWNLOADS, leaf)

    with open(path, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')
    start_len = len(text)

    print('file   : %s  (%d bytes, %s)' % (path, len(raw), 'CRLF' if crlf else 'LF'))
    print('room   : %s' % room)

    edits = [('credits returnUrl', OLD_RETURN, NEW_RETURN, 1)]

    if args.room_key:
        m = re.search(r"  var RESUME_KEY      = '([a-z0-9_]+)';", text)
        if not m:
            sys.exit('FAIL: RESUME_KEY not found in its expected shape.')
        edits.append((
            'RESUME_KEY per room',
            m.group(0),
            "  /* Per room. Was one key for all of them, so a queue held in one\n"
            "     Series was offered to another, whose registry does not know the\n"
            "     ids and silently drops them. */\n"
            "  var RESUME_KEY      = '%s_%s';" % (m.group(1), room),
            1))

    if args.keep_on_partial:
        old = """    clearResume();

    if (!img && QUEUE.length){"""
        new = """    /* Only once the work is actually back. Was unconditional, which
       consumed the saved copy even when the photograph had been too large
       to hold -- so a customer who closed the tab rather than choosing a
       photograph again lost the effects as well. */
    if (img) clearResume();

    if (!img && QUEUE.length){"""
        edits.append(('keep resume on partial', old, new, 1))

    print('\nchecking anchors:')
    bad = []
    for label, old, new, n in edits:
        found = text.count(old)
        ok = found == n
        print('  %-24s %s  (found %d, expected %d)' %
              (label, 'ok ' if ok else 'FAIL', found, n))
        if not ok:
            bad.append(label)

    if bad:
        print('\nNOTHING WRITTEN. Failed: %s' % ', '.join(bad))
        print('This room may have drifted. Read it before forcing anything.')
        sys.exit(1)

    for label, old, new, n in edits:
        text = text.replace(old, new, n)

    print('\nverifying result:')
    checks = [
        ("returnUrl carries the flag", "location.pathname + '?credits=1'" in text),
        ("afterPurchase test intact",
         "location.search.indexOf('credits=1') < 0" in text),
        # Whole-line, because the replacement CONTAINS the old text as its
        # prefix -- an `in` test here can never pass and would block every run.
        ("no bare returnUrl left",
         not any(ln.rstrip() == OLD_RETURN.rstrip() for ln in text.split('\n'))),
        ("printCheckout untouched",
         "'?print=1&session={CHECKOUT_SESSION_ID}'" in text),
        ("file did not collapse", len(text) > start_len * 0.9),
    ]
    for label, ok in checks:
        print('  %-30s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in checks):
        sys.exit('\nNOTHING WRITTEN. Post-write verification failed.')

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
