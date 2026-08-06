# -*- coding: utf-8 -*-
"""
build_s99_subject_previews.py  ·  2026-08-02  ·  CUI V25

CENG-TO-CUI-2026-08-02 §2 and §3, and the effect previews.

WHAT WAS WRONG IN s97
    The Another Age toggle filtered the floor, so flipping it swapped one
    set of tiles for another. The ruling is the opposite: seven tiles, and
    the subject changes the face on each card. s97's mechanism is replaced
    outright here, not extended.

WHAT LANDS
  · Tiles, not rows. tilesBySilo drops the _woman variants — they sit behind
    their base tile rather than beside it. Where the registry has not been
    re-emitted with the helper, the same filter runs locally, so this file
    works against either.
  · Every effect card draws its own art. Until now all seven cards in a room
    showed the same silo photograph.
  · The subject decides which plate. analyze already returns detected_gender,
    'm' or 'f', so the rule fires today; when CENG adds `subject` it is read
    first and detected_gender becomes the fallback. Neither present, the
    ungendered plate serves.
  · The toggle is now an override, not the way in, and it appears in any
    room holding a tile with two plates rather than in Another Age alone.
    Rich: he is not going to be the one telling a man he cannot wear a
    Victorian dress.
  · Subject also resolves the craft id — a woman choosing Victorian queues
    victorian_woman, if the route accepts it.

THE MANIFEST
    Filenames on disk carry no rule: elizabethan starts at 2, victorian
    holds 3_woman against 4_man, balloon_face puts the woman first, and half
    the tree is an ungendered 1.jpg. Nothing can derive a path from an id.
    scripts/emit-preview-manifest.js walks the folder and writes
    public/previews/effects-manifest.json; this build inlines it, so there
    is no eleventh request and no async race with the first paint.

    Art changed? Re-run the emitter, then re-run this build.

Run from the repo root:
    node scripts\\emit-preview-manifest.js
    python scripts\\build_s99_subject_previews.py
"""

import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-02-s98.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-02-s99.html')
MANIFEST = os.path.join(ROOT, 'public', 'previews', 'effects-manifest.json')

EXPECTED_ROUTES = 10


def die(msg):
    print('GATE FAILED · ' + msg)
    sys.exit(1)


def rep(text, old, new, label):
    n = text.count(old)
    if n != 1:
        die('anchor "%s" appears %d times, expected 1' % (label, n))
    return text.replace(old, new)


# ── the manifest, read today ────────────────────────────────────────────────
if not os.path.exists(MANIFEST):
    die('effects-manifest.json not found — run node scripts\\emit-preview-manifest.js first')

with open(MANIFEST, encoding='utf-8') as f:
    man = json.load(f)

fx = man.get('effects') or {}
if len(fx) < 40:
    die('the manifest holds only %d effects — refusing to blank the floor' % len(fx))

compact = {}
for eid, rec in sorted(fx.items()):
    compact[eid] = [rec.get('man') or '', rec.get('woman') or '', rec.get('neutral') or '']

lines = ['window.EFFECT_PREVIEWS = {']
lines.append("  base: " + json.dumps(man.get('base') or '/previews/effects/') + ",")
lines.append("  generatedAt: " + json.dumps(man.get('generatedAt') or '') + ",")
lines.append("  /* id: [man, woman, neutral] — empty string where there is none */")
lines.append("  files: {")
keys = list(compact.keys())
for n, eid in enumerate(keys):
    m, w, neu = compact[eid]
    lines.append("    %s: [%s, %s, %s]%s" % (
        json.dumps(eid), json.dumps(m), json.dumps(w), json.dumps(neu),
        ',' if n < len(keys) - 1 else ''))
lines.append("  }")
lines.append('};')
INLINE = '\r\n'.join(lines)

# ── apply ───────────────────────────────────────────────────────────────────
with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

doc = src

# 1 · the manifest, inlined ahead of everything that reads it
doc = rep(
    doc,
    '<script src="/effect-registry.js"></script>',
    '<script src="/effect-registry.js"></script>\r\n'
    '<script>\r\n'
    '/* GENERATED — do not edit. Written into this file by\r\n'
    '   scripts/build_s99_subject_previews.py from\r\n'
    '   public/previews/effects-manifest.json, which is itself written by\r\n'
    '   scripts/emit-preview-manifest.js. Inlined rather than fetched: the\r\n'
    '   first paint of a room must not wait on a request, and the route\r\n'
    '   count is a gate. Art changed? Re-run both. */\r\n'
    + INLINE + '\r\n'
    '</script>',
    'registry script tag',
)

