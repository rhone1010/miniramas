#!/usr/bin/env python3
"""
patch-halloween-swap.py - eight rows that cannot be crafted, out.

  python scripts\\patch-halloween-swap.py public\\wallpapers.html
  python scripts\\patch-halloween-swap.py public\\wallpapers.html --apply

Dry run by default. LF file, not CRLF.

WHAT WAS WRONG. The Halloween floor offered twenty-eight effects. Eight of
them do not exist in wallpapers-halloween.ts, so there was no prompt behind
the card. Four of those eight had plates and looked perfectly real -
Mummy, Victorian Spirit, Pumpkin King and Bone Collector would have taken
credits and failed at the engine. The other four had no plate either and
showed as bare cards, which is how this was noticed at all.

Meanwhile eight effects that ARE built were not offered anywhere, and all
eight already have both plates shot.

So this is a straight exchange. Eight out, eight in, twenty-eight stays
twenty-eight, and every row now has an engine effect behind it and a man
and a woman plate on disk. Nothing needs shooting.

  OUT                    IN                    why the swap sits here
  skeleton            -> ghoul                 undead for undead
  mummy               -> the_ferryman          death, same register
  spirit              -> porcelain_doll        a haunting rather than a ghost
  candle_wraith       -> ice_wraith            wraith for wraith
  pumpkin             -> night_bloom           the room's other growing thing
  bone_collector      -> halloween_monarch     the room needed its lord
  crimson_oracle      -> raven_monarch         a monarch beside the monarchs
  haunted_ringmaster  -> spider_monarch        the same

THE TWO PLACEMENT RULES FROM THE REGISTRY ARE HONOURED.

  the_ferryman and lantern_keeper must not sit adjacent - both are hooded
  figures with a blue-green lantern in graveyard mist and they read
  identically at thumbnail size. The Ferryman goes to The Undead, page one;
  Lantern Keeper stays in The Cursed, page three. Different pages entirely.

  shadow_monarch is the only effect with no colour in it. It keeps its place
  in The Dark Arts beside Eclipse and Demon Lord, where it can be seen.

STILL SHORT AFTER THIS: man_headless_horseman.jpeg. The woman is shot. That
row stays because the effect is real and half the pair exists; it will show
the woman and go bare on the loads that deal a man, until the plate lands.

LEFT ON DISK, MATCHING NO ID: plushie in portraits, forest_revenant and
gargoyle in halloween. Shot, never offered, no engine effect. Not deleted -
nothing here deletes anything - just recorded so the next session does not
re-derive it.
"""

import sys
import os

SWAPS = [
    ("skeleton",
     "    { id:'skeleton',           label:'Skeleton',            room:'halloween' },\n",
     "    { id:'ghoul',              label:'Ghoul',               room:'halloween' },\n"),
    ("mummy",
     "    { id:'mummy',              label:'Mummy',               room:'halloween' },\n",
     "    /* Not adjacent to lantern_keeper - different page entirely. */\n"
     "    { id:'the_ferryman',       label:'The Ferryman',        room:'halloween' },\n"),
    ("spirit",
     "    { id:'spirit',             label:'Victorian Spirit',    room:'halloween' },\n",
     "    { id:'porcelain_doll',     label:'Living Porcelain Doll', room:'halloween' },\n"),
    ("candle_wraith",
     "    { id:'candle_wraith',      label:'Candle Wraith',       room:'halloween' },\n",
     "    { id:'ice_wraith',         label:'Ice Wraith',          room:'halloween' },\n"),
    ("pumpkin",
     "    { id:'pumpkin',            label:'Pumpkin King',        room:'halloween' },\n",
     "    { id:'night_bloom',        label:'The Night Bloom',     room:'halloween' },\n"),
    ("bone_collector",
     "    { id:'bone_collector',     label:'Bone Collector',      room:'halloween' },\n",
     "    { id:'halloween_monarch',  label:'Lord / Lady of Halloween', room:'halloween' },\n"),
    ("crimson_oracle",
     "    { id:'crimson_oracle',     label:'Crimson Oracle',      room:'halloween' },\n",
     "    { id:'raven_monarch',      label:'Raven King / Queen',  room:'halloween' },\n"),
    ("haunted_ringmaster",
     "    { id:'haunted_ringmaster', label:'Haunted Ringmaster',  room:'halloween' },\n",
     "    { id:'spider_monarch',     label:'Spider King / Queen', room:'halloween' },\n"),
]

