#!/usr/bin/env python3
"""
patch-groups-nopose.py - stop offering a step that does not exist.

  python scripts\\patch-groups-nopose.py public\\groups.html
  python scripts\\patch-groups-nopose.py public\\groups.html --apply

Dry run by default. CRLF file.

GROUPS HAS NO POSES. There is no pose field on the route; the bodies carry
their own arrangement. That was settled when the page was cloned from
portraits.html, and the button already reflects it - the click handler
short-circuits past openPoses() and runs the craft.

WHAT WAS STILL WRONG IS THE LABEL. It read:

    Next  . choose a pose
    Step 1 of 2 . 20 credits

and then crafted immediately. Two lies in three lines - a step that is not
coming, and a count of two when there is one. A customer pressing that
button expects to be shown poses next and instead gets charged.

The line under the queue said the same: "the pose comes last."

WHAT CHANGES. labelGo() stops branching on the pose view and always writes
the craft label. The step line becomes the price alone, which is the thing
worth saying at the moment somebody is about to spend.

WHAT IS LEFT ALONE, DELIBERATELY. openPoses(), poseCard(), POSES, the pose
view CSS, and the `else` arm of the click handler that reaches none of it.
Removing a step is a smaller change than removing the two hundred lines that
draw one, and if Groups ever gets poses the machinery is still here. This is
the same reasoning that left openPoses() unreachable rather than cut.

SUB_NOTE still outranks everything written here. A message about money
survives the floor flipping back, and that has not changed.
"""

import sys
import os

EDITS = [
    (
        "the button label",
        "    var stage  = workshop || document.getElementById('workshop');\r\n"
        "    var inPose = !!(stage && stage.classList.contains('workshop-view--poses'));\r\n"
        "    if (inPose){\r\n"
        "      tbcGoVerb.textContent = 'Craft';\r\n"
        "      tbcGoN.textContent    = n === 1 ? 'this piece' : ('all ' + n);\r\n"
        "      tbcGoSub.textContent  = 'Step 2 of 2 \\u00b7 ' + credits;\r\n"
        "    } else {\r\n"
        "      tbcGoVerb.textContent = 'Next';\r\n"
        "      tbcGoN.textContent    = '\\u00b7 choose a pose';\r\n"
        "      tbcGoSub.textContent  = 'Step 1 of 2 \\u00b7 ' + credits;\r\n"
        "    }\r\n",

        "    /* NO POSE STEP IN GROUPS. There is no pose field on the route and\r\n"
        "       the bodies carry their own arrangement, so the click handler has\r\n"
        "       always run the craft directly. The label had not caught up: it\r\n"
        "       promised a second step that never came and then charged.\r\n"
        "\r\n"
        "       One label now, and the sub-line is the price - which is the\r\n"
        "       thing worth saying to somebody about to spend. */\r\n"
        "    var inPose = false;\r\n"
        "    tbcGoVerb.textContent = 'Craft';\r\n"
        "    tbcGoN.textContent    = n === 1 ? 'this piece' : ('all ' + n);\r\n"
        "    tbcGoSub.textContent  = credits;\r\n",
    ),
    (
        "the line under the queue",
        "    browsing: 'Add as many effects as you like \\u2014 the pose comes last.',\r\n",
        "    /* Was a promise that a pose step would follow. It does not. */\r\n"
        "    browsing: 'Add as many effects as you like.',\r\n",
    ),
]

MARKER = "NO POSE STEP IN GROUPS"


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

    print("patch-groups-nopose")
    print("  target   " + path)
    print("  mode     " + ("APPLY" if apply_it else "dry run - nothing will be written"))

    if MARKER in original:
        print("  SKIP     already done")
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
    assert "choose a pose" not in text, "the pose label survives"
    assert "Step 1 of 2" not in text, "the step line survives"
    assert "Step 2 of 2" not in text, "the step line survives"
    assert "the pose comes last" not in text, "the queue line survives"
    assert text.count("var inPose = false;") == 1, "inPose not neutralised"
    # inPose is still read by the OPEN_SAY chooser below; it must still resolve
    assert text.count("inPose") == 2, \
        "inPose is read somewhere unexpected: %d references" % text.count("inPose")
    assert text.count("tbcGoSub.textContent  = credits;") == 1, "sub-line not set"
    # the machinery stays
    assert text.count("function openPoses()") == 1, "openPoses was removed"
    assert text.count("function poseCard(") == 1, "poseCard was removed"
    assert text.count("window.POSES  = POSES;") == 1, "POSES export was removed"
    # SUB_NOTE must still win
    assert text.index("if (SUB_NOTE) tbcGoSub.textContent = SUB_NOTE;") > \
           text.index("tbcGoSub.textContent  = credits;"), \
        "SUB_NOTE no longer outranks the step line"
    assert "\r\n" in text, "line endings lost"

    if not apply_it:
        print("  Would write " + str(len(text) - len(original)) + " bytes difference. Re-run with --apply.")
        return 0

    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("  WROTE    " + path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
