# -*- coding: utf-8 -*-
"""
build_s113_subject_everywhere.py  ·  2026-08-03  ·  CUI V25

CUI-BRIEF-gendered-previews. Four changes, all from the same fact: the
studio now knows who it is looking at, and every picture the customer sees
should be of someone like them.

 1 · `subject` MOVED, AND IS REAL
      It arrives at the TOP LEVEL of the analyze response — `data.subject`,
      beside `result` rather than inside it. The old `result.detected_gender`
      was returning null on every photograph; this comes from a dedicated
      vision call and measured 11/11 with no nulls. Both are read, the new
      one first, so nothing breaks if a response arrives in either shape.

 2 · SILO ART IS GENDERED
      `light_glass_man.jpg` and `light_glass_woman.jpg`. Every silo card in
      this file asked for `<id>.jpg`, which no longer exists — eight 404s
      the moment CENG's tree lands, on the first screen a customer sees.

 3 · POSE ART IS GENDERED, WITH MIXED EXTENSIONS
      Men are `.png`, women are `.jpg`. Nothing may build a filename from an
      id any more; the manifest carries the whole name, read off disk.

 4 · THE RENDER FOLLOWS THE CARD
      `subject` goes on the generate request. The engine detects it itself
      if we send nothing, but then the Men/Women toggle would be a lie — a
      customer who flipped to Women would be shown women and sent a man.

WHY THE MANIFEST GREW RATHER THAN THE PATHS
    Extensions vary by tree and by gender, and there is a stray `.jpeg` in
    style-refs. A filename built from an id is a 404 waiting for the next
    reshoot. scripts/emit-preview-manifest.js now walks all three trees and
    carries whole filenames; this build inlines the result.

Run from the repo root:
    node scripts\\emit-preview-manifest.js
    python scripts\\build_s113_subject_everywhere.py
"""

import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s112.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s113.html')
MANIFEST = os.path.join(ROOT, 'public', 'previews', 'effects-manifest.json')

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


# ── the manifest, all three trees ───────────────────────────────────────────
if not os.path.exists(MANIFEST):
    die('effects-manifest.json not found — run node scripts\\emit-preview-manifest.js first')

with open(MANIFEST, encoding='utf-8') as f:
    man = json.load(f)

fx = man.get('effects') or {}
silos = man.get('silos') or {}
poses = man.get('poses') or {}

if len(fx) < 40:
    die('the manifest holds only %d effects' % len(fx))
if not silos:
    die('no silo art in the manifest — is previews/silos/ gendered yet?')


def triple(rec):
    return [rec.get('man') or '', rec.get('woman') or '', rec.get('neutral') or '']


def block(name, tree, indent='    '):
    ks = sorted(tree.keys())
    out = []
    for n, k in enumerate(ks):
        a, b, c = triple(tree[k])
        out.append('%s%s: [%s, %s, %s]%s' % (
            indent, json.dumps(k), json.dumps(a), json.dumps(b), json.dumps(c),
            ',' if n < len(ks) - 1 else ''))
    return '\r\n'.join(out)


INLINE = '\r\n'.join([
    'window.EFFECT_PREVIEWS = {',
    '  base: ' + json.dumps(man.get('base') or '/previews/effects/') + ',',
    '  siloBase: ' + json.dumps(man.get('siloBase') or '/previews/silos/') + ',',
    '  poseBase: ' + json.dumps(man.get('poseBase') or '/previews/pose/') + ',',
    '  generatedAt: ' + json.dumps(man.get('generatedAt') or '') + ',',
    '  /* id: [man, woman, neutral] — whole filenames, because the extension',
    '     varies by tree and by gender and must never be guessed. */',
    '  files: {',
    block('effects', fx),
    '  },',
    '  silos: {',
    block('silos', silos),
    '  },',
    '  poses: {',
    block('poses', poses),
    '  }',
    '};',
])

# ── apply ───────────────────────────────────────────────────────────────────
with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

doc = src

# 1 · the manifest
m = re.search(r'window\.EFFECT_PREVIEWS = \{.*?\n\};', doc, re.S)
if not m:
    die('no inlined manifest found')
doc = doc[:m.start()] + INLINE + doc[m.end():]

