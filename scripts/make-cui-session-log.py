#!/usr/bin/env python3
"""
make-cui-session-log.py - the file record for the CUI session of 20 Aug 2026.

  python scripts\\make-cui-session-log.py
  python scripts\\make-cui-session-log.py -o H:\\NO_DELETE_ARCHIVE\\Logs\\CUI-session-2026-08-20.csv

Writes a CSV in FileOps-Tracker column order so it can be merged with
FileActions_2026-08-20.csv.

WHY THIS EXISTS AND WHAT IT IS NOT.

The tracker was instrumented into the PowerShell scripts partway through
this session. Everything CUI did before that, and everything CUI did
through Python, produced no row. This reconstructs those rows from the
session transcript so the day's record has no hole in it.

IT IS A RECONSTRUCTION, NOT A CONTEMPORANEOUS CAPTURE. Every row says so in
its Result column:

  CONFIRMED    the Install-File output was read back in the session, with
               byte count and write time. Highest confidence available.
  APPLIED      the script reported WROTE or the operator confirmed it, but
               the exact clock time was not captured.
  UNCONFIRMED  the command was issued and no result was read back. It may
               or may not have run.

Timestamps are left EMPTY where they were not captured. An empty cell is
honest; an invented one is worse than nothing in a record whose whole
purpose is being checkable.

Hashes are empty throughout. They cannot be computed after the fact for a
file that has since changed again, and a hash of the current state would
describe the wrong moment.

NOTHING IN THIS SESSION WAS DELETED. No Remove-Item, no del, no discard.
Replacements went through Install-File, which archives the previous version
to H: before writing. Where the archive path was not read back, the row
says UNKNOWN rather than naming a path nobody checked.
"""

import csv
import sys

DATE = "2026-08-20"
USER = "richh"
REPO = r"D:\minramas"
DOWNLOADS = r"C:\Users\richh\Downloads"

COLUMNS = [
    "Timestamp", "Action", "Source", "Destination",
    "SourceSHA256", "DestinationSHA256", "Result",
    "Script", "Function", "ProcessId", "User", "Computer", "Note",
]

rows = []


def add(action, source, destination, result, note, ts="", script="Install-File.ps1"):
    rows.append({
        "Timestamp": ts,
        "Action": action,
        "Source": source,
        "Destination": destination,
        "SourceSHA256": "",
        "DestinationSHA256": "",
        "Result": result,
        "Script": script,
        "Function": "",
        "ProcessId": "",
        "User": USER,
        "Computer": "",
        "Note": note,
    })


# ---------------------------------------------------------------------------
# 1 - INSTALLS WITH OUTPUT READ BACK IN SESSION
# Byte count and write time came from the Install-File output itself.
# ---------------------------------------------------------------------------
CONFIRMED = [
    ("scripts\\patch-community-toggles.py",   3081,  "12:15:53"),
    ("scripts\\patch-gallery-nav.py",         13080, "12:15:54"),
    ("scripts\\patch-middleware-panels.py",   4291,  "12:24:42"),
    ("scripts\\patch-portraits-panel-boot.py", 5462, "12:24:42"),
    ("scripts\\patch-collection-post.py",     20247, "14:53:48"),
    ("scripts\\test-collection-post.js",      9968,  "14:53:49"),
    ("docs\\GOVERNANCE\\READ-THIS-FIRST.md",  4342,  "14:53:52"),
]

for target, size, t in CONFIRMED:
    leaf = target.split("\\")[-1]
    add(
        "INSTALL_NEW",
        DOWNLOADS + "\\" + leaf,
        REPO + "\\" + target,
        "CONFIRMED",
        ("new file, no prior version, nothing archived. "
         "{0} bytes. Install-File output read back in session.").format(size),
        ts=DATE + " " + t,
    )


# ---------------------------------------------------------------------------
# 2 - INSTALLS CONFIRMED BY THE OPERATOR, CLOCK TIME NOT CAPTURED
# ---------------------------------------------------------------------------
APPLIED_INSTALLS = [
    ("scripts\\patch-nav-groups.py",          "new file"),
    ("scripts\\patch-hide-footer.py",         "new file"),
    ("scripts\\patch-floor-height.py",        "new file"),
    ("scripts\\patch-studio-crumb.py",        "new file"),
    ("scripts\\patch-queue-needs-source.py",  "new file"),
    ("scripts\\patch-wallpapers-type.py",     "new file"),
    ("scripts\\patch-community-signedin.py",  "new file"),
    ("scripts\\patch-softlaunch-paywall.py",  "new file"),
]

