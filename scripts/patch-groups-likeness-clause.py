#!/usr/bin/env python3
"""
patch-groups-likeness-clause.py

Installs Rich's composite likeness clause into FOUR bodies in
lib/v1/groups/groups-effects.ts: victorian, persian_court, renaissance,
wild_west.

WHY FOUR AND NOT TWENTY-EIGHT
  This is a test, not a sweep. Rich's rule stands - bespoke bodies stay
  bespoke, and adding a thousand characters to every body risks the
  redundancy failure that is the dominant one in this project. Four bodies
  on one subject tells us whether the clause earns its length before it
  touches the other twenty-four.

REPLACE, NOT APPEND
  All four already ended with likeness language, so appending would leave
  two likeness passages in one prompt saying overlapping things in
  different words. The existing passage is removed and the clause takes its
  place, LAST in the body - later instruction wins, which is the whole
  reason position was chosen.

  What goes, and it is worth knowing what was lost:
    victorian      "Refine temporary skin imperfections without changing
                   anyone's identity" - a softer "Clear the skin", and it
                   contradicts the clause's instruction to maintain
                   imperfections. Good riddance.
    renaissance    "Add nothing that is not in the source" - a real
                   instruction, and the clause does not carry an equivalent.
    wild_west      same.
  If the run comes back worse on invention rather than likeness, that
  sentence is the first thing to put back.

TWO ADAPTATIONS, FLAGGED
  Rich approved the clause "adapted" on 23 August. Two changes were needed
  and neither is cosmetic:

  1. "COMES BEFORE THE MATERIAL" -> "COMES BEFORE THE STYLING".
     The clause was written for material effects - bronze, marble. These
     four are costume and period effects and have no material.

  2. The hair sentence was rewritten. VERBATIM IT WOULD HAVE BROKEN THESE
     FOUR EFFECTS. The original says to keep each person's hairstyle
     "exactly as photographed", and it sits LAST, so it wins - against
     victorian's "hair pinned with soft curls" and wild_west's "hair pinned
     up but loosening". The clause would have cancelled the period
     hairstyling the effect exists to produce.

     What it now says: colour, density, hairline and length are theirs and
     may not be invented, lengthened, thickened or lowered - but period
     arrangement may restyle what is there. That keeps the part that
     protects likeness and drops the part that fought the effect.

     ON A MATERIAL BODY THE ORIGINAL SENTENCE IS CORRECT AND SHOULD BE USED
     UNCHANGED. Do not carry this adaptation into bronze or sea_glass.

DISCIPLINE
  - Dry run by default. --write to write.
  - Every anchor must match exactly once inside its own body.
  - Post-write: clause present exactly once per body, old text absent,
    body count and CRLF count unchanged.
  - newline='' throughout. This file is CRLF and Python's text mode would
    silently rewrite all 547 line endings.

USAGE
  python scripts/patch-groups-likeness-clause.py
  python scripts/patch-groups-likeness-clause.py --write
"""

import re
import sys
import os

PATH = os.path.join('lib', 'v1', 'groups', 'groups-effects.ts')

CRLF = '\r\n'

# ── THE CLAUSE ─────────────────────────────────────────────────────────
# Rich's text. Adapted only where noted in the header above.
CLAUSE = CRLF.join([
    'LIKENESS IS ESSENTIAL AND COMES BEFORE THE STYLING. Every face is the '
    'specific person from the source photograph, never a type and never an '
    'average of the group.',

    'For each person, maintain micro facial gestures, imperfections, changes '
    'in symmetry - all the characteristics that make this person this person. '
    'Keep the shape and character of their face, their natural asymmetry, '
    'their real weight and build, and the set of their mouth.',

    "Hair is theirs. Keep each person's hairline, hair density, length and "
    'COLOUR as photographed. Period arrangement may restyle the hair they '
    'have, but do not invent hair they do not have, do not lengthen or '
    'thicken it, do not lower a hairline, and do not prematurely grey anyone. '
    'Facial-hair density stays exact: stubble remains stubble; never invent a '
    'beard or moustache.',

    'Do not add weight and do not age anyone - and do not make anyone '
    "younger. Each person's apparent age is the age they are in the "
    'photograph.',
])

