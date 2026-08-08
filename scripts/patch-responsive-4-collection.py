#!/usr/bin/env python3
"""
RESPONSIVE · STAGE FOUR · WHAT RICH FOUND ON THE PHONE

Six things, ruled 2026-08-08.

**1 · My Collection led with an upsell.**
Three panels — the Curator Recommends, the Print Shop, Create Wallpapers —
sat between the head and the work. A person opening their collection is
looking for their own pieces, and the first screen offered them three things
to buy instead. They stay on the desktop, where there is room for both.

**2 & 3 · The pieces were unreachable.**
Stage three stacked the featured piece full width and the thumbnails below
it, so the grid began below a screen-height image and the archive pill went
with it. Rich's ruling: grid first. The featured piece is not a permanent
fixture on a phone — it is what you get when you tap something.

Two controls, drawn as icons because they are a mode and not a sentence: a
filled square for full size, a nine-square grid for back. Both white on the
dark surface, both 44px.

**4 · The footer.**
Five bays of placeholder text under the workshop. Not wanted on a phone.
Hidden, not deleted — the desktop still shows it.

**5 · Download all sat inside the Credits card.**
Directly beneath a balance, next to Buy credits, reading as though it
downloaded credits. It moves out to sit with the piece count, which is what
it acts on.

**6 · The silo grid.**
Sized so the second row peeks above the fold. Rich's call, and the better
one: a peek says there is more without spending a tap, and without a
sideways gesture fighting a vertical scroll.

Usage:  python scripts\\patch-responsive-4-collection.py public\\portraits.html
"""
import io
import sys

# ── the credits card · Download all moves out ────────────────────────
OLD_CARD = """      '<div class="ac-acts">' +
        '<button class="ac-buy" id="acBuy" type="button">Buy credits</button>' +
        '<button class="ac-second" id="acDlAll" type="button"' +
          (some ? '' : ' disabled') + '>Download all</button>' +
      '</div>' +
      (pieces
        ? '<p class="note" style="margin:1em 0 0">' + pieces.total +
          (pieces.total === 1 ? ' piece' : ' pieces') + ' crafted' +
          (pieces.archived ? ' \\u00b7 ' + pieces.archived + ' archived' : '') + '</p>'
        : '') +"""

NEW_CARD = """      /* Download all used to sit here, beneath a balance and beside Buy
         credits, where it read as downloading the credits. It acts on
         pieces, so it lives with the piece count now. */
      '<div class="ac-acts">' +
        '<button class="ac-buy" id="acBuy" type="button">Buy credits</button>' +
      '</div>' +
      (pieces
        ? '<div class="ac-work">' +
            '<p class="note">' + pieces.total +
            (pieces.total === 1 ? ' piece' : ' pieces') + ' crafted' +
            (pieces.archived ? ' \\u00b7 ' + pieces.archived + ' put away' : '') + '</p>' +
            '<button class="ac-second" id="acDlAll" type="button"' +
              (some ? '' : ' disabled') + '>Download all</button>' +
          '</div>'
        : '') +"""

# ── the phone rules ───────────────────────────────────────────────────
ANCHOR = """  /* ---- anything a thumb has to hit ----------------------------------- */
  .mc-act, .ps-act, .ac-act, .btn{ min-height:44px }
}"""

CSS = """  /* ---- 1 · the collection leads with the work ------------------------ */
  /* Three panels of things to buy sat between the head and the pieces. On
     a desktop they are beside the work; here they were in front of it. */
  .mc-onward{ display:none }

  /* ---- 2 & 3 · grid first, featured on tap --------------------------- */
  /* Stage three put the featured piece above the grid at full width, so
     the pieces began below a screen-height image and the archive pill
     went with them. The grid is the collection; the featured piece is
     what a tap produces. */
  .mc-latest{ display:flex; flex-direction:column }
  .mc-col{ order:1 }
  .mc-feat{ order:2 }

  /* Not shown until something is chosen, and then it is the whole view. */
  .mc-feat{ display:none }
  .mycoll.is-viewing .mc-feat{
    display:block; position:fixed; inset:0; z-index:70;
    max-width:none; margin:0; border-radius:0;
    background:#12100e;
  }
  .mycoll.is-viewing .mc-feat img{
    width:100%; height:100%; object-fit:contain;
  }
  .mycoll.is-viewing .mc-col,
  .mycoll.is-viewing .mc-head,
  .mycoll.is-viewing .mc-say,
  .mycoll.is-viewing .mc-filters{ display:none }

  /* Two modes, so two icons rather than two sentences. */
  .mc-mode{
    position:fixed; z-index:72; right:14px; bottom:132px;
    width:46px; height:46px; border-radius:999px;
    display:grid; place-items:center; cursor:pointer;
    background:rgba(18,16,14,.72); color:#fff;
    border:1px solid rgba(255,255,255,.34);
    backdrop-filter:blur(4px);
  }
  .mc-mode svg{ width:22px; height:22px; fill:none; stroke:currentColor; stroke-width:1.7 }
  .mycoll:not(.is-viewing) .mc-mode[data-mode="grid"]{ display:none }
  .mycoll.is-viewing .mc-mode[data-mode="full"]{ display:none }
  .mycoll.is-viewing .mc-mode{ bottom:22px }

  /* ---- 4 · the footer ------------------------------------------------ */
  .room--footer{ display:none }

  /* ---- 5 · the credits card ------------------------------------------ */
  .ac-work{
    display:flex; flex-direction:column; gap:.7em;
    margin:1.1em 0 0; padding-top:1em;
    border-top:1px solid rgba(137,105,67,.2);
  }
  .ac-work .ac-second{ width:100%; min-height:44px }
  .ac-acts .ac-buy{ width:100%; min-height:44px }

  /* ---- 6 · the second row peeks -------------------------------------- */
  /* Sized so the row below the fold shows its top edge. A person scrolls
     because they can see there is more, which costs no tap and no
     sideways gesture fighting the vertical one. */
  .wall, .fx-wall, .silo-wall{
    grid-template-columns:repeat(2, minmax(0,1fr));
    gap:10px;
  }

  /* ---- anything a thumb has to hit ----------------------------------- */
  .mc-act, .ps-act, .ac-act, .btn{ min-height:44px }
}"""

