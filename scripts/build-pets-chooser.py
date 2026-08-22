#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build-pets-chooser.py  --  the two-card stage at /pets.

    python scripts\\build-pets-chooser.py
    python scripts\\build-pets-chooser.py --apply

Writes TWO files to %USERPROFILE%\\Downloads:
    pets-chooser.html
    pets-chooser-registry.js
Install both with Install-File.ps1.

WHAT THIS IS. Rich, 21 August: Pets in the menu opens a chooser -- Pets
Portraits or Pets Halloween -- and his phrasing was "a no-curator two-card
selection stage to get to the next level". The Studio wants the same thing,
Regular and Halloween, so this is built once and used twice.

WHY IT IS A CLONE AND NOT A SMALL NEW PAGE. Two cards do not need 500KB of
workshop, and a purpose-built page would be smaller and cleaner to read.
It would also be a TENTH copy of the masthead, hand-written, with its own
copy of the credits pill, the cart count, the dropdown toggle, the account
panel and the footer. The masthead already lives in nine files and five had
drifted into different Series menus by this morning. A tenth variant with
hand-written JS behind it is the same fault with a new author.

So: clone, and turn off what a chooser does not have. The cost is a heavy
file for two cards. The benefit is that the chooser cannot drift from the
rooms it leads to, and that every fix to the masthead reaches it.

HOW A CARD BECOMES A DOOR. The silo floor already draws exactly this
screen -- a photograph, a title, a sentence, centred, with a rule for two
cards that puts them at columns 3 and 5. It just normally opens a room in
place instead of navigating.

Two edits give it a door:

  siloCard()  a silo with an href is always available. Without this the
              card greys itself out, because it counts the live effects in
              the room and a chooser card has none.

  openSilo()  a silo with an href navigates, and does so BEFORE the
              empty-room guard. That guard is the one that says "that room
              is still in the studio", which is exactly what a chooser card
              would trigger.

WHAT IS TURNED OFF. The Curator rail and the To Be Crafted rail. Both are
grid areas in .rooms, so they come off by setting their two width
variables to zero and hiding the panels -- the grid closes up and the floor
takes the width. Nothing is deleted; a chooser with a Curator asking for a
photograph would be asking for something it cannot use.

THE TWO PICTURES ARE A GUESS. Rich has not chosen them. Defaults here are
pets_victorian.jpg and death_companion.jpg, both deliberately NOT already
used as a room front inside either room -- a card that repeats the picture
of a card one click deeper reads as a mistake. Two strings in the registry.

THE TWO LINES ARE EMPTY, as everywhere else. Rich's voice.
"""

import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SRC = os.path.join(REPO, 'public', 'pets.html')
DOWNLOADS = os.path.join(
    os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Downloads')

CARDS = [
    ('pets_portraits', 'Pets Portraits', '/pets/portraits',
     '/previews/pets/pets_victorian.jpg',
     os.path.join('previews', 'pets', 'pets_victorian.jpg')),
    ('pets_halloween', 'Pets Halloween', '/pets/halloween',
     '/previews/halloween-pets/death_companion.jpg',
     os.path.join('previews', 'halloween-pets', 'death_companion.jpg')),
]

REGISTRY = '''/* HAND-WRITTEN, unlike the other registries in this folder. There is no
   catalogue behind a chooser - it holds two doors, not effects.

   Written by scripts/build-pets-chooser.py, 21 August 2026.

   THE SHAPE IS A REGISTRY ON PURPOSE. The chooser is the silo floor with
   two cards on it, so it reads whatever the floor reads. `effects` is
   empty and stays empty; `href` is the field the floor does not normally
   see, and siloCard() and openSilo() in pets-chooser.html are the two
   places that look for it.

   THE LINES ARE EMPTY. Rich's voice, and two are owed.

   THE PICTURES ARE A GUESS and neither is used as a room front inside the
   room it leads to - a card that repeats the picture of a card one click
   deeper reads as a mistake. Two strings. */
window.PETS_CHOOSER_REGISTRY = {
  "generatedAt": "2026-08-21T00:00:00.000Z",
  "silos": [
%s
  ],
  "effects": [],
  "poses": []
};

window.EFFECT_REGISTRY = window.PETS_CHOOSER_REGISTRY;

/* The same four the other registries carry, so the shared floor code does
   not have to test for a chooser. bySilo answers empty, which is correct:
   there is nothing craftable on this screen. */
window.EFFECT_REGISTRY.bySilo = function () { return []; };
window.EFFECT_REGISTRY.offerableBySilo = function () { return []; };
window.EFFECT_REGISTRY.byId = function () { return undefined; };
window.EFFECT_REGISTRY.isVariant = function () { return false; };
window.EFFECT_REGISTRY.tilesBySilo = window.EFFECT_REGISTRY.bySilo;
window.EFFECT_REGISTRY.offerableTilesBySilo = window.EFFECT_REGISTRY.offerableBySilo;
window.EFFECT_REGISTRY.variantFor = function () { return undefined; };

/* No effect has a plate here because no effect exists. The ROOM plates are
   on the silo rows above, which is where siloArt() looks. */
window.EFFECT_REGISTRY.PLATE_DIR = '';
window.EFFECT_REGISTRY.plateFor = function () { return ''; };
window.EFFECT_REGISTRY.intakeFor = function () { return 'single_photo'; };
window.EFFECT_REGISTRY.isMultiPhoto = function () { return false; };
'''

CSS_ANCHOR = """.room{
  position:relative; min-width:0; min-height:0;
  border-radius:var(--r-panel);
}"""

CSS_NEW = """.room{
  position:relative; min-width:0; min-height:0;
  border-radius:var(--r-panel);
}

