#!/usr/bin/env python3
"""
patch-gallery-nav.py - one nav across the site, and filters that float.

  python scripts\\patch-gallery-nav.py public\\gallery.html
  python scripts\\patch-gallery-nav.py public\\gallery.html --apply

Dry run by default. CRLF file - the anchors match that.

WHY GALLERY WAS THE ODD ONE OUT. Studio and Community both run the Series
switcher and the four nav links. Gallery ran Portraits / Community / Ask,
which meant the same shop had two different ideas about where things live -
and no route at all to Groups, Wallpapers, My Collection or Account.

WHAT CHANGES

1. --series token. Gallery never had it; the switcher needs it.

2. The Series switcher, ported verbatim from the Studio - CSS, markup and
   the toggle. Verbatim on purpose: two hand-written copies of the same
   control is how they drift.

3. The nav row becomes Gallery / Community / My Collection / Account, the
   same four in the same order as everywhere else.

4. The filter bar floats. It was already sticky below the masthead - what
   made it read as PART of the masthead was the espresso fill and the
   hairline under it. Both go; the pills keep their own dark fill so they
   stay legible over the vellum as the page runs beneath them.

5. Filter text to 1.5rem, with the padding opened up to match. At .9375rem
   they read as captions rather than controls, which is the recurring note.

WHAT IS DELIBERATELY LEFT

The "Craft a portrait" button stays. Every other page puts credits and the
Concierge in that corner, so this is a real inconsistency - but Gallery is
the one page whose entire job is to send somebody to the workshop, and the
button is that route. Flagged rather than silently resolved.

No breadcrumb. Gallery is a top-level destination, not a room down a path,
so there is nothing to go back to that the nav does not already offer. The
Studio needed one because it was a leaf; this is not.
"""

import sys
import os

EDITS = []

# ---- 1 · the --series token ------------------------------------------------
EDITS.append((
    "series token",
    "  --espresso:#26201a; --coffee-700:#332620;\r\n",
    "  --espresso:#26201a; --coffee-700:#332620;\r\n"
    "  --series:#d7bd89;   /* the switcher's colour; this page never had it */\r\n",
))

# ---- 2 · the switcher's styles, verbatim from the Studio -------------------
EDITS.append((
    "switcher styles",
    ".mh-nav{ justify-self:center; display:flex; align-items:center; gap:32px }\r\n",
    "/* ---- the series switcher --------------------------------------------\r\n"
    "   Ported verbatim from the Studio. Not a fourth zone - it lives inside\r\n"
    "   the nav so the three-zone rule holds. It names the room you are\r\n"
    "   standing in and opens the door to the others. */\r\n"
    ".mh-series{ position:relative; display:flex; align-items:center; margin-right:34px }\r\n"
    ".mh-series-btn{\r\n"
    "  display:inline-flex; align-items:center; gap:.34em;\r\n"
    "  font-family:var(--serif); font-size:1.8em; font-weight:400; line-height:1;\r\n"
    "  color:var(--series); padding:10px 0; cursor:pointer; white-space:nowrap;\r\n"
    "  background:none; border:none;\r\n"
    "  transition:color .16s ease;\r\n"
    "}\r\n"
    ".mh-series-btn:hover{ color:#e6d2a8 }\r\n"
    ".mh-series-btn .caret{\r\n"
    "  width:.52em; height:.52em; flex:0 0 auto; margin-top:.14em; opacity:.72;\r\n"
    "  transform-origin:50% 45%;\r\n"
    "  transition:transform .22s cubic-bezier(.22,.7,.3,1), opacity .16s ease;\r\n"
    "}\r\n"
    ".mh-series-btn .caret path{\r\n"
    "  fill:none; stroke:currentColor; stroke-width:1.35;\r\n"
    "  stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke;\r\n"
    "}\r\n"
    ".mh-series-btn:hover .caret{ opacity:1 }\r\n"
    ".mh-series-btn[aria-expanded=\"true\"] .caret{ transform:rotate(180deg); opacity:1 }\r\n"
    "\r\n"
    ".mh-series-menu{\r\n"
    "  position:absolute; top:calc(100% + 12px); left:50%; transform:translateX(-50%);\r\n"
    "  min-width:16em;\r\n"
    "  background:linear-gradient(180deg,#2a1f1b 0%, #221915 100%);\r\n"
    "  border:1px solid var(--card-line);\r\n"
    "  border-radius:var(--r-card);\r\n"
    "  box-shadow:0 22px 48px -20px rgba(20,12,8,.7), inset 0 1px 0 rgba(255,255,255,.06);\r\n"
    "  padding:20px; display:flex; flex-direction:column; z-index:70;\r\n"
    "}\r\n"
    ".mh-series-menu a{\r\n"
    "  display:flex; align-items:center; justify-content:space-between; gap:1.2em;\r\n"
    "  font-family:var(--serif); font-size:1.45em; font-weight:400; line-height:1.1;\r\n"
    "  color:var(--vellum-200); text-decoration:none; white-space:nowrap;\r\n"
    "  padding:.52em .7em; border-radius:6px;\r\n"
    "  transition:background .14s ease, color .14s ease;\r\n"
    "}\r\n"
    ".mh-series-menu a:hover,.mh-series-menu a:focus-visible{\r\n"
    "  background:linear-gradient(180deg, rgba(215,189,137,.16), rgba(215,189,137,.09));\r\n"
    "  color:var(--series); outline:none;\r\n"
    "}\r\n"
    ".mh-series-menu a[aria-current=\"page\"]{ color:var(--series) }\r\n"
    ".mh-series-menu a[aria-current=\"page\"]::after{\r\n"
    "  content:\"\"; width:5px; height:5px; border-radius:50%; background:var(--series);\r\n"
    "}\r\n"
    ".mh-series-menu .sep{\r\n"
    "  height:1px; margin:6px 8px;\r\n"
    "  background:linear-gradient(90deg, transparent, rgba(215,189,137,.28), transparent);\r\n"
    "}\r\n"
    "\r\n"
    ".mh-nav{ justify-self:center; display:flex; align-items:center; gap:32px }\r\n",
))

