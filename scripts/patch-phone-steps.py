#!/usr/bin/env python3
"""
THE STEP FLOW · phones

The desktop workshop is one room: the Curator card on the left, the floor on
the right, both on screen at once. Every phone fix so far has been an attempt
to make that room survive 390px by stacking it — Curator above, floor below,
one long scroll. That was the wrong shape and it produced a week of overflow
problems, each fix creating the next.

The mobile design is a step flow. One room at a time, the screen is the
frame, and you advance rather than scroll past.

    step 1   the Curator — add your photograph, and nothing else
    step 2   eight worlds, two across, scrolling
    step 3   the finishes in that world
    step 4   the expression

Steps 2, 3 and 4 already work this way: `.workshop-view--silos/effects/poses`
swaps the floor. What has never been a step is the Curator card, because on
a desktop it is meant to stay beside them. On a phone it becomes step one and
leaves when the photograph lands.

HOW IT ADVANCES
The card already carries its own state — `data-state="empty"` until a
photograph is in. That attribute is the trigger, watched rather than
duplicated, so there is one record of whether a photograph exists and the
step flow cannot disagree with the card about it.

GOING BACK
"Use a different photograph" is already in the card and already does the
right thing. From the worlds a phone-only pill returns to the Curator. It
appears in the crumb where the back control already lives, so there is one
place to look for the way back.

DESKTOP IS UNTOUCHED. Every rule is inside the 767 query, and the class that
drives it is only ever set below that width.

Usage:  python scripts\\patch-phone-steps.py public\\portraits.html
"""
import io
import sys

ANCHOR = """  /* ---- anything a thumb has to hit ----------------------------------- */
  .mc-act, .ps-act, .ac-act, .btn{ min-height:44px }
}"""

CSS = """  /* ======================================================================
     THE STEP FLOW
     ======================================================================
     One room fills the screen. The other is not there — display:none, not
     scrolled past, so nothing below the fold is competing for a thumb. */
  .rooms.phone-step--upload .room--workshop{ display:none }
  .rooms.phone-step--work   .room--curator { display:none }

  .rooms{ display:block }
  .room--curator, .room--workshop{
    min-height:calc(100dvh - var(--head-h, 56px) - 118px);
    display:flex; flex-direction:column;
  }

  /* ---- step one · the Curator ---------------------------------------- */
  /* She has the screen to herself. The photograph is the only thing being
     asked for, so it is the only thing offered. */
  .rooms.phone-step--upload .cur{
    flex:1; justify-content:center;
    padding:18px 14px 20px;
  }
  .rooms.phone-step--upload .cur-slot{
    min-height:0; flex:0 1 auto;
    aspect-ratio:4/3; max-height:44vh;
  }
  .rooms.phone-step--upload .cur-thumb img{ max-height:44vh }

  /* ---- steps two, three, four · the floor ---------------------------- */
  .room--workshop{ overflow:hidden }
  .deck{ flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch }
  .face{ min-height:100% }

  /* ---- the way back to the photograph -------------------------------- */
  .phone-back{
    display:none;
    align-items:center; gap:7px;
    height:38px; padding:0 .85em;
    border:1px solid rgba(196,169,110,.34); border-radius:999px;
    background:rgba(36,27,23,.6);
    font-family:var(--serif); font-style:italic; font-size:1.05rem;
    color:rgba(243,237,225,.86); cursor:pointer; white-space:nowrap;
  }
  .phone-back svg{ width:13px; height:13px; fill:none; stroke:currentColor; stroke-width:2 }
  /* Only from the worlds. From a world, the crumb's own back control
     returns to the worlds, and two back controls on one row is a
     question rather than an answer. */
  .workshop-view--silos .phone-back{ display:inline-flex }

  /* ---- anything a thumb has to hit ----------------------------------- */
  .mc-act, .ps-act, .ac-act, .btn{ min-height:44px }
}"""

JS_ANCHOR = "  window.__showPrintShop = showPrintShop;"

