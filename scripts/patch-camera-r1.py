#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-camera-r1.py  -  CUI 41A  -  24 August 2026

TAKE A PHOTO, RIGHT FROM THE SOURCE SCREEN.

Ruled by Rich: a person should be able to open their camera from the
upload step and shoot straight into the intake. On a phone the capture
attribute opens the native camera app; the flip control (front/rear) is
the camera's own, so we build no switching. On a desktop capture is
ignored and the button opens the file picker -- graceful, no harm.

The default camera differs by room:
  - portraits, halloween          -> capture="user"        (selfie)
  - pets, pets-halloween,
    pets-chooser, groups          -> capture="environment" (rear)

The photo lands in the exact same handler as an uploaded file --
onSourceFile (or onSourceFiles for groups' multi-input) -- so nothing
downstream changes: same intake checks, same analyze route, same crafting.

Three edits per room:
  A  a second hidden input, id="srcCamera", with the room's capture mode
  B  a "Take a photo" pill under the slot
  C  the pill opens the camera; its change event feeds the same handler
"""
import os, sys, io

# room -> (capture mode, plural handler?)
ROOMS = {
    "portraits.html":      ("user",        False),
    "halloween.html":      ("user",        False),
    "pets.html":           ("environment", False),
    "pets-halloween.html": ("environment", False),
    "pets-chooser.html":   ("environment", False),
    "groups.html":         ("environment", True),
}


def normalise(s): return s.replace("\r\n", "\n").replace("\r", "\n")


def build_edits(mode, plural):
    # A. the camera input, added right after the picker input
    if plural:
        a_old = '<input type="file" id="srcFile" accept="image/*" multiple hidden>'
    else:
        a_old = '<input type="file" id="srcFile" accept="image/*" hidden>'
    a_new = (
        a_old + '\n'
        '          <!-- CUI 41A, 24 Aug 2026. The camera. capture opens the\n'
        '               native camera app on a phone; its own flip control\n'
        '               covers front/rear. Ignored on a desktop, where this\n'
        '               opens the picker like its sibling. -->\n'
        '          <input type="file" id="srcCamera" accept="image/*" capture="' + mode + '" hidden>'
    )

    # B. the pill, after the slot closes. Anchor: the slot's sub-line span
    #    plus the closing div. cur-slot-s text differs per room, so anchor
    #    on the div boundary that follows it.
    b_old = (
        '          </div>\n'
        '          <div class="cur-thumb">'
    )
    b_new = (
        '          </div>\n'
        '          <!-- CUI 41A, 24 Aug 2026. The other way in. -->\n'
        '          <button class="cur-camera" id="curCamera" type="button">Take a photo</button>\n'
        '          <div class="cur-thumb">'
    )

    # C. wiring: pill click opens the camera input; camera change feeds
    #    the same handler as the picker. Anchor on the existing change
    #    listener.
    if plural:
        c_old = (
            "  if (srcFile) srcFile.addEventListener('change', function(){\n"
            "    onSourceFiles(srcFile.files);\n"
            "    srcFile.value = '';           /* same file twice must still fire change */\n"
            "  });"
        )
        c_feed = "onSourceFiles(srcCamera.files);"
    else:
        c_old = (
            "  if (srcFile) srcFile.addEventListener('change', function(){\n"
            "    onSourceFile(srcFile.files && srcFile.files[0]);\n"
            "    srcFile.value = '';           /* same file twice must still fire change */\n"
            "  });"
        )
        c_feed = "onSourceFile(srcCamera.files && srcCamera.files[0]);"

    c_new = (
        c_old + "\n"
        "\n"
        "  /* CUI 41A, 24 Aug 2026. The camera lands in the same intake as an\n"
        "     upload. One handler, two doors. */\n"
        "  var srcCamera = document.getElementById('srcCamera');\n"
        "  var curCamera = document.getElementById('curCamera');\n"
        "  if (curCamera && srcCamera){\n"
        "    curCamera.addEventListener('click', function(e){\n"
        "      e.stopPropagation();\n"
        "      srcCamera.click();\n"
        "    });\n"
        "    srcCamera.addEventListener('change', function(){\n"
        "      " + c_feed + "\n"
        "      srcCamera.value = '';\n"
        "    });\n"
        "  }"
    )

    # D. the pill's clothes. Substantial, per the standing rule on action
    #    controls: italic serif, 1.15rem, real padding, oxblood outline.
    d_old = ".cur-slot-s{ font-family:var(--serif); font-size:1.125rem; color:var(--ink-soft); line-height:1.35 }"
    d_new = (
        ".cur-slot-s{ font-family:var(--serif); font-size:1.125rem; color:var(--ink-soft); line-height:1.35 }\n"
        "\n"
        "/* CUI 41A, 24 Aug 2026. The camera pill. Sized to the standing rule\n"
        "   on action controls -- serif italic, 1.15rem+, real padding. */\n"
        ".cur-camera{\n"
        "  display:block; margin:12px auto 0;\n"
        "  font-family:var(--serif); font-style:italic; font-size:1.15rem;\n"
        "  padding:.55rem 1.4rem; border-radius:999px;\n"
        "  border:1px solid rgba(125,66,66,.45); background:transparent;\n"
        "  color:var(--oxblood, #7d4242); cursor:pointer;\n"
        "  transition:background .2s, color .2s;\n"
        "}\n"
        ".cur-camera:hover{ background:rgba(125,66,66,.08) }\n"
        "/* Gone once a photograph is in -- the slot is gone then too. */\n"
        ".cur.has-photo .cur-camera, .cur[data-state=\"ready\"] .cur-camera{ display:none }"
    )

    return [
        ("A . the camera input",  a_old, a_new),
        ("B . the pill",          b_old, b_new),
        ("C . wired to intake",   c_old, c_new),
        ("D . the pill's clothes", d_old, d_new),
    ]


def run(src_dir, out_dir, apply):
    ok = True
    for name, (mode, plural) in ROOMS.items():
        src = os.path.join(src_dir, name)
        print("\n" + "="*66 + "\n" + name + "  (capture=%s)" % mode + "\n" + "="*66)
        if not os.path.isfile(src):
            print("  REFUSED: not found"); ok=False; continue
        text = normalise(io.open(src,"rb").read().decode("utf-8"))
        before = len(text)

        edits = build_edits(mode, plural)
        halt = False
        for label, old, new in edits:
            n = text.count(old)
            if n != 1:
                if new in text: print("  REFUSED: already applied -- %s" % label)
                else: print("  REFUSED: anchor %d times -- %s" % (n, label))
                halt = True
        if halt: ok=False; continue

        for label, old, new in edits:
            text = text.replace(old, new, 1)
            print("  ok   %s" % label)

        for s in ['id="srcCamera"', 'id="curCamera"', '.cur-camera{']:
            if s not in text:
                print("  REFUSED: missing -- %s" % s); halt=True
        if halt: ok=False; continue

        print("  %d -> %d (+%d)" % (before, len(text), len(text)-before))
        if apply:
            dst = os.path.join(out_dir, name)
            io.open(dst,"w",encoding="utf-8",newline="\n").write(text)
            print("  WROTE %s" % dst)
        else:
            print("  DRY RUN -- nothing written")

    print("\n" + ("All files clean." if ok else "ONE OR MORE FILES REFUSED."))
    return 0 if ok else 1


if __name__ == "__main__":
    apply = "--apply" in sys.argv
    home = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)
    out_dir = os.path.join(home,"Downloads"); src_dir = ""
    for a in sys.argv[1:]:
        if a.startswith("--src="): src_dir=a[6:]
        if a.startswith("--out="): out_dir=a[6:]
    if not src_dir: src_dir = os.path.join(repo,"public")
    if not os.path.isdir(src_dir): print("REFUSED: install to scripts\\ first."); sys.exit(1)
    print("\nreading  %s\nwriting  %s" % (src_dir, out_dir))
    sys.exit(run(src_dir, out_dir, apply))
