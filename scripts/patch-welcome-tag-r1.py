#!/usr/bin/env python3
# patch-welcome-tag-r1.py - CUI 42 - 25 August 2026. Lane: D:\lanes\cui42
# Reads <repo>\public\<page> -> writes %USERPROFILE%\Downloads\<page>
#
# One line per page: <script src="/welcome.js" defer></script> ahead of
# </body>. The screen itself lives in welcome.js (shared, once per day,
# auto-off 15 Sep) - install that to public\welcome.js first.
#
# Pages not found in the repo are reported and skipped, not fatal - the
# list is intentionally the whole public face.

import os, sys

FILES = ['index.html', 'portraits.html', 'groups.html', 'halloween.html',
         'pets.html', 'pets-chooser.html', 'pets-halloween.html',
         'wallpapers.html', 'wallpapers-portraits.html', 'wallpapers-pets.html',
         'wallpapers-halloween-pets.html', 'wallpaper-store.html',
         'community.html', 'gallery.html', 'help.html']

TAG  = '<script src="/welcome.js" defer></script>'
MARK = 'welcome.js'

HERE = os.path.dirname(os.path.abspath(__file__))
repo = HERE
while repo and not os.path.isdir(os.path.join(repo, 'public')):
    p = os.path.dirname(repo)
    if p == repo: break
    repo = p
OUTDIR = os.path.join(os.path.expanduser('~'), 'Downloads')

wrote, skipped = [], []
for name in FILES:
    src = os.path.join(repo, 'public', name)
    if not os.path.isfile(src):
        skipped.append((name, 'not in repo')); continue
    text = open(src, 'rb').read().decode('utf-8')
    crlf = '\r\n' in text
    nl = (lambda s: s.replace('\n', '\r\n')) if crlf else (lambda s: s)
    if MARK in text:
        skipped.append((name, 'already tagged')); continue
    if text.count(nl('</body>')) != 1:
        skipped.append((name, '</body> count != 1')); continue
    text = text.replace(nl('</body>'), nl(TAG + '\n</body>'), 1)
    if TAG not in text:
        skipped.append((name, 'post-verify failed')); continue
    os.makedirs(OUTDIR, exist_ok=True)
    out = os.path.join(OUTDIR, name)
    open(out, 'wb').write(text.encode('utf-8'))
    wrote.append((name, os.path.getsize(out)))

print('')
for n, b in wrote: print('[LW] wrote ' + n + '  (' + str(b) + ' bytes)')
for n, why in skipped: print('[LW] skipped ' + n + ' - ' + why)
print('\n  ' + str(len(wrote)) + ' written, ' + str(len(skipped)) + ' skipped.')
print('  Install welcome.js to public\\welcome.js, then each page from Downloads.\n')
