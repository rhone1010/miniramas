#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-reel-copy-r1.py  -  CUI 41A  -  25 August 2026

RICH'S WORDS ON EVERY LINE. All 24 mobile taglines and 4 of 5 desktop
headlines ruled this evening; desktop Halloween came back unchanged and
is untouched. Every DRAFT marker retires - nothing on the reel wears a
placeholder voice any more. Copy is verbatim from Rich's list.
"""
import os, sys, io

FILES = ["index.html"]

EDITS = [
("M02",
 "['woman_music.jpg',          'Or the notes of a song'],",
 "['woman_music.jpg',          'Or written into the notes of a song'],"),

("M03",
 "['woman_renaissance.jpg',    'Or back to the Renaissance'],",
 "['woman_renaissance.jpg',    'Or borrowed from another century'],"),

("M04",
 "['woman_stained_glass.jpg',  'Or maybe as a beautiful lamp'],",
 "['woman_stained_glass.jpg',  'Or glowing somewhere beautifully impossible'],"),

("M05",
 "['man_ice.jpg',              'We turn your photographs into impossible things'],",
 "['man_ice.jpg',              'We turn photographs into things photographs cannot be'],"),

("M06",
 "['woman_folded_book.jpg',    'Or turn into your favourite novel'],",
 "['woman_folded_book.jpg',    'Become the story on your favourite book'],"),

("M07",
 "['woman_face_petals.jpg',    'Or your favourite flowers'],",
 "['woman_face_petals.jpg',    'Or something grown entirely from flowers'],"),

("M08",
 "['man_neon.jpg',             'Fifty-six finishes, and counting']       /* DRAFT */",
 "['man_neon.jpg',             'Fifty-six ways to become something else']"),

("M09",
 "['man_haunted_scarecrow.jpg?v=2','Or something that waits after dark'],",
 "['man_haunted_scarecrow.jpg?v=2','Or become something that waits after dark'],"),

("M10",
 "['woman_swamp_creature.jpg?v=2', 'We have a room for October'],",
 "['woman_swamp_creature.jpg?v=2', 'October has a room of its own'],"),

("M11",
 "['man_haunted_scarecrow.jpg','Some faces are better after dark'],      /* DRAFT */",
 "['man_haunted_scarecrow.jpg','Some faces improve considerably after sunset'],"),

("M12",
 "['man_clockwork_corpse.jpg?v=2', 'Twenty-eight ways to be unrecognisable'] /* DRAFT */",
 "['man_clockwork_corpse.jpg?v=2', 'Twenty-eight ways to haunt your own photograph']"),

("M13",
 "['groups_quilted.jpeg',         'Everyone, in one piece'],             /* DRAFT */",
 "['groups_quilted.jpeg',         'Everyone, in one impossible piece'],"),

("M14",
 "['groups_porcelain.jpeg',       'The whole family, held still'],       /* DRAFT */",
 "['groups_porcelain.jpeg',       'The whole family, recast together'],"),

("M15",
 "['groups_forest_guardian.jpeg', 'Or somewhere none of you have been'], /* DRAFT */",
 "['groups_forest_guardian.jpeg', 'Or somewhere none of you have ever been'],"),

("M16",
 "['groups_origami.jpeg',         'Bring us the one photograph you all liked'] /* DRAFT */",
 "['groups_origami.jpeg',         'Bring us the photograph that somehow got everyone right']"),

("M17",
 "['pets_victorian.jpg',     'Your dog has never been painted'],",
 "['pets_victorian.jpg',     'Your dog has never looked quite this distinguished'],"),

("M18",
 "['pets_impressionist.jpg', 'Cats sit for us too'],",
 "['pets_impressionist.jpg', 'Cats, naturally, require their own collection'],"),

("M19",
 "['pets_quilted.jpg?v=2',   'Thirty-four finishes, for the ones who will not hold still'], /* DRAFT */",
 "['pets_quilted.jpg?v=2',   'Thirty-four ways to immortalise someone who will not sit still'],"),

("M20",
 "['pets_clockwork.jpg?v=2', 'Nobody has ever asked us for a small one']  /* DRAFT */",
 "['pets_clockwork.jpg?v=2', 'Because nobody ever asked for a smaller portrait of their dog']"),

("M21",
 "['hellborn_beast.jpg',     'Though he may prefer something fiercer'],",
 "['hellborn_beast.jpg',     'Though some of them were clearly meant to be fiercer'],"),

("M22",
 "['harvest_god_beast.jpg',  'And come back as something else'],",
 "['harvest_god_beast.jpg',  'Let them come back as something else'],"),

("M23",
 "['gargoyle_beast.jpg',     'The other season, for the other half of the house'], /* DRAFT */",
 "['gargoyle_beast.jpg',     'October belongs to this half of the house, too'],"),

("M24",
 "['posessed_beast.jpg',     'Twenty-seven of them, and they all bite']   /* DRAFT */",
 "['posessed_beast.jpg',     'Twenty-seven transformations. Most have teeth.']"),

("D1",
 "say:'Photographs, <em>reimagined.</em><br>A likeness, recrafted.',",
 "say:'Photographs, <em>reimagined.</em><br>Become something impossible.',"),

("D2",
 "say:'Everyone, <em>in one piece.</em>',",
 "say:'Everyone, <em>in one impossible piece.</em>',"),

("D3",
 "say:'They sat for you <em>once.</em>',",
 "say:'They sat for you <em>once.</em> We took it from there.',"),

("D4",
 "say:'The other season, <em>for the other half of the house.</em>',",
 "say:'October belongs to this half of the house, <em>too.</em>',"),

]

def normalise(s): return s.replace("\r\n", "\n").replace("\r", "\n")

def run(src_dir, out_dir, apply):
    ok = True
    for name in FILES:
        src = os.path.join(src_dir, name)
        print("\n" + "="*66 + "\n" + name + "\n" + "="*66)
        if not os.path.isfile(src): print("  REFUSED: not found"); ok=False; continue
        text = normalise(io.open(src,"rb").read().decode("utf-8"))
        before = len(text)
        halt = False
        for label, old, new in EDITS:
            n = text.count(old)
            if n != 1:
                if new in text: print("  REFUSED: already applied -- %s" % label)
                else: print("  REFUSED: anchor %d times -- %s" % (n, label))
                halt = True
        if halt: ok=False; continue
        for label, old, new in EDITS:
            text = text.replace(old, new, 1)
        print("  ok   %d lines re-worded, DRAFT markers retired" % len(EDITS))
        if "/* DRAFT */" in text.split("var REEL = [")[0].split("var REEL_SERIES")[-1]:
            print("  REFUSED: a DRAFT marker survived in REEL_SERIES"); ok=False; continue
        print("  %d -> %d (%+d)" % (before, len(text), len(text)-before))
        if apply:
            io.open(os.path.join(out_dir,name),"w",encoding="utf-8",newline="\n").write(text)
            print("  WROTE %s" % os.path.join(out_dir,name))
        else: print("  DRY RUN -- nothing written")
    print("\n" + ("All files clean." if ok else "ONE OR MORE FILES REFUSED."))
    return 0 if ok else 1

if __name__ == "__main__":
    apply = "--apply" in sys.argv
    home = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)
    out_dir = os.path.join(home,"Downloads"); src_dir = ""
    for a in sys.argv[1:]:
        if a.startswith("--src="): src_dir=a[6:]
        if a.startswith("--out="): out_dir=a[6:]
    if not src_dir: src_dir = os.path.join(repo,"public")
    if not os.path.isdir(src_dir): print("REFUSED: install to scripts\\ first."); sys.exit(1)
    print("\nreading  %s\nwriting  %s" % (src_dir, out_dir))
    sys.exit(run(src_dir, out_dir, apply))
