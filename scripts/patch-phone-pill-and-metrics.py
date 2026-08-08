#!/usr/bin/env python3
"""
TWO THINGS ON A PHONE

**1 · The pill was a blank box.**

Stage one hid `.mh-credits .u` on small screens, on the reasoning that the
word 'credits' is decoration and the number is the point. That is true when
somebody is signed in. It is wrong when they are not: signed out, `.u` holds
the word 'Sign in' and `.v` holds nothing at all, so hiding `.u` empties the
control entirely. On a phone that is the only route into an account, and it
rendered as an empty box beside the cart.

The unit label is now hidden by a class the painter puts on, not by width.
It comes off whenever the pill is carrying anything other than a balance.

**2 · The metrics readout is a build tool on a customer surface.**

A table of viewport, stage width, gutter, root font-size and room widths,
with a tab that says 'Metrics'. It is how the layout was measured while it
was being built and it has no business on the domain — on a phone it was
visible over the effect tiles.

It is not deleted. It is hidden, and it comes back with ?metrics=1 on the
URL, so the measuring tool still exists for the person who built it and for
nobody else.

Usage:  python scripts\\patch-phone-pill-and-metrics.py public\\portraits.html
"""
import io
import sys

# ── 1 · the unit label ────────────────────────────────────────────────
OLD_CSS = """@media (max-width:767px){
  .mh-credits .u{ display:none }
  .mh-credits .who{ max-width:7ch }
}"""

NEW_CSS = """@media (max-width:767px){
  /* The word 'credits' is decoration next to a number and goes. It is NOT
     decoration when it is the only thing in the control — signed out, this
     span holds 'Sign in' and the number holds nothing, and hiding it left
     an empty box where the way into an account should be. The painter
     marks the pill when it is carrying a balance; only then does the
     label go. */
  .mh-credits.has-balance .u{ display:none }
  .mh-credits .who{ max-width:7ch }
}"""

# ── 2 · the painter marks it ──────────────────────────────────────────
OLD_PAINT = """    if (CREDITS == null){ mhCreditsBtn.hidden = true; return; }
    if (uSpan) uSpan.textContent = 'credits';"""

NEW_PAINT = """    if (CREDITS == null){ mhCreditsBtn.hidden = true; return; }
    if (uSpan) uSpan.textContent = 'credits';
    /* A balance is present, so the unit label may be dropped on a narrow
       screen. The signed-out branch above returns before this and never
       carries the class. */
    mhCreditsBtn.classList.add('has-balance');"""

OLD_OUT = """      whoSpan.textContent = local;
      whoSpan.hidden = !local;
    }"""

NEW_OUT = """      whoSpan.textContent = local;
      whoSpan.hidden = !local;
    }
    if (!ME) mhCreditsBtn.classList.remove('has-balance');"""

# ── 3 · the readout ───────────────────────────────────────────────────
OLD_READOUT = """<div class="readout">
  <button class="readout-tab" id="readoutTab" type="button">Metrics<i></i></button>"""

NEW_READOUT = """<div class="readout" id="readout" hidden>
  <button class="readout-tab" id="readoutTab" type="button">Metrics<i></i></button>"""


def crlf(t):
    return t.replace("\n", "\r\n")


def swap(doc, name, old, new):
    for o, n_ in ((old, new), (crlf(old), crlf(new))):
        c = doc.count(o)
        if c == 1:
            return doc.replace(o, n_, 1)
        if c > 1:
            raise SystemExit("FAIL: %s matched %d times, expected 1" % (name, c))
    raise SystemExit("FAIL: %s not found. Nothing was written." % name)


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    doc = swap(doc, "the 767 unit rule", OLD_CSS, NEW_CSS)
    doc = swap(doc, "paintCredits balance branch", OLD_PAINT, NEW_PAINT)
    doc = swap(doc, "paintCredits signed-out branch", OLD_OUT, NEW_OUT)
    doc = swap(doc, "the readout", OLD_READOUT, NEW_READOUT)

    # the switch that brings it back
    marker = "  window.__showPrintShop = showPrintShop;"
    unhide = marker + """

  /* The readout is the tool the layout was measured with. It stays in the
     file and it stays off, and ?metrics=1 brings it back for whoever is
     doing the measuring. */
  (function(){
    try{
      if (new URLSearchParams(window.location.search).get('metrics') === '1'){
        var r = document.getElementById('readout');
        if (r) r.hidden = false;
      }
    }catch(_){}
  })();
"""
    doc = swap(doc, "the readout switch", marker, unhide)

    # gates
    if doc.count("has-balance") != 3:
        raise SystemExit("FAIL: expected the rule plus two painter lines, found %d"
                         % doc.count("has-balance"))
    if '<div class="readout" id="readout" hidden>' not in doc:
        raise SystemExit("FAIL: the readout is not hidden")
    if doc.count("metrics=1") < 1:
        raise SystemExit("FAIL: no way to bring the readout back")
    if "uSpan.textContent = 'Sign in'" not in doc:
        raise SystemExit("FAIL: the signed-out label was lost")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  signed out  -> the pill reads 'Sign in' on a phone, not an empty box")
    print("  signed in   -> the word 'credits' still drops, the number stays")
    print("  metrics readout hidden; ?metrics=1 brings it back")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-phone-pill-and-metrics.py <file.html>")
    main(sys.argv[1])
