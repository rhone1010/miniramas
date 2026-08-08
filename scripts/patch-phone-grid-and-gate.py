#!/usr/bin/env python3
"""
TWO COLUMNS, AND THE GATE GOES FIRST

**1 · The floor was still one card a row.**

Every card carries

    .floor > *{ grid-column: auto / span 2 }

because the desktop floor is eight columns wide and a card occupies two of
them. Set the grid to two columns and "span 2" becomes the whole width — so
the two-column rule was there and every card was still taking a row to
itself.

The span goes on a phone, and the `[data-count]` rules with it: those place
specific children at specific columns to centre a short row against an
eight-wide grid, which in two columns pushes cards to places nothing asked
for.

**2 · The card titles were 16px.**

    --card-type: clamp(16px, 1vw, 26px)

At 390px, 1vw is 3.9px, so the clamp floors at 16. Cormorant Garamond sets
about a third smaller than a sans at the same size, so a 16px title reads
like 11px of sans — under the floor this build has held to everywhere else.
20px on a phone, and the count follows it at .72em.

**3 · The step advanced before the photograph had cleared.**

The flow watched `data-state` on the Curator card, which is set the moment a
file is read — before the gate has answered and before the age gate has run.
So a photograph that was going to be refused took the person to the worlds
first, and the refusal arrived on top of a screen they should never have
reached.

It now waits for the intake modal. If a fault or the age gate is up, the
advance is held until it closes, and then only proceeds if the photograph is
still there — because the usual way to close that modal is to choose a
different photograph, and that is not a reason to move on.

Usage:  python scripts\\patch-phone-grid-and-gate.py public\\portraits.html
"""
import io
import sys

ANCHOR = """  /* ---- anything a thumb has to hit ----------------------------------- */
  .mc-act, .ps-act, .ac-act, .btn{ min-height:44px }
}"""

CSS = """  /* ---- two columns, actually ----------------------------------------- */
  /* A card spans two of the desktop's eight columns. In a two-column grid
     that is the whole width, which is why the two-column rule was already
     there and every card still took a row to itself. */
  .floor > *{
    grid-column:auto !important;
    grid-row:auto !important;
    justify-self:stretch !important;
  }

  /* Titles at a size a phone can read. clamp(16px, 1vw, 26px) floors at 16
     below 1600px, and Garamond sets about a third smaller than a sans — so
     16px reads like 11px of sans, under the floor held everywhere else. */
  :root{ --card-type:20px }
  .floor{ font-size:20px }

  /* ---- anything a thumb has to hit ----------------------------------- */
  .mc-act, .ps-act, .ac-act, .btn{ min-height:44px }
}"""

# ── the advance waits for the gate ────────────────────────────────────
OLD_JS = """    /* The photograph landing is what advances it. */
    var wasEmpty = !hasPhoto();
    new MutationObserver(function(){
      if (!onPhone()) return;
      var empty = !hasPhoto();
      if (wasEmpty && !empty) step('work');
      if (!wasEmpty && empty) step('upload');
      wasEmpty = empty;
    }).observe(card, { attributes:true, attributeFilter:['data-state'] });"""

NEW_JS = """    /* Anything that has something to say about the photograph says it in
       this one modal — the four intake faults and the age gate both. */
    function modalUp(){
      var m = document.querySelector('.m-scrim.is-open');
      return !!m;
    }

    /* The photograph landing is what advances it — but not while there is
       something to answer first. `data-state` is set as soon as the file
       is read, which is before the gate has replied, so advancing on it
       alone took a person to the worlds and then refused them there. */
    function advanceWhenClear(){
      if (!modalUp()){ step('work'); return; }
      var watch = new MutationObserver(function(){
        if (modalUp()) return;
        watch.disconnect();
        /* The usual way out of that modal is to choose a different
           photograph. Advancing then would be moving on from a decision
           the person has just undone. */
        if (hasPhoto()) step('work');
      });
      watch.observe(document.body, {
        attributes:true, subtree:true, attributeFilter:['class']
      });
    }

    var wasEmpty = !hasPhoto();
    new MutationObserver(function(){
      if (!onPhone()) return;
      var empty = !hasPhoto();
      if (wasEmpty && !empty) advanceWhenClear();
      if (!wasEmpty && empty) step('upload');
      wasEmpty = empty;
    }).observe(card, { attributes:true, attributeFilter:['data-state'] });"""


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

    if "advanceWhenClear" in doc:
        raise SystemExit("Already applied. Nothing written.")

    doc = swap(doc, "the 44px rule", ANCHOR, CSS)
    doc = swap(doc, "the step observer", OLD_JS, NEW_JS)

    # gates
    if "grid-column:auto !important" not in doc:
        raise SystemExit("FAIL: the span was not cleared")
    if "--card-type:20px" not in doc:
        raise SystemExit("FAIL: the card type was not raised")
    if doc.count("advanceWhenClear") != 2:
        raise SystemExit("FAIL: expected the function and its caller, found %d"
                         % doc.count("advanceWhenClear"))
    if "'.m-scrim.is-open'" not in doc:
        raise SystemExit("FAIL: nothing checks whether a modal is up")
    # the desktop grid must be intact
    if "grid-column:auto / span 2;" not in doc:
        raise SystemExit("FAIL: the desktop span was removed")
    if '.floor[data-count="8"] > :nth-child(5){ justify-self:start }' not in doc:
        raise SystemExit("FAIL: the desktop row rules were disturbed")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  two cards a row on a phone, titles at 20px")
    print("  the step waits for the gate and the age modal to clear")
    print("  choosing a different photograph does not advance")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-phone-grid-and-gate.py <file.html>")
    main(sys.argv[1])