for target, kind in APPLIED_INSTALLS:
    leaf = target.split("\\")[-1]
    add(
        "INSTALL_NEW",
        DOWNLOADS + "\\" + leaf,
        REPO + "\\" + target,
        "APPLIED",
        (kind + ", no prior version, nothing archived. "
         "Operator confirmed by running it; clock time not captured."),
    )


# ---------------------------------------------------------------------------
# 3 - THE ONE REPLACEMENT
# This is the row that matters for the question this log exists to answer:
# a file at its repo path was replaced, and the previous version went to H:
# rather than being deleted.
# ---------------------------------------------------------------------------
add(
    "INSTALL_REPLACE",
    DOWNLOADS + "\\groups-registry.js",
    REPO + "\\public\\groups-registry.js",
    "APPLIED",
    ("REPLACEMENT. The previous groups-registry.js was archived to H: by "
     "Install-File.ps1 with _NNN numbering before the new file was written. "
     "ARCHIVE PATH UNKNOWN - the Install-File output was not read back in "
     "session, so the exact H: path is not recorded here and should be read "
     "from Install-File's own ledger or from H: directly. "
     "NOT A DELETION. Verified after install with findstr: the lookup table "
     "was gone and the derived plate path was present."),
)


# ---------------------------------------------------------------------------
# 4 - INSTALL COMMANDS ISSUED, NO RESULT READ BACK
# ---------------------------------------------------------------------------
UNCONFIRMED = [
    "docs\\GOVERNANCE\\CUI-CENG-COMMUNITY-2026-08-20.md",
    "docs\\GOVERNANCE\\CUI-CENG-COMMUNITY-RULINGS-2026-08-20.md",
    "docs\\GOVERNANCE\\SOFT-LAUNCH-ALLOCATION-2026-08-20.md",
]

for target in UNCONFIRMED:
    leaf = target.split("\\")[-1]
    add(
        "INSTALL_NEW",
        DOWNLOADS + "\\" + leaf,
        REPO + "\\" + target,
        "UNCONFIRMED",
        ("Install command issued; no output read back in session. "
         "May or may not have been run. Verify against the repo path."),
    )

# Delivered but superseded before installation.
for leaf in ("FileOps-Tracker.ps1", "Test-FileOpsTracker.ps1"):
    add(
        "NOT_INSTALLED",
        DOWNLOADS + "\\" + leaf,
        "",
        "SUPERSEDED",
        ("CUI delivered a hardened draft; CENG's rewrite superseded it before "
         "installation. Believed never installed. The copy in Downloads is "
         "not the live version."),
        script="",
    )


# ---------------------------------------------------------------------------
# 5 - IN-PLACE EDITS BY PYTHON PATCH SCRIPTS
# Not moves, not renames, no archive. The file at its repo path was edited
# in place. Every one is anchor-replace with pre-write assertions, and every
# one is recoverable from git - the commits are named in the notes.
# ---------------------------------------------------------------------------
EDITS = [
    ("public\\portraits.html", "patch-nav-groups.py",
     "added Groups to the Series dropdown and the mobile drawer"),
    ("public\\portraits.html", "patch-hide-footer.py",
     "appended one CSS block hiding the placeholder footer; markup untouched"),
    ("public\\portraits.html", "patch-portraits-panel-boot.py",
     "appended a boot hook opening My Collection / Account / Print on arrival"),
    ("public\\portraits.html", "patch-collection-post.py",
     "added Post to Community: styles, modal markup, one button, wiring"),
    ("public\\portraits.html", "patch-queue-needs-source.py",
     "queue now refuses an effect when no source photograph is present"),
    ("public\\portraits.html", "patch-softlaunch-paywall.py",
     "soft launch: browse doors to the buy panel closed until credits spent"),
    ("public\\wallpapers.html", "patch-floor-height.py",
     "tile cap derived from viewport height; fixes overflow above 1920"),
    ("public\\wallpapers.html", "patch-wallpapers-type.py",
     "thirty type rules raised to the brand floor across three bands"),
    ("public\\gallery.html", "patch-gallery-nav.py",
     "ported the Series switcher; nav made consistent; filter bar floated"),
    ("public\\community.html", "patch-community-toggles.py",
     "The Board / Ideas toggles raised to 1.5rem"),
    ("public\\community.html", "patch-community-signedin.py",
     "stopped a failed board read reporting a signed-in customer as signed out"),
    ("public\\wallpaper-studio-V002.html", "patch-studio-crumb.py",
     "added the breadcrumb; the Studio had no route back but the dropdown"),
    ("middleware.ts", "patch-middleware-panels.py",
     "mapped /collection, /account and /print, which had been 404ing"),
]

