#!/usr/bin/env python3
"""
patch-studio-crumb.py - give the Studio a way back.

  python scripts\\patch-studio-crumb.py public\\wallpaper-studio-V002.html
  python scripts\\patch-studio-crumb.py public\\wallpaper-studio-V002.html --apply

Dry run by default. CRLF file - the anchors match that.

THE PROBLEM. The Studio is a leaf. You arrive from Mobile Wallpapers and the
only route back is the Series dropdown in the masthead, which means the way
out is hidden behind a control that looks like a way sideways. Portraits
solved this months ago and the Studio never got it.

THE PATTERN, LIFTED FROM PORTRAITS. Two coffee pills above the content. The
first is the way back and is a control; the second names where you stand and
is not. Serif at 1.3125rem, 40px tall, 4px radius - squarer than the 8px on
panels, deliberately. Same sizes, same colours, same hover.

ONE DIFFERENCE, ON PURPOSE. Portraits uses a <button> because its crumb
changes view state inside one page. The Studio's crumb leaves the page, so
it is an <a href="/wallpapers">. A link that navigates should be a link -
middle-click and open-in-new-tab work, and the browser shows the target on
hover.

The Studio has no --ease-nav token, so the transition names its own easing
rather than inheriting one that is not there.

THIS PATTERN IS PORTABLE. Gallery and Community need the same treatment and
have the same shape - a leaf with a masthead and a content block. The CSS
below is self-contained and copies cleanly.
"""

import sys
import os

CSS_ANCHOR = (
    ".stage{\r\n"
    "  display:grid; grid-template-columns:minmax(430px,31%) 1fr;\r\n"
)

CSS_NEW = (
    "/* ======================================================================\r\n"
    "   THE BREADCRUMB\r\n"
    "   Lifted from the workshop. It sits above the stage, always in the same\r\n"
    "   place, and names where you are. The Studio was a leaf with no way out\r\n"
    "   but the Series dropdown, which is a control that looks like a way\r\n"
    "   sideways rather than a way back.\r\n"
    "\r\n"
    "   Two pills. The first is the route out and is a control. The second\r\n"
    "   names where you stand and is not - quieter, no hover, no cursor.\r\n"
    "   ====================================================================== */\r\n"
    ".crumb{\r\n"
    "  display:flex; align-items:center; gap:10px;\r\n"
    "  padding:24px clamp(16px,2.4vw,40px) 0;\r\n"
    "  min-height:48px;\r\n"
    "}\r\n"
    ".crumb-back,\r\n"
    ".crumb-here{\r\n"
    "  display:inline-flex; align-items:center; gap:.5em;\r\n"
    "  height:40px; padding:0 18px;\r\n"
    "  border-radius:4px;\r\n"
    "  font-family:var(--serif); font-size:1.3125rem; line-height:1;\r\n"
    "  white-space:nowrap; text-decoration:none;\r\n"
    "}\r\n"
    ".crumb-back{\r\n"
    "  color:var(--vellum-200);\r\n"
    "  background:linear-gradient(180deg,#2f2420 0%, #241b17 100%);\r\n"
    "  border:1px solid rgba(196,169,110,.26);\r\n"
    "  box-shadow:0 .35rem .9rem rgba(25,16,10,.22), inset 0 1px 0 rgba(255,255,255,.06);\r\n"
    "  cursor:pointer;\r\n"
    "  transition:background .5s cubic-bezier(.22,.61,.36,1),\r\n"
    "             border-color .5s cubic-bezier(.22,.61,.36,1),\r\n"
    "             color .5s cubic-bezier(.22,.61,.36,1),\r\n"
    "             transform .5s cubic-bezier(.22,.61,.36,1);\r\n"
    "}\r\n"
    ".crumb-back:hover{\r\n"
    "  background:linear-gradient(180deg,#3a2c26 0%, #2c211c 100%);\r\n"
    "  border-color:var(--gold); color:#fff;\r\n"
    "}\r\n"
    ".crumb-back:active{ transform:translateY(1px); transition-duration:.08s }\r\n"
    ".crumb-back:focus-visible{ outline:2px solid var(--gold); outline-offset:2px }\r\n"
    ".crumb-back svg{ width:.6em; height:.6em; flex:0 0 auto; opacity:.8 }\r\n"
    ".crumb-back path{\r\n"
    "  fill:none; stroke:currentColor; stroke-width:1.7;\r\n"
    "  stroke-linecap:round; stroke-linejoin:round;\r\n"
    "}\r\n"
    "/* where you stand - same pill, quieter, not a control */\r\n"
    ".crumb-here{\r\n"
    "  color:var(--series);\r\n"
    "  background:linear-gradient(180deg, rgba(47,36,32,.55) 0%, rgba(36,27,23,.55) 100%);\r\n"
    "  border:1px solid rgba(196,169,110,.16);\r\n"
    "}\r\n"
    "/* The stage already carries the top padding the crumb now owns. Taking\r\n"
    "   it back here keeps the panel where it was rather than pushing the\r\n"
    "   whole page down by the height of the bar. */\r\n"
    ".crumb + .stage{ padding-top:16px }\r\n"
    "@media (max-width:900px){\r\n"
    "  .crumb{ padding-top:16px }\r\n"
    "  .crumb-back,.crumb-here{ font-size:1.15rem; height:36px; padding:0 14px }\r\n"
    "}\r\n"
    "\r\n"
) + CSS_ANCHOR

MARKUP_ANCHOR = '<div class="stage">\r\n'

MARKUP_NEW = (
    '<nav class="crumb" aria-label="Breadcrumb">\r\n'
    '  <a class="crumb-back" href="/wallpapers">\r\n'
    '    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>'
    '<span>Mobile Wallpapers</span>\r\n'
    '  </a>\r\n'
    '  <span class="crumb-here" aria-current="page">The Studio</span>\r\n'
    '</nav>\r\n'
    '\r\n'
) + MARKUP_ANCHOR

MARKER = "THE BREADCRUMB"


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

    print("patch-studio-crumb")
    print("  target   " + path)
    print("  mode     " + ("APPLY" if apply_it else "dry run - nothing will be written"))

    if MARKER in original:
        print("  SKIP     crumb already present")
        return 0

    text = original
    failed = 0

    for name, anchor, new in (
        ("crumb styles", CSS_ANCHOR, CSS_NEW),
        ("crumb markup", MARKUP_ANCHOR, MARKUP_NEW),
    ):
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
    assert text.count('<nav class="crumb"') == 1, "crumb markup missing or duplicated"
    assert text.count('.crumb-back{') == 1, "crumb styles missing or duplicated"
    assert text.count('<div class="stage">') == 1, "stage was duplicated"
    assert text.index('.crumb-back{') < text.index('</style>'), "styles landed outside the sheet"
    assert text.index('<nav class="crumb"') > text.index('</style>'), "markup landed inside the sheet"
    assert text.index('<nav class="crumb"') < text.index('<div class="stage">'), \
        "crumb is not above the stage"
    assert text.index('</header>') < text.index('<nav class="crumb"'), \
        "crumb landed inside the masthead"
    assert text.count('href="/wallpapers"') == original.count('href="/wallpapers"') + 1, \
        "wallpapers links wrong"
    assert "\r\n" in text and "\n\n" not in text.replace("\r\n", ""), "line endings mangled"
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
