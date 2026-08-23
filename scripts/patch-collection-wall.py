#!/usr/bin/env python3
"""
patch-collection-wall.py  -  23 August 2026  -  CUI V32

FOUR CHANGES TO MY COLLECTION, ruled by Rich 23 August.

  1  LANDS ON VIEW ALL. MC_FILT defaulted to 'Portraits', so a customer
     whose last three pieces were Groups arrived at a room that looked
     empty and had to find the right pill to see their own work.

  2  ACTION COMES OUT of the rail. The Series does not exist. Nothing
     writes it, so the pill was always a room with nothing in it.

  3  PETS HALLOWEEN GOES IN. Those pieces store series 'pets' - a
     deliberate decision, noted at SERIES_LABEL, so both pet rooms shared
     one filter. Rich ruled today they separate.

     THE SPLIT IS BY LABEL, NOT BY SERIES, AND THAT IS THE WEAK POINT.
     A collection row carries id, label, series, image_url and archived -
     no preset, so the pethw_ prefix that separates the two rooms
     everywhere else is not available here. The 27 Pets Halloween labels
     are read from pets-halloween-registry.js and matched against the
     piece's name.

     If a Pets effect is ever given a label that also exists in Pets
     Halloween, that piece lands in the wrong pill. Nothing else breaks.
     The real fix is `preset` on the collection row, which is CENG's and
     is not worth a round today.

  4  ON THE WALL. A filter, a mark on the tile, and Take it down without
     going to the board first. Reads GET /api/v1/community/posts/mine,
     built by CENG 23 August, which answers { piece_id: post_id }.

     SHARE IS NOT HERE. The permanent public URL is made at post time and
     comes back on the board's GET; /posts/mine returns ids only. So the
     collection can say a piece is on the wall and take it down, and the
     board is where the link is.

SIX FILES. Every room carries its own copy of the collection.

READS   D:\\minramas\\public\\<page>.html
WRITES  %USERPROFILE%\\Downloads\\<page>.html
"""

import os
import sys

REPO = r"D:\minramas\public"
OUT = os.path.join(os.environ.get("USERPROFILE", os.path.expanduser("~")),
                   "Downloads")

PAGES = [
    "portraits.html",
    "pets.html",
    "halloween.html",
    "pets-halloween.html",
    "pets-chooser.html",
    "groups.html",
]

EDITS = []

# ---- 1 · the rail, and the default --------------------------------------
EDITS.append((
    "  var MC_SERIES = ['Action','Groups','Halloween','Mobile Wallpapers','Pets','Portraits'];",

    "  /* Action is out - the Series does not exist and nothing writes it.\r\n"
    "     Pets Halloween is in, and is the one entry not backed by a stored\r\n"
    "     series: those pieces store 'pets'. See mcSeriesOf(). */\r\n"
    "  var MC_SERIES = ['Groups','Halloween','Mobile Wallpapers','Pets',\r\n"
    "                   'Pets Halloween','Portraits'];"
))

# Each room defaults this to its OWN Series - six files, six different
# values, which is the drift that made the fault. Anchored on the comment
# above it, which is identical everywhere.
EDITS.append((
    "  var MC_FILT = ",

    "  /* VIEW ALL. Every room defaulted this to its own Series, so somebody\r\n"
    "     whose last three pieces were Groups arrived in the Portraits room\r\n"
    "     at a collection that looked empty, and had to find the right pill\r\n"
    "     to see their own work. Ruled 23 August. */\r\n"
    "  var MC_FILT = 'all'; //"
))

