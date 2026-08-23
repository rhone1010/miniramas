#!/usr/bin/env python3
"""
patch-home-series.py  -  23 August 2026  -  CUI V32

THE HOMEPAGE LETS IN THE OTHER SERIES. Ruled by Rich 23 August. The fold
order becomes:

    hero  ->  portraits  ->  will it look like them  ->  halloween
          ->  pets and pets halloween  ->  groups (the gift)

Four changes.

  1  FOLD ORDER. Eight Worlds moves above the likeness proof. The proof
     was answering a question the page had not asked yet - it sat second,
     before the reader had seen a single finish. Both are whole
     <section> blocks with their own ids, so this is a move and nothing
     inside either one changes.

  2  TWO NEW FOLDS, Halloween and the two pet rooms, built on the .world
     card the Eight Worlds fold already uses. Four images each and a
     four-column grid, which is why there are exactly four cards in each.

  3  THE HERO TRIPTYCH takes the new pictures. Dealt one per column per
     Series so no column shows two Halloween plates in a row and the
     three columns never turn over into the same world at once.

  4  THE MOBILE REEL takes them too, in three runs of two placed where
     the existing line breaks already were.

THE PICTURES ARE THE CONSTRAINT
  Twelve exist - four per Series, under /previews/home/splash/<series>/.
  Every filename below was read off the directory on 23 August. Nothing
  here is invented and nothing points at a file that is not there.

THE WORDS ARE DRAFTS
  Curator copy is Rich's. The headings, the finish lists and the closing
  lines in the two new folds are written to hold the shape and are marked
  where they sit. Rich judges them in place.

READS   D:\\minramas\\public\\index.html
WRITES  %USERPROFILE%\\Downloads\\index.html
"""

import os
import sys

REPO = r"D:\minramas\public"
OUT = os.path.join(os.environ.get("USERPROFILE", os.path.expanduser("~")),
                   "Downloads")
PAGE = "index.html"

EDITS = []

# ---- 1 · lift the likeness fold out -------------------------------------
# Anchored on the <section> itself, not the rule of box-drawing characters
# above it - those vary in length between folds and counting them is how
# edit one failed the first time.
LIKENESS = (
    '<section class="likeness desk-only" id="likeness">\r\n'
    '  <div class="wrap">\r\n'
    '    <div class="likeness-hd">\r\n'
    '      <div class="eyebrow">The same person, twice</div>\r\n'
    '      <h2>Will it still <em>look like them?</em></h2>\r\n'
    '      <p>Every picture below turns over between the photograph we were given\r\n'
    '         and the piece we made from it. Nothing is retouched, nothing is\r\n'
    '         staged &mdash; it is the same face, held through the material.</p>\r\n'
    '    </div>\r\n'
    '    <div class="likeness-wall" id="likenessWall"></div>\r\n'
    '    <p class="likeness-note">Bring us one photograph and we will do the rest.\r\n'
    '       <a href="/portraits">Start a portrait</a>.</p>\r\n'
    '  </div>\r\n'
    '</section>\r\n'
)

# The section comes out. The comment above it is retargeted separately.
EDITS.append((LIKENESS + '\r\n', ''))

EDITS.append((
    'FOLD 2 \u00b7 THE PROOF',
    'FOLD 2 \u00b7 EIGHT WORLDS \u00b7 the proof moved below it, 23 August'
))

