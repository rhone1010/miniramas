#!/usr/bin/env python3
"""
Rewrite the 56 effect entries in window.EFFECT_PREVIEWS to the flat
man.jpg / woman.jpg names, after the previews/effects rename.

Silo and pose entries live in the same `files` map but in different
trees and were NOT renamed — they are left exactly as found.

Usage:  python patch-effect-previews.py public\\portraits.html
"""
import re
import sys
import io

EFFECTS = [
    "art_deco", "art_nouveau", "balloon_face", "beaded", "bronze",
    "cast_glass", "charcoal_chalk", "chocolate", "clockwork", "coral",
    "crystallized", "cubism", "daguerreotype", "deco_twenties",
    "dragon_skin", "driftwood_resin", "ebony", "elizabethan", "fire_face",
    "folded_book", "forest_guardian", "ice", "impressionist", "iron",
    "jade", "lichen_granite", "linocut", "magic_energy", "mercury",
    "neon", "oil_impasto", "origami", "pencil_sketch", "persian_court",
    "petal_sculpture", "petrified_wood", "plushy", "polished_gold",
    "porcelain", "quilted", "reclaimed_bronze", "renaissance",
    "retro_robot", "samurai", "sand_form", "sandstone", "sea_glass",
    "sheet_music", "stained_glass", "starfield", "stone", "tidewood",
    "ukiyo_e", "victorian", "watercolour", "wild_west",
]

# No man's plate exists for these two. CENG open item; leaving the man
# slot empty is correct — a blank is honest, a woman on a man's card is not.
NO_MAN = {"petrified_wood", "plushy"}


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    if "window.EFFECT_PREVIEWS" not in doc:
        raise SystemExit("FAIL: window.EFFECT_PREVIEWS not found in " + path)

    start = doc.index("window.EFFECT_PREVIEWS")
    end = doc.index("};", start) + 2
    block = doc[start:end]
    original = block

    changed, missing = [], []

    for eid in EFFECTS:
        man = "" if eid in NO_MAN else "man.jpg"
        want = '"%s": ["%s", "woman.jpg", ""]' % (eid, man)

        # tolerate either line ending and any current filenames
        pat = re.compile(
            r'"' + re.escape(eid) + r'":\s*\[\s*"[^"]*"\s*,\s*"[^"]*"\s*,\s*"[^"]*"\s*\]'
        )
        hits = pat.findall(block)
        if len(hits) != 1:
            missing.append("%s (%d matches)" % (eid, len(hits)))
            continue
        if hits[0] != want:
            block = pat.sub(want.replace("\\", "\\\\"), block, count=1)
            changed.append(eid)

    if missing:
        raise SystemExit("FAIL: not matched exactly once: " + ", ".join(missing))

    # gates: no numbered effect filenames may survive in the effect rows
    for eid in EFFECTS:
        row = re.search(r'"' + re.escape(eid) + r'":[^\]]*\]', block).group(0)
        if re.search(r'"\d[^"]*\.(jpg|png)"', row):
            raise SystemExit("FAIL: numbered filename left in " + eid + ": " + row)

    # gates: silo and pose rows must be untouched
    for other in ["another_age", "living_world", "dramatic", "smiling"]:
        a = re.search(r'"' + other + r'":[^\]]*\]', original)
        b = re.search(r'"' + other + r'":[^\]]*\]', block)
        if (a is None) != (b is None):
            raise SystemExit("FAIL: " + other + " row appeared or vanished")
        if a and a.group(0) != b.group(0):
            raise SystemExit("FAIL: " + other + " row was modified")

    if block == original:
        print("No change needed — already flat.")
        return

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc[:start] + block + doc[end:])

    print("Patched %s" % path)
    print("  rows rewritten: %d" % len(changed))
    print("  man slot left empty: %s" % ", ".join(sorted(NO_MAN)))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-effect-previews.py <file.html>")
    main(sys.argv[1])