# 2 · subject is top level now, and real
doc = rep(
    doc,
    "  function subjectFromPhoto(){\r\n"
    "    var a = (SRC && SRC.analyze) || {};\r\n"
    "    if (a.subject === 'man' || a.subject === 'woman') return a.subject;\r\n"
    "    if (a.detected_gender === 'm') return 'man';\r\n"
    "    if (a.detected_gender === 'f') return 'woman';\r\n"
    "    return null;\r\n"
    "  }\r\n",

    "  /* `subject` arrives at the TOP LEVEL of the analyze response, beside\r\n"
    "     `result` rather than inside it, and it is the string the filenames\r\n"
    "     already use. It comes from a dedicated vision call — the old\r\n"
    "     result.detected_gender was null on every photograph.\r\n"
    "\r\n"
    "     All three shapes are read, newest first, so a response in the old\r\n"
    "     form still works and neither side has to land before the other. */\r\n"
    "  function subjectFromPhoto(){\r\n"
    "    var top = (SRC && SRC.subject) || null;\r\n"
    "    if (top === 'man' || top === 'woman') return top;\r\n"
    "    var g = (SRC && SRC.gender) || null;\r\n"
    "    if (g === 'm') return 'man';\r\n"
    "    if (g === 'f') return 'woman';\r\n"
    "    var a = (SRC && SRC.analyze) || {};\r\n"
    "    if (a.subject === 'man' || a.subject === 'woman') return a.subject;\r\n"
    "    if (a.detected_gender === 'm') return 'man';\r\n"
    "    if (a.detected_gender === 'f') return 'woman';\r\n"
    "    return null;\r\n"
    "  }\r\n",
    'subjectFromPhoto',
)

doc = rep(
    doc,
    "      SRC.analyze = (data && data.result) || {};\r\n"
    "      focusThumb();\r\n",
    "      SRC.analyze = (data && data.result) || {};\r\n"
    "      /* Top level, not inside result. */\r\n"
    "      SRC.subject = (data && data.subject) || null;\r\n"
    "      SRC.gender  = (data && data.gender) || null;\r\n"
    "      if (!SUBJECT_FORCED) SUBJECT = subjectFromPhoto();\r\n"
    "      focusThumb();\r\n",
    'analyze subject',
)

# 3 · one resolver for all three trees
doc = rep(
    doc,
    "  function previewFor(tileId){\r\n"
    "    var f = PV.files && PV.files[tileId];\r\n"
    "    if (!f) return '';\r\n"
    "    var want = SUBJECT === 'woman' ? f[1] : SUBJECT === 'man' ? f[0] : '';\r\n"
    "    var file = want || f[2] || f[0] || f[1] || '';\r\n"
    "    return file ? PV.base + tileId + '/' + file : '';\r\n"
    "  }\r\n",

    "  /* One resolver, three trees. `sub` is a folder per id for effects and\r\n"
    "     an empty string for the flat trees.\r\n"
    "\r\n"
    "     Ask for the subject, fall back to the plate that serves both, then\r\n"
    "     to whatever exists — a card with no picture is worse than a card\r\n"
    "     showing the other face, and two effects are still short a plate. */\r\n"
    "  function plateFrom(tree, base, id, sub){\r\n"
    "    var f = tree && tree[id];\r\n"
    "    if (!f) return '';\r\n"
    "    var want = SUBJECT === 'woman' ? f[1] : SUBJECT === 'man' ? f[0] : '';\r\n"
    "    var file = want || f[0] || f[2] || f[1] || '';\r\n"
    "    return file ? base + (sub ? id + '/' : '') + file : '';\r\n"
    "  }\r\n"
    "\r\n"
    "  function previewFor(tileId){\r\n"
    "    return plateFrom(PV.files, PV.base, tileId, true);\r\n"
    "  }\r\n"
    "  function siloArt(siloId){\r\n"
    "    return plateFrom(PV.silos, PV.siloBase || '/previews/silos/', siloId, false);\r\n"
    "  }\r\n"
    "  function poseArt(poseId){\r\n"
    "    return plateFrom(PV.poses, PV.poseBase || '/previews/pose/', poseId, false);\r\n"
    "  }\r\n",
    'plateFrom',
)

