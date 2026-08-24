#!/usr/bin/env python3
"""
patch-groups-cut-skin-keylight.py

Cuts two sentences out of five bodies in lib/v1/groups/groups-effects.ts.

WHY
  Both are single-subject Portraits language that leaked into Groups.

  "Clear the skin - blemishes, spots and blotchiness go."
      Directly contradicts the likeness clause, which asks to maintain
      imperfections. An instruction to remove the marks that make a face
      that face is the opposite of the thing Groups is failing at.

  "Flattering soft key light, shadow separating jaw from neck."
      A lighting note written for one head at one distance. In a group it
      describes a setup that cannot exist for eight people at once, and it
      fights the light the effect's own paragraph establishes.

  Rich cut both from `neon` in Portraits on 22 August for the same reason.
  Confirmed for Groups 23 August. WHOLE SENTENCES, including "shadow
  separating jaw from neck" - half a sentence is not prose, and that clause
  is single-subject language too.

BODIES TOUCHED
  bronze        Clear the skin          (EM DASH variant)
  renaissance   both
  wild_west     both
  neon          key light
  sea_glass     Clear the skin

  bronze uses an em dash where the others use a hyphen, so it is matched
  separately rather than by one loose pattern.

DISCIPLINE
  - Dry run by default. --write to actually write.
  - Every anchor must match EXACTLY ONCE or nothing is written.
  - Post-write assertion: cut text absent, expected length delta, body
    count unchanged.
  - Reads and writes with newline='' so CRLF is preserved byte for byte.
    groups-effects.ts is CRLF; Python's default text mode would silently
    rewrite every line in the file.

USAGE
  python scripts/patch-groups-cut-skin-keylight.py
  python scripts/patch-groups-cut-skin-keylight.py --write
"""

import re
import sys
import os

PATH = os.path.join('lib', 'v1', 'groups', 'groups-effects.ts')

# Leading space is included so the cut does not leave a double space behind.
# Each cut is the EXACT byte span to remove, including the whitespace that
# joins it to its neighbours - so the sentence either side closes up cleanly
# with no double space and no orphaned line.
#
# renaissance and wild_west carry BOTH sentences adjacent and starting a
# line, so they are cut as one span ending before "Keep permanent". bronze
# uses an EM DASH where every other body uses a hyphen.
CUTS = [
    ('bronze',
     ' Clear the skin \u2014 blemishes, spots and blotchiness go.'),
    ('renaissance',
     'Flattering soft key light, shadow separating jaw from neck.'
     ' Clear the skin - blemishes, spots and blotchiness go. '),
    ('wild_west',
     'Flattering soft key light, shadow separating jaw from neck.'
     ' Clear the skin - blemishes, spots and blotchiness go. '),
    ('neon',
     ' Flattering soft key light, shadow separating jaw from neck.'),
    ('sea_glass',
     ' Clear the skin - blemishes, spots and blotchiness go.'),
]


def body_of(src, key):
    m = re.search(r'^  ' + key + r': \{(.*?)^  \},', src, re.M | re.S)
    if not m:
        raise SystemExit(f'REFUSED: effect "{key}" not found in {PATH}')
    return m


def main():
    write = '--write' in sys.argv

    if not os.path.exists(PATH):
        raise SystemExit(f'REFUSED: {PATH} not found. Run from the repo root.')

    with open(PATH, 'r', encoding='utf-8', newline='') as f:
        src = f.read()

    before_len = len(src)
    before_bodies = len(re.findall(r'^  [a-z_0-9]+: \{', src, re.M))
    crlf_before = src.count('\r\n')

    # ── PRE-WRITE ASSERTIONS ────────────────────────────────────────────
    # Every anchor must appear exactly once inside its OWN body. Checking
    # against the whole file would pass on a sentence that lives somewhere
    # else, and cut the wrong one.
    for key, text in CUTS:
        m = body_of(src, key)
        n = m.group(1).count(text)
        if n != 1:
            raise SystemExit(
                f'REFUSED: "{text[:40]}..." appears {n} times in body "{key}", expected exactly 1.\n'
                f'Nothing written. The file has probably changed since this patch was written.'
            )

    print(f'  {PATH}')
    print(f'  {before_bodies} bodies, {before_len} bytes, {crlf_before} CRLF line endings')
    print('')

    # ── APPLY, SCOPED TO EACH BODY ──────────────────────────────────────
    out = src
    expected_delta = 0

    for key, text in CUTS:
        m = body_of(out, key)
        start, end = m.span(1)
        body = m.group(1)
        patched = body.replace(text, '', 1)
        out = out[:start] + patched + out[end:]
        expected_delta += len(text)
        print(f'  cut from {key:14} {text.strip()[:58]}')

    # ── POST-WRITE ASSERTIONS ───────────────────────────────────────────
    for key, text in CUTS:
        if text in body_of(out, key).group(1):
            raise SystemExit(f'REFUSED: cut text still present in "{key}". Nothing written.')

    if len(out) != before_len - expected_delta:
        raise SystemExit(
            f'REFUSED: length delta is {before_len - len(out)}, expected {expected_delta}. '
            f'Nothing written.'
        )

    after_bodies = len(re.findall(r'^  [a-z_0-9]+: \{', out, re.M))
    if after_bodies != before_bodies:
        raise SystemExit(
            f'REFUSED: body count changed {before_bodies} -> {after_bodies}. Nothing written.'
        )

    if out.count('\r\n') != crlf_before:
        raise SystemExit(
            f'REFUSED: CRLF count changed {crlf_before} -> {out.count("\r\n")}. Nothing written.'
        )

    print('')
    print(f'  {len(CUTS)} cuts, -{expected_delta} bytes, body count and line endings unchanged')

    if not write:
        print('')
        print('  DRY RUN. Nothing written. Re-run with --write.')
        return

    with open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(out)

    print('')
    print(f'  WRITTEN. {PATH} is now {len(out)} bytes.')


if __name__ == '__main__':
    main()
