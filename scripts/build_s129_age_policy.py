# -*- coding: utf-8 -*-
"""
build_s129_age_policy.py  ·  2026-08-05  ·  CUI V25

The policy, in the place the refusal happens.

    A refusal that states a rule and gives no way to read the rule is a
    refusal a customer has to take on trust. The full statement is behind
    one link inside the modal itself — not on a Help page that does not
    exist, and not in a footer nobody opens at the moment they were told no.

RICH'S WORDS, VERBATIM, LOCKED 2026-08-05
    One edit only, agreed: "soon" became "in future". The rest is his,
    including the privacy paragraph — he split that hair deliberately and
    it is his undertaking about his own conduct, not a claim about anyone
    else's.

    NOT MINE TO EDIT. If this text needs to change it changes here, in one
    place, and the modal reads it.

WHAT WAS CHECKED BEHIND THE PRIVACY LINE

    Replicate deletes API prediction inputs, outputs, files and logs after
    an hour by default. OpenAI does not train on API data by default and
    retains for a short abuse-monitoring window.

    NB2 is Google's Gemini 3.1 Flash Image reached through Replicate, and
    which Google surface that is — and therefore its data terms — is not
    published on the model page. Rich's wording is about what Liten & Co
    does, which is why it stands. If it is ever widened to a claim about
    the whole chain, that gap has to be closed first.

Run from the repo root:  python scripts\\build_s129_age_policy.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-05-s128.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-05-s129.html')

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
    ".agegate-card button{\r\n",

    "/* the full statement, behind one link */\r\n"
    ".agegate-more{\r\n"
    "  display:block; width:100%; margin-top:1rem;\r\n"
    "  background:none; border:0; padding:0; cursor:pointer;\r\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.02rem;\r\n"
    "  color:var(--oxblood); text-align:left;\r\n"
    "}\r\n"
    ".agegate-more:hover{ text-decoration:underline }\r\n"
    ".agegate-policy{\r\n"
    "  display:none; margin-top:1rem; padding-top:1rem;\r\n"
    "  border-top:1px solid rgba(137,105,67,.24);\r\n"
    "  max-height:38vh; overflow-y:auto;\r\n"
    "}\r\n"
    ".agegate-policy.is-open{ display:block }\r\n"
    ".agegate-policy h4{\r\n"
    "  font-family:var(--serif); font-weight:400; font-size:1.15rem;\r\n"
    "  color:var(--ink); margin-bottom:.4em;\r\n"
    "}\r\n"
    ".agegate-policy h4 + p{ margin-top:0 }\r\n"
    ".agegate-policy p{\r\n"
    "  font-family:var(--sans); font-size:.84rem; line-height:1.6;\r\n"
    "  color:var(--ink-soft); margin-top:.6em;\r\n"
    "}\r\n"
    ".agegate-policy h4:not(:first-child){ margin-top:1.1em }\r\n"
    ".agegate-card button{\r\n",
    'policy css',
)

# ────────────────────────────────────────────────────────────────── 2 · markup

POLICY = (
    "      <button class=\"agegate-more\" id=\"ageGateMore\" type=\"button\"\r\n"
    "              aria-expanded=\"false\" aria-controls=\"ageGatePolicy\">\r\n"
    "        Why we do this\r\n"
    "      </button>\r\n"
    "\r\n"
    "      <!-- Rich's words, locked 2026-08-05. One place. If this changes it\r\n"
    "           changes here. -->\r\n"
    "      <div class=\"agegate-policy\" id=\"ageGatePolicy\">\r\n"
    "        <h4>Portraits of adults only, for now</h4>\r\n"
    "        <p>Liten &amp; Co currently creates portraits of adults 18 and over.</p>\r\n"
    "        <p>We&rsquo;re taking a little more time to understand the evolving\r\n"
    "          policies and usage rights surrounding the transformation of images\r\n"
    "          and likenesses of people under 18, both in the U.S. and\r\n"
    "          internationally.</p>\r\n"
    "        <p>For now, photos of anyone we believe to be under 18 will be\r\n"
    "          declined before anything is crafted or charged.</p>\r\n"
    "        <p>We hope to offer this in future as the policies and protections\r\n"
    "          around younger subjects become clearer. We&rsquo;ll keep you\r\n"
    "          posted.</p>\r\n"
    "\r\n"
    "        <h4>A note about your photos</h4>\r\n"
    "        <p>Your photograph is used only to create your Liten &amp; Co pieces.\r\n"
    "          We don&rsquo;t sell them, use them to train AI models, or share\r\n"
    "          them with others.</p>\r\n"
    "      </div>\r\n"
)

doc = rep(
    doc,
    "      <button id=\"ageGateGo\" type=\"button\">Choose a different photograph</button>\r\n",
    "      <button id=\"ageGateGo\" type=\"button\">Choose a different photograph</button>\r\n"
    + POLICY,
    'policy markup',
)

# ────────────────────────────────────────────────────────────────────── 3 · JS

doc = rep(
    doc,
    "  var ageGateGo = document.getElementById('ageGateGo');\n",

    "  /* One link, opening in place. A separate page would be a page a\n"
    "     customer has to leave the refusal to read, and they would not come\n"
    "     back. */\n"
    "  var ageGateMore = document.getElementById('ageGateMore');\n"
    "  if (ageGateMore) ageGateMore.addEventListener('click', function(){\n"
    "    var p = document.getElementById('ageGatePolicy');\n"
    "    if (!p) return;\n"
    "    var open = p.classList.toggle('is-open');\n"
    "    ageGateMore.setAttribute('aria-expanded', open ? 'true' : 'false');\n"
    "    ageGateMore.textContent = open ? 'Close' : 'Why we do this';\n"
    "  });\n"
    "\n"
    "  var ageGateGo = document.getElementById('ageGateGo');\n",
    'policy js',
)

# it should be shut again the next time the refusal is raised
doc = rep(
    doc,
    "    ageGate.classList.add('is-open');\n",
    "    /* Shut, every time. A customer who read it once should not have the\n"
    "       whole statement in their face on a second refusal. */\n"
    "    var pol = document.getElementById('ageGatePolicy');\n"
    "    if (pol) pol.classList.remove('is-open');\n"
    "    if (ageGateMore){\n"
    "      ageGateMore.textContent = 'Why we do this';\n"
    "      ageGateMore.setAttribute('aria-expanded', 'false');\n"
    "    }\n"
    "    ageGate.classList.add('is-open');\n",
    'policy resets',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# Rich's words, exactly, and in one place only
LOCKED = [
    'Portraits of adults only, for now',
    'Liten &amp; Co currently creates portraits of adults 18 and over.',
    'evolving\r\n          policies and usage rights surrounding the transformation of images',
    'declined before anything is crafted or charged',
    'We hope to offer this in future as the policies and protections',
    'A note about your photos',
    'We don&rsquo;t sell them, use them to train AI models, or share',
]
for line in LOCKED:
    if doc.count(line.replace('\r\n', '\n')) + doc.count(line) < 1:
        die('a locked line is missing or altered: %s' % line[:48])
if doc.count('Portraits of adults only, for now') != 1:
    die('the statement exists in more than one place and they will diverge')

# the edit that was agreed, and the word it replaced
if 'offer this soon' in probe:
    die('"soon" survived — it promises against somebody else\'s timetable')

# the refusal still offers exactly one way onward
i = doc.index('<div class="agegate"')
card = doc[i:doc.index('</div>', doc.index('agegate-policy', i))]
if card.count('anyway') or card.lower().count('use this one'):
    die('the refusal can be overridden')
if 'id="ageGateGo"' not in card:
    die('the refusal lost its only button')

# the statement opens in place and starts shut
if '.agegate-policy.is-open{ display:block }' not in doc:
    die('the statement cannot be opened')
if "pol.classList.remove('is-open');" not in doc:
    die('the statement stays open into the next refusal')
if 'aria-controls="ageGatePolicy"' not in doc:
    die('the link is not tied to what it opens')

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

print('GATE PASSED · the policy is locked, in one place, behind the refusal · %d routes'
      % routes)
print('wrote ' + OUT)
