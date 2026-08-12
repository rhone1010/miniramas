#!/usr/bin/env python3
# scripts/rename-halloween-icons.py
#
# THE HALLOWEEN STUDIO ICONS, NAMED WHAT THE PAGE CALLS THEM.
#
# They arrived as Photoshop layer exports - halloween_icons__0006_Layer-8.png
# - which carry an index and nothing else. No labels at all, so unlike the
# general Studio set there is no word to check the mapping against.
#
# SO THE MAPPING WAS READ OFF THE PICTURES, NOT INFERRED FROM THE ORDER.
# Every one of these was looked at before this file was written, and it is
# just as well: THE WORLDS ARE NOT IN THE ORDER RICH LISTED THEM.
#
#     his list      0005 Gothic      0006 Nightmare   0007 Otherworld
#     the files     0005 OTHERWORLD  0006 Nightmare   0007 GOTHIC
#
# Mapping by index alone would have given the cathedral to Otherworld and
# the floating islands to Gothic - two controls quietly wearing each other's
# picture, which reads as a design choice rather than a fault and could sit
# there for months.
#
# ── KEYED ON THE LAYER, NOT THE INDEX ──────────────────────────────────
#
# The first export ran 0000_Layer-2 through 0027_Layer-29, so the index and
# the layer differ by two and either would have done.
#
# Then POISON arrived on its own as 0026_Layer-30 - and 0026 was already
# Gothic Jewel. TWO DIFFERENT ICONS NOW CARRY THE SAME INDEX, because the
# second export renumbered from its own zero.
#
# So the map is keyed on the LAYER number, which is unique across both
# exports. It is also the more durable choice: a re-export with different
# indices still lands correctly as long as the layers are the layers.
#
# ── AND 0028 IS NOT AN ICON ────────────────────────────────────────────
#
# halloween_icons__0028_Background.png is 1254x1254 and 10kb - the export
# background, not a control. It is moved out of the way rather than deleted,
# because deleting somebody's file is not this script's business.
#
# TARGET SHAPE
#
#     public/icons/halloween/<axis>/<id>.png
#
# Foldered by axis for the same reason the general Studio set is: Midnight
# and Eclipse each exist on two axes across the two rooms, and a flat folder
# would let one overwrite the other.
#
#   python scripts/rename-halloween-icons.py            (dry run)
#   python scripts/rename-halloween-icons.py --write

import os
import re
import shutil
import sys

SRC = os.path.join('public', 'icons', 'halloween')

# index -> (axis, id). READ OFF THE PICTURES on 2026-08-11.
MAP = {
    # WORLDS · 8
    '2': ('worlds', 'haunted'),      # castle, red moon, bats
    '3': ('worlds', 'spectral'),     # green translucent figure
    '4': ('worlds', 'infernal'),     # molten demon head
    '5': ('worlds', 'harvest'),      # pumpkins, vines, raven
    '6': ('worlds', 'occult'),       # pentagram, candles, skull
    '7': ('worlds', 'otherworld'),   # floating islands, moon  <- NOT gothic
    '8': ('worlds', 'nightmare'),    # violet maw, distorted figure
    '9': ('worlds', 'gothic'),       # cathedral, gargoyle     <- NOT otherworld

    # MOODS · 6
    '10': ('moods', 'bewitched'),     # violet potion, butterflies
    '11': ('moods', 'haunting'),      # graveyard apparition, moonlight
    '12': ('moods', 'ominous'),       # raven on skull, storm
    '13': ('moods', 'macabre'),       # skull in gilt frame, roses
    '14': ('moods', 'nightmarish'),   # screaming distorted face
    '15': ('moods', 'majestic'),      # antlered figure, gold moon

    # ENERGIES · 5 · calm to wild, and this order is load-bearing
    '16': ('energies', 'stillness'),  # single candle, still water
    '17': ('energies', 'drift'),      # leaves on a slow current
    '18': ('energies', 'flow'),       # spiral
    '19': ('energies', 'surge'),      # lightning through cloud
    '20': ('energies', 'eruption'),   # volcanic burst

    # PALETTES · 10
    '21': ('palettes', 'blood_moon'),
    '22': ('palettes', 'pumpkin_fire'),
    '23': ('palettes', 'witchlight'),
    '24': ('palettes', 'ghostlight'),
    '25': ('palettes', 'midnight'),
    '26': ('palettes', 'dead_forest'),
    '27': ('palettes', 'gothic_jewel'),
    '28': ('palettes', 'eclipse'),
    '29': ('palettes', 'phantom_rose'),

    # PALETTES · the tenth, exported separately as Layer-30.
    '30': ('palettes', 'poison'),

    # Not a control - the export background, 1254x1254 and 10kb. Moved
    # aside rather than deleted; deleting somebody's file is not this
    # script's business.
    'bg': ('_unused', 'export-background'),
}

WANT = {'worlds': 8, 'moods': 6, 'energies': 5, 'palettes': 10, '_unused': 1}


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

    planned, unknown = [], []
    for name in files:
        # The layer number, not the index. See the note at the top.
        m = re.search(r'_Layer-(\d+)\.', name)
        key = m.group(1) if m else ('bg' if 'Background' in name else None)
        if key is None or key not in MAP:
            unknown.append(name)
            continue
        axis, eid = MAP[key]
        ext = os.path.splitext(name)[1].lower()
        planned.append((os.path.join(SRC, name),
                        os.path.join(SRC, axis, eid + ext)))

    if unknown:
        print('NOT IN THE MAP - nothing written:\n')
        for u in unknown:
            print('  ' + u)
        return 1

    seen = {}
    for _, dst in planned:
        if dst in seen:
            print('COLLISION: %s\nNothing written.' % dst)
            return 1
        seen[dst] = True

    for s, d in planned:
        print('  %-42s -> %s' % (os.path.basename(s),
                                 os.path.relpath(d, SRC).replace('\\', '/')))

    counts = {}
    for _, d in planned:
        axis = os.path.basename(os.path.dirname(d))
        counts[axis] = counts.get(axis, 0) + 1
    print('\n  ' + '  '.join('%s %d' % (a, n) for a, n in sorted(counts.items())))

    for axis, n in WANT.items():
        if counts.get(axis, 0) != n:
            print('\n%s has %d, expected %d. Nothing written.'
                  % (axis, counts.get(axis, 0), n))
            return 1

    if not write:
        print('\nDRY RUN. Nothing written. Re-run with --write.')
        return 0

    for axis in WANT:
        os.makedirs(os.path.join(SRC, axis), exist_ok=True)
    for s, d in planned:
        shutil.move(s, d)
    print('\nDone. 29 icons in four folders, one export background set aside.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
