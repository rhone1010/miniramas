#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-mobile-r3.py  -  CUI 41A  -  23 August 2026

Rich's 6 and 7.

  6  ENTER THE ROOM, NOT THE UPLOAD SCREEN. On a phone the first thing a
     person met was an empty box asking for a photograph, with nothing yet
     shown to explain why they would give one. They now land on the
     effects floor and look first. The photograph is asked for at the
     moment it is actually needed -- pressing an effect -- in a modal that
     takes them to the upload screen.

     The gate is on addToQueue, which is the single door: the effect
     cards, the 'Add all' card and the band all pass through it. One
     check, not four.

  7  THE ROOM CARD SAYS TOO MUCH ON A PHONE. Six lines -- eyebrow, title,
     sub, count, price, tier -- in a card the width of a thumb. The title,
     the count and the price stay; those are the offer. The rest is voice
     that has room on a desktop and does not here.

Applies to portraits.html, pets.html, groups.html. Needs r1 and r2.
Reads <repo>\\public. Writes to Downloads. Must be installed to scripts\\.
"""

import os
import sys
import io

FILES = ["portraits.html", "pets.html", "groups.html"]

# ----------------------------------------------------------------------
# A . THE MODAL
# ----------------------------------------------------------------------
A_OLD = "<div class=\"scrim m-scrim\" id=\"queueFullModal\" data-role=\"modal\">"
A_NEW = (
    "<!-- CUI 41A, 23 Aug 2026. The one thing standing between a person and\n"
    "     an effect they have just pressed. Shaped like the cap modal\n"
    "     because it is the same kind of moment: a thing they asked for,\n"
    "     not yet possible, and a way forward in the same breath. Phone\n"
    "     only -- on a desktop the upload card is on the screen already. -->\n"
    "<div class=\"scrim m-scrim\" id=\"needPhotoModal\" data-role=\"modal\">\n"
    "  <div class=\"modal m-modal\" role=\"dialog\" aria-modal=\"true\">\n"
    "    <div class=\"mclose\" id=\"npClose\">&times;</div>\n"
    "    <div class=\"state active cap-body\">\n"
    "      <div class=\"mcur\"><img class=\"mc-mark\" src=\"/icons/curator-c.svg\" alt=\"\">\n"
    "        <div class=\"mcur-say\">A fine choice. I will need a photograph to\n"
    "          work from before I can begin &mdash; bring me one and we will\n"
    "          come straight back here.\n"
    "          <span class=\"sig\">&mdash;&thinsp;C.</span></div></div>\n"
    "      <div class=\"acts\"><div class=\"btn fill\" id=\"npGo\">Add your photograph</div>\n"
    "        <div class=\"btn ghost\" id=\"npBack\">Keep looking</div></div>\n"
    "    </div>\n"
    "  </div>\n"
    "</div>\n"
    "\n"
    "<div class=\"scrim m-scrim\" id=\"queueFullModal\" data-role=\"modal\">"
)

# ----------------------------------------------------------------------
# B . THE GATE
# ----------------------------------------------------------------------
B_OLD = (
    "  function addToQueue(siloId, effectId){\n"
    "    /* They have moved on. The note about the last run stops standing. */\n"
    "    SUB_NOTE = null;\n"
    "    if (inQueue(siloId, effectId)) return true;"
)
B_NEW = (
    "  /* CUI 41A, 23 Aug 2026. Ruled by Rich: on a phone the room comes\n"
    "     first and the photograph is asked for here, at the press. Read off\n"
    "     the Curator card's own data-state rather than the phone-step\n"
    "     closure's hasPhoto -- one record, and this sits 4,800 lines above\n"
    "     that IIFE. */\n"
    "  function phoneNeedsPhoto(){\n"
    "    if (!window.matchMedia || !window.matchMedia('(max-width:767px)').matches) return false;\n"
    "    var card = document.getElementById('cur');\n"
    "    return !!card && card.getAttribute('data-state') === 'empty';\n"
    "  }\n"
    "\n"
    "  function addToQueue(siloId, effectId){\n"
    "    /* They have moved on. The note about the last run stops standing. */\n"
    "    SUB_NOTE = null;\n"
    "    if (inQueue(siloId, effectId)) return true;\n"
    "    /* Before the cap, because a person with no photograph has no queue\n"
    "       to have filled. */\n"
    "    if (phoneNeedsPhoto()){ openNeedPhoto(); return false; }"
)

# ----------------------------------------------------------------------
# C . OPENING AND CLOSING IT
# ----------------------------------------------------------------------
C_OLD = (
    "  /* the cap, explained */\n"
    "  var capModal = document.getElementById('queueFullModal');\n"
    "  function openCap(){ if (capModal) capModal.classList.add('is-open'); }\n"
    "  function closeCap(){ if (capModal) capModal.classList.remove('is-open'); }"
)
C_NEW = (
    "  /* the photograph, asked for */\n"
    "  var needPhotoModal = document.getElementById('needPhotoModal');\n"
    "  function openNeedPhoto(){ if (needPhotoModal) needPhotoModal.classList.add('is-open'); }\n"
    "  function closeNeedPhoto(){ if (needPhotoModal) needPhotoModal.classList.remove('is-open'); }\n"
    "  if (needPhotoModal){\n"
    "    ['npClose','npBack'].forEach(function(id){\n"
    "      var el = document.getElementById(id);\n"
    "      if (el) el.addEventListener('click', closeNeedPhoto);\n"
    "    });\n"
    "    var npGo = document.getElementById('npGo');\n"
    "    if (npGo) npGo.addEventListener('click', function(){\n"
    "      closeNeedPhoto();\n"
    "      /* __phoneStep is published by the phone-step IIFE further down.\n"
    "         Guarded because this file is also served to a desktop, where\n"
    "         it does not exist. */\n"
    "      if (typeof window.__phoneStep === 'function') window.__phoneStep('upload');\n"
    "    });\n"
    "  }\n"
    "\n"
    "  /* the cap, explained */\n"
    "  var capModal = document.getElementById('queueFullModal');\n"
    "  function openCap(){ if (capModal) capModal.classList.add('is-open'); }\n"
    "  function closeCap(){ if (capModal) capModal.classList.remove('is-open'); }"
)

# ----------------------------------------------------------------------
# D . LAND ON THE FLOOR
# ----------------------------------------------------------------------
D_OLD = (
    "      if (!rooms.classList.contains('phone-step--upload') &&\n"
    "          !rooms.classList.contains('phone-step--work')){\n"
    "        step(hasPhoto() ? 'work' : 'upload');\n"
    "        return;\n"
    "      }\n"
    "      if (!hasPhoto()) step('upload');"
)
D_NEW = (
    "      if (!rooms.classList.contains('phone-step--upload') &&\n"
    "          !rooms.classList.contains('phone-step--work')){\n"
    "        /* CUI 41A, 23 Aug 2026. Was: hasPhoto() ? 'work' : 'upload'.\n"
    "           A first visit opened on an empty box asking for a face,\n"
    "           before anything had been shown that would explain why. The\n"
    "           floor comes first now, always. The photograph is asked for\n"
    "           at the press, by needPhotoModal. */\n"
    "        step('work');\n"
    "        return;\n"
    "      }\n"
    "      /* The line that stood here forced 'upload' on every sync while\n"
    "         there was no photograph, which under the rule above would\n"
    "         throw a person off the floor the moment they turned the\n"
    "         phone. */"
)

# ----------------------------------------------------------------------
# E . AND STAY THERE
# ----------------------------------------------------------------------
E_OLD = (
    "      /* Losing the photograph still returns on its own — there is nothing\n"
    "         to stay for and nothing to decide. */\n"
    "      if (!wasEmpty && empty) step('upload');"
)
E_NEW = (
    "      /* CUI 41A, 23 Aug 2026. It no longer returns. Under the rule\n"
    "         above the floor is worth staying on with no photograph -- that\n"
    "         is now the ordinary first visit -- and a person who has just\n"
    "         cleared a photograph deliberately has not asked to be moved. */"
)

# ----------------------------------------------------------------------
# F . THE CARD, QUIETER
# ----------------------------------------------------------------------
F_OLD = "  .mh-series-btn{ max-width:34vw }"
F_NEW = (
    "  .mh-series-btn{ max-width:34vw }\n"
    "\n"
    "  /* ---- THE ROOM CARD  ------------------------------------------------\n"
    "     CUI 41A, 23 Aug 2026. Six lines of copy in a card a thumb wide.\n"
    "     What survives is the offer: what it is, how many, what it costs.\n"
    "     The eyebrow, the sub-line and the tier line are register, and\n"
    "     register is what a small screen has least room for. They keep\n"
    "     their place on a desktop. */\n"
    "  .silo-card.is-upsell .up-eyebrow,\n"
    "  .silo-card.is-upsell .up-sub,\n"
    "  .silo-card.is-upsell .up-tier{ display:none }\n"
    "  .silo-card.is-upsell .up-title{ font-size:1.5rem; line-height:1.15 }\n"
    "  .silo-card.is-upsell .up{ gap:10px }\n"
)

EDITS = [
    ("A . the modal",                         A_OLD, A_NEW),
    ("B . the gate on addToQueue",            B_OLD, B_NEW),
    ("C . opened and closed",                 C_OLD, C_NEW),
    ("D . a phone lands on the floor",        D_OLD, D_NEW),
    ("E . and is not thrown off it",          E_OLD, E_NEW),
    ("F . the room card loses three lines",   F_OLD, F_NEW),
]

MUST_APPEAR = [
    "id=\"needPhotoModal\"",
    "if (phoneNeedsPhoto()){ openNeedPhoto(); return false; }",
    "function closeNeedPhoto()",
    "window.__phoneStep('upload');",
    ".silo-card.is-upsell .up-tier{ display:none }",
]
# Split so the check cannot be satisfied by this patch's own comments.
MUST_VANISH = [
    "step(hasPhoto() ? 'work' : " + "'upload');",
    "if (!wasEmpty && empty) step(" + "'upload');",
]


def crlf(s):
    return s.replace("\n", "\r\n")


def run(src_dir, out_dir, apply):
    ok = True
    for name in FILES:
        src = os.path.join(src_dir, name)
        print("")
        print("=" * 66)
        print(name)
        print("=" * 66)

        if not os.path.isfile(src):
            print("  REFUSED: not found -- %s" % src)
            ok = False
            continue

        f = io.open(src, "r", encoding="utf-8", newline="")
        text = f.read()
        f.close()
        before = len(text)

        halt = False
        for label, old, new in EDITS:
            n = text.count(crlf(old))
            if n != 1:
                print("  REFUSED: anchor found %d times, need 1 -- %s" % (n, label))
                halt = True
            if crlf(new) in text:
                print("  REFUSED: replacement already present -- %s" % label)
                halt = True
        if halt:
            print("  (r1 and r2 must be installed before r3.)")
            ok = False
            continue

        for label, old, new in EDITS:
            text = text.replace(crlf(old), crlf(new), 1)
            print("  ok   %s" % label)

        halt = False
        for s in MUST_APPEAR:
            if crlf(s) not in text:
                print("  REFUSED: missing after edit -- %s" % s)
                halt = True
        for s in MUST_VANISH:
            if crlf(s) in text:
                print("  REFUSED: still present after edit -- %s" % s)
                halt = True
        if halt:
            ok = False
            continue

        print("  %d bytes -> %d  (+%d)" % (before, len(text), len(text) - before))

        if apply:
            dst = os.path.join(out_dir, name)
            g = io.open(dst, "w", encoding="utf-8", newline="")
            g.write(text)
            g.close()
            print("  WROTE %s" % dst)
        else:
            print("  DRY RUN -- nothing written")

    print("")
    if not ok:
        print("ONE OR MORE FILES REFUSED. Nothing partial was written.")
        return 1
    print("All files clean.")
    return 0


if __name__ == "__main__":
    apply = "--apply" in sys.argv
    home = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    downloads = os.path.join(home, "Downloads")

    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)

    out_dir = downloads
    src_dir = ""
    for a in sys.argv[1:]:
        if a.startswith("--src="):
            src_dir = a[6:]
        if a.startswith("--out="):
            out_dir = a[6:]

    if not src_dir:
        src_dir = os.path.join(repo, "public")

    if not os.path.isdir(src_dir):
        print("")
        print("REFUSED: no public/ at %s" % src_dir)
        print("This script derives the repo from its own location and must")
        print("be installed to scripts\\ before it is run.")
        sys.exit(1)

    print("")
    print("reading  %s" % src_dir)
    print("writing  %s" % out_dir)
    sys.exit(run(src_dir, out_dir, apply))