# 2 · the subject machine replaces the s97 gender filter outright
doc = rep(
    doc,
    "  /* ---- Another Age, two wardrobes ---------------------------------------\r\n"
    "     Fourteen effects in one room against a cap of seven. The men and the\r\n"
    "     women are separate preset ids the route already accepts, so this is a\r\n"
    "     filter on the floor and nothing more — no gender travels to the engine\r\n"
    "     and no payload changes.\r\n"
    "\r\n"
    "     The registry carries no gender field. The id suffix is the only signal\r\n"
    "     there is, and ageIsWoman() is the single place that assumes it. */\r\n"
    "  var AGE_SILO = 'another_age';\r\n"
    "  var AGE_SIDE = 'm';\r\n"
    "  var ageTog   = document.getElementById('ageTog');\r\n"
    "\r\n"
    "  function ageIsWoman(e){ return /_woman$/.test(e.id); }\r\n"
    "\r\n"
    "  /* The photograph decides. detected_gender is 'm', 'f', or null when the\r\n"
    "     analyze call could not say; null opens on men. */\r\n"
    "  function ageSide(){\r\n"
    "    var g = SRC && SRC.analyze && SRC.analyze.detected_gender;\r\n"
    "    return g === 'f' ? 'w' : 'm';\r\n"
    "  }\r\n"
    "\r\n"
    "  function siloList(siloId){\r\n"
    "    /* offerableBySilo answers \"finished?\"; craftable also answers \"will the\r\n"
    "       route take it?\". Both must be true or the customer pays for a 400. */\r\n"
    "    var all = R.offerableBySilo(siloId).filter(craftable);\r\n"
    "    if (siloId === AGE_SILO){\r\n"
    "      all = all.filter(function(e){\r\n"
    "        return AGE_SIDE === 'w' ? ageIsWoman(e) : !ageIsWoman(e);\r\n"
    "      });\r\n"
    "    }\r\n"
    "    return all.slice(0, CAP);\r\n"
    "  }\r\n",

    "  /* ---- the subject ------------------------------------------------------\r\n"
    "     One tile, two faces. The _woman ids are variants sitting behind their\r\n"
    "     base tile, not tiles of their own — s97 had them as a second set and\r\n"
    "     flipping the toggle swapped the floor, which is not the ruling. The\r\n"
    "     tiles hold still; the faces change.\r\n"
    "\r\n"
    "     The photograph decides first. `subject` is CENG's field and is read\r\n"
    "     ahead of everything; detected_gender already ships and carries it\r\n"
    "     until then. Neither, and the ungendered plate serves. */\r\n"
    "  var AGE_SILO = 'another_age';   /* kept: the room the toggle was born in */\r\n"
    "  var SUBJECT  = null;            /* 'man' | 'woman' | null */\r\n"
    "  var SUBJECT_FORCED = false;     /* the customer has overridden the photograph */\r\n"
    "  var ageTog   = document.getElementById('ageTog');\r\n"
    "  var PV       = window.EFFECT_PREVIEWS || { base:'/previews/effects/', files:{} };\r\n"
    "\r\n"
    "  function isVariantId(id){\r\n"
    "    return R.isVariant ? R.isVariant(id) : /_woman$/.test(id);\r\n"
    "  }\r\n"
    "\r\n"
    "  /* What the photograph says, before any override. */\r\n"
    "  function subjectFromPhoto(){\r\n"
    "    var a = (SRC && SRC.analyze) || {};\r\n"
    "    if (a.subject === 'man' || a.subject === 'woman') return a.subject;\r\n"
    "    if (a.detected_gender === 'm') return 'man';\r\n"
    "    if (a.detected_gender === 'f') return 'woman';\r\n"
    "    return null;\r\n"
    "  }\r\n"
    "\r\n"
    "  /* The craft id, not just the picture. A woman choosing Victorian queues\r\n"
    "     victorian_woman — but only where that id exists and the route will\r\n"
    "     take it, so a room without variants is untouched. */\r\n"
    "  function craftIdFor(tileId){\r\n"
    "    if (SUBJECT !== 'woman') return tileId;\r\n"
    "    if (R.variantFor){\r\n"
    "      var v = R.variantFor(tileId, 'woman');\r\n"
    "      if (v && v !== tileId && craftableId(v)) return v;\r\n"
    "      if (v && v !== tileId) return tileId;\r\n"
    "    }\r\n"
    "    var guess = tileId + '_woman';\r\n"
    "    return craftableId(guess) ? guess : tileId;\r\n"
    "  }\r\n"
    "  function craftableId(id){\r\n"
    "    var e = R.byId ? R.byId(id) : null;\r\n"
    "    return !!(e && craftable(e));\r\n"
    "  }\r\n"
    "\r\n"
    "  /* [man, woman, neutral]. Ask for the subject, fall back to the plate\r\n"
    "     that serves both, then to whatever exists — a card with no picture\r\n"
    "     is worse than a card showing the other face. */\r\n"
    "  function previewFor(tileId){\r\n"
    "    var f = PV.files && PV.files[tileId];\r\n"
    "    if (!f) return '';\r\n"
    "    var want = SUBJECT === 'woman' ? f[1] : SUBJECT === 'man' ? f[0] : '';\r\n"
    "    var file = want || f[2] || f[0] || f[1] || '';\r\n"
    "    return file ? PV.base + tileId + '/' + file : '';\r\n"
    "  }\r\n"
    "\r\n"
    "  /* A room earns the toggle by holding a tile with both plates. */\r\n"
    "  function roomHasBoth(list){\r\n"
    "    for (var i = 0; i < list.length; i++){\r\n"
    "      var f = PV.files && PV.files[list[i].id];\r\n"
    "      if (f && f[0] && f[1]) return true;\r\n"
    "    }\r\n"
    "    return false;\r\n"
    "  }\r\n"
    "\r\n"
    "  function siloList(siloId){\r\n"
    "    /* offerableBySilo answers \"finished?\"; craftable also answers \"will the\r\n"
    "       route take it?\". Both must be true or the customer pays for a 400.\r\n"
    "       tilesBySilo then drops the variants, so seven tiles rather than\r\n"
    "       fourteen rows. */\r\n"
    "    var all = R.offerableTilesBySilo\r\n"
    "      ? R.offerableTilesBySilo(siloId).filter(craftable)\r\n"
    "      : R.offerableBySilo(siloId).filter(craftable).filter(function(e){\r\n"
    "          return !isVariantId(e.id);\r\n"
    "        });\r\n"
    "    return all.slice(0, CAP);\r\n"
    "  }\r\n",
    'subject machine',
)