# ---- 2 · the Pets Halloween labels --------------------------------------
EDITS.append((
    "  function pieceTile(p){",

    "  /* \u2500\u2500 PETS HALLOWEEN, SPLIT OUT OF PETS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
    "     Those pieces store series 'pets', so there is nothing in the row\n"
    "     that separates the two pet rooms. The collection carries no preset,\n"
    "     so the pethw_ prefix used everywhere else is not available.\n"
    "\n"
    "     Matched on the label instead, against the 27 names in the Pets\n"
    "     Halloween registry when that registry happens to be loaded on this\n"
    "     page. Where it is not, the map is empty and every pet piece stays\n"
    "     under Pets - which is the behaviour before today, not a fault.\n"
    "\n"
    "     A Pets effect sharing a label with a Pets Halloween one would land\n"
    "     in the wrong pill. `preset` on the collection row is the real fix\n"
    "     and it is CENG's. */\n"
    "  var PETHW_LABELS = (function(){\n"
    "    var m = {}, r = window.PETS_HALLOWEEN_REGISTRY;\n"
    "    if (r && r.effects && r.effects.forEach){\n"
    "      r.effects.forEach(function(e){ if (e && e.label) m[e.label] = true; });\n"
    "    }\n"
    "    return m;\n"
    "  })();\n"
    "\n"
    "  function mcSeriesOf(p){\n"
    "    if (p && p.series === 'Pets' && p.name && PETHW_LABELS[p.name]){\n"
    "      return 'Pets Halloween';\n"
    "    }\n"
    "    return p ? p.series : '';\n"
    "  }\n"
    "\n"
    "  /* \u2500\u2500 WHAT IS ON THE WALL \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
    "     serverId -> post id, from GET /api/v1/community/posts/mine. The\n"
    "     post id is what DELETE takes, which is why it is held rather than\n"
    "     a boolean. */\n"
    "  var ON_WALL = {};\n"
    "\n"
    "  function loadOnWall(){\n"
    "    return fetch('/api/v1/community/posts/mine', { credentials:'include' })\n"
    "      .then(function(r){ return r.json(); })\n"
    "      .then(function(d){\n"
    "        if (!d || !d.ok || !d.posts) return;\n"
    "        ON_WALL = d.posts;\n"
    "        renderCollection();\n"
    "      })\n"
    "      /* Degraded, not broken. No badges this load; everything else on\n"
    "         the page still works. */\n"
    "      .catch(function(){});\n"
    "  }\n"
    "\n"
    "  function onWall(p){\n"
    "    return !!(p && p.serverId && ON_WALL[p.serverId]);\n"
    "  }\n"
    "\n"
    "  function pieceTile(p){"
))

# ---- 3 · the filter reads the derived Series ----------------------------
EDITS.append((
    "    var live = PIECES.filter(function(p){ return !p.archived; });\r\n"
    "    if (MC_FILT === 'all') return live;\r\n"
    "    return live.filter(function(p){ return p.series === MC_FILT; });",

    "    var live = PIECES.filter(function(p){ return !p.archived; });\r\n"
    "    if (MC_FILT === 'all') return live;\r\n"
    "    if (MC_FILT === 'wall'){\r\n"
    "      return live.filter(function(p){ return onWall(p); });\r\n"
    "    }\r\n"
    "    return live.filter(function(p){ return mcSeriesOf(p) === MC_FILT; });"
))

# ---- 4 · the rail counts, and the On The Wall pill ----------------------
EDITS.append((
    "      var held = r.id === 'all'\r\n"
    "        ? live.length\r\n"
    "        : live.filter(function(p){ return p.series === r.id; }).length;",

    "      var held = r.id === 'all'\r\n"
    "        ? live.length\r\n"
    "        : live.filter(function(p){ return mcSeriesOf(p) === r.id; }).length;"
))

EDITS.append((
    "    /* Drawn only once something is in it. An empty archive is not a\r\n"
    "       place, and a pill for it would be a question nobody asked. */\r\n"
    "    var put = mcArchivedCount();",

    "    /* ON THE WALL, on the same rule as the archive: drawn only once\r\n"
    "       something is in it. Nobody who has never posted needs a pill\r\n"
    "       telling them so. */\r\n"
    "    var up = live.filter(function(p){ return onWall(p); }).length;\r\n"
    "    if (up){\r\n"
    "      html += '<button class=\"mc-filter is-wall' +\r\n"
    "              (MC_FILT === 'wall' ? ' is-on' : '') + '\" type=\"button\"' +\r\n"
    "              ' data-filter=\"wall\">On The Wall \\u00b7 ' + up + '</button>';\r\n"
    "    } else if (MC_FILT === 'wall'){\r\n"
    "      /* The last one came down while we were looking at it. */\r\n"
    "      MC_FILT = 'all';\r\n"
    "    }\r\n"
    "\r\n"
    "    /* Drawn only once something is in it. An empty archive is not a\r\n"
    "       place, and a pill for it would be a question nobody asked. */\r\n"
    "    var put = mcArchivedCount();"
))

