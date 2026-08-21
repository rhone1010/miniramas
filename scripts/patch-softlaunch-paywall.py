#!/usr/bin/env python3
"""
patch-softlaunch-paywall.py - no buying until the credits are gone.

  python scripts\\patch-softlaunch-paywall.py public\\portraits.html
  python scripts\\patch-softlaunch-paywall.py public\\portraits.html --apply

Dry run by default. CRLF file.

THE RULING. Soft launch guests arrive with a grant. They should not be sold
to until they have used it. Somebody handed eighty credits and immediately
shown a price list has been given a gift and a bill in the same breath.

THREE DOORS LEAD TO THE BUY PANEL, and they are already distinguishable:

  masthead credits pill   reason 'browse', needed 0
  Account > Buy credits   reason 'browse', needed 0
  a craft that is short   the real reason, needed > 0

So the rule is exact: while soft launch is on, the two BROWSE doors open
only at a zero balance. The SHORTFALL door is never touched - running out
mid-craft is the moment buying is the helpful answer, and their pieces are
being held while they decide.

SELF-REGULATING. The gate reads the balance rather than a date or a list of
guests, so nothing has to be switched at the moment somebody spends their
last credit. Turning SOFT_LAUNCH to false at the end restores the shop with
one edit and no other change.

AN UNKNOWN BALANCE COUNTS AS NOT EXHAUSTED. If the balance could not be
read, the browse doors stay shut during soft launch. Nobody is stranded by
that: a craft that is short still raises the panel with the real figure.

WHAT IS NOT DONE HERE. The pill still reads out the balance - it is the
only place a guest can see it, and hiding it would be worse than hiding the
price list. It simply stops being a way to buy.
"""

import sys
import os

EDITS = [
    (
        "the flag and the rule",
        "  var CREDITS = null;\r\n",
        "  var CREDITS = null;\r\n"
        "\r\n"
        "  /* ---- SOFT LAUNCH -------------------------------------------------\r\n"
        "     Guests arrive with a grant. Until they have spent it there is no\r\n"
        "     price list anywhere they can reach on purpose - being handed a\r\n"
        "     gift and a bill in the same breath is a poor welcome.\r\n"
        "\r\n"
        "     SET THIS TO false TO REOPEN THE SHOP. Nothing else changes. */\r\n"
        "  var SOFT_LAUNCH = true;\r\n"
        "\r\n"
        "  /* Is buying offered as something to go and do? Distinct from being\r\n"
        "     offered as the answer to a craft that cannot be paid for - that\r\n"
        "     one is always available and is not this function's business.\r\n"
        "\r\n"
        "     A balance of null means it could not be read. During soft launch\r\n"
        "     that counts as not exhausted and the doors stay shut; a short\r\n"
        "     craft still raises the panel with the real figure, so nobody is\r\n"
        "     stranded by an unread balance. */\r\n"
        "  function buyingOffered(){\r\n"
        "    if (!SOFT_LAUNCH) return true;\r\n"
        "    return (typeof CREDITS === 'number' && CREDITS <= 0);\r\n"
        "  }\r\n"
        "  window.__buyingOffered = buyingOffered;\r\n",
    ),
    (
        "the gate",
        "  window.__openPaywall = function(short){ openBuy(short); };\r\n",
        "  window.__openPaywall = function(short){\r\n"
        "    /* THE SHORTFALL ALWAYS GETS THROUGH. `needed` is what separates a\r\n"
        "       craft that cannot be paid for from somebody browsing prices, and\r\n"
        "       only the second is closed during soft launch. */\r\n"
        "    var browsing = !short || !short.needed;\r\n"
        "    if (browsing && typeof window.__buyingOffered === 'function'\r\n"
        "        && !window.__buyingOffered()){\r\n"
        "      return;\r\n"
        "    }\r\n"
        "    openBuy(short);\r\n"
        "  };\r\n",
    ),
    (
        "the pill stops saying buy",
        "    mhCreditsBtn.setAttribute('aria-label',\r\n"
        "      CREDITS + (CREDITS === 1 ? ' credit' : ' credits') + ' \\u00b7 buy more');\r\n",
        "    /* It reads out the balance either way - that is the only place a\r\n"
        "       guest can see it. It just stops claiming to be a way to buy\r\n"
        "       while there is nothing to buy yet. */\r\n"
        "    mhCreditsBtn.setAttribute('aria-label',\r\n"
        "      CREDITS + (CREDITS === 1 ? ' credit' : ' credits') +\r\n"
        "      (buyingOffered() ? ' \\u00b7 buy more' : ''));\r\n",
    ),
    (
        "Account hides the button",
        "      '<div class=\"ac-acts\">' +\r\n"
        "        '<button class=\"ac-buy\" id=\"acBuy\" type=\"button\">Buy credits</button>' +\r\n"
        "      '</div>' +\r\n",
        "      /* Omitted entirely rather than disabled during soft launch. A\r\n"
        "         greyed-out Buy credits still advertises a price list and\r\n"
        "         invites a click that does nothing. */\r\n"
        "      '<div class=\"ac-acts\">' +\r\n"
        "        ((typeof window.__buyingOffered !== 'function' || window.__buyingOffered())\r\n"
        "          ? '<button class=\"ac-buy\" id=\"acBuy\" type=\"button\">Buy credits</button>'\r\n"
        "          : '') +\r\n"
        "      '</div>' +\r\n",
    ),
]

MARKER = "var SOFT_LAUNCH"


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

    print("patch-softlaunch-paywall")
    print("  target   " + path)
    print("  mode     " + ("APPLY" if apply_it else "dry run - nothing will be written"))

    if MARKER in original:
        print("  SKIP     already gated")
        return 0

    text = original
    failed = 0
    for name, anchor, new in EDITS:
        n = text.count(anchor)
        if n != 1:
            print("  FAIL     " + name + " - anchor matches " + str(n) + " times")
            failed += 1
            continue
        text = text.replace(anchor, new, 1)
        print("  OK       " + name)

    if failed:
        print("  REFUSED  " + str(failed) + " anchor problem(s). Nothing written.")
        return 1

    # pre-write assertions
    assert text.count("var SOFT_LAUNCH = true;") == 1, "flag missing or duplicated"
    assert text.count("function buyingOffered()") == 1, "rule missing or duplicated"
    assert text.count("window.__buyingOffered = buyingOffered;") == 1, "rule not exported"
    assert text.count("openBuy(short);") == 1, "the gate did not replace the direct call"
    # THE SHORTFALL DOOR MUST SURVIVE UNTOUCHED
    assert text.count("reason: data.reason") == 1, "the shortfall call was changed"
    assert "window.__openPaywall({ needed: needed, balance: data.balance || 0, reason: data.reason });" in text, \
        "the shortfall door was disturbed"
    # both browse doors still exist and still route through the hook
    assert text.count("reason: 'browse'") == 2, "a browse door was removed or added"
    assert text.count('id="acBuy"') == 1, "the account button markup is wrong"
    assert text.count("function openBuy(short)") == 1, "openBuy disturbed"
    assert "\r\n" in text, "line endings lost"
    assert len(text) > len(original), "file did not grow"

    if not apply_it:
        print("  Would write " + str(len(text) - len(original)) + " more bytes. Re-run with --apply.")
        return 0

    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("  WROTE    " + path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
