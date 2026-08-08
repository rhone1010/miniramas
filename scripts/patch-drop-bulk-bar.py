#!/usr/bin/env python3
"""
THE THIRD SET OF BUTTONS

My Collection was showing two overlapping sets of Download and Send to Print
Shop. Both were doing the same job for the same piece, because batch
selection was ruled out for V1 and its furniture was never removed:

    "Batch selection is out for V1 — a tick for many and a click for one
     were two mechanisms answering the same question."

The bulk bar has been a fixed panel at the centre of the screen ever since,
appearing whenever anything was selected. It looked like a stray set of
buttons rather than a panel because the styling that would have made it one
sits on `.mc-bulk-unused`, a class nothing uses — so somebody had already
started removing this and stopped halfway.

WHAT REMAINS

  · click a piece  → it becomes the featured piece
  · the featured piece has Download and Send to Print Shop
  · click the featured image → full size

One target, one set of actions, which is the rule as written.

WHAT IS KEPT

`PICKED` and `choosePiece` stay. They hold exactly one piece and the
featured actions read them, so removing them would mean rewriting a working
path to no end. `updateBulk` becomes a no-op rather than being deleted from
its six call sites — a function that does nothing is cheaper and safer than
six edits, and the comment says why it is empty.

Usage:  python scripts\\patch-drop-bulk-bar.py public\\portraits.html
"""
import io
import sys

# ── markup ────────────────────────────────────────────────────────────
OLD_MARKUP = """    <div class="mc-bulk" id="mcBulk">
      <span class="mc-bulk-n" id="mcBulkN"></span>
      <button class="mc-act is-fill" id="mcDownload" type="button">Download</button>
      <button class="mc-act" id="mcPrint" type="button">Send to Print Shop</button>
      <button class="mc-act" id="mcClear" type="button">Clear</button>
    </div>"""

NEW_MARKUP = """    <!-- The bulk bar was removed 2026-08-07. Batch selection was ruled out
         for V1 and this was its furniture: a second Download and Send for
         the same single piece the featured actions already serve. One
         target, one set of actions. -->"""

# ── the toggle ────────────────────────────────────────────────────────
OLD_UPDATE = """  function updateBulk(){
    if (!mcBulk) return;
    var n = mcCount();
    /* "1 selected" is a count of a thing that can only be one. The name
       of the piece is the useful label. */
    if (mcBulkN){
      var one = null;
      PIECES.forEach(function(p){ if (PICKED[p.id]) one = p; });
      mcBulkN.textContent = one ? (one.name || 'Crafted Image') : '';
    }
    mcBulk.classList.toggle('is-up', n > 0);
  }"""

NEW_UPDATE = """  /* Deliberately empty. The bulk bar it drove is gone, and it is called
     from six places — a no-op here is one edit instead of six, and it
     leaves the call sites reading as they always did. */
  function updateBulk(){}"""

# ── the handlers ──────────────────────────────────────────────────────
OLD_HANDLERS = """  var mcDownload = document.getElementById('mcDownload');
  var mcPrint    = document.getElementById('mcPrint');
  var mcClear    = document.getElementById('mcClear');
  if (mcDownload) mcDownload.addEventListener('click', function(){
    var picked = PIECES.filter(function(p){ return PICKED[p.id] && p.art; });
    if (!picked.length) return;
    flash(mcDownload, picked.length > 1
      ? ('Saving ' + picked.length + ' \\u2713') : 'Saving \\u2713', 'Download');
    downloadMany(picked);
  });
  /* Was a flash over nothing. The Print Shop exists now, so this opens it
     with the picked pieces already on the wall. */
  if (mcPrint) mcPrint.addEventListener('click', function(){
    var picked = PIECES.filter(function(p){ return PICKED[p.id] && printable(p); });
    sendToPrintShop(picked);
    if (picked.length === 1){ PS_PIECE = picked[0]; PS_OPT = 0; }
    psView('wall');
    showPrintShop();
  });
  if (mcClear) mcClear.addEventListener('click', function(){
    PICKED = {};
    [].forEach.call(mcGrid.querySelectorAll('.piece'), function(el){ el.classList.remove('is-picked'); });
    updateBulk();
  });"""

NEW_HANDLERS = """  /* The bulk bar's handlers went with it. Download and Send now live only
     on the featured piece, in renderCollection, where the piece being
     acted on is the piece being looked at. */"""

# ── the styles ────────────────────────────────────────────────────────
OLD_CSS_A = """.mc-bulk{
  position:fixed; z-index:60; left:50%; top:50%;
  transform:translate(-50%, -50%) scale(.96);
  opacity:0; pointer-events:none;
  transition:opacity .28s ease, transform .28s cubic-bezier(.16,1,.3,1);
}
.mc-bulk.is-up{ opacity:1; pointer-events:auto; transform:translate(-50%,-50%) scale(1) }"""

NEW_CSS_A = """/* .mc-bulk and .mc-bulk-unused were removed 2026-08-07 with the bar they
   dressed. The half-renamed class was the tell that this was already
   half-removed: the panel styling sat on a name nothing used, so the bar
   rendered as three loose buttons over the collection. */"""

OLD_CSS_B = """.mc-bulk.is-up{ transform:translate(-50%, 0) }"""
NEW_CSS_B = """"""


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

    if 'id="mcBulk"' not in doc:
        raise SystemExit("Already applied. Nothing written.")

    doc = swap(doc, "the bulk markup", OLD_MARKUP, NEW_MARKUP)
    doc = swap(doc, "updateBulk", OLD_UPDATE, NEW_UPDATE)
    doc = swap(doc, "the bulk handlers", OLD_HANDLERS, NEW_HANDLERS)
    doc = swap(doc, "the bulk styles", OLD_CSS_A, NEW_CSS_A)
    doc = swap(doc, "the second is-up rule", OLD_CSS_B, NEW_CSS_B, required=False)

    # the two lookups the bar left behind: they resolve to null and read as
    # if the element were still expected.
    doc = swap(doc, "the bulk lookups",
        """  var mcBulk   = document.getElementById('mcBulk');
  var mcBulkN  = document.getElementById('mcBulkN');
""", "")

    # gates
    if "mcBulk" in doc:
        raise SystemExit("FAIL: a reference to the bulk bar survives")
    for gone in ['id="mcDownload"', 'id="mcPrint"', 'id="mcClear"']:
        if gone in doc:
            raise SystemExit("FAIL: %s survives" % gone)
    if doc.count("Send to Print Shop") != 2:
        raise SystemExit("FAIL: expected the featured action and the lightbox, found %d"
                         % doc.count("Send to Print Shop"))
    # the working path must be untouched
    for must in ["function choosePiece(id)", "id=\"mcPr1\"", "id=\"mcDl1\"",
                 "function updateBulk()"]:
        if must not in doc:
            raise SystemExit("FAIL: %s was lost" % must)

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  the bulk bar is gone: markup, styles and handlers")
    print("  Download and Send remain on the featured piece only")
    print("  choosePiece and PICKED untouched")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-drop-bulk-bar.py <file.html>")
    main(sys.argv[1])
