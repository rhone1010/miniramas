#!/usr/bin/env python3
"""
THE WORKSHOP FLOOR ON A PHONE

Three faults, all from a grid built for a canvas.

**1 · The floor is eight columns by two rows, always.**

    grid-template-columns: repeat(8, minmax(0,1fr));
    grid-template-rows:    repeat(2, minmax(0,1fr));

Sixteen cells across whatever width it is given. On a phone each card gets
about 45px, so the names break to three lines — "Driftwood / & Resin",
"Lichen / Granite", "Sandstor…" — and the Curator's Pick card compresses to
"rest of / this / room" over five lines.

It becomes two columns and lets the rows grow, so a row and a bit shows and
the rest is a scroll. The peek is deliberate: Rich ruled against hiding the
second half behind a button, and a visible top edge says there is more
without spending a tap or fighting the vertical scroll with a sideways one.

**2 · The Men/Women toggle sits on top of the crumb.**

`.agetog` is absolutely positioned at the centre of `.crumb`, which is fine
at 1920 where the crumb is a short label on the left. At 390 the crumb fills
the row and the toggle lands on top of it — "All e**Men**ects" over "The
**Women** World".

It comes out of the absolute flow on a phone and sits on its own line under
the crumb, full width, split in two.

**3 · The Curator's line runs off the end.**

    "Here are The Living World finishes. Grown rather than made.
     — C. Suggest seven finishes"

The band takes the whole text content of her letter, which includes her
signature and the label of the button beneath it. The signature was already
stripped; the button was not, because it is a sibling rather than part of
the letter. Both go now.

Usage:  python scripts\\patch-phone-floor.py public\\portraits.html
"""
import io
import sys

ANCHOR = """  /* ---- anything a thumb has to hit ----------------------------------- */
  .mc-act, .ps-act, .ac-act, .btn{ min-height:44px }
}"""

CSS = """  /* ---- the floor ----------------------------------------------------- */
  /* Eight columns by two rows is sixteen cells, and at 390px that is 45px
     a card — narrow enough that "Driftwood & Resin" breaks to three lines
     and the Curator's Pick compresses to five. Two columns, rows sized by
     content, and the floor scrolls.

     A row and a bit shows at rest. Ruled 2026-08-08: a peek says there is
     more without spending a tap, and without a sideways gesture arguing
     with the vertical one. */
  .floor{
    grid-template-columns:repeat(2, minmax(0,1fr));
    grid-template-rows:none;
    grid-auto-rows:minmax(190px, auto);
    height:auto; min-height:0;
    overflow:visible;
    gap:10px; padding:10px;
  }
  /* Those nth-child rules pull the first and last of a row to the edges of
     an eight-wide grid. In two columns they pull cards away from each
     other for no reason. */
  .floor > *{ justify-self:stretch !important }
  /* A card that spanned two of eight now wants to span two of two, which
     is the whole width — which is right for the Curator's Pick and wrong
     for nothing else, since only it spans. */
  .face-floor .fx-card, .floor > *{ min-width:0 }

  /* ---- the crumb and the toggle -------------------------------------- */
  /* The toggle was centred absolutely against the crumb — fine beside a
     short label at 1920, and directly on top of it at 390. */
  .crumb{
    flex-wrap:wrap; gap:8px;
    padding-bottom:8px; min-height:0;
  }
  .agetog{
    position:static; transform:none;
    order:3; width:100%; height:42px;
  }
  .agetog-b{ flex:1; justify-content:center; padding:0 }
  .crumb-here{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }

  /* ---- anything a thumb has to hit ----------------------------------- */
  .mc-act, .ps-act, .ac-act, .btn{ min-height:44px }
}"""

# ── the Curator's line takes the button with it ──────────────────────
OLD_CARRY = """    function carry(){
      if (!say || !src) return;
      var t = (src.textContent || '').replace(/\\s+/g, ' ').trim();
      t = t.replace(/\\u2014\\s*C\\.?\\s*$/, '').trim();
      if (t) say.textContent = t;
    }"""

NEW_CARRY = """    function carry(){
      if (!say || !src) return;
      /* Her letter, and nothing that merely sits near it. The signature
         was already stripped; the button beneath was not, because it is a
         sibling rather than part of the text — so the band read
         "...rather than made.— C. Suggest seven finishes". */
      var clone = src.cloneNode(true);
      [].forEach.call(clone.querySelectorAll('button, a, .sign, .cur-cta'),
        function(el){ el.parentNode.removeChild(el); });
      var t = (clone.textContent || '').replace(/\\s+/g, ' ').trim();
      t = t.replace(/\\u2014\\s*C\\.?.*$/, '').trim();
      if (t) say.textContent = t;
    }"""


def crlf(t):
    return t.replace("\n", "\r\n")


def swap(doc, name, old, new, required=True):
    for o, n_ in ((old, new), (crlf(old), crlf(new))):
        c = doc.count(o)
        if c == 1:
            return doc.replace(o, n_, 1)
        if c > 1:
            raise SystemExit("FAIL: %s matched %d times, expected 1" % (name, c))
    if not required:
        return doc
    raise SystemExit("FAIL: %s not found. Nothing was written." % name)


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    if "grid-auto-rows:minmax(190px, auto)" in doc:
        raise SystemExit("Already applied. Nothing written.")

    doc = swap(doc, "the 44px rule", ANCHOR, CSS)
    doc = swap(doc, "the band's carry()", OLD_CARRY, NEW_CARRY)

    # gates
    if "grid-template-columns:repeat(2, minmax(0,1fr))" not in doc:
        raise SystemExit("FAIL: the floor is still eight wide on a phone")
    if "position:static; transform:none;" not in doc:
        raise SystemExit("FAIL: the toggle still overlays the crumb")
    if "clone.querySelectorAll('button, a, .sign, .cur-cta')" not in doc:
        raise SystemExit("FAIL: the band still takes the button's label")
    # the desktop floor must be intact
    if "grid-template-columns:repeat(8, minmax(0,1fr));" not in doc:
        raise SystemExit("FAIL: the desktop floor was changed")
    if doc.count("@media (max-width:1100px)") != 1:
        raise SystemExit("FAIL: the tablet collapse was disturbed")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  floor is two columns and scrolls; the next row peeks")
    print("  Men/Women moves off the crumb onto its own row")
    print("  the Curator's line no longer swallows the button beneath it")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-phone-floor.py <file.html>")
    main(sys.argv[1])
