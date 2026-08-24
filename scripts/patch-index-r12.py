#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-index-r12.py  -  CUI 41A  -  23 August 2026

  1  PLATE SWAPS IN THE DESKTOP TRIPTYCH.
     - man_ice_wraith.jpg  -> man_haunted_scarecrow.jpg  (col 0)
     - man_stained_glass.jpg -> woman_stained_glass.jpg  (col 0)
     - woman_elizabethan.jpg -> woman_plushy.jpg         (col 1)

  2  GROUPS ADDED TO THE TRIPTYCH (four plates, distributed).

  3  GROUPS FOLD added to the desktop homepage, after Pets.

  4  DESKTOP BUTTON AND HEADLINE FOLLOW THE ACTIVE SERIES GROUP.
     The triptych now runs in groups of three plates per Series (portrait
     plates, then halloween, then groups, then pets, then pets-halloween).
     When the active group changes, the headline and button in .trip-say
     update to match -- the same rule as the mobile reel.

  5  CACHE-BUST on pets_victorian.jpg -- append ?v=2.

  6  MOBILE BUTTON RAISED 15px.

  7  tall-small also tried for the triptych columns -- they exist now and
     are half the weight of tall.

Reads <repo>\\public. Writes to Downloads. Must be installed to scripts\\.
"""

import os
import sys
import io

FILES = ["index.html"]

# ----------------------------------------------------------------------
# A . PLATE SWAPS AND GROUPS IN COLS
# ----------------------------------------------------------------------
A_OLD = (
    "  var COLS = [\n"
    "    ['man_renaissance.jpg','halloween/man_ice_wraith.jpg','woman_tidewood.jpg',\n"
    "     'man_stained_glass.jpg','pets/pets_victorian.jpg','woman_clockwork.jpg',\n"
    "     'man_quartzite.jpg','pets-halloween/hellborn_beast.jpg',\n"
    "     'woman_face_petals.jpg','man_pencil_sketch.jpg','woman_robot_2.jpg'],\n"
    "\n"
    "    ['woman_watercolor.jpg','pets/pets_impressionist.jpg','man_driftwood_resin.jpg',\n"
    "     'woman_elizabethan.jpg','pets-halloween/gargoyle_beast.jpg','man_ice.jpg',\n"
    "     'woman_dragon_skin.jpg','halloween/woman_swamp_creature.jpg',\n"
    "     'man_impressionist.jpg','woman_porcelain.jpg','man_coral.jpg'],\n"
    "\n"
    "    ['woman_forest_guardian.jpg','pets-halloween/harvest_god_beast.jpg','man_balloons.jpg',\n"
    "     'woman_robot_1.jpg','halloween/man_haunted_scarecrow.jpg','man_driftwood.jpg',\n"
    "     'woman_plushy.jpg','pets/pets_clockwork.jpg','man_elizabethan.jpg',\n"
    "     'woman_music.jpg','man_watercolor2.jpg']\n"
    "  ];"
)
A_NEW = (
    "  /* CUI 41A, 23 Aug 2026.\n"
    "     Plates are now grouped: three Portraits, three Halloween, three Groups,\n"
    "     three Pets, three Pets Halloween -- cycled in that order across all\n"
    "     three columns. The headline and button follow the group index.\n"
    "     Swaps: man_ice_wraith -> man_haunted_scarecrow (col 0),\n"
    "            man_stained_glass -> woman_stained_glass (col 0),\n"
    "            woman_elizabethan -> woman_plushy (col 1). */\n"
    "\n"
    "  /* Each sub-array is [col0, col1, col2]. Grouped by Series so the\n"
    "     desktop headline can follow them. */\n"
    "  var COL_GROUPS = [\n"
    "    /* Portraits */\n"
    "    ['man_renaissance.jpg',                     'woman_watercolor.jpg',              'woman_forest_guardian.jpg'],\n"
    "    ['woman_tidewood.jpg',                      'man_driftwood_resin.jpg',           'man_balloons.jpg'],\n"
    "    ['woman_stained_glass.jpg',                 'man_ice.jpg',                       'woman_robot_1.jpg'],\n"
    "    /* Halloween */\n"
    "    ['halloween/man_haunted_scarecrow.jpg',     'halloween/woman_swamp_creature.jpg','halloween/man_clockwork_corpse.jpg'],\n"
    "    ['woman_clockwork.jpg',                     'woman_dragon_skin.jpg',             'man_driftwood.jpg'],\n"
    "    ['man_quartzite.jpg',                       'man_impressionist.jpg',             'woman_music.jpg'],\n"
    "    /* Groups */\n"
    "    ['groups/groups_quilted.jpeg',              'groups/groups_porcelain.jpeg',      'groups/groups_forest_guardian.jpeg'],\n"
    "    ['groups/groups_family_mosaic.jpg',         'groups/groups_plushy.jpg',          'woman_face_petals.jpg'],\n"
    "    ['man_pencil_sketch.jpg',                   'woman_porcelain.jpg',               'man_watercolor2.jpg'],\n"
    "    /* Pets */\n"
    "    ['pets/pets_victorian.jpg?v=2',             'pets/pets_impressionist.jpg',       'pets/pets_clockwork.jpg'],\n"
    "    ['pets-halloween/hellborn_beast.jpg',        'pets-halloween/gargoyle_beast.jpg', 'woman_plushy.jpg'],\n"
    "    ['woman_robot_2.jpg',                       'man_coral.jpg',                     'man_elizabethan.jpg'],\n"
    "    /* Pets Halloween */\n"
    "    ['pets-halloween/harvest_god_beast.jpg',    'pets-halloween/plague_beast.jpg',   'pets-halloween/hellborn_beast.jpg'],\n"
    "    ['pets/pets_quilted.jpg',                   'pets/pets_impressionist.jpg',       'pets/pets_clockwork.jpg'],\n"
    "    ['woman_face_petals.jpg',                   'man_coral.jpg',                     'man_pencil_sketch.jpg']\n"
    "  ];\n"
    "\n"
    "  /* Flat arrays per column, for the existing turn() loop. */\n"
    "  var COLS = [0,1,2].map(function(c){\n"
    "    return COL_GROUPS.map(function(g){ return g[c]; });\n"
    "  });"
)

# ----------------------------------------------------------------------
# B . THE TRIPTYCH ENGINE TRIES tall-small TOO
# ----------------------------------------------------------------------
B_OLD = (
    "      var tall  = S + 'tall/' + list[i];\n"
    "      var plain = S + list[i];"
)
B_NEW = (
    "      /* CUI 41A, 23 Aug 2026. tall-small is tried first: same plates,\n"
    "         half the weight. Falls through to tall, then plain. */\n"
    "      var tall  = S + 'tall-small/' + list[i];\n"
    "      var mid   = S + 'tall/' + list[i];\n"
    "      var plain = S + list[i].replace('?v=2','');"
)

B2_OLD = (
    "      img.onerror = function(){\n"
    "        if (img.src.indexOf('/tall/') > -1){ img.src = plain; return; }\n"
    "        /* neither on disk — skipped rather than shown as a grey panel */\n"
    "      };\n"
    "      img.src = tall;"
)
B2_NEW = (
    "      img.onerror = function(){\n"
    "        if (img.src.indexOf('/tall-small/') > -1){ img.src = mid; return; }\n"
    "        if (img.src.indexOf('/tall/') > -1){ img.src = plain; return; }\n"
    "        /* neither on disk — skipped rather than shown as a grey panel */\n"
    "      };\n"
    "      img.src = tall;"
)

# ----------------------------------------------------------------------
# C . THE HEADLINE AND BUTTON FOLLOW THE GROUP
# ----------------------------------------------------------------------
C_OLD = (
    "      <a class=\"trip-go\" href=\"/portraits\">Let&rsquo;s Get Started</a>\n"
    "      <a class=\"trip-see\" href=\"/gallery\">See every finish</a>"
)
C_NEW = (
    "      <a class=\"trip-go\" id=\"tripGo\" href=\"/portraits\">Let&rsquo;s Get Started</a>\n"
    "      <a class=\"trip-see\" href=\"/gallery\">See every finish</a>"
)

C2_OLD = (
    "    /* Staggered starts and slightly different intervals. Three panels on\n"
    "       the same clock is a slideshow; three on their own is a room. */\n"
    "    setTimeout(function(){\n"
    "      turn();\n"
    "      setInterval(turn, 5200 + c * 700);\n"
    "    }, 2000 + c * 1400);\n"
    "\n"
    "    list.slice(0, 3).forEach(function(f){ new Image().src = S + 'tall/' + f; });"
)
C2_NEW = (
    "    /* Staggered starts and slightly different intervals.\n"
    "       When column 0 turns over, check whether the group index has moved\n"
    "       and update the headline and button if so. Three plates per group\n"
    "       = group index is Math.floor(i_col0 / 3). */\n"
    "    var GROUP_META = [\n"
    "      { say:'Photographs, <em>reimagined.</em><br>A likeness, recrafted.',\n"
    "        go:'Craft a portrait', href:'/portraits' },\n"
    "      { say:'Some faces are better <em>after dark.</em>',\n"
    "        go:'Enter Halloween', href:'/halloween' },\n"
    "      { say:'Everyone, <em>in one piece.</em>',\n"
    "        go:'Craft a group portrait', href:'/groups' },\n"
    "      { say:'They sat for you <em>once.</em>',\n"
    "        go:'Craft a pet portrait', href:'/pets/portraits' },\n"
    "      { say:'The other season, <em>for the other half of the house.</em>',\n"
    "        go:'Enter the Pet Halloween room', href:'/pets/halloween' }\n"
    "    ];\n"
    "    var tripSay = document.querySelector('.trip-say h1');\n"
    "    var tripGo  = document.getElementById('tripGo');\n"
    "    var lastGroup = -1;\n"
    "    /* Called by column 0's turn() after each advance. */\n"
    "    window.__tripTick = function(idx){\n"
    "      var g = Math.floor(idx / 3) % GROUP_META.length;\n"
    "      if (g === lastGroup) return;\n"
    "      lastGroup = g;\n"
    "      var m = GROUP_META[g];\n"
    "      if (tripSay) tripSay.innerHTML = m.say;\n"
    "      if (tripGo){ tripGo.textContent = m.go; tripGo.href = m.href; }\n"
    "    };\n"
    "\n"
    "    setTimeout(function(){\n"
    "      turn();\n"
    "      setInterval(turn, 5200 + c * 700);\n"
    "    }, 2000 + c * 1400);\n"
    "\n"
    "    list.slice(0, 3).forEach(function(f){ new Image().src = S + 'tall-small/' + f; });"
)

# Patch turn() in col 0 to call __tripTick. Anchor on the `i =` line
# which is unique per the existing code.
C3_OLD = (
    "      img.src = tall;\n"
    "      i = (i + 1) % list.length;\n"
    "    }\n"
    "\n"
    "    turn();\n"
    "    /* Staggered starts"
)
C3_NEW = (
    "      img.src = tall;\n"
    "      i = (i + 1) % list.length;\n"
    "      /* Column 0 drives the headline. */\n"
    "      if (c === 0 && window.__tripTick) window.__tripTick(i);\n"
    "    }\n"
    "\n"
    "    turn();\n"
    "    /* Staggered starts"
)

# ----------------------------------------------------------------------
# D . THE GROUPS FOLD
# ----------------------------------------------------------------------
D_OLD = "\n<!-- ═══ FOLD 3 · THE GIFT, PART ONE ═══ -->"
D_NEW = (
    "\n"
    "<!-- FOLD · GROUPS. Four plates, one fold, same pattern as Halloween. -->\n"
    "<section class=\"worlds s-coffee desk-only\" id=\"groupsfold\">\n"
    "  <div class=\"wrap\">\n"
    "    <div class=\"sec-head\">\n"
    "      <div class=\"label lt\">Groups &middot; twenty-eight finishes</div>\n"
    "      <h2>Everyone, <em>in one piece.</em></h2>\n"
    "      <p>Bring us the one photograph you all liked. We will find\n"
    "         something to do with it that holds everyone together.</p>\n"
    "    </div>\n"
    "    <div class=\"wgrid\">\n"
    "      <a class=\"world\" href=\"/groups\">\n"
    "        <div class=\"ph\" style=\"background-image:url(/previews/home/splash/tall/groups/groups_forest_guardian.jpeg);background-size:cover;background-position:center top\"></div>\n"
    "        <div class=\"body\"><div class=\"n\">The Natural World</div>\n"
    "          <div class=\"fin\">Forest Guardian &middot; Living Reef &middot; Lichen Granite</div>\n"
    "          <div class=\"cnt\">7 finishes</div></div></a>\n"
    "      <a class=\"world\" href=\"/groups\">\n"
    "        <div class=\"ph\" style=\"background-image:url(/previews/home/splash/tall/groups/groups_family_mosaic.jpg);background-size:cover;background-position:center\"></div>\n"
    "        <div class=\"body\"><div class=\"n\">Art &amp; Craft</div>\n"
    "          <div class=\"fin\">Family Mosaic &middot; Ukiyo-e &middot; Art Nouveau</div>\n"
    "          <div class=\"cnt\">7 finishes</div></div></a>\n"
    "      <a class=\"world\" href=\"/groups\">\n"
    "        <div class=\"ph\" style=\"background-image:url(/previews/home/splash/tall/groups/groups_plushy.jpg);background-size:cover;background-position:center\"></div>\n"
    "        <div class=\"body\"><div class=\"n\">Made by Hand</div>\n"
    "          <div class=\"fin\">Plushy &middot; Quilted &middot; Origami &middot; Folded Book</div>\n"
    "          <div class=\"cnt\">7 finishes</div></div></a>\n"
    "      <a class=\"world\" href=\"/groups\">\n"
    "        <div class=\"ph\" style=\"background-image:url(/previews/home/splash/tall/groups/groups_quilted.jpeg);background-size:cover;background-position:center\"></div>\n"
    "        <div class=\"body\"><div class=\"n\">Another Time</div>\n"
    "          <div class=\"fin\">Renaissance &middot; Elizabethan &middot; Persian Court</div>\n"
    "          <div class=\"cnt\">7 finishes</div></div></a>\n"
    "    </div>\n"
    "    <div class=\"w-foot\">\n"
    "      <p>&ldquo;Bring us the one photograph you all liked.&rdquo; &mdash; C.</p>\n"
    "      <div class=\"w-acts\">\n"
    "        <a class=\"w-own\" href=\"/groups\">Enter the Groups room</a>\n"
    "      </div>\n"
    "    </div>\n"
    "  </div>\n"
    "</section>\n"
    "\n"
    "<!-- ═══ FOLD 3 · THE GIFT, PART ONE ═══ -->"
)

# ----------------------------------------------------------------------
# E . MOBILE BUTTON 15px HIGHER
# ----------------------------------------------------------------------
E_OLD = "    bottom:calc(66px + env(safe-area-inset-bottom) + 128px);"
E_NEW = "    bottom:calc(66px + env(safe-area-inset-bottom) + 143px);"

EDITS = [
    ("A . plate swaps, Groups in COLS",              A_OLD, A_NEW),
    ("B . triptych tries tall-small first",          B_OLD, B_NEW),
    ("B2. fallback chain extended",                  B2_OLD, B2_NEW),
    ("C . headline and button wired",                C_OLD, C_NEW),
    ("C2. GROUP_META and __tripTick",                C2_OLD, C2_NEW),
    ("C3. col 0 calls __tripTick",                   C3_OLD, C3_NEW),
    ("D . Groups fold inserted",                     D_OLD, D_NEW),
    ("E . mobile button 15px higher",                E_OLD, E_NEW),
    ("F . Halloween fold card swap",
     "background-image:url(/previews/home/splash/halloween/man_ice_wraith.jpg)",
     "background-image:url(/previews/home/splash/halloween/man_haunted_scarecrow.jpg)"),
    ("G . REEL_SERIES mobile plate swap",
     "['man_ice_wraith.jpg',       'Or something that waits after dark'],",
     "['man_haunted_scarecrow.jpg','Or something that waits after dark'],"),
    ("H . REEL desktop plate swap",
     "['halloween/man_ice_wraith.jpg',      'Or something that waits after dark'],",
     "['halloween/man_haunted_scarecrow.jpg','Or something that waits after dark'],"),
]

MUST_APPEAR = [
    "var COL_GROUPS = [",
    "groups/groups_quilted.jpeg",
    "id=\"tripGo\"",
    "window.__tripTick",
    "id=\"groupsfold\"",
    "bottom:calc(66px + env(safe-area-inset-bottom) + 143px);",
    "tall-small/' + list[i]",
]
MUST_VANISH = [
    "woman_elizabethan.jpg','pets-halloween/gargoyle",
    "bottom:calc(66px + env(safe-area-inset-bottom) + 128px);",
    "man_ice_wr" + "aith.jpg",
]


def crlf(s):
    return s.replace("\n", "\r\n")


def run(src_dir, out_dir, apply):
    ok = True
    for name in FILES:
        src = os.path.join(src_dir, name)
        print("")
        print("=" * 66)
        print(name)
        print("=" * 66)

        if not os.path.isfile(src):
            print("  REFUSED: not found -- %s" % src)
            ok = False
            continue

        f = io.open(src, "r", encoding="utf-8", newline="")
        text = f.read()
        f.close()
        before = len(text)

        halt = False
        for label, old, new in EDITS:
            n = text.count(crlf(old))
            if n != 1:
                if crlf(new) in text:
                    print("  REFUSED: already applied -- %s" % label)
                else:
                    print("  REFUSED: anchor %d times, need 1 -- %s" % (n, label))
                halt = True
        if halt:
            ok = False
            continue

        for label, old, new in EDITS:
            text = text.replace(crlf(old), crlf(new), 1)
            print("  ok   %s" % label)

        halt = False
        for s in MUST_APPEAR:
            if crlf(s) not in text:
                print("  REFUSED: missing after edit -- %s" % s)
                halt = True
        for s in MUST_VANISH:
            if crlf(s) in text:
                print("  REFUSED: still present -- %s" % s)
                halt = True
        if halt:
            ok = False
            continue

        print("  %d bytes -> %d  (+%d)" % (before, len(text), len(text) - before))

        if apply:
            dst = os.path.join(out_dir, name)
            g = io.open(dst, "w", encoding="utf-8", newline="")
            g.write(text)
            g.close()
            print("  WROTE %s" % dst)
        else:
            print("  DRY RUN -- nothing written")

    print("")
    if not ok:
        print("ONE OR MORE FILES REFUSED. Nothing partial was written.")
        return 1
    print("All files clean.")
    return 0


if __name__ == "__main__":
    apply = "--apply" in sys.argv
    home = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    downloads = os.path.join(home, "Downloads")

    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)

    out_dir = downloads
    src_dir = ""
    for a in sys.argv[1:]:
        if a.startswith("--src="):
            src_dir = a[6:]
        if a.startswith("--out="):
            out_dir = a[6:]

    if not src_dir:
        src_dir = os.path.join(repo, "public")

    if not os.path.isdir(src_dir):
        print("")
        print("REFUSED: no public/ at %s" % src_dir)
        print("This script derives the repo from its own location and must")
        print("be installed to scripts\\ before it is run.")
        sys.exit(1)

    print("")
    print("reading  %s" % src_dir)
    print("writing  %s" % out_dir)
    sys.exit(run(src_dir, out_dir, apply))