# ---- 5 · the mark on the tile -------------------------------------------
EDITS.append((
    "        '<img class=\"piece__img\" src=\"' + esc(p.art) + '\" alt=\"\" loading=\"lazy\">' +\r\n"
    "        '<span class=\"piece__pick\" data-pick=\"' + esc(p.id) + '\">\\u2713</span>' +",

    "        '<img class=\"piece__img\" src=\"' + esc(p.art) + '\" alt=\"\" loading=\"lazy\">' +\r\n"
    "        '<span class=\"piece__pick\" data-pick=\"' + esc(p.id) + '\">\\u2713</span>' +\r\n"
    "        /* A mark, not a control. Taking a piece down happens under the\r\n"
    "           featured piece where there is room to say what it means. */\r\n"
    "        (onWall(p) ? '<span class=\"piece__wall\" title=\"On the board\">On The Wall</span>' : '') +"
))

# ---- 6 · Take it down, under the featured piece -------------------------
EDITS.append((
    "    if (typeof window.openPostToCommunity === 'function'){\r\n"
    "      acts += '<button class=\"mc-act\" data-fa=\"post\" type=\"button\">Post to Community</button>';\r\n"
    "    }",

    "    /* A piece already on the board offers the way back off it instead\r\n"
    "       of the way on. Both at once would be two buttons contradicting\r\n"
    "       each other. */\r\n"
    "    if (onWall(p)){\r\n"
    "      acts += '<button class=\"mc-act\" data-fa=\"unpost\" type=\"button\">Take it off the board</button>';\r\n"
    "    } else if (typeof window.openPostToCommunity === 'function'){\r\n"
    "      acts += '<button class=\"mc-act\" data-fa=\"post\" type=\"button\">Post to Community</button>';\r\n"
    "    }"
))

EDITS.append((
    "    else if (what === 'post'){\r\n"
    "      if (typeof window.openPostToCommunity === 'function') window.openPostToCommunity(p);\r\n"
    "    }",

    "    else if (what === 'post'){\r\n"
    "      if (typeof window.openPostToCommunity === 'function') window.openPostToCommunity(p);\r\n"
    "    }\r\n"
    "    else if (what === 'unpost'){\r\n"
    "      var postId = p.serverId && ON_WALL[p.serverId];\r\n"
    "      if (!postId) return;\r\n"
    "      b.disabled = true;\r\n"
    "      b.textContent = 'Taking it down\\u2026';\r\n"
    "      /* Optimism would be wrong here. This deletes the public copy, so\r\n"
    "         the mark must not come off until the studio says it has. */\r\n"
    "      fetch('/api/v1/community/posts/' + encodeURIComponent(postId), {\r\n"
    "        method:'DELETE', credentials:'include'\r\n"
    "      })\r\n"
    "        .then(function(r){ return r.json(); })\r\n"
    "        .then(function(d){\r\n"
    "          if (!d || !d.ok){ b.disabled = false; b.textContent = 'Take it off the board'; return; }\r\n"
    "          delete ON_WALL[p.serverId];\r\n"
    "          renderCollection();\r\n"
    "        })\r\n"
    "        .catch(function(){\r\n"
    "          b.disabled = false; b.textContent = 'Take it off the board';\r\n"
    "        });\r\n"
    "    }"
))

