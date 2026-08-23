#!/usr/bin/env python3
"""
patch-board-sections.py  -  22 August 2026  -  CUI V32

THE BOARD DIVIDES BY SERIES, under a sticky jump menu in gallery's
pattern. Ruled by Rich, 22 August.

  - each Series that has pieces gets a heading and its own column block
  - a sticky bar of pills under the masthead jumps to each one
  - the current section's pill is marked as you scroll, the same way
    gallery marks its rooms

WHAT CHANGED STRUCTURALLY
  #wallCols was itself the column block - one multi-column flow holding
  every card. A heading dropped into that flows into a column and lands
  halfway down the third one.

  So #wallCols becomes a plain container and the columns move to the
  section blocks it holds. Everything that reaches into it by
  querySelector still works, because the cards are still descendants.

  The wall is now REPAINTED from POSTS rather than appended to. Loading a
  page used to append cards in arrival order, which cannot produce
  sections. paintWall() rebuilds from POSTS, which is already the record
  of everything drawn.

THIS FILTERS ONLY WHAT IS LOADED - KNOWN AND ACCEPTED
  The board pages 24 at a time. Until the route takes a series parameter,
  a section holds what has arrived, not what exists. Rich ruled on 22
  August that this is fine while the board is small. It is in
  SYNC-CENG-2026-08-22.md as CENG's.

READS   D:\\minramas\\public\\community.html
WRITES  %USERPROFILE%\\Downloads\\community.html
"""

import os
import sys

REPO = r"D:\minramas\public"
OUT = os.path.join(os.environ.get("USERPROFILE", os.path.expanduser("~")),
                   "Downloads")
PAGE = "community.html"

EDITS = []

# ---- 1 · CSS: the jump bar and the section headings ---------------------
# Lifted from gallery's .jump, which is the accepted pattern. Same sticky
# offset, same transparent bar with pointer-events off so only the pills
# take clicks, same 1.5rem italic serif.
EDITS.append((
    ".wall{ padding:clamp(26px,2.6vw,44px) 0 }",

    ".wall{ padding:clamp(26px,2.6vw,44px) 0 }\r\n"
    "\r\n"
    "/* THE JUMP BAR. Gallery's pattern, unchanged: the bar is air and only\r\n"
    "   the pills take clicks, so a transparent strip across the page does\r\n"
    "   not eat the scroll. Sticky under the masthead. */\r\n"
    ".bjump{\r\n"
    "  position:sticky; top:var(--mh-h); z-index:50;\r\n"
    "  background:transparent; pointer-events:none;\r\n"
    "}\r\n"
    ".bjump-in{\r\n"
    "  pointer-events:auto;\r\n"
    "  width:var(--stage-w); margin:0 auto;\r\n"
    "  display:flex; justify-content:center; gap:8px; overflow-x:auto;\r\n"
    "  padding:10px 0; scrollbar-width:none;\r\n"
    "}\r\n"
    ".bjump-in::-webkit-scrollbar{ display:none }\r\n"
    "/* 1.5rem. These are the only way to move around this page and should\r\n"
    "   look like it. A shadow so a pill over a photograph keeps an edge. */\r\n"
    ".bjump a{\r\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.5rem;\r\n"
    "  text-decoration:none; white-space:nowrap; line-height:1;\r\n"
    "  padding:.5rem 1.15rem; border-radius:999px;\r\n"
    "  box-shadow:0 .3rem .8rem rgba(25,16,10,.18);\r\n"
    "  background:var(--coffee-700); color:var(--vellum-200);\r\n"
    "  border:1px solid rgba(233,222,200,.14);\r\n"
    "  transition:background .16s ease, color .16s ease, border-color .16s ease;\r\n"
    "}\r\n"
    ".bjump a:hover{\r\n"
    "  background:#453429; color:var(--vellum-100);\r\n"
    "  border-color:rgba(233,222,200,.3);\r\n"
    "}\r\n"
    ".bjump a.on{\r\n"
    "  background:var(--gold); color:var(--espresso); border-color:var(--gold);\r\n"
    "}\r\n"
    "/* Hidden when there is nothing to jump between - one Series on the\r\n"
    "   board makes a menu of one, which is furniture. */\r\n"
    ".bjump[hidden]{ display:none }\r\n"
    "\r\n"
    "/* THE SEPARATOR. A rule and a name, not a banner. The board is the\r\n"
    "   pieces; the headings are there to be scanned past. */\r\n"
    ".wall-sec{\r\n"
    "  font-family:var(--serif); font-size:2rem; font-weight:400;\r\n"
    "  color:var(--ink); margin:0 0 var(--board-gap);\r\n"
    "  padding:0 0 .4rem; border-bottom:1px solid rgba(42,36,30,.16);\r\n"
    "  scroll-margin-top:calc(var(--mh-h) + 76px);\r\n"
    "}\r\n"
    ".wall-sec + .wall-cols{ margin-bottom:clamp(34px,3.4vw,62px) }"
))

