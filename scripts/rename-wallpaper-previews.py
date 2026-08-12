#!/usr/bin/env python3
# scripts/rename-wallpaper-previews.py
#
# THE PLATES MUST BE NAMED WHAT THE ENGINE CALLS THEM.
#
# The 9:16 previews were shot under working names - witch, demon, raven,
# spider_king - while the registry calls those effects gothic_witch,
# demon_lord, raven_monarch, spider_monarch. The floor looks a plate up by
# effect id, so today most of them would miss.
#
# The alternative was a lookup table in the glass mapping forty ids to forty
# filenames. That table would then have to be maintained in two lanes for as
# long as the product exists, and every new effect would be a chance to
# forget it. One rename now, no table ever.
#
# TARGET SHAPE
#
#     public/previews/wallpapers/<room>/<sex>_<effect_id>.jpeg
#
# where <effect_id> is EXACTLY the id in
# lib/v1/wallpapers/wallpaper-registry-rows.ts.
#
# THE MONARCHS. spider_king and spider_queen are one effect, spider_monarch,
# with a gendered body - the same arrangement Portraits uses for victorian.
# So man_spider_king and woman_spider_queen both become <sex>_spider_monarch,
# and the sex prefix carries what the old suffix was carrying.
#
# NOT TOUCHED. Eight plates exist for effects that are not in the registry:
# bone_collector, candle_wraith, forest_revenant, gargoyle, mummy, pumpkin,
# spirit. Four of them are wanted as replacements for the four Halloween
# effects with no plates at all (elegant_vampire, headless_horseman, and the
# man halves of ghoul and dark_wizard), but Rich has not said which four.
# They keep their names until he does - renaming a file to an id that does
# not exist yet is how a plate goes missing twice.
#
#   python scripts/rename-wallpaper-previews.py            (dry run)
#   python scripts/rename-wallpaper-previews.py --write

import os
import sys

ROOT = os.path.join('public', 'previews', 'wallpapers')

# old stem -> registry effect id. Sex prefix and extension are handled
# separately, so each effect appears once regardless of how many bodies it
# ships.
PORTRAITS = {
    'balloon':      'balloon_face',
    'charcoal':     'charcoal_chalk',
    'robot':        'retro_robot',
    'renaisannce':  'renaissance',   # misspelled at shoot time
}

HALLOWEEN = {
    'witch':             'gothic_witch',
    'wizard':            'dark_wizard',
    'demon':             'demon_lord',
    'swamp_thing':       'swamp_creature',
    'scarecrow':         'haunted_scarecrow',
    'pirate':            'ghost_pirate',
    'raven':             'raven_monarch',
    'ferryman':          'the_ferryman',
    'living_porcelain':  'porcelain_doll',
    # gendered pairs collapsing onto one id
    'spider_king':       'spider_monarch',
    'spider_queen':      'spider_monarch',
    'shadow_king':       'shadow_monarch',
    'shadow_queen':      'shadow_monarch',
    'moth_king':         'moth_monarch',
    'moth_queen':        'moth_monarch',
    'lord_halloween':    'halloween_monarch',
    'lady_halloween':    'halloween_monarch',
}

MAPS = {'portraits': PORTRAITS, 'halloween': HALLOWEEN}


def main():
    write = '--write' in sys.argv

    if not os.path.isdir(ROOT):
        print('NOT FOUND: %s  (run from the repo root)' % ROOT)
        return 1

    planned = []
    untouched = []
    clashes = []

    for room, table in MAPS.items():
        d = os.path.join(ROOT, room)
        if not os.path.isdir(d):
            print('skipping %s - no such folder' % d)
            continue

        for name in sorted(os.listdir(d)):
            stem, ext = os.path.splitext(name)
            if '_' not in stem:
                untouched.append(os.path.join(room, name))
                continue
            sex, rest = stem.split('_', 1)
            if sex not in ('man', 'woman'):
                untouched.append(os.path.join(room, name))
                continue

            target = table.get(rest)
            if not target:
                untouched.append(os.path.join(room, name))
                continue

            new = '%s_%s%s' % (sex, target, ext)
            if new == name:
                continue

            src = os.path.join(d, name)
            dst = os.path.join(d, new)
            # A collision means two plates want the same name, which almost
            # certainly means the same body was shot twice under two working
            # names. Stop rather than silently destroy one.
            if os.path.exists(dst):
                clashes.append((src, dst))
            planned.append((src, dst))

    if clashes:
        print('COLLISIONS - two files want the same name. Nothing written:\n')
        for s, d in clashes:
            print('  %s\n    -> %s (exists)' % (s, d))
        return 1

    for s, d in planned:
        print('  %-52s -> %s' % (s.replace('\\', '/'), os.path.basename(d)))

    print('\n  renaming : %d' % len(planned))
    print('  leaving  : %d (not in the registry, or already correct)'
          % len(untouched))

    if not write:
        print('\nDRY RUN. Nothing written. Re-run with --write.')
        return 0

    for s, d in planned:
        os.rename(s, d)
    print('\nDone. git status will show them as renames.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
