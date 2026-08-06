# -*- coding: utf-8 -*-
"""
build_s97_another_age_toggle.py  ·  2026-08-02  ·  CUI V25

Another Age holds fourteen effects, twelve of them live, against a room cap
of seven — the room was showing the first seven of twelve and the women were
never reachable. Ruled by Rich: a toggle at the top of the effects floor,
men on one side and women on the other.

  · The side is decided by the photograph. analyzeSourceSet returns
    detected_gender, 'm' or 'f' or null, and the room opens on the matching
    side. Null opens on men.
  · The split is read off the id suffix. There is no gender field on an
    effect in the registry; `victorian` and `victorian_woman` are two
    separate preset ids the route already accepts, which is also why nothing
    about the engine changes here. If CENG adds a field, ageSide() is the
    one place to change.
  · The toggle is hidden in every other room.

Run from the repo root:  python scripts\\build_s97_another_age_toggle.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-02-s96.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-02-s97.html')

EXPECTED_ROUTES = 10


def die(msg):
    print('GATE FAILED · ' + msg)
    sys.exit(1)


def rep(text, old, new, label):
    n = text.count(old)
    if n != 1:
        die('anchor "%s" appears %d times, expected 1' % (label, n))
    return text.replace(old, new)


with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

doc = src

# ───────────────────────────────────────────────────────────────────── 1 · CSS

doc = rep(
    doc,
    ".crumb{\r\n"
    "  display:flex; align-items:center; gap:10px;\r\n"
    "  padding:0 var(--card-gap) 12px;\r\n"
    "  min-height:48px;\r\n"
    "}",
    ".crumb{\r\n"
    "  display:flex; align-items:center; gap:10px;\r\n"
    "  padding:0 var(--card-gap) 12px;\r\n"
    "  min-height:48px;\r\n"
    "  position:relative;   /* the Another Age toggle centres against this */\r\n"
    "}\r\n"
    "\r\n"
    "/* ---- the Another Age toggle -------------------------------------------\r\n"
    "   One room holds two wardrobes. Centred on the floor rather than beside\r\n"
    "   the breadcrumb, because it is a choice about the work and not a piece\r\n"
    "   of navigation. Same coffee pill language, same 4px, one shared ground\r\n"
    "   so the two sides read as one control. */\r\n"
    ".agetog{\r\n"
    "  position:absolute; left:50%; top:0; transform:translateX(-50%);\r\n"
    "  display:inline-flex; gap:4px;\r\n"
    "  height:40px; padding:4px;\r\n"
    "  border-radius:4px;\r\n"
    "  background:linear-gradient(180deg, rgba(47,36,32,.55) 0%, rgba(36,27,23,.55) 100%);\r\n"
    "  border:1px solid rgba(196,169,110,.16);\r\n"
    "}\r\n"
    ".agetog[hidden]{ display:none }\r\n"
    ".agetog-b{\r\n"
    "  display:inline-flex; align-items:center;\r\n"
    "  height:100%; padding:0 20px;\r\n"
    "  border:0; border-radius:3px; background:transparent;\r\n"
    "  font-family:var(--serif); font-size:1.3125rem; line-height:1;\r\n"
    "  color:var(--vellum-200); opacity:.62;\r\n"
    "  cursor:pointer;\r\n"
    "  transition:background .38s var(--ease-nav), color .38s var(--ease-nav),\r\n"
    "             opacity .38s var(--ease-nav);\r\n"
    "}\r\n"
    ".agetog-b:hover{ opacity:.85 }\r\n"
    ".agetog-b:focus-visible{ outline:2px solid var(--gold); outline-offset:2px }\r\n"
    ".agetog-b.is-on{\r\n"
    "  opacity:1; color:#fff;\r\n"
    "  background:linear-gradient(180deg,#3a2c26 0%, #2c211c 100%);\r\n"
    "  border:1px solid rgba(196,169,110,.26);\r\n"
    "  box-shadow:inset 0 1px 0 rgba(255,255,255,.06);\r\n"
    "}",
    'crumb rule',
)

# ────────────────────────────────────────────────────────────────── 2 · markup

doc = rep(
    doc,
    "      <span class=\"crumb-sep\">&rsaquo;</span>\r\n"
    "      <span class=\"crumb-here\" id=\"crumbHere\"></span>\r\n"
    "    </div>",
    "      <span class=\"crumb-sep\">&rsaquo;</span>\r\n"
    "      <span class=\"crumb-here\" id=\"crumbHere\"></span>\r\n"
    "      <div class=\"agetog\" id=\"ageTog\" role=\"group\" aria-label=\"Another Age\" hidden>\r\n"
    "        <button class=\"agetog-b is-on\" id=\"ageM\" type=\"button\" data-age=\"m\">Men</button>\r\n"
    "        <button class=\"agetog-b\" id=\"ageW\" type=\"button\" data-age=\"w\">Women</button>\r\n"
    "      </div>\r\n"
    "    </div>",
    'crumb markup',
)

# ─────────────────────────────────────────────────────────────── 3 · the wiring

doc = rep(
    doc,
    "  function openSilo(card){\r\n"
    "    var siloId = card.dataset.siloId;\r\n"
    "    var silo   = siloById(siloId);\r\n"
    "    /* live only, capped at seven with the upsell in slot eight */\r\n"
    "    /* offerableBySilo answers \"finished?\"; craftable also answers \"will the\r\n"
    "       route take it?\". Both must be true or the customer pays for a 400. */\r\n"
    "    var list   = R.offerableBySilo(siloId).filter(craftable).slice(0, CAP);\r\n"
    "    if (!list.length){\r\n"
    "      /* A room with nothing offerable does not open. Say why rather than\r\n"
    "         turning the floor over onto an empty one. */\r\n"
    "      say('That room is still in the studio &mdash; I have nothing finished to ' +\r\n"
    "          'show you in there yet.<span class=\"sign\">&mdash; C.</span>');\r\n"
    "      return;\r\n"
    "    }\r\n"
    "    turn(siloFloor, effFloor, function(){\r\n"
    "      effFloor.innerHTML = '';\r\n"
    "      list.forEach(function(e){\r\n"
    "        var el = effectCard(siloId, e);\r\n"
    "        if (inQueue(siloId, e.id)) el.classList.add('is-selected');\r\n"
    "        effFloor.appendChild(el);\r\n"
    "      });\r\n"
    "      effFloor.appendChild(upsellCard(siloId, list));\r\n"
    "      UPSELL_CTX = { silo:siloId, list:list };\r\n"
    "      effFloor.dataset.count = list.length + 1;\r\n"
    "      crumbHere.textContent = silo ? silo.label : siloId;\r\n"
    "      /* The line travels with the silo now, not in a parallel map. */\r\n"
    "      if (silo && silo.line) say(silo.line + '<span class=\"sign\">&mdash; C.</span>');\r\n"
    "      workshop.classList.remove('workshop-view--silos');\r\n"
    "      workshop.classList.add('workshop-view--effects');\r\n"
    "    });\r\n"
    "  }",

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
    "  }\r\n"
    "\r\n"
    "  /* One painter for the floor, so the toggle and the card-turn cannot\r\n"
    "     drift apart. */\r\n"
    "  function paintEffects(siloId, list){\r\n"
    "    effFloor.innerHTML = '';\r\n"
    "    list.forEach(function(e){\r\n"
    "      var el = effectCard(siloId, e);\r\n"
    "      if (inQueue(siloId, e.id)) el.classList.add('is-selected');\r\n"
    "      effFloor.appendChild(el);\r\n"
    "    });\r\n"
    "    effFloor.appendChild(upsellCard(siloId, list));\r\n"
    "    UPSELL_CTX = { silo:siloId, list:list };\r\n"
    "    effFloor.dataset.count = list.length + 1;\r\n"
    "  }\r\n"
    "\r\n"
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
    "  });\r\n"
    "\r\n"
    "  function openSilo(card){\r\n"
    "    var siloId = card.dataset.siloId;\r\n"
    "    var silo   = siloById(siloId);\r\n"
    "    /* A fresh photograph re-decides the side every time the room opens. */\r\n"
    "    if (siloId === AGE_SILO) AGE_SIDE = ageSide();\r\n"
    "    var list   = siloList(siloId);\r\n"
    "    if (!list.length){\r\n"
    "      /* A room with nothing offerable does not open. Say why rather than\r\n"
    "         turning the floor over onto an empty one. */\r\n"
    "      say('That room is still in the studio &mdash; I have nothing finished to ' +\r\n"
    "          'show you in there yet.<span class=\"sign\">&mdash; C.</span>');\r\n"
    "      return;\r\n"
    "    }\r\n"
    "    turn(siloFloor, effFloor, function(){\r\n"
    "      paintEffects(siloId, list);\r\n"
    "      if (ageTog){ ageTog.hidden = siloId !== AGE_SILO; paintAgeTog(); }\r\n"
    "      crumbHere.textContent = silo ? silo.label : siloId;\r\n"
    "      /* The line travels with the silo now, not in a parallel map. */\r\n"
    "      if (silo && silo.line) say(silo.line + '<span class=\"sign\">&mdash; C.</span>');\r\n"
    "      workshop.classList.remove('workshop-view--silos');\r\n"
    "      workshop.classList.add('workshop-view--effects');\r\n"
    "    });\r\n"
    "  }",
    'openSilo',
)

# the toggle belongs to the effects floor only
doc = rep(
    doc,
    "  function backToSilos(){\r\n"
    "    turn(effFloor, siloFloor, function(){",
    "  function backToSilos(){\r\n"
    "    if (ageTog) ageTog.hidden = true;\r\n"
    "    turn(effFloor, siloFloor, function(){",
    'backToSilos',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

# the old inline painter must be gone — two painters is how they drift
if 'effFloor.appendChild(upsellCard(siloId, list));\r\n      UPSELL_CTX' in doc:
    die('the inline painter survived in openSilo')
if doc.count('function paintEffects(') != 1:
    die('paintEffects is not the single painter')

# every class in the new markup carries a rule
for sel in ('.agetog{', '.agetog-b{', '.agetog-b.is-on{', '.agetog[hidden]{'):
    if sel not in doc:
        die('no rule for %s' % sel)

# the side is decided by the photograph, not by a constant
if "g === 'f' ? 'w' : 'm'" not in doc:
    die('the default side is not read from detected_gender')

# the toggle is hidden everywhere but the one room
if 'ageTog.hidden = siloId !== AGE_SILO' not in doc:
    die('the toggle is not scoped to Another Age')
if 'if (ageTog) ageTog.hidden = true;' not in doc:
    die('the toggle is not hidden on the way back')

# declared above its readers — a var assigned below its caller ships inert
for name in ('var AGE_SIDE', 'var ageTog'):
    if doc.index(name) > doc.index('function openSilo(card){'):
        die('%s is declared below openSilo' % name)

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

print('GATE PASSED · one painter · toggle scoped to Another Age · %d routes' % routes)
print('wrote ' + OUT)
