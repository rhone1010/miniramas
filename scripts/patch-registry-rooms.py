#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-registry-rooms.py  --  divide the Pets and Halloween effects into
rooms of no more than seven.

    python scripts\\patch-registry-rooms.py public\\pets-registry.js
    python scripts\\patch-registry-rooms.py public\\pets-registry.js --apply
    python scripts\\patch-registry-rooms.py public\\halloween-registry.js
    python scripts\\patch-registry-rooms.py public\\halloween-registry.js --apply

Dry run by default. Output to %USERPROFILE%\\Downloads\\<leafname>; install
with Install-File.ps1.

WHY. Both registries shipped with ONE silo holding everything -- 34 in Pets
and 28 in Halloween. The floor is four across and two down with the eighth
slot given to the upsell card, so it holds seven. Every room on this site
has always worked that way; neither of these does.

CENG generated both files and left the split open, correctly, because it is
not a thing to guess inside a generated file. It is decided here.

THE DIVISION. The same shape Groups uses, which is the only division on the
site a customer has ever seen: what the piece is MADE OF, how it was MADE,
what it was PAINTED with, and WHEN it is from. Nothing cleverer.

  PETS -- 34 into five
    Cast & Carved     7   bronze iron stone alabaster ebony jade
                          polished_gold
    Made by Hand      7   plushy quilted origami porcelain
                          driftwood_resin sheet_music stained_glass
    Painted & Printed 7   pencil_sketch watercolour oil_impasto
                          impressionist cubism art_nouveau ukiyo_e
    Another Time      6   victorian elizabethan persian_court samurai
                          deco_twenties art_deco
    Make Believe      7   clown retro_robot clockwork forest_guardian
                          neon ice sea_glass

    34 does not divide by seven, so one room carries six and its upsell
    card offers six. The floor already handles that -- data-count="6" has
    its own centring rule.

    Make Believe is the weakest of the five names. It holds the ones that
    are not a material, not a painting style and not a period: a clown, a
    robot, a clockwork animal, a forest spirit, neon, ice, sea glass. The
    membership is right; the word is a placeholder for a better one.

  HALLOWEEN -- 28 into four, seven each
    Creatures of the Night  werewolf moon_beast swamp_creature ghoul
                            spider_monarch moth_monarch demon_lord
    The Restless Dead       elegant_vampire clockwork_corpse
                            headless_horseman ghost_pirate cursed_knight
                            the_ferryman porcelain_doll
    Old Magic               gothic_witch dark_wizard necromancer
                            shadow_monarch raven_monarch ice_wraith
                            halloween_monarch
    The Harvest             harvest_god hollow_tree night_bloom
                            living_cathedral haunted_scarecrow
                            lantern_keeper eclipse

WHAT IS NOT DONE HERE.

  The Curator line under each room name is EMPTY, as it is now. That is
  Rich's voice and this lane does not write it. Nine lines are owed.

  The room's own plate -- the picture on the silo card -- is not set. Both
  silo cards currently paint black because EFFECT_PREVIEWS.silos is empty.
  Five and four cards will paint black rather than one. Fixing that means
  choosing which effect's plate represents each room, which is Rich's eye,
  not a script's.

  THE CATALOGUE. These files are GENERATED from lib/v1/pets/
  pets-catalog-35.ts and lib/v1/halloween/halloween-catalog.ts, which are
  CENG's. This patch edits the generated output, so the rooms are real the
  moment it deploys -- and a regeneration by CENG will wipe them. The same
  division has to reach the catalogue or this is temporary. Say so in the
  handoff.
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

