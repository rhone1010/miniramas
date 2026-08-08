#!/usr/bin/env python3
"""
TWO I BROKE

**1 · The floor is empty, on every width.**

The last patch removed `<span class="silo-card__count">` from the markup and
left the two lines that fill it:

    a.querySelector('.silo-card__count').textContent = '';
    a.querySelector('.silo-card__count').textContent = live + ' effects';

querySelector returns null, `.textContent` on null throws, `siloCard` never
returns, and `renderSilos` dies on the first card. Eight cards became none —
not on a phone, everywhere. Removing markup without removing what writes to
it, which is the oldest fault there is.

The count was ruled out, so the lines go rather than being guarded. A guard
would leave the reader wondering whether the count is meant to come back.

**2 · The back pill is on the desktop.**

`.phone-back` was drawn in JavaScript unconditionally — correctly, since the
markup is cheap and CSS decides who sees it — but its `display:none` was
written *inside* the 767 query. Above 767 there is no rule at all, so a
button falls back to being a visible button: a black arrow and the words
"Your photograph" in the middle of the workshop.

The default goes outside the query, where a default belongs.

Usage:  python scripts\\patch-fix-floor-and-back.py public\\portraits.html
"""
import io
import sys

# ── 1 · the two lines that write to a removed element ────────────────
OLD_A = """      a.querySelector('.silo-card__count').textContent = '';"""
NEW_A = """      /* the count was removed 2026-08-08 */"""

OLD_B = """      a.querySelector('.silo-card__count').textContent =
        live + (live === 1 ? ' effect' : ' effects');"""
NEW_B = """      /* the count was removed 2026-08-08 — photograph, title, nothing else */"""

# ── 2 · the default belongs outside the query ────────────────────────
OLD_CSS = """.band{ display:none }"""
NEW_CSS = """.band{ display:none }

/* Drawn in script on every width because the markup is cheap and CSS
   decides who sees it — but the default has to live out here. Inside the
   767 query there was no rule above 767, and a button with no rule is a
   visible button: a black arrow in the middle of the workshop. */
.phone-back{ display:none }"""


def crlf(t):
    return t.replace("\n", "\r\n")


def swap(doc, name, old, new):
    for o, n_ in ((old, new), (crlf(old), crlf(new))):
        c = doc.count(o)
        if c == 1:
            return doc.replace(o, n_, 1)
        if c > 1:
            raise SystemExit("FAIL: %s matched %d times, expected 1" % (name, c))
    raise SystemExit("FAIL: %s not found. Nothing was written." % name)


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    if "the count was removed 2026-08-08" in doc:
        raise SystemExit("Already applied. Nothing written.")

    doc = swap(doc, "the empty count write", OLD_A, NEW_A)
    doc = swap(doc, "the count write", OLD_B, NEW_B)
    doc = swap(doc, "the band default", OLD_CSS, NEW_CSS)

    # gates
    if "querySelector('.silo-card__count')" in doc:
        raise SystemExit("FAIL: something still writes to the removed element")
    if doc.count(".phone-back{ display:none }") != 1:
        raise SystemExit("FAIL: the desktop default was not written")
    # It must be at the top level of a stylesheet, not inside a query.
    # Counted across the style blocks only, with comments removed —
    # braces inside JavaScript strings are not CSS nesting.
    import re
    styles = "".join(re.findall(r"<style[\s\S]*?</style>", doc))
    at = styles.index(".phone-back{ display:none }")
    before = re.sub(r"/\*[\s\S]*?\*/", "", styles[:at])
    if before.count("{") - before.count("}") != 0:
        raise SystemExit("FAIL: the default landed inside a block")
    # the cards must still be built
    if "function siloCard" not in doc and "siloCard(s)" not in doc:
        raise SystemExit("FAIL: the card builder was disturbed")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  the floor builds again: nothing writes to the removed count")
    print("  the back pill is hidden by default, shown only under 767")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-fix-floor-and-back.py <file.html>")
    main(sys.argv[1])