# ── the two controls, and the mode they drive ────────────────────────
JS_ANCHOR = "  function showCollection(){"

JS = """  /* ---- FULL SIZE AND BACK · phones ----------------------------------
     Two modes need two controls, and on a phone they are icons: a filled
     square for full size, a nine-square grid for back. Drawn once and
     shown by CSS, so the desktop never sees them. */
  (function(){
    if (!mycoll || mycoll.querySelector('.mc-mode')) return;
    var ICON = {
      full: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>',
      grid: '<svg viewBox="0 0 24 24">' +
            '<rect x="3.5" y="3.5" width="5" height="5" rx="1"/>' +
            '<rect x="9.5" y="3.5" width="5" height="5" rx="1"/>' +
            '<rect x="15.5" y="3.5" width="5" height="5" rx="1"/>' +
            '<rect x="3.5" y="9.5" width="5" height="5" rx="1"/>' +
            '<rect x="9.5" y="9.5" width="5" height="5" rx="1"/>' +
            '<rect x="15.5" y="9.5" width="5" height="5" rx="1"/>' +
            '<rect x="3.5" y="15.5" width="5" height="5" rx="1"/>' +
            '<rect x="9.5" y="15.5" width="5" height="5" rx="1"/>' +
            '<rect x="15.5" y="15.5" width="5" height="5" rx="1"/></svg>'
    };
    ['full','grid'].forEach(function(m){
      var b = document.createElement('button');
      b.className = 'mc-mode';
      b.type = 'button';
      b.setAttribute('data-mode', m);
      b.setAttribute('aria-label', m === 'full' ? 'View full size' : 'Back to the grid');
      b.innerHTML = ICON[m];
      mycoll.appendChild(b);
    });
    mycoll.addEventListener('click', function(e){
      var b = e.target.closest('.mc-mode');
      if (!b) return;
      mycoll.classList.toggle('is-viewing', b.getAttribute('data-mode') === 'full');
    });
    /* Tapping a piece is the other way in. It already features the piece;
       this only says which mode that means on a phone. */
    var grid = document.getElementById('mcGrid');
    if (grid) grid.addEventListener('click', function(e){
      if (!e.target.closest('[data-piece]')) return;
      if (window.matchMedia && window.matchMedia('(max-width:767px)').matches){
        mycoll.classList.add('is-viewing');
      }
    });
  })();

  function showCollection(){"""


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

    if "mc-mode" in doc:
        raise SystemExit("Already applied. Nothing written.")

    doc = swap(doc, "the credits card", OLD_CARD, NEW_CARD)
    doc = swap(doc, "the 44px rule", ANCHOR, CSS)
    doc = swap(doc, "showCollection", JS_ANCHOR, JS)

    # gates
    if doc.count(".mc-mode{\n") != 1 and doc.count(".mc-mode{\r\n") != 1:
        raise SystemExit("FAIL: the mode control style is not present once")
    # two CSS rules, one setAttribute, one getAttribute
    if doc.count("data-mode") != 4:
        raise SystemExit("FAIL: expected four data-mode references, found %d"
                         % doc.count("data-mode"))
    if doc.count("id=\"acDlAll\"") != 1:
        raise SystemExit("FAIL: Download all is not present exactly once")
    if "ac-work" not in doc:
        raise SystemExit("FAIL: the work block was not written")
    if doc.count("function showCollection()") != 1:
        raise SystemExit("FAIL: showCollection was duplicated or lost")
    if ".room--footer{ display:none }" not in doc:
        raise SystemExit("FAIL: the footer is still shown on a phone")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  collection leads with the grid; a tap gives full size")
    print("  square and grid controls, 46px, on the phone only")
    print("  upsell panels and the footer hidden on a phone")
    print("  Download all moved out of the credits card")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-responsive-4-collection.py <file.html>")
    main(sys.argv[1])
