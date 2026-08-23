#!/usr/bin/env python3
"""
patch-board-cards.py  -  22 August 2026  -  CUI V32

FOUR CHANGES TO THE BOARD, ALL RULED BY RICH 22 AUGUST.

  1  Cards to 400px. columns:4 260px meant a 260px minimum and four of
     them where the page allowed - on a wide screen the pieces were
     postage stamps. 400px is the column now, and the count is whatever
     fits.

  2  The heart works on the card. It was live only inside the lightbox,
     so a customer had to open a piece to say anything about it. The
     count on the card was a readout of something they could not press.

  3  The title reads the finish, not the Series. The page loaded only
     /effect-registry.js, which is Portraits, so a Groups or Pets or
     Halloween effect had no label and fell back to the Series name -
     one card read "Porcelain" and the next read "Groups". All five
     registries load now.

  4  Single click does nothing. Double click opens the piece.

READS   D:\\minramas\\public\\community.html
WRITES  %USERPROFILE%\\Downloads\\community.html

  Dry run by default. Nothing is written without --apply.
  Refuses to write unless every anchor is found exactly once.
"""

import os
import sys

REPO = r"D:\minramas\public"
OUT = os.path.join(os.environ.get("USERPROFILE", os.path.expanduser("~")),
                   "Downloads")
PAGE = "community.html"

EDITS = []

# ---- 1 · the registries -------------------------------------------------
# Each registry file points window.EFFECT_REGISTRY at itself, so the last
# one loaded holds that name. effect-registry.js is the only one with no
# named global of its own, so it is stashed under one before the others
# arrive. The harvest below then walks every *_REGISTRY on window and does
# not need to know their names.
EDITS.append((
    '<script src="/effect-registry.js"></script>',

    '<script src="/effect-registry.js"></script>\r\n'
    '<!-- Portraits has no named global of its own and every registry below\r\n'
    '     claims EFFECT_REGISTRY, so it is given one before they load. -->\r\n'
    '<script>window.PORTRAITS_REGISTRY = window.EFFECT_REGISTRY;</script>\r\n'
    '<script src="/groups-registry.js"></script>\r\n'
    '<script src="/pets-registry.js"></script>\r\n'
    '<script src="/halloween-registry.js"></script>\r\n'
    '<script src="/pets-halloween-registry.js"></script>'
))

# ---- 2 · harvest labels from all of them --------------------------------
EDITS.append((
    "  var LABEL = {};\r\n"
    "  (function(){\r\n"
    "    var Reg = window.EFFECT_REGISTRY;\r\n"
    "    if (!Reg || !Reg.effects) return;\r\n"
    "    Reg.effects.forEach(function(e){ if (e && e.id) LABEL[e.id] = e.label; });\r\n"
    "  })();",

    "  var LABEL = {};\r\n"
    "  (function(){\r\n"
    "    /* EVERY registry, not one. The board carries pieces from every\r\n"
    "       Series, so a label map built from one room leaves the rest\r\n"
    "       falling back to the Series name. Walked by suffix rather than\r\n"
    "       by a list, so a sixth registry needs no edit here. */\r\n"
    "    Object.keys(window).forEach(function(k){\r\n"
    "      if (k.slice(-9) !== '_REGISTRY') return;\r\n"
    "      var Reg = window[k];\r\n"
    "      if (!Reg || !Reg.effects || !Reg.effects.forEach) return;\r\n"
    "      Reg.effects.forEach(function(e){\r\n"
    "        if (e && e.id && e.label && !LABEL[e.id]) LABEL[e.id] = e.label;\r\n"
    "      });\r\n"
    "    });\r\n"
    "  })();"
))

# ---- 3 · the column ------------------------------------------------------
EDITS.append((
    "  columns:4 260px;\r\n"
    "  column-gap:var(--board-gap);",

    "  /* 400px columns, count unspecified - the board takes as many as the\r\n"
    "     page allows rather than forcing four. Ruled 22 August. */\r\n"
    "  columns:400px;\r\n"
    "  column-gap:var(--board-gap);"
))

EDITS.append((
    "@media (max-width:900px){\r\n"
    "  .wall-cols{ columns:3 220px }\r\n"
    "}",

    "@media (max-width:900px){\r\n"
    "  .wall-cols{ columns:300px }\r\n"
    "}"
))

