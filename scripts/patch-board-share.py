#!/usr/bin/env python3
"""
patch-board-share.py  -  23 August 2026  -  CUI V32

TWO CHANGES, BOTH FROM CENG'S REPLY OF 23 AUGUST.

  1  HEARTS COME OFF THE GLASS. They have never worked. The live
     community_hearts table keys on viewer_hash and the heart route sends
     owner_key, so every insert fails; the count trigger from 018 was
     never applied, so heart_count is a dead column nothing writes.

     The card heart shipped yesterday paints itself filled before the
     request answers, so it looked as though it worked and reverted on
     reload. A control that lies is worse than no control.

     Rich ruled 23 August: hidden, not fixed, until after launch. The
     board's value is being seen and shared.

     Hidden with CSS and a `hidden` attribute rather than cut out. When
     the schema is reconciled this is one edit back, and cutting the
     markup would make it three.

  2  A SHARE BUTTON, which is the thing that was actually missing. Board
     images are permanent and public now - a second copy in a public
     bucket, made at post time. Nothing on the page offered that link, so
     it was reachable only by right-click.

     GATED ON p.shareable, WHICH MUST BE READ AND NOT ASSUMED. The two
     posts already on the board are false and stay false; their image_url
     is still a 24-hour signature and handing that to somebody is handing
     them a link that dies overnight.

READS   D:\\minramas\\public\\community.html
WRITES  %USERPROFILE%\\Downloads\\community.html
"""

import os
import sys

REPO = r"D:\minramas\public"
OUT = os.path.join(os.environ.get("USERPROFILE", os.path.expanduser("~")),
                   "Downloads")
PAGE = "community.html"

EDITS = []

# ---- 1 · CSS: hide the counts, style the share control ------------------
EDITS.append((
    ".pc-counts{ display:flex; align-items:center; gap:.7rem; white-space:nowrap }",

    "/* HEARTS AND COMMENT COUNTS ARE OFF THE BOARD. Neither is wired to\r\n"
    "   anything that works - see the header of patch-board-share.py. Held\r\n"
    "   as display:none rather than cut, so switching them back on is one\r\n"
    "   line when the schema is reconciled. */\r\n"
    ".pc-counts{ display:none }\r\n"
    ".pc-counts-off{ display:flex; align-items:center; gap:.7rem; white-space:nowrap }"
))

EDITS.append((
    ".pc-heart.is-hearted svg{ fill:var(--oxblood); stroke:var(--oxblood) }",

    ".pc-heart.is-hearted svg{ fill:var(--oxblood); stroke:var(--oxblood) }\r\n"
    "\r\n"
    "/* THE SHARE CONTROL. Sized as a control, not a caption - 1.1rem serif\r\n"
    "   italic in a pill, which is the house shape for an action. A link\r\n"
    "   that reads as a caption does not get pressed. */\r\n"
    ".pc-share{\r\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.1rem;\r\n"
    "  line-height:1; white-space:nowrap;\r\n"
    "  padding:.5rem .8rem; border-radius:999px;\r\n"
    "  background:none; color:var(--oxblood);\r\n"
    "  border:1px solid var(--oxblood); cursor:pointer;\r\n"
    "  transition:background .16s ease, color .16s ease;\r\n"
    "}\r\n"
    ".pc-share:hover{ background:var(--oxblood); color:var(--vellum-100) }\r\n"
    ".pc-share:focus-visible{ outline:2px solid var(--gold); outline-offset:2px }\r\n"
    "/* Said once, in place, and gone. No toast, no banner. */\r\n"
    ".pc-share.is-done{\r\n"
    "  background:var(--oxblood); color:var(--vellum-100);\r\n"
    "}"
))

# ---- 2 · the card: counts hidden, share offered -------------------------
EDITS.append((
    "          '<span class=\"pc-counts\">' +\r\n"
    "            '<button type=\"button\" class=\"pc-heart' +\r\n"
    "              (HEARTED[p.id] ? ' is-hearted' : '') + '\">' +\r\n"
    "              heartsSvg() + (p.heart_count || 0) + '</button>' +\r\n"
    "            '<span>' + cmtsSvg() + (p.comment_count || 0) + '</span>' +\r\n"
    "          '</span>' +",

    "          /* SHARE, WHERE THE COUNTS WERE. Offered only when CENG says\r\n"
    "             the image is permanent. A false here means image_url is\r\n"
    "             still a 24-hour signature, and handing somebody a link\r\n"
    "             that dies overnight is worse than offering nothing. */\r\n"
    "          (p.shareable && p.image_url\r\n"
    "            ? '<button type=\"button\" class=\"pc-share\">Share</button>'\r\n"
    "            : '') +\r\n"
    "          '<span class=\"pc-counts\">' +\r\n"
    "            '<button type=\"button\" class=\"pc-heart' +\r\n"
    "              (HEARTED[p.id] ? ' is-hearted' : '') + '\">' +\r\n"
    "              heartsSvg() + (p.heart_count || 0) + '</button>' +\r\n"
    "            '<span>' + cmtsSvg() + (p.comment_count || 0) + '</span>' +\r\n"
    "          '</span>' +"
))

