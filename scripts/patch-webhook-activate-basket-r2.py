#!/usr/bin/env python3
# scripts/patch-webhook-activate-basket-r2.py
#
# r2: r1 assumed LF line endings and the anchor never matched — this file
# is CRLF (same trap CENG-23 already hit once in portraits-bodies.ts).
# Fix: detect the file's actual line ending and build anchors with it,
# rather than hardcoding one.
#
# Dry-run by default. --apply writes to Downloads, never the repo.
#
# CENG-45 - 27 August 2026

import sys
import os

TARGET = r"app/api/v1/webhooks/stripe/route.ts"
OUT    = os.path.join(os.environ.get("USERPROFILE", "."), "Downloads", "route.ts")


def main():
    apply = "--apply" in sys.argv

    if not os.path.exists(TARGET):
        print(f"REFUSED: {TARGET} not found in current directory")
        sys.exit(1)

    with open(TARGET, "r", newline="") as f:
        content = f.read()

    nl = "\r\n" if "\r\n" in content else "\n"
    print(f"detected line ending: {'CRLF' if nl == chr(13)+chr(10) else 'LF'}")

    import_anchor = "import { supabaseAdmin }                     from '@/lib/supabase'"
    import_new = (
        import_anchor
        + nl
        + "import { activateBasket }                    from '@/lib/store/basket-checkout'"
    )

    call_anchor = nl.join([
        "      await confirmPurchase({",
        "        stripeSessionId: session.id,",
        "        stripeChargeId:  chargeId,",
        "      })",
        "      return",
        "    }",
    ])

    call_new = nl.join([
        "      const { purchaseId } = await confirmPurchase({",
        "        stripeSessionId: session.id,",
        "        stripeChargeId:  chargeId,",
        "      })",
        "      await activateBasket(purchaseId).catch((err) => {",
        "        console.error('[stripe-webhook] activateBasket failed', purchaseId, err)",
        "      })",
        "      return",
        "    }",
    ])

    import_count = content.count(import_anchor)
    call_count = content.count(call_anchor)
    if import_count != 1:
        print(f"REFUSED: import anchor found {import_count} times, need exactly 1")
        sys.exit(1)
    if call_count != 1:
        print(f"REFUSED: call anchor found {call_count} times, need exactly 1")
        sys.exit(1)

    new_content = content.replace(import_anchor, import_new, 1)
    new_content = new_content.replace(call_anchor, call_new, 1)

    must_appear = [
        "import { activateBasket }                    from '@/lib/store/basket-checkout'",
        "await activateBasket(purchaseId).catch((err) => {",
    ]
    must_vanish = [call_anchor]
    for s in must_appear:
        if s not in new_content:
            print(f"REFUSED: MUST_APPEAR missing after edit: {s[:60]}")
            sys.exit(1)
    for s in must_vanish:
        if s in new_content:
            print(f"REFUSED: MUST_VANISH still present after edit: {s[:60]}")
            sys.exit(1)

    if not apply:
        print("DRY RUN OK — anchors matched exactly once, verification would pass.")
        print("Re-run with --apply to write to Downloads.")
        sys.exit(0)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", newline="") as f:
        f.write(new_content)
    print(f"WROTE: {OUT}")


if __name__ == "__main__":
    main()
