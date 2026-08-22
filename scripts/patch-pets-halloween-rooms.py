#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-pets-halloween-rooms.py  --  the 27 into four rooms, with their
pictures.

    python scripts\\patch-pets-halloween-rooms.py
    python scripts\\patch-pets-halloween-rooms.py --apply

Dry run by default. Output to
%USERPROFILE%\\Downloads\\pets-halloween-registry.js; install with
Install-File.ps1.

WHY. CENG shipped one silo holding all 27, correctly, because the division
is not a thing to guess inside a generated file. The floor holds seven --
four across, two down, the eighth slot given to the upsell card.

THE DIVISION. Rich confirmed it by sending the four room plates, 21 August,
each of which belongs to exactly one of these rooms.

  Familiars       7   The ones that belong to somebody. Every id here ends
                      in _familiar or is owned by a named master. The human
                      Halloween room calls its equivalent Old Magic; this
                      room is named from the animal's side of that
                      relationship, which is the whole idea of it.
  Restless Dead   7   Dead and still moving.
  Creatures       7   Not dead, not owned. Just wrong.
  Harvest         6   Guardians of a place, and the things the woods keep.

  27 does not divide by seven, so Harvest carries six and its upsell card
  offers six. The floor already handles that.

TWO PLACEMENTS ARE ARGUABLE and are recorded rather than hidden:

  gargoyle_beast sits in Harvest, beside the graveyard guardian, because
  both guard a place. It would read as easily as a Creature.

  spirit_caller sits in Harvest for want of a better home. It belongs with
  the Familiars and that room is full at seven.

THE PLATES. Rich chose four, 21 August. Each is from the room it fronts:

  familiars       banshee_familiar.jpg
  restless_dead   bone_collector_beast.jpg
  creatures       blood_moon_beast.jpg
  harvest         thorn_king_beast.jpg

  Note the filenames carry no pethw_. The ids do and the files do not --
  the folder name already says what the prefix says. These are written as
  whole paths, so no stripping happens twice.

THE LINES ARE EMPTY. Four are owed and they are Rich's voice, not this
lane's. The room cards will paint with their pictures and their names and
no sentence underneath until he writes them. The other nine are in
public/pets-registry.js and public/halloween-registry.js as examples of
the register.

