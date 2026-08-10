#!/usr/bin/env python3
# scripts/patch-nav-and-wallpaper-print.py
#
# THE NAVIGATION, AND WHAT WALLPAPERS ARE NOT.
#
# Ruled with Rich, 2026-08-10.
#
# WHAT WAS WRONG
#
#   1  The Series menu offered Action, Groups and Pets. None of the three is
#      in middleware's PAGES map, so all three 404 today. Only Portraits and
#      Mobile Wallpapers exist.
#
#   2  Print Shop sat in the masthead as though it were a place. It is not -
#      it is an action on a piece, and arriving there empty-handed means the
#      page has to explain itself. It already has a per-piece button in My
#      Collection ("Send to Print Shop") in two spots, so the route in was
#      never the nav.
#
#   3  Help sat beside it. The Concierge is now a mark in the right cluster
#      on every page and answers the same questions in place; /help remains
#      as the page of terms and the ten questions, reachable from her panel.
#
#   4  Wallpapers had no separate treatment at all. They are download-only
#      and must never touch the print pipeline - a 9:16 phone image sent to
#      Prodigi is a refund waiting to be asked for.
#
# WHAT THE NAV BECOMES
#
#      Crafted Portraits (v)   Gallery   Community   My Collection   Account
#
#   Four destinations and the Series switcher. Account STAYS in the nav
#   rather than moving into the right cluster - that would need a new
#   control built beside the credits pill, and it is a separate change from
#   this one.
#
# SIX EDITS across three files. index.html is deliberately untouched: its
# nav uses different classes and different labels, and the homepage is being
# revised separately.
#
# Pure ASCII. CRLF-aware. Anchors asserted before any write.
#
#   python scripts/patch-nav-and-wallpaper-print.py            (dry run)
#   python scripts/patch-nav-and-wallpaper-print.py --write

import io
import os
import sys


def crlf(s):
    return s.replace('\n', '\r\n')


PORTRAITS = os.path.join('public', 'portraits.html')
GALLERY   = os.path.join('public', 'gallery.html')
HELP      = os.path.join('public', 'help.html')


# ============================================================ portraits.html

# ---- 1 · the Series menu keeps only what exists ----------------------------
SERIES_OLD = crlf('''        <a href="/portraits" role="menuitem" aria-current="page">Portraits</a>
        <a href="/action" role="menuitem">Action</a>
        <a href="/groups" role="menuitem">Groups</a>
        <a href="/pets" role="menuitem">Pets</a>
        <div class="sep"></div>
        <a href="/wallpapers" role="menuitem">Mobile Wallpapers</a>''')

SERIES_NEW = crlf('''        <a href="/portraits" role="menuitem" aria-current="page">Portraits</a>
        <!-- Action, Groups and Pets were listed here and are not in
             middleware's PAGES map, so all three 404. A Series menu that
             offers four rooms and opens one is worse than a menu that
             offers one: the first is a broken shop, the second is a small
             one. They come back when they exist. -->
        <div class="sep"></div>
        <a href="/wallpapers" role="menuitem">Mobile Wallpapers</a>''')


# ---- 2 · the masthead links ------------------------------------------------
NAV_OLD = crlf('''    <a href="/print">Print Shop</a>
    <a href="/collection">My Collection</a>
    <a href="/account">Account</a>
    <a href="/help">Help</a>
  </nav>''')

NAV_NEW = crlf('''    <!-- THE BOARD. Between Gallery and My Collection because that is the
         order of the thought: what the studio can do, what other people
         did with it, what you have done with it. -->
    <a href="/community">Community</a>
    <a href="/collection">My Collection</a>
    <a href="/account">Account</a>
    <!-- PRINT SHOP AND HELP LEFT THIS BAR. Print Shop is an action on a
         piece, not a place - it already has its button in My Collection,
         which is where somebody is actually looking at the thing they
         might buy. Help is the Concierge mark in the right cluster, and
         her panel carries the link to /help for the terms. -->
  </nav>''')


# ---- 3 · the phone drawer --------------------------------------------------
DRAWER_OLD = crlf('''    <a href="/portraits" class="on">Portraits</a>
    <a href="/action">Action</a>
    <a href="/groups">Groups</a>
    <a href="/pets">Pets</a>
    <a href="/wallpapers">Mobile Wallpapers</a>
    <a href="/gallery">Gallery</a>
    <a href="/print">Print Shop</a>
    <a href="/collection">My Collection</a>
    <a href="/account">Account</a>
    <a href="/help">Help</a>''')