PLAN = {
    'pets-registry.js': [
        ('cast_carved', 'Cast & Carved',
         ['bronze', 'iron', 'stone', 'alabaster', 'ebony', 'jade',
          'polished_gold']),
        ('by_hand', 'Made by Hand',
         ['plushy', 'quilted', 'origami', 'porcelain', 'driftwood_resin',
          'sheet_music', 'stained_glass']),
        ('painted', 'Painted & Printed',
         ['pencil_sketch', 'watercolour', 'oil_impasto', 'impressionist',
          'cubism', 'art_nouveau', 'ukiyo_e']),
        ('another_time', 'Another Time',
         ['victorian', 'elizabethan', 'persian_court', 'samurai',
          'deco_twenties', 'art_deco']),
        ('make_believe', 'Make Believe',
         ['clown', 'retro_robot', 'clockwork', 'forest_guardian', 'neon',
          'ice', 'sea_glass']),
    ],
    'halloween-registry.js': [
        ('creatures', 'Creatures of the Night',
         ['werewolf', 'moon_beast', 'swamp_creature', 'ghoul',
          'spider_monarch', 'moth_monarch', 'demon_lord']),
        ('restless_dead', 'The Restless Dead',
         ['elegant_vampire', 'clockwork_corpse', 'headless_horseman',
          'ghost_pirate', 'cursed_knight', 'the_ferryman',
          'porcelain_doll']),
        ('old_magic', 'Old Magic',
         ['gothic_witch', 'dark_wizard', 'necromancer', 'shadow_monarch',
          'raven_monarch', 'ice_wraith', 'halloween_monarch']),
        ('harvest', 'The Harvest',
         ['harvest_god', 'hollow_tree', 'night_bloom', 'living_cathedral',
          'haunted_scarecrow', 'lantern_keeper', 'eclipse']),
    ],
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('target')
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()

    target = args.target.replace('/', os.sep).replace('\\', os.sep)
    path = target if os.path.isabs(target) else os.path.join(REPO, target)
    if not os.path.isfile(path):
        sys.exit('FAIL: no file at %s' % path)

    leaf = os.path.basename(path)
    if leaf not in PLAN:
        sys.exit('FAIL: no plan for %s. Known: %s'
                 % (leaf, ', '.join(sorted(PLAN))))
    rooms = PLAN[leaf]

    with open(path, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')

    print('file   : %s  (%d bytes, %s)' % (path, len(raw), 'CRLF' if crlf else 'LF'))

    # ---- what is actually in the file, read not assumed ---------------
    body = re.search(r'"effects": \[(.*?)\n  \],', text, re.S)
    if not body:
        sys.exit('FAIL: effects array not found in its expected shape.')
    have = re.findall(r'"id": "([a-z0-9_]+)"', body.group(1))
    print('effects: %d in the file' % len(have))

    planned = [e for _, _, ids in rooms for e in ids]
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
    over = [(l, len(i)) for _, l, i in rooms if len(i) > 7]
    print('  %-28s %s' % ('no room over seven',
                          'ok' if not over else 'FAIL: ' + str(over)))
    if missing or unknown or dupes or over:
        sys.exit('\nNOTHING WRITTEN.')

    print('\nrooms:')
    for _, label, ids in rooms:
        print('  %-24s %d' % (label, len(ids)))

    # ---- silos ------------------------------------------------------
    silos = ',\n'.join(
        '    {\n      "id": %s,\n      "label": %s,\n      "line": ""\n    }'
        % (json.dumps(sid), json.dumps(label))
        for sid, label, _ in rooms)
    new_silos = '  "silos": [\n%s\n  ],' % silos

    old_silos = re.search(r'  "silos": \[.*?\n  \],', text, re.S)
    if not old_silos:
        sys.exit('FAIL: silos array not found.')
    text = text[:old_silos.start()] + new_silos + text[old_silos.end():]

    # ---- categories --------------------------------------------------
    where = {}
    for sid, _, ids in rooms:
        for e in ids:
            where[e] = sid

    def recat(m):
        eid = m.group(1)
        return m.group(0).replace('"category": "%s"' % m.group(2),
                                  '"category": "%s"' % where[eid])

    text, n = re.subn(
        r'"id": "([a-z0-9_]+)",\n      "label": "[^"]*",\n      "category": "([a-z0-9_]+)"',
        recat, text)
    print('\n  recategorised %d effects' % n)

    print('\nverifying result:')
    checks = [('every effect recategorised', n == len(have))]
    for sid, _, ids in rooms:
        got = text.count('"category": "%s"' % sid)
        checks.append(('%s holds %d' % (sid, len(ids)), got == len(ids)))
    checks.append(('one silo entry per room',
                   text.count('"line": ""') == len(rooms)))
    checks.append(('old single silo gone',
                   '"id": "%s",\n      "label": "%s"'
                   % (leaf.split('-')[0], leaf.split('-')[0].title()) not in text))
    for label, ok in checks:
        print('  %-30s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in checks):
        sys.exit('\nNOTHING WRITTEN. Post-write verification failed.')

    out = os.path.join(DOWNLOADS, leaf)
    if not args.apply:
        print('\nDRY RUN. Re-run with --apply to write')
        print('  %s' % out)
        return

    if crlf:
        text = text.replace('\n', '\r\n')
    with open(out, 'w', encoding='utf-8', newline='') as fh:
        fh.write(text)
    print('\nWROTE %s  (%d bytes)' % (out, len(text)))
    print('\nInstall-File.ps1 %s' % target)


if __name__ == '__main__':
    main()
