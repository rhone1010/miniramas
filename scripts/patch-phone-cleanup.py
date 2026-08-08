#!/usr/bin/env python3
"""
CLEAN-UP · 2026-08-08

**0 · "Finishes" is retired.**

Ruled today. Every customer-facing use of the word in the effect sense
becomes "effects" — which is what the crumb has said all along, so the build
was already speaking both.

The Print Shop keeps its `finish`. There it means paper: fine art, canvas,
framed, matted. Different word, same spelling, and retiring one must not
take the other with it.

**1 · The Curator's mark was in two places.**

The card header carried a C and so does the band. On a phone the band is
where she lives, so the card's copy goes.

**2 · The band tucks away.**

She says her piece, then folds to her mark — and now the whole band tucks to
a 26px lip so the work has the screen. A tap on the lip brings it back.

26px rather than the 10 suggested: ten is thinner than a thumb finds
reliably, and 26 still reads as a line rather than a bar. It can go thinner
if it feels heavy.

**3 · The tray sat at a guessed height above the band.**

`bottom:118px` was a constant, and the band is not a constant — it changes
with her line and again when it tucks. Measured now, and re-measured when it
moves, so the tray always sits exactly on top of it.

**4 · The pose crumb wrapped, and "Keep My Pose" was cut off.**

Two pills would not share a row, so "Step 2 · the pose" dropped to its own
line. And the pose card is a fixed ratio with three lines of text and an
icon inside it, which does not fit at 190px.

**5 · The tray followed you into My Collection.**

"Crafting" stayed on screen over the collection, where the piece landing is
already the feedback. It belongs to the workshop and now stays there.

Usage:  python scripts\\patch-phone-cleanup.py public\\portraits.html
"""
import io
import sys

# ── 0 · the word ──────────────────────────────────────────────────────
WORDS = [
    ('>Choose finishes &rarr;<', '>Choose effects &rarr;<'),
    ('>Suggest seven finishes<', '>Suggest seven effects<'),
    ("Nothing chosen yet. Pick a finish and I&rsquo;ll hold it here.",
     "Nothing chosen yet. Pick an effect and I&rsquo;ll hold it here."),
    ("browsing: 'Add as many finishes as you like",
     "browsing: 'Add as many effects as you like"),
    ("posing:   'Go back to the finishes any time to add more.'",
     "posing:   'Go back to the effects any time to add more.'"),
    ("I&rsquo;ll choose the finishes ' +", "I&rsquo;ll choose the effects ' +"),
    ("' finishes of this room, side by side.'", "' effects of this room, side by side.'"),
    ("addN + ' finishes</p>'", "addN + ' effects</p>'"),
    ("crumbLabel.textContent = 'Back to the finishes'",
     "crumbLabel.textContent = 'Back to the effects'"),
    ("SUB_NOTE = 'Your finishes are here", "SUB_NOTE = 'Your effects are here"),
    ("'Three finishes that would sit well beside what you\\u2019ve already made.'",
     "'Three effects that would sit well beside what you\\u2019ve already made.'"),
    ("I&rsquo;ll choose the finishes myself.</p>", "I&rsquo;ll choose the effects myself.</p>"),
    ("count + (count === 1 ? ' finish chosen' : ' finishes chosen')",
     "count + (count === 1 ? ' effect chosen' : ' effects chosen')"),
]

CSS = """
/* ======================================================================
   PHONE CLEAN-UP · 2026-08-08
   ================================================================== */
@media (max-width:767px){

  /* 1 · one mark, and it is in the band. */
  .cur-head .cur-mark{ display:none }
  .cur-head{ padding-left:0 }

  /* 2 · the band tucks to a lip so the work has the screen. 26px, not 10:
        ten is thinner than a thumb finds, and this still reads as a line. */
  .band{
    transition:transform .3s cubic-bezier(.3,.9,.3,1);
  }
  .band.is-tucked{
    transform:translateY(calc(100% - 26px));
  }
  .band.is-tucked .band-cur{
    padding:3px 16px; cursor:pointer;
  }
  .band.is-tucked .band-cur p{ max-height:0; opacity:0 }
  .band.is-tucked .band-c{ width:18px; height:18px; font-size:12px }

  /* 4 · the crumb holds its row. Two pills wrapped and dropped the second
        to a line of its own. */
  .crumb{ flex-wrap:wrap }
  .crumb-back, .crumb-here{
    min-width:0; flex:0 1 auto;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    font-size:1.05rem; height:36px; padding:0 12px;
  }
  .agetog{ order:3 }

  /* 4 · and the pose card fits its own words. Three lines of type and an
        icon do not fit a .78 ratio at this width. */
  .face--poses .silo-card{ aspect-ratio:1 / 1.15 }
  .face--poses .silo-card__content{ padding:1.1em .55em .5em }
  .face--poses .silo-card__title{ font-size:.86em; line-height:1.1 }
  .face--poses .silo-card__sub,
  .face--poses .pose-note{ font-size:.72em; line-height:1.25 }
}
"""

