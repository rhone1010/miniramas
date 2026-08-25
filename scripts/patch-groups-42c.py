#!/usr/bin/env python3
# patch-groups-42c.py - 24 August 2026. Requires 42A + 42B installed.
# Reads <repo>\public\groups.html -> writes %USERPROFILE%\Downloads\groups.html
#
# The plates are 4:5 portrait now, not square. --card-ratio goes to .78 -
# Portraits' exact token, per Rich - and --silo-w comes down so the taller
# room card holds the same floor height as the square did.

import os, sys

def die(m): print('\n[42C] REFUSED: ' + m + '\n'); sys.exit(1)

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
MARK = 'CUI 42C \u00b7 2026-08-24'
if MARK in text: die('already applied')
if 'CUI 42B' not in text: die('42B not in file - install it first')

def nl(s): return s.replace('\n', '\r\n') if CRLF else s

EDITS = [
('card-ratio',
'''  /* SQUARE. The plates are square; .78 was inherited from the
     portraits clone, where it is correct and here it was not. */
  --card-ratio:1;''',
'''  /* .78, matching Portraits exactly \u00b7 CUI 42C \u00b7 2026-08-24. The plates
     went 4:5 portrait with the 34-effect catalogue; square was cropping
     head and feet off every card. */
  --card-ratio:.78;'''),

('silo-w',
''':root{ --silo-w:clamp(240px, 16.7vw, 420px); }''',
''':root{ --silo-w:clamp(200px, 13vw, 330px); }  /* trimmed \u00b7 CUI 42C \u00b7 the
   .78 card is a third taller, so the width comes down to hold the same
   floor height the square held at 16.7vw */'''),
]

errs = [n + ': count ' + str(text.count(nl(o))) for n, o, _ in EDITS if text.count(nl(o)) != 1]
if errs: die('anchors failed, NOTHING written:\n  - ' + '\n  - '.join(errs))
for _, o, w in EDITS: text = text.replace(nl(o), nl(w), 1)
text = text.replace(nl('<!DOCTYPE html>'), nl('<!DOCTYPE html>\n<!-- ' + MARK + ' -->'), 1)

if '--card-ratio:.78;' not in text or '--silo-w:clamp(200px, 13vw, 330px)' not in text:
    die('post-verify failed, NOTHING written')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'wb').write(text.encode('utf-8'))
print('\n[42C] wrote ' + OUT + '\n  edits: 2  bytes: ' + str(os.path.getsize(OUT)) + '\n')