/* ---- CHOOSER MODE ------------------------------------------------------
   Rich, 21 August: "a no-curator two-card selection stage". Both rails come
   off and the floor takes the width.

   .rooms is a named-area grid, so this is two variables rather than a
   second layout. The panels are hidden as well as zero-width because a
   zero-width grid column still lays its child out and the shadow would
   show at the edge. Nothing is removed from the markup -- the Studio
   chooser will want the same page and it costs nothing to leave it. */
body.is-chooser .rooms{ --spine-w:0px; --queue-w:0px; }
body.is-chooser #cur,
body.is-chooser #tbc{ display:none }

/* The floor holds two cards and the generic data-count="2" rule already
   centres them at columns 3 and 5. Only the height changes: a chooser has
   no second row, so the floor should not reserve one. */
body.is-chooser #siloFloor{ grid-template-rows:auto; align-content:center }"""

OLD_SILOCARD = """    a.querySelector('.silo-card__title').textContent = silo.label;
    if (live === 0){"""

NEW_SILOCARD = """    a.querySelector('.silo-card__title').textContent = silo.label;
    /* A DOOR IS ALWAYS OPEN. A chooser card leads somewhere rather than
       holding effects, so counting the live ones in it returns zero and the
       branch below would grey it out and refuse the click. */
    if (silo.href){
      a.tabIndex = 0;
      a.dataset.href = silo.href;
    } else if (live === 0){"""

OLD_OPENSILO = """  function openSilo(card){
    var siloId = card.dataset.siloId;
    var silo   = siloById(siloId);"""