# 4 · every hardcoded path goes through it
doc = rep(
    doc,
    "      '<img class=\"silo-card__image\" src=\"/previews/silos/' + silo.id + '.jpg\" alt=\"\" loading=\"lazy\">' +",
    "      '<img class=\"silo-card__image\" src=\"' + esc(siloArt(silo.id)) + '\" alt=\"\" loading=\"lazy\">' +",
    'silo card art',
)

doc = rep(
    doc,
    "        esc(previewFor(effect.id) || ('/previews/silos/' + siloId + '.jpg')) +",
    "        esc(previewFor(effect.id) || siloArt(siloId)) +",
    'effect card fallback',
)

doc = rep(
    doc,
    "        '<img class=\"silo-card__image\" src=\"/previews/pose/' + p.id + '.jpg\" alt=\"\" loading=\"lazy\">' +",
    "        '<img class=\"silo-card__image\" src=\"' + esc(poseArt(p.id)) + '\" alt=\"\" loading=\"lazy\">' +",
    'pose card art',
)

doc = rep(
    doc,
    "        '<img class=\"tbc-thumb\" src=\"/previews/silos/' + it.siloId + '.jpg\" alt=\"\">' +",
    "        '<img class=\"tbc-thumb\" src=\"' + esc(siloArt(it.siloId)) + '\" alt=\"\">' +",
    'rail thumb',
)

doc = rep(
    doc,
    "        return '<div class=\"ow-th\"><img src=\"/previews/silos/' + r.silo.id +\r\n"
    "               '.jpg\" alt=\"\" loading=\"lazy\"></div>';",
    "        return '<div class=\"ow-th\"><img src=\"' + esc(siloArt(r.silo.id)) +\r\n"
    "               '\" alt=\"\" loading=\"lazy\"></div>';",
    'onward thumb',
)

# 5 · the render follows the card
doc = rep(
    doc,
    "      pose:                  window.__POSE || 'as_photographed',\r\n",
    "      pose:                  window.__POSE || 'as_photographed',\r\n"
    "      /* Whatever the card showed. The engine detects this itself when it\r\n"
    "         is absent, but then the Men/Women toggle would be a lie — a\r\n"
    "         customer who flipped to Women would be shown women and sent a\r\n"
    "         man. An explicit choice always beats detection. */\r\n"
    "      subject:               SUBJECT || null,\r\n",
    'generate subject',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# NOTHING may build a preview filename from an id any more
for bad in ("'/previews/silos/' + silo.id",
            "'/previews/silos/' + siloId",
            "'/previews/silos/' + it.siloId",
            "'/previews/pose/' + p.id"):
    if bad in probe:
        die('a preview path is still built from an id: %s' % bad)
if re.search(r"'/previews/(silos|pose)/'\s*\+\s*\w+\s*\+\s*'\.jpg'", probe):
    die('an extension is still hardcoded')

# all three trees reached the page
for key in ('silos: {', 'poses: {', 'files: {'):
    if key not in doc:
        die('the manifest is missing %s' % key)
if 'siloBase' not in doc or 'poseBase' not in doc:
    die('the flat trees have no base path')

# one resolver
if doc.count('function plateFrom(') != 1:
    die('plateFrom is not the single resolver')
for fn in ('function previewFor(', 'function siloArt(', 'function poseArt('):
    if doc.count(fn) != 1:
        die('%s is not declared exactly once' % fn)

# subject read from the top level, and sent
if 'SRC.subject = (data && data.subject) || null;' not in doc:
    die('subject is not read from the top level')
if 'var top = (SRC && SRC.subject) || null;' not in doc:
    die('subjectFromPhoto does not prefer the new field')
if 'subject:               SUBJECT || null,' not in doc:
    die('the render does not carry the subject')

# the old field is still honoured, so neither side has to land first
if "a.detected_gender === 'f'" not in doc:
    die('the old analyze shape was dropped')

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

print('GATE PASSED · %d effects · %d silos · %d poses, all gendered · %d routes'
      % (len(fx), len(silos), len(poses), routes))
print('wrote ' + OUT)