# ---- 2 · the proof returns below the worlds fold, then the two new ------
EDITS.append((
    '        <a class="w-go" href="/gallery">Visit the Gallery</a>\r\n'
    '        <a class="w-own" href="/portraits">Create My Own</a>\r\n'
    '      </div>\r\n'
    '    </div>\r\n'
    '  </div>\r\n'
    '</section>\r\n',

    '        <a class="w-go" href="/gallery">Visit the Gallery</a>\r\n'
    '        <a class="w-own" href="/portraits">Create My Own</a>\r\n'
    '      </div>\r\n'
    '    </div>\r\n'
    '  </div>\r\n'
    '</section>\r\n'
    '\r\n'
    '<!-- FOLD 3 \u00b7 THE PROOF. Was fold two. It reads better here, after\r\n'
    '     the reader has seen what a finish is and can ask the question for\r\n'
    '     themselves. -->\r\n'
    + LIKENESS + '\r\n' +
    '<!-- FOLD 4 \u00b7 HALLOWEEN. COPY IS A DRAFT - the heading, the finish\r\n'
    '     lists and the closing line hold the shape; the voice is Rich\'s. -->\r\n'
    '<section class="worlds s-coffee desk-only" id="halloween">\r\n'
    '  <div class="wrap">\r\n'
    '    <div class="sec-head">\r\n'
    '      <div class="label lt">Halloween &middot; twenty-eight finishes</div>\r\n'
    '      <h2>Some faces are better <em>after dark.</em></h2>\r\n'
    '      <p>The same craft, turned to the other season. Bring us a\r\n'
    '         photograph and we will find what is waiting underneath it.</p>\r\n'
    '    </div>\r\n'
    '    <div class="wgrid">\r\n'
    '      <a class="world" href="/halloween">\r\n'
    '        <div class="ph" style="background-image:url(/previews/home/splash/halloween/man_ice_wraith.jpg);background-size:cover;background-position:center"></div>\r\n'
    '        <div class="body"><div class="n">The Restless Dead</div>\r\n'
    '          <div class="fin">Ice Wraith &middot; Revenant &middot; The Possessed</div>\r\n'
    '          <div class="cnt">7 finishes</div></div></a>\r\n'
    '      <a class="world" href="/halloween">\r\n'
    '        <div class="ph" style="background-image:url(/previews/home/splash/halloween/woman_swamp_creature.jpg);background-size:cover;background-position:center"></div>\r\n'
    '        <div class="body"><div class="n">Creatures</div>\r\n'
    '          <div class="fin">Swamp Creature &middot; Shadow &middot; Nightmare</div>\r\n'
    '          <div class="cnt">7 finishes</div></div></a>\r\n'
    '      <a class="world" href="/halloween">\r\n'
    '        <div class="ph" style="background-image:url(/previews/home/splash/halloween/man_haunted_scarecrow.jpg);background-size:cover;background-position:center"></div>\r\n'
    '        <div class="body"><div class="n">Harvest</div>\r\n'
    '          <div class="fin">Haunted Scarecrow &middot; Thorn King &middot; Spirit Caller</div>\r\n'
    '          <div class="cnt">7 finishes</div></div></a>\r\n'
    '      <a class="world" href="/halloween">\r\n'
    '        <div class="ph" style="background-image:url(/previews/home/splash/halloween/man_clockwork_corpse.jpg);background-size:cover;background-position:center"></div>\r\n'
    '        <div class="body"><div class="n">The Uncanny</div>\r\n'
    '          <div class="fin">Clockwork Corpse &middot; Porcelain Doll &middot; Wax</div>\r\n'
    '          <div class="cnt">7 finishes</div></div></a>\r\n'
    '    </div>\r\n'
    '    <div class="w-foot">\r\n'
    '      <p>&ldquo;It is the one room people come to twice.&rdquo; &mdash; C.</p>\r\n'
    '      <div class="w-acts">\r\n'
    '        <a class="w-own" href="/halloween">Enter Halloween</a>\r\n'
    '      </div>\r\n'
    '    </div>\r\n'
    '  </div>\r\n'
    '</section>\r\n'
    '\r\n'
    '<!-- FOLD 5 \u00b7 THE PETS. Both pet rooms in one fold - they are one\r\n'
    '     door on the nav and splitting them here would contradict the\r\n'
    '     chooser. COPY IS A DRAFT. -->\r\n'
    '<section class="worlds s-coffee desk-only" id="petsfold">\r\n'
    '  <div class="wrap">\r\n'
    '    <div class="sec-head">\r\n'
    '      <div class="label lt">Pets &middot; sixty-one finishes</div>\r\n'
    '      <h2>They sat for you <em>once.</em></h2>\r\n'
    '      <p>The same craft, the same care, for the ones who will not hold\r\n'
    '         still. Two rooms &mdash; one for the year, one for October.</p>\r\n'
    '    </div>\r\n'
    '    <div class="wgrid">\r\n'
    '      <a class="world" href="/pets/portraits">\r\n'
    '        <div class="ph" style="background-image:url(/previews/home/splash/pets/pets_victorian.jpg);background-size:cover;background-position:center"></div>\r\n'
    '        <div class="body"><div class="n">Another Time</div>\r\n'
    '          <div class="fin">Victorian &middot; Renaissance &middot; Elizabethan</div>\r\n'
    '          <div class="cnt">34 finishes</div></div></a>\r\n'
    '      <a class="world" href="/pets/portraits">\r\n'
    '        <div class="ph" style="background-image:url(/previews/home/splash/pets/pets_quilted.jpg);background-size:cover;background-position:center"></div>\r\n'
    '        <div class="body"><div class="n">Made by Hand</div>\r\n'
    '          <div class="fin">Quilted &middot; Beaded &middot; Plushy &middot; Origami</div>\r\n'
    '          <div class="cnt">34 finishes</div></div></a>\r\n'
    '      <a class="world" href="/pets/halloween">\r\n'
    '        <div class="ph" style="background-image:url(/previews/home/splash/pets-halloween/hellborn_beast.jpg);background-size:cover;background-position:center"></div>\r\n'
    '        <div class="body"><div class="n">Creatures</div>\r\n'
    '          <div class="fin">Hellborn &middot; Blood Moon &middot; Shadow Beast</div>\r\n'
    '          <div class="cnt">27 finishes</div></div></a>\r\n'
    '      <a class="world" href="/pets/halloween">\r\n'
    '        <div class="ph" style="background-image:url(/previews/home/splash/pets-halloween/harvest_god_beast.jpg);background-size:cover;background-position:center"></div>\r\n'
    '        <div class="body"><div class="n">Harvest</div>\r\n'
    '          <div class="fin">Harvest God&rsquo;s Beast &middot; Gargoyle &middot; Thorn King</div>\r\n'
    '          <div class="cnt">27 finishes</div></div></a>\r\n'
    '    </div>\r\n'
    '    <div class="w-foot">\r\n'
    '      <p>&ldquo;Nobody has ever asked me for a small one.&rdquo; &mdash; C.</p>\r\n'
    '      <div class="w-acts">\r\n'
    '        <a class="w-own" href="/pets">Enter the Pet rooms</a>\r\n'
    '      </div>\r\n'
    '    </div>\r\n'
    '  </div>\r\n'
    '</section>\r\n'
))

