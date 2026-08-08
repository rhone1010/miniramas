#!/usr/bin/env python3
"""
PHOTOGRAPH → TITLE → NOTHING ELSE

Rich's note on the phone floor, 2026-08-08. The four images already explain
what the worlds are, and everything drawn on top of them was competing with
the thing it was meant to present.

  · radius 12–14px down to 7px. Softness without bubble.
  · the crumb pills to the same 6px, so they belong to the same object as
    the cards rather than floating above them
  · "7 EFFECTS / 14 EFFECTS" out. A count is inventory management on a
    screen meant for discovery.
  · shadow to 0 2px 6px rgba(0,0,0,.12). The image edge draws the grid.
  · one title treatment: same size, same weight, bottom-left, whether it
    runs to one line or three
  · a gradient under the title instead of a text shadow. Photographic
    rather than typographic.
  · the gap in by 2px, so the limestone reads as a wall and not as gutters
  · hierarchy in the crumb: "Your photograph" is the way back and should be
    quiet; "All effects" is where you are and should be certain. They were
    twins.
  · the Curator retracts. She is the busiest element on a page whose
    subject is eight photographs — so she withdraws to her mark when
    nothing has changed, and comes back when she has something to say.

Nothing is added. No badges, no arrows, no counts, no affordances.

THE RETRACTING CURATOR
Six seconds after her line settles she folds to a 40px disc holding the C.
Any new line brings her back. Tapping the disc brings her back. Everything
is a class on the band, so the desktop never sees it, and her text is never
removed — a screen reader reads what she said whether she is folded or not.

Usage:  python scripts\\patch-phone-floor-quiet.py public\\portraits.html
"""
import io
import sys

# ── the count comes out of the markup ─────────────────────────────────
OLD_COUNT = """      '<div class="silo-card__content">' +
        '<h3 class="silo-card__title"></h3>' +
        '<span class="silo-card__count"></span>' +"""
NEW_COUNT = """      '<div class="silo-card__content">' +
        '<h3 class="silo-card__title"></h3>' +
        /* The count was here. Ruled out 2026-08-08: it is inventory
           management on a screen meant for discovery, and the photograph
           has already said what the world is. */"""

ANCHOR = """  /* ---- anything a thumb has to hit ----------------------------------- */
  .mc-act, .ps-act, .ac-act, .btn{ min-height:44px }
}"""

CSS = """  /* ======================================================================
     THE FLOOR · quiet
     ======================================================================
     Photograph, title, nothing else. Everything below removes something. */

  .floor{ gap:8px; padding:8px }

  .silo-card{
    border-radius:7px;
    border-color:rgba(88,65,42,.14);
    /* was two shadows at .14 and .08 — enough to read as a raised object.
       The image edge is the grid; the card does not need to hover. */
    box-shadow:0 2px 6px rgba(0,0,0,.12);
  }

  /* One treatment, one place, whether the title runs to one line or three.
     The gradient does the work a text shadow was doing — photographic
     rather than typographic. */
  .silo-card__overlay{
    background:linear-gradient(180deg,
      transparent 52%, rgba(0,0,0,.14) 68%, rgba(0,0,0,.38) 100%);
  }
  .silo-card__content{
    left:0; right:0; bottom:0;
    padding:1.4em .7em .55em;
    gap:0;
    background:linear-gradient(180deg,
      transparent 0%, rgba(0,0,0,.30) 46%, rgba(0,0,0,.40) 100%);
  }
  .silo-card__title{
    font-size:1em; font-weight:400; line-height:1.12;
    text-shadow:none;
    color:#fff;
  }
  .silo-card__count{ display:none }

  /* ---- the crumb · a way back and a place you are -------------------- */
  /* They were twins: two lit pills of equal weight, so neither read as
     the current location. */
  .crumb-back, .crumb-here, .phone-back{ border-radius:6px }
  .phone-back{
    border-radius:6px;
    background:transparent;
    border-color:rgba(196,169,110,.2);
    color:rgba(243,237,225,.58);
    box-shadow:none;
  }
  .crumb-back{
    background:linear-gradient(180deg,#2f2420 0%, #241b17 100%);
    box-shadow:none;
  }
  .crumb-here{
    background:rgba(24,18,15,.5);
    color:rgba(255,252,246,.94);
  }

  /* ---- the Curator retracts ------------------------------------------ */
  /* The busiest element on a page whose subject is eight photographs. She
     keeps her place and gives up her space: folded to her mark when there
     is nothing new, back the moment there is. */
  .band-cur{
    border-bottom:0;
    padding:9px 16px 8px;
    transition:padding .34s cubic-bezier(.3,.9,.3,1);
  }
  .band-cur p{
    transition:max-height .34s cubic-bezier(.3,.9,.3,1),
               opacity .2s linear;
    max-height:4em; overflow:hidden;
  }
  .band.is-folded .band-cur{ padding:7px 16px 6px; cursor:pointer }
  .band.is-folded .band-cur p{ max-height:0; opacity:0 }
  .band.is-folded .band-c{ width:22px; height:22px; font-size:14px }
  .band-c{ transition:width .34s, height .34s, font-size .34s }

  /* ---- the tabs · one is on, three are available --------------------- */
  .band-tab{ color:rgba(246,241,231,.34) }
  .band-tab svg{ opacity:.8 }
  .band-tab.is-on{ color:#f6f1e7 }
  .band-tab.is-on svg{ opacity:1 }

  /* ---- anything a thumb has to hit ----------------------------------- */
  .mc-act, .ps-act, .ac-act, .btn{ min-height:44px }
}"""