EDITS.append((
    "  .wall-cols{ columns:2 150px }",
    "  .wall-cols{ columns:1 }"
))

# ---- 4 · the card heart, pressable --------------------------------------
# .pc-counts holds a heart and a comment count, both inert. The heart half
# becomes a button. The comment half stays a readout - there is nothing to
# press there.
EDITS.append((
    ".pc-counts span{ display:inline-flex; align-items:center; gap:.25rem }",

    ".pc-counts span{ display:inline-flex; align-items:center; gap:.25rem }\r\n"
    "/* THE HEART IS PRESSABLE ON THE CARD. It was a readout of something a\r\n"
    "   customer had to open the piece to do. Sized as a control rather than\r\n"
    "   a caption - a target under 32px is a miss on a touch screen. */\r\n"
    ".pc-heart{\r\n"
    "  display:inline-flex; align-items:center; gap:.3rem;\r\n"
    "  min-height:32px; padding:.25rem .55rem; margin:-.25rem -.25rem -.25rem 0;\r\n"
    "  background:none; border:1px solid transparent; border-radius:999px;\r\n"
    "  font-family:var(--sans); font-size:.875rem; color:var(--ink-soft);\r\n"
    "  cursor:pointer;\r\n"
    "  transition:color .16s ease, border-color .16s ease;\r\n"
    "}\r\n"
    ".pc-heart:hover{ color:var(--oxblood); border-color:var(--oxblood) }\r\n"
    ".pc-heart:focus-visible{ outline:2px solid var(--gold); outline-offset:2px }\r\n"
    ".pc-heart.is-hearted{ color:var(--oxblood) }\r\n"
    ".pc-heart.is-hearted svg{ fill:var(--oxblood); stroke:var(--oxblood) }"
))

EDITS.append((
    "          '<span class=\"pc-counts\">' +\r\n"
    "            '<span class=\"' + (HEARTED[p.id] ? 'is-hearted' : '') + '\">' +\r\n"
    "              heartsSvg() + (p.heart_count || 0) + '</span>' +\r\n"
    "            '<span>' + cmtsSvg() + (p.comment_count || 0) + '</span>' +\r\n"
    "          '</span>' +",

    "          '<span class=\"pc-counts\">' +\r\n"
    "            '<button type=\"button\" class=\"pc-heart' +\r\n"
    "              (HEARTED[p.id] ? ' is-hearted' : '') + '\">' +\r\n"
    "              heartsSvg() + (p.heart_count || 0) + '</button>' +\r\n"
    "            '<span>' + cmtsSvg() + (p.comment_count || 0) + '</span>' +\r\n"
    "          '</span>' +"
))

# ---- 5 · click behaviour -------------------------------------------------
# The heart is checked FIRST and returns, so pressing it never opens the
# piece underneath. Keyboard keeps Enter and space on the card, because a
# double click has no keyboard equivalent and taking that away would leave
# the board unreachable without a mouse.
EDITS.append((
    "  wallCols.addEventListener('click', function(e){\r\n"
    "    var c = e.target.closest('.pc'); if (!c) return;\r\n"
    "    openPost(c.dataset.postId);\r\n"
    "  });",

    "  /* THE HEART, ON THE CARD. Checked before anything else and returns,\r\n"
    "     so a press here never falls through to the piece beneath it. */\r\n"
    "  wallCols.addEventListener('click', function(e){\r\n"
    "    var h = e.target.closest('.pc-heart'); if (!h) return;\r\n"
    "    var c = h.closest('.pc'); if (!c) return;\r\n"
    "    e.stopPropagation();\r\n"
    "    heartPost(c.dataset.postId);\r\n"
    "  });\r\n"
    "\r\n"
    "  /* SINGLE CLICK DOES NOTHING. Ruled 22 August: the piece opens on a\r\n"
    "     double click. A wall where every stray click throws a lightbox in\r\n"
    "     front of you is a wall you cannot browse. */\r\n"
    "  wallCols.addEventListener('dblclick', function(e){\r\n"
    "    if (e.target.closest('.pc-heart')) return;\r\n"
    "    var c = e.target.closest('.pc'); if (!c) return;\r\n"
    "    openPost(c.dataset.postId);\r\n"
    "  });"
))

