#!/usr/bin/env python3
"""
THREE ON THE PHONE

**1 · The upsell panels came back.**

`.mc-onward{ display:none }` was correct and lost anyway, because the panel
is drawn by script that sets `wrap.hidden = false` — and `hidden` is only a
CSS default, so a rule with any weight at all beats it. Setting display:none
does not stop the script running either; it just hides the result.

Now the script does not run on a phone. Nothing is built, nothing is
measured, and the collection is the pieces.

**2 · Two icons where a tap would do.**

The square and the grid buttons were a mode switch drawn as two controls.
Rich's ruling: tap an image, it opens; an X closes it. That is what a
photograph does everywhere else on a phone, and it needs no legend.

**3 · The way back was invisible.**

`.phone-back` was given `color: rgba(243,237,225,.58)` — light text — on a
transparent ground, and the crumb on the worlds screen sits over limestone.
Light on light. It was there, and it could not be seen.

It becomes what the note asked for: quiet but present. Dark text, a hairline,
a faint ground — legible against stone, and clearly the lesser of the two
pills beside "All effects".

Usage:  python scripts\\patch-phone-three.py public\\portraits.html
"""
import io
import sys

# ── 1 · the onward panel does not build on a phone ───────────────────
OLD_ONWARD = """    wrap.hidden = false;
    wrap.innerHTML = '';"""

NEW_ONWARD = """    /* Not on a phone. Ruled 2026-08-08: three panels of things to buy
       sat between a person and their own work, and hiding them was not
       enough — this function still built them, still measured them, and
       `wrap.hidden = false` beat the rule that hid them, because [hidden]
       is a default and any rule outranks it. */
    if (window.matchMedia && window.matchMedia('(max-width:767px)').matches){
      wrap.hidden = true;
      wrap.innerHTML = '';
      return;
    }
    wrap.hidden = false;
    wrap.innerHTML = '';"""

# ── 2 · the mode buttons become a tap and an X ───────────────────────
OLD_ICONS = """    var ICON = {
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
    });"""

NEW_ICONS = """    /* One control, not two. A tap opens a piece — which is what a
       photograph does everywhere else on a phone and needs no legend —
       and an X closes it. The square-and-grid pair was a mode switch
       asking to be learned. */
    var b = document.createElement('button');
    b.className = 'mc-mode';
    b.type = 'button';
    b.setAttribute('data-mode', 'grid');
    b.setAttribute('aria-label', 'Close');
    b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    mycoll.appendChild(b);"""

# ── 3 · the styles ───────────────────────────────────────────────────
OLD_CSS = """  .mycoll:not(.is-viewing) .mc-mode[data-mode="grid"]{ display:none }
  .mycoll.is-viewing .mc-mode[data-mode="full"]{ display:none }
  .mycoll.is-viewing .mc-mode{ bottom:22px }"""

NEW_CSS = """  /* Only while a piece is open — there is nothing to close otherwise. */
  .mycoll:not(.is-viewing) .mc-mode{ display:none }
  .mycoll.is-viewing .mc-mode{ top:14px; right:14px; bottom:auto }"""

OLD_BACK = """  .phone-back{
    border-radius:6px;
    background:transparent;
    border-color:rgba(196,169,110,.2);
    color:rgba(243,237,225,.58);
    box-shadow:none;
  }"""

NEW_BACK = """  /* Quiet, and legible. It was light text on a transparent ground over
     limestone — present and invisible. Quiet means the lesser of two
     pills, not the unreadable one. */
  .phone-back{
    border-radius:6px;
    background:rgba(255,255,255,.42);
    border-color:rgba(88,65,42,.26);
    color:rgba(58,42,32,.78);
    box-shadow:none;
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

    if "Not on a phone. Ruled 2026-08-08" in doc:
        raise SystemExit("Already applied. Nothing written.")

    doc = swap(doc, "the onward builder", OLD_ONWARD, NEW_ONWARD)
    doc = swap(doc, "the mode icons", OLD_ICONS, NEW_ICONS)
    doc = swap(doc, "the mode styles", OLD_CSS, NEW_CSS)
    doc = swap(doc, "the back pill", OLD_BACK, NEW_BACK)

    # gates
    # the setAttribute and the two rules that read it
    if doc.count("data-mode") != 2:
        raise SystemExit("FAIL: expected the control and its rules, found %d"
                         % doc.count("data-mode"))
    if "M6 6l12 12M18 6L6 18" not in doc:
        raise SystemExit("FAIL: the close control was not written")
    if "rgba(58,42,32,.78)" not in doc:
        raise SystemExit("FAIL: the back pill is still light on light")
    if "wrap.hidden = true;" not in doc:
        raise SystemExit("FAIL: the onward panel still builds on a phone")
    # the desktop must still get its panels
    if doc.count("wrap.hidden = false;") != 1:
        raise SystemExit("FAIL: the desktop path was disturbed")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  the onward panels do not build on a phone at all")
    print("  tap a piece to open it, X to close")
    print("  the way back is legible against limestone")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-phone-three.py <file.html>")
    main(sys.argv[1])
