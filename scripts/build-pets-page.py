#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build-pets-page.py  --  clone public/portraits.html into the Pets Series page.

Dry run by default. Nothing is written without --apply, and nothing is
written at all if any assertion fails.

Output goes to  public/pets.html.new  -- NOT to public/pets.html.
Place it with Install-File.ps1 so the existing (pre-brand, dead) pets.html
is archived to H: rather than overwritten. NO DELETIONS.

    python scripts\\build-pets-page.py
    python scripts\\build-pets-page.py --apply

What it changes, and why each one is here:

  1  <title>                     the room says what it is
  2  --card-ratio .78 -> 1       Pets plates are 800x800. This is the Groups
  3  --card-ratio fallback -> 1  crop bug; a fifth of every square plate was
                                 lost at .78.
  4  openWaiting series          hard-coded 'Portraits' -- a craft in progress
                                 filed itself under the wrong room.
  5  savePiece series            same bug, server side.
  6  SERIES_LABEL fallback       an unknown series read as Portraits.
  7  registry src                /pets-registry.js -- CENG owes this file.
  8  EFFECT_PREVIEWS             rebuilt from what is actually on disk in
                                 public/previews/pets/. Nothing builds a path
                                 from an id and hopes.
  9  tbcGo click handler         Pets has no pose step. Craft directly.
 10  labelGo button text         the Groups lie: the button still said
                                 "Next - choose a pose, Step 1 of 2" and then
                                 charged. Both halves or neither.

What it deliberately does NOT change:

  - The lorem footer. Five bays of placeholder are in portraits.html right
    now and would clone straight through. Rich owes the copy; until then the
    script REFUSES rather than shipping placeholder into a second room.
    Pass --allow-lorem to override that refusal knowingly.
  - The masthead nav. Ruled: built in two levels after the pages exist.
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
PLATES   = os.path.join(REPO, 'public', 'previews', 'pets')
OUT      = os.path.join(REPO, 'public', 'pets.html.new')

edits = []   # (label, old, new, count_expected)


def E(label, old, new, n=1):
    edits.append((label, old, new, n))


# ---------------------------------------------------------------- 1  title
E('title',
  '<title>Liten &amp; Co \u2014 Stage + Masthead \u2014 s58 \u2014 2026-07-28</title>',
  '<title>Liten &amp; Co \u2014 Pets</title>')

