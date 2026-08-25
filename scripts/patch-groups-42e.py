#!/usr/bin/env python3
# patch-groups-42e.py - 24 August 2026. Lane: D:\lanes\cui42
# Reads <repo>\public\groups.html -> writes %USERPROFILE%\Downloads\groups.html
#
# THE LAST DIVERGENCE FROM PORTRAITS. Portraits' floor gives its two rows
# the full room height (minmax(0,1fr), align-content:stretch) and the card
# takes height:100% with width following the ratio. The Groups rebuild had
# auto rows, centred, width-driven cards - which is why a Groups card
# measured 262px against Portraits' ~370 at the same viewport.
# Both blocks below are Portraits' rules verbatim.

import os, sys

def die(m): print('\n[42E] REFUSED: ' + m + '\n'); sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
repo = HERE
while repo and not os.path.isdir(os.path.join(repo, 'public')):
    p = os.path.dirname(repo)
    if p == repo: break
    repo = p
SRC = os.path.join(repo, 'public', 'groups.html')
OUT = os.path.join(os.path.expanduser('~'), 'Downloads', 'groups.html')
if not os.path.isfile(SRC): die('source not found: ' + SRC)

text = open(SRC, 'rb').read().decode('utf-8')
CRLF = '\r\n' in text
MARK = 'CUI 42E \u00b7 2026-08-24'
if MARK in text: die('already applied')
if 'CUI 42D' not in text: die('42D not in file - install it first')

def nl(s): return s.replace('\n', '\r\n') if CRLF else s

EDITS = [
('floor-rows',
'''  /* CONTENT-SIZED, NOT STRETCHED. Two 1fr rows in a fixed-height room
     take their height from the viewport, so a card could never be
     square however wide the floor got - at 2560 the rows were 437
     tall against 350 of width, and trimming the rails closed 38 of
     that 87. With the rows sized to their cards instead, the card is
     width-driven and square, and the height that is left over sits
     above and below rather than being forced into the card. */
  grid-template-rows:repeat(2, auto);
  gap:var(--card-gap);
  align-content:center;''',
'''  /* Portraits' rows, verbatim \u00b7 CUI 42E. The content-sized rows above
     existed to keep a SQUARE card; the card is .78 now and Portraits'
     stretched rows are the ruling. */
  grid-template-rows:repeat(2, minmax(0,1fr));
  gap:var(--card-gap);
  align-content:stretch;'''),

('card-sizing',
'''  /* WIDTH FIRST NOW, and the height follows the ratio. The old note
     here warned that a fixed ratio against a full-width card overflows
     a fixed-height room, and it was right while the rows stretched to
     fill that room. They no longer do - see .floor - so the room is as
     tall as its cards and there is nothing to overflow. max-height is
     the belt: a viewport short enough to squeeze two rows gets a
     slightly-not-square card rather than a clipped one. */
  width:100%; height:auto; max-height:100%;''',
'''  /* Portraits' sizing, verbatim \u00b7 CUI 42E: height comes from the row,
     width follows the ratio. */
  height:100%; width:auto; max-width:100%;'''),
]

errs = [n + ': anchor count ' + str(text.count(nl(o))) + ', must be 1'
        for n, o, _ in EDITS if text.count(nl(o)) != 1]
if errs: die('NOTHING written:\n  - ' + '\n  - '.join(errs))
for _, o, w in EDITS: text = text.replace(nl(o), nl(w), 1)
text = text.replace(nl('<!DOCTYPE html>'), nl('<!DOCTYPE html>\n<!-- ' + MARK + ' -->'), 1)

for want in ['grid-template-rows:repeat(2, minmax(0,1fr));',
             'height:100%; width:auto; max-width:100%;', MARK]:
    if want not in text: die('post-verify: missing ' + want + ' - NOTHING written')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'wb').write(text.encode('utf-8'))
print('\n[42E] wrote ' + OUT + '\n  edits: 2  bytes: ' + str(os.path.getsize(OUT)) + '\n')
