#!/usr/bin/env python3
"""
WHO IS THIS

There has been no way to tell, from the workshop, whether you are signed in.
A signed-out visitor and a signed-in one saw the same masthead, and Rich has
crafted pieces without knowing whose collection they were landing in. That is
not a cosmetic gap — a piece saved to the wrong owner_key is a piece its owner
cannot find.

The pill now carries the name. Signed in it reads the part of the email before
the @; signed out it reads 'Sign in' and opens the panel, which the previous
patch wired. One control, three states, never ambiguous.

WIDTH
  The masthead was already tight: at 1320px the nav gap drops to 11px and the
  word 'credits' is hidden to keep the number. Adding a name would have been
  the third thing competing for that row.

  Rich's ruling, 2026-08-07: drop 'Crafted' from 'Crafted Portraits' at 1320
  rather than shrink anything further. The Series is 'Portraits'; the word
  'Crafted' is doing brand work that the rest of the surface already does, and
  it is the cheapest thing on the row to lose.

Usage:  python scripts\\patch-identity-pill.py public\\portraits.html
"""
import io
import sys

# ── 1 · the name element, beside the count ────────────────────────────────
OLD_MARKUP = """    <button class="mh-credits" id="mhCreditsBtn" hidden>
      <span class="v" id="mhCreditsCount">0</span><span class="u">credits</span>
    </button>"""

NEW_MARKUP = """    <button class="mh-credits" id="mhCreditsBtn" hidden>
      <span class="who" id="mhWho" hidden></span>
      <span class="v" id="mhCreditsCount">0</span><span class="u">credits</span>
    </button>"""

# ── 2 · styling for it, and the 1320 rule ─────────────────────────────────
OLD_CSS = """@media (max-width:1320px){
  .mh-nav{ gap:11px; font-size:.8em }"""

NEW_CSS = """/* The name, quietly, before the number. Brass rather than gold so the
   balance stays the thing the eye lands on. */
.mh-credits .who{
  max-width:11ch; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  color:var(--vellum-300); font-weight:400;
}
.mh-credits .who:after{
  content:'\\00b7'; padding:0 .1em 0 .45em; opacity:.55;
}

@media (max-width:1320px){
  .mh-nav{ gap:11px; font-size:.8em }
  /* Ruled 2026-08-07: 'Crafted' goes before anything else shrinks. The
     Series is Portraits; the surface carries the rest of the brand. */
  #mhSeriesLabel .mh-crafted{ display:none }
  .mh-credits .who{ max-width:8ch }"""

# ── 3 · the word 'Crafted' becomes something CSS can reach ────────────────
OLD_LABEL = """        <span id="mhSeriesLabel">Crafted Portraits</span>"""
NEW_LABEL = """        <span id="mhSeriesLabel"><span class="mh-crafted">Crafted </span>Portraits</span>"""

# ── 4 · paint it ──────────────────────────────────────────────────────────
OLD_PAINT = """    var uSpan = mhCreditsBtn.querySelector('.u');"""

NEW_PAINT = """    var uSpan = mhCreditsBtn.querySelector('.u');
    var whoSpan = mhCreditsBtn.querySelector('.who');
    /* The local part of the address, which is what people recognise as
       their own name. The full address is too long for this row and the
       domain tells nobody anything. */
    if (whoSpan){
      var em = (ME && ME.email) ? String(ME.email) : '';
      var local = em.indexOf('@') > 0 ? em.slice(0, em.indexOf('@')) : em;
      whoSpan.textContent = local;
      whoSpan.hidden = !local;
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

    doc = swap(doc, "credits markup", OLD_MARKUP, NEW_MARKUP)
    doc = swap(doc, "1320 media query", OLD_CSS, NEW_CSS)
    doc = swap(doc, "series label", OLD_LABEL, NEW_LABEL)
    doc = swap(doc, "paintCredits", OLD_PAINT, NEW_PAINT)

    # gates
    if doc.count('id="mhWho"') != 1:
        raise SystemExit("FAIL: name element not written exactly once")
    if doc.count("mh-crafted") != 2:
        raise SystemExit("FAIL: expected the Crafted span and its rule, found %d"
                         % doc.count("mh-crafted"))
    if "uSpan.textContent = 'Sign in'" not in doc:
        raise SystemExit("FAIL: the signed-out state was lost")
    if "if (CREDITS == null){ mhCreditsBtn.hidden = true; return; }" not in doc:
        raise SystemExit("FAIL: the unreadable-balance rule was lost")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  signed in  -> pill reads the name, then the balance")
    print("  signed out -> pill reads 'Sign in', as before")
    print("  at 1320px  -> 'Crafted' drops, 'Portraits' stays")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-identity-pill.py <file.html>")
    main(sys.argv[1])
