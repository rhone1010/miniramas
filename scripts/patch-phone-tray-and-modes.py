#!/usr/bin/env python3
"""
A WAY BACK, AND A WAY ON

Two dead ends on the phone.

**1 · My Collection opens on one piece with no way to the grid.**

The rules that stack the collection were written against `.mc-feat` and
`.mc-col`, and the collection's own definitions for those sit further down
the same stylesheet. Same specificity, later wins, and I have now lost this
argument twice by anchoring my rules to whatever was convenient.

So this block goes last — after every stylesheet in the file — and states
both modes explicitly rather than relying on a default being absent. There
is no rule below it to disagree with.

**2 · The workshop has no way on.**

Finishes can be ticked and nothing says what happens next. On a desktop the
To Be Crafted rail is always visible and carries the Craft button; the phone
hides that rail and nothing replaced it.

The tray from the approved mockup: it rises when something is chosen, says
how many and what they cost, and carries one button. It does not invent a
craft path — it presses the rail's own button, so there is one route to a
craft and the tray is a way to reach it rather than a second implementation.

Usage:  python scripts\\patch-phone-tray-and-modes.py public\\portraits.html
"""
import io
import sys

CSS = """
/* ======================================================================
   PHONE · THE COLLECTION'S TWO MODES, AND THE TRAY
   ======================================================================
   Last in the file, deliberately. The rules below were twice overridden by
   the collection's own definitions further down the stylesheet — same
   specificity, later wins. Nothing sits below this, so nothing can.
   ================================================================== */
@media (max-width:767px){

  /* ---- the two modes, both stated ------------------------------------ */
  /* GRID: the pieces, and no featured piece at all. */
  .mycoll:not(.is-viewing) .mc-feat{ display:none !important }
  .mycoll:not(.is-viewing) .mc-col { display:flex !important }
  .mycoll:not(.is-viewing) .mc-minimap{
    display:grid !important;
    grid-template-columns:repeat(3, minmax(0,1fr));
    gap:8px;
  }
  .mycoll:not(.is-viewing) .mc-acts{ display:none !important }

  /* FULL: one piece, and nothing else. */
  .mycoll.is-viewing .mc-feat{
    display:block !important;
    position:fixed !important; inset:0 !important; z-index:70;
    max-width:none !important; width:auto !important;
    margin:0; border-radius:0; background:#12100e;
    aspect-ratio:auto !important;
  }
  .mycoll.is-viewing .mc-feat img{
    width:100% !important; height:100% !important; object-fit:contain !important;
  }
  .mycoll.is-viewing .mc-col,
  .mycoll.is-viewing .mc-head,
  .mycoll.is-viewing .mc-say,
  .mycoll.is-viewing .mc-filters,
  .mycoll.is-viewing .mc-onward{ display:none !important }

  /* The close control belongs to the full view and nothing else. */
  .mc-mode{
    position:fixed !important; z-index:72;
    top:14px; right:14px; bottom:auto; left:auto;
    width:46px; height:46px; border-radius:999px;
    display:none; place-items:center; cursor:pointer;
    background:rgba(18,16,14,.72); color:#fff;
    border:1px solid rgba(255,255,255,.34);
  }
  .mycoll.is-viewing .mc-mode{ display:grid !important }
  .mc-mode svg{ width:22px; height:22px; fill:none; stroke:currentColor; stroke-width:1.8 }

  /* ---- the tray ------------------------------------------------------ */
  /* What is chosen, what it costs, and the one press that goes on. It sits
     above the band because the band is the way out of this room and the
     tray is the way through it. */
  .lg-tray{
    position:fixed; left:0; right:0; bottom:118px; z-index:59;
    display:flex; align-items:center; gap:12px;
    padding:11px 14px;
    background:var(--vellum, #f3ede1);
    border-top:1px solid rgba(137,105,67,.28);
    box-shadow:0 -10px 26px rgba(0,0,0,.1);
    transform:translateY(130%);
    transition:transform .26s cubic-bezier(.3,.9,.3,1);
  }
  .lg-tray.is-up{ transform:none }
  .lg-tray .n{
    flex:1 1 auto; min-width:0;
    font-family:var(--serif); font-size:19px; color:var(--ink, #2a241e);
    line-height:1.2;
  }
  .lg-tray .n i{
    display:block; font-style:normal;
    font-family:var(--sans); font-size:11px; letter-spacing:.02em;
    color:var(--brass, #75623a); margin-top:2px;
  }
  .lg-tray button{
    flex:0 0 auto; border:0; cursor:pointer;
    font-family:var(--serif); font-style:italic; font-size:20px;
    padding:.5em 1.15em; border-radius:999px;
    background:var(--oxblood, #7d4242); color:#f6f1e7;
    min-height:44px;
  }
}
.lg-tray{ display:none }
@media (max-width:767px){ .lg-tray{ display:flex } }
"""