GENERATED FILE. Emitted from lib/v1/halloween/pets-halloween-catalog.ts. A
regeneration wipes this, exactly as it would wipe the Pets and Halloween
divisions. All three need to reach the room map CENG is building.
"""

import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DOWNLOADS = os.path.join(
    os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Downloads')
TARGET = os.path.join(REPO, 'public', 'pets-halloween-registry.js')
PLATE_DIR = '/previews/halloween-pets/'

ROOMS = [
    ('familiars', 'Familiars', 'banshee_familiar.jpg', [
        'pethw_witch_familiar',
        'pethw_banshee_familiar',
        'pethw_demon_familiar',
        'pethw_vampire_familiar',
        'pethw_spider_queen_familiar',
        'pethw_raven_lord_familiar',
        'pethw_headless_horseman_familiar',
    ]),
    ('restless_dead', 'Restless Dead', 'bone_collector_beast.jpg', [
        'pethw_drowned_revenant',
        'pethw_swamp_revenant',
        'pethw_ancient_crypt_beast',
        'pethw_bone_collector_beast',
        'pethw_the_possessed',
        'pethw_death_companion',
        'pethw_the_soul_eater',
    ]),
    ('creatures', 'Creatures', 'blood_moon_beast.jpg', [
        'pethw_hellborn_beast',
        'pethw_blood_moon_beast',
        'pethw_shadow_beast',
        'pethw_plague_beast',
        'pethw_nightmare_creature',
        'pethw_storm_wraith',
        'pethw_frost_wraith',
    ]),
    ('harvest', 'Harvest', 'thorn_king_beast.jpg', [
        'pethw_harvest_god_beast',
        'pethw_thorn_king_beast',
        'pethw_phantom_of_the_forest',
        'pethw_graveyard_guardian',
        'pethw_gargoyle_beast',
        'pethw_spirit_caller',
    ]),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()

    if not os.path.isfile(TARGET):
        sys.exit('FAIL: no registry at %s' % TARGET)
    with open(TARGET, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')

    print('file   : %s  (%d bytes, %s)' % (TARGET, len(raw), 'CRLF' if crlf else 'LF'))

    body = re.search(r'"effects": \[(.*?)\n  \],', text, re.S)
    if not body:
        sys.exit('FAIL: effects array not found.')
    have = re.findall(r'"id": "(pethw_[a-z0-9_]+)"', body.group(1))
    print('effects: %d in the file' % len(have))

    planned = [e for _, _, _, ids in ROOMS for e in ids]
    missing = [e for e in have if e not in planned]
    unknown = [e for e in planned if e not in have]
    dupes = sorted({e for e in planned if planned.count(e) > 1})

    print('\nchecking the plan against the file:')
    print('  %-28s %s' % ('every effect placed',
                          'ok' if not missing else 'FAIL: ' + ', '.join(missing)))
    print('  %-28s %s' % ('no effect invented',
                          'ok' if not unknown else 'FAIL: ' + ', '.join(unknown)))
    print('  %-28s %s' % ('no effect placed twice',
                          'ok' if not dupes else 'FAIL: ' + ', '.join(dupes)))
    over = [(l, len(i)) for _, l, _, i in ROOMS if len(i) > 7]
    print('  %-28s %s' % ('no room over seven',
                          'ok' if not over else 'FAIL: ' + str(over)))

    # The plate has to be on disk. A room card pointing at a missing file
    # paints broken, and the directory is the only thing that knows.
    pdir = os.path.join(REPO, 'public', 'previews', 'halloween-pets')
    noplate = [fn for _, _, fn, _ in ROOMS
               if not os.path.isfile(os.path.join(pdir, fn))]
    print('  %-28s %s' % ('room plates on disk',
                          'ok' if not noplate else 'FAIL: ' + ', '.join(noplate)))

    if missing or unknown or dupes or over or noplate:
        sys.exit('\nNOTHING WRITTEN.')

    print('\nrooms:')
    for _, label, fn, ids in ROOMS:
        print('  %-16s %d   %s' % (label, len(ids), fn))

    silos = ',\n'.join(
        '    {\n      "id": %s,\n      "label": %s,\n      "line": "",\n'
        '      "plate": %s\n    }'
        % (json.dumps(rid), json.dumps(label), json.dumps(PLATE_DIR + fn))
        for rid, label, fn, _ in ROOMS)
    old = re.search(r'  "silos": \[.*?\n  \],', text, re.S)
    if not old:
        sys.exit('FAIL: silos array not found.')
    text = text[:old.start()] + '  "silos": [\n%s\n  ],' % silos + text[old.end():]

    where = {}
    for rid, _, _, ids in ROOMS:
        for e in ids:
            where[e] = rid

    def recat(m):
        return m.group(0).replace('"category": "%s"' % m.group(2),
                                  '"category": "%s"' % where[m.group(1)])

    text, n = re.subn(
        r'"id": "(pethw_[a-z0-9_]+)",\n      "label": "[^"]*",\n      "category": "([a-z0-9_]+)"',
        recat, text)
    print('\n  recategorised %d effects' % n)

    print('\nverifying result:')
    checks = [('every effect recategorised', n == len(have))]
    for rid, _, fn, ids in ROOMS:
        checks.append(('%s holds %d' % (rid, len(ids)),
                       text.count('"category": "%s"' % rid) == len(ids)))
        checks.append(('%s plate' % rid,
                       json.dumps(PLATE_DIR + fn) in text))
    checks.append(('four rooms', text.count('"line": ""') == len(ROOMS)))
    checks.append(('old single silo gone', '"pets_halloween"' not in text))
    for label, ok in checks:
        print('  %-30s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in checks):
        sys.exit('\nNOTHING WRITTEN. Post-write verification failed.')

    out = os.path.join(DOWNLOADS, 'pets-halloween-registry.js')
    if not args.apply:
        print('\nDRY RUN. Re-run with --apply to write')
        print('  %s' % out)
        return

    if crlf:
        text = text.replace('\n', '\r\n')
    with open(out, 'w', encoding='utf-8', newline='') as fh:
        fh.write(text)
    print('\nWROTE %s  (%d bytes)' % (out, len(text)))
    print('\nInstall-File.ps1 public\\pets-halloween-registry.js')
    print('\nFour Curator lines still owed. The rooms paint without them.')


if __name__ == '__main__':
    main()
