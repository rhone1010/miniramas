#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build-pets-halloween-page.py  --  clone public/pets.html into the second
pet room.

    python scripts\\build-pets-halloween-page.py
    python scripts\\build-pets-halloween-page.py --apply

Dry run by default. Output to %USERPROFILE%\\Downloads\\pets-halloween.html;
install with Install-File.ps1.

THE SOURCE IS pets.html, NOT portraits.html. Pets already carries the
fifteen fixes the Portraits clone needed -- the square-plate ratio, the
three hard-coded series names, the collection filter, the derived
ROUTE_ACCEPTS, the flat plate path, previewFor asking the registry, the
credits return flag, the canonical Series menu, the two-over-three silo
floor. Cloning Portraits again would reintroduce every one of them.

WHAT CHANGES

  1  <title>                     the room says what it is
  2  masthead label              was "Crafted Pets"
  3  registry                    /pets-halloween-registry.js
  4  GENERATE_URL                /api/v1/halloween/generate
  5  ANALYZE_URL                 UNCHANGED - /api/v1/pets/analyze. It is an
                                 animal in the photograph either way, and
                                 the pet analyzer is the one that reads it.
                                 Only the generator differs.
  6  the three series names      openWaiting, land() and savePiece
  7  SERIES_LABEL                a halloween key, see below
  8  MC_SERIES                   Halloween added, see below
  9  EFFECT_PREVIEWS             rebuilt from public/previews/halloween-pets/
 10  siloFloor five-up rule      removed; this room has four, not five

WHAT THIS ROOM DOES NOT GET

  A pose floor. CENG: poses is empty and the route carries no pose field.
  Already absent in pets.html, so nothing to remove.

  A framing control. CENG, on Rich's ruling of 21 August: the human
  Halloween room appends a chest-to-head line and this one appends nothing,
  because it is working without constraints. Nothing on the glass should
  offer one.

THE PREFIX. Ids carry pethw_ and plates do not -- the folder name already
says what the prefix says. previewFor() asks the registry's plateFor()
first, and that does the stripping, so the manifest below is only a
fallback. It is generated with the same stripping so the two agree.

ALWAYS SEND THE PREFIXED ID TO THE ROUTE. The stripping is for the filename
and nowhere else; a pet id with the prefix dropped is a 400. Nothing in the
glass strips it -- the tile id goes to the route untouched -- but it is the
one thing in this room that would look like a tidy-up and would break it.

---------------------------------------------------------------------------
A DEFECT FOUND WHILE READING, AND FIXED HERE FOR THIS FILE ONLY
---------------------------------------------------------------------------

MC_SERIES is the filter row in My Collection and reads

    ['Action','Groups','Mobile Wallpapers','Pets','Portraits']

SERIES_LABEL is the map from the stored series to what a piece is called,
and has keys for portraits, pets, groups, action, actionmini and wallpapers.

NEITHER KNOWS ABOUT HALLOWEEN. So every piece crafted in the human
Halloween room since this morning stores series 'halloween', gets no label
from SERIES_LABEL, and has no filter to appear under -- findable only by
View All. That is mine, from this morning's clone, and it is live now.

This script adds the key and the filter, so pets-halloween.html is correct
from the first deploy. **public/halloween.html NEEDS THE SAME EDIT AND THIS
SCRIPT DOES NOT TOUCH IT.** So do portraits, pets and groups, since all
four share one collection and any of them may be the page a customer has
open when a Halloween piece lands.

