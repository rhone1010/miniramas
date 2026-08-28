#!/usr/bin/env python3
# scripts/patch-webhook-activate-portfolio-r1.py
# Swaps activateBasket for activatePortfolio, new import path.
import sys, os

TARGET = r"app/api/v1/webhooks/stripe/route.ts"
OUT    = os.path.join(os.environ.get("USERPROFILE", "."), "Downloads", "route.ts")

def main():
    apply = "--apply" in sys.argv
    if not os.path.exists(TARGET):
        print(f"REFUSED: {TARGET} not found"); sys.exit(1)
    with open(TARGET, "r", newline="", encoding="utf-8") as f:
        content = f.read()
    nl = "\r\n" if "\r\n" in content else "\n"
    print(f"detected line ending: {'CRLF' if nl == chr(13)+chr(10) else 'LF'}")

    old_import = "import { activateBasket }                    from '@/lib/store/basket-checkout'"
    new_import = "import { activatePortfolio }                 from '@/lib/store/portfolio-checkout'"
    old_call_start = "await activateBasket(purchaseId)"
    new_call_start = "await activatePortfolio(purchaseId)"

    if content.count(old_import) != 1:
        print(f"REFUSED: import anchor found {content.count(old_import)} times, need 1"); sys.exit(1)
    if content.count(old_call_start) != 1:
        print(f"REFUSED: call anchor found {content.count(old_call_start)} times, need 1"); sys.exit(1)

    new_content = content.replace(old_import, new_import, 1)
    new_content = new_content.replace(old_call_start, new_call_start, 1)
    new_content = new_content.replace(
        "console.error('[stripe-webhook] activateBasket failed'",
        "console.error('[stripe-webhook] activatePortfolio failed'", 1,
    )

    if "activatePortfolio" not in new_content:
        print("REFUSED: MUST_APPEAR missing"); sys.exit(1)
    if "activateBasket" in new_content:
        print("REFUSED: MUST_VANISH still present"); sys.exit(1)

    if not apply:
        print("DRY RUN OK"); sys.exit(0)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        f.write(new_content)
    print(f"WROTE: {OUT}")

if __name__ == "__main__":
    main()
