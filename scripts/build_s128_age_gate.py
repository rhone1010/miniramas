# -*- coding: utf-8 -*-
"""
build_s128_age_gate.py  ·  2026-08-05  ·  CUI V25

The studio does not craft photographs of children.

    analyze returns `age_group` at the top level, one of six brackets:
    child (0-11), teen (12-17), young (18-29), adult (30-49), mature (50-64),
    senior (65+). The first two are under eighteen.

    Ruled 2026-08-05: refuse them.

READ THIS BEFORE TRUSTING IT

  1 · THIS IS HALF A GATE. Everything here runs in a browser and anyone who
      opens devtools can step around it. The refusal has to exist in
      /portraits/generate as well or it stops only the people who were not
      trying. CENG's, and it is the half that matters.

  2 · AGE ESTIMATION FROM A PHOTOGRAPH IS NOT RELIABLE, in either direction.
      This will refuse some adults and pass some seventeen-year-olds. It
      reduces the risk; it does not remove it.

  3 · NULL IS NOT A REFUSAL. When analyze cannot say — which is most of the
      time today, because those fields have been coming back empty — the
      craft proceeds. Blocking on null would refuse every photograph in the
      product. That is a real hole and the server-side gate is what closes
      it.

HOW IT BEHAVES, AND WHY

  · It fires at analyze, before a finish is chosen and long before money.
    Refusing after a charge would mean taking money for something we were
    never going to make.
  · IT CANNOT BE OVERRIDDEN. The four photograph faults offer "use this one
    anyway" because they are judgements about quality and the customer is
    entitled to disagree. This is not a judgement about quality and there is
    no button.
  · The words are policy, not an opinion about the person. "The studio
    crafts portraits of adults" — not "this looks like a child", which is
    both rude and a claim the machine cannot support.
  · The photograph is cleared. Leaving it in the panel with a refusal beside
    it invites another attempt with the same file.

Run from the repo root:  python scripts\\build_s128_age_gate.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-05-s127.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-05-s128.html')

EXPECTED_ROUTES = 19


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

# ───────────────────────────────────────────────────────────────────── 1 · CSS

doc = rep(
    doc,
    "/* ---- the Another Age toggle -------------------------------------------\r\n",

    "/* ---- the age gate -------------------------------------------------------\r\n"
    "   Its own modal, not one of the eight intake states. Those all offer a\r\n"
    "   way onward and this one does not, and dressing a refusal in the same\r\n"
    "   clothes as a suggestion is how a refusal gets treated as one. */\r\n"
    ".agegate{\r\n"
    "  position:fixed; inset:0; z-index:130;\r\n"
    "  display:none; align-items:center; justify-content:center;\r\n"
    "  padding:1.5rem;\r\n"
    "  background:rgba(20,14,10,.72);\r\n"
    "  backdrop-filter:blur(3px);\r\n"
    "}\r\n"
    ".agegate.is-open{ display:flex }\r\n"
    ".agegate-card{\r\n"
    "  width:min(440px,100%);\r\n"
    "  padding:1.8rem 1.9rem 1.6rem;\r\n"
    "  border-radius:10px;\r\n"
    "  background:var(--vellum-100);\r\n"
    "  border:1px solid rgba(137,105,67,.3);\r\n"
    "  box-shadow:0 1.4rem 3rem rgba(28,18,10,.4);\r\n"
    "}\r\n"
    ".agegate-card h3{\r\n"
    "  font-family:var(--serif); font-weight:400; font-size:1.5rem;\r\n"
    "  color:var(--ink); margin-bottom:.5em;\r\n"
    "}\r\n"
    ".agegate-card p{\r\n"
    "  font-family:var(--sans); font-size:.9rem; line-height:1.6;\r\n"
    "  color:var(--ink-soft);\r\n"
    "}\r\n"
    ".agegate-card p + p{ margin-top:.7em }\r\n"
    ".agegate-card button{\r\n"
    "  width:100%; margin-top:1.4rem; padding:.8em;\r\n"
    "  border:0; border-radius:8px; background:var(--oxblood);\r\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.2rem;\r\n"
    "  color:var(--vellum-100); cursor:pointer;\r\n"
    "}\r\n"
    "\r\n"
    "/* ---- the Another Age toggle -------------------------------------------\r\n",
    'age gate css',
)

# ────────────────────────────────────────────────────────────────── 2 · markup

doc = rep(
    doc,
    "  <!-- ============================================================\r\n"
    "       THE ACCOUNT",

    "  <!-- ============================================================\r\n"
    "       THE AGE GATE · ruled 2026-08-05\r\n"
    "       One button, and it does not close any other way. A refusal that\r\n"
    "       can be dismissed by clicking past it is a suggestion.\r\n"
    "       ============================================================ -->\r\n"
    "  <div class=\"agegate\" id=\"ageGate\" role=\"alertdialog\" aria-modal=\"true\"\r\n"
    "       aria-labelledby=\"ageGateH\">\r\n"
    "    <div class=\"agegate-card\">\r\n"
    "      <h3 id=\"ageGateH\">We can't craft from this photograph</h3>\r\n"
    "      <p>Liten &amp; Co crafts portraits of adults. We are not able to work\r\n"
    "        from photographs of children.</p>\r\n"
    "      <p>Nothing has been crafted and nothing has been charged.</p>\r\n"
    "      <button id=\"ageGateGo\" type=\"button\">Choose a different photograph</button>\r\n"
    "    </div>\r\n"
    "  </div>\r\n"
    "\r\n"
    "  <!-- ============================================================\r\n"
    "       THE ACCOUNT",
    'age gate markup',
)

# ────────────────────────────────────────────────────────────────────── 3 · JS

JS = (
    "  /* ---- the age gate --------------------------------------------------------\n"
    "     Ruled 2026-08-05. analyze returns `age_group` at the top level:\n"
    "     child (0-11), teen (12-17), young (18-29), adult, mature, senior.\n"
    "     The first two are under eighteen.\n"
    "\n"
    "     THREE THINGS THAT ARE TRUE OF THIS AND SHOULD NOT BE FORGOTTEN:\n"
    "\n"
    "     1 · It runs in a browser. Anyone who opens devtools steps around it.\n"
    "         The refusal has to exist in /portraits/generate as well or it\n"
    "         stops only the people who were not trying.\n"
    "     2 · Age from a photograph is not reliable in either direction. This\n"
    "         refuses some adults and passes some seventeen-year-olds.\n"
    "     3 · Null is not a refusal. When analyze cannot say — which is most of\n"
    "         the time today — the craft proceeds, because blocking on null\n"
    "         would refuse every photograph in the product. */\n"
    "  var UNDER_18 = { child:true, teen:true };\n"
    "  var ageGate = document.getElementById('ageGate');\n"
    "\n"
    "  function ageFromPhoto(){\n"
    "    /* Top level first — that is where the dedicated vision call puts it.\n"
    "       The nested one is the old shape and is read so neither side has to\n"
    "       land before the other. */\n"
    "    var top = (SRC && SRC.age_group) || null;\n"
    "    if (top) return top;\n"
    "    var a = (SRC && SRC.analyze) || {};\n"
    "    return a.detected_age_group || null;\n"
    "  }\n"
    "\n"
    "  function isUnderage(){ return !!UNDER_18[ageFromPhoto()]; }\n"
    "\n"
    "  function openAgeGate(){\n"
    "    if (!ageGate) return;\n"
    "    /* The photograph goes. Leaving it in the panel beside a refusal is an\n"
    "       invitation to try the same file again. */\n"
    "    SRC.b64 = null; SRC.dataUrl = null; SRC.analyze = {};\n"
    "    SRC.subject = null; SRC.gender = null; SRC.age_group = null;\n"
    "    QUEUE.length = 0;\n"
    "    if (typeof renderQueue === 'function') renderQueue();\n"
    "    if (typeof clearResume === 'function') clearResume();\n"
    "    if (typeof curatorState === 'function') curatorState('empty', SAY.empty);\n"
    "    ageGate.classList.add('is-open');\n"
    "    console.warn('[age] refused — the studio does not craft from photographs of children');\n"
    "  }\n"
    "\n"
    "  /* A way to see this without having to find a photograph of a child.\n"
    "     __ageCheck('teen') raises it; __ageCheck('adult') does not. Same\n"
    "     shape as __openIntake and for the same reason — a refusal nobody can\n"
    "     look at is a refusal nobody has judged. */\n"
    "  window.__ageCheck = function(bracket){\n"
    "    SRC.age_group = bracket || null;\n"
    "    if (isUnderage()){ openAgeGate(); return 'refused'; }\n"
    "    return 'passed';\n"
    "  };\n"
    "\n"
    "  var ageGateGo = document.getElementById('ageGateGo');\n"
    "  if (ageGateGo) ageGateGo.addEventListener('click', function(){\n"
    "    ageGate.classList.remove('is-open');\n"
    "    if (typeof pickSource === 'function') pickSource();\n"
    "  });\n"
    "\n"
)

doc = rep(
    doc,
    "  /* ---- the photograph's own shape ---------------------------------------\r\n",
    JS + "  /* ---- the photograph's own shape ---------------------------------------\r\n",
    'age gate js',
)

# ── 4 · it fires the moment analyze answers, before anything else ──────────

doc = rep(
    doc,
    "      SRC.gender  = (data && data.gender) || null;\r\n"
    "      if (!SUBJECT_FORCED){\r\n",

    "      SRC.gender  = (data && data.gender) || null;\r\n"
    "      SRC.age_group = (data && data.age_group) || null;\r\n"
    "\r\n"
    "      /* BEFORE anything else. Not after the rooms have been offered and\r\n"
    "         certainly not after a charge — refusing then would mean taking\r\n"
    "         money for something we were never going to make. */\r\n"
    "      if (isUnderage()){ openAgeGate(); return; }\r\n"
    "\r\n"
    "      if (!SUBJECT_FORCED){\r\n",
    'age gate fires',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# both under-18 brackets, and only those
if 'var UNDER_18 = { child:true, teen:true };' not in doc:
    die('the refused brackets are not child and teen')
for ok in ('young', 'mature', 'senior'):
    if ("UNDER_18 = { child:true, teen:true, " + ok) in doc:
        die('%s is being refused and is over eighteen' % ok)

# it fires before anything else, and returns
if 'if (isUnderage()){ openAgeGate(); return; }' not in doc:
    die('the gate does not stop the flow')
at_gate = probe.index('if (isUnderage()){ openAgeGate(); return; }')
at_subject = probe.index('if (!SUBJECT_FORCED){')
if at_gate > at_subject:
    die('the gate fires after the rooms have been prepared')

# THERE IS NO WAY PAST IT
if 'agegate' not in doc:
    die('the gate has no modal')
# The card only — from the modal's opening tag to its own closing button.
i = doc.index('<div class="agegate"')
j = doc.index('</button>', i) + len('</button>')
gatecard = doc[i:j]
if gatecard.count('<button') != 1:
    die('the refusal offers more than one button')
if 'anyway' in gatecard.lower():
    die('the refusal can be overridden')
if re.search(r"ageGate\.addEventListener\('click'", probe):
    die('the refusal can be dismissed by clicking past it')

# the photograph is cleared, so the same file is not simply retried
if 'SRC.b64 = null; SRC.dataUrl = null;' not in doc:
    die('the refused photograph is left in the panel')
if 'QUEUE.length = 0;' not in doc:
    die('the queue survives a refusal')

# a way to judge it without needing such a photograph
if 'window.__ageCheck = function(bracket)' not in doc:
    die('there is no way to see the refusal without finding a photograph of a child')

# null is not a refusal
if 'return !!UNDER_18[ageFromPhoto()]' not in doc:
    die('an unknown age is being treated as a refusal')

# the words are policy, not a judgement about the person
for bad in ('looks like a child', 'appears to be', 'we think', 'seems to be'):
    if bad in probe.lower():
        die('the refusal makes a claim about the person: %s' % bad)
if 'crafts portraits of adults' not in doc:
    die('the refusal does not state the policy')

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

print('GATE PASSED · child and teen refused, no override, fires before the rooms'
      ' · %d routes' % routes)
print('REMEMBER: this is the browser half. /portraits/generate must refuse too.')
print('wrote ' + OUT)
