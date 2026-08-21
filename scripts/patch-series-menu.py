#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-series-menu.py  --  one Series menu, in every room.

    python scripts\\patch-series-menu.py public\\portraits.html
    python scripts\\patch-series-menu.py public\\portraits.html --apply

Run it against every file in ROOMS below. Dry run by default; output to
%USERPROFILE%\\Downloads\\<leafname>; install with Install-File.ps1.

WHY. The masthead is copied into every page rather than shared, and it has
drifted into five different menus. Read 21 August:

  portraits, pets, halloween   Portraits, Groups            | Wallpapers
  groups                       Portraits, Groups            | Wallpapers
  gallery                      Portraits, Groups            | Wallpapers, Studio
  community                    Portraits                    | Wallpapers
  wallpapers, studio           Portraits                    | Wallpapers, Studio
  help                         no Series menu at all

Community and Wallpapers do not offer Groups, which has been live for
days. Nobody arrives at the same shop twice. This writes ONE block into
all of them, so the next room is one edit here rather than six.

THE SHAPE, ruled by Rich 21 August:

    Portraits
    Pets
    Groups
    Halloween
    ---
    Mobile Wallpapers
      Portraits
      Pets
      Studio

Two levels, not three. Studio's two galleries -- Halloween and Regular --
are the two cards you land on AT /wallpapers/studio, not menu items. Same
for Pets Portraits and Pets Halloween, which sit behind the /pets chooser.
A dropdown three deep is unusable on a phone and every one of those four
destinations is a card on a page that has to exist anyway.

EVERY LINK IS IN MIDDLEWARE. Checked against PAGES, 21 August: /portraits,
/pets, /groups, /halloween, /wallpapers, /wallpapers/portraits,
/wallpapers/pets, /wallpapers/studio. The rule this file inherits from the
Portraits menu comment: a Series menu that offers a room and 404s is worse
than one that offers fewer rooms.

NOTE ON /wallpapers/pets. The route resolves and the page renders, but
PETS_ROWS in the wallpaper registry is an empty array, so that room is an
empty floor rather than a 404. It is listed because Rich ruled the shape;
if an empty floor is worse than an absent line, drop it here and nothing
else changes.

WHAT THIS DOES NOT TOUCH. The rest of the masthead -- Gallery, Community,
My Collection, Account, the Concierge mark, the credits pill, the cart --
is left exactly as each file has it. Those differ too, and they are a
separate ruling; this is the Series menu only.

help.html has no Series menu and is not in ROOMS. Giving it the full
masthead is a bigger change to that file than to the others and wants
looking at rather than scripting.
"""

import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DOWNLOADS = os.path.join(
    os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Downloads')

# leafname -> the href that is THIS page, or None if the page is not a
# room in the menu. Drives aria-current, which is what tells somebody
# where they already are.
ROOMS = {
    'portraits.html':             '/portraits',
    'pets.html':                  '/pets',
    'groups.html':                '/groups',
    'halloween.html':             '/halloween',
    'wallpapers.html':            '/wallpapers',
    'wallpaper-studio-V002.html': '/wallpapers/studio',
    'gallery.html':               None,
    'community.html':             None,
}

# href, label, indented
ITEMS = [
    ('/portraits',            'Portraits',        False),
    ('/pets',                 'Pets',             False),
    ('/groups',               'Groups',           False),
    ('/halloween',            'Halloween',        False),
    ('SEP',                   '',                 False),
    ('/wallpapers',           'Mobile Wallpapers', False),
    ('/wallpapers/portraits', 'Portraits',        True),
    ('/wallpapers/pets',      'Pets',             True),
    ('/wallpapers/studio',    'Studio',           True),
]

CSS_ANCHOR = ".mh-series-menu .sep{"

CSS_NEW = """/* SECOND LEVEL. The rooms inside Mobile Wallpapers. Indented and a size
   down rather than a flyout: a hover submenu cannot be opened by a thumb,
   and this menu is already a click-toggle. The rule sits on the anchor so
   the existing hover, focus and aria-current rules above still apply. */
