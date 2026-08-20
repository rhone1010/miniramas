#!/usr/bin/env python3
# scripts/place-studio-textures.py
#
# THE STUDIO TEXTURES, NAMED FOR WHAT THEY DO.
#
# They arrived as Photoshop layer exports carrying an index and a
# descriptive label - studio_textures__0000_Leather-Large.png. The
# stylesheet asks for them by role, so this renames them to the role and
# puts them where the CSS looks.
#
# TARGET
#
#     public/textures/studio/<role>.png
#
# ── THEY ARE TOO HEAVY TO SHIP AS THEY ARE ─────────────────────────────
#
# Five megabytes across eleven files, and leather.png alone is 2.7MB - for
# a background that sits at fifty per cent opacity under a blend mode,
# where nobody will ever see the difference. On a phone that is five
# seconds of a page not appearing.
#
# This script only moves and renames; it does not touch the bytes, because
# quietly recompressing somebody's artwork is not its business. But the
# numbers are printed, and anything over 300kb is called out. Before this
# ships they want running through an optimiser, and the two large leathers
# want to be JPEG rather than PNG - neither has transparency and PNG is
# storing a photograph losslessly for no reason.
#
#   python scripts/place-studio-textures.py            (dry run)
#   python scripts/place-studio-textures.py --write

import os
import re
import shutil
import sys

SRC = os.path.join('public', 'textures', 'studio')

# index -> role. Keyed on the index rather than the label because the
# labels carry capitals, hyphens and one misspelling (parchement).
MAP = {
    '0000': 'leather',        # the left panel's ground
    '0001': 'parchment',      # the right panel's ground
    '0002': 'binding',        # stitched edge, runs down the seam
    '0003': 'ring-stain',     # a cup was here
    '0004': 'wheat-large',
    '0005': 'leaf-veins',
    '0006': 'wheat-small',
    '0007': 'parchment-2',    # second sheet, for a lighter surface
    '0008': 'wheat-berries',
    '0009': 'stain',
    '0010': 'drip',
}

# Not from the layered export - a separate tile Rich added on 12 August.
# Copied through under its own name so the folder is one place.
LOOSE = {
    'paper-grain.png': 'paper-grain.png',
}

HEAVY_KB = 300


def main():
    write = '--write' in sys.argv

    if not os.path.isdir(SRC):
        print('NOT FOUND: %s' % SRC)
        print('Put the eleven PNGs there first, then run from the repo root.')
        return 1

    files = [f for f in sorted(os.listdir(SRC))
             if os.path.isfile(os.path.join(SRC, f))]
    if not files:
        print('Nothing loose in %s - already run?' % SRC)
        return 0

    planned, unknown = [], []
    for name in files:
        if name in LOOSE:
            continue            # already correctly named
        m = re.search(r'_(\d{4})_', name)
        if not m or m.group(1) not in MAP:
            unknown.append(name)
            continue
        planned.append((os.path.join(SRC, name),
                        os.path.join(SRC, MAP[m.group(1)] + '.png')))

    if unknown:
        print('NOT IN THE MAP - nothing written:\n')
        for u in unknown:
            print('  ' + u)
        return 1

    seen = {}
    for _, d in planned:
        if d in seen:
            print('COLLISION: %s\nNothing written.' % d)
            return 1
        seen[d] = True

    heavy, total = [], 0
    for s, d in planned:
        kb = os.path.getsize(s) / 1024.0
        total += kb
        flag = ''
        if kb > HEAVY_KB:
            heavy.append((os.path.basename(d), kb))
            flag = '   <- %.0fkb' % kb
        print('  %-46s -> %-18s%s' % (os.path.basename(s),
                                      os.path.basename(d), flag))

    print('\n  files: %d   total: %.1fMB' % (len(planned), total / 1024.0))
    if heavy:
        print('\n  HEAVY, and worth fixing before launch:')
        for n, kb in sorted(heavy, key=lambda x: -x[1]):
            print('    %-20s %5.0fkb' % (n, kb))
        print('  leather.png and parchment.png have no transparency - they')
        print('  are photographs stored losslessly. As JPEG at quality 82')
        print('  they would be a tenth of this and look identical under a')
        print('  blend mode at half opacity.')

    if not write:
        print('\nDRY RUN. Nothing written. Re-run with --write.')
        return 0

    for s, d in planned:
        shutil.move(s, d)
    print('\nDone.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
