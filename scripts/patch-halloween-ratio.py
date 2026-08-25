#!/usr/bin/env python3
# patch-halloween-ratio.py - 24 August 2026. Lane: D:\lanes\cui42
# Reads <repo>\public\halloween.html -> writes %USERPROFILE%\Downloads\halloween.html
# (pass a different filename as the first argument if the page is named
#  otherwise, e.g.  python patch-halloween-ratio.py pets-halloween.html)
#
# One token: --card-ratio 1 -> .78, the same fix Groups took in 42C.

import os, sys

def die(m): print('\n[HW] REFUSED: ' + m + '\n'); sys.exit(1)

NAME = sys.argv[1] if len(sys.argv) > 1 else 'halloween.html'
HERE = os.path.dirname(os.path.abspath(__file__))
repo = HERE
while repo and not os.path.isdir(os.path.join(repo, 'public')):
    p = os.path.dirname(repo)
    if p == repo: break
    repo = p
SRC = os.path.join(repo, 'public', NAME)
OUT = os.path.join(os.path.expanduser('~'), 'Downloads', NAME)
if not os.path.isfile(SRC): die('source not found: ' + SRC)

text = open(SRC, 'rb').read().decode('utf-8')
CRLF = '\r\n' in text
MARK = 'CUI 42 \u00b7 halloween ratio \u00b7 2026-08-24'
if MARK in text: die('already applied')

def nl(s): return s.replace('\n', '\r\n') if CRLF else s

OLD = '  --card-ratio:1;'
NEW = '  --card-ratio:.78;   /* ' + MARK + ' */'
n = text.count(nl(OLD))
if n != 1: die("anchor '--card-ratio:1;' count " + str(n) + ', must be 1 - NOTHING written')
text = text.replace(nl(OLD), nl(NEW), 1)

if '--card-ratio:.78;' not in text: die('post-verify failed - NOTHING written')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'wb').write(text.encode('utf-8'))
print('\n[HW] wrote ' + OUT + '\n  edits: 1  bytes: ' + str(os.path.getsize(OUT)) + '\n')