JS = """
<script>
/* ---- PHONE CLEAN-UP · the band and the tray -------------------------- */
(function(){
  function boot(){
    var band = document.getElementById('lgBand');
    var tray = document.getElementById('lgTray');
    if (!band) return;

    function onPhone(){
      return window.matchMedia && window.matchMedia('(max-width:767px)').matches;
    }

    /* 3 · The tray sat at bottom:118px — a constant, over a band that is
       not one. It changes with her line and again when it tucks, so the
       height is measured and re-measured rather than assumed. */
    function seat(){
      if (!tray || !onPhone()) return;
      var h = band.classList.contains('is-tucked') ? 26 : band.offsetHeight;
      tray.style.bottom = h + 'px';
    }

    /* 2 · She speaks, then the whole band tucks away. A tap on the lip
       brings it back — and any new line from her does too, because a line
       nobody can see is a line not worth writing. */
    var tuckAt = null;
    function untuck(){
      band.classList.remove('is-tucked');
      clearTimeout(tuckAt);
      tuckAt = setTimeout(function(){
        if (!onPhone()) return;
        band.classList.add('is-tucked');
        seat();
      }, 7000);
      seat();
    }
    band.addEventListener('click', function(e){
      if (band.classList.contains('is-tucked')){ untuck(); return; }
      if (e.target.closest('[data-band]')) return;
    });

    var say = document.getElementById('bandSay');
    if (say && window.MutationObserver){
      new MutationObserver(untuck).observe(say,
        { childList:true, characterData:true, subtree:true });
    }
    if (window.MutationObserver){
      new MutationObserver(seat).observe(band,
        { childList:true, subtree:true, attributes:true, characterData:true });
    }

    /* 5 · The tray belongs to the workshop. It followed a person into the
       collection and said "Crafting" over the pieces landing, which are
       the feedback. */
    function overlaid(){
      return ['mycoll','pshop','acct'].some(function(id){
        var el = document.getElementById(id);
        return el && el.classList.contains('is-open');
      });
    }
    if (tray && window.MutationObserver){
      var watch = function(){
        tray.style.visibility = overlaid() ? 'hidden' : '';
      };
      ['mycoll','pshop','acct'].forEach(function(id){
        var el = document.getElementById(id);
        if (el) new MutationObserver(watch).observe(el,
          { attributes:true, attributeFilter:['class'] });
      });
      watch();
    }

    window.addEventListener('resize', seat);
    untuck();
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
</script>
"""


def crlf(t):
    return t.replace("\n", "\r\n")


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    if "is-tucked" in doc:
        raise SystemExit("Already applied. Nothing written.")

    nl = "\r\n" if "\r\n" in doc[:2000] else "\n"

    changed, missed = 0, []
    for old, new in WORDS:
        for o, n_ in ((old, new), (crlf(old), crlf(new))):
            if doc.count(o) == 1:
                doc = doc.replace(o, n_, 1)
                changed += 1
                break
        else:
            missed.append(old[:44])

    last = doc.rfind("</style>")
    if last < 0:
        raise SystemExit("FAIL: no stylesheet found. Nothing written.")
    doc = doc[:last] + (CSS if nl == "\n" else crlf(CSS)) + doc[last:]

    close = "</body>"
    if doc.count(close) != 1:
        raise SystemExit("FAIL: expected one </body>, found %d" % doc.count(close))
    doc = doc.replace(close, (JS if nl == "\n" else crlf(JS)) + close, 1)

    # gates
    if "is-tucked" not in doc:
        raise SystemExit("FAIL: the tuck was not written")
    if "tray.style.bottom = h" not in doc:
        raise SystemExit("FAIL: the tray is still at a guessed height")
    # the Print Shop's own meaning must survive
    if "Choose your finish" not in doc:
        raise SystemExit("FAIL: the Print Shop's paper finish was renamed")
    if 'finish:"fine_art"' not in doc:
        raise SystemExit("FAIL: the print catalogue was touched")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  'finishes' retired in %d places; the Print Shop's finish kept" % changed)
    if missed:
        print("  NOT FOUND, check by hand: %s" % "; ".join(missed))
    print("  the band tucks to a 26px lip and a tap brings it back")
    print("  the tray sits on the band's measured height")
    print("  the tray stays in the workshop")
    print("  the pose card fits its words; the crumb holds its row")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-phone-cleanup.py <file.html>")
    main(sys.argv[1])
