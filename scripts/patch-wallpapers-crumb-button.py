#!/usr/bin/env python3
# patch-wallpapers-crumb-button.py
# D:\minramas\scripts\patch-wallpapers-crumb-button.py
#
# THE ONE CHANGE: the "Wallpapers" breadcrumb in the three wallpaper
# rooms is an <a> that renders underlined and does not navigate. It
# becomes a <button> in the same pill dress that goes to /wallpapers.
#
# DRIFT-SAFE BY CONSTRUCTION: reads the LIVE repo files, requires the
# exact anchor exactly once per file, and REFUSES otherwise - so if
# another lane (41A's sign-in work, anyone) has changed these files
# since, nothing is overwritten and the refusal names the file.
#
# Dry run by default. Writes to Downloads; Install-File moves them in.
#
#   python D:\minramas\scripts\patch-wallpapers-crumb-button.py
#   python D:\minramas\scripts\patch-wallpapers-crumb-button.py --apply

import os, sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOWNLOADS = os.path.join(os.environ.get('USERPROFILE', ''), 'Downloads')
APPLY = '--apply' in sys.argv

FILES = [
    'public/wallpapers-portraits.html',
    'public/wallpapers-pets.html',
    'public/wallpapers-halloween-pets.html',
]

OLD = ('      <a class="crumb-back" href="/wallpapers">'
       '<span>Wallpapers</span></a>').encode()
NEW = ('      <button class="crumb-back" type="button"\r\n'
       '              onclick="location.href=\'/wallpapers\'">'
       '<span>Wallpapers</span></button>').encode()

def main():
    ok = True
    for rel in FILES:
        src = os.path.join(REPO, rel.replace('/', os.sep))
        name = os.path.basename(rel)
        if not os.path.exists(src):
            print(f'REFUSED  {name}: not found at {src}')
            ok = False
            continue
        data = open(src, 'rb').read()
        if data.count(NEW):
            print(f'REFUSED  {name}: already applied')
            continue
        c = data.count(OLD)
        if c != 1:
            print(f'REFUSED  {name}: anchor found {c} times - the file has '
                  f'drifted from what this patch was written against. '
                  f'Nothing written. Report this.')
            ok = False
            continue
        if not APPLY:
            print(f'ok       {name}: anchor found once, would write')
            continue
        out = os.path.join(DOWNLOADS, name)
        with open(out, 'wb') as f:
            f.write(data.replace(OLD, NEW))
        check = open(out, 'rb').read()
        if check.count(NEW) == 1 and check.count(OLD) == 0:
            print(f'WROTE    {out}  ({len(check)} bytes)')
        else:
            print(f'FAILED   {name}: post-write verification failed')
            ok = False
    if not APPLY:
        print('DRY RUN -- nothing written. Re-run with --apply.')
    sys.exit(0 if ok else 1)

main()