# ------------------------------------------------------- 2/3  card ratio
# Pets plates are square. Assert the definition, not the references --
# ".78" appears elsewhere and an unanchored swap would catch it.
E('card-ratio definition',
  '  --card-ratio:.78;',
  '  --card-ratio:1;            /* Pets plates are 800x800 */')

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
        series:   'Pets',""")

# ----------------------------------------------------- 5  savePiece series
E('savePiece series',
  """        image_b64: item.result.image_b64,
        series:    'portraits',""",
  """        image_b64: item.result.image_b64,
        series:    'pets',""")

# ------------------------------------------------ 6  SERIES_LABEL fallback
E('SERIES_LABEL fallback',
  "            series:   SERIES_LABEL[p.series] || 'Portraits',",
  "            series:   SERIES_LABEL[p.series] || 'Pets',")

# ------------------------------------------------------- 7  registry source
E('registry src',
  '<script src="/effect-registry.js"></script>',
  '<script src="/pets-registry.js"></script>')

# ------------------------------------------------------ 9  the pose bypass
E('tbcGo handler',
  """  if (tbcGo) tbcGo.addEventListener('click', function(){
    if (workshop.classList.contains('workshop-view--poses')){""",
  """  if (tbcGo) tbcGo.addEventListener('click', function(){
    /* Pets has no pose step -- ruled 2026-08-20. The stage still exists in
       the markup and is simply never entered, so this is a straight run.
       labelGo is changed in the same patch: Groups shipped with the handler
       short-circuited and the button still promising a pose, which charged
       the customer under a sentence that was not true. */
    if (true){""")

E('labelGo pose text',
  """    } else {
      tbcGoVerb.textContent = 'Next';
      tbcGoN.textContent    = '\\u00b7 choose a pose';
      tbcGoSub.textContent  = 'Step 1 of 2 \\u00b7 ' + credits;
    }""",
  """    } else {
      /* Unreachable in Pets -- there is no pose view to be outside of --
         but it must not promise a second step if it ever is reached. */
      tbcGoVerb.textContent = 'Craft';
      tbcGoN.textContent    = n === 1 ? 'this piece' : ('all ' + n);
      tbcGoSub.textContent  = credits;
    }""")

E('labelGo step 2 text',
  """      tbcGoVerb.textContent = 'Craft';
      tbcGoN.textContent    = n === 1 ? 'this piece' : ('all ' + n);
      tbcGoSub.textContent  = 'Step 2 of 2 \\u00b7 ' + credits;""",
  """      tbcGoVerb.textContent = 'Craft';
      tbcGoN.textContent    = n === 1 ? 'this piece' : ('all ' + n);
      tbcGoSub.textContent  = credits;   /* one step in Pets, so no count */""")


# ------------------------------- 11  land(): a THIRD hard-coded series name
# Not in the Groups carryover, which named only openWaiting and savePiece.
# This one stamps the piece the customer actually sees, at the moment it
# lands, with the room's name in the label as well as the series field.
E('land() series and label',
  """      name:     'Portraits - ' + effectLabel(item.effectId) + ' - ' + n,
      series:   'Portraits',""",
  """      name:     'Pets - ' + effectLabel(item.effectId) + ' - ' + n,
      series:   'Pets',""")

# ------------------------------------------- 12  My Collection default filter
# Opening the Pets room's collection filtered to Portraits would hide the
# customer's own work behind a control they did not touch.
E('MC default filter',
  "  var MC_FILT = 'Portraits';",
  "  var MC_FILT = 'Pets';")

# ---------------------------------------------------- 13  the seeds, disarmed
# SEED_ON is already false, so these five never render. They are renamed
# anyway: a seed that says Portraits inside pets.html is a trap for whoever
# flips the switch to test the panel.
E('seed series', "series:'Portraits'", "series:'Pets'", 5)
E('seed labels',  "name:'Portraits - ", "name:'Pets - ", 5)


# ------------------------------------------ 14  previewFor: no subfolder
# plateFrom's `sub` flag builds base + id + "/" + file. Portraits plates
# live in per-effect folders; Pets plates are flat in one directory. Left
# alone this asks for /previews/pets/alabaster/pets_alabaster.jpg and every
# tile on the floor renders blank.
E('previewFor subfolder',
  """  function previewFor(tileId){
    return plateFrom(PV.files, PV.base, tileId, true);
  }""",
  """  function previewFor(tileId){
    /* false, not true: Pets plates are flat in /previews/pets/, one per
       effect, not in a per-effect folder the way Portraits keeps them. */
    return plateFrom(PV.files, PV.base, tileId, false);
  }""")


def read_plates():
    """The manifest is built from the directory, not from a handoff. The
    Groups plate contract said every plate derived from its id and the
    directory disagreed on twenty-three of twenty-eight."""
    if not os.path.isdir(PLATES):
        sys.exit('FAIL: no plate directory at %s' % PLATES)
    files = sorted(os.listdir(PLATES))
    out = {}
    for f in files:
        m = re.match(r'^pets_([a-z0-9_]+)\.(jpg|jpeg|png)$', f)
        if not m:
            print('  skipped (unrecognised): %s' % f)
            continue
        out[m.group(1)] = [f, '', '']
    return out


def build_manifest(plates):
    """[man, woman, neutral]. Pets fills slot 0 only. plateFrom falls through
    `want || f[0] || f[2] || f[1]`, so slot 0 always answers; and roomHasBoth
    needs f[0] AND f[1], so the man/woman toggle never appears. The sitter
    machinery neuters itself -- do not go cutting it out."""
    lines = []
    lines.append('window.EFFECT_PREVIEWS = {')
    lines.append('  base: "/previews/pets/",')
    lines.append('  siloBase: "/previews/silos/",')
    lines.append('  poseBase: "/previews/pose/",')
    lines.append('  /* GENERATED by scripts/build-pets-page.py from the contents of')
    lines.append('     public/previews/pets/. Pets plates are one per effect, flat, with')
    lines.append('     no sitter -- a dog has no gender toggle. Slot 0 only. */')
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
    print('plates : %d in public/previews/pets/' % len(plates))
    if not plates:
        sys.exit('FAIL: no pets_<id> plates found. Nothing to offer.')

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
        ("no quoted 'Portraits' outside the lookup tables",
         len([ln for ln in text.split('\n')
              if "'Portraits'" in ln
              and 'SERIES_LABEL' not in ln
              and 'MC_SERIES' not in ln]) == 0),
        ("card-ratio is 1",            '--card-ratio:1;' in text),
        ("registry is pets-registry",  '/pets-registry.js' in text),
        ("no 'choose a pose'",         'choose a pose' not in text),
        ("no 'Step 1 of 2'",           'Step 1 of 2' not in text),
        ("manifest base is pets",      'base: "/previews/pets/"' in text),
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
    print('\nPlace it with Install-File.ps1 so the existing pets.html is')
    print('archived. Do not move it by hand.')


if __name__ == '__main__':
    main()
