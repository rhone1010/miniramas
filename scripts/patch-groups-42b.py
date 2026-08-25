#!/usr/bin/env python3
# patch-groups-42b.py
#
# CUI 42B - 24 August 2026. Requires 42A already installed.
# Reads  <repo>\public\groups.html -> writes %USERPROFILE%\Downloads\groups.html
#
# Strips MATERIAL_LOCATIONS, DEFAULT_LOCATION, checkLocations, __UNMAPPED,
# locationForEffect, and `location` from the payload. CENG r02 follow-up:
# GroupsGenerateRequest accepts source_images_b64, effect_id, subject_count,
# skip_scoring - `location` has been discarded on arrival since the
# flat-catalogue port. Pedestals do not exist in Groups.
#
# ALL-OR-NOTHING: every anchor asserted exactly-once before anything is written.

import os, sys

def die(m):
    print('\n[42B] REFUSED: ' + m + '\n'); sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
repo = HERE
while repo and not os.path.isdir(os.path.join(repo, 'public')):
    p = os.path.dirname(repo)
    if p == repo: break
    repo = p
SRC = os.path.join(repo, 'public', 'groups.html')
OUT = os.path.join(os.path.expanduser('~'), 'Downloads', 'groups.html')
if not os.path.isfile(SRC): die('source not found at ' + SRC)

text = open(SRC, 'rb').read().decode('utf-8')
CRLF = '\r\n' in text
MARK = 'CUI 42B \u00b7 2026-08-24'
if MARK in text: die('already applied - the 42B marker is in the file')
if 'CUI 42A' not in text: die('42A is not in this file - install 42A first')

def nl(s): return s.replace('\n', '\r\n') if CRLF else s

EDITS = []

# 1 -- the map, the default, the boot warning ---------------------------------
EDITS.append(('locations-block',
'''  /* b2 4594, unchanged. NOT every effect is in here \u2014 see checkLocations
     below, which makes the gap loud rather than letting it default. */
  var MATERIAL_LOCATIONS = {
    bronze:        ['mantel', 'pedestal', 'gradient'],
    alabaster:     ['mantel', 'pedestal', 'gradient'],
    iron:          ['mantel', 'pedestal', 'gradient'],
    stone:         ['mantel', 'pedestal', 'gradient'],
    ebony:         ['mantel', 'pedestal', 'gradient'],
    walnut:        ['mantel', 'pedestal', 'gradient'],
    plushy:        ['plushy_shelf'],
    impressionist:  ['mantel', 'pedestal', 'gradient'],
    torn_paper:     ['mantel', 'pedestal', 'gradient'],
    folded_book:    ['mantel', 'pedestal', 'gradient'],
    charcoal_chalk: ['mantel', 'pedestal', 'gradient'],
    pencil_sketch:  ['mantel', 'pedestal', 'gradient'],
    sheet_music:    ['mantel', 'pedestal', 'gradient']
  };
  var DEFAULT_LOCATION = 'pedestal';

  /* Thirteen presets are mapped and the registry offers more than thirteen.
     An unmapped effect silently takes 'pedestal', which may be right and may
     be wrong, and nobody would ever find out. So it is counted at boot and
     put on the console once. Rich and CENG own the answer; this lane only
     refuses to hide the question. */
  function checkLocations(){
    var missing = (R.effects || []).filter(function(e){
      return e.body === 'live' && !MATERIAL_LOCATIONS[e.id];
    }).map(function(e){ return e.id; });
    if (missing.length){
      console.warn('[payload] ' + missing.length + ' live effects have no location mapping ' +
                   'and will default to ' + DEFAULT_LOCATION + ': ' + missing.join(', '));
    }
    return missing;
  }
  window.__UNMAPPED = checkLocations();

  /* style_id is derived, not chosen. b2 had a Series switch above the
     material picker; the room is that switch now. */
  function styleForSilo(siloId){
    return siloId === 'artists_gallery' ? 'artists_gallery' : 'realistic';
  }

  function locationForEffect(effectId){
    var locs = MATERIAL_LOCATIONS[effectId];
    return (locs && locs[0]) || DEFAULT_LOCATION;
  }
''',
'''  /* MATERIAL_LOCATIONS, its pedestal default, the boot warning and
     locationForEffect stood here, ported verbatim from the Portraits b2
     clone. Removed \u00b7 CUI 42B \u00b7 2026-08-24. GroupsGenerateRequest accepts
     source_images_b64, effect_id, subject_count and skip_scoring \u2014
     `location` was discarded on arrival since the flat-catalogue port,
     and pedestals do not exist in Groups. */

  /* style_id is derived, not chosen. b2 had a Series switch above the
     material picker; the room is that switch now. */
  function styleForSilo(siloId){
    return siloId === 'artists_gallery' ? 'artists_gallery' : 'realistic';
  }
'''))

# 2 -- the payload field ------------------------------------------------------
EDITS.append(('payload-location',
'''      style_id:              styleForSilo(siloId),
      preset:                effectId,
      location:              locationForEffect(effectId),
      scale:                 'auto_85',''',
'''      style_id:              styleForSilo(siloId),
      preset:                effectId,
      scale:                 'auto_85','''))

# 3 -- the port-note line naming the map --------------------------------------
EDITS.append(('port-note',
'''       MATERIAL_LOCATIONS    4594   verbatim
''',
''))

errs = []
for name, old, new in EDITS:
    c = text.count(nl(old))
    if c != 1: errs.append(name + ': anchor count ' + str(c) + ', must be 1')
if errs: die('anchors failed, NOTHING written:\n  - ' + '\n  - '.join(errs))

for name, old, new in EDITS:
    text = text.replace(nl(old), nl(new), 1)

text = text.replace(nl('<!DOCTYPE html>'),
                    nl('<!DOCTYPE html>\n<!-- ' + MARK + ' -->'), 1)

post = []
for bad in ['var MATERIAL_LOCATIONS', 'DEFAULT_LOCATION',
            'function checkLocations', 'checkLocations(',
            'function locationForEffect', 'locationForEffect(',
            '__UNMAPPED', 'location:              ']:
    if bad in text: post.append(bad + ' still present')
if MARK not in text: post.append('marker missing')
if post: die('post-verify failed, NOTHING written:\n  - ' + '\n  - '.join(post))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'wb').write(text.encode('utf-8'))
print('\n[42B] wrote ' + OUT)
print('  edits applied : ' + str(len(EDITS)))
print('  bytes         : ' + str(os.path.getsize(OUT)))
print('\n  install with Install-File.ps1.\n')
