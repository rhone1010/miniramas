#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-gate-and-pose.py  --  the credits loop, and Halloween's phantom
second step.

    python scripts\\patch-gate-and-pose.py public\\halloween.html
    python scripts\\patch-gate-and-pose.py public\\halloween.html --apply

Run against portraits, pets, groups, halloween and pets-halloween. Each fix
is skipped where it does not apply and the script says which it made.

Dry run by default. Output to %USERPROFILE%\\Downloads\\<leafname>; install
with Install-File.ps1.


FIX 1 -- THE CREDITS LOOP. THE CAUSE.  pets, halloween, pets-halloween

Reported by Rich on /halloween: a five-effect craft, 537 credits in hand,
50 needed, and the buy-credits panel opens. Press Craft again, it opens
again. No way through.

The gate call sends a hard-coded series:

    body: JSON.stringify({
      count:    items.length,
      cost_per: CREDITS_PER_IMAGE,
      series:   'portraits',
      presets:  items.map(...)

Groups repointed this on day one. THE CLONES DID NOT -- so Pets, Halloween
and Pets Halloween all tell the credits gate they are Portraits, and then
hand it presets from their own catalogue. The gate checks the presets
against the series it was given, finds none of them, and refuses. Correctly.

This is the FOURTH hard-coded series name in these files. The carryover
named openWaiting and savePiece; land() was found by an assertion this
morning; this one is inside a fetch body, which is why nothing greping for
the obvious shapes caught it.

  pets              -> 'pets'
  halloween         -> 'halloween'
  pets-halloween    -> 'pets'      (its pieces file under Pets; the gate
                                    should agree with the collection)
  portraits, groups   already correct, skipped


FIX 2 -- THE LOOP HAS NO EXIT.  every room

    if (!data.ok){
      ...
      window.__openPaywall({ needed: ..., balance: ..., reason: data.reason });

ANY refusal opens the shop. A refusal about presets, about a malformed
request, about the gate being unreachable -- all of them produce a panel
saying "This craft needs 50 credits. Your balance is 537. Your pieces are
held while you decide", which is three sentences and the first two
contradict each other in front of the customer.

This is the open item the V30 carryover describes exactly: "a gate refusal
for ANY reason opens the credits panel and says your pieces are held while
you decide -- so a refusal about counting faces reads as a refusal about
money." It has been open since 20 August and this is the first time it has
been seen doing harm.

The fix: open the shop only when the balance is actually short. Any other
refusal says so on the rail and leaves the shop shut. Fix 1 removes the
cause; this removes the class.


FIX 3 -- HALLOWEEN'S SECOND STEP HAS NOTHING IN IT.  halloween only

The button reads "Craft all 5 / STEP 2 OF 2" and the crumb reads "Step 2 -
the pose". There is no pose floor: CENG's registry says poses is empty for
this room and the header says, in bold, DO NOT BUILD A POSE FLOOR FOR THIS
ROOM -- the bodies stage themselves and the route carries no pose field.

Mine. build-halloween-page.py kept the pose step and I flagged it at the
time as the one thing that differed from the Pets clone; Rich dropped the
pose in Halloween the same day and the page was never brought back in line.

So the room has a second step that draws an empty floor. Removed the same
way the Pets clone did it -- the click runs the craft instead of opening
poses, and the button stops promising a step that does not exist. Both
halves or neither: Groups shipped with the handler short-circuited and the
button still saying "choose a pose", which charged the customer under a
sentence that was not true.
"""

import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DOWNLOADS = os.path.join(
    os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Downloads')

GATE_SERIES = {
    'pets.html': 'pets',
    'halloween.html': 'halloween',
    'pets-halloween.html': 'pets',
}
POSE_ROOMS = ('halloween.html',)
ALL = ('portraits.html', 'pets.html', 'groups.html', 'halloween.html',
       'pets-halloween.html')

OLD_GATE = """        count:    items.length,
        cost_per: CREDITS_PER_IMAGE,
        series:   'portraits',"""

# The refund body. Same hard-coded series, found by reading the output of
# the gate fix rather than by looking - a failed craft in a clone was asking
# the refund route to reverse a Portraits charge that was never made under
# that name.
OLD_REFUND = """      count:    items.length,
      cost_per: CREDITS_PER_IMAGE,
      ref_id:   ref,
      series:   'portraits',"""

OLD_REFUSE = """      if (!data.ok){
        var needed = data.needed != null ? data.needed : items.length * CREDITS_PER_IMAGE;
        if (!quiet){
          if (typeof window.__openPaywall === 'function'){
            window.__openPaywall({ needed: needed, balance: data.balance || 0, reason: data.reason });
          }
          creditsNotice(data.reason, data.balance || 0, needed);
        }
        return false;
      }"""

NEW_REFUSE = """      if (!data.ok){
        var needed = data.needed != null ? data.needed : items.length * CREDITS_PER_IMAGE;
        if (!quiet){
          /* THE SHOP OPENS FOR A SHORTFALL AND NOTHING ELSE. It used to open
             on any refusal at all, so a gate saying no for a reason that had
             nothing to do with money produced a panel reading "this craft
             needs 50 credits, your balance is 537, your pieces are held while
             you decide" -- two sentences that contradict each other, and no
             way out except pressing Craft again and seeing it a second time.

             Reported on /halloween 21 August with 537 credits in hand. The
             cause there was a wrong series in the gate body, fixed above; this
             is the class of fault rather than that one instance. */
          var balance = data.balance || 0;
          var short   = data.reason === 'insufficient' ||
                        data.reason === 'insufficient_credits' ||
                        (typeof data.balance === 'number' && data.balance < needed);
          if (short && typeof window.__openPaywall === 'function'){
            window.__openPaywall({ needed: needed, balance: balance, reason: data.reason });
          }
          creditsNotice(data.reason, balance, needed);
        }
        return false;
      }"""

OLD_POSE_CLICK = """      window.__runAll();
    } else {
      openPoses();
    }
  });"""

NEW_POSE_CLICK = """      window.__runAll();
    } else {
      /* Was openPoses(). This room has no poses -- the registry says so and
         the route carries no pose field -- so the second step drew an empty
         floor and the craft could not be reached through it. Ruled by Rich
         21 August; the page was never brought back in line. */
      window.__runAll();
    }
  });"""

OLD_POSE_LABEL = """    } else {
      tbcGoVerb.textContent = 'Next';
      tbcGoN.textContent    = '\\u00b7 choose a pose';
      tbcGoSub.textContent  = 'Step 1 of 2 \\u00b7 ' + credits;
    }"""

NEW_POSE_LABEL = """    } else {
      /* One step in this room. The button used to promise a second and then
         charge -- both halves of a removed step or neither. */
      tbcGoVerb.textContent = 'Craft';
      tbcGoN.textContent    = n === 1 ? 'this piece' : ('all ' + n);
      tbcGoSub.textContent  = credits;
    }"""

OLD_POSE_STEP2 = """      tbcGoVerb.textContent = 'Craft';
      tbcGoN.textContent    = n === 1 ? 'this piece' : ('all ' + n);
      tbcGoSub.textContent  = 'Step 2 of 2 \\u00b7 ' + credits;"""

NEW_POSE_STEP2 = """      tbcGoVerb.textContent = 'Craft';
      tbcGoN.textContent    = n === 1 ? 'this piece' : ('all ' + n);
      tbcGoSub.textContent  = credits;   /* no step count - there is one */"""


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
    if leaf not in ALL:
        sys.exit('FAIL: %s is not a room. Known: %s' % (leaf, ', '.join(ALL)))

    with open(path, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')
    start_len = len(text)

    print('file   : %s  (%d bytes, %s)' % (path, len(raw), 'CRLF' if crlf else 'LF'))

    edits = []

    if leaf in GATE_SERIES:
        want = GATE_SERIES[leaf]
        if OLD_GATE in text:
            print('\nfix 1  : gate series -> %s' % want)
            edits.append((
                'gate series', OLD_GATE,
                "        count:    items.length,\n"
                "        cost_per: CREDITS_PER_IMAGE,\n"
                "        /* Was 'portraits', inherited from the clone. The gate checks\n"
                "           the presets against the series it is given, so this room was\n"
                "           handing its own presets to the Portraits catalogue and being\n"
                "           refused - which then opened the shop. */\n"
                "        series:   '%s'," % want))
        else:
            print('\nfix 1  : skipped - gate series already set')
        if OLD_REFUND in text:
            print('         and the refund body')
            edits.append((
                'refund series', OLD_REFUND,
                "      count:    items.length,\n"
                "      cost_per: CREDITS_PER_IMAGE,\n"
                "      ref_id:   ref,\n"
                "      /* Was 'portraits' too. A failed craft here was asking the refund\n"
                "         route to reverse a charge under a series it was never made\n"
                "         under - so the money would not have come back. */\n"
                "      series:   '%s'," % want))
    else:
        print('\nfix 1  : skipped - %s already names its own series' % leaf)

    # Groups computes its cost per image rather than reading a constant --
    # banded pricing -- so its version of this block differs by one word.
    # Same bug, same fix; matched rather than assumed identical.
    refuse_variants = [
        (OLD_REFUSE, NEW_REFUSE),
        (OLD_REFUSE.replace('CREDITS_PER_IMAGE', 'creditsPerImage()'),
         NEW_REFUSE.replace('CREDITS_PER_IMAGE', 'creditsPerImage()')),
    ]
    for old, new in refuse_variants:
        if old in text:
            print('fix 2  : the shop opens only for a shortfall')
            edits.append(('refusal opens the shop', old, new))
            break
    else:
        print('fix 2  : skipped - already applied, or this room has drifted')

    if leaf in POSE_ROOMS:
        if OLD_POSE_CLICK in text:
            print('fix 3  : the pose step comes out')
            edits.append(('pose click', OLD_POSE_CLICK, NEW_POSE_CLICK))
            edits.append(('pose label', OLD_POSE_LABEL, NEW_POSE_LABEL))
            edits.append(('step 2 label', OLD_POSE_STEP2, NEW_POSE_STEP2))
        else:
            print('fix 3  : skipped - already applied')
    else:
        print('fix 3  : skipped - %s has no phantom pose step' % leaf)

    if not edits:
        print('\nNothing to do here.')
        return

    print('\nchecking anchors:')
    bad = []
    for label, old, new in edits:
        found = text.count(old)
        ok = found == 1
        print('  %-24s %s  (found %d, expected 1)' %
              (label, 'ok ' if ok else 'FAIL', found))
        if not ok:
            bad.append(label)
    if bad:
        print('\nNOTHING WRITTEN. Failed: %s' % ', '.join(bad))
        sys.exit(1)

    for label, old, new in edits:
        text = text.replace(old, new, 1)

    print('\nverifying result:')
    checks = [
        ('shop gated on a shortfall', 'if (short && typeof window.__openPaywall' in text),
        ('the notice still always fires', 'creditsNotice(data.reason' in text),
        ('file did not collapse', len(text) > start_len * 0.9),
    ]
    if leaf in GATE_SERIES:
        checks.append(("gate names %s" % GATE_SERIES[leaf],
                       "series:   '%s'," % GATE_SERIES[leaf] in text))
        checks.append(('no portraits left in the gate body',
                       "cost_per: CREDITS_PER_IMAGE,\n        series:   'portraits'," not in text))
        checks.append(('no portraits left in the refund body',
                       "ref_id:   ref,\n      series:   'portraits'," not in text))
    if leaf in POSE_ROOMS:
        checks.append(('no pose step promised', 'choose a pose' not in text))
        checks.append(('no step count', 'Step 1 of 2' not in text and
                       'Step 2 of 2' not in text))
        checks.append(('openPoses no longer called',
                       len(re.findall(r'^\s+openPoses\(\);', text, re.M)) == 0))
    for label, ok in checks:
        print('  %-34s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in checks):
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