# ---- 3 · the filter bar floats --------------------------------------------
EDITS.append((
    "filter bar",
    ".jump{\r\n"
    "  position:sticky; top:var(--mh-h); z-index:50;\r\n"
    "  background:var(--espresso);\r\n"
    "  border-bottom:1px solid var(--card-line);\r\n"
    "}\r\n",
    "/* THE FILTERS FLOAT. Still sticky under the masthead, but the espresso\r\n"
    "   fill and the hairline are gone - those were what made a separate bar\r\n"
    "   read as the bottom of the masthead. The pills keep their own dark\r\n"
    "   fill, so they stay legible while the vellum runs beneath them. */\r\n"
    ".jump{\r\n"
    "  position:sticky; top:var(--mh-h); z-index:50;\r\n"
    "  background:transparent;\r\n"
    "  border-bottom:none;\r\n"
    "  pointer-events:none;   /* the bar is air; only the pills take clicks */\r\n"
    "}\r\n"
    ".jump-in{ pointer-events:auto }\r\n",
))

# ---- 4 · filter text at 1.5rem --------------------------------------------
EDITS.append((
    "filter text",
    ".jump a, .jump button{\r\n"
    "  font-family:var(--serif); font-style:italic; font-size:.9375rem;\r\n"
    "  text-decoration:none; white-space:nowrap; line-height:1;\r\n"
    "  padding:.4rem .95rem; border-radius:999px;\r\n",
    "/* 1.5rem. At .9375 these read as captions; they are the only way to move\r\n"
    "   around this page and should look like it. Padding opened to match, and\r\n"
    "   a shadow so a pill sitting over a photograph still has an edge. */\r\n"
    ".jump a, .jump button{\r\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.5rem;\r\n"
    "  text-decoration:none; white-space:nowrap; line-height:1;\r\n"
    "  padding:.5rem 1.15rem; border-radius:999px;\r\n"
    "  box-shadow:0 .3rem .8rem rgba(25,16,10,.18);\r\n",
))

# ---- 5 · the nav markup ----------------------------------------------------
EDITS.append((
    "nav markup",
    "  <nav class=\"mh-nav\">\r\n"
    "    <a href=\"/portraits\">Portraits</a>\r\n"
    "    <a href=\"/community\">Community</a>\r\n"
    "    <a href=\"#\" data-concierge>Ask</a>\r\n"
    "  </nav>\r\n",
    "  <nav class=\"mh-nav\">\r\n"
    "    <div class=\"mh-series\">\r\n"
    "      <button class=\"mh-series-btn\" id=\"mhSeriesBtn\" type=\"button\"\r\n"
    "              aria-expanded=\"false\" aria-haspopup=\"true\">\r\n"
    "        <span>Crafted Portraits</span>\r\n"
    "        <svg class=\"caret\" viewBox=\"0 0 16 16\" aria-hidden=\"true\">"
    "<path d=\"M3.2 6.2 8 10.6l4.8-4.4\"/></svg>\r\n"
    "      </button>\r\n"
    "      <div class=\"mh-series-menu\" id=\"mhSeriesMenu\" role=\"menu\" hidden>\r\n"
    "        <a href=\"/portraits\" role=\"menuitem\">Portraits</a>\r\n"
    "        <a href=\"/groups\" role=\"menuitem\">Groups</a>\r\n"
    "        <div class=\"sep\"></div>\r\n"
    "        <a href=\"/wallpapers\" role=\"menuitem\">Mobile Wallpapers</a>\r\n"
    "        <a href=\"/wallpapers/studio\" role=\"menuitem\">The Studio</a>\r\n"
    "      </div>\r\n"
    "    </div>\r\n"
    "    <a href=\"/gallery\" aria-current=\"page\">Gallery</a>\r\n"
    "    <a href=\"/community\">Community</a>\r\n"
    "    <a href=\"/collection\">My Collection</a>\r\n"
    "    <a href=\"/account\">Account</a>\r\n"
    "  </nav>\r\n",
))