# ---- 6 · one heart function, both surfaces ------------------------------
# The lightbox handler held the whole mechanism inline and read OPEN_ID,
# so nothing else could call it. Lifted out and given an id. The lightbox
# handler now passes OPEN_ID to it; the card passes its own.
EDITS.append((
    "  $('postHeart').addEventListener('click', function(){\r\n"
    "    if (!OPEN_ID) return;\r\n"
    "    if (!SIGNED_IN){ location.href = '/portraits'; return; }\r\n"
    "    var id = OPEN_ID;\r\n"
    "    if (HEARTED[id]) return;\r\n"
    "\r\n"
    "    var p = findPost(id);\r\n"
    "    var heart = $('postHeart');\r\n",

    "  /* ONE MECHANISM, TWO SURFACES. This was inline in the lightbox\r\n"
    "     handler and read OPEN_ID directly, so the card could not reach it.\r\n"
    "     It takes an id now and the lightbox passes OPEN_ID in. */\r\n"
    "  function heartPost(id){\r\n"
    "    if (!id) return;\r\n"
    "    if (!SIGNED_IN){ location.href = '/portraits'; return; }\r\n"
    "    if (HEARTED[id]) return;\r\n"
    "\r\n"
    "    var p = findPost(id);\r\n"
    "    var heart = $('postHeart');\r\n"
))

# The tail of the old handler closes with `});` on the fetch and then `});`
# closing addEventListener. The second becomes the function's brace.
EDITS.append((
    "      .catch(function(){ repaintCard(id); });\r\n"
    "  });\r\n"
    "\r\n"
    "  /* \u2500\u2500 REPORTING",

    "      .catch(function(){ repaintCard(id); });\r\n"
    "  }\r\n"
    "\r\n"
    "  $('postHeart').addEventListener('click', function(){\r\n"
    "    heartPost(OPEN_ID);\r\n"
    "  });\r\n"
    "\r\n"
    "  /* \u2500\u2500 REPORTING"
))

# The lifted function still writes to the lightbox's own elements. Guarded,
# because they are only meaningful while that piece is open.
EDITS.append((
    "    HEARTED[id] = true;\r\n"
    "    heart.classList.add('is-on');\r\n"
    "    if (p){ p.heart_count = (p.heart_count || 0) + 1; }\r\n"
    "    $('postHearts').textContent = String(p ? p.heart_count : 1);",

    "    HEARTED[id] = true;\r\n"
    "    /* The lightbox controls are only meaningful while THIS piece is\r\n"
    "       the open one. Hearting from the card must not repaint a count\r\n"
    "       belonging to a different piece. */\r\n"
    "    if (OPEN_ID === id){\r\n"
    "      heart.classList.add('is-on');\r\n"
    "      $('postHearts').textContent = String(p ? (p.heart_count || 0) + 1 : 1);\r\n"
    "    }\r\n"
    "    if (p){ p.heart_count = (p.heart_count || 0) + 1; }\r\n"
    "    repaintCard(id);"
))


def main():
    apply_it = "--apply" in sys.argv
    print("patch-board-cards  -  %s" % ("APPLY" if apply_it else "DRY RUN"))
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
            print("           first line: %s" % anchor.splitlines()[0][:70])
            sys.exit(1)

    out = text
    for anchor, replace in EDITS:
        out = out.replace(anchor, replace, 1)

    checks = [
        ("columns:400px", 1),
        ('src="/groups-registry.js"', 1),
        ('src="/pets-halloween-registry.js"', 1),
        ("window.PORTRAITS_REGISTRY", 1),
        ("function heartPost(id){", 1),
        ("heartPost(OPEN_ID);", 1),
        ("heartPost(c.dataset.postId);", 1),
        ("pc-heart' +", 1),
        (".pc-heart{", 1),
        ("addEventListener('dblclick'", 1),
        ("columns:4 260px", 0),
    ]
    ok = True
    for needle, want in checks:
        got = out.count(needle)
        if got != want:
            print("  REFUSE   verify: '%s' found %d, expected %d"
                  % (needle, got, want))
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
