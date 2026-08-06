# -*- coding: utf-8 -*-
"""
build_s114_silo_repaint.py  ·  2026-08-03  ·  CUI V25

The silo cards keep the face they were painted with.

    renderSilos runs once at boot, before a photograph exists and therefore
    before the subject is known. Every card resolves to the man's plate and
    stays there. Upload a photograph of a woman, and the eight rooms she
    chooses between are still eight men.

    s113 taught the cards to ask for the right plate. It did not give
    anything a reason to ask again.

WHAT LANDS

  · repaintSubject now covers the silo floor as well as the effect floor.
    One function, both floors, so they cannot drift.
  · It is called when analyze answers, which is the moment the studio first
    learns who it is looking at.
  · The Men/Women toggle already called it. It now moves the rooms behind
    the customer as well as the cards in front of them, so going back does
    not reveal a floor that disagrees.
  · The rail thumbnails move too. A queued finish showed the room's plate,
    and that plate has a gender now.

    In place, not a rebuild — the silo floor carries the card-turn's state
    and re-rendering it mid-turn would drop the animation on the floor.

Run from the repo root:  python scripts\\build_s114_silo_repaint.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s113.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s114.html')

EXPECTED_ROUTES = 16


def die(msg):
    print('GATE FAILED · ' + msg)
    sys.exit(1)


def rep(text, old, new, label):
    lf = (old.replace('\r\n', '\n'), new.replace('\r\n', '\n'))
    crlf = (lf[0].replace('\n', '\r\n'), lf[1].replace('\n', '\r\n'))
    for a, b in ((old, new), lf, crlf):
        if text.count(a) == 1:
            return text.replace(a, b)
    die('anchor "%s" appears %d times, expected 1' % (label, text.count(old)))


with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

doc = src

# ── 1 · one repaint, both floors ────────────────────────────────────────────

doc = rep(
    doc,
    "  function repaintSubject(){\r\n"
    "    var cards = effFloor.querySelectorAll('.silo-card[data-tile-id]');\r\n"
    "    for (var i = 0; i < cards.length; i++){\r\n"
    "      var c = cards[i];\r\n"
    "      var tile = c.dataset.tileId;\r\n"
    "      var img = c.querySelector('.silo-card__image');\r\n"
    "      var next = previewFor(tile);\r\n"
    "      if (img && next) img.src = next;\r\n"
    "      c.dataset.effectId = craftIdFor(tile);\r\n"
    "      c.classList.toggle('is-selected', inQueue(c.dataset.siloId, c.dataset.effectId));\r\n"
    "    }\r\n"
    "  }\r\n",

    "  function repaintSubject(){\r\n"
    "    /* The effect floor — the cards in front of the customer. */\r\n"
    "    var cards = effFloor.querySelectorAll('.silo-card[data-tile-id]');\r\n"
    "    for (var i = 0; i < cards.length; i++){\r\n"
    "      var c = cards[i];\r\n"
    "      var tile = c.dataset.tileId;\r\n"
    "      var img = c.querySelector('.silo-card__image');\r\n"
    "      var next = previewFor(tile);\r\n"
    "      if (img && next) img.src = next;\r\n"
    "      c.dataset.effectId = craftIdFor(tile);\r\n"
    "      c.classList.toggle('is-selected', inQueue(c.dataset.siloId, c.dataset.effectId));\r\n"
    "    }\r\n"
    "\r\n"
    "    /* The silo floor — the rooms behind them. renderSilos runs once at\r\n"
    "       boot, before a photograph exists and so before the subject is\r\n"
    "       known, and every card resolved to the man's plate and stayed\r\n"
    "       there. A woman chose between eight men.\r\n"
    "\r\n"
    "       Edited in place: the floor carries the card-turn's state and a\r\n"
    "       rebuild mid-turn would drop the animation. */\r\n"
    "    if (siloFloor){\r\n"
    "      var rooms = siloFloor.querySelectorAll('.silo-card[data-silo-id]');\r\n"
    "      for (var j = 0; j < rooms.length; j++){\r\n"
    "        var rimg = rooms[j].querySelector('.silo-card__image');\r\n"
    "        var rnext = siloArt(rooms[j].dataset.siloId);\r\n"
    "        if (rimg && rnext) rimg.src = rnext;\r\n"
    "      }\r\n"
    "    }\r\n"
    "\r\n"
    "    /* The pose floor, when it has been drawn. */\r\n"
    "    if (poseFloor){\r\n"
    "      var poses = poseFloor.querySelectorAll('.silo-card[data-pose]');\r\n"
    "      for (var k = 0; k < poses.length; k++){\r\n"
    "        var pimg = poses[k].querySelector('.silo-card__image');\r\n"
    "        var pnext = poseArt(poses[k].dataset.pose);\r\n"
    "        if (pimg && pnext) pimg.src = pnext;\r\n"
    "      }\r\n"
    "    }\r\n"
    "\r\n"
    "    /* And the rail. A queued finish shows its room's plate, and that\r\n"
    "       plate has a gender now. */\r\n"
    "    if (typeof renderQueue === 'function') renderQueue();\r\n"
    "  }\r\n",
    'repaintSubject',
)

# ── 2 · called the moment the studio learns who it is looking at ────────────

doc = rep(
    doc,
    "      SRC.gender  = (data && data.gender) || null;\r\n"
    "      if (!SUBJECT_FORCED) SUBJECT = subjectFromPhoto();\r\n"
    "      focusThumb();\r\n",

    "      SRC.gender  = (data && data.gender) || null;\r\n"
    "      if (!SUBJECT_FORCED){\r\n"
    "        SUBJECT = subjectFromPhoto();\r\n"
    "        /* Everything already on screen was painted before this was\r\n"
    "           known. The rooms in particular — they are drawn at boot. */\r\n"
    "        if (typeof repaintSubject === 'function') repaintSubject();\r\n"
    "        if (typeof paintAgeTog === 'function') paintAgeTog();\r\n"
    "      }\r\n"
    "      focusThumb();\r\n",
    'repaint after analyze',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# one repaint covering every floor that shows a face
if doc.count('function repaintSubject(') != 1:
    die('repaintSubject is not the single painter')
for what in ("siloFloor.querySelectorAll('.silo-card[data-silo-id]')",
             "poseFloor.querySelectorAll('.silo-card[data-pose]')",
             "effFloor.querySelectorAll('.silo-card[data-tile-id]')"):
    if what not in doc:
        die('a floor is not repainted: %s' % what)
if 'siloArt(rooms[j].dataset.siloId)' not in doc:
    die('the rooms do not ask for the right plate')
if 'poseArt(poses[k].dataset.pose)' not in doc:
    die('the poses do not ask for the right plate')

# and it is called when the subject first becomes known
if 'if (typeof repaintSubject === \'function\') repaintSubject();' not in doc:
    die('nothing repaints when analyze answers')

# a customer who has chosen must not be overridden by a late analyze
if 'if (!SUBJECT_FORCED){' not in doc:
    die('a late analyze could overrule the toggle')

# in place, never a rebuild — the turn's state lives on those floors
if 'siloFloor.innerHTML = \'\';' in probe.split('function repaintSubject(')[1][:1400]:
    die('the silo floor is rebuilt rather than edited')

if len(re.findall(r'data-s="[0-9]"', doc)) != 8:
    die('intake states are not 8')
for st in re.findall(r'<style[^>]*>(.*?)</style>', doc, re.S):
    if st.count('{') != st.count('}'):
        die('style block brace imbalance')

blocks = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', doc, re.S)
for n, blk in enumerate(blocks):
    fd, path = tempfile.mkstemp(suffix='.js')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(blk)
    r = subprocess.run(['node', '--check', path], capture_output=True, text=True)
    os.unlink(path)
    if r.returncode != 0:
        die('node --check failed on script block %d\n%s' % (n, r.stderr))

boot = None
for name in ('boot.js', 'boot-test.js', 'boot_gate.js', 'boot_check.js'):
    p = os.path.join(ROOT, 'scripts', name)
    if os.path.exists(p):
        boot = p
        break
if boot is None:
    die('boot harness not found in scripts\\ — tell CUI its filename')

with open(OUT, 'w', encoding='utf-8', newline='') as f:
    f.write(doc)

r = subprocess.run(['node', boot, OUT], capture_output=True, text=True)
if r.returncode != 0:
    os.unlink(OUT)
    die('boot harness rejected the output\n%s%s' % (r.stdout, r.stderr))

print('GATE PASSED · rooms, effects, poses and the rail all follow the subject'
      ' · %d routes' % routes)
print('wrote ' + OUT)