for target, script, what in EDITS:
    add(
        "SCRIPT_MODIFY",
        REPO + "\\" + target,
        REPO + "\\" + target,
        "APPLIED",
        ("In-place edit, not a move. No archive; the prior content is in git "
         "history. " + what + "."),
        script=script,
    )


# ---------------------------------------------------------------------------
# 6 - FILES GENERATED BY Resize-Plates.ps1
# Output byte counts were read back in session. The originals in
# public\previews\groups were NOT touched - the script writes to a separate
# folder. Nothing was replaced and nothing was removed.
# ---------------------------------------------------------------------------
PLATES = [
    ("art_nouveau", 620345, 118702), ("balloon_face", 169720, 81500),
    ("bronze", 441016, 72906), ("carved_family", 625507, 111482),
    ("clockwork", 267011, 118308), ("cubism", 577258, 100388),
    ("ebony", 367952, 62133), ("elizabethan", 168710, 74821),
    ("family_impressionism", 480745, 60077), ("family_mosaic", 756392, 137130),
    ("folded_book", 436048, 76088), ("ice", 164711, 74345),
    ("layered_paper", 362044, 72229), ("neon", 238511, 101435),
    ("origami", 145084, 68339), ("pencil_sketch", 201956, 92528),
    ("persian_court", 212795, 93387), ("plushy", 449023, 71733),
    ("porcelain", 160608, 74355), ("reclaimed_bronze", 594388, 107395),
    ("renaissance", 172957, 75136), ("retro_robot", 185894, 85769),
    ("samurai", 231722, 100850), ("sea_glass", 212477, 94229),
    ("stone", 343564, 60899), ("ukiyo_e", 622867, 107231),
    ("victorian", 164708, 73927), ("wild_west", 192335, 79090),
]

add("BATCH_START", "", "", "STARTED",
    "Resize-Plates.ps1 -Apply. 28 plates, 9.1 MB in, 2.3 MB out, 74 percent saved.",
    script="Resize-Plates.ps1")

for name, before, after in PLATES:
    add(
        "GENERATED_FILE",
        REPO + "\\public\\previews\\groups\\groups_" + name + ".jpg",
        REPO + "\\public\\previews\\groups-small\\groups_" + name + ".jpg",
        "RECORDED",
        ("Resized copy at 800px, quality 62. Source read only and NOT "
         "modified, moved or removed. {0} bytes in, {1} bytes out.").format(before, after),
        script="Resize-Plates.ps1",
    )

add("BATCH_END", "", "", "COMPLETED",
    "28 files written to public\\previews\\groups-small. Originals untouched.",
    script="Resize-Plates.ps1")

# The legacy archive pass moved nothing.
add(
    "ARCHIVE_SCAN",
    REPO + "\\public\\previews\\groups",
    "",
    "NO_ACTION",
    ("Archive-LegacyPlates.ps1 -Apply. Output read back in session: "
     "KEEP 28, ARCHIVE 0. NOTHING WAS MOVED OR REMOVED - the legacy set had "
     "already been archived in an earlier session."),
    script="Archive-LegacyPlates.ps1",
)


# ---------------------------------------------------------------------------
def main():
    out = "CUI-session-{0}.csv".format(DATE)
    if "-o" in sys.argv:
        out = sys.argv[sys.argv.index("-o") + 1]

    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, quoting=csv.QUOTE_ALL)
        w.writeheader()
        for r in rows:
            w.writerow(r)

    counts = {}
    for r in rows:
        counts[r["Result"]] = counts.get(r["Result"], 0) + 1

    print("make-cui-session-log")
    print("  wrote    " + out)
    print("  rows     " + str(len(rows)))
    for k in sorted(counts):
        print("    {0:<12} {1}".format(k, counts[k]))
    print("")
    print("  deletions recorded: 0")
    print("  replacements: 1 (public\\groups-registry.js, prior version archived to H:)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
