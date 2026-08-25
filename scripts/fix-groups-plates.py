#!/usr/bin/env python3
# fix-groups-plates.py - 24 August 2026
#
# Renames the Groups plates IN PLACE in public\previews\groups so every file
# is groups_<effect_id>.jpg - the exact path the registry derives.
#
# CENG's promised rename (r02 #6) never ran: 19 .jpeg extensions and five
# wrong names shipped, so 33 of 34 cards were blank in production.
#
# SAFETY:
#   - Every target id is verified to exist in public\groups-registry.js
#     BEFORE any rename. One unknown id refuses the whole run.
#   - Nothing is deleted. The duplicate groups_stained_glass.jpeg becomes
#     groups_stained_glass_jpeg_STALE.bak (the .jpg committed 24 Aug is the
#     live plate).
#   - Dry-run by default. Pass --do to actually rename.

import os, re, sys

DO = '--do' in sys.argv

HERE = os.path.dirname(os.path.abspath(__file__))
repo = HERE
while repo and not os.path.isdir(os.path.join(repo, 'public')):
    p = os.path.dirname(repo)
    if p == repo: break
    repo = p
PLATES = os.path.join(repo, 'public', 'previews', 'groups')
REG    = os.path.join(repo, 'public', 'groups-registry.js')

def die(m):
    print('\nREFUSED: ' + m + '\n'); sys.exit(1)

if not os.path.isdir(PLATES): die('plate dir not found: ' + PLATES)
if not os.path.isfile(REG):   die('registry not found: ' + REG)
reg = open(REG, encoding='utf-8').read()

def in_reg(i):
    return re.search(r'["\']' + re.escape(i) + r'["\']', reg) is not None

# wrong basename -> catalogue id. watercolour spelling is read from the
# registry rather than guessed.
WATER = 'watercolour' if in_reg('watercolour') else 'watercolor'
REMAP = {
    'gold':           'polished_gold',
    'granite_lichen': 'lichen_granite',
    'driftwood':      'driftwood_resin',
    'mosaic':         'family_mosaic',
    'watercolor':     WATER,
}
STALE = ['groups_stained_glass.jpeg']   # duplicate; the .jpg is the plate

files = sorted(os.listdir(PLATES))
plan, errs = [], []

for f in files:
    if not f.startswith('groups_'): continue
    if f in STALE:
        plan.append((f, f.replace('.jpeg', '_jpeg_STALE.bak'), 'stale duplicate'))
        continue
    m = re.match(r'groups_(.+?)\.(jpe?g)$', f, re.I)
    if not m: continue
    base = m.group(1)
    tid  = REMAP.get(base, base)
    want = 'groups_' + tid + '.jpg'
    if not in_reg(tid):
        errs.append(f + ' -> id "' + tid + '" NOT in registry')
        continue
    if want != f:
        if os.path.exists(os.path.join(PLATES, want)):
            errs.append(f + ' -> ' + want + ' ALREADY EXISTS')
            continue
        plan.append((f, want, 'rename' if base != tid else 'extension'))

if errs: die('nothing renamed:\n  - ' + '\n  - '.join(errs))
if not plan:
    print('\nNothing to do - every plate already matches its id.\n'); sys.exit(0)

print('\n%d renames%s:\n' % (len(plan), '' if DO else ' (DRY RUN - pass --do)'))
for old, new, why in plan:
    print('  %-42s -> %-42s %s' % (old, new, why))
    if DO:
        os.rename(os.path.join(PLATES, old), os.path.join(PLATES, new))
print('\n' + ('Done. git add -A and commit.' if DO else 'Nothing moved.') + '\n')
