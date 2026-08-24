#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-index-reel-r10.py  -  CUI 41A  -  23 August 2026

THE MOBILE FRONT PAGE BECOMES ONE PANEL PER SERIES.

It was a single reel of twenty-five plates from every Series at once,
under one button that always went to Portraits. A stranger saw a dog, a
swamp creature and a Renaissance gentleman inside ten seconds with no way
to say which of those they wanted, and the button did not follow what was
on the screen.

Ruled by Rich, 23 August:

  - one panel per Series, swiped left and right
  - the plates inside a panel crossfade on their own, as they did before
  - the button follows the panel and goes to that Series' room

Five panels: Portraits, Halloween, Groups, Pets, Pets Halloween. Portraits
opens because it is the deepest room and the least explaining.

The button lands on the effects floor, not the upload screen -- r3 made
that the mobile landing, so the photograph is asked for at the press of an
effect rather than before anything has been shown.

TWO THINGS ABOUT THE PLATES

tall-small/ is preferred over tall/. It mirrors tall exactly at half the
weight -- 250K against 500K -- and it is the only place the Groups plates
exist. tall/ is kept as the fallback for anything not compressed yet, and
the square original behind that.

The extension travels with the plate name. Groups is .jpeg and everything
else is .jpg, so a builder that appended a fixed extension would 404 four
plates in the middle of the reel and nobody would see why.

COPY: the lines carried over are the existing ones, plate for plate. The
lines marked DRAFT are new -- Groups had none, and the newer Halloween and
Pet plates had none. THEY ARE FOR RICH TO RULE ON, and they are gathered
at the top of SERIES so they can be read in one place.