NEW_OPENSILO = """  function openSilo(card){
    var siloId = card.dataset.siloId;
    var silo   = siloById(siloId);
    /* A DOOR, not a room. Checked before anything else in here, and in
       particular before the empty-room guard below -- that guard is what
       says "that room is still in the studio", which is exactly what a
       card with no effects behind it would trigger. */
    if (silo && silo.href){
      location.href = silo.href;
      return;
    }"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()

    if not os.path.isfile(SRC):
        sys.exit('FAIL: no source at %s' % SRC)
    with open(SRC, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')
    start_len = len(text)

    print('source : %s  (%d bytes, %s)' % (SRC, len(raw), 'CRLF' if crlf else 'LF'))

    # The two pictures have to be on disk. A chooser card with a broken
    # image is the first thing anybody sees of the Series.
    print('\ncard pictures:')
    missing = []
    for _, label, _, url, rel in CARDS:
        p = os.path.join(REPO, 'public', rel)
        there = os.path.isfile(p)
        print('  %-16s %-46s %s' % (label, url, 'ok' if there else 'MISSING'))
        if not there:
            missing.append(url)
    if missing:
        sys.exit('\nNOTHING WRITTEN. Missing: %s' % ', '.join(missing))

    # And the two doors have to lead somewhere.
    print('\ndestination pages:')
    for leaf in ('pets.html', 'pets-halloween.html'):
        p = os.path.join(REPO, 'public', leaf)
        there = os.path.isfile(p)
        print('  public/%-24s %s' % (leaf, 'ok' if there else 'MISSING'))
        if not there:
            missing.append(leaf)
    if missing:
        sys.exit('\nNOTHING WRITTEN. A door with nothing behind it.')

    edits = [
        ('title',
         '<title>Liten &amp; Co \u2014 Pets</title>',
         '<title>Liten &amp; Co \u2014 Pets</title>'),
        ('masthead label',
         '<span id="mhSeriesLabel"><span class="mh-crafted">Crafted </span>Pets</span>',
         '<span id="mhSeriesLabel"><span class="mh-crafted">Crafted </span>Pets</span>'),
        ('registry',
         '<script src="/pets-registry.js"></script>',
         '<script src="/pets-chooser-registry.js"></script>'),
        ('chooser CSS', CSS_ANCHOR, CSS_NEW),
        ('siloCard door', OLD_SILOCARD, NEW_SILOCARD),
        ('openSilo door', OLD_OPENSILO, NEW_OPENSILO),
    ]

    print('\nchecking anchors:')
    bad = []
    for label, old, new in edits:
        found = text.count(old)
        ok = found == 1
        print('  %-18s %s  (found %d, expected 1)' %
              (label, 'ok ' if ok else 'FAIL', found))
        if not ok:
            bad.append(label)
    if bad:
        print('\nNOTHING WRITTEN. Failed: %s' % ', '.join(bad))
        sys.exit(1)

    for label, old, new in edits:
        text = text.replace(old, new, 1)

    # The body class that turns the rails off.
    m = re.search(r'<body([^>]*)>', text)
    if not m:
        sys.exit('FAIL: no <body> tag.')
    attrs = m.group(1)
    if 'class="' in attrs:
        text = text[:m.start()] + re.sub(r'class="', 'class="is-chooser ', m.group(0), 1) + text[m.end():]
    else:
        text = text[:m.start()] + '<body class="is-chooser"%s>' % attrs + text[m.end():]

    # The five-up silo rule belongs to a room with five. This has two.
    five = re.search(r'/\* ---- FIVE ROOMS LAY TWO OVER THREE.*?nth-child\(5\)\{[^\n]*\n',
                     text, re.S)
    if five:
        text = text.replace(five.group(0),
                            '/* The five-up rule is not here: a chooser has two cards, and the\n'
                            '   generic data-count="2" rule already centres them. */\n', 1)

    print('\nverifying result:')
    checks = [
        ('registry is the chooser', '/pets-chooser-registry.js' in text),
        ('body carries is-chooser', 'is-chooser' in re.search(r'<body[^>]*>', text).group(0)),
        ('rails turned off', 'body.is-chooser #cur,' in text),
        ('a door is always open', 'if (silo.href){' in text),
        ('the door navigates', 'location.href = silo.href;' in text),
        ('door checked before the empty guard',
         text.index('location.href = silo.href;')
         < text.index('That room is still in the studio')),
        ('no five-up rule', '#siloFloor[data-count="5"]' not in text),
        ('two-card centring rule survives',
         '.floor[data-count="2"] > :nth-child(1){ grid-column:3 / span 2 }' in text),
        ('masthead intact', 'id="mhSeriesLabel"' in text),
        ('file did not collapse', len(text) > start_len * 0.75),
    ]
    for label, ok in checks:
        print('  %-38s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in checks):
        sys.exit('\nNOTHING WRITTEN. Post-write verification failed.')

    silos = ',\n'.join(
        '    {\n      "id": "%s",\n      "label": "%s",\n      "line": "",\n'
        '      "plate": "%s",\n      "href": "%s"\n    }' % (sid, label, url, href)
        for sid, label, href, url, _ in CARDS)
    reg = REGISTRY % silos

    if not args.apply:
        print('\nDRY RUN. All checks passed. Re-run with --apply to write')
        print('  %s' % os.path.join(DOWNLOADS, 'pets-chooser.html'))
        print('  %s' % os.path.join(DOWNLOADS, 'pets-chooser-registry.js'))
        return

    if crlf:
        text = text.replace('\n', '\r\n')
        reg = reg.replace('\n', '\r\n')
    with open(os.path.join(DOWNLOADS, 'pets-chooser.html'), 'w',
              encoding='utf-8', newline='') as fh:
        fh.write(text)
    with open(os.path.join(DOWNLOADS, 'pets-chooser-registry.js'), 'w',
              encoding='utf-8', newline='') as fh:
        fh.write(reg)
    print('\nWROTE both to %s' % DOWNLOADS)
    print('\nInstall-File.ps1 public\\pets-chooser.html')
    print('Install-File.ps1 public\\pets-chooser-registry.js')
    print('\nThen middleware: /pets must point at pets-chooser.html rather')
    print('than pets.html. One line, and /pets/portraits already covers the')
    print('room it points at today.')


if __name__ == '__main__':
    main()
