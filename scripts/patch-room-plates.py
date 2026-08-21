#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-room-plates.py  --  the picture on a room card.

Two targets, run all four:

    python scripts\\patch-room-plates.py public\\pets-registry.js
    python scripts\\patch-room-plates.py public\\pets-registry.js --apply
    python scripts\\patch-room-plates.py public\\pets.html
    python scripts\\patch-room-plates.py public\\pets.html --apply
    ... and the same two for halloween

Dry run by default. Output to %USERPROFILE%\\Downloads\\<leafname>; install
with Install-File.ps1.

WHY. Every room card in Pets and Halloween paints black. siloArt() reads
window.EFFECT_PREVIEWS.silos, and the build script wrote that as an empty
object -- there was nothing to put in it, because at the time each room
held one silo with no picture chosen.

Rich chose nine, 21 August. Each belongs to the room it fronts, checked
against the membership both ways:

  PETS
    cast_carved     pets_stone.jpg
    by_hand         pets_quilted.jpg
    painted         pets_impressionist.jpg
    another_time    pets_elizabethan.jpg
    make_believe    pets_clockwork.jpg

  HALLOWEEN
    creatures       woman_swamp_creature.jpg
    restless_dead   man_clockwork_corpse.jpg
    old_magic       woman_necromancer.jpg
    harvest         man_haunted_scarecrow.jpg

WHERE IT GOES, AND WHY NOT THE MANIFEST. The obvious fix is to fill
EFFECT_PREVIEWS.silos, which is one edit to one file. It is the wrong
place: that manifest is a snapshot the build script takes of the plate
directory, and it goes stale silently -- the same fault that had
previewFor() answering from a baked list until it was pointed at the
registry's plateFor() this morning.

So the plate goes on the silo row in the registry, beside the label and the
line, and siloArt() asks the registry first. A room now carries its name,
its sentence and its face in one place, which is also the shape CENG's room
map needs to take if any of this is to survive a regeneration.

siloArt() keeps the manifest as a fallback, so a page paired with an older
registry paints exactly as it does today rather than going blank.

THE HALLOWEEN PREFIX. Those four filenames carry man_ or woman_ and it
cannot be derived -- the prefix records which sitter the plate was shot
with, and the two id sets are disjoint. Written out in full for that
reason, not abbreviated to the id.
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

PLATES = {
    'pets-registry.js': ('/previews/pets/', {
        'cast_carved':   'pets_stone.jpg',
        'by_hand':       'pets_quilted.jpg',
        'painted':       'pets_impressionist.jpg',
        'another_time':  'pets_elizabethan.jpg',
        'make_believe':  'pets_clockwork.jpg',
    }),
    'halloween-registry.js': ('/previews/halloween/', {
        'creatures':     'woman_swamp_creature.jpg',
        'restless_dead': 'man_clockwork_corpse.jpg',
        'old_magic':     'woman_necromancer.jpg',
        'harvest':       'man_haunted_scarecrow.jpg',
    }),
}

PAGES = ('pets.html', 'halloween.html')

OLD_SILOART = """  function siloArt(siloId){
    return plateFrom(PV.silos, PV.siloBase || '/previews/silos/', siloId, false);
  }"""

NEW_SILOART = """  function siloArt(siloId){
    /* THE REGISTRY FIRST. A room's picture now sits on its own row beside
       its label and its line, because EFFECT_PREVIEWS is a snapshot the
       build script takes of a directory and goes stale without saying so.
       Same reasoning as previewFor().

       The manifest stays as a fallback so an older registry paints as it
       always did rather than going blank. */
    if (R && R.silos){
      for (var i = 0; i < R.silos.length; i++){
        if (R.silos[i].id === siloId && R.silos[i].plate){
          return R.silos[i].plate;
        }
      }
    }
    return plateFrom(PV.silos, PV.siloBase || '/previews/silos/', siloId, false);
  }"""


def do_registry(text, leaf):
    base, plates = PLATES[leaf]

    block = re.search(r'  "silos": \[(.*?)\n  \],', text, re.S)
    if not block:
        sys.exit('FAIL: silos array not found.')

    rows = re.findall(
        r'\{\s*"id": "([a-z0-9_]+)",\s*"label": ("(?:[^"\\]|\\.)*"),\s*"line": ("(?:[^"\\]|\\.)*")\s*\}',
        block.group(1))
    have = [r[0] for r in rows]

    print('rooms  : %s' % ', '.join(have))
    print('\nchecking:')
    checks = [
        ('every row parsed', len(rows) == len(re.findall(r'"id":', block.group(1)))),
        ('rooms match the plates', sorted(have) == sorted(plates)),
        ('no plate set yet', '"plate"' not in block.group(1)),
    ]
    for label, ok in checks:
        print('  %-28s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in checks):
        if sorted(have) != sorted(plates):
            print('\n  file: %s' % ', '.join(sorted(have)))
            print('  here: %s' % ', '.join(sorted(plates)))
        sys.exit('\nNOTHING WRITTEN.')

    out = []
    for rid, label, line in rows:
        out.append(
            '    {\n      "id": %s,\n      "label": %s,\n      "line": %s,\n'
            '      "plate": %s\n    }'
            % (json.dumps(rid), label, line, json.dumps(base + plates[rid])))
    text = (text[:block.start()] + '  "silos": [\n' + ',\n'.join(out) + '\n  ],'
            + text[block.end():])

    print('\nverifying result:')
    post = [('every room has a plate',
             re.search(r'  "silos": \[(.*?)\n  \],', text, re.S)
             .group(1).count('"plate"') == len(plates))]
    for rid, fn in plates.items():
        post.append(('%s -> %s' % (rid, fn), json.dumps(base + fn) in text))
    return text, post


def do_page(text, leaf):
    print('\nchecking:')
    checks = [
        ('siloArt found', text.count(OLD_SILOART) == 1),
        ('registry alias R exists', re.search(r'\bvar R\b', text) is not None),
    ]
    for label, ok in checks:
        print('  %-28s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in checks):
        sys.exit('\nNOTHING WRITTEN. siloArt has drifted - read it first.')

    text = text.replace(OLD_SILOART, NEW_SILOART, 1)
    post = [
        ('siloArt asks the registry', 'R.silos[i].plate' in text),
        ('manifest fallback kept', 'PV.siloBase' in text),
        ('one siloArt', text.count('function siloArt(') == 1),
    ]
    return text, post


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
    if leaf not in PLATES and leaf not in PAGES:
        sys.exit('FAIL: %s is not a target. Known: %s'
                 % (leaf, ', '.join(sorted(set(PLATES) | set(PAGES)))))

    with open(path, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')
    start_len = len(text)

    print('file   : %s  (%d bytes, %s)' % (path, len(raw), 'CRLF' if crlf else 'LF'))

    if leaf in PLATES:
        text, post = do_registry(text, leaf)
    else:
        text, post = do_page(text, leaf)

    post.append(('file did not collapse', len(text) > start_len * 0.9))
    for label, ok in post:
        print('  %-38s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in post):
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
