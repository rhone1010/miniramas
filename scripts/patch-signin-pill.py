#!/usr/bin/env python3
"""
Signed out, the masthead showed nothing at all — no balance, and no way in.
The old behaviour was deliberate (a zero over an unknown balance tells
someone with sixty credits they have none) and is kept: an unreadable
balance still shows nothing.

What changes is only the no-session case. It now reads "Sign in" and opens
the sign-in panel that has been built and unreachable since r02.

Usage:  python patch-signin-pill.py public\\portraits.html
"""
import io
import sys

OLD_PAINT = """    if (!ME || CREDITS == null){ mhCreditsBtn.hidden = true; return; }
    mhCreditsBtn.hidden = false;
    mhCreditsCount.textContent = String(CREDITS);"""

NEW_PAINT = """    var uSpan = mhCreditsBtn.querySelector('.u');
    /* No session. Not a zero — an invitation. Somebody who lands here
       signed out had no control at all before this, and no way to find
       one. The panel exists; nothing opened it. */
    if (!ME){
      mhCreditsBtn.hidden = false;
      mhCreditsCount.textContent = '';
      if (uSpan) uSpan.textContent = 'Sign in';
      mhCreditsBtn.setAttribute('aria-label', 'Sign in');
      return;
    }
    /* Signed in, but the balance could not be read. Still show nothing
       rather than a zero — the original reasoning holds. */
    if (CREDITS == null){ mhCreditsBtn.hidden = true; return; }
    if (uSpan) uSpan.textContent = 'credits';
    mhCreditsBtn.hidden = false;
    mhCreditsCount.textContent = String(CREDITS);"""

OLD_CLICK = """  if (mhCreditsBtn) mhCreditsBtn.addEventListener('click', function(){
    if (typeof window.__openPaywall === 'function'){"""

NEW_CLICK = """  if (mhCreditsBtn) mhCreditsBtn.addEventListener('click', function(){
    /* Signed out, the pill is the way in, not the way to buy. */
    if (!ME){
      if (typeof openSignin === 'function') openSignin();
      return;
    }
    if (typeof window.__openPaywall === 'function'){"""


def crlf(text):
    """This file is CRLF. A pattern written with bare newlines never matches
    it, and a substitution that silently does nothing is worse than one that
    fails loudly. Both forms are tried."""
    return text.replace("\n", "\r\n")


def swap(doc, name, old, new):
    for variant_old, variant_new in ((old, new), (crlf(old), crlf(new))):
        n = doc.count(variant_old)
        if n == 1:
            return doc.replace(variant_old, variant_new, 1)
        if n > 1:
            raise SystemExit("FAIL: %s matched %d times, expected 1" % (name, n))
    raise SystemExit("FAIL: %s not found in either line ending" % name)


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    doc = swap(doc, "paintCredits", OLD_PAINT, NEW_PAINT)
    doc = swap(doc, "click handler", OLD_CLICK, NEW_CLICK)

    # gates
    if doc.count("if (typeof openSignin === 'function') openSignin();") != 1:
        raise SystemExit("FAIL: sign-in call not written exactly once")
    if "uSpan.textContent = 'Sign in'" not in doc:
        raise SystemExit("FAIL: Sign in label missing")
    # the deliberate no-zero rule must survive
    if "if (CREDITS == null){ mhCreditsBtn.hidden = true; return; }" not in doc:
        raise SystemExit("FAIL: unreadable-balance rule was lost")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  signed out  -> pill reads 'Sign in' and opens the panel")
    print("  balance unreadable -> pill stays hidden, as before")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-signin-pill.py <file.html>")
    main(sys.argv[1])
