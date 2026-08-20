#!/usr/bin/env python3
"""
patch-portraits-panel-boot.py - open the panel the URL asked for.

  python scripts\\patch-portraits-panel-boot.py public\\portraits.html
  python scripts\\patch-portraits-panel-boot.py public\\portraits.html --apply

Dry run by default. CRLF file.

HALF TWO OF TWO. patch-middleware-panels.py rewrites /collection, /account
and /print to portraits.html. Without this, all three land on the workshop
floor - which is better than a 404 and still wrong, because somebody who
clicked My Collection is now looking at an upload slot.

WHAT IT DOES. On load, reads the path. If it is one of the three, calls the
opener the page already exports on window - __showCollection,
__showAccount, __showPrintShop. Those are the same three functions the
masthead click map calls, so there is one way to open each panel and this
is not a second one.

WHY IT SITS AT THE END OF THE BODY. The openers are defined across three
separate script blocks, the last of them past line 10,800. Anything earlier
runs before they exist. Appending at the tail means everything above has
already parsed and run.

WHY IT DOES NOT REWRITE THE URL. The address bar keeps saying /collection,
which is right - it is where the customer asked to be, it is what they will
bookmark, and it is what the masthead's own paintMastOpen() reads to mark
the current link. Leave it alone.

WHY setTimeout AND NOT DOMContentLoaded. By the time this runs the document
is already parsed, so that event has fired and will not fire again. A zero
timeout puts the call after the current task, which is the last of the
inline scripts finishing.
"""

import sys
import os

ANCHOR = "</script>\r\n\r\n</body>\r\n</html>\r\n"

NEW = (
    "</script>\r\n"
    "\r\n"
    "<script>\r\n"
    "/* ---- ARRIVE ON A PANEL --------------------------------------------\r\n"
    "   My Collection, Account and the Print Shop are slide-overs in this\r\n"
    "   file, and the masthead here intercepts its own links so they never\r\n"
    "   navigate. Every OTHER page links to them as ordinary URLs, and\r\n"
    "   middleware now rewrites those three paths to this file.\r\n"
    "\r\n"
    "   So: if we arrived on one, open it. Same three openers the masthead\r\n"
    "   uses - not a second way in.\r\n"
    "\r\n"
    "   The URL is left as it is. It is where the customer asked to be, it\r\n"
    "   is what they will bookmark, and paintMastOpen() reads it to mark\r\n"
    "   the current link in the masthead. */\r\n"
    "(function(){\r\n"
    "  var OPEN = {\r\n"
    "    '/collection': '__showCollection',\r\n"
    "    '/account':    '__showAccount',\r\n"
    "    '/print':      '__showPrintShop'\r\n"
    "  };\r\n"
    "  var path = location.pathname.replace(/\\/+$/, '') || '/';\r\n"
    "  var name = OPEN[path];\r\n"
    "  if (!name) return;\r\n"
    "  /* The openers live in script blocks further up that have already run\r\n"
    "     by now; a zero timeout lands after the last of them settles. */\r\n"
    "  setTimeout(function(){\r\n"
    "    var fn = window[name];\r\n"
    "    if (typeof fn === 'function') fn();\r\n"
    "  }, 0);\r\n"
    "})();\r\n"
    "</script>\r\n"
    "\r\n"
    "</body>\r\n"
    "</html>\r\n"
)

MARKER = "ARRIVE ON A PANEL"


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

    print("patch-portraits-panel-boot")
    print("  target   " + path)
    print("  mode     " + ("APPLY" if apply_it else "dry run - nothing will be written"))

    if MARKER in original:
        print("  SKIP     boot hook already present")
        return 0

    # the openers must exist, or this hook has nothing to call
    missing = [n for n in ("__showCollection", "__showAccount", "__showPrintShop")
               if ("window." + n) not in original]
    if missing:
        print("  FAIL     openers not exported: " + ", ".join(missing))
        return 1
    print("  OK       all three openers exported on window")

    n = original.count(ANCHOR)
    if n != 1:
        print("  FAIL     tail anchor matches " + str(n) + " times. Nothing written.")
        return 1

    text = original.replace(ANCHOR, NEW, 1)

    # pre-write assertions
    assert text.count(MARKER) == 1, "hook duplicated"
    assert text.count("</body>") == 1, "body close duplicated"
    assert text.count("</html>") == 1, "html close duplicated"
    assert text.rstrip().endswith("</html>"), "hook landed after the document"
    assert text.index(MARKER) > text.index("window.__showCollection"), \
        "hook runs before the openers are defined"
    assert text.count("<script>") == original.count("<script>") + 1, "script tags unbalanced"
    assert text.count("</script>") == original.count("</script>") + 1, "script tags unbalanced"
    assert "\r\n" in text, "line endings lost"

    print("  OK       boot hook appended at the tail")

    if not apply_it:
        print("  Would write " + str(len(text) - len(original)) + " more bytes. Re-run with --apply.")
        return 0

    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("  WROTE    " + path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