# ── the folding ───────────────────────────────────────────────────────
OLD_CARRY = """    carry();
    if (src && window.MutationObserver){
      new MutationObserver(carry).observe(src, { childList:true, subtree:true, characterData:true });
    }"""

NEW_CARRY = """    /* She folds when she has nothing new. Six seconds is long enough to
       read two lines twice and short enough that the floor gets the
       screen back. A new line unfolds her; so does a tap. */
    var foldAt = null;
    function unfold(){
      band.classList.remove('is-folded');
      clearTimeout(foldAt);
      foldAt = setTimeout(function(){ band.classList.add('is-folded'); }, 6000);
    }
    band.addEventListener('click', function(e){
      if (e.target.closest('[data-band]')) return;
      if (band.classList.contains('is-folded')) unfold();
    });

    var lastSaid = '';
    var carryAndWake = function(){
      carry();
      var now = say ? say.textContent : '';
      if (now && now !== lastSaid){ lastSaid = now; unfold(); }
    };

    carryAndWake();
    if (src && window.MutationObserver){
      new MutationObserver(carryAndWake).observe(src,
        { childList:true, subtree:true, characterData:true });
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

    if "is-folded" in doc:
        raise SystemExit("Already applied. Nothing written.")

    doc = swap(doc, "the silo count markup", OLD_COUNT, NEW_COUNT)
    doc = swap(doc, "the 44px rule", ANCHOR, CSS)
    doc = swap(doc, "the band's carry()", OLD_CARRY, NEW_CARRY)

    # gates
    if "silo-card__count'" in doc.replace("querySelector('.silo-card__count')", ""):
        pass  # the JS that filled it is harmless; the element is gone
    if ".silo-card__count{ display:none }" not in doc:
        raise SystemExit("FAIL: the count is not hidden")
    if "box-shadow:0 2px 6px rgba(0,0,0,.12)" not in doc:
        raise SystemExit("FAIL: the shadow was not reduced")
    if "border-radius:7px" not in doc:
        raise SystemExit("FAIL: the card radius was not reduced")
    if doc.count("is-folded") < 4:
        raise SystemExit("FAIL: the Curator does not fold")
    if "text-shadow:none" not in doc:
        raise SystemExit("FAIL: the title still carries a shadow")
    # nothing may have been added
    for never in ["badge", "chevron", "affordance"]:
        pass
    # desktop intact
    if "rgba(239,205,148,.96)" not in doc:
        raise SystemExit("FAIL: the desktop count style was removed rather than hidden")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  radius 7px, shadow halved, gap in, count gone")
    print("  one title treatment, gradient instead of a text shadow")
    print("  the crumb has a quiet back and a definite here")
    print("  the Curator folds to her mark after six seconds")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-phone-floor-quiet.py <file.html>")
    main(sys.argv[1])
