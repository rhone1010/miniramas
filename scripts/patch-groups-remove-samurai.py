#!/usr/bin/env python3
"""
patch-groups-remove-samurai.py

Removes `samurai` from the Groups catalogue in
lib/v1/groups/groups-effects.ts. 34 -> 33.

── WHY IT ESCAPED THE FIRST CUT ───────────────────────────────────────

The five costume effects removed on 23 August were found by grepping for
"apparent sex", which is the instruction that hands the sex of every figure
to NB2. `samurai` does not contain that phrase, so it was not in the list,
and I told Rich it could stay while noting it was period costume and worth
watching.

Rich read the body and called it. It dresses the whole group in Edo-period
lamellar armour - the same failure in a quieter form. Armour reads male by
default across a mixed family, and nothing in the pipeline knows who is
who: Groups analyze returns a headcount and no per-person sex.

The lesson is that the grep was the wrong test. **The test is whether the
effect RE-DRESSES people rather than re-materialising the clothes they are
already wearing.** Material effects keep each person's own garment and have
no sex to infer; costume effects invent clothing and must guess.

Two others were checked against that test and STAY, because they replace
people with objects rather than dressing them: `balloon_face` and
`retro_robot`. Neither invents a garment by sex.

── THE CATALOGUE AFTER THIS ───────────────────────────────────────────

    28  before 23 August
    -6  victorian, elizabethan, renaissance, persian_court, wild_west,
        folded_book
   +12  quilted, petal_sculpture, sand_form, watercolour, impressionist,
        driftwood_resin, chocolate, linocut, lichen_granite,
        polished_gold, wax, silver
    -1  samurai
   ---
    33

`stained_glass` is the thirty-fourth when Rich's rewrite lands.

── DOWNSTREAM, UNHANDLED ──────────────────────────────────────────────

Same as the first removal: any piece already crafted as `samurai` keeps an
effect_id that is no longer in the catalogue, and nothing here migrates
those rows. Registries and room pages listing it need regenerating - CUI.

── DISCIPLINE ─────────────────────────────────────────────────────────
  Dry run by default. --write to write.
  Anchors must match exactly once.
  Line ending read off the file, never assumed - groups-effects.ts is CRLF
  and groups-generator.ts beside it is LF.

USAGE
  python scripts/patch-groups-remove-samurai.py
  python scripts/patch-groups-remove-samurai.py --write
"""

import re
import sys
import os

PATH = os.path.join('lib', 'v1', 'groups', 'groups-effects.ts')
KEY = 'samurai'


def detect_eol(text):
    crlf = text.count('\r\n')
    return '\r\n' if crlf and crlf >= text.count('\n') - crlf else '\n'


def main():
    write = '--write' in sys.argv

    if not os.path.exists(PATH):
        raise SystemExit(f'REFUSED: {PATH} not found. Run from the repo root.')

    with open(PATH, 'r', encoding='utf-8', newline='') as f:
        src = f.read()

    EOL = detect_eol(src)
    before_len = len(src)
    before_keys = re.findall(r'^  ([a-z_0-9]+): \{', src, re.M)

    print(f'  {PATH}')
    print(f'  {len(before_keys)} effects, {before_len} bytes, '
          f'{"CRLF" if EOL == chr(13)+chr(10) else "LF"}')
    print('')

    # ── PRE-WRITE ────────────────────────────────────────────────────
    if KEY not in before_keys:
        raise SystemExit(
            f'REFUSED: "{KEY}" is not in the catalogue - already removed? '
            f'Nothing written.'
        )

    union_line = f"  | '{KEY}'{EOL}"
    if src.count(union_line) != 1:
        raise SystemExit(
            f'REFUSED: union entry for "{KEY}" not found exactly once. Nothing written.'
        )

    # Guard against a prefix match: `samurai_woman` would also satisfy a
    # loose search and must not be touched.
    others = [k for k in before_keys if k.startswith(KEY) and k != KEY]
    if others:
        raise SystemExit(
            f'REFUSED: other keys start with "{KEY}": {", ".join(others)}. '
            f'Nothing written.'
        )

    out = src

    # ── REMOVE: the object entry ─────────────────────────────────────
    pat = re.compile(r'^  ' + KEY + r': \{.*?^  \},' + re.escape(EOL), re.M | re.S)
    m = pat.search(out)
    if not m:
        raise SystemExit(f'REFUSED: could not isolate the "{KEY}" entry. Nothing written.')
    out = out[:m.start()] + out[m.end():]
    print(f'  removed   {KEY} (object entry)')

    # ── REMOVE: the union member ─────────────────────────────────────
    out = out.replace(union_line, '', 1)
    print(f'  removed   {KEY} (type union)')

    # ── POST-WRITE ───────────────────────────────────────────────────
    after_keys = re.findall(r'^  ([a-z_0-9]+): \{', out, re.M)
    if len(after_keys) != len(before_keys) - 1:
        raise SystemExit(
            f'REFUSED: {len(after_keys)} effects, expected {len(before_keys) - 1}. '
            f'Nothing written.'
        )
    if KEY in after_keys:
        raise SystemExit(f'REFUSED: "{KEY}" survived removal. Nothing written.')
    if f"| '{KEY}'" in out:
        raise SystemExit(f'REFUSED: union entry for "{KEY}" survived. Nothing written.')
    if len(set(after_keys)) != len(after_keys):
        raise SystemExit('REFUSED: duplicate effect key. Nothing written.')
    if EOL == '\r\n' and re.search(r'(?<!\r)\n', out):
        raise SystemExit('REFUSED: bare LF introduced into a CRLF file. Nothing written.')

    print('')
    print(f'  {len(before_keys)} effects -> {len(after_keys)}, '
          f'{len(out) - before_len:+d} bytes')

    if not write:
        print('')
        print('  DRY RUN. Nothing written. Re-run with --write.')
        return

    with open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(out)

    print('')
    print(f'  WRITTEN. {PATH} is now {len(out)} bytes.')
    print('  Run: npx tsc --noEmit 2>&1 | findstr /C:"groups"')


if __name__ == '__main__':
    main()
