#!/usr/bin/env python3
"""
RESPONSIVE · STAGE TWO · THE BAND

On a phone the Curator was the whole first screen — her card ran the full
width and the first finish sat below the fold. The spine that reads 'Design
your own' took 60px of a 390px screen to hold a rotated label. And the four
places a person goes were behind a hamburger.

This puts one dark object at the bottom of a small screen: the Curator's
line over four tabs, sharing a ground so it reads as a single band rather
than two pieces of furniture. It is the only structural addition the phone
gets, and it buys back the top of the screen for the work.

WHAT CHANGES, UNDER 767 ONLY

  · a band appears: the Curator's current line, then Workshop / Collection
    / Print Shop / Account
  · the Curator's card sheds the vertical spine and her letter, keeping the
    photo drop — she is speaking from the band now and saying it twice is
    saying it worse
  · the hamburger and its drawer go; the tabs are the navigation
  · the page reserves the band's height so nothing hides beneath it

DESKTOP IS UNTOUCHED. Every rule is inside the 767 query, and the band is
display:none above it.

THE LINE SHE SAYS
The band reads from the existing letter in the Curator card, so there is one
source and it cannot drift. When the workshop changes what she says, the
band changes with it.

Usage:  python scripts\\patch-responsive-2-band.py public\\portraits.html
"""
import io
import sys

MARKUP_ANCHOR = "</body>"

BAND = """
<!-- ============================================================
     THE BAND · phones only, stage two
     One object: her line, then the four rooms. Hidden above 767 in CSS,
     not by script, so it costs nothing on a desktop.
     ============================================================ -->
<div class="band" id="lgBand" hidden>
  <div class="band-cur">
    <span class="band-c">C</span>
    <p id="bandSay">Bring me a portrait and I&rsquo;ll choose the finishes myself.</p>
  </div>
  <nav class="band-tabs">
    <button class="band-tab is-on" data-band="/portraits">
      <svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.6V21h14V9.6"/></svg>
      <span>Workshop</span>
    </button>
    <button class="band-tab" data-band="/collection">
      <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15l4.5-4.5 4 4L15 11l6 5.5"/></svg>
      <span>Collection</span>
    </button>
    <button class="band-tab" data-band="/print">
      <svg viewBox="0 0 24 24"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="7" rx="2"/><path d="M6 16h12v5H6z"/></svg>
      <span>Print Shop</span>
    </button>
    <button class="band-tab" data-band="/account">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.7"/><path d="M4.6 20a7.6 7.6 0 0 1 14.8 0"/></svg>
      <span>Account</span>
    </button>
  </nav>
</div>
</body>"""

CSS_ANCHOR = """/* Small phones. The 390 rules hold; these only stop type from wrapping
   into single words. */"""

CSS = """/* ======================================================================
   THE BAND · stage two
   ====================================================================== */
.band{ display:none }

@media (max-width:767px){
  .band{
    display:block;
    position:fixed; left:0; right:0; bottom:0; z-index:60;
    background:#1e1511;
    box-shadow:0 -12px 30px rgba(0,0,0,.3);
    padding-bottom:env(safe-area-inset-bottom,0);
  }
  .band[hidden]{ display:block }

  .band-cur{
    display:flex; gap:11px; align-items:flex-start;
    padding:11px 16px 10px;
    border-bottom:1px solid rgba(246,241,231,.09);
  }
  .band-c{
    flex:0 0 auto; width:26px; height:26px; border-radius:999px;
    display:grid; place-items:center;
    background:#f6f1e7; color:#1e1511;
    font-family:var(--serif); font-size:17px; line-height:1;
    padding-bottom:1px;
  }
  .band-cur p{
    margin:0; font-family:var(--serif); font-style:italic;
    font-size:18px; line-height:1.32; color:rgba(246,241,231,.9);
    /* Two lines is the ceiling. She is sharing this band with the tabs
       and must never push them off the screen. */
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;
    overflow:hidden;
  }

  .band-tabs{ display:grid; grid-template-columns:repeat(4,1fr) }
  .band-tab{
    background:none; border:0; cursor:pointer;
    padding:8px 0 11px; color:rgba(246,241,231,.5);
    display:grid; justify-items:center; gap:3px;
  }
  .band-tab svg{
    width:21px; height:21px; fill:none;
    stroke:currentColor; stroke-width:1.6;
  }
  .band-tab span{
    font-family:var(--sans); font-size:10px; font-weight:600;
    letter-spacing:.03em;
  }
  .band-tab.is-on{ color:#f6f1e7 }
  .band-tab.is-on svg{ stroke:var(--gold, #b58a4c) }

  /* Nothing may hide beneath it. */
  body{ padding-bottom:118px }

  /* The tabs are the navigation now. */
  .mh-menu, .mh-drawer{ display:none !important }

  /* The spine held a rotated label and 60px of a 390px screen. On a phone
     the Curator card is the only thing in that column, so the column goes.
     Her letter goes with it — she is speaking from the band, and saying it
     in two places at once is saying it worse. */
  .room--curator{ grid-template-columns:minmax(0,1fr) }
  .rail{ display:none }
  .cur{ grid-column:1 }
  .cur-say, .cur-letter{ display:none }
}

/* Small phones. The 390 rules hold; these only stop type from wrapping
   into single words. */"""

