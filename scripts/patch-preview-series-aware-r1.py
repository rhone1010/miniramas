#!/usr/bin/env python3
# scripts/patch-preview-series-aware-r1.py
#
# storeCleanOriginal hardcodes 'portraits/${previewId}.png'. Rich's
# ruling 2026-08-27: Halloween operates the same as Portraits for now.
# Fix: take series as a real parameter, default to 'portraits' for
# every EXISTING caller so nothing already live changes behavior.
#
# Dry-run by default. --apply writes to Downloads, never the repo.
#
# CENG-45 - 27 August 2026

import sys
import os

TARGET = r"lib/store/preview.ts"
OUT    = os.path.join(os.environ.get("USERPROFILE", "."), "Downloads", "preview.ts")


def main():
    apply = "--apply" in sys.argv

    if not os.path.exists(TARGET):
        print(f"REFUSED: {TARGET} not found in current directory")
        sys.exit(1)

    with open(TARGET, "r", newline="") as f:
        content = f.read()

    nl = "\r\n" if "\r\n" in content else "\n"
    print(f"detected line ending: {'CRLF' if nl == chr(13)+chr(10) else 'LF'}")

    sig_anchor = nl.join([
        "export async function storeCleanOriginal(",
        "  sb: SupabaseClient,",
        "  previewId: string,",
        "  imageB64: string,",
        "): Promise<string | null> {",
        "  try {",
        "    const path = `portraits/${previewId}.png`",
    ])

    sig_new = nl.join([
        "export async function storeCleanOriginal(",
        "  sb: SupabaseClient,",
        "  previewId: string,",
        "  imageB64: string,",
        "  series: string = 'portraits', // default preserves every existing caller's behavior",
        "): Promise<string | null> {",
        "  try {",
        "    const path = `${series}/${previewId}.png`",
    ])

    count = content.count(sig_anchor)
    if count != 1:
        print(f"REFUSED: signature anchor found {count} times, need exactly 1")
        sys.exit(1)

    new_content = content.replace(sig_anchor, sig_new, 1)

    if "series: string = 'portraits'" not in new_content:
        print("REFUSED: MUST_APPEAR missing after edit")
        sys.exit(1)
    if "`portraits/${previewId}.png`" in new_content:
        print("REFUSED: MUST_VANISH still present after edit")
        sys.exit(1)

    if not apply:
        print("DRY RUN OK — anchor matched exactly once, verification would pass.")
        print("Re-run with --apply to write to Downloads.")
        print()
        print("NOTE: recordPreview() already accepts an optional `series` param")
        print("(defaults 'portraits') — this patch only fixes storeCleanOriginal,")
        print("which was the one still hardcoded. Whoever calls storeCleanOriginal")
        print("for a Halloween preview needs to pass series='halloween' explicitly —")
        print("that caller wasn't in the files read this session, so it's not")
        print("patched here. Find it with:")
        print("  Select-String -Path app -Pattern 'storeCleanOriginal' -Recurse")
        sys.exit(0)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", newline="") as f:
        f.write(new_content)
    print(f"WROTE: {OUT}")


if __name__ == "__main__":
    main()