Applies to index.html.
Reads <repo>\\public. Writes to Downloads. Must be installed to scripts\\.
"""

import os
import sys
import io

FILES = ["index.html"]

# ----------------------------------------------------------------------
# A . THE MARKUP
# ----------------------------------------------------------------------
A_OLD = (
    "    <div class=\"m-say\">\n"
    "      <h1 id=\"mSay\">Imagine yourself in the Renaissance.</h1>\n"
    "      <a class=\"m-go\" href=\"/portraits\">Let&rsquo;s Get Started</a>\n"
    "      <span class=\"m-scroll\">Scroll</span>\n"
    "    </div>"
)
A_NEW = (
    "    <div class=\"m-say\">\n"
    "      <h1 id=\"mSay\">Imagine yourself in the Renaissance.</h1>\n"
    "      <!-- CUI 41A, 23 Aug 2026. The button follows the panel. Its\n"
    "           label and its href are both written by the reel. -->\n"
    "      <a class=\"m-go\" id=\"mGo\" href=\"/portraits\">Let&rsquo;s Get Started</a>\n"
    "      <span class=\"m-scroll\">Scroll</span>\n"
    "    </div>\n"
    "    <!-- Which of five, and how far along. Tappable, because a dot that\n"
    "         shows position and refuses to take you there is a tease. -->\n"
    "    <div class=\"m-dots\" id=\"mDots\"></div>"
)

# ----------------------------------------------------------------------
# B . THE DATA
# ----------------------------------------------------------------------
B_OLD = "  var REEL = ["
B_NEW = (
    "  /* CUI 41A, 23 Aug 2026. REEL became SERIES: one panel per Series,\n"
    "     swiped between, each holding its own plates and its own way in.\n"
    "\n"
    "     `plates` carry their own extension. Groups is .jpeg and the rest\n"
    "     are .jpg, and a builder that appended a fixed one would quietly\n"
    "     404 a quarter of the reel.\n"
    "\n"
    "     LINES MARKED DRAFT ARE NOT RICH'S. Groups had no lines at all and\n"
    "     the newer Halloween and Pet plates had none either. Everything\n"
    "     unmarked is carried over from the old REEL, plate for plate. */\n"
    "  var SERIES = [\n"
    "    { id:'portraits', label:'Portraits', href:'/portraits',\n"
    "      go:'Craft a portrait', dir:'',\n"
    "      plates:[\n"
    "        ['impressionist_man2.jpg',   'Imagine yourself as a work of art'],\n"
    "        ['woman_music.jpg',          'Or the notes of a song'],\n"
    "        ['woman_renaissance.jpg',    'Or back to the Renaissance'],\n"
    "        ['woman_stained_glass.jpg',  'Or maybe as a beautiful lamp'],\n"
    "        ['man_ice.jpg',              'We turn your photographs into impossible things'],\n"
    "        ['woman_folded_book.jpg',    'Or turn into your favourite novel'],\n"
    "        ['woman_face_petals.jpg',    'Or your favourite flowers'],\n"
    "        ['man_neon.jpg',             'Fifty-six finishes, and counting']       /* DRAFT */\n"
    "      ] },\n"
    "\n"
    "    { id:'halloween', label:'Halloween', href:'/halloween',\n"
    "      go:'Enter Halloween', dir:'halloween/',\n"
    "      plates:[\n"
    "        ['man_ice_wraith.jpg',       'Or something that waits after dark'],\n"
    "        ['woman_swamp_creature.jpg', 'We have a room for October'],\n"
    "        ['man_haunted_scarecrow.jpg','Some faces are better after dark'],      /* DRAFT */\n"
    "        ['man_clockwork_corpse.jpg', 'Twenty-eight ways to be unrecognisable'] /* DRAFT */\n"
    "      ] },\n"
    "\n"
    "    { id:'groups', label:'Groups', href:'/groups',\n"
    "      go:'Craft a group portrait', dir:'groups/',\n"
    "      plates:[\n"
    "        ['groups_quilted.jpeg',         'Everyone, in one piece'],             /* DRAFT */\n"
    "        ['groups_porcelain.jpeg',       'The whole family, held still'],       /* DRAFT */\n"
    "        ['groups_forest_guardian.jpeg', 'Or somewhere none of you have been'], /* DRAFT */\n"
    "        ['groups_origami.jpeg',         'Bring us the one photograph you all liked'] /* DRAFT */\n"
    "      ] },\n"
    "\n"
    "    { id:'pets', label:'Pets', href:'/pets/portraits',\n"
    "      go:'Craft a pet portrait', dir:'pets/',\n"
    "      plates:[\n"
    "        ['pets_victorian.jpg',     'Your dog has never been painted'],\n"
    "        ['pets_impressionist.jpg', 'Cats sit for us too'],\n"
    "        ['pets_quilted.jpg',       'Thirty-four finishes, for the ones who will not hold still'], /* DRAFT */\n"
    "        ['pets_clockwork.jpg',     'Nobody has ever asked us for a small one']  /* DRAFT */\n"
    "      ] },\n"
    "\n"
    "    { id:'pets-halloween', label:'Pets Halloween', href:'/pets/halloween',\n"
    "      go:'Enter the Pet Halloween room', dir:'pets-halloween/',\n"
    "      plates:[\n"
    "        ['hellborn_beast.jpg',     'Though he may prefer something fiercer'],\n"
    "        ['harvest_god_beast.jpg',  'And come back as something else'],\n"
    "        ['gargoyle_beast.jpg',     'The other season, for the other half of the house'], /* DRAFT */\n"
    "        ['plague_beast.jpg',       'Twenty-seven of them, and they all bite']   /* DRAFT */\n"
    "      ] }\n"
    "  ];\n"
    "\n"
    "  /* Kept so nothing else that reads REEL breaks. Nothing does today. */\n"
    "  var REEL = ["
)

# ----------------------------------------------------------------------
# C . THE ENGINE
# ----------------------------------------------------------------------
C_OLD = (
    "    var frames = [], carried = '';\n"
    "    REEL.forEach(function(row){\n"
    "      if (row[1]) carried = row[1];\n"
    "      frames.push({ big:S + 'tall/' + row[0], small:S + row[0], say:carried });\n"
    "    });\n"
    "    if (!frames.length) return;"
)
C_NEW = (
    "    /* CUI 41A, 23 Aug 2026. Built per Series rather than as one list.\n"
    "\n"
    "       Three sources per plate, tried in order: tall-small, which is the\n"
    "       compressed 9:16 and the only place the Groups plates live; tall,\n"
    "       for anything not compressed yet; and the square original, which\n"
    "       shows contained on the blurred ground. The existing paint()\n"
    "       already walks a big/small pair on error, so this hands it the two\n"
    "       best available and keeps the third behind them. */\n"
    "    var PANELS = SERIES.map(function(s){\n"
    "      return {\n"
    "        id:s.id, label:s.label, href:s.href, go:s.go,\n"
    "        frames:s.plates.map(function(p){\n"
    "          return {\n"
    "            big:   S + 'tall-small/' + s.dir + p[0],\n"
    "            mid:   S + 'tall/'       + s.dir + p[0],\n"
    "            small: S + s.dir + p[0],\n"
    "            say:   p[1]\n"
    "          };\n"
    "        })\n"
    "      };\n"
    "    }).filter(function(p){ return p.frames.length; });\n"
    "    if (!PANELS.length) return;\n"
    "\n"
    "    var GO   = document.getElementById('mGo');\n"
    "    var DOTS = document.getElementById('mDots');\n"
    "    var panel = 0, timer = null;\n"
    "    var frames = PANELS[0].frames;\n"
    "\n"
    "    function dots(){\n"
    "      if (!DOTS) return;\n"
    "      DOTS.innerHTML = '';\n"
    "      PANELS.forEach(function(p, k){\n"
    "        var b = document.createElement('button');\n"
    "        b.type = 'button';\n"
    "        b.className = 'm-dot' + (k === panel ? ' is-on' : '');\n"
    "        b.setAttribute('aria-label', p.label);\n"
    "        b.addEventListener('click', function(){ go(k, k > panel ? 1 : -1); });\n"
    "        DOTS.appendChild(b);\n"
    "      });\n"
    "    }\n"
    "\n"
    "    /* The panel changes under the crossfade rather than sliding a\n"
    "       carousel: the plates are already two stacked layers, and a real\n"
    "       horizontal scroller would need five copies of them. The swipe is\n"
    "       answered with a short nudge in the direction travelled so the\n"
    "       gesture is acknowledged even though nothing slides. */\n"
    "    function go(next, dirn){\n"
    "      next = (next + PANELS.length) % PANELS.length;\n"
    "      panel = next;\n"
    "      frames = PANELS[panel].frames;\n"
    "      i = 0;\n"
    "      if (GO){\n"
    "        GO.textContent = PANELS[panel].go;\n"
    "        GO.setAttribute('href', PANELS[panel].href);\n"
    "      }\n"
    "      var reel = document.getElementById('mReel');\n"
    "      if (reel && dirn){\n"
    "        reel.classList.remove('nudge-l','nudge-r');\n"
    "        void reel.offsetWidth;\n"
    "        reel.classList.add(dirn > 0 ? 'nudge-l' : 'nudge-r');\n"
    "      }\n"
    "      dots();\n"
    "      paint(frames[0]);\n"
    "      warm();\n"
    "      clock();\n"
    "    }\n"
    "\n"
    "    function warm(){\n"
    "      frames.slice(1, 4).forEach(function(f){ new Image().src = f.big; });\n"
    "    }\n"
    "\n"
    "    /* ---- the swipe ----------------------------------------------\n"
    "       Touch, not pointer events: a horizontal drag on a full-bleed\n"
    "       picture must not also be read as a scroll, and touchmove is\n"
    "       where that is decided. The axis is settled on the first few\n"
    "       pixels and not revisited, so a swipe that drifts does not turn\n"
    "       into a scroll halfway through. */\n"
    "    (function(){\n"
    "      var reel = document.getElementById('mReel');\n"
    "      if (!reel) return;\n"
    "      var x0 = 0, y0 = 0, axis = '';\n"
    "      reel.addEventListener('touchstart', function(e){\n"
    "        var t = e.changedTouches[0];\n"
    "        x0 = t.clientX; y0 = t.clientY; axis = '';\n"
    "      }, { passive:true });\n"
    "      reel.addEventListener('touchmove', function(e){\n"
    "        if (axis) return;\n"
    "        var t = e.changedTouches[0];\n"
    "        var dx = Math.abs(t.clientX - x0), dy = Math.abs(t.clientY - y0);\n"
    "        if (dx < 8 && dy < 8) return;\n"
    "        axis = dx > dy ? 'x' : 'y';\n"
    "      }, { passive:true });\n"
    "      reel.addEventListener('touchend', function(e){\n"
    "        if (axis !== 'x') return;\n"
    "        var dx = e.changedTouches[0].clientX - x0;\n"
    "        if (Math.abs(dx) < 45) return;\n"
    "        go(panel + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);\n"
    "      }, { passive:true });\n"
    "    })();\n"
    "\n"
    "    /* A keyboard and a trackpad reach this page too. */\n"
    "    addEventListener('keydown', function(e){\n"
    "      if (e.key === 'ArrowRight') go(panel + 1, 1);\n"
    "      if (e.key === 'ArrowLeft')  go(panel - 1, -1);\n"
    "    });"
)

# ----------------------------------------------------------------------
# D . THE CLOCK
# ----------------------------------------------------------------------
D_OLD = (
    "    paint(frames[0]);\n"
    "    /* Three seconds. Two read as a flicker \u2014 the cross fade alone is over\n"
    "       a second of it, so the picture was barely still before the next one\n"
    "       arrived. Four was a beat too patient. */\n"
    "    setInterval(function(){\n"
    "      i = (i + 1) % frames.length;\n"
    "      paint(frames[i]);\n"
    "    }, 3000);\n"
    "\n"
    "    /* Warm the next few so the fade has something to fade to. */\n"
    "    frames.slice(1, 6).forEach(function(f){ new Image().src = f.big || f.small; });\n"
    "    /* And the squares behind them, so a fallback does not stall the fade. */\n"
    "    frames.slice(1, 6).forEach(function(f){ if (f.small) new Image().src = f.small; });"
)
D_NEW = (
    "    /* CUI 41A, 23 Aug 2026. The clock restarts on every panel change --\n"
    "       an interval left running would advance the plate a moment after a\n"
    "       swipe and make the swipe look like it did two things.\n"
    "\n"
    "       Three seconds, unchanged. Two read as a flicker; four is a beat\n"
    "       too patient. */\n"
    "    function clock(){\n"
    "      if (timer) clearInterval(timer);\n"
    "      timer = setInterval(function(){\n"
    "        i = (i + 1) % frames.length;\n"
    "        paint(frames[i]);\n"
    "      }, 3000);\n"
    "    }\n"
    "\n"
    "    go(0, 0);"
)

# ----------------------------------------------------------------------
# E . THE DOTS, AND THE NUDGE
# ----------------------------------------------------------------------
E_OLD = "  .m-scroll{ display:none }"
E_NEW = (
    "  .m-scroll{ display:none }\n"
    "\n"
    "  /* ---- ONE PANEL PER SERIES  ---------------------------------------\n"
    "     CUI 41A, 23 Aug 2026. Five Series, swiped between. The dots say\n"
    "     which of five and take you there; a dot that shows position and\n"
    "     refuses to act on a tap is a tease.\n"
    "\n"
    "     They sit above the button rather than below it, because below it is\n"
    "     the fixed bar and anything down there is a thumb's width from the\n"
    "     wrong tap. */\n"
    "  .m-dots{\n"
    "    position:absolute; left:0; right:0; z-index:4;\n"
    "    bottom:calc(66px + env(safe-area-inset-bottom) + 128px);\n"
    "    display:flex; justify-content:center; gap:10px;\n"
    "    pointer-events:none;\n"
    "  }\n"
    "  .m-dot{\n"
    "    pointer-events:auto;\n"
    "    width:8px; height:8px; padding:0; border:0; border-radius:999px;\n"
    "    background:rgba(243,237,225,.38);\n"
    "    transition:background .3s ease, width .3s ease;\n"
    "  }\n"
    "  /* The one you are on is longer, not merely brighter. Brightness alone\n"
    "     is hard to read over a picture that keeps changing underneath it. */\n"
    "  .m-dot.is-on{ width:26px; background:var(--vellum-100) }\n"
    "\n"
    "  /* The swipe is answered even though nothing slides -- the plates are\n"
    "     two stacked layers and a real carousel would need five copies of\n"
    "     them. A short travel in the direction of the thumb is enough to say\n"
    "     the gesture landed. */\n"
    "  @keyframes m-nudge-l{ from{ transform:translateX(26px) } to{ transform:none } }\n"
    "  @keyframes m-nudge-r{ from{ transform:translateX(-26px) } to{ transform:none } }\n"
    "  .m-reel.nudge-l .m-slide{ animation:m-nudge-l .42s cubic-bezier(.2,.7,.3,1) }\n"
    "  .m-reel.nudge-r .m-slide{ animation:m-nudge-r .42s cubic-bezier(.2,.7,.3,1) }\n"
)

EDITS = [
    ("A . the button and the dots",        A_OLD, A_NEW),
    ("B . five Series, with their plates", B_OLD, B_NEW),
    ("C . the panels, and the swipe",      C_OLD, C_NEW),
    ("D . the clock restarts per panel",   D_OLD, D_NEW),
    ("E . how the dots look",              E_OLD, E_NEW),
]

MUST_APPEAR = [
    "id=\"mDots\"",
    "id:'pets-halloween', label:'Pets Halloween'",
    "S + 'tall-small/' + s.dir + p[0]",
    "if (Math.abs(dx) < 45) return;",
    ".m-dot.is-on{ width:26px; background:var(--vellum-100) }",
    "go(0, 0);",
]
MUST_VANISH = [
    "setInterval(function(){\r\n      i = (i + 1) % frames.length;\r\n      paint(frames[i]);\r\n    }, 3000);",
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
                    print("  REFUSED: anchor found %d times, need 1 -- %s" % (n, label))
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
            if s in text:
                print("  REFUSED: the old interval is still there")
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