# ---- 3 · the hero triptych ----------------------------------------------
# One new plate per column per Series, spaced so no column turns over into
# the same world twice running and the three columns never show the same
# register at once.
EDITS.append((
    "  var COLS = [\r\n"
    "    ['man_renaissance.jpg','woman_tidewood.jpg','man_stained_glass.jpg',\r\n"
    "     'woman_clockwork.jpg','man_quartzite.jpg','woman_face_petals.jpg',\r\n"
    "     'man_pencil_sketch.jpg','woman_robot_2.jpg'],\r\n"
    "\r\n"
    "    ['woman_watercolor.jpg','man_driftwood_resin.jpg','woman_elizabethan.jpg',\r\n"
    "     'man_ice.jpg','woman_dragon_skin.jpg','man_impressionist.jpg',\r\n"
    "     'woman_porcelain.jpg','man_coral.jpg'],\r\n"
    "\r\n"
    "    ['woman_forest_guardian.jpg','man_balloons.jpg','woman_robot_1.jpg',\r\n"
    "     'man_driftwood.jpg','woman_plushy.jpg','man_elizabethan.jpg',\r\n"
    "     'woman_music.jpg','man_watercolor2.jpg']\r\n"
    "  ];",

    "  /* THE OTHER SERIES ARE IN HERE NOW, 23 August. Dealt one per column\r\n"
    "     per Series and spaced, so no column turns over into the same world\r\n"
    "     twice running and the three never show the same register at once.\r\n"
    "     Paths are relative to S, which is why they carry their folder. */\r\n"
    "  var COLS = [\r\n"
    "    ['man_renaissance.jpg','halloween/man_ice_wraith.jpg','woman_tidewood.jpg',\r\n"
    "     'man_stained_glass.jpg','pets/pets_victorian.jpg','woman_clockwork.jpg',\r\n"
    "     'man_quartzite.jpg','pets-halloween/hellborn_beast.jpg',\r\n"
    "     'woman_face_petals.jpg','man_pencil_sketch.jpg','woman_robot_2.jpg'],\r\n"
    "\r\n"
    "    ['woman_watercolor.jpg','pets/pets_impressionist.jpg','man_driftwood_resin.jpg',\r\n"
    "     'woman_elizabethan.jpg','pets-halloween/gargoyle_beast.jpg','man_ice.jpg',\r\n"
    "     'woman_dragon_skin.jpg','halloween/woman_swamp_creature.jpg',\r\n"
    "     'man_impressionist.jpg','woman_porcelain.jpg','man_coral.jpg'],\r\n"
    "\r\n"
    "    ['woman_forest_guardian.jpg','pets-halloween/harvest_god_beast.jpg','man_balloons.jpg',\r\n"
    "     'woman_robot_1.jpg','halloween/man_haunted_scarecrow.jpg','man_driftwood.jpg',\r\n"
    "     'woman_plushy.jpg','pets/pets_clockwork.jpg','man_elizabethan.jpg',\r\n"
    "     'woman_music.jpg','man_watercolor2.jpg']\r\n"
    "  ];"
))

