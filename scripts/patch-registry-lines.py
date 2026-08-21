#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-registry-lines.py  --  the Curator's line under each room name.

    python scripts\\patch-registry-lines.py public\\pets-registry.js
    python scripts\\patch-registry-lines.py public\\pets-registry.js --apply
    python scripts\\patch-registry-lines.py public\\halloween-registry.js
    python scripts\\patch-registry-lines.py public\\halloween-registry.js --apply

Dry run by default. Output to %USERPROFILE%\\Downloads\\<leafname>; install
with Install-File.ps1.

WHY. patch-registry-rooms.py divided both rooms and left every `line` empty
on purpose -- the Curator's voice is Rich's and this lane does not write it.
Rich wrote the nine on 21 August. This puts them in, and nothing else.

The membership is not touched. If the room ids are not already the nine
below, this refuses rather than half-applying -- run patch-registry-rooms.py
first.

TWO LABELS ALSO CHANGE, because Rich's lines renamed the rooms:

  painted        "Painted & Printed"  ->  "Painted"
                 The line reads "Pencil, pigment and brushwork" -- there is
                 no printing in it, and a card whose name promises a thing
                 its own line does not mention is the sort of small wrongness
                 that reads as carelessness.

  Halloween      "Creatures of the Night" -> "Creatures"
                 "The Restless Dead"      -> "Restless Dead"
                 "Old Magic"              -> "Old Magic"     (unchanged)
                 "The Harvest"            -> "Harvest"
                 Rich's lines drop the articles. The card and the line under
                 it should agree.

TWO PETS LINES DIVERGE FROM GROUPS ON PURPOSE. Ruled by Rich, 21 August.
The five Pets rooms take the Groups wording almost verbatim, because it is
the same division and a customer walking from one Series to another should
hear the same studio. But two of the Groups lines are about people:

  cast_carved   Groups says "Everybody in one material". A Pets room holds
                one animal, not a family, so it reads "Your animal".
  another_time  Groups says "Your portrait". Same reason -- it is the pet
                that sat, not the customer.

GENERATED FILES. Both of these are emitted from CENG's catalogues. A
regeneration wipes this. The lines have to reach the room map CENG is
building or they are temporary -- the same warning that came with the
division itself.
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

# room id -> (label, line)
COPY = {
    'pets-registry.js': {
        'cast_carved': (
            'Cast & Carved',
            'Here are the Cast & Carved effects. Your animal in one material, '
            'worked as a single piece.'),
        'by_hand': (
            'Made by Hand',
            "Here are the Made by Hand effects. Softer work, with the maker's "
            'hand still on it.'),
        'painted': (
            'Painted',
            'Here are the Painted effects. Pencil, pigment and brushwork, each '
            'with its own hand.'),
        'another_time': (
            'Another Time',
            'Here are the Another Time effects. Your animal, made in a time not '
            'its own.'),
        'make_believe': (
            'Make Believe',
            'Here are the Make Believe effects. A few stranger ways to become '
            'someone else.'),
    },
    'halloween-registry.js': {
        'creatures': (
            'Creatures',
            'Here are the Creatures. Beasts, monsters and things better left in '
            'the dark.'),
        'restless_dead': (
            'Restless Dead',
            'Here are the Restless Dead. Some elegant, some cursed, none quite '
            'finished.'),
        'old_magic': (
            'Old Magic',
            'Here is the Old Magic. Witches, wraiths and powers that have been '
            'waiting a very long time.'),
        'harvest': (
            'Harvest',
            'Here is the Harvest. Old gods, hollow things and what comes out '
            'after dark.'),
    },
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
    if leaf not in COPY:
        sys.exit('FAIL: no copy for %s' % leaf)
    copy = COPY[leaf]

    with open(path, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')

    print('file   : %s  (%d bytes, %s)' % (path, len(raw), 'CRLF' if crlf else 'LF'))

    block = re.search(r'  "silos": \[(.*?)\n  \],', text, re.S)
    if not block:
        sys.exit('FAIL: silos array not found.')

    have = re.findall(r'"id": "([a-z0-9_]+)"', block.group(1))
    print('rooms  : %s' % ', '.join(have))

    print('\nchecking:')
    checks = [
        ('rooms match the copy', sorted(have) == sorted(copy)),
        ('every line still empty', block.group(1).count('"line": ""') == len(have)),
    ]
    for label, ok in checks:
        print('  %-28s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in checks):
        if sorted(have) != sorted(copy):
            print('\n  the file has: %s' % ', '.join(sorted(have)))
            print('  the copy has: %s' % ', '.join(sorted(copy)))
            print('  Run patch-registry-rooms.py first.')
        sys.exit('\nNOTHING WRITTEN.')

    # Rebuild the array in the file's own order, so a room never moves.
    out = []
    for rid in have:
        label, line = copy[rid]
        out.append('    {\n      "id": %s,\n      "label": %s,\n      "line": %s\n    }'
                   % (json.dumps(rid), json.dumps(label), json.dumps(line)))
    text = (text[:block.start()] + '  "silos": [\n' + ',\n'.join(out) + '\n  ],'
            + text[block.end():])

    print('\nverifying result:')
    post = [('no empty line left',
             re.search(r'  "silos": \[(.*?)\n  \],', text, re.S)
             .group(1).count('"line": ""') == 0)]
    for rid, (label, line) in copy.items():
        post.append(('%s carries its line' % rid, json.dumps(line)[1:-1] in text))
        post.append(('%s label' % rid, '"label": %s' % json.dumps(label) in text))
    post.append(('effects untouched',
                 text.count('"category":') == raw.replace('\r\n', '\n').count('"category":')))
    for label, ok in post:
        print('  %-32s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in post):
        sys.exit('\nNOTHING WRITTEN. Post-write verification failed.')

    dest = os.path.join(DOWNLOADS, leaf)
    if not args.apply:
        print('\nDRY RUN. Re-run with --apply to write')
        print('  %s' % dest)
        return

    if crlf:
        text = text.replace('\n', '\r\n')
    with open(dest, 'w', encoding='utf-8', newline='') as fh:
        fh.write(text)
    print('\nWROTE %s  (%d bytes)' % (dest, len(text)))
    print('\nInstall-File.ps1 %s' % target)


if __name__ == '__main__':
    main()