DRAWER_NEW = crlf('''    <a href="/portraits" class="on">Portraits</a>
    <a href="/wallpapers">Mobile Wallpapers</a>
    <a href="/gallery">Gallery</a>
    <a href="/community">Community</a>
    <a href="/collection">My Collection</a>
    <a href="/account">Account</a>''')


# ---- 4 · what may be printed ----------------------------------------------
# printable() ALREADY EXISTS, and the wallpaper rule goes INSIDE it rather
# than beside it. A second function called something-printable in the same
# scope is how the sitter coin died this morning: two coinFor declarations
# six hundred lines apart, the later one winning silently.
#
# It is also the better shape. "May this be printed" is ONE question, and
# the Print Shop, the featured pane and the lightbox should all be asking
# the same one.
PRINTABLE_OLD = crlf('''  /* Prodigi fetches the asset itself, so a piece with no signed URL cannot
     be printed. That is a piece still saving, not a piece that failed. */
  function printable(p){
    return !!(p && p.art && p.serverId && String(p.art).indexOf('data:') !== 0);
  }''')

PRINTABLE_NEW = crlf('''  /* Prodigi fetches the asset itself, so a piece with no signed URL cannot
     be printed. That is a piece still saving, not a piece that failed.

     WALLPAPERS ARE DOWNLOAD-ONLY. Added 2026-08-10 - a separate pipeline
     that must never reach Prodigi, because a 9:16 phone image sent to a
     print lab comes back as a refund request and the customer would be
     right to ask for it.

     Matched on the word rather than an exact series id: the engine calls
     the pipeline portrait-wallpaper and the middleware calls the page
     /wallpapers. Anything with wallpaper in its name is one, and a Series
     added later inherits the rule instead of inheriting a Print button
     nobody meant to give it. */
  function printable(p){
    if (!p) return false;
    if (/wallpaper/i.test(String(p.series || ''))) return false;
    return !!(p.art && p.serverId && String(p.art).indexOf('data:') !== 0);
  }''')

# The featured pane's button, hidden when the featured piece is a wallpaper.
FEAT_OLD = crlf('''    [].forEach.call(mcGrid.querySelectorAll('.mc-minimap .piece'), function(el){
      el.classList.toggle('is-on', el.dataset.piece === id);
    });''')

FEAT_NEW = crlf('''    /* The button is built once and hidden per piece, rather than rebuilt -
       rebuilding the row would drop the Download listener bound beside it. */
    var pr1 = document.getElementById('mcPr1');
    if (pr1) pr1.hidden = !printable(p);

    [].forEach.call(mcGrid.querySelectorAll('.mc-minimap .piece'), function(el){
      el.classList.toggle('is-on', el.dataset.piece === id);
    });''')

# And the lightbox's.
LBOX_OLD = crlf('''    var acts = '<button class="mc-act is-fill" data-lb="dl">Download</button>' +
               '<button class="mc-act" data-lb="pr">Send to Print Shop</button>';''')

LBOX_NEW = crlf('''    var acts = '<button class="mc-act is-fill" data-lb="dl">Download</button>';
    /* Same rule as the featured pane. A wallpaper offers Download and
       nothing else - the absence is the whole message. */
    if (printable(p)){
      acts += '<button class="mc-act" data-lb="pr">Send to Print Shop</button>';
    }''')


# ============================================================ gallery + help

GALLERY_OLD = crlf('''    <a href="/portraits">Portraits</a>
    <a href="/help">Help</a>
    <a href="#" data-concierge>Ask</a>''')

GALLERY_NEW = crlf('''    <a href="/portraits">Portraits</a>
    <a href="/community">Community</a>
    <a href="#" data-concierge>Ask</a>''')

HELP_OLD = crlf('''    <a href="/portraits">Portraits</a>
    <a href="/gallery">Gallery</a>
  </nav>''')

HELP_NEW = crlf('''    <a href="/portraits">Portraits</a>
    <a href="/gallery">Gallery</a>
    <a href="/community">Community</a>
  </nav>''')


