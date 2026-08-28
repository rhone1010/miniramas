#!/usr/bin/env python3
# scripts/patch-baskets-complete-auth-r2.py
#
# r2: r1 crashed mid-write on Windows because Python defaulted to the
# system codepage (cp1252) instead of UTF-8, and choked on an em dash in
# the comment text. Same trap the house rules already named ("pure
# ASCII only - em dashes break PS 5.1 pipelines and py headers") -
# should have followed it the first time. Fixed two ways here: explicit
# encoding='utf-8' on every file handle, AND the inserted text itself is
# now plain ASCII, so this can't recur even if the encoding fix is ever
# dropped by a future edit.
#
# Adds shared-secret auth to app/api/v1/baskets/items/complete/route.ts.
# Rich's call, 27 August: shared secret header.
#
# Env var: BASKET_COMPLETE_SECRET - NOT SET YET. Whoever wires the real
# generation pipeline needs to set this in Vercel (Production + Preview)
# and have the pipeline send it as the x-basket-secret header on every
# completion callback. Until it's set, this route refuses ALL calls with
# 503 (fails closed, matches the Stripe webhook's missing-secret check).
#
# Dry-run by default. --apply writes to Downloads, never the repo.
#
# CENG-45 - 27 August 2026

import sys
import os

TARGET = r"app/api/v1/baskets/items/complete/route.ts"
OUT    = os.path.join(os.environ.get("USERPROFILE", "."), "Downloads", "baskets-items-complete-route.ts")


def main():
    apply = "--apply" in sys.argv

    if not os.path.exists(TARGET):
        print(f"REFUSED: {TARGET} not found in current directory")
        sys.exit(1)

    with open(TARGET, "r", newline="", encoding="utf-8") as f:
        content = f.read()

    nl = "\r\n" if "\r\n" in content else "\n"
    print(f"detected line ending: {'CRLF' if nl == chr(13)+chr(10) else 'LF'}")

    anchor = nl.join([
        "  let body: any",
        "  try {",
        "    body = await req.json()",
        "  } catch {",
        "    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })",
        "  }",
    ])

    replacement = nl.join([
        "  // -- Shared-secret auth --------------------------------------",
        "  // Server-to-server only. Fails closed if the secret isn't",
        "  // configured - matches the Stripe webhook's own posture on a",
        "  // missing STRIPE_WEBHOOK_SECRET.",
        "  const configuredSecret = process.env.BASKET_COMPLETE_SECRET",
        "  if (!configuredSecret) {",
        "    console.error('[baskets/items/complete] BASKET_COMPLETE_SECRET not set')",
        "    return NextResponse.json({ error: 'auth_not_configured' }, { status: 503 })",
        "  }",
        "  const providedSecret = req.headers.get('x-basket-secret')",
        "  if (providedSecret !== configuredSecret) {",
        "    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })",
        "  }",
        "",
        "  let body: any",
        "  try {",
        "    body = await req.json()",
        "  } catch {",
        "    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })",
        "  }",
    ])

    count = content.count(anchor)
    if count != 1:
        print(f"REFUSED: anchor found {count} times, need exactly 1")
        sys.exit(1)

    new_content = content.replace(anchor, replacement, 1)

    must_appear = ["BASKET_COMPLETE_SECRET", "x-basket-secret"]
    for s in must_appear:
        if s not in new_content:
            print(f"REFUSED: MUST_APPEAR missing after edit: {s}")
            sys.exit(1)

    if not apply:
        print("DRY RUN OK - anchor matched exactly once, verification would pass.")
        print("Re-run with --apply to write to Downloads.")
        print()
        print("REMINDER: set BASKET_COMPLETE_SECRET in Vercel (Production + Preview)")
        print("before this route is usable - until then it 503s every call, on purpose.")
        sys.exit(0)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        f.write(new_content)
    print(f"WROTE: {OUT}")


if __name__ == "__main__":
    main()
