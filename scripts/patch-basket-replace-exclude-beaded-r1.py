#!/usr/bin/env python3
# scripts/patch-basket-replace-exclude-beaded-r1.py
#
# effect-registry.ts still lists 'beaded' as body:'live'. Confirmed
# against the real lib/v1/portraits/portraits-bodies.ts this session:
# beaded is not a key there at all — 62 real bodies, matching the
# 08-23 carryover ("beaded cut... 62 bodies, tsc clean"). Registry
# drifted by exactly this one entry; nothing else checked out different.
#
# Excluding it explicitly here rather than switching basket-replace.ts's
# import source — safer than assuming portraits-bodies.ts's export shape
# without having read its actual export declaration this session.
#
# Dry-run by default. --apply writes to Downloads, never the repo.
#
# CENG-45 - 27 August 2026

import sys
import os

TARGET = r"lib/store/basket-replace.ts"
OUT    = os.path.join(os.environ.get("USERPROFILE", "."), "Downloads", "basket-replace.ts")


def main():
    apply = "--apply" in sys.argv

    if not os.path.exists(TARGET):
        print(f"REFUSED: {TARGET} not found in current directory")
        sys.exit(1)

    with open(TARGET, "r", newline="") as f:
        content = f.read()

    nl = "\r\n" if "\r\n" in content else "\n"
    print(f"detected line ending: {'CRLF' if nl == chr(13)+chr(10) else 'LF'}")

    anchor = "function livePool(series: ReplaceableSeries): string[] {" + nl + \
             "  if (series === 'portraits') {" + nl + \
             "    return EFFECTS.filter(isOfferable).map((e) => e.id)" + nl + \
             "  }"

    replacement = (
        "// 'beaded' excluded explicitly: effect-registry.ts still marks it"
        + nl +
        "// body:'live' but it does not exist in portraits-bodies.ts (confirmed"
        + nl +
        "// 27 Aug — 62 real bodies, matching the 08-23 carryover's own count)."
        + nl +
        "// The registry is otherwise correct; this is the one known drift."
        + nl +
        "const KNOWN_REGISTRY_DRIFT = new Set(['beaded'])"
        + nl + nl +
        "function livePool(series: ReplaceableSeries): string[] {"
        + nl +
        "  if (series === 'portraits') {"
        + nl +
        "    return EFFECTS.filter(isOfferable)"
        + nl +
        "      .map((e) => e.id)"
        + nl +
        "      .filter((id) => !KNOWN_REGISTRY_DRIFT.has(id))"
        + nl +
        "  }"
    )

    count = content.count(anchor)
    if count != 1:
        print(f"REFUSED: anchor found {count} times, need exactly 1")
        sys.exit(1)

    new_content = content.replace(anchor, replacement, 1)

    if "KNOWN_REGISTRY_DRIFT" not in new_content:
        print("REFUSED: MUST_APPEAR missing after edit")
        sys.exit(1)
    if "beaded" in content and "'beaded'" not in new_content.split("KNOWN_REGISTRY_DRIFT")[0]:
        pass  # sanity check only, not a hard gate

    if not apply:
        print("DRY RUN OK — anchor matched exactly once, verification would pass.")
        print("Re-run with --apply to write to Downloads.")
        sys.exit(0)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", newline="") as f:
        f.write(new_content)
    print(f"WROTE: {OUT}")


if __name__ == "__main__":
    main()
