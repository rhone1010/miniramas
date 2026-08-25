#!/usr/bin/env python3
# patch-groups-42f.py - 24 August 2026. Lane: D:\lanes\cui42
# Reads <repo>\public\groups.html -> writes %USERPROFILE%\Downloads\groups.html
#
# Rich's three: cards render true .78, the five rooms deal 2 OVER 3, and
# both rows centre. One id-scoped block on #siloFloor: six columns instead
# of eight give each span-2 card more track than the .78 ratio needs, so
# height governs and the ratio actually draws instead of being clamped by
# max-width. Explicit placement centres 2 over 3. The effects floor keeps
# Portraits' shared rules untouched.

import os, sys

def die(m): print('\n[42F] REFUSED: ' + m + '\n'); sys.exit(1)

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
MARK = 'CUI 42F \u00b7 2026-08-24'
if MARK in text: die('already applied')
if 'CUI 42E' not in text: die('42E not in file - install it first')

def nl(s): return s.replace('\n', '\r\n') if CRLF else s

ANCHOR = '''/* a full row of four reaches both edges; nothing else does */'''
NEW = '''/* ---- THE FIVE ROOMS \u00b7 2 OVER 3, CENTRED \u00b7 CUI 42F \u00b7 2026-08-24 ------
   Rich's ruling, restored after 42D dropped it. Id-scoped to the silo
   floor; the effects floor keeps the shared Portraits rules.
   Six columns, cards span two: each card gets a third of the floor,
   which is more track than a .78 card at row height needs - so
   max-width never bites and the ratio draws true. */
#siloFloor{
  grid-template-columns:repeat(6, minmax(0,1fr));
}
#siloFloor > *{ grid-column:auto / span 2; justify-self:center }
#siloFloor > :nth-child(1){ grid-column:2 / span 2 }
#siloFloor > :nth-child(2){ grid-column:4 / span 2 }
#siloFloor > :nth-child(3){ grid-column:1 / span 2; grid-row:2 }
#siloFloor > :nth-child(4){ grid-column:3 / span 2; grid-row:2 }
#siloFloor > :nth-child(5){ grid-column:5 / span 2; grid-row:2 }

/* a full row of four reaches both edges; nothing else does */'''

n = text.count(nl(ANCHOR))
if n != 1: die('anchor count ' + str(n) + ', must be 1 - NOTHING written')
text = text.replace(nl(ANCHOR), nl(NEW), 1)
text = text.replace(nl('<!DOCTYPE html>'), nl('<!DOCTYPE html>\n<!-- ' + MARK + ' -->'), 1)

for want in ['#siloFloor > :nth-child(5){ grid-column:5 / span 2; grid-row:2 }', MARK]:
    if want not in text: die('post-verify: missing ' + want + ' - NOTHING written')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'wb').write(text.encode('utf-8'))
print('\n[42F] wrote ' + OUT + '\n  edits: 1  bytes: ' + str(os.path.getsize(OUT)) + '\n')