# ---- 4 · the mobile reel ------------------------------------------------
# Placed at breaks that already existed, so the rhythm of the reel is
# unchanged. Two per Series; the remaining four plates are in the hero.
EDITS.append((
    "    ['woman_folded_book.jpg',   'Or turn into your favourite novel'],",

    "    /* Halloween, 23 August. */\r\n"
    "    ['halloween/man_ice_wraith.jpg',      'Or something that waits after dark'],\r\n"
    "    ['halloween/woman_swamp_creature.jpg','We have a room for October'],\r\n"
    "\r\n"
    "    ['woman_folded_book.jpg',   'Or turn into your favourite novel'],"
))

EDITS.append((
    "    ['woman_coral.jpg',         'A trip under the sea?'],",

    "    /* Both pet rooms, 23 August. */\r\n"
    "    ['pets/pets_victorian.jpg',            'Your dog has never been painted'],\r\n"
    "    ['pets-halloween/hellborn_beast.jpg',  'Though he may prefer something fiercer'],\r\n"
    "\r\n"
    "    ['woman_coral.jpg',         'A trip under the sea?'],"
))

EDITS.append((
    "    ['man_stained_glass.jpg',   'We have dozens of finishes'],",

    "    ['pets/pets_impressionist.jpg',        'Cats sit for us too'],\r\n"
    "    ['pets-halloween/harvest_god_beast.jpg','And come back as something else'],\r\n"
    "\r\n"
    "    ['man_stained_glass.jpg',   'We have dozens of finishes'],"
))


def main():
    apply_it = "--apply" in sys.argv
    print("patch-home-series  -  %s" % ("APPLY" if apply_it else "DRY RUN"))
    print("")

    src = os.path.join(REPO, PAGE)
    dst = os.path.join(OUT, PAGE)

    if not os.path.isfile(src):
        print("  MISSING  %s" % src)
        sys.exit(1)

    with open(src, "r", encoding="utf-8", newline="") as fh:
        text = fh.read()

    for i, (anchor, _) in enumerate(EDITS):
        n = text.count(anchor)
        if n != 1:
            print("  REFUSE   edit %d: anchor found %d times, expected 1"
                  % (i + 1, n))
            print("           first line: %s" % anchor.splitlines()[0][:66])
            sys.exit(1)

    out = text
    for anchor, replace in EDITS:
        out = out.replace(anchor, replace, 1)

    checks = [
        ('id="likeness"', 1),
        ('id="halloween"', 1),
        ('id="petsfold"', 1),
        ('id="worlds"', 1),
        ("halloween/man_ice_wraith.jpg", 3),
        ("pets/pets_victorian.jpg", 3),
        ("pets-halloween/hellborn_beast.jpg", 3),
        ("pets-halloween/harvest_god_beast.jpg", 3),
        ("halloween/woman_swamp_creature.jpg", 3),
        ("halloween/man_haunted_scarecrow.jpg", 2),
        ("halloween/man_clockwork_corpse.jpg", 1),
        ("pets/pets_impressionist.jpg", 2),
        ("pets/pets_clockwork.jpg", 1),
        ("pets/pets_quilted.jpg", 1),
        ("pets-halloween/gargoyle_beast.jpg", 1),
    ]
    ok = True
    for needle, want in checks:
        got = out.count(needle)
        if got != want:
            print("  REFUSE   verify: '%s' found %d, expected %d"
                  % (needle, got, want))
            ok = False

    # The proof fold must exist exactly once and must now sit AFTER the
    # worlds fold. A move that duplicated or dropped it would still pass a
    # count on its id.
    if out.find('id="worlds"') > out.find('id="likeness"'):
        print("  REFUSE   verify: the proof is still above the worlds fold")
        ok = False
    if out.find('id="likeness"') > out.find('id="halloween"'):
        print("  REFUSE   verify: the proof landed below Halloween")
        ok = False
    if not ok:
        sys.exit(1)

    if len(out) <= len(text):
        print("  REFUSE   result did not grow")
        sys.exit(1)

    print("  OK       %d edits, all anchors unique, all checks passed"
          % len(EDITS))

    if not apply_it:
        print("           would write %s" % dst)
        print("")
        print("  Re-run with --apply to write.")
        return

    if not os.path.isdir(OUT):
        print("  REFUSE   %s does not exist" % OUT)
        sys.exit(1)

    with open(dst, "w", encoding="utf-8", newline="") as fh:
        fh.write(out)
    print("  WROTE    %s" % dst)


if __name__ == "__main__":
    main()
