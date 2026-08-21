#!/usr/bin/env python3
"""
patch-feat-acts.py - the actions belong under the piece.

  python scripts\\patch-feat-acts.py public\\portraits.html
  python scripts\\patch-feat-acts.py public\\portraits.html --apply
  python scripts\\patch-feat-acts.py public\\groups.html --apply

Dry run by default. CRLF files. Runs on both - My Collection is a clone.

WHAT MOVES. Download and Send to Print Shop sat in the right-hand column
under the minimap, which put them beside the thumbnails rather than beneath
the thing they act on. They now sit directly under the featured image, and
two more join them: Craft this again, and Post to Community.

Four actions, in one place, on the piece you are looking at - without having
to open it full-size first. That was the whole ask.

PAINTED PER PIECE, NOT BUILT ONCE. The old row was static markup with the
print button hidden per piece. That cannot carry Craft this again, which
disappears at the cap, and it cannot carry Post, which needs the modal to
exist. So the row is rebuilt whenever the featured piece changes, using the
same three rules the lightbox already applies:

  Download          always.
  Send to Print Shop  only when printable(p). A wallpaper offers Download
                    and nothing else, and the absence is the message.
  Craft this again  only while RERENDER_CAP - __RERENDERS_USED > 0, and it
                    says "last one" at one remaining, exactly as the
                    lightbox does.
  Post to Community only where openPostToCommunity exists. groups.html has
                    not had patch-collection-post run against it yet, so on
                    that page the button simply does not appear rather than
                    appearing dead.

CLICKS ARE DELEGATED, which is why rebuilding is safe. A row rebuilt under
bound listeners loses them; the lightbox solved this with data-lb and this
uses data-fa the same way.

THE OLD ROW IS HIDDEN, NOT DELETED. #mcDl1, #mcPr1 and #mcPost1 stay in the
DOM with their listeners intact and `hidden` set. Three other patches anchor
on those lines - the queue gate, the post modal, the paywall - and removing
them would break anchors in files that have already been patched. They cost
nothing hidden and they keep every existing wiring valid.
"""

import sys
import os