JS_ANCHOR = "  window.__showPrintShop = showPrintShop;"

JS = """  window.__showPrintShop = showPrintShop;

  /* ---- THE BAND · stage two -----------------------------------------
     The tabs open the same surfaces the masthead does — the same three
     functions, not a second set. A phone navigation that drifts from the
     desktop's is two navigations to keep true. */
  (function(){
    var band = document.getElementById('lgBand');
    if (!band) return;
    band.hidden = false;

    var OPEN = {
      '/collection': function(){ if (typeof showCollection === 'function') showCollection(); },
      '/print':      function(){ if (typeof showPrintShop === 'function') showPrintShop(); },
      '/account':    function(){ if (typeof showAccount === 'function') showAccount(); }
    };

    band.addEventListener('click', function(e){
      var b = e.target.closest('[data-band]');
      if (!b) return;
      var to = b.getAttribute('data-band');
      if (to === '/portraits'){
        /* Back to the floor: close whatever is over it. */
        if (typeof hideCollection === 'function') hideCollection();
        if (typeof hidePrintShop === 'function') hidePrintShop();
        if (typeof hideAccount === 'function') hideAccount();
      } else if (OPEN[to]) {
        OPEN[to]();
      }
      paintBand();
    });

    /* Which room is open. Read from the surfaces themselves rather than
       held in a variable here — a second record of the same fact is a
       second thing to get wrong. */
    function paintBand(){
      var at = '/portraits';
      var mc = document.getElementById('mycoll');
      var psx = document.getElementById('pshop');
      var ac = document.getElementById('acct');
      if (ac  && ac.classList.contains('is-open'))  at = '/account';
      else if (psx && psx.classList.contains('is-open')) at = '/print';
      else if (mc  && mc.classList.contains('is-open'))  at = '/collection';
      [].forEach.call(band.querySelectorAll('[data-band]'), function(b){
        b.classList.toggle('is-on', b.getAttribute('data-band') === at);
      });
    }
    window.__paintBand = paintBand;

    /* Her line, from the letter that is already in the Curator card, so
       there is one source and it cannot drift. */
    var say = document.getElementById('bandSay');
    var src = document.querySelector('.cur-say, .cur-letter');
    function carry(){
      if (!say || !src) return;
      var t = (src.textContent || '').replace(/\\s+/g, ' ').trim();
      t = t.replace(/\\u2014\\s*C\\.?\\s*$/, '').trim();
      if (t) say.textContent = t;
    }
    carry();
    if (src && window.MutationObserver){
      new MutationObserver(carry).observe(src, { childList:true, subtree:true, characterData:true });
    }

    /* The masthead's own links keep working; the band follows them. */
    document.addEventListener('click', function(){ setTimeout(paintBand, 60); });
    paintBand();
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

    if 'id="lgBand"' in doc:
        raise SystemExit("Already applied. Nothing written.")

    doc = swap(doc, "the small-phone comment", CSS_ANCHOR, CSS)
    doc = swap(doc, "</body>", MARKUP_ANCHOR, BAND)
    doc = swap(doc, "the showPrintShop export", JS_ANCHOR, JS)

    # gates
    if doc.count('id="lgBand"') != 1:
        raise SystemExit("FAIL: the band markup is not present exactly once")
    if doc.count('data-band="') != 4:
        raise SystemExit("FAIL: expected four tabs, found %d"
                         % doc.count('data-band="'))
    if "window.__paintBand" not in doc:
        raise SystemExit("FAIL: the painter was not exported")
    if ".band{ display:none }" not in doc:
        raise SystemExit("FAIL: the band is not hidden on desktop")
    if doc.count("@media (max-width:1100px)") != 1:
        raise SystemExit("FAIL: the tablet collapse was disturbed")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  band appears under 767: her line over four tabs")
    print("  spine and duplicate letter go on a phone")
    print("  hamburger and drawer replaced by the tabs")
    print("  desktop untouched")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-responsive-2-band.py <file.html>")
    main(sys.argv[1])
