#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-index-r13.py  -  CUI 41A  -  23 August 2026

  1  THE DESKTOP HEADLINE IS OUT OF SYNC WITH THE IMAGES.
     __tripTick fired as soon as col 0 entered a new group. Cols 1 and 2
     run on staggered clocks (1400ms and 2800ms behind col 0, with wider
     intervals too), so the headline was showing "Everyone, in one piece"
     for five to ten seconds before a Group plate appeared in any column.

     Fixed by gating the copy update: each column reports its current
     group on every turn. The copy updates only when all three columns
     agree on the same group -- i.e. when all three have committed at
     least one plate from that Series.

  2  THE EYEBROW BECOMES THE SERIES LABEL.
     It reads "The Studio" on load and follows the group from then on --
     Portraits, Halloween, Groups, Pets, Pets Halloween. The headline and
     button now arrive together with the label as one unit, which is what
     Rich asked for.

  3  TRANSITION.
     The copy block fades out and in when it changes, so it does not just
     snap to a new state mid-sentence.

Reads <repo>\\public. Writes to Downloads. Must be installed to scripts\\.
"""

import os
import sys
import io

FILES = ["index.html"]

# ----------------------------------------------------------------------
# A . IDs on the eyebrow and h1 for the script to reach
# ----------------------------------------------------------------------
A_OLD = (
    "  <div class=\"trip-say\">\n"
    "    <div class=\"eyebrow\">The Studio</div>\n"
    "    <h1>Photographs, <em>reimagined.</em><br>A likeness, recrafted.</h1>"
)
A_NEW = (
    "  <div class=\"trip-say\" id=\"tripSay\">\n"
    "    <div class=\"eyebrow\" id=\"tripEye\">The Studio</div>\n"
    "    <h1 id=\"tripH1\">Photographs, <em>reimagined.</em><br>A likeness, recrafted.</h1>"
)

# ----------------------------------------------------------------------
# B . THE TRANSITION CSS
# ----------------------------------------------------------------------
B_OLD = ".trip-acts a{"
B_NEW = (
    "/* CUI 41A, 23 Aug 2026. The copy fades when the group changes. */\n"
    "#tripSay{ transition:opacity .45s ease }\n"
    "#tripSay.is-fading{ opacity:0 }\n"
    "\n"
    ".trip-acts a{"
)

# ----------------------------------------------------------------------
# C . THE COLUMN TICK AND THE GATE
# ----------------------------------------------------------------------
C_OLD = (
    "      /* Column 0 drives the headline. */\n"
    "      if (c === 0 && window.__tripTick) window.__tripTick(i);"
)
C_NEW = (
    "      /* Each column reports its group. The copy updates when all\n"
    "         three agree. CUI 41A, 23 Aug 2026. */\n"
    "      if (window.__tripTick) window.__tripTick(c, Math.floor(i / 3));"
)

C2_OLD = (
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
    "    };"
)
C2_NEW = (
    "    var tripSayEl = document.getElementById('tripSay');\n"
    "    var tripH1    = document.getElementById('tripH1');\n"
    "    var tripEye   = document.getElementById('tripEye');\n"
    "    var tripGo    = document.getElementById('tripGo');\n"
    "    var colGroup  = [-1, -1, -1];   /* current group per column */\n"
    "    var lastGroup = -1;\n"
    "\n"
    "    /* Called by every column on every plate turn.\n"
    "       The copy updates only when all three columns agree on the same\n"
    "       group -- i.e. once every column has committed at least one plate\n"
    "       from the new Series. CUI 41A, 23 Aug 2026. */\n"
    "    window.__tripTick = function(col, g){\n"
    "      g = g % GROUP_META.length;\n"
    "      colGroup[col] = g;\n"
    "      /* All three in agreement? */\n"
    "      if (colGroup[0] !== colGroup[1] || colGroup[1] !== colGroup[2]) return;\n"
    "      if (g === lastGroup) return;\n"
    "      lastGroup = g;\n"
    "      var m = GROUP_META[g];\n"
    "      /* Fade out, swap, fade in. */\n"
    "      if (tripSayEl){\n"
    "        tripSayEl.classList.add('is-fading');\n"
    "        setTimeout(function(){\n"
    "          if (tripH1)  tripH1.innerHTML  = m.say;\n"
    "          if (tripEye) tripEye.textContent = m.label;\n"
    "          if (tripGo){ tripGo.textContent = m.go; tripGo.href = m.href; }\n"
    "          tripSayEl.classList.remove('is-fading');\n"
    "        }, 450);\n"
    "      } else {\n"
    "        if (tripH1)  tripH1.innerHTML  = m.say;\n"
    "        if (tripEye) tripEye.textContent = m.label;\n"
    "        if (tripGo){ tripGo.textContent = m.go; tripGo.href = m.href; }\n"
    "      }\n"
    "    };"
)

# ----------------------------------------------------------------------
# D . ADD label TO GROUP_META
# ----------------------------------------------------------------------
D_OLD = (
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
    "    ];"
)
D_NEW = (
    "    var GROUP_META = [\n"
    "      { label:'Portraits',\n"
    "        say:'Photographs, <em>reimagined.</em><br>A likeness, recrafted.',\n"
    "        go:'Craft a portrait', href:'/portraits' },\n"
    "      { label:'Halloween',\n"
    "        say:'Some faces are better <em>after dark.</em>',\n"
    "        go:'Enter Halloween', href:'/halloween' },\n"
    "      { label:'Groups',\n"
    "        say:'Everyone, <em>in one piece.</em>',\n"
    "        go:'Craft a group portrait', href:'/groups' },\n"
    "      { label:'Pets',\n"
    "        say:'They sat for you <em>once.</em>',\n"
    "        go:'Craft a pet portrait', href:'/pets/portraits' },\n"
    "      { label:'Pets Halloween',\n"
    "        say:'The other season, <em>for the other half of the house.</em>',\n"
    "        go:'Enter the Pet Halloween room', href:'/pets/halloween' }\n"
    "    ];"
)

EDITS = [
    ("A . ids on eyebrow and h1",              A_OLD, A_NEW),
    ("B . fade transition CSS",                B_OLD, B_NEW),
    ("C . every column reports its group",     C_OLD, C_NEW),
    ("C2. gate: all three must agree",         C2_OLD, C2_NEW),
    ("D . label added to GROUP_META",          D_OLD, D_NEW),
]

MUST_APPEAR = [
    "id=\"tripEye\"",
    "id=\"tripH1\"",
    "#tripSay.is-fading{ opacity:0 }",
    "colGroup[0] !== colGroup[1] || colGroup[1] !== colGroup[2]",
    "tripEye.textContent = m.label;",
    "label:'Portraits'",
]
MUST_VANISH = [
    "var tripSay = document.querySelector('.trip-say h1');",
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
                print("  REFUSED: missing -- %s" % s)
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
        print("ONE OR MORE FILES REFUSED.")
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
        print("Install to scripts\\ first.")
        sys.exit(1)

    print("")
    print("reading  %s" % src_dir)
    print("writing  %s" % out_dir)
    sys.exit(run(src_dir, out_dir, apply))