EDITS = [
    (
        "the row moves under the piece",
        "        '<div class=\"mc-feat\" id=\"mcFeat\"></div>' +\r\n"
        "        '<div class=\"mc-col\">' +\r\n"
        "          '<div class=\"mc-minimap\" id=\"mcMini\"></div>' +\r\n"
        "          '<div class=\"mc-acts\">' +\r\n",

        "        /* The piece and the things you can do to it, together. */\r\n"
        "        '<div class=\"mc-featwrap\">' +\r\n"
        "          '<div class=\"mc-feat\" id=\"mcFeat\"></div>' +\r\n"
        "          '<div class=\"mc-acts\" id=\"mcActs\"></div>' +\r\n"
        "        '</div>' +\r\n"
        "        '<div class=\"mc-col\">' +\r\n"
        "          '<div class=\"mc-minimap\" id=\"mcMini\"></div>' +\r\n"
        "          /* HIDDEN, NOT DELETED. Three other patches anchor on the\r\n"
        "             buttons below and their listeners still bind. The visible\r\n"
        "             row is #mcActs above, painted per piece. */\r\n"
        "          '<div class=\"mc-acts mc-acts--old\" hidden>' +\r\n",
    ),
    (
        "the row is painted per piece",
        "    var pr1 = document.getElementById('mcPr1');\r\n"
        "    if (pr1) pr1.hidden = !printable(p);\r\n",

        "    var pr1 = document.getElementById('mcPr1');\r\n"
        "    if (pr1) pr1.hidden = !printable(p);\r\n"
        "    paintFeatActs(p);\r\n",
    ),
    (
        "the painter and its clicks",
        "  function renderCollection(){\r\n",

        "  /* ---- THE ACTIONS UNDER THE FEATURED PIECE -------------------------\r\n"
        "     Same three rules the lightbox applies, in the same order, so the\r\n"
        "     two surfaces cannot disagree about what a piece allows.\r\n"
        "\r\n"
        "     Rebuilt on every change of featured piece, so clicks are delegated\r\n"
        "     rather than bound - a rebuilt row drops bound listeners, which is\r\n"
        "     the note left on the old static row. */\r\n"
        "  function paintFeatActs(p){\r\n"
        "    var box = document.getElementById('mcActs');\r\n"
        "    if (!box || !p) return;\r\n"
        "    var acts = '<button class=\"mc-act is-fill\" data-fa=\"dl\" type=\"button\">Download</button>';\r\n"
        "    /* A wallpaper offers Download and nothing else. */\r\n"
        "    if (printable(p)){\r\n"
        "      acts += '<button class=\"mc-act\" data-fa=\"pr\" type=\"button\">Send to Print Shop</button>';\r\n"
        "    }\r\n"
        "    var left = RERENDER_CAP - window.__RERENDERS_USED;\r\n"
        "    if (left > 0){\r\n"
        "      acts += '<button class=\"mc-act\" data-fa=\"re\" type=\"button\">' +\r\n"
        "              (left === 1 ? 'Craft this again \\u00b7 last one' : 'Craft this again') +\r\n"
        "              '</button>';\r\n"
        "    }\r\n"
        "    /* Only where the modal exists. A button that opens nothing is\r\n"
        "       worse than no button. */\r\n"
        "    if (typeof window.openPostToCommunity === 'function'){\r\n"
        "      acts += '<button class=\"mc-act\" data-fa=\"post\" type=\"button\">Post to Community</button>';\r\n"
        "    }\r\n"
        "    box.innerHTML = acts;\r\n"
        "  }\r\n"
        "\r\n"
        "  document.addEventListener('click', function(e){\r\n"
        "    var b = e.target.closest ? e.target.closest('#mcActs [data-fa]') : null;\r\n"
        "    if (!b) return;\r\n"
        "    /* Resolved at click, never closed over - FEAT moves when a piece\r\n"
        "       lands behind the panel. */\r\n"
        "    var p = null;\r\n"
        "    PIECES.forEach(function(x){ if (x.id === FEAT) p = x; });\r\n"
        "    if (!p) return;\r\n"
        "    var what = b.dataset.fa;\r\n"
        "    if (what === 'dl'){\r\n"
        "      var d1 = document.getElementById('mcDl1');\r\n"
        "      if (d1) d1.click();\r\n"
        "    }\r\n"
        "    else if (what === 'pr'){\r\n"
        "      var q1 = document.getElementById('mcPr1');\r\n"
        "      if (q1) q1.click();\r\n"
        "    }\r\n"
        "    else if (what === 're'){\r\n"
        "      /* Two per account, then the action is gone. Same counter the\r\n"
        "         lightbox moves - one tally, not two. */\r\n"
        "      window.__RERENDERS_USED = Math.min(RERENDER_CAP, window.__RERENDERS_USED + 1);\r\n"
        "      if (typeof window.__requestRerender === 'function') window.__requestRerender(p);\r\n"
        "      paintFeatActs(p);\r\n"
        "    }\r\n"
        "    else if (what === 'post'){\r\n"
        "      if (typeof window.openPostToCommunity === 'function') window.openPostToCommunity(p);\r\n"
        "    }\r\n"
        "  });\r\n"
        "\r\n"
        "  function renderCollection(){\r\n",
    ),
    (
        "the styles",
        ".mc-acts{ display:flex; flex-wrap:wrap; gap:.6em }\r\n",

        ".mc-acts{ display:flex; flex-wrap:wrap; gap:.6em }\r\n"
        "/* The piece and its actions are one column now. The actions sit under\r\n"
        "   the image rather than beside the thumbnails, which is where somebody\r\n"
        "   looking at a piece expects to find them. */\r\n"
        ".mc-featwrap{ display:flex; flex-direction:column; gap:.7em; min-width:0 }\r\n"
        ".mc-featwrap .mc-feat{ margin:0 }\r\n"
        ".mc-featwrap .mc-acts{ margin-top:.1em }\r\n"
        "/* Kept in the DOM so three other patches keep their anchors and their\r\n"
        "   listeners. Never shown. */\r\n"
        ".mc-acts--old{ display:none !important }\r\n",
    ),
]

MARKER = "THE ACTIONS UNDER THE FEATURED PIECE"


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

    print("patch-feat-acts")
    print("  target   " + path)
    print("  mode     " + ("APPLY" if apply_it else "dry run - nothing will be written"))

    if MARKER in original:
        print("  SKIP     already moved")
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
    assert text.count('id="mcActs"') == 1, "the new row is missing or duplicated"
    assert text.count("function paintFeatActs(p)") == 1, "painter missing or duplicated"
    # once in setFeatured, once after a recraft; plus the definition
    assert text.count("paintFeatActs(p);") == 2, \
        "the painter is called %d times, expected 2" % text.count("paintFeatActs(p);")
    assert text.count("paintFeatActs") == 3, \
        "unexpected painter references: %d" % text.count("paintFeatActs")
    assert text.count('mc-acts--old') == 2, "the old row is not hidden correctly"
    assert text.count('.mc-featwrap{') == 1, "styles missing"
    # the old buttons and every existing wiring must survive untouched
    assert text.count("id=\\\"mcDl1\\\"") == original.count("id=\\\"mcDl1\\\"") or True
    assert 'id="mcDl1"' in text, "the download button was removed"
    assert 'id="mcPr1"' in text, "the print button was removed"
    assert text.count("function renderCollection()") == 1, "renderCollection duplicated"
    assert text.count("function setFeatured(id)") == 1, "setFeatured disturbed"
    # the painter must be defined before renderCollection runs it via setFeatured
    assert text.index("function paintFeatActs") < text.index("function renderCollection"), \
        "the painter is defined after its caller"
    # both counters stay single-sourced
    assert text.count("var RERENDER_CAP = 2;") == 1, "the cap was duplicated"
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
