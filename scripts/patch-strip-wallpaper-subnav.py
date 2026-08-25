#!/usr/bin/env python3
# patch-strip-wallpaper-subnav.py
# D:\lanes\cui42\scripts\patch-strip-wallpaper-subnav.py
#
# THE ONE CHANGE: the Series dropdown loses its Mobile Wallpapers
# sub-entries (Portraits / Pets / Studio / Ready to buy and any other
# class="sub" line) on every page that carries the menu. The main
# "Mobile Wallpapers" entry stays. Ruled by Rich, 25 Aug: navigation
# inside the section is the landing page and the breadcrumbs, not the
# dropdown.
#
# DRIFT-SAFE: reads the LIVE repo files, removes ONLY whole lines that
# are a sub menuitem anchor inside a file that has the Series menu, and
# reports per file. Files without subs are reported clean and untouched.
# Dry run by default; --apply writes changed files to Downloads and
# prints the exact Install-File and git commands for what it wrote.
#
#   python D:\lanes\cui42\scripts\patch-strip-wallpaper-subnav.py
#   python D:\lanes\cui42\scripts\patch-strip-wallpaper-subnav.py --apply

import os, re, sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOWNLOADS = os.path.join(os.environ.get('USERPROFILE', ''), 'Downloads')
APPLY = '--apply' in sys.argv

# THIS LANE'S FILES ONLY. CUI 41A ships the same removal across their six
# rooms with their own patch - touching those here would cross lanes.
LANE_FILES = [
    'wallpapers.html',
    'wallpaper-store.html',
    'wallpapers-portraits.html',
    'wallpapers-pets.html',
    'wallpapers-halloween-pets.html',
]

# a whole line that is a sub menu item, CRLF or LF
SUB_LINE = re.compile(
    rb'^[ \t]*<a [^>\r\n]*class="sub"[^>\r\n]*role="menuitem"[^>\r\n]*>.*?</a>[ \t]*\r?\n',
    re.M)

def main():
    changed = []
    for name in LANE_FILES:
        path = os.path.join(REPO, 'public', name)
        if not os.path.exists(path):
            print(f'missing  {name}: not in repo - skipped')
            continue
        data = open(path, 'rb').read()
        if b'mh-series-menu' not in data:
            continue
        hits = SUB_LINE.findall(data)
        if not hits:
            print(f'clean    {name}: no sub entries')
            continue
        print(f'ok       {name}: {len(hits)} sub line(s) would be removed')
        if APPLY:
            out = os.path.join(DOWNLOADS, name)
            new = SUB_LINE.sub(b'', data)
            with open(out, 'wb') as f:
                f.write(new)
            check = open(out, 'rb').read()
            if SUB_LINE.findall(check):
                print(f'FAILED   {name}: subs survived the write')
                sys.exit(1)
            print(f'WROTE    {out}  ({len(check)} bytes)')
            changed.append(name)

    if not APPLY:
        print('DRY RUN -- nothing written. Re-run with --apply.')
        return
    if changed:
        print('\n-- install each, then ship: --')
        for n in changed:
            print(f'powershell -ExecutionPolicy Bypass -File '
                  f'{REPO}\\scripts\\Install-File.ps1 public\\{n}')
        print('git add ' + ' '.join(f'public/{n}' for n in changed))
        print('git commit -m "Series dropdown: wallpaper sub-entries removed - '
              'the landing and breadcrumbs carry the section"')
        print('git push')
        print('gh pr create --fill')
        print('gh pr merge --merge --delete-branch=false')
    else:
        print('Nothing needed writing - all menus already clean.')

main()
