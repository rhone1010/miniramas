#!/usr/bin/env python3
"""
patch-disable-printshop-2026-08-25.py

Disables the Print Shop across all nine customer-facing pages by making
printable(p) always return false. This hides every "Send to Print Shop"
button that is gated by this function -- it does NOT touch showPrintShop(),
PRINT_CO_URL, or any server route. (Server-side gate on
/api/v1/print/checkout is a separate, smaller patch -- do that too if you
want belt-and-suspenders.)

Idempotent: if the guard line is already present in a file, that file is
skipped and reported, not re-patched and not counted as a failure.
Refuses (does not touch) any file where the anchor is missing or appears
more than once, rather than guessing.

Usage:
  python patch-disable-printshop-2026-08-25.py            # dry run (default, writes nothing)
  python patch-disable-printshop-2026-08-25.py --apply    # writes files

Expects to live at <repo>/scripts/patch-disable-printshop-2026-08-25.py
and self-locates the repo root two levels up from this file.
"""

import sys
import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(REPO_ROOT, "public")

FILES = [
    "portraits.html",
    "groups.html",
    "halloween.html",
    "pets.html",
    "pets-chooser.html",
    "pets-halloween.html",
    "wallpapers-portraits.html",
    "wallpapers-pets.html",
    "wallpapers-halloween-pets.html",
]

OLD = (
    "  function printable(p){\r\n"
    "    if (!p) return false;\r\n"
    "    if (/wallpaper/i.test(String(p.series || ''))) return false;\r\n"
    "    return !!(p.art && p.serverId && String(p.art).indexOf('data:') !== 0);\r\n"
    "  }"
)

GUARD = "    if (true) return false;  /* PRINT SHOP DISABLED -- coming soon. Rich, 2026-08-25 */\r\n"

NEW = (
    "  function printable(p){\r\n"
    + GUARD +
    "    if (!p) return false;\r\n"
    "    if (/wallpaper/i.test(String(p.series || ''))) return false;\r\n"
    "    return !!(p.art && p.serverId && String(p.art).indexOf('data:') !== 0);\r\n"
    "  }"
)


def main():
    apply = "--apply" in sys.argv
    mode = "APPLY" if apply else "DRY RUN"
    print(f"=== patch-disable-printshop-2026-08-25.py -- {mode} ===")
    print(f"Repo root: {REPO_ROOT}")
    print()

    ok, skip, fail = [], [], []

    for fname in FILES:
        path = os.path.join(PUBLIC_DIR, fname)
        if not os.path.isfile(path):
            print(f"[MISSING] {fname} -- not found at {path}")
            fail.append(fname)
            continue

        with open(path, "r", encoding="utf-8", newline="") as f:
            content = f.read()

        if GUARD in content:
            print(f"[SKIP]    {fname} -- already patched")
            skip.append(fname)
            continue

        count = content.count(OLD)
        if count == 0:
            print(f"[REFUSE]  {fname} -- anchor not found (file has drifted; not touching it)")
            fail.append(fname)
            continue
        if count > 1:
            print(f"[REFUSE]  {fname} -- anchor found {count} times, expected exactly 1 (ambiguous; not touching it)")
            fail.append(fname)
            continue

        if not apply:
            print(f"[WOULD PATCH] {fname}")
            ok.append(fname)
            continue

        new_content = content.replace(OLD, NEW, 1)
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.write(new_content)

        with open(path, "r", encoding="utf-8", newline="") as f:
            verify = f.read()
        if GUARD not in verify:
            print(f"[FAIL]    {fname} -- wrote but post-write verification did not find the guard line")
            fail.append(fname)
            continue

        print(f"[PATCHED] {fname}")
        ok.append(fname)

    print()
    print(f"OK: {len(ok)}  SKIP: {len(skip)}  FAIL/REFUSE: {len(fail)}")
    if fail:
        print("Files needing attention:", ", ".join(fail))
        sys.exit(1)


if __name__ == "__main__":
    main()