# ---- 7 · what the Concierge may point at -----------------------------------
# She pointed at the Print Shop link in the masthead. That link is gone, so
# the selector matches nothing and liveTarget would quietly skip it - but a
# lexicon carrying a control that no longer exists is a lexicon nobody
# trusts, and Community is the thing worth pointing at now.
POINTS_OLD = crlf('''  { sel:'.mh-nav a[href="/print"]',      phrases:['Print Shop','printing','print'] },''')

POINTS_NEW = crlf('''  { sel:'.mh-nav a[href="/community"]',  phrases:['Community','the board'] },''')


FILES = [
    (PORTRAITS, [
        ('series menu',     SERIES_OLD,    SERIES_NEW),
        ('masthead links',  NAV_OLD,       NAV_NEW),
        ('phone drawer',    DRAWER_OLD,    DRAWER_NEW),
        ('printable()',     PRINTABLE_OLD, PRINTABLE_NEW),
        ('featured button', FEAT_OLD,      FEAT_NEW),
        ('lightbox button', LBOX_OLD,      LBOX_NEW),
        ('concierge points', POINTS_OLD,    POINTS_NEW),
    ]),
    (GALLERY, [('gallery nav', GALLERY_OLD, GALLERY_NEW)]),
    (HELP,    [('help nav',    HELP_OLD,    HELP_NEW)]),
]


def main():
    write = '--write' in sys.argv
    planned = []

    # EVERY anchor in EVERY file is checked before ANY file is written. A run
    # that updates two of three files leaves a nav that disagrees with itself
    # across pages, which is worse than a nav nobody changed.
    for path, edits in FILES:
        if not os.path.exists(path):
            print('NOT FOUND: %s  (run from the repo root)' % path)
            return 1
        with io.open(path, 'r', encoding='utf-8', newline='') as fh:
            src = fh.read()

        if "href=\"/community\"" in src and path != PORTRAITS:
            print('%-22s already patched' % path)
            continue
        if path == PORTRAITS and 'WALLPAPERS ARE DOWNLOAD-ONLY' in src:
            print('%-22s already patched' % path)
            continue

        ok = True
        for name, old, _ in edits:
            n = src.count(old)
            if n != 1:
                print('ANCHOR %-16s in %-20s expected 1, found %d' % (name, path, n))
                ok = False
        if not ok:
            print('\nNothing written anywhere. An anchor has moved.')
            return 1
        print('%-22s %d anchors ok' % (path, len(edits)))
        planned.append((path, src, edits))

    if not planned:
        print('\nNothing to do.')
        return 0

    outs = []
    for path, src, edits in planned:
        braces = src.count('{') - src.count('}')
        out = src
        for _, old, new in edits:
            out = out.replace(old, new, 1)
        if out.count('{') - out.count('}') != braces:
            print('\nBRACE BALANCE CHANGED in %s. Nothing written.' % path)
            return 1
        if '\n' in out.replace('\r\n', ''):
            print('\nBARE NEWLINE INTRODUCED in %s. Nothing written.' % path)
            return 1
        outs.append((path, out))

    # The point of the whole patch, asserted rather than assumed.
    for path, out in outs:
        if path == PORTRAITS:
            for dead in ('href="/action"', 'href="/groups"', 'href="/pets"'):
                if dead in out:
                    print('\n%s still present in %s. Nothing written.' % (dead, path))
                    return 1
            if 'href="/print"' in out:
                print('\nPrint Shop still in the nav. Nothing written.')
                return 1
            if out.count('function printable(') != 1:
                print('\nprintable() not unique - a second declaration in the '
                      'same scope is the coinFor bug again. Nothing written.')
                return 1
            if 'WALLPAPERS ARE DOWNLOAD-ONLY' not in out:
                print('\nWallpaper rule missing. Nothing written.')
                return 1
        if 'href="/community"' not in out:
            print('\nCommunity missing from %s. Nothing written.' % path)
            return 1

    print('\n  Series menu   : Portraits + Mobile Wallpapers')
    print('  masthead      : Gallery, Community, My Collection, Account')
    print('  Print Shop    : per-piece only, and never on a wallpaper')

    if not write:
        print('\nDRY RUN. Nothing written. Re-run with --write.')
        return 0

    for path, out in outs:
        with io.open(path, 'w', encoding='utf-8', newline='') as fh:
            fh.write(out)
        print('Written: %s' % path)
    return 0


if __name__ == '__main__':
    sys.exit(main())
