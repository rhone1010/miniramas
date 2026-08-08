#!/usr/bin/env python3
"""
A PRESS, NOT A JUMP · AND THE GRID COMES BACK

**1 & 2 · The photograph step advanced by itself.**

A file landed and the screen changed. No pause, nothing said, and no way to
look at what had been chosen before moving on — and the most likely thing a
person wants at that moment is to check the photograph, or swap it.

The advance is now a press. When a photograph lands and the gate has
cleared, the Curator says so and a button appears beneath her: **Choose
finishes →**. Beside it, the change control that was always there. Nothing
moves until one of them is pressed.

The automatic advance is not softened or delayed. It is removed. A delay
would still be a jump, only later.

**3 · The collection grid was off the side of the screen.**

    .mc-latest{ display:grid; grid-template-columns:500px minmax(0,1fr) }

That rule sits further down the file than the phone rules, so on a 390px
screen the featured piece took a 500px first column and the grid column —
every thumbnail — was pushed past the right edge. Not hidden: outside.

That is why closing the full view appeared to do nothing. It worked; there
was simply nothing on screen behind it.

Stated in the last block with the rest of the phone collection rules, where
nothing sits below to disagree.

Usage:  python scripts\\patch-phone-advance.py public\\portraits.html
"""
import io
import sys

# ── 1 · the advance becomes a press ──────────────────────────────────
OLD_ADVANCE = """    var wasEmpty = !hasPhoto();
    new MutationObserver(function(){
      if (!onPhone()) return;
      var empty = !hasPhoto();
      if (wasEmpty && !empty) advanceWhenClear();
      if (!wasEmpty && empty) step('upload');
      wasEmpty = empty;
    }).observe(card, { attributes:true, attributeFilter:['data-state'] });"""

NEW_ADVANCE = """    /* The advance is a press, not a consequence. A photograph landing used
       to change the screen on its own — no pause, nothing said, and no
       chance to look at what had been chosen before moving on. Which is
       exactly the moment a person wants to look at it.

       Removed rather than delayed: a delayed jump is still a jump. */
    var goOn = document.getElementById('lgGoOn');
    if (goOn) goOn.addEventListener('click', function(){
      if (hasPhoto()) advanceWhenClear();
    });

    var wasEmpty = !hasPhoto();
    new MutationObserver(function(){
      if (!onPhone()) return;
      var empty = !hasPhoto();
      /* Losing the photograph still returns on its own — there is nothing
         to stay for and nothing to decide. */
      if (!wasEmpty && empty) step('upload');
      wasEmpty = empty;
    }).observe(card, { attributes:true, attributeFilter:['data-state'] });"""

# ── the button, beside the one that changes the photograph ───────────
OLD_MARKUP = """            <button class="cur-change" id="curChange" type="button">Use a different photograph</button>"""

NEW_MARKUP = """            <button class="cur-change" id="curChange" type="button">Use a different photograph</button>
            <!-- Phones only, hidden by default in CSS. The way on from the
                 photograph, so that leaving this step is something a person
                 does rather than something that happens to them. -->
            <button class="lg-go-on" id="lgGoOn" type="button">Choose finishes &rarr;</button>"""

CSS = """
/* ---- the way on from the photograph · phones ------------------------- */
.lg-go-on{ display:none }
@media (max-width:767px){
  /* Only once there is a photograph to go on from. */
  .cur:not([data-state="empty"]) .lg-go-on{
    display:block; width:100%; margin:10px 0 0;
    min-height:48px; padding:.6em 1em;
    border:0; border-radius:8px; cursor:pointer;
    background:var(--oxblood, #7d4242); color:#f6f1e7;
    font-family:var(--serif); font-style:italic; font-size:21px;
  }
  .cur-change{ width:100% }

  /* ---- the grid was off the side of the screen ----------------------- */
  /* .mc-latest is a grid with a 500px first column, declared further down
     the file than the phone rules. At 390px the featured piece took the
     500 and the grid column — every thumbnail — sat past the right edge.
     Not hidden. Outside. */
  .mc-latest{
    display:flex !important;
    flex-direction:column !important;
    grid-template-columns:none !important;
    gap:12px;
  }
  .mc-col{ order:1; width:100% }
  .mc-feat{ order:2 }
}
"""


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

    if "lgGoOn" in doc:
        raise SystemExit("Already applied. Nothing written.")

    nl = "\r\n" if "\r\n" in doc[:2000] else "\n"

    doc = swap(doc, "the auto-advance", OLD_ADVANCE, NEW_ADVANCE)
    doc = swap(doc, "the change control", OLD_MARKUP, NEW_MARKUP)

    # the CSS goes last, with the rest of the phone collection rules
    last = doc.rfind("</style>")
    if last < 0:
        raise SystemExit("FAIL: no stylesheet found. Nothing written.")
    css = CSS if nl == "\n" else crlf(CSS)
    doc = doc[:last] + css + doc[last:]

    # gates
    if doc.count('id="lgGoOn"') != 1:
        raise SystemExit("FAIL: the advance button was not written once")
    if "if (wasEmpty && !empty) advanceWhenClear();" in doc:
        raise SystemExit("FAIL: the automatic advance survives")
    if "display:flex !important" not in doc:
        raise SystemExit("FAIL: the collection layout was not corrected")
    if "advanceWhenClear" not in doc:
        raise SystemExit("FAIL: the gate check was lost")
    # losing the photograph must still return on its own
    if "if (!wasEmpty && empty) step('upload');" not in doc:
        raise SystemExit("FAIL: the return to upload was lost")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  the photograph step waits for a press")
    print("  'Choose finishes' beside 'Use a different photograph'")
    print("  the collection grid is back on the screen")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-phone-advance.py <file.html>")
    main(sys.argv[1])
