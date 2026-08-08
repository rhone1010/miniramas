#!/usr/bin/env python3
"""
THE SPINE GOES

A 60px vertical strip down the left of the Curator card, oxblood, holding
the words "Design your own" rotated on their side. It has no handler and
opens nothing. Rich has asked for it out more than once.

It was the closed edge of a drawer that was never built — the title
attribute and the cursor:pointer are both left over from something meant to
open. What survived is a strip of colour with a label that promises an
action nobody can take.

WHAT GOES

  · the markup
  · .rail and .rail span
  · --rail-w, and the two-column grid on .room--curator that reserved space
    for it. The Curator card becomes the whole room, which is what it has
    effectively been.

The stage-two rule that hid the spine on phones goes too, since there is
nothing left to hide.

WHAT STAYS

`.cur { grid-column: 2 }` is left alone deliberately. In a single-column
grid, column 2 does not exist and the browser places the item in an implicit
track — which lays out identically and cannot break if a future revision
puts something back in column 1. Removing it would be a second edit for no
visible gain.

Usage:  python scripts\\patch-drop-rail.py public\\portraits.html
"""
import io
import sys

OLD_MARKUP = """      <div class="rail" title="Design your own"><span>Design your own</span></div>
"""
NEW_MARKUP = """"""

OLD_RULE = """.rail{
  grid-column:1; position:relative; z-index:3;
  background:var(--oxblood);
  display:grid; place-items:center;
  cursor:pointer;
}
.rail span{
  font-family:var(--serif); font-style:italic; font-size:1.6rem;
  color:var(--vellum-200); white-space:nowrap;
  writing-mode:vertical-rl; transform:rotate(180deg);
  letter-spacing:.04em;
}"""

NEW_RULE = """/* The "Design your own" spine was removed 2026-08-07. It had no handler
   and opened nothing — the closed edge of a drawer that was never built,
   keeping its cursor:pointer and its title long after whatever it was
   meant to open had gone. Sixty pixels of a screen promising an action
   nobody could take. */"""

# the two grids that reserved a column for it
OLD_GRID_A = """.room--curator{
  display:grid;
  grid-template-columns:var(--rail-w) minmax(0,1fr);
}"""
NEW_GRID_A = """.room--curator{
  display:grid;
  grid-template-columns:minmax(0,1fr);
}"""

OLD_GRID_B = """  grid-template-columns:var(--rail-w) minmax(0,1fr);
  overflow:hidden;
  padding:0;
}"""
NEW_GRID_B = """  grid-template-columns:minmax(0,1fr);
  overflow:hidden;
  padding:0;
}"""

# the token
OLD_TOKEN = """  --rail-w:60px;                        /* the closed "Design your own" spine */"""
NEW_TOKEN = """"""

OLD_TOKEN_2 = """    --rail-w:48px;"""
NEW_TOKEN_2 = """"""

# stage two hid it on phones; there is nothing left to hide
OLD_PHONE = """  .room--curator{ grid-template-columns:minmax(0,1fr) }
  .rail{ display:none }
  .cur{ grid-column:1 }"""
NEW_PHONE = """  .cur{ grid-column:1 }"""


def crlf(t):
    return t.replace("\n", "\r\n")


def swap(doc, name, old, new, required=True):
    for o, n_ in ((old, new), (crlf(old), crlf(new))):
        c = doc.count(o)
        if c == 1:
            return doc.replace(o, n_, 1)
        if c > 1:
            raise SystemExit("FAIL: %s matched %d times, expected 1" % (name, c))
    if not required:
        return doc
    raise SystemExit("FAIL: %s not found. Nothing was written." % name)


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    if 'class="rail"' not in doc:
        raise SystemExit("Already applied. Nothing written.")

    doc = swap(doc, "the spine markup", OLD_MARKUP, NEW_MARKUP)
    doc = swap(doc, "the .rail rules", OLD_RULE, NEW_RULE)
    doc = swap(doc, "the curator grid", OLD_GRID_A, NEW_GRID_A)
    doc = swap(doc, "the room grid", OLD_GRID_B, NEW_GRID_B)
    doc = swap(doc, "--rail-w", OLD_TOKEN, NEW_TOKEN)
    doc = swap(doc, "--rail-w at 1366", OLD_TOKEN_2, NEW_TOKEN_2, required=False)
    doc = swap(doc, "the phone hide", OLD_PHONE, NEW_PHONE, required=False)
    # a size-down rule at 1366 that also dressed the spine
    doc = swap(doc, "the 1366 spine size",
        "  .rail span{ font-size:1.4rem }\n", "", required=False)

    # gates
    if 'class="rail"' in doc:
        raise SystemExit("FAIL: the spine markup survives")
    if "--rail-w" in doc:
        raise SystemExit("FAIL: a --rail-w reference survives and would resolve to nothing")
    if ".rail{" in doc or ".rail span{" in doc:
        raise SystemExit("FAIL: a .rail rule survives")
    # the card itself must be intact
    for must in ['class="cur" id="cur"', "cur-head", "cur-mark"]:
        if must not in doc:
            raise SystemExit("FAIL: the Curator card was disturbed: " + must)

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  the spine is gone at every width: markup, rules and token")
    print("  the Curator card is now the whole room")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-drop-rail.py <file.html>")
    main(sys.argv[1])
