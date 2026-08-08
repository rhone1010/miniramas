#!/usr/bin/env python3
"""
STAGE THREE WAS IN THE WRONG PLACE

The phone rules for the three surfaces were written at line 648, anchored to
the stage-one block. The desktop rules they exist to override are at 2213,
2250 and 2887 — fifteen hundred lines later.

Same specificity, later rule wins. So `left:0` lost to

    left: calc(var(--stage-gutter) + var(--spine-w) + var(--room-gap))

and the panels kept a left edge computed for a desktop. Worse: `--spine-w`
was still resolving, but the surfaces were being pushed in by a spine that
no longer exists on screen — so each one slid in as a narrow column with
its text wrapping one word to a line.

The fix is not more specificity, and certainly not !important. It is order.
The block moves to sit after the last of the three definitions, where a
plain override does what it says.

WHY NOT JUST RAISE SPECIFICITY
Because the next person to add a rule for these surfaces would have to
discover the same thing and win the same fight. A cascade that reads
top-to-bottom is one that can be reasoned about; a stack of !important is
one that cannot.

Usage:  python scripts\\patch-surfaces-order.py public\\portraits.html
"""
import io
import sys

START = "/* ======================================================================\n   THE SURFACES \u00b7 stage three \u00b7 phones only"

# it ends at the small-phone comment that followed it
END = """/* Small phones. The 390 rules hold; these only stop type from wrapping
   into single words. */"""

# the last of the three surface definitions — everything must land after it
AFTER = """.acct{
  position:fixed; z-index:57;"""


def crlf(t):
    return t.replace("\n", "\r\n")


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    nl = "\r\n" if "\r\n" in doc[:2000] else "\n"
    start = START if nl == "\n" else crlf(START)
    end = END if nl == "\n" else crlf(END)
    after = AFTER if nl == "\n" else crlf(AFTER)

    i = doc.find(start)
    if i < 0:
        raise SystemExit("FAIL: stage three not found. Nothing written.")
    j = doc.find(end, i)
    if j < 0:
        raise SystemExit("FAIL: the end of stage three not found. Nothing written.")

    block = doc[i:j]
    rest = doc[:i] + doc[j:]

    a = rest.find(after)
    if a < 0:
        raise SystemExit("FAIL: the .acct definition was not found. Nothing written.")
    if a < i:
        raise SystemExit("FAIL: .acct sits before stage three; the move would be a no-op")

    # land it after the whole .acct rule, not inside it
    close = rest.find(nl + "}", a)
    if close < 0:
        raise SystemExit("FAIL: could not find the end of .acct. Nothing written.")
    close += len(nl) + 1

    moved = rest[:close] + nl + nl + block + rest[close:]

    # gates
    if moved.count("THE SURFACES \u00b7 stage three") != 1:
        raise SystemExit("FAIL: the block was duplicated or lost")
    if moved.find("THE SURFACES \u00b7 stage three") < moved.find(after):
        raise SystemExit("FAIL: the block still sits above the rules it overrides")
    for must in ["bottom:118px", ".ps-wall{ grid-template-columns:minmax(0,1fr) }",
                 "repeat(3, minmax(0,1fr))"]:
        if must not in moved:
            raise SystemExit("FAIL: part of the block was lost: " + must[:34])
    if moved.count("@media (max-width:1100px)") != 1:
        raise SystemExit("FAIL: the tablet collapse was disturbed")
    if "!important" in moved and "!important" not in doc:
        raise SystemExit("FAIL: something introduced !important")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(moved)

    print("Patched %s" % path)
    print("  stage three now sits after .mycoll, .pshop and .acct")
    print("  left:0 wins on order, not on force")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-surfaces-order.py <file.html>")
    main(sys.argv[1])