JS = """
<script>
/* ---- THE TRAY · phones ------------------------------------------------
   The workshop could take a choice and offer nothing to do with it: tick a
   finish, and no control said what happened next. The desktop's To Be
   Crafted rail carries that press and the phone hides the rail.

   This does not implement a craft. It presses the rail's own button, so
   there is exactly one route to a craft and this is a way of reaching it.
   Two implementations of the same press is two things to keep true. */
(function(){
  function boot(){
    if (document.getElementById('lgTray')) return;
    var rail = document.getElementById('tbc');
    var go   = document.getElementById('tbcGo');
    if (!rail || !go) return;

    var tray = document.createElement('div');
    tray.className = 'lg-tray';
    tray.id = 'lgTray';
    tray.innerHTML = '<div class="n"><b id="lgTrayN"></b><i id="lgTrayC"></i></div>' +
                     '<button type="button" id="lgTrayGo">Craft</button>';
    document.body.appendChild(tray);

    var n = document.getElementById('lgTrayN');
    var c = document.getElementById('lgTrayC');

    /* Everything is read from the rail, which is the one record of what has
       been chosen. Counting the tiles separately would be a second record
       and they would drift. */
    function paint(){
      var list = document.getElementById('tbcList');
      var count = list ? list.children.length : 0;
      tray.classList.toggle('is-up', count > 0);
      if (!count) return;
      n.textContent = count + (count === 1 ? ' finish chosen' : ' finishes chosen');
      var total = document.getElementById('tbcTotal');
      c.textContent = total ? total.textContent : '';
      var verb = document.getElementById('tbcGoVerb');
      document.getElementById('lgTrayGo').textContent =
        (verb && verb.textContent ? verb.textContent : 'Craft');
    }

    document.getElementById('lgTrayGo').addEventListener('click', function(){
      go.click();
    });

    if (window.MutationObserver){
      new MutationObserver(paint).observe(rail, {
        childList:true, subtree:true, characterData:true, attributes:true
      });
    }
    paint();
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
</script>
"""


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    if "lg-tray" in doc:
        raise SystemExit("Already applied. Nothing written.")

    nl = "\r\n" if "\r\n" in doc[:2000] else "\n"

    # the CSS goes at the end of the LAST stylesheet in the file
    last_style = doc.rfind("</style>")
    if last_style < 0:
        raise SystemExit("FAIL: no stylesheet found. Nothing written.")
    css = CSS if nl == "\n" else CSS.replace("\n", "\r\n")
    doc = doc[:last_style] + css + doc[last_style:]

    # the script goes before </body>
    close = "</body>"
    if doc.count(close) != 1:
        raise SystemExit("FAIL: expected one </body>, found %d" % doc.count(close))
    js = JS if nl == "\n" else JS.replace("\n", "\r\n")
    doc = doc.replace(close, js + close, 1)

    # gates
    # built in script, so the id is an assignment rather than an attribute
    if doc.count("tray.id = 'lgTray'") != 1:
        raise SystemExit("FAIL: the tray was not written once")
    if "go.click()" not in doc:
        raise SystemExit("FAIL: the tray does not press the rail's own button")
    if ".mycoll:not(.is-viewing) .mc-feat{ display:none !important }" not in doc:
        raise SystemExit("FAIL: grid mode was not stated")
    if ".mycoll.is-viewing .mc-mode{ display:grid !important }" not in doc:
        raise SystemExit("FAIL: the close control was not bound to the full view")
    # and it must genuinely be last
    if doc.rfind("PHONE \u00b7 THE COLLECTION'S TWO MODES") > doc.rfind("</style>"):
        raise SystemExit("FAIL: the block landed outside a stylesheet")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  the collection states both modes, last in the file")
    print("  tap a piece for full size, X for the grid")
    print("  the tray rises when a finish is chosen and presses Craft")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-phone-tray-and-modes.py <file.html>")
    main(sys.argv[1])
