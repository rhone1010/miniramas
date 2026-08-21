#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build-halloween-page.py  --  clone public/portraits.html into the Halloween
Series page.

Dry run by default. Nothing is written without --apply, and nothing is
written at all if any assertion fails.

Output goes to  %%USERPROFILE%%\\Downloads\\halloween.html  -- where every
file starts life. Place it with Install-File.ps1 so anything it replaces
is archived to H: rather than overwritten. NO DELETIONS.

    python scripts\\build-halloween-page.py
    python scripts\\build-halloween-page.py --apply

THE PLATES. Twenty-eight, flat in public/previews/halloween/, named
man_<id>.jpg or woman_<id>.jpg. Fourteen and fourteen -- and the two id
sets are DISJOINT. No effect has both plates. The prefix records which
sitter that plate was shot with; it is not a variant axis, and it cannot
be derived from the id. This script reads it off the disk.

Consequence: roomHasBoth needs f[0] AND f[1] and never finds both, so the
man/woman toggle does not appear and the sitter machinery neuters itself.
Do not go cutting it out.

Halloween KEEPS the pose step -- it is a human Series and Portraits' two
stage flow is left intact. That is the one place this differs from the
Pets clone. If that is wrong, say so before the page is built on.

What it changes:

  1  <title>                     the room says what it is
  2  --card-ratio .78 -> 1       Halloween plates are 800x800. This is the
  3  --card-ratio fallback -> 1  Groups crop bug; a fifth of every square
                                 plate was lost at .78.
  4  openWaiting series          hard-coded 'Portraits' -- a craft in
                                 progress filed itself under the wrong room.
  5  savePiece series            same bug, server side.
  6  land() series and label     a THIRD hard-coded series name, the one
                                 that stamps the piece the customer sees.
  7  SERIES_LABEL fallback       an unknown series read as Portraits.
  8  MC default filter           My Collection opened filtered to Portraits.
  9  the five seeds              disarmed already, renamed anyway.
 10  registry src                /halloween-registry.js -- CENG owes it.
 11  previewFor subfolder        Portraits keeps plates in per-effect
                                 folders; these are flat. Left alone every
                                 tile renders blank.
 12  EFFECT_PREVIEWS             rebuilt from what is actually on disk.
                                 Nothing builds a path from an id and hopes.

What it deliberately does NOT change:

  - The lorem footer. Five bays of placeholder are live in portraits.html
    and would clone straight through. Until the copy exists the script
    REFUSES; --allow-lorem overrides that knowingly.
  - The masthead nav. Ruled: two levels, after the pages exist.
  - The pose step. See above.
  - SOFT_LAUNCH. Stays true.