PETS HALLOWEEN FILES UNDER 'Pets'. Ruled here, and worth Rich overturning
if it is wrong: a customer with two pet rooms has one body of pet work, and
splitting it across two filters makes them remember which room a piece came
from. The human Halloween room keeps its own filter because those are
photographs of people. If Halloween should instead gather everything made
for Halloween whatever the subject, this is one string.
"""

import argparse
import os
import re
import sys
import json

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SRC = os.path.join(REPO, 'public', 'pets.html')
PLATES = os.path.join(REPO, 'public', 'previews', 'halloween-pets')
REG = os.path.join(REPO, 'public', 'pets-halloween-registry.js')
DOWNLOADS = os.path.join(
    os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Downloads')
OUT = os.path.join(DOWNLOADS, 'pets-halloween.html')

edits = []


def E(label, old, new, n=1):
    edits.append((label, old, new, n))


E('title',
  '<title>Liten &amp; Co \u2014 Pets</title>',
  '<title>Liten &amp; Co \u2014 Pets Halloween</title>')

E('masthead label',
  '<span id="mhSeriesLabel"><span class="mh-crafted">Crafted </span>Pets</span>',
  '<span id="mhSeriesLabel"><span class="mh-crafted">Crafted </span>Pets Halloween</span>')

E('registry',
  '<script src="/pets-registry.js"></script>',
  '<script src="/pets-halloween-registry.js"></script>')

E('GENERATE_URL',
  "  var GENERATE_URL       = '/api/v1/pets/generate';",
  "  /* The HUMAN Halloween route, deliberately. It takes these 27 and the\n"
  "     human 28 both, and branches on the pethw_ prefix. There is no\n"
  "     pets-halloween endpoint and CENG says there should not be one.\n"
  "     ANALYZE_URL above stays on the pet analyzer - it is an animal in\n"
  "     the photograph either way. */\n"
  "  var GENERATE_URL       = '/api/v1/halloween/generate';")

E('land() series and label',
  """      name:     'Pets - ' + effectLabel(item.effectId) + ' - ' + n,
      series:   'Pets',""",
  """      name:     'Pets Halloween - ' + effectLabel(item.effectId) + ' - ' + n,
      /* Files under Pets, not Halloween. A customer with two pet rooms has
         one body of pet work; splitting it across two filters makes them
         remember which room a piece came from. */
      series:   'Pets',""")

E('savePiece series',
  "        series:    'pets',",
  "        series:    'pets',   /* see land() - one collection for both pet rooms */")

E('SERIES_LABEL halloween key',
  """  var SERIES_LABEL = { portraits:'Portraits', pets:'Pets', groups:'Groups',
                       action:'Action', actionmini:'Action',
                       wallpapers:'Mobile Wallpapers' };""",
  """  /* halloween was missing, so every piece from the human Halloween room
     stored a series this map could not name. Added 21 August. The same
     line is needed in portraits, pets, groups and halloween. */
  var SERIES_LABEL = { portraits:'Portraits', pets:'Pets', groups:'Groups',
                       halloween:'Halloween',
                       action:'Action', actionmini:'Action',
                       wallpapers:'Mobile Wallpapers' };""")

E('MC_SERIES halloween filter',
  "  var MC_SERIES = ['Action','Groups','Mobile Wallpapers','Pets','Portraits'];",
  "  /* Halloween was missing, so pieces from that room had no filter to\n"
  "     appear under and were reachable only by View All. */\n"
  "  var MC_SERIES = ['Action','Groups','Halloween','Mobile Wallpapers','Pets','Portraits'];")


def read_plates():
    """Read the directory. The ids carry pethw_ and the files do not, so the
    two are matched by stripping - never by assuming they line up."""
    if not os.path.isdir(PLATES):
        sys.exit('FAIL: no plate directory at %s' % PLATES)
    files = {}
    for f in sorted(os.listdir(PLATES)):
        m = re.match(r'^([a-z0-9_]+)\.(jpg|jpeg|png)$', f)
        if not m:
            print('  skipped (unrecognised): %s' % f)
            continue
        files[m.group(1)] = f
    return files


def read_registry_ids():
    """The catalogue is the contract. Read it rather than derive ids from
    filenames - CENG verified 27 against 27 both ways and this checks that
    is still true rather than trusting the note."""
    if not os.path.isfile(REG):
        sys.exit('FAIL: no registry at %s' % REG)
    with open(REG, 'r', encoding='utf-8', errors='replace') as fh:
        s = fh.read()
    body = re.search(r'"effects": \[(.*?)\n  \],', s, re.S)
    if not body:
        sys.exit('FAIL: could not read the effects array from the registry.')
    return re.findall(r'"id": "(pethw_[a-z0-9_]+)"', body.group(1))


def build_manifest(ids, files):
    lines = ['window.EFFECT_PREVIEWS = {',
             '  base: "/previews/halloween-pets/",',
             '  siloBase: "/previews/silos/",',
             '  poseBase: "/previews/pose/",',
             '  /* GENERATED by scripts/build-pets-halloween-page.py from the contents',
             '     of public/previews/halloween-pets/, keyed by the catalogue id.',
             '     The id carries pethw_ and the file does not - the folder name',
             '     already says what the prefix says. Only a fallback: previewFor()',
             '     asks the registry plateFor() first, which does the same stripping. */',
             '  files: {']
    for i, eid in enumerate(ids):
        comma = '' if i == len(ids) - 1 else ','
        fn = files[eid[len('pethw_'):]]
        lines.append('    %s: %s%s' % (json.dumps(eid), json.dumps([fn, '', '']), comma))
    lines += ['  },', '  silos: {},', '  poses: {}', '};']
    return '\n'.join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()

    if not os.path.isfile(SRC):
        sys.exit('FAIL: no source at %s' % SRC)
    with open(SRC, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')
    start_len = len(text)

    print('source : %s  (%d bytes, %s)' % (SRC, len(raw), 'CRLF' if crlf else 'LF'))

    ids = read_registry_ids()
    files = read_plates()
    print('catalog: %d effects' % len(ids))
    print('plates : %d files in public/previews/halloween-pets/' % len(files))

    stripped = [e[len('pethw_'):] for e in ids]
    no_plate = [e for e in stripped if e not in files]
    no_id = [f for f in files if f not in stripped]
    print('\nmatching the catalogue to the directory:')
    print('  %-28s %s' % ('every effect has a plate',
                          'ok' if not no_plate else 'FAIL: ' + ', '.join(no_plate)))
    print('  %-28s %s' % ('no orphan plates',
                          'ok' if not no_id else 'FAIL: ' + ', '.join(no_id)))
    if no_plate or no_id:
        sys.exit('\nNOTHING WRITTEN.')

    m = re.search(r'window\.EFFECT_PREVIEWS = \{.*?\n\};\n', text, re.S)
    if not m:
        sys.exit('FAIL: could not locate the EFFECT_PREVIEWS block.')
    E('EFFECT_PREVIEWS', m.group(0), build_manifest(ids, files) + '\n')

    # This room has four rooms, not five. The rule would never fire, but a
    # dead rule for a layout this room does not have is a trap for whoever
    # reads it next.
    five = re.search(r'/\* ---- FIVE ROOMS LAY TWO OVER THREE.*?nth-child\(5\)\{[^\n]*\n',
                     text, re.S)
    if five:
        E('five-up rule removed', five.group(0),
          '/* The five-up silo rule from pets.html is not here: this room has\n'
          '   four. Add the 2x2 with scripts/patch-silo-2x2.py. */\n')
    else:
        print('\n  NOTE: no five-up rule in the source. Run patch-silo-five.py on')
        print('  pets.html first, or this clone is being taken from a stale file.')

    print('\nchecking anchors:')
    bad = []
    for label, old, new, n in edits:
        found = text.count(old)
        ok = found == n
        print('  %-26s %s  (found %d, expected %d)' %
              (label, 'ok ' if ok else 'FAIL', found, n))
        if not ok:
            bad.append(label)
    if bad:
        print('\nNOTHING WRITTEN. Failed: %s' % ', '.join(bad))
        sys.exit(1)

    for label, old, new, n in edits:
        text = text.replace(old, new, n)

    print('\nverifying result:')
    checks = [
        ('registry is pets-halloween', '/pets-halloween-registry.js' in text),
        ('generate is the halloween route',
         "'/api/v1/halloween/generate'" in text),
        ('analyze is still the pet one', "'/api/v1/pets/analyze'" in text),
        ('manifest base', 'base: "/previews/halloween-pets/"' in text),
        ('manifest keys carry the prefix', '"pethw_' in text),
        ('SERIES_LABEL knows halloween', "halloween:'Halloween'," in text),
        ('MC_SERIES knows Halloween', "'Groups','Halloween'," in text),
        ('previewFor asks the registry', 'R.plateFor(tileId)' in text),
        ('no five-up silo rule', '#siloFloor[data-count="5"]' not in text),
        ('SOFT_LAUNCH still true', 'var SOFT_LAUNCH = true;' in text),
        ('Post to Community survived', 'Post to Community' in text),
        ('no pose step', 'choose a pose' not in text),
        ('file did not collapse', len(text) > start_len * 0.75),
    ]
    for label, ok in checks:
        print('  %-34s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in checks):
        sys.exit('\nNOTHING WRITTEN. Post-write verification failed.')

    if not args.apply:
        print('\nDRY RUN. All checks passed. Re-run with --apply to write')
        print('  %s' % OUT)
        return

    if crlf:
        text = text.replace('\n', '\r\n')
    with open(OUT, 'w', encoding='utf-8', newline='') as fh:
        fh.write(text)
    print('\nWROTE %s  (%d bytes)' % (OUT, len(text)))
    print('\nInstall-File.ps1 public\\pets-halloween.html')
    print('\nThen: middleware needs /pets/halloween, the registry needs its')
    print('four rooms, and portraits/pets/groups/halloween all need the')
    print('SERIES_LABEL and MC_SERIES lines this file just got.')


if __name__ == '__main__':
    main()