# 3 · the card draws its own art and carries both ids
doc = rep(
    doc,
    "  function effectCard(siloId, effect){\r\n"
    "    var a = document.createElement('article');\r\n"
    "    a.className = 'silo-card';\r\n"
    "    a.tabIndex = 0;\r\n"
    "    a.dataset.effectId = effect.id;\r\n"
    "    a.dataset.siloId = siloId;\r\n"
    "    a.innerHTML =\r\n"
    "      '<img class=\"silo-card__image\" src=\"/previews/silos/' + siloId + '.jpg\" alt=\"\" loading=\"lazy\">' +",

    "  function effectCard(siloId, effect){\r\n"
    "    var a = document.createElement('article');\r\n"
    "    a.className = 'silo-card';\r\n"
    "    a.tabIndex = 0;\r\n"
    "    /* Two ids. tileId is the thing on the floor and never changes;\r\n"
    "       effectId is what gets crafted and follows the subject. */\r\n"
    "    a.dataset.tileId   = effect.id;\r\n"
    "    a.dataset.effectId = craftIdFor(effect.id);\r\n"
    "    a.dataset.siloId = siloId;\r\n"
    "    a.innerHTML =\r\n"
    "      '<img class=\"silo-card__image\" src=\"' +\r\n"
    "        esc(previewFor(effect.id) || ('/previews/silos/' + siloId + '.jpg')) +\r\n"
    "        '\" alt=\"\" loading=\"lazy\">' +",
    'effectCard',
)

# 4 · the toggle overrides, and repaints faces without moving tiles
doc = rep(
    doc,
    "  function paintAgeTog(){\r\n"
    "    if (!ageTog) return;\r\n"
    "    var on = ageTog.querySelectorAll('.agetog-b');\r\n"
    "    for (var i = 0; i < on.length; i++){\r\n"
    "      on[i].classList.toggle('is-on', on[i].dataset.age === AGE_SIDE);\r\n"
    "      on[i].setAttribute('aria-pressed', on[i].dataset.age === AGE_SIDE ? 'true' : 'false');\r\n"
    "    }\r\n"
    "  }\r\n"
    "\r\n"
    "  if (ageTog) ageTog.addEventListener('click', function(ev){\r\n"
    "    var b = ev.target.closest('.agetog-b'); if (!b) return;\r\n"
    "    if (b.dataset.age === AGE_SIDE) return;\r\n"
    "    AGE_SIDE = b.dataset.age;\r\n"
    "    paintAgeTog();\r\n"
    "    paintEffects(AGE_SILO, siloList(AGE_SILO));\r\n"
    "  });\r\n",

    "  function paintAgeTog(){\r\n"
    "    if (!ageTog) return;\r\n"
    "    var want = SUBJECT === 'woman' ? 'w' : 'm';\r\n"
    "    var on = ageTog.querySelectorAll('.agetog-b');\r\n"
    "    for (var i = 0; i < on.length; i++){\r\n"
    "      on[i].classList.toggle('is-on', on[i].dataset.age === want);\r\n"
    "      on[i].setAttribute('aria-pressed', on[i].dataset.age === want ? 'true' : 'false');\r\n"
    "    }\r\n"
    "  }\r\n"
    "\r\n"
    "  /* Same tiles, different faces. Rebuilding the floor here would lose the\r\n"
    "     card turn's place and re-order nothing, so each card is edited where\r\n"
    "     it stands. */\r\n"
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
    "  }\r\n"
    "\r\n"
    "  /* The photograph sets the subject; this is the customer disagreeing,\r\n"
    "     which they are entitled to do and which sticks for the session. */\r\n"
    "  if (ageTog) ageTog.addEventListener('click', function(ev){\r\n"
    "    var b = ev.target.closest('.agetog-b'); if (!b) return;\r\n"
    "    var want = b.dataset.age === 'w' ? 'woman' : 'man';\r\n"
    "    if (want === SUBJECT) return;\r\n"
    "    SUBJECT = want;\r\n"
    "    SUBJECT_FORCED = true;\r\n"
    "    paintAgeTog();\r\n"
    "    repaintSubject();\r\n"
    "  });\r\n",
    'toggle handler',
)