"""

import argparse
import os
import re
import sys
import json

HERE     = os.path.dirname(os.path.abspath(__file__))
REPO     = os.path.dirname(HERE)
SRC      = os.path.join(REPO, 'public', 'portraits.html')
PLATES   = os.path.join(REPO, 'public', 'previews', 'halloween')
OUT      = os.path.join(os.environ.get('USERPROFILE', os.path.expanduser('~')),
                        'Downloads', 'halloween.html')

edits = []   # (label, old, new, count_expected)


def E(label, old, new, n=1):
    edits.append((label, old, new, n))


# ---------------------------------------------------------------- 1  title
E('title',
  '<title>Liten &amp; Co \u2014 Stage + Masthead \u2014 s58 \u2014 2026-07-28</title>',
  '<title>Liten &amp; Co \u2014 Halloween</title>')

# ------------------------------------------------------- 2/3  card ratio
# Halloween plates are square. Assert the definition, not the references --
# ".78" appears elsewhere and an unanchored swap would catch it.
E('card-ratio definition',
  '  --card-ratio:.78;',
  '  --card-ratio:1;            /* Halloween plates are 800x800 */')

E('card-ratio fallback',
  'aspect-ratio:var(--card-ratio, .78);',
  'aspect-ratio:var(--card-ratio, 1);')

# --------------------------------------------------- 4  openWaiting series
E('openWaiting series',
  """        id:       'q' + it.id,
        name:     effectLabel(it.effectId),
        series:   'Portraits',""",
  """        id:       'q' + it.id,
        name:     effectLabel(it.effectId),
        series:   'Halloween',""")

# ----------------------------------------------------- 5  savePiece series
E('savePiece series',
  """        image_b64: item.result.image_b64,
        series:    'portraits',""",
  """        image_b64: item.result.image_b64,
        series:    'halloween',""")

# ------------------------------------------------ 6  SERIES_LABEL fallback
E('SERIES_LABEL fallback',
  "            series:   SERIES_LABEL[p.series] || 'Portraits',",
  "            series:   SERIES_LABEL[p.series] || 'Halloween',")

# ------------------------------------------------------- 7  registry source
E('registry src',
  '<script src="/effect-registry.js"></script>',
  '<script src="/halloween-registry.js"></script>')

# ------------------------------------------------------ 9  the pose bypass

# ------------------------------- 11  land(): a THIRD hard-coded series name
# Not in the Groups carryover, which named only openWaiting and savePiece.
# This one stamps the piece the customer actually sees, at the moment it
# lands, with the room's name in the label as well as the series field.
E('land() series and label',
  """      name:     'Portraits - ' + effectLabel(item.effectId) + ' - ' + n,
      series:   'Portraits',""",
  """      name:     'Halloween - ' + effectLabel(item.effectId) + ' - ' + n,
      series:   'Halloween',""")

# ------------------------------------------- 12  My Collection default filter
# Opening the Halloween room's collection filtered to Portraits would hide the
# customer's own work behind a control they did not touch.
E('MC default filter',
  "  var MC_FILT = 'Portraits';",
  "  var MC_FILT = 'Halloween';")

# ---------------------------------------------------- 13  the seeds, disarmed
# SEED_ON is already false, so these five never render. They are renamed
# anyway: a seed that says Portraits inside halloween.html is a trap for whoever
# flips the switch to test the panel.
E('seed series', "series:'Portraits'", "series:'Halloween'", 5)
E('seed labels',  "name:'Portraits - ", "name:'Halloween - ", 5)


# ------------------------------------------ 14  previewFor: no subfolder
# plateFrom's `sub` flag builds base + id + "/" + file. Portraits plates
# live in per-effect folders; Halloween plates are flat in one directory. Left
# alone this asks for /previews/halloween/ghoul/woman_ghoul.jpg and every
# tile on the floor renders blank.
E('previewFor subfolder',
  """  function previewFor(tileId){
    return plateFrom(PV.files, PV.base, tileId, true);
  }""",
  """  function previewFor(tileId){
    /* false, not true: Halloween plates are flat in /previews/halloween/,
       one per effect, not in a per-effect folder the way Portraits keeps
       them. The sitter prefix is inside the filename, not a folder. */
    return plateFrom(PV.files, PV.base, tileId, false);
  }""")


def read_plates():
    """The prefix is part of the filename and varies per effect -- fourteen
    are man_, fourteen are woman_, and NO id has both. They are not sitter
    pairs. The prefix is read off the disk; it cannot be derived from the id
    and must never be guessed."""
    if not os.path.isdir(PLATES):
        sys.exit('FAIL: no plate directory at %s' % PLATES)
    out, clash = {}, []
    for f in sorted(os.listdir(PLATES)):
        m = re.match(r'^(man|woman)_([a-z0-9_]+)\.(jpg|jpeg|png)$', f)
        if not m:
            print('  skipped (unrecognised): %s' % f)
            continue
        eid = m.group(2)
        if eid in out:
            clash.append(eid)
        out[eid] = [f, '', '']
    if clash:
        print('  NOTE: both sitters present for: %s' % ', '.join(sorted(set(clash))))
        print('  Only one is in the manifest. Say so and the script can pair them.')
    return out


def build_manifest(plates):
    """[man, woman, neutral]. Halloween fills slot 0 only. plateFrom falls through
    `want || f[0] || f[2] || f[1]`, so slot 0 always answers; and roomHasBoth
    needs f[0] AND f[1], so the man/woman toggle never appears. The sitter
    machinery neuters itself -- do not go cutting it out."""
    lines = []
    lines.append('window.EFFECT_PREVIEWS = {')
    lines.append('  base: "/previews/halloween/",')
    lines.append('  siloBase: "/previews/silos/",')
    lines.append('  poseBase: "/previews/pose/",')
    lines.append('  /* GENERATED by scripts/build-halloween-page.py from the contents of')
    lines.append('     public/previews/halloween/. One plate per effect, flat. The man_/')
    lines.append('     woman_ prefix records which sitter that plate was shot with -- it is')
    lines.append('     NOT a variant axis. Fourteen and fourteen, no id holding both, so')
    lines.append('     roomHasBoth stays false and the toggle never appears. Slot 0 only. */')
    lines.append('  files: {')
    keys = sorted(plates.keys())
    for i, k in enumerate(keys):
        comma = '' if i == len(keys) - 1 else ','
        lines.append('    %s: %s%s' % (json.dumps(k), json.dumps(plates[k]), comma))
    lines.append('  },')
    lines.append('  silos: {},')
    lines.append('  poses: {}')
    lines.append('};')
    return '\n'.join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true',
                    help='write the file. Without this, nothing is written.')
    ap.add_argument('--allow-lorem', action='store_true',
                    help='ship the placeholder footer knowingly.')
    args = ap.parse_args()

    if not os.path.isfile(SRC):
        sys.exit('FAIL: no source at %s' % SRC)

    with open(SRC, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()

    # Source is CRLF. Normalise for matching, restore on write, so anchors
    # can be written as plain multi-line strings.
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')
    original_len = len(text)

    print('source : %s  (%d bytes, %s)' %
          (SRC, len(raw), 'CRLF' if crlf else 'LF'))

    # ---- plates -----------------------------------------------------
    plates = read_plates()
    print('plates : %d in public/previews/halloween/' % len(plates))
    if not plates:
        sys.exit('FAIL: no man_/woman_ plates found. Nothing to offer.')

    # ---- 8  the manifest, as its own edit ---------------------------
    m = re.search(r'window\.EFFECT_PREVIEWS = \{.*?\n\};\n', text, re.S)
    if not m:
        sys.exit('FAIL: could not locate the EFFECT_PREVIEWS block.')
    E('EFFECT_PREVIEWS', m.group(0), build_manifest(plates) + '\n')

    # ---- assertions, all of them, before any change -----------------
    print('\nchecking anchors:')
    bad = []
    for label, old, new, n in edits:
        found = text.count(old)
        ok = (found == n)
        print('  %-24s %s  (found %d, expected %d)' %
              (label, 'ok ' if ok else 'FAIL', found, n))
        if not ok:
            bad.append(label)

    # The lorem refusal. Five bays, identical markup, so it is counted
    # rather than anchored.
    lorem = text.count('Lorem ipsum dolor sit amet')
    print('\nplaceholder footer bays in source: %d' % lorem)
    if lorem and not args.allow_lorem:
        print('  REFUSED. Five bays of placeholder are live in portraits.html')
        print('  and would clone straight into a second room. Supply the copy,')
        print('  or re-run with --allow-lorem to ship it knowingly.')
        bad.append('lorem footer')

    if bad:
        print('\nNOTHING WRITTEN. %d check(s) failed: %s' %
              (len(bad), ', '.join(bad)))
        sys.exit(1)

    # ---- apply ------------------------------------------------------
    for label, old, new, n in edits:
        text = text.replace(old, new, n)

    # ---- post-write assertions --------------------------------------
    print('\nverifying result:')
    checks = [
        ("no stray Portraits literal",
         len([ln for ln in text.split('\n')
              if "'Portraits'" in ln
              and 'SERIES_LABEL' not in ln
              and 'MC_SERIES' not in ln]) == 0),
        ("card-ratio is 1",            '--card-ratio:1;' in text),
        ("registry is halloween-registry",  '/halloween-registry.js' in text),
        ("pose step retained",         'Step 1 of 2' in text),
        ("manifest base is halloween",      'base: "/previews/halloween/"' in text),
        ("SOFT_LAUNCH still true",     'var SOFT_LAUNCH = true;' in text),
        ("previewFor is flat",         'PV.base, tileId, false' in text),
        ("Post to Community survived", 'Post to Community' in text),
        ("file did not collapse",      len(text) > original_len * 0.9),
    ]
    for label, ok in checks:
        print('  %-46s %s' % (label, 'ok' if ok else 'FAIL'))
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
    print('\nPlace it with Install-File.ps1 so anything it replaces is')
    print('archived. Do not move it by hand.')


if __name__ == '__main__':
    main()