# ── THE EDITS ──────────────────────────────────────────────────────────
# (effect, old, new). Applied inside that effect's body only.
#
# renaissance takes two: the likeness passage is NOT last in that body -
# a desaturation line follows it - so the passage is lifted from where it
# sits and the clause goes after the last line instead.
EDITS = [
    ('victorian',
     "Preserve each face, skin tone, ethnicity, age, proportions and natural "
     "asymmetry. Refine temporary skin imperfections without changing "
     "anyone's identity.",
     CLAUSE),

    ('persian_court',
     'Preserve each face, skin tone, ethnicity, age, proportions and natural '
     'asymmetry.',
     CLAUSE),

    ('renaissance',
     'Keep permanent structure: lines, scars and the natural asymmetry of '
     'each face. Add nothing that is not in the source. Never reshape, '
     'enlarge eyes, correct asymmetry or de-age.' + CRLF,
     ''),

    ('renaissance',
     'Desaturate skin colours 15% and add a filter to age the entire '
     'photograph slightly.',
     'Desaturate skin colours 15% and add a filter to age the entire '
     'photograph slightly.' + CRLF + CLAUSE),

    ('wild_west',
     'Keep permanent structure: lines, scars and the natural asymmetry of '
     'each face. Add nothing that is not in the source. Never reshape, '
     'enlarge eyes, correct asymmetry or de-age.',
     CLAUSE),
]

TOUCHED = ['victorian', 'persian_court', 'renaissance', 'wild_west']


def body_span(src, key):
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
    crlf_before = src.count(CRLF)

    # The cut patch must have run first. Its two sentences contradict the
    # clause outright, and a prompt carrying both is a test of nothing.
    for dead in ('Clear the skin', 'soft key light'):
        if dead in src:
            raise SystemExit(
                f'REFUSED: "{dead}" is still in the file. Run '
                f'patch-groups-cut-skin-keylight.py first. Nothing written.'
            )

    if CLAUSE.split(CRLF)[0][:40] in src:
        raise SystemExit(
            'REFUSED: the clause is already in this file. Nothing written.'
        )

    # ── PRE-WRITE ────────────────────────────────────────────────────
    for key, old, _new in EDITS:
        n = body_span(src, key).group(1).count(old)
        if n != 1:
            raise SystemExit(
                f'REFUSED: anchor appears {n} times in body "{key}", expected 1.\n'
                f'  {old[:70]}...\n'
                f'Nothing written.'
            )

    print(f'  {PATH}')
    print(f'  {before_bodies} bodies, {before_len} bytes, {crlf_before} CRLF')
    print('')
    print(f'  clause is {len(CLAUSE)} chars, into {len(TOUCHED)} bodies')
    print('')

    # ── APPLY ────────────────────────────────────────────────────────
    out = src
    for key, old, new in EDITS:
        m = body_span(out, key)
        start, end = m.span(1)
        patched = m.group(1).replace(old, new, 1)
        out = out[:start] + patched + out[end:]
        verb = 'removed from' if new == '' else 'clause into'
        print(f'  {verb:14} {key}')

    # ── POST-WRITE ───────────────────────────────────────────────────
    for key in TOUCHED:
        b = body_span(out, key).group(1)
        n = b.count(CLAUSE)
        if n != 1:
            raise SystemExit(
                f'REFUSED: clause appears {n} times in "{key}", expected 1. Nothing written.'
            )
        if not b.rstrip().rstrip('`,').rstrip().endswith(CLAUSE.split(CRLF)[-1]):
            raise SystemExit(
                f'REFUSED: clause is not last in "{key}". Later instruction wins, '
                f'so position is the point. Nothing written.'
            )

    for key, old, new in EDITS:
        if new == '' and old in body_span(out, key).group(1):
            raise SystemExit(f'REFUSED: removed text still present in "{key}". Nothing written.')

    after_bodies = len(re.findall(r'^  [a-z_0-9]+: \{', out, re.M))
    if after_bodies != before_bodies:
        raise SystemExit(
            f'REFUSED: body count changed {before_bodies} -> {after_bodies}. Nothing written.'
        )

    # Every line of the clause is joined with CRLF, so the count must rise by
    # exactly the number of joins added. A drop means text mode got in.
    if out.count(CRLF) < crlf_before:
        raise SystemExit('REFUSED: CRLF count fell. Nothing written.')

    print('')
    print(f'  {len(out) - before_len:+d} bytes, {before_bodies} bodies intact, '
          f'CRLF {crlf_before} -> {out.count(CRLF)}')

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
