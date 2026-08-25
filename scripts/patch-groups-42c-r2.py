#!/usr/bin/env python3
# patch-groups-42c-r2.py - 24 August 2026.
# Re-anchored against the CENG-rebuilt groups.html live on main.
# Two tokens only: --card-ratio 1 -> .78 (Portraits' value), --silo-w trimmed
# to hold the floor height under the taller card.
# Reads <repo>\public\groups.html -> writes %USERPROFILE%\Downloads\groups.html

import os, sys

def die(m): print('\n[42C-r2] REFUSED: ' + m + '\n'); sys.exit(1)

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
MARK = 'CUI 42C-r2 \u00b7 2026-08-24'
if MARK in text: die('already applied')

def nl(s): return s.replace('\n', '\r\n') if CRLF else s

EDITS = [
('card-ratio',
'  --card-ratio:1;',
'  --card-ratio:.78;   /* CUI 42C-r2 \u00b7 plates are 4:5, token matches Portraits */'),
('silo-w',
':root{ --silo-w:clamp(240px, 16.7vw, 420px); }',
':root{ --silo-w:clamp(200px, 13vw, 330px); }  /* CUI 42C-r2 \u00b7 trimmed for the taller card */'),
]

errs = [n + ': anchor count ' + str(text.count(nl(o))) + ', must be 1'
        for n, o, _ in EDITS if text.count(nl(o)) != 1]
if errs: die('NOTHING written:\n  - ' + '\n  - '.join(errs))
for _, o, w in EDITS: text = text.replace(nl(o), nl(w), 1)
text = text.replace(nl('<!DOCTYPE html>'), nl('<!DOCTYPE html>\n<!-- ' + MARK + ' -->'), 1)

if '--card-ratio:.78;' not in text or '13vw, 330px' not in text:
    die('post-verify failed, NOTHING written')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'wb').write(text.encode('utf-8'))
print('\n[42C-r2] wrote ' + OUT + '\n  edits: 2  bytes: ' + str(os.path.getsize(OUT)) + '\n')