# ---- 2 · #wallCols stops being the column block -------------------------
EDITS.append((
    '    <div class="wall-cols" id="wallCols"></div>',

    '    <!-- Not .wall-cols any more. It holds section blocks, each of\r\n'
    '         which is a .wall-cols of its own - a heading inside a\r\n'
    '         multi-column flow lands halfway down the third column. -->\r\n'
    '    <div id="wallCols"></div>'
))

EDITS.append((
    '</nav>\r\n'
    '\r\n'
    '<main class="stage">',

    '</nav>\r\n'
    '\r\n'
    '<!-- THE JUMP BAR. Painted by paintWall() from whatever Series are on\r\n'
    '     the board; hidden when there are fewer than two. Below the view\r\n'
    '     tabs, because it applies to the board and not to Ideas. -->\r\n'
    '<nav class="bjump" id="bjump" hidden aria-label="Jump to a Series">\r\n'
    '  <div class="bjump-in" id="bjumpIn"></div>\r\n'
    '</nav>\r\n'
    '\r\n'
    '<main class="stage">'
))

# ---- 3 · paintWall ------------------------------------------------------
EDITS.append((
    "  function drawEmpty(){",

    "  /* \u2500\u2500 THE SECTIONS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
    "     Order is fixed rather than alphabetical or by count, so the board\n"
    "     does not rearrange itself as pieces arrive. Anything with a series\n"
    "     not on this list is appended after, under its raw name - better a\n"
    "     section nobody named than a piece that vanishes. */\n"
    "  var SEC_ORDER = ['portraits', 'groups', 'pets', 'halloween',\n"
    "                   'pets_halloween', 'action', 'actionmini', 'wallpapers'];\n"
    "  var SEC_LABEL = {\n"
    "    portraits:'Portraits', groups:'Groups', pets:'Pets',\n"
    "    halloween:'Halloween', pets_halloween:'Pets Halloween',\n"
    "    action:'Action', actionmini:'Action', wallpapers:'Mobile Wallpapers'\n"
    "  };\n"
    "\n"
    "  function secLabel(s){\n"
    "    if (SEC_LABEL[s]) return SEC_LABEL[s];\n"
    "    /* Unknown series, named from itself: pets_halloween -> Pets\n"
    "       Halloween. Not pretty, and it is the case that should not\n"
    "       happen. */\n"
    "    return String(s || 'Other').replace(/[_-]+/g, ' ')\n"
    "      .replace(/\\b\\w/g, function(c){ return c.toUpperCase(); });\n"
    "  }\n"
    "\n"
    "  function secId(s){ return 'sec-' + String(s || 'other'); }\n"
    "\n"
    "  /* REBUILT FROM POSTS, NOT APPENDED TO. Cards used to be appended in\n"
    "     the order they arrived, which cannot produce sections - a Pets\n"
    "     piece on page two would land under the Groups heading. POSTS is\n"
    "     already the record of everything drawn, so the wall is drawn from\n"
    "     it each time. */\n"
    "  function paintWall(){\n"
    "    wallCols.innerHTML = '';\n"
    "    wallCols.style.columns = '';\n"
    "\n"
    "    if (!POSTS.length){ paintJump([]); return; }\n"
    "\n"
    "    var bucket = {};\n"
    "    var order  = [];\n"
    "    POSTS.forEach(function(p){\n"
    "      var s = p.series || 'other';\n"
    "      if (!bucket[s]){ bucket[s] = []; order.push(s); }\n"
    "      bucket[s].push(p);\n"
    "    });\n"
    "\n"
    "    /* Known series in the fixed order, then anything else in the order\n"
    "       it turned up. */\n"
    "    var series = SEC_ORDER.filter(function(s){ return bucket[s]; })\n"
    "      .concat(order.filter(function(s){ return SEC_ORDER.indexOf(s) < 0; }));\n"
    "\n"
    "    series.forEach(function(s){\n"
    "      var h = document.createElement('h2');\n"
    "      h.className = 'wall-sec';\n"
    "      h.id = secId(s);\n"
    "      h.textContent = secLabel(s);\n"
    "      wallCols.appendChild(h);\n"
    "\n"
    "      var block = document.createElement('div');\n"
    "      block.className = 'wall-cols';\n"
    "      bucket[s].forEach(function(p){ block.appendChild(card(p)); });\n"
    "      wallCols.appendChild(block);\n"
    "    });\n"
    "\n"
    "    paintJump(series);\n"
    "  }\n"
    "\n"
    "  /* \u2500\u2500 THE JUMP BAR \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n"
    "     Anchors, not filters. Everything on the board stays on the board;\n"
    "     the pills move you to a part of it. Hidden below two Series -\n"
    "     a menu of one is furniture. */\n"
    "  var bjump   = $('bjump');\n"
    "  var bjumpIn = $('bjumpIn');\n"
    "\n"
    "  function paintJump(series){\n"
    "    if (!bjump || !bjumpIn) return;\n"
    "    if (!series || series.length < 2){ bjump.hidden = true; bjumpIn.innerHTML = ''; return; }\n"
    "    bjump.hidden = false;\n"
    "    bjumpIn.innerHTML = series.map(function(s){\n"
    "      return '<a href=\"#' + secId(s) + '\" data-sec=\"' + secId(s) + '\">' +\n"
    "             esc(secLabel(s)) + '</a>';\n"
    "    }).join('');\n"
    "    markJump();\n"
    "  }\n"
    "\n"
    "  /* Which section is current: the last heading whose top has passed\n"
    "     the sticky furniture. Same test gallery uses on its rooms. */\n"
    "  function markJump(){\n"
    "    if (!bjumpIn || bjump.hidden) return;\n"
    "    var pills = bjumpIn.querySelectorAll('a');\n"
    "    if (!pills.length) return;\n"
    "    var line = 180;\n"
    "    var cur  = pills[0].getAttribute('data-sec');\n"
    "    for (var i = 0; i < pills.length; i++){\n"
    "      var id = pills[i].getAttribute('data-sec');\n"
    "      var h  = document.getElementById(id);\n"
    "      if (h && h.getBoundingClientRect().top <= line) cur = id;\n"
    "    }\n"
    "    for (var j = 0; j < pills.length; j++){\n"
    "      pills[j].classList.toggle('on',\n"
    "        pills[j].getAttribute('data-sec') === cur);\n"
    "    }\n"
    "  }\n"
    "\n"
    "  window.addEventListener('scroll', markJump, { passive:true });\n"
    "\n"
    "  function drawEmpty(){"
))

