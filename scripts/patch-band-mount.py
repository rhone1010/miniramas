#!/usr/bin/env python3
"""
THE BAND NEVER MOUNTED

Stage two put its wiring at the showPrintShop export, around line 8868, and
its markup before </body>, around line 9669. The script therefore ran eight
hundred lines before the element it was looking for existed, found nothing,
and returned on its own guard. Silently, which is the worst way to fail:
the patch reported success, the file contained everything, and the phone
showed no band at all.

The fix is to wait for the document. Everything else in the block is
unchanged.

Why the markup is not simply moved up instead: it belongs at the end of the
body, above the band it has to sit over, and moving it into the middle of
the workshop's markup would put a fixed overlay inside a stacking context it
has no business in.

Usage:  python scripts\\patch-band-mount.py public\\portraits.html
"""
import io
import sys

OLD = """  (function(){
    var band = document.getElementById('lgBand');
    if (!band) return;
    band.hidden = false;"""

NEW = """  /* Deferred, because this sits ~800 lines above its own markup and the
     first run found nothing. readyState covers both cases: still parsing,
     so wait; already done, so go now. */
  function lgBandSetup(){
    var band = document.getElementById('lgBand');
    if (!band) return;
    band.hidden = false;"""

OLD_TAIL = """    document.addEventListener('click', function(){ setTimeout(paintBand, 60); });
    paintBand();
  })();"""

NEW_TAIL = """    document.addEventListener('click', function(){ setTimeout(paintBand, 60); });
    paintBand();
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', lgBandSetup);
  } else {
    lgBandSetup();
  }"""


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

    if "lgBandSetup" in doc:
        raise SystemExit("Already applied. Nothing written.")

    doc = swap(doc, "the band IIFE head", OLD, NEW)
    doc = swap(doc, "the band IIFE tail", OLD_TAIL, NEW_TAIL)

    if doc.count("lgBandSetup") != 3:
        raise SystemExit("FAIL: expected the function and both callers, found %d"
                         % doc.count("lgBandSetup"))
    if 'id="lgBand"' not in doc:
        raise SystemExit("FAIL: the band markup is missing")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  the band now waits for its own markup before mounting")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-band-mount.py <file.html>")
    main(sys.argv[1])
