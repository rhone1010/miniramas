#!/usr/bin/env python3
# scripts/rename-halloween-pet-previews.py
#
# THE HALLOWEEN PET PLATES, NAMED WHAT THE ENGINE CALLS THEM.
#
# They arrived as the prompt titles - "Harvest God's Beast.jpeg" - which is
# how a person names a file and not how a floor looks one up. The floor asks
# for an effect id, so without this it needs a lookup table mapping twenty
# display names to twenty ids, maintained in two lanes forever.
#
# Same call as the wallpaper plates on 2026-08-10 and the studio icons on
# the 11th: one rename now, no table ever.
#
# ── THE APOSTROPHES DID NOT SURVIVE THE ZIP ────────────────────────────
#
# Six filenames carry `#U2019` where a right single quote should be -
# "Demon#U2019s Familiar.jpeg". That is a mangled U+2019, and it means the
# names cannot be matched on the word alone. So the map is keyed on a
# SLUG: lower-cased, everything that is not a letter or a digit collapsed
# to nothing. `Demon#U2019s Familiar` and `Demons Familiar` both reduce to
# `demonsfamiliar`, and either spelling lands correctly.
#
# It also absorbs `bone Collector's Beast`, which is the one file that
# arrived with a lower-case first letter.
#
# ── ONE PLATE PER EFFECT, NOT TWO ──────────────────────────────────────
#
# Unlike the portrait wallpapers there is no man/woman pair here - a pet is
# a pet. So the shape is flatter than the other sets:
#
#     public/previews/wallpapers/halloween-pets/<effect_id>.jpeg
#
# ── AND THE FLOOR WANTS 27, NOT 20 ─────────────────────────────────────
#
# Nine to a page with the unlock in the tenth slot, so twenty gives two
# full pages and a third holding two cards. Rich is writing seven more,
# which makes three clean pages. This script does not care how many there
# are; it is noted so nobody later mistakes the short page for a bug.
#
#   python scripts/rename-halloween-pet-previews.py            (dry run)
#   python scripts/rename-halloween-pet-previews.py --write

import io
import os
import re
import sys

SRC = os.path.join('public', 'previews', 'wallpapers', 'halloween-pets')

# slug -> effect id. The slug is what a title reduces to; see the note above.
MAP = {
    'harvestgodsbeast':            'harvest_god_beast',
    'graveyardguardian':           'graveyard_guardian',
    'hellbornbeast':               'hellborn_beast',
    'bloodmoonbeast':              'blood_moon_beast',
    'stormwraith':                 'storm_wraith',
    'bansheesfamiliar':            'banshee_familiar',
    'thornkingsbeast':             'thorn_king_beast',
    'drownedrevenant':             'drowned_revenant',
    'witchsfamiliar':              'witch_familiar',
    'shadowbeast':                 'shadow_beast',
    'plaguebeast':                 'plague_beast',
    'frostwraith':                 'frost_wraith',
    'bonecollectorsbeast':         'bone_collector_beast',
    'swamprevenant':               'swamp_revenant',
    'ravenlordsfamiliar':          'raven_lord_familiar',
    'demonsfamiliar':              'demon_familiar',
    'ancientcryptbeast':           'ancient_crypt_beast',
    'headlesshorsemansfamiliar':   'headless_horseman_familiar',
    'nightmarecreature':           'nightmare_creature',
    'spiritcaller':                'spirit_caller',

    # The seven Rich added on 11 August, taking the room to 27 - three clean
    # pages of nine with the unlock in each tenth slot.
    'deathscompanion':             'death_companion',
    'gargoylebeast':               'gargoyle_beast',
    'phantomoftheforest':          'phantom_of_the_forest',
    'spiderqueensfamiliar':        'spider_queen_familiar',
    'thepossessed':                'the_possessed',
    'thesouleater':                'the_soul_eater',
    'thevampiresfamiliar':         'vampire_familiar',
}

