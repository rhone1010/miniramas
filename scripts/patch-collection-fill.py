#!/usr/bin/env python3
"""
THE COLLECTION · FILL, SCROLL, OPEN

Three faults, one cause each.

**1 · The workshop showed underneath.**

The three surfaces stop at `bottom:118px` — a constant measured when the
band carried the Curator's line. She came out of it last night and the band
got shorter, so there is now a strip of workshop between the panel and the
tabs.

The band's height is measured and published as a custom property, and the
surfaces sit on it. It is measured again whenever the band changes, so this
cannot drift again the next time something moves in or out of it.

**2 · The grid would not scroll.**

    .mc-grid{ flex:0 0 auto }

Correct on a desktop, where the panel is tall enough to hold everything. On
a phone it means a fixed block: nine pieces show and seventy do not.

**3 · Tapping a piece did nothing.**

Only `#mcFeat` opens the lightbox. A tile calls `choosePiece`, which sets
the featured piece — and the featured piece is hidden on a phone, so a tap
changed something invisible and nothing happened.

On a phone a tile opens the lightbox directly. The featuring still runs
underneath, so the desktop is unchanged and the lightbox opens on the piece
that was tapped.

Usage:  python scripts\\patch-collection-fill.py public\\portraits.html
"""
import io
import sys

CSS = """
/* ======================================================================
   PHONE · THE COLLECTION FILLS, SCROLLS AND OPENS
   ================================================================== */
@media (max-width:767px){
  /* 1 · On the band's measured height, not a constant. The constant was
        118px, measured when the band carried a line it no longer has. */
  .mycoll, .pshop, .acct{
    top:0 !important;
    bottom:var(--lg-band-h, 62px) !important;
    left:0 !important; right:0 !important;
    display:flex !important; flex-direction:column;
  }

  /* 2 · The grid takes the room that is left and scrolls inside it. */
  .mycoll .mc-grid{
    flex:1 1 auto !important;
    min-height:0;
    overflow-y:auto;
    -webkit-overflow-scrolling:touch;
  }
  .mycoll .mc-head,
  .mycoll .mc-say,
  .mycoll .mc-filters{ flex:0 0 auto }

  /* 3 · A tile is a target. */
  .mycoll .mc-minimap .piece{ cursor:pointer }
}
"""

JS = """
<script>
/* ---- THE BAND'S HEIGHT, PUBLISHED --------------------------------------
   The surfaces sat above a constant. The band is not one — it changed when
   the Curator left it, and it will change again. Measured here and
   re-measured whenever it moves, so nothing has to guess. */
(function(){
  function boot(){
    var band = document.getElementById('lgBand');
    if (!band) return;
    function publish(){
      var h = band.offsetHeight || 62;
      document.documentElement.style.setProperty('--lg-band-h', h + 'px');
    }
    publish();
    window.addEventListener('resize', publish);
    if (window.MutationObserver){
      new MutationObserver(publish).observe(band,
        { childList:true, subtree:true, attributes:true });
    }

    /* A tile opens the piece. Only #mcFeat did, and #mcFeat is hidden on a
       phone — so a tap moved something invisible and read as nothing. The
       featuring underneath still runs, so the desktop is untouched. */
    var grid = document.getElementById('mcGrid');
    if (grid) grid.addEventListener('click', function(e){
      if (!window.matchMedia || !window.matchMedia('(max-width:767px)').matches) return;
      var tile = e.target.closest('[data-piece]');
      if (!tile) return;
      if (e.target.closest('[data-arch]') || e.target.closest('[data-pick]')) return;
      var id = tile.getAttribute('data-piece');
      if (id && typeof window.__openPiece === 'function') window.__openPiece(id);
    });
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
</script>
"""

# the lightbox has to be reachable from outside its own scope
OLD_EXPORT = "  function openLightbox(id){"
NEW_EXPORT = """  /* Exported so the phone's tile handler can reach it. On a desktop the
     featured piece is the only way in; on a phone the featured piece is
     hidden and the tile has to open it directly. */
  window.__openPiece = function(id){ openLightbox(id); };

  function openLightbox(id){"""


def crlf(t):
    return t.replace("\n", "\r\n")


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    if "--lg-band-h" in doc:
        raise SystemExit("Already applied. Nothing written.")

    nl = "\r\n" if "\r\n" in doc[:2000] else "\n"

    found = False
    for o, n_ in ((OLD_EXPORT, NEW_EXPORT), (crlf(OLD_EXPORT), crlf(NEW_EXPORT))):
        if doc.count(o) == 1:
            doc = doc.replace(o, n_, 1)
            found = True
            break
    if not found:
        raise SystemExit("FAIL: openLightbox not found once. Nothing written.")

    last = doc.rfind("</style>")
    if last < 0:
        raise SystemExit("FAIL: no stylesheet found. Nothing written.")
    doc = doc[:last] + (CSS if nl == "\n" else crlf(CSS)) + doc[last:]

    close = "</body>"
    if doc.count(close) != 1:
        raise SystemExit("FAIL: expected one </body>, found %d" % doc.count(close))
    doc = doc.replace(close, (JS if nl == "\n" else crlf(JS)) + close, 1)

    # gates
    if doc.count("window.__openPiece = function") != 1:
        raise SystemExit("FAIL: the lightbox was not exported once")
    if "bottom:var(--lg-band-h, 62px) !important" not in doc:
        raise SystemExit("FAIL: the surfaces still sit on a constant")
    if "overflow-y:auto" not in doc:
        raise SystemExit("FAIL: the grid still cannot scroll")
    if "setProperty('--lg-band-h'" not in doc:
        raise SystemExit("FAIL: nothing measures the band")
    if "function openLightbox" not in doc:
        raise SystemExit("FAIL: the lightbox was disturbed")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  the surfaces sit on the band's measured height")
    print("  the grid scrolls")
    print("  a tile opens the piece")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-collection-fill.py <file.html>")
    main(sys.argv[1])