# ---- 4 · drawEmpty hides the bar ----------------------------------------
EDITS.append((
    "    /* Out of the columns, or it is one narrow ribbon down the left. */\r\n"
    "    wallCols.style.columns = 'auto';\r\n"
    "    wallCols.appendChild(d);",

    "    wallCols.appendChild(d);\r\n"
    "    /* Nothing to jump between. */\r\n"
    "    if (bjump) bjump.hidden = true;"
))

# ---- 5 · loading paints instead of appending ----------------------------
EDITS.append((
    "        var rows = d.posts || [];\r\n"
    "        rows.forEach(function(p){\r\n"
    "          POSTS.push(p);\r\n"
    "          wallCols.appendChild(card(p));\r\n"
    "        });",

    "        var rows = d.posts || [];\r\n"
    "        rows.forEach(function(p){ POSTS.push(p); });\r\n"
    "        /* Repainted, not appended - a Pets piece arriving on page two\r\n"
    "           belongs under the Pets heading, not at the end. */\r\n"
    "        if (POSTS.length) paintWall();"
))

# ---- 6 · taking a piece down repaints -----------------------------------
# Removing the card alone can leave a heading over an empty block.
EDITS.append((
    "        POSTS = POSTS.filter(function(p){ return p.id !== id; });\r\n"
    "        var el = wallCols.querySelector('.pc[data-post-id=\"' + id + '\"]');\r\n"
    "        if (el) el.remove();\r\n"
    "        if (!POSTS.length) drawEmpty();",

    "        POSTS = POSTS.filter(function(p){ return p.id !== id; });\r\n"
    "        /* Repainted rather than plucked out. Taking down the only Pets\r\n"
    "           piece must take the Pets heading with it. */\r\n"
    "        if (POSTS.length) paintWall(); else drawEmpty();"
))


def main():
    apply_it = "--apply" in sys.argv
    print("patch-board-sections  -  %s" % ("APPLY" if apply_it else "DRY RUN"))
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
        ("function paintWall()", 1),
        ("function paintJump(series)", 1),
        ("function markJump()", 1),
        ('id="bjump"', 1),
        ('id="bjumpIn"', 1),
        (".bjump-in{", 1),
        (".wall-sec{", 1),
        ("paintWall()", 4),
        ("wallCols.appendChild(card(p))", 0),
        ('<div class="wall-cols" id="wallCols">', 0),
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
