#!/usr/bin/env python3
# patch-groups-42h.py - 24 August 2026. Lane: D:\lanes\cui42
# Reads <repo>\public\groups.html -> writes %USERPROFILE%\Downloads\groups.html
#
# 42G placed cards 1 and 3 and left the rest to auto-flow; sparse
# placement does not advance past explicitly-placed items, so cards
# 3 and 4 landed on each other. All five are explicit now - there is
# no cursor left to disagree with.

import os, sys

def die(m): print('\n[42H] REFUSED: ' + m + '\n'); sys.exit(1)

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
MARK = 'CUI 42H \u00b7 2026-08-24'
if MARK in text: die('already applied')

def nl(s): return s.replace('\n', '\r\n') if CRLF else s

OLD = '''#siloFloor > :nth-child(1){ grid-column:3 / span 2 }
#siloFloor > :nth-child(3){ grid-column:2 / span 2; grid-row:2 }
'''
NEW = '''#siloFloor > :nth-child(1){ grid-column:3 / span 2; grid-row:1 }
#siloFloor > :nth-child(2){ grid-column:5 / span 2; grid-row:1 }
#siloFloor > :nth-child(3){ grid-column:2 / span 2; grid-row:2 }
#siloFloor > :nth-child(4){ grid-column:4 / span 2; grid-row:2 }
#siloFloor > :nth-child(5){ grid-column:6 / span 2; grid-row:2 }
'''

n = text.count(nl(OLD))
if n != 1: die('anchor count ' + str(n) + ', must be 1 - NOTHING written')
text = text.replace(nl(OLD), nl(NEW), 1)
text = text.replace(nl('<!DOCTYPE html>'), nl('<!DOCTYPE html>\n<!-- ' + MARK + ' -->'), 1)

if '#siloFloor > :nth-child(5){ grid-column:6 / span 2; grid-row:2 }' not in text:
    die('post-verify failed - NOTHING written')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'wb').write(text.encode('utf-8'))
print('\n[42H] wrote ' + OUT + '\n  edits: 1  bytes: ' + str(os.path.getsize(OUT)) + '\n')