# ---- 3 · the lightbox heart, hidden -------------------------------------
EDITS.append((
    '        <button type="button" class="heart" id="postHeart">',

    '        <!-- Hidden 23 August. Hearts have never written a row; see\r\n'
    '             patch-board-share.py. Kept in the markup because turning\r\n'
    '             them back on should be one attribute. -->\r\n'
    '        <button type="button" class="heart" id="postHeart" hidden>'
))

# ---- 4 · the share handler ----------------------------------------------
# Sits with the other wall handlers. The heart handler above it already
# returns on its own target, so the two do not race.
EDITS.append((
    "  /* THE HEART, ON THE CARD. Checked before anything else and returns,\r\n"
    "     so a press here never falls through to the piece beneath it. */",

    "  /* SHARE. Checked first, and returns - a press here must not open the\r\n"
    "     piece underneath it.\r\n"
    "\r\n"
    "     THE CLIPBOARD CAN REFUSE. It needs a secure context and, in some\r\n"
    "     browsers, a permission. When it does refuse the link is selected\r\n"
    "     in a prompt instead, so the customer can still take it - a Share\r\n"
    "     button that silently does nothing is the fault this replaced. */\r\n"
    "  wallCols.addEventListener('click', function(e){\r\n"
    "    var b = e.target.closest('.pc-share'); if (!b) return;\r\n"
    "    var c = b.closest('.pc'); if (!c) return;\r\n"
    "    e.stopPropagation();\r\n"
    "\r\n"
    "    var p = findPost(c.dataset.postId);\r\n"
    "    if (!p || !p.image_url) return;\r\n"
    "\r\n"
    "    function said(){\r\n"
    "      b.classList.add('is-done');\r\n"
    "      b.textContent = 'Link copied';\r\n"
    "      setTimeout(function(){\r\n"
    "        b.classList.remove('is-done');\r\n"
    "        b.textContent = 'Share';\r\n"
    "      }, 1800);\r\n"
    "    }\r\n"
    "\r\n"
    "    if (navigator.clipboard && navigator.clipboard.writeText){\r\n"
    "      navigator.clipboard.writeText(p.image_url).then(said, function(){\r\n"
    "        window.prompt('Copy this link', p.image_url);\r\n"
    "      });\r\n"
    "    } else {\r\n"
    "      window.prompt('Copy this link', p.image_url);\r\n"
    "    }\r\n"
    "  });\r\n"
    "\r\n"
    "  /* THE HEART, ON THE CARD. Dead while hearts are hidden - the button\r\n"
    "     is display:none, so this cannot fire. Left in place because the\r\n"
    "     day the schema is reconciled it should work again untouched.\r\n"
    "\r\n"
    "     Checked before the piece opens, so a press here never falls\r\n"
    "     through to the card beneath it. */"
))

# ---- 5 · dblclick ignores the share button ------------------------------
EDITS.append((
    "    if (e.target.closest('.pc-heart')) return;",
    "    if (e.target.closest('.pc-heart') || e.target.closest('.pc-share')) return;"
))


def main():
    apply_it = "--apply" in sys.argv
    print("patch-board-share  -  %s" % ("APPLY" if apply_it else "DRY RUN"))
    print("")

    src = os.path.join(REPO, PAGE)
    dst = os.path.join(OUT, PAGE)

    if not os.path.isfile(src):
        print("  MISSING  %s" % src)
        sys.exit(1)

    with open(src, "r", encoding="utf-8", newline="") as fh:
        text = fh.read()

    for i, (anchor, _) in enumerate(EDITS):
        n = text.count(anchor)
        if n != 1:
            print("  REFUSE   edit %d: anchor found %d times, expected 1"
                  % (i + 1, n))
            print("           first line: %s" % anchor.splitlines()[0][:70])
            sys.exit(1)

    out = text
    for anchor, replace in EDITS:
        out = out.replace(anchor, replace, 1)

    checks = [
        (".pc-counts{ display:none }", 1),
        (".pc-share{", 1),
        ("p.shareable && p.image_url", 1),
        ("closest('.pc-share')", 2),
        ('id="postHeart" hidden', 1),
        ("navigator.clipboard.writeText", 2),
    ]
    ok = True
    for needle, want in checks:
        got = out.count(needle)
        if got != want:
            print("  REFUSE   verify: '%s' found %d, expected %d"
                  % (needle, got, want))
            ok = False
    if not ok:
        sys.exit(1)

    if len(out) <= len(text):
        print("  REFUSE   result did not grow")
        sys.exit(1)

    print("  OK       %d edits, all anchors unique, all checks passed"
          % len(EDITS))

    if not apply_it:
        print("           would write %s" % dst)
        print("")
        print("  Re-run with --apply to write.")
        return

    if not os.path.isdir(OUT):
        print("  REFUSE   %s does not exist" % OUT)
        sys.exit(1)

    with open(dst, "w", encoding="utf-8", newline="") as fh:
        fh.write(out)
    print("  WROTE    %s" % dst)


if __name__ == "__main__":
    main()
