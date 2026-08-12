#!/usr/bin/env python3
# scripts/rename-studio-icons.py
#
# THE STUDIO ICONS, NAMED WHAT THE PAGE CALLS THEM.
#
# They arrived as export names - studio_icon__0000_Cosmos.png - which carry
# a layer index and a display label. The page looks an icon up by EFFECT ID,
# so today it would need a lookup table mapping thirty-one filenames to
# thirty-one ids, maintained in two lanes forever. One rename now, no table
# ever. Same call as the wallpaper preview plates on 2026-08-10.
#
# TARGET SHAPE
#
#     public/icons/studio/<axis>/<id>.png
#
# where <id> is exactly the id in lib/v1/wallpapers/studio-prompt.ts.
#
# THE AXIS FOLDER IS NOT TIDINESS. Two names appear on two different axes:
#
#     Inferno    is a MOOD  (0013) and a PALETTE (0027)
#     Midnight   is a MOOD  (0012) and a PALETTE (0029)
#
# Flattened into one folder the second would silently overwrite the first
# and two controls would wear the same picture - the kind of fault that
# looks like a design choice rather than a bug. The folder is what keeps
# them apart, so it is load-bearing.
#
# THE INDEX IS THE TRUTH, NOT THE LABEL. Mapping is by the four-digit
# export index rather than by the word after it, because the words collide
# and one of them is misspelled: 0028 is "Artic" and the palette is arctic.
# Reading the index also means a re-export with tidier labels still lands
# correctly.
#
#   python scripts/rename-studio-icons.py            (dry run)
#   python scripts/rename-studio-icons.py --write

import os
import re
import shutil
import sys

SRC = os.path.join('public', 'icons', 'studio')

# index -> (axis, id). Order and ids from studio-prompt.ts.
MAP = {
    # WORLDS
    '0000': ('worlds', 'cosmos'),
    '0001': ('worlds', 'ocean'),
    '0002': ('worlds', 'glass'),
    '0003': ('worlds', 'botanical'),
    '0004': ('worlds', 'liquid'),
    '0005': ('worlds', 'architecture'),
    '0006': ('worlds', 'light'),
    '0007': ('worlds', 'mineral'),

    # MOODS
    '0008': ('moods', 'dream'),
    '0009': ('moods', 'storm'),
    '0010': ('moods', 'twilight'),
    '0011': ('moods', 'eclipse'),
    '0012': ('moods', 'midnight'),      # collides with 0029
    '0013': ('moods', 'inferno'),       # collides with 0027

    # ENERGIES
    '0014': ('energies', 'stillness'),
    '0015': ('energies', 'drift'),
    '0016': ('energies', 'flow'),
    '0017': ('energies', 'surge'),
    '0018': ('energies', 'eruption'),

    # PALETTES
    '0019': ('palettes', 'aurora'),
    '0020': ('palettes', 'ember'),
    '0021': ('palettes', 'deep_ocean'),
    '0022': ('palettes', 'ultraviolet'),
    '0023': ('palettes', 'solar'),
    '0024': ('palettes', 'neon_noir'),
    '0025': ('palettes', 'emerald'),
    '0026': ('palettes', 'opal'),
    '0027': ('palettes', 'inferno'),    # collides with 0013
    '0028': ('palettes', 'arctic'),     # exported as "Artic"
    '0029': ('palettes', 'midnight'),   # collides with 0012
    '0030': ('palettes', 'prismatic'),
}


def main():
    write = '--write' in sys.argv

    if not os.path.isdir(SRC):
        print('NOT FOUND: %s  (run from the repo root)' % SRC)
        return 1

    files = [f for f in sorted(os.listdir(SRC))
             if os.path.isfile(os.path.join(SRC, f))]
    if not files:
        print('Nothing loose in %s - already run?' % SRC)
        return 0

    planned = []
    unknown = []

    for name in files:
        m = re.search(r'_(\d{4})_', name)
        if not m or m.group(1) not in MAP:
            unknown.append(name)
            continue
        axis, eid = MAP[m.group(1)]
        ext = os.path.splitext(name)[1].lower()
        planned.append((
            os.path.join(SRC, name),
            os.path.join(SRC, axis, eid + ext),
        ))

    if unknown:
        print('NOT IN THE MAP - nothing written:\n')
        for u in unknown:
            print('  ' + u)
        print('\nAdd them to MAP, or move them out of this folder first.')
        return 1

    # Two files wanting one name means the axis folders are not doing their
    # job, and one icon would be destroyed. Stop rather than find out later.
    seen = {}
    clash = False
    for _, dst in planned:
        if dst in seen:
            print('COLLISION: %s' % dst)
            clash = True
        seen[dst] = True
    if clash:
        print('\nNothing written.')
        return 1

    for s, d in planned:
        print('  %-42s -> %s' % (os.path.basename(s),
                                 os.path.relpath(d, SRC).replace('\\', '/')))

    counts = {}
    for _, d in planned:
        axis = os.path.basename(os.path.dirname(d))
        counts[axis] = counts.get(axis, 0) + 1
    print('\n  ' + '  '.join('%s %d' % (a, n) for a, n in sorted(counts.items())))

    want = {'worlds': 8, 'moods': 6, 'energies': 5, 'palettes': 12}
    for axis, n in want.items():
        if counts.get(axis, 0) != n:
            print('\n%s has %d, expected %d. Nothing written.'
                  % (axis, counts.get(axis, 0), n))
            return 1

    if not write:
        print('\nDRY RUN. Nothing written. Re-run with --write.')
        return 0

    for axis in want:
        os.makedirs(os.path.join(SRC, axis), exist_ok=True)
    for s, d in planned:
        shutil.move(s, d)
    print('\nDone. 31 icons in four folders.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
