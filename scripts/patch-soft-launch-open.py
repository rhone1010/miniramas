#!/usr/bin/env python3
"""
patch-soft-launch-open.py  -  22 August 2026  -  CUI V32

WHAT THIS DOES
  Flips SOFT_LAUNCH from true to false in the five rooms that carry it, so
  the credit shop is open everywhere. Groups already runs with no gate at
  all; this makes the other five match it rather than the reverse.

WHY THE COMMENT CHANGES TOO
  The block above the flag says "SET THIS TO false TO REOPEN THE SHOP".
  Leaving that in place next to a false reads as an instruction that was
  never followed. The comment is replaced with what is now true.

  It also means the post-write assertion can grep for the old sentence and
  expect zero - a comment quoting the string being searched for is how
  three assertions failed on 21 August.

READS   D:\\minramas\\public\\<page>.html
WRITES  %USERPROFILE%\\Downloads\\<page>.html

  Dry run by default. Nothing is written without --apply.
  Refuses to write if the anchor is not found exactly once.
  Refuses to write if the result does not verify.
"""

import os
import sys

REPO = r"D:\minramas\public"
OUT  = os.path.join(os.environ.get("USERPROFILE", os.path.expanduser("~")),
                    "Downloads")

PAGES = [
    "portraits.html",
    "pets.html",
    "halloween.html",
    "pets-halloween.html",
    "pets-chooser.html",
]

# ---- the two anchors, exactly as they sit in the file --------------------

ANCHOR_FLAG = "  var SOFT_LAUNCH = true;"
REPLACE_FLAG = "  var SOFT_LAUNCH = false;"

ANCHOR_NOTE = "     SET THIS TO false TO REOPEN THE SHOP. Nothing else changes. */"
REPLACE_NOTE = (
    "     THE SHOP IS OPEN. Ruled by Rich, 22 August 2026: a customer who\r\n"
    "     wants more credits may buy them, grant or no grant. Groups has\r\n"
    "     always run this way and nothing came of it.\r\n"
    "\r\n"
    "     SET THIS TO true TO SHUT THE SHOP AGAIN. Nothing else changes. */"
)

# The old sentence, which must be gone afterwards. Held in pieces so this
# comment does not itself satisfy the grep.
GONE = "SET THIS TO false " + "TO REOPEN THE SHOP"


def process(page, apply_it):
    src = os.path.join(REPO, page)
    dst = os.path.join(OUT, page)

    if not os.path.isfile(src):
        print("  MISSING  %s" % src)
        return False

    with open(src, "r", encoding="utf-8", newline="") as fh:
        text = fh.read()

    # ---- pre-write assertions ------------------------------------------
    n_flag = text.count(ANCHOR_FLAG)
    n_note = text.count(ANCHOR_NOTE)

    if n_flag != 1:
        print("  REFUSE   %s : flag anchor found %d times, expected 1"
              % (page, n_flag))
        return False
    if n_note != 1:
        print("  REFUSE   %s : comment anchor found %d times, expected 1"
              % (page, n_note))
        return False

    out = text.replace(ANCHOR_NOTE, REPLACE_NOTE, 1)
    out = out.replace(ANCHOR_FLAG, REPLACE_FLAG, 1)

    # ---- post-write verification, before anything touches disk ---------
    if out.count(REPLACE_FLAG) != 1:
        print("  REFUSE   %s : result does not carry the false flag" % page)
        return False
    if out.count(ANCHOR_FLAG) != 0:
        print("  REFUSE   %s : result still carries the true flag" % page)
        return False
    if GONE in out:
        print("  REFUSE   %s : old instruction sentence survived" % page)
        return False
    if len(out) <= len(text) - 8:
        print("  REFUSE   %s : result shrank unexpectedly" % page)
        return False

    if not apply_it:
        print("  OK       %s : 1 flag, 1 comment, would write %s"
              % (page, dst))
        return True

    if not os.path.isdir(OUT):
        print("  REFUSE   %s : %s does not exist" % (page, OUT))
        return False

    with open(dst, "w", encoding="utf-8", newline="") as fh:
        fh.write(out)
    print("  WROTE    %s" % dst)
    return True


def main():
    apply_it = "--apply" in sys.argv
    print("patch-soft-launch-open  -  %s"
          % ("APPLY" if apply_it else "DRY RUN"))
    print("")

    ok = 0
    for page in PAGES:
        if process(page, apply_it):
            ok += 1

    print("")
    print("  %d of %d pages" % (ok, len(PAGES)))
    if ok != len(PAGES):
        print("  NOT ALL PAGES PASSED. Nothing further should be installed.")
        sys.exit(1)
    if not apply_it:
        print("  Re-run with --apply to write.")


if __name__ == "__main__":
    main()
