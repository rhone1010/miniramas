#!/usr/bin/env python3
# patch-groups-42g.py - 24 August 2026. Lane: D:\lanes\cui42
# Reads <repo>\public\groups.html -> writes %USERPROFILE%\Downloads\groups.html
#
# PORTRAITS' CODE, NOTHING ELSE. 42F's six-column override made the cards
# fatter than Portraits'; it goes. What remains is two placement lines
# built from Portraits' own technique on Portraits' own 8-column grid:
# the count-2 offset centres the top pair, the count-3 offset centres the
# bottom three. Card size is then pixel-identical to Portraits.

import os, sys

def die(m): print('\n[42G] REFUSED: ' + m + '\n'); sys.exit(1)

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
MARK = 'CUI 42G \u00b7 2026-08-24'
if MARK in text: die('already applied')
if 'CUI 42F' not in text: die('42F not in file - nothing to replace')

def nl(s): return s.replace('\n', '\r\n') if CRLF else s

OLD = '''/* ---- THE FIVE ROOMS \u00b7 2 OVER 3, CENTRED \u00b7 CUI 42F \u00b7 2026-08-24 ------
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
'''
NEW = '''/* ---- THE FIVE ROOMS \u00b7 2 OVER 3 \u00b7 CUI 42G \u00b7 2026-08-24 ---------------
   Portraits' code, nothing else: the shared 8-column grid and its own
   partial-row offsets. Top pair takes the count-2 centring, bottom
   three take the count-3 centring, one row down. Card size is
   therefore identical to Portraits'. Outranks the generic
   .floor[data-count="5"] rule by id. */
#siloFloor > :nth-child(1){ grid-column:3 / span 2 }
#siloFloor > :nth-child(3){ grid-column:2 / span 2; grid-row:2 }
'''

n = text.count(nl(OLD))
if n != 1: die('42F block anchor count ' + str(n) + ', must be 1 - NOTHING written')
text = text.replace(nl(OLD), nl(NEW), 1)
text = text.replace(nl('<!DOCTYPE html>'), nl('<!DOCTYPE html>\n<!-- ' + MARK + ' -->'), 1)

if 'repeat(6, minmax(0,1fr))' in text.split('face-floor')[0] and '#siloFloor{' in text:
    die('post-verify: six-column override survived - NOTHING written')
for want in ['#siloFloor > :nth-child(1){ grid-column:3 / span 2 }', MARK]:
    if want not in text: die('post-verify: missing ' + want + ' - NOTHING written')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'wb').write(text.encode('utf-8'))
print('\n[42G] wrote ' + OUT + '\n  edits: 1  bytes: ' + str(os.path.getsize(OUT)) + '\n')