# ---- 6 · aria-current needs a rule, gallery only had .on -------------------
EDITS.append((
    "current marker",
    ".mh-nav a.on{ color:var(--gold) }\r\n",
    ".mh-nav a.on,.mh-nav a[aria-current=\"page\"]{ color:var(--gold) }\r\n",
))

# ---- 7 · the toggle --------------------------------------------------------
EDITS.append((
    "switcher script",
    "</script>\r\n</body>\r\n",
    "</script>\r\n"
    "<script>\r\n"
    "/* The Series switcher. Same three behaviours as every other page:\r\n"
    "   click toggles, a click anywhere else shuts it, Escape shuts it. */\r\n"
    "(function(){\r\n"
    "  var b = document.getElementById('mhSeriesBtn');\r\n"
    "  var m = document.getElementById('mhSeriesMenu');\r\n"
    "  if (!b || !m) return;\r\n"
    "  function shut(){ m.hidden = true; b.setAttribute('aria-expanded','false'); }\r\n"
    "  b.addEventListener('click', function(e){\r\n"
    "    e.stopPropagation();\r\n"
    "    var open = m.hidden;\r\n"
    "    m.hidden = !open;\r\n"
    "    b.setAttribute('aria-expanded', String(open));\r\n"
    "  });\r\n"
    "  document.addEventListener('click', function(e){\r\n"
    "    if (!m.hidden && !m.contains(e.target)) shut();\r\n"
    "  });\r\n"
    "  addEventListener('keydown', function(e){ if (e.key === 'Escape') shut(); });\r\n"
    "})();\r\n"
    "</script>\r\n"
    "</body>\r\n",
))

MARKER = "mhSeriesBtn"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    apply_it = "--apply" in sys.argv

    if not args:
        print(__doc__)
        return 1

    path = args[0]
    if not os.path.isfile(path):
        print("MISSING   " + path)
        return 1

    with open(path, "r", encoding="utf-8", newline="") as f:
        original = f.read()

    print("patch-gallery-nav")
    print("  target   " + path)
    print("  mode     " + ("APPLY" if apply_it else "dry run - nothing will be written"))

    if MARKER in original:
        print("  SKIP     switcher already present")
        return 0

    text = original
    failed = 0
    for name, anchor, new in EDITS:
        n = text.count(anchor)
        if n != 1:
            print("  FAIL     " + name + " - anchor matches " + str(n) + " times")
            failed += 1
            continue
        text = text.replace(anchor, new, 1)
        print("  OK       " + name)

    if failed:
        print("  REFUSED  " + str(failed) + " anchor problem(s). Nothing written.")
        return 1

    # pre-write assertions
    assert text.count('id="mhSeriesBtn"') == 1, "switcher button missing or duplicated"
    assert text.count('id="mhSeriesMenu"') == 1, "switcher menu missing or duplicated"
    assert text.count('.mh-series-btn{') == 1, "switcher styles missing or duplicated"
    assert text.count('--series:#d7bd89') == 1, "series token missing or duplicated"
    assert text.count('font-size:1.5rem') == original.count('font-size:1.5rem') + 1, \
        "filter size not applied"
    assert '.9375rem' not in text.split('.jump a, .jump button{')[1][:200], \
        "old filter size left behind"
    assert text.count('background:var(--espresso)') == original.count('background:var(--espresso)') - 1, \
        "filter bar fill not removed, or the masthead's was"
    assert text.count('href="/collection"') == 1, "my collection link missing"
    assert text.count('href="/account"') == 1, "account link missing"
    assert text.count('href="/groups"') == 1, "groups link missing"
    assert text.count('class="mh-cta"') == 1, "the craft button was disturbed"
    assert text.count('<nav class="mh-nav">') == 1, "nav duplicated"
    assert text.count('</script>') == original.count('</script>') + 1, "script blocks unbalanced"
    assert text.index('id="mhSeriesBtn"') < text.index('getElementById(\'mhSeriesBtn\')'), \
        "script runs before the markup exists"
    assert "\r\n" in text, "line endings lost"
    assert len(text) > len(original), "file did not grow"

    if not apply_it:
        print("  Would write " + str(len(text) - len(original)) + " more bytes. Re-run with --apply.")
        return 0

    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("  WROTE    " + path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