# 5 · openSilo — the subject comes from the photograph unless overridden,
#     and the toggle shows wherever the room has two faces to offer
doc = rep(
    doc,
    "    /* A fresh photograph re-decides the side every time the room opens. */\r\n"
    "    if (siloId === AGE_SILO) AGE_SIDE = ageSide();\r\n"
    "    var list   = siloList(siloId);\r\n",

    "    /* A fresh photograph re-decides the subject every time a room opens,\r\n"
    "       unless the customer has already said otherwise. */\r\n"
    "    if (!SUBJECT_FORCED) SUBJECT = subjectFromPhoto();\r\n"
    "    var list   = siloList(siloId);\r\n",
    'openSilo subject',
)

doc = rep(
    doc,
    "      if (ageTog){ ageTog.hidden = siloId !== AGE_SILO; paintAgeTog(); }\r\n",
    "      if (ageTog){ ageTog.hidden = !roomHasBoth(list); paintAgeTog(); }\r\n",
    'toggle scope',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d — the manifest is inlined, not fetched'
        % (routes, EXPECTED_ROUTES))

# s97's mechanism must be gone entirely, not merely bypassed
for dead in ('AGE_SIDE', 'function ageSide(', 'function ageIsWoman('):
    if dead in doc:
        die("s97's gender filter survived: %s" % dead)

# the manifest reached the file and is readable
if 'window.EFFECT_PREVIEWS = {' not in doc:
    die('the manifest was not inlined')
if doc.count('window.EFFECT_PREVIEWS = {') != 1:
    die('the manifest is inlined more than once')
if doc.index('window.EFFECT_PREVIEWS = {') > doc.index('function previewFor('):
    die('the manifest is declared below its reader')

# a tile is a tile: no variant may reach the floor
if 'R.offerableTilesBySilo' not in doc:
    die('tilesBySilo is not preferred')
if 'return !isVariantId(e.id);' not in doc:
    die('no local fallback for a registry without the tile helpers')

# the card draws its own art and carries both ids
if "src=\"/previews/silos/' + siloId + '.jpg\" alt=\"\" loading=\"lazy\">' +\r\n      '<div class=\"silo-card__overlay\"" in doc:
    die('effect cards still draw the silo photograph')
if 'a.dataset.tileId   = effect.id;' not in doc:
    die('the card does not carry a tile id')
if 'a.dataset.effectId = craftIdFor(effect.id);' not in doc:
    die('the craft id does not follow the subject')

# the toggle repaints faces and does not reshuffle
if 'function repaintSubject(' not in doc:
    die('no in-place repaint')
if 'paintEffects(AGE_SILO' in doc:
    die('the toggle still rebuilds the floor')

# declared above their readers
for name, reader in (('var SUBJECT ', 'function subjectFromPhoto('),
                     ('var PV  ', 'function previewFor('),
                     ('var ageTog', 'function paintAgeTog(')):
    if doc.index(name) > doc.index(reader):
        die('%s is declared below %s' % (name.strip(), reader))

if len(re.findall(r'data-s="[0-9]"', doc)) != 8:
    die('intake states are not 8')
for st in re.findall(r'<style[^>]*>(.*?)</style>', doc, re.S):
    if st.count('{') != st.count('}'):
        die('style block brace imbalance')

blocks = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', doc, re.S)
if not blocks:
    die('no script blocks found')
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

gendered = sum(1 for v in compact.values() if v[0] and v[1])
print('GATE PASSED · %d effects in the manifest, %d with both faces · %d routes'
      % (len(compact), gendered, routes))
print('wrote ' + OUT)