# What the floor shows. Kept here so the ids and the labels are written down
# once, in the same place, and CENG's registry can be checked against it.
LABELS = {
    'harvest_god_beast':          "Harvest God's Beast",
    'graveyard_guardian':         'Graveyard Guardian',
    'hellborn_beast':             'Hellborn Beast',
    'blood_moon_beast':           'Blood Moon Beast',
    'storm_wraith':               'Storm Wraith',
    'banshee_familiar':           "Banshee's Familiar",
    'thorn_king_beast':           "Thorn King's Beast",
    'drowned_revenant':           'Drowned Revenant',
    'witch_familiar':             "Witch's Familiar",
    'shadow_beast':               'Shadow Beast',
    'plague_beast':               'Plague Beast',
    'frost_wraith':               'Frost Wraith',
    'bone_collector_beast':       "Bone Collector's Beast",
    'swamp_revenant':             'Swamp Revenant',
    'raven_lord_familiar':        "Raven Lord's Familiar",
    'demon_familiar':             "Demon's Familiar",
    'ancient_crypt_beast':        'Ancient Crypt Beast',
    'headless_horseman_familiar': "Headless Horseman's Familiar",
    'nightmare_creature':         'Nightmare Creature',
    'spirit_caller':              'Spirit Caller',
    'death_companion':            "Death's Companion",
    'gargoyle_beast':             'Gargoyle Beast',
    'phantom_of_the_forest':      'Phantom of the Forest',
    'spider_queen_familiar':      "Spider Queen's Familiar",
    'the_possessed':              'The Possessed',
    'the_soul_eater':             'The Soul Eater',
    'vampire_familiar':           "The Vampire's Familiar",
}


def slug(name):
    """A title reduced to letters and digits. Survives the mangled
       apostrophes, the stray capital and any spacing somebody used."""
    stem = os.path.splitext(name)[0]
    stem = stem.replace('#U2019', '').replace('\u2019', '')
    return re.sub(r'[^a-z0-9]', '', stem.lower())


def main():
    write = '--write' in sys.argv

    if not os.path.isdir(SRC):
        print('NOT FOUND: %s' % SRC)
        print('Put the plates there first, then run this from the repo root.')
        return 1

    files = [f for f in sorted(os.listdir(SRC))
             if os.path.isfile(os.path.join(SRC, f))
             and f.lower().endswith(('.jpeg', '.jpg', '.png'))]
    if not files:
        print('Nothing loose in %s - already run?' % SRC)
        return 0

    planned, unknown = [], []
    for name in files:
        eid = MAP.get(slug(name))
        if not eid:
            unknown.append(name)
            continue
        ext = os.path.splitext(name)[1].lower().replace('.jpg', '.jpeg')
        planned.append((os.path.join(SRC, name),
                        os.path.join(SRC, eid + ext)))

    if unknown:
        print('NOT IN THE MAP - nothing written:\n')
        for u in unknown:
            print('  %-42s (slug: %s)' % (u, slug(u)))
        print('\nAdd them to MAP and LABELS, then run again.')
        return 1

    seen = {}
    for _, d in planned:
        if d in seen:
            print('COLLISION: %s\nNothing written.' % d)
            return 1
        seen[d] = True

    for s, d in planned:
        if os.path.basename(s) == os.path.basename(d):
            continue
        print('  %-44s -> %s' % (os.path.basename(s), os.path.basename(d)))

    print('\n  plates : %d' % len(planned))
    missing = [e for e in LABELS if e not in
               {os.path.splitext(os.path.basename(d))[0] for _, d in planned}]
    if missing:
        print('  NO PLATE YET: %s' % ', '.join(sorted(missing)))

    # Nine to a page, the unlock in the tenth slot.
    n = len(planned)
    pages, short = (n + 8) // 9, n % 9
    print('  floor  : %d page%s%s' % (
        pages, '' if pages == 1 else 's',
        '' if short == 0 else ', the last holding %d of 9' % short))

    if not write:
        print('\nDRY RUN. Nothing written. Re-run with --write.')
        return 0

    for s, d in planned:
        if s != d:
            os.rename(s, d)
    print('\nDone.')

    # The registry rows, so CENG is not retyping twenty ids from a document.
    rows = os.path.join('scripts', 'halloween-pets-rows.txt')
    with io.open(rows, 'w', encoding='utf-8', newline='\n') as fh:
        for _, d in planned:
            eid = os.path.splitext(os.path.basename(d))[0]
            fh.write("  { id:'%s', label:%s, room:'halloween-pets', "
                     "preview:'%s' },\n"
                     % (eid, "'" + LABELS[eid].replace("'", "\\'") + "'", eid))
    print('Registry rows written to %s' % rows)
    return 0


if __name__ == '__main__':
    sys.exit(main())