.mh-series-menu a.sub{
  font-size:1.15em; padding-left:1.9em; color:var(--vellum-300, var(--vellum-200));
}
.mh-series-menu a.sub::before{
  content:""; position:absolute; left:1.05em;
  width:1px; height:1.05em;
  background:linear-gradient(180deg, transparent, rgba(215,189,137,.42));
}
.mh-series-menu a.sub{ position:relative }

.mh-series-menu .sep{"""


def build_menu(here):
    out = ['<div class="mh-series-menu" id="mhSeriesMenu" role="menu" hidden>']
    for href, label, sub in ITEMS:
        if href == 'SEP':
            out.append('        <div class="sep"></div>')
            continue
        cls = ' class="sub"' if sub else ''
        cur = ' aria-current="page"' if href == here else ''
        out.append('        <a href="%s"%s role="menuitem"%s>%s</a>'
                   % (href, cls, cur, label))
    out.append('      </div>')
    return '\n'.join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('target')
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()

    target = args.target.replace('/', os.sep).replace('\\', os.sep)
    path = target if os.path.isabs(target) else os.path.join(REPO, target)
    if not os.path.isfile(path):
        sys.exit('FAIL: no file at %s' % path)

    leaf = os.path.basename(path)
    if leaf not in ROOMS:
        sys.exit('FAIL: %s is not in ROOMS. Known: %s'
                 % (leaf, ', '.join(sorted(ROOMS))))
    here = ROOMS[leaf]

    with open(path, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')
    start_len = len(text)

    print('file   : %s  (%d bytes, %s)' % (path, len(raw), 'CRLF' if crlf else 'LF'))
    print('here   : %s' % (here or '(not a room in the menu)'))

    # The menu block, whatever this file's version of it happens to be.
    m = re.search(r'<div class="mh-series-menu"[^>]*>.*?\n      </div>',
                  text, re.S)
    print('\nchecking:')
    print('  %-28s %s' % ('menu block found', 'ok' if m else 'FAIL'))
    if not m:
        sys.exit('\nNOTHING WRITTEN. This file has drifted further than '
                 'expected - read it before scripting it.')

    old_links = re.findall(r'<a href="([^"]+)"', m.group(0))
    print('  was: %s' % ', '.join(old_links))

    css_here = text.count(CSS_ANCHOR)
    css_done = 'a.sub{' in text
    print('  %-28s %s' % ('sep rule present once',
                          'ok' if css_here == 1 else 'FAIL (%d)' % css_here))
    print('  %-28s %s' % ('sub-level CSS',
                          'already there' if css_done else 'to add'))
    if css_here != 1:
        sys.exit('\nNOTHING WRITTEN.')

    text = text[:m.start()] + build_menu(here) + text[m.end():]
    if not css_done:
        text = text.replace(CSS_ANCHOR, CSS_NEW, 1)

    print('\nverifying result:')
    checks = [
        ('all four rooms listed',
         all(('href="%s"' % h) in text for h in
             ('/portraits', '/pets', '/groups', '/halloween'))),
        ('wallpapers second level',
         all(('href="%s" class="sub"' % h) in text for h in
             ('/wallpapers/portraits', '/wallpapers/pets',
              '/wallpapers/studio'))),
        ('exactly one aria-current in the menu',
         build_menu(here).count('aria-current') == (1 if here else 0)),
        ('one menu block',
         len(re.findall(r'<div class="mh-series-menu"', text)) == 1),
        ('sub CSS present', 'a.sub{' in text),
        ('file did not collapse', len(text) > start_len * 0.9),
    ]
    for label, ok in checks:
        print('  %-36s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in checks):
        sys.exit('\nNOTHING WRITTEN. Post-write verification failed.')

    out = os.path.join(DOWNLOADS, leaf)
    if not args.apply:
        print('\nDRY RUN. Re-run with --apply to write')
        print('  %s' % out)
        return

    if crlf:
        text = text.replace('\n', '\r\n')
    with open(out, 'w', encoding='utf-8', newline='') as fh:
        fh.write(text)
    print('\nWROTE %s  (%d bytes)' % (out, len(text)))
    print('\nInstall-File.ps1 %s' % target)


if __name__ == '__main__':
    main()