JS = """  window.__showPrintShop = showPrintShop;

  /* ---- THE STEP FLOW · phones ---------------------------------------
     One room at a time. The Curator card is step one and leaves when a
     photograph lands; the floor is steps two to four and already swaps
     itself.

     The card's own `data-state` is the trigger. Watched, not copied —
     one record of whether a photograph exists, so the step flow cannot
     come to disagree with the card about it. */
  (function(){
    var rooms = document.querySelector('.rooms');
    var card  = document.getElementById('cur');
    if (!rooms || !card) return;

    var PHONE = '(max-width:767px)';
    function onPhone(){
      return window.matchMedia && window.matchMedia(PHONE).matches;
    }

    function hasPhoto(){ return card.getAttribute('data-state') !== 'empty'; }

    function step(name){
      rooms.classList.toggle('phone-step--upload', name === 'upload');
      rooms.classList.toggle('phone-step--work',   name === 'work');
      var room = document.getElementById(name === 'upload' ? 'cur' : 'workshop');
      if (room && room.scrollIntoView) room.scrollIntoView({ block:'start' });
      var deck = document.getElementById('deck');
      if (deck) deck.scrollTop = 0;
    }

    function sync(){
      if (!onPhone()){
        rooms.classList.remove('phone-step--upload', 'phone-step--work');
        return;
      }
      /* Only ever advances on its own. Going back is something a person
         does deliberately, and a photograph still being present must not
         throw them forward again. */
      if (!rooms.classList.contains('phone-step--upload') &&
          !rooms.classList.contains('phone-step--work')){
        step(hasPhoto() ? 'work' : 'upload');
        return;
      }
      if (!hasPhoto()) step('upload');
    }

    /* The photograph landing is what advances it. */
    var wasEmpty = !hasPhoto();
    new MutationObserver(function(){
      if (!onPhone()) return;
      var empty = !hasPhoto();
      if (wasEmpty && !empty) step('work');
      if (!wasEmpty && empty) step('upload');
      wasEmpty = empty;
    }).observe(card, { attributes:true, attributeFilter:['data-state'] });

    /* The way back, in the crumb where the other back control lives. */
    var crumb = document.querySelector('.room--workshop .crumb');
    if (crumb && !crumb.querySelector('.phone-back')){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'phone-back';
      b.innerHTML = '<svg viewBox="0 0 16 16"><path d="M10 3 5 8l5 5"/></svg>' +
                    'Your photograph';
      b.addEventListener('click', function(){ step('upload'); });
      crumb.insertBefore(b, crumb.firstChild);
    }

    window.addEventListener('resize', sync);
    sync();
    window.__phoneStep = step;
  })();
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

    if "phone-step--upload" in doc:
        raise SystemExit("Already applied. Nothing written.")

    doc = swap(doc, "the 44px rule", ANCHOR, CSS)
    doc = swap(doc, "the showPrintShop export", JS_ANCHOR, JS)

    # gates
    if doc.count("phone-step--upload") < 4:
        raise SystemExit("FAIL: the step classes were not written")
    if "attributeFilter:['data-state']" not in doc:
        raise SystemExit("FAIL: nothing watches the card for a photograph")
    # the CSS rules plus the className assignment
    if doc.count("phone-back") < 4:
        raise SystemExit("FAIL: the way back was not written (%d references)"
                         % doc.count("phone-back"))
    if "window.__phoneStep" not in doc:
        raise SystemExit("FAIL: the step function was not exported")
    # the existing view machinery must be intact
    for must in ["workshop-view--silos", "workshop-view--effects", "workshop-view--poses"]:
        if must not in doc:
            raise SystemExit("FAIL: %s was lost" % must)
    if doc.count("@media (max-width:1100px)") != 1:
        raise SystemExit("FAIL: the tablet collapse was disturbed")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  step one: the Curator has the screen to herself")
    print("  a photograph landing advances to the worlds")
    print("  'Your photograph' in the crumb goes back")
    print("  desktop untouched")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-phone-steps.py <file.html>")
    main(sys.argv[1])
