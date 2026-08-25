#!/usr/bin/env python3
# patch-groups-42d.py - 24 August 2026. Lane: D:\lanes\cui42
# Reads <repo>\public\groups.html -> writes %USERPROFILE%\Downloads\groups.html
#
# GROUPS FORMATS EXACTLY AS PORTRAITS. Rich's ruling, from portraits.html:
#   --spine-w  clamp(300px, 20%, 460px)     (curator rail)
#   --queue-w  clamp(220px, 14.5%, 330px)   (To Be Crafted rail)
#   --room-gap 20px
#   card size: the shared 12-column floor - Portraits has no --silo-w,
#   so the custom #siloFloor width blocks are removed and the generic
#   .floor rules size and centre the five rooms (3 over 2), exactly as
#   they would on Portraits. Supersedes the 2-over-3 ruling.
#   --card-ratio .78 already landed in 42C.
#
# Token swaps are anchored exactly-once. Block removals are structural:
# every #siloFloor[data-count=...] rule and the --silo-w declaration.

import os, re, sys

def die(m): print('\n[42D] REFUSED: ' + m + '\n'); sys.exit(1)

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
MARK = 'CUI 42D \u00b7 2026-08-24'
if MARK in text: die('already applied')
if '--card-ratio:.78' not in text: die('42C ratio not in file - wrong groups.html')

# ---- token swaps, regex-anchored, exactly once --------------------------
# Base :root lines only - the media-query overrides already match
# Portraits verbatim. The trailing comments make these unique.
SWAPS = [
 ('spine-w', r'--spine-w:clamp\(250px, 14\.5%, 330px\);\s*/\* rail \+ curator together \*/',
  '--spine-w:clamp(300px, 20%, 460px);   /* rail + curator together \u00b7 Portraits\u2019 value \u00b7 CUI 42D */'),
 ('queue-w', r'--queue-w:clamp\(180px, 10\.5%, 250px\);\s*/\* To Be Crafted \*/',
  '--queue-w:clamp(220px, 14.5%, 330px);   /* To Be Crafted \u00b7 Portraits\u2019 value \u00b7 CUI 42D */'),
 ('room-gap', r'(?m)^  --room-gap:16px;\r?$',
  '  --room-gap:20px;   /* Portraits\u2019 value \u00b7 CUI 42D */'),
]
errs = []
for name, pat, _ in SWAPS:
    n = len(re.findall(pat, text))
    if n != 1: errs.append(name + ': matched ' + str(n) + ' times, must be 1')

# ---- structural removals -------------------------------------------------
BLOCK = re.compile(r'#siloFloor\[data-count="[45]"\][^{]*\{[^{}]*\}\n?')
SILOW = re.compile(r':root\{\s*--silo-w:[^}]*\}[^\n]*\n?')
nb, ns = len(BLOCK.findall(text)), len(SILOW.findall(text))
if nb == 0: errs.append('no #siloFloor[data-count] blocks found')
if ns != 1: errs.append('--silo-w declaration matched ' + str(ns) + ' times, must be 1')
if errs: die('NOTHING written:\n  - ' + '\n  - '.join(errs))

for _, pat, new in SWAPS:
    text = re.sub(pat, new, text, count=1)
text = BLOCK.sub('', text)
text = SILOW.sub('/* --silo-w and the fixed-width silo-floor blocks removed \u00b7 CUI 42D \u00b7\n'
                 '   Portraits has neither: the shared 12-column floor sizes the cards. */\n', text)

nl = '\r\n' if '\r\n' in text else '\n'
text = text.replace('<!DOCTYPE html>', '<!DOCTYPE html>' + nl + '<!-- ' + MARK + ' -->', 1)

# Functional uses only - line 1382 mentions var(--silo-w) in prose inside
# a comment, which is harmless and stays.
for use in ['width:var(--silo-w)', 'repeat(2, var(--silo-w))', 'calc(var(--silo-w)']:
    if use in text:
        die('post-verify: ' + use + ' still present - NOTHING written')
for want in ['--spine-w:clamp(300px, 20%, 460px)', '--queue-w:clamp(220px, 14.5%, 330px)',
             '--room-gap:20px', MARK]:
    if want not in text: die('post-verify: missing ' + want + ' - NOTHING written')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'wb').write(text.encode('utf-8'))
print('\n[42D] wrote ' + OUT)
print('  token swaps    : 3')
print('  blocks removed : ' + str(nb) + ' silo-floor rules + --silo-w')
print('  bytes          : ' + str(os.path.getsize(OUT)) + '\n')