NOTE_ANCHOR = (
    "       THIS IS NOT THE LIST IN wallpaper-registry-rows.ts. Seven of these\n"
    "       are new - skeleton, spirit, candle_wraith, pumpkin, bone_collector,\n"
    "       crimson_oracle, haunted_ringmaster - and eight that were in the\n"
    "       registry are not here. Rich's list is the one; the registry needs\n"
    "       bringing to it. */\n"
)

NOTE_NEW = (
    "       RECONCILED 2026-08-20. This list and wallpapers-halloween.ts now\n"
    "       agree on all twenty-eight ids.\n"
    "\n"
    "       Eight rows here had no engine effect behind them and were\n"
    "       exchanged for eight that were built but never offered:\n"
    "\n"
    "         skeleton, mummy, spirit, candle_wraith, pumpkin,\n"
    "         bone_collector, crimson_oracle, haunted_ringmaster\n"
    "                                     out\n"
    "         ghoul, the_ferryman, porcelain_doll, ice_wraith, night_bloom,\n"
    "         halloween_monarch, raven_monarch, spider_monarch\n"
    "                                     in\n"
    "\n"
    "       Four of the eight removed had plates and looked entirely real -\n"
    "       Mummy, Victorian Spirit, Pumpkin King and Bone Collector would\n"
    "       have taken credits and failed at the engine. The other four had\n"
    "       no plate either, which is the only reason this was spotted.\n"
    "\n"
    "       Every row below now has an engine effect and both plates on disk,\n"
    "       with one exception: headless_horseman has the woman and not the\n"
    "       man, so it goes bare on the loads that deal a man. */\n"
)

MARKER = "RECONCILED 2026-08-20"


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

    print("patch-halloween-swap")
    print("  target   " + path)
    print("  mode     " + ("APPLY" if apply_it else "dry run - nothing will be written"))

    if MARKER in original:
        print("  SKIP     already reconciled")
        return 0

    if "\r\n" in original:
        print("  FAIL     file has CRLF; these anchors are LF. Nothing written.")
        return 1

    text = original
    failed = 0

    n = text.count(NOTE_ANCHOR)
    if n != 1:
        print("  FAIL     the stale note - anchor matches " + str(n) + " times")
        failed += 1
    else:
        text = text.replace(NOTE_ANCHOR, NOTE_NEW, 1)
        print("  OK       the stale note replaced")

    for name, anchor, new in SWAPS:
        c = text.count(anchor)
        if c != 1:
            print("  FAIL     " + name + " - anchor matches " + str(c) + " times")
            failed += 1
            continue
        text = text.replace(anchor, new, 1)
        print("  OK       " + name)

    if failed:
        print("  REFUSED  " + str(failed) + " anchor problem(s). Nothing written.")
        return 1

    # pre-write assertions
    OUT = ["skeleton", "mummy", "spirit", "candle_wraith", "pumpkin",
           "bone_collector", "crimson_oracle", "haunted_ringmaster"]
    IN = ["ghoul", "the_ferryman", "porcelain_doll", "ice_wraith", "night_bloom",
          "halloween_monarch", "raven_monarch", "spider_monarch"]

    for i in OUT:
        assert ("id:'" + i + "'") not in text, i + " is still offered"
    for i in IN:
        assert text.count("id:'" + i + "'") == 1, i + " missing or duplicated"

    # the count must not have moved
    import re
    def hall_ids(s):
        start = s.index("HALLOWEEN PETS")
        blk = s[:start]
        # the halloween rows are the last run before the pets block
        return [m for m in re.findall(r"id:'([a-z_]+)',\s+label:[^\n]*room:'halloween'", blk)]
    before, after = hall_ids(original), hall_ids(text)
    assert len(after) == len(before) == 28, \
        "the room is no longer twenty-eight: %d -> %d" % (len(before), len(after))
    assert len(set(after)) == 28, "a duplicate id was introduced"

    # the two placement rules
    fi, li = after.index("the_ferryman"), after.index("lantern_keeper")
    assert abs(fi - li) > 1, "the_ferryman and lantern_keeper ended up adjacent"
    assert (fi // 7) != (li // 7), "the_ferryman and lantern_keeper share a page"

    assert "\r\n" not in text, "line endings changed"

    print("  OK       twenty-eight ids, no duplicates")
    print("  OK       the_ferryman and lantern_keeper on different pages")

    if not apply_it:
        print("  Would write " + str(len(text) - len(original)) + " bytes difference. Re-run with --apply.")
        return 0

    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("  WROTE    " + path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