# ---- 7 · the mark's styling ---------------------------------------------
EDITS.append((
    "\r\n.mc-filter{",

    "\r\n/* THE MARK. Oxblood on vellum, bottom left, out of the way of the tick\r\n"
    "   at top right and the Archive control below it. A label, not a\r\n"
    "   button - nothing here is pressable. */\r\n"
    ".piece__wall{\r\n"
    "  position:absolute; left:8px; bottom:8px; z-index:2;\r\n"
    "  font-family:var(--serif); font-style:italic; font-size:.95rem;\r\n"
    "  line-height:1; padding:.3rem .6rem; border-radius:999px;\r\n"
    "  background:var(--oxblood); color:var(--vellum-100);\r\n"
    "  box-shadow:0 .2rem .6rem rgba(25,16,10,.28);\r\n"
    "  pointer-events:none; white-space:nowrap;\r\n"
    "}\r\n"
    ".mc-filter.is-wall{ color:var(--oxblood); border-color:var(--oxblood) }\r\n"
    ".mc-filter.is-wall.is-on{ background:var(--oxblood); color:var(--vellum-100) }\r\n"
    ".mc-filter{"
))

# ---- 8 · ask the route, once the collection has loaded ------------------
EDITS.append((
    "        renderCollection();\r\n"
    "        return rows.length;",

    "        renderCollection();\r\n"
    "        /* After the pieces, not before - the badges need tiles to sit\r\n"
    "           on, and this repaints when it answers. */\r\n"
    "        loadOnWall();\r\n"
    "        return rows.length;"
))


def process(page, apply_it):
    src = os.path.join(REPO, page)
    dst = os.path.join(OUT, page)

    if not os.path.isfile(src):
        print("  MISSING  %s" % src)
        return False

    with open(src, "r", encoding="utf-8", newline="") as fh:
        text = fh.read()

    for i, (anchor, _) in enumerate(EDITS):
        n = text.count(anchor)
        if n != 1:
            print("  REFUSE   %s edit %d: anchor found %d times, expected 1"
                  % (page, i + 1, n))
            print("           first line: %s" % anchor.splitlines()[0][:66])
            return False

    out = text
    for anchor, replace in EDITS:
        out = out.replace(anchor, replace, 1)

    checks = [
        ("var MC_FILT = 'all';", 1),
        ("var MC_FILT = 'all'; //", 1),
        ("'Pets Halloween','Portraits'", 1),
        ("function mcSeriesOf(p){", 1),
        ("function loadOnWall(){", 1),
        ("function onWall(p){", 1),
        ("data-filter=\"wall\"", 1),
        ("data-fa=\"unpost\"", 1),
        (".piece__wall{", 1),
        ("loadOnWall();", 1),
        ("'Action','Groups'", 0),
        ("var MC_FILT = 'Portraits';\r\n", 0),
    ]
    for needle, want in checks:
        got = out.count(needle)
        if got != want:
            print("  REFUSE   %s verify: '%s' found %d, expected %d"
                  % (page, needle, got, want))
            return False

    if len(out) <= len(text):
        print("  REFUSE   %s : result did not grow" % page)
        return False

    if not apply_it:
        print("  OK       %s : %d edits, all checks passed" % (page, len(EDITS)))
        return True

    if not os.path.isdir(OUT):
        print("  REFUSE   %s does not exist" % OUT)
        return False

    with open(dst, "w", encoding="utf-8", newline="") as fh:
        fh.write(out)
    print("  WROTE    %s" % dst)
    return True


def main():
    apply_it = "--apply" in sys.argv
    print("patch-collection-wall  -  %s"
          % ("APPLY" if apply_it else "DRY RUN"))
    print("")

    ok = 0
    for page in PAGES:
        if process(page, apply_it):
            ok += 1

    print("")
    print("  %d of %d pages" % (ok, len(PAGES)))
    if ok != len(PAGES):
        print("  NOT ALL PAGES PASSED. Nothing further should be installed.")
        sys.exit(1)
    if not apply_it:
        print("  Re-run with --apply to write.")


if __name__ == "__main__":
    main()
