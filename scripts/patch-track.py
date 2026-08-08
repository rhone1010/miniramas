#!/usr/bin/env python3
"""
THE TRACKING SCRIPT

/track.js, for the admin dashboard being built in a separate lane.

WHERE IT GOES
Last in the head, after the stylesheets and before the body. Early enough
to see the whole session including a bounce; not so early that it delays
first paint, since it is the last thing the head does.

DEFER
Added deliberately. Without it the browser stops parsing and fetches the
script before it draws anything, and a slow or missing tracker becomes a
white screen on the studio. With defer it downloads alongside the page and
runs when the DOM is ready — which is also when the elements it will want
to watch actually exist.

If the dashboard lane needs it to run before DOM ready, remove the defer and
know what it costs.

Usage:  python scripts\\patch-track.py public\\portraits.html
"""
import io
import sys

TAG = '<script src="/track.js" defer></script>'


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    if "track.js" in doc:
        raise SystemExit("Already present. Nothing written.")

    nl = "\r\n" if "\r\n" in doc[:2000] else "\n"
    close = "</head>"
    if doc.count(close) != 1:
        raise SystemExit("FAIL: expected one </head>, found %d" % doc.count(close))

    doc = doc.replace(close, TAG + nl + close, 1)

    if doc.count("track.js") != 1:
        raise SystemExit("FAIL: not written exactly once")
    if doc.index("track.js") > doc.index("</head>"):
        raise SystemExit("FAIL: it landed outside the head")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  <script src=\"/track.js\" defer> added last in the head")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-track.py <file.html>")
    main(sys.argv[1])
