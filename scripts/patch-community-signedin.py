#!/usr/bin/env python3
"""
patch-community-signedin.py - stop telling a signed-in customer to sign in.

  python scripts\\patch-community-signedin.py public\\community.html
  python scripts\\patch-community-signedin.py public\\community.html --apply

Dry run by default. CRLF file.

THE FAULT, SEEN 20 AUGUST. Signed in as rich1hone, masthead showing it, and
the Ideas panel says "Sign in to leave one."

SIGNED_IN is assigned in exactly one place - inside loadPosts(), from
d.signed_in on the board response. app/api/v1/community/posts/route.ts has
three fallback returns: no database, read failed, and the catch. All three
answer { ok:true, posts:[], more:false } and NONE of them carries
signed_in. So the field arrives undefined, !!undefined is false, and a
failed board read becomes a claim about who the customer is.

There is a second way in. showView('ideas') paints the write state
immediately, and boot is loadHandle().then(loadPosts) - so clicking Ideas
before the board lands reads SIGNED_IN while it is still its initial false.
Nothing repaints afterwards, so it stays wrong until the page is reloaded.

THREE CHANGES, ALL ON THE GLASS. The route should also be fixed - that is
CENG's - but this page should not be able to get it wrong even if it never
is.

1. ONLY BELIEVE THE FIELD WHEN IT IS ACTUALLY THERE. A response that does
   not mention signed_in is not a response saying "signed out". This alone
   fixes the reported fault.

2. REPAINT WHEN THE BOARD LANDS. Whatever was drawn from the initial false
   gets corrected rather than left standing.

3. NEVER DOWNGRADE ON A FAILED READ. Once the server has said somebody is
   signed in, a later failure does not un-sign them. Signing out is a thing
   somebody does, not a thing a timeout decides.

WHAT IS NOT CHANGED. The sign-in prompt itself, and the case where somebody
genuinely is signed out. Those are correct and should stay.
"""

import sys
import os

EDITS = [
    (
        "believe the field only when present",
        "        SIGNED_IN = !!d.signed_in;\r\n",
        "        /* ONLY WHEN THE FIELD IS ACTUALLY THERE. The route has three\r\n"
        "           fallback returns - no database, read failed, and the catch -\r\n"
        "           and none of them carries signed_in. Reading !!undefined off\r\n"
        "           one of those told a signed-in customer to sign in.\r\n"
        "           And never downgrade: once the server has said somebody is\r\n"
        "           signed in, a later failed read does not un-sign them. */\r\n"
        "        if (typeof d.signed_in === 'boolean') SIGNED_IN = SIGNED_IN || d.signed_in;\r\n",
    ),
    (
        "repaint when the board lands",
        "  loadHandle().then(loadPosts);\r\n",
        "  /* Repaint after the board answers. showView('ideas') paints the write\r\n"
        "     state the moment it is clicked, and until the board lands SIGNED_IN\r\n"
        "     is still its initial false - so an early click drew the sign-in\r\n"
        "     prompt and nothing ever corrected it. */\r\n"
        "  loadHandle().then(loadPosts).then(function(){\r\n"
        "    if (IDEAS_LOADED) paintWriteState('idea');\r\n"
        "    paintWriteState('cmt');\r\n"
        "  });\r\n",
    ),
]

MARKER = "ONLY WHEN THE FIELD IS ACTUALLY THERE"


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

    print("patch-community-signedin")
    print("  target   " + path)
    print("  mode     " + ("APPLY" if apply_it else "dry run - nothing will be written"))

    if MARKER in original:
        print("  SKIP     already fixed")
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
    assert text.count("SIGNED_IN = !!d.signed_in") == 0, "old assignment survives"
    assert text.count("typeof d.signed_in === 'boolean'") == 1, "guard missing"
    assert text.count("var SIGNED_IN = false;") == 1, "initial state disturbed"
    assert text.count("loadHandle().then(loadPosts)") == 1, "boot duplicated"
    assert text.count("function paintWriteState") == 1, "paint function disturbed"
    # the signed-out path must still exist
    # Two branches read it: the write-state paint, and hearting - which sends
    # a signed-out visitor to /portraits. That second one is where the "one
    # free heart, then the invitation" ruling will land; it is not this fix.
    assert text.count("if (!SIGNED_IN)") == 2, "a signed-out branch was removed"
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
