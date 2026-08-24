#!/usr/bin/env python3
"""
patch-groups-add-stained-glass.py

Adds `stained_glass` to the Groups catalogue. 33 -> 34.

── WHY IT WAS HELD BACK, AND WHY IT IS NO LONGER ──────────────────────

Held out of the 23 August catalogue patch because every render came back as
separate glass cutouts propped on a bench in a lamp shop, rather than one
dimensional sculpture. I diagnosed it as the body's own wording - "Tiffany
meets Bronze Sculpture", the shop background, "Internally lit" with no
external light - and told Rich it needed a rewrite.

That diagnosis was wrong. **The cause was the forced 1:1 aspect.** A square
output of a landscape source is not a crop; NB2 recomposes, and a wide group
squeezed into a square resolves as separate stacked figures because that is
what fits. Run with the aspect following the source, the SAME BODY came back
as one coherent piece on a plinth.

Fixed in groups-generator.ts on 23 August by groupsAspect(). Rich, 24
August: "we dont need to rewrite stained glass.. it was solved with the
removal of forced aspect ratio."

So this goes in UNCHANGED. Nothing in the body was edited.

── WHAT IS DELIBERATELY NOT CORRECTED ─────────────────────────────────

The body carries "rortate" where it means rotate. It is Rich's text and
Rich's typo, it demonstrably does not break the render, and correcting
prompt text without him is not something this patch does. Left as found.

── DISCIPLINE ─────────────────────────────────────────────────────────
  Dry run by default. --write to write.
  Refuses if stained_glass is already present.
  Line ending read off the file - groups-effects.ts is CRLF,
  groups-generator.ts beside it is LF.

USAGE
  python scripts/patch-groups-add-stained-glass.py
  python scripts/patch-groups-add-stained-glass.py --write
"""

import re
import sys
import os

PATH = os.path.join('lib', 'v1', 'groups', 'groups-effects.ts')
KEY = 'stained_glass'

ENTRY = "  stained_glass: {\r\n    id: 'stained_glass',\r\n    label: 'Stained Glass',\r\n    intake: 'group_photo',\r\n    body: `make the group one fully 3d stained glass sculpture. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. Tiffany meets Bronze Sculpture. Internally lit with nice falloffs for character. likeness is important. No human skin, hair, nails or teeth. rortate the statue 10 degrees left. the background is a beautiful tiffany lamp style shop. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,\r\n    avoid: `Avoid a flat opaque mosaic, painted-on color, or a 2D stained-glass window with no dimensional form. Avoid glass without visible leading/came lines between the cells. Avoid a uniformly lit surface with no backlit glow — the inner luminosity and the dark leading are both required. Avoid muddy or desaturated glass; the cathedral-glass jewel tones must read as vivid and lit.`,\r\n  },"


def detect_eol(text):
    crlf = text.count('\r\n')
    return '\r\n' if crlf and crlf >= text.count('\n') - crlf else '\n'


def main():
    write = '--write' in sys.argv

    if not os.path.exists(PATH):
        raise SystemExit('REFUSED: %s not found. Run from the repo root.' % PATH)

    with open(PATH, 'r', encoding='utf-8', newline='') as f:
        src = f.read()

    EOL = detect_eol(src)
    before_len = len(src)
    before_keys = re.findall(r'^  ([a-z_0-9]+): \{', src, re.M)

    print('  %s' % PATH)
    print('  %d effects, %d bytes, %s' % (
        len(before_keys), before_len, 'CRLF' if EOL == '\r\n' else 'LF'))
    print('')

    if KEY in before_keys:
        raise SystemExit('REFUSED: "%s" is already in the catalogue. Nothing written.' % KEY)
    if ("| '%s'" % KEY) in src:
        raise SystemExit('REFUSED: union entry for "%s" already present. Nothing written.' % KEY)

    out = src

    # ── union member, after the last added one ───────────────────────
    anchor = "  | 'silver'" + EOL
    if out.count(anchor) != 1:
        raise SystemExit('REFUSED: union anchor silver not found once. Nothing written.')
    out = out.replace(anchor, anchor + "  | '%s'" % KEY + EOL, 1)
    print('  added     %s (type union)' % KEY)

    # ── object entry, after the last one ─────────────────────────────
    m = re.search(r'^  silver: \{.*?^  \},' + re.escape(EOL), out, re.M | re.S)
    if not m:
        raise SystemExit('REFUSED: object anchor silver not found. Nothing written.')
    out = out[:m.end()] + ENTRY.replace('\r\n', EOL) + EOL + out[m.end():]
    print('  added     %s (object entry)' % KEY)

    # ── POST-WRITE ───────────────────────────────────────────────────
    after_keys = re.findall(r'^  ([a-z_0-9]+): \{', out, re.M)
    if len(after_keys) != len(before_keys) + 1:
        raise SystemExit('REFUSED: %d effects, expected %d. Nothing written.' % (
            len(after_keys), len(before_keys) + 1))
    if len(set(after_keys)) != len(after_keys):
        raise SystemExit('REFUSED: duplicate effect key. Nothing written.')
    if out.count("| '%s'" % KEY) != 1:
        raise SystemExit('REFUSED: union entry not added exactly once. Nothing written.')
    if EOL == '\r\n' and re.search(r'(?<!\r)\n', out):
        raise SystemExit('REFUSED: bare LF introduced into a CRLF file. Nothing written.')

    print('')
    print('  %d effects -> %d, %+d bytes' % (
        len(before_keys), len(after_keys), len(out) - before_len))

    if not write:
        print('')
        print('  DRY RUN. Nothing written. Re-run with --write.')
        return

    with open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(out)

    print('')
    print('  WRITTEN. %s is now %d bytes.' % (PATH, len(out)))
    print('  Run: npx tsc --noEmit 2>&1 | findstr /C:"groups"')


if __name__ == '__main__':
    main()
