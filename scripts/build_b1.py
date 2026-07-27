#!/usr/bin/env python3
"""
build_b1.py — Portraits build 1

BASE:   public/portraits_recover2.html   (8,824 lines · boots clean · reaches Stripe)
OUTPUT: public/portraits-b1.html

CHANGE
  Preview images were matched to the uploader's inferred gender and age via
  DEMO_SUBJECT. That targets the customer, which is the opposite of the ruled
  intent: the four previews per effect are deliberately varied — mixed gender,
  age and ethnicity — so the gallery reads as broad rather than aimed.

  It also never worked. check-previews reported 0/288 demographic paths and
  0/12 generic fallbacks resolving. Every preview in the workshop 404s today.

  Replaced with a hash-of-preset + session-seed pick across the four files that
  actually exist. The grid shows a mix at any one moment, holds steady within a
  session, and shifts between visits.

  DEMO_SUBJECT and PREVIEW_FILE are both removed. state.detectedGender and
  state.detectedAgeGroup have no remaining reader.

GATE
  Fails and writes nothing on: a lost id, a lost fetch call, fewer functions,
  a JS syntax error, an unbalanced style block, a duplicate id, markup drift
  beyond the declared change, or any surviving reference to the removed maps.
"""

import re, sys, subprocess, os, shutil

SRC = 'public/portraits_recover2.html'
OUT = 'public/portraits-b1.html'

if not os.path.exists(SRC):
    print(f'BASE NOT FOUND: {SRC}'); sys.exit(1)

raw    = open(SRC, 'rb').read()
before = raw.decode('utf-8')
h      = before
CRLF   = '\r\n' in before

def nl(s):
    return s.replace('\n', '\r\n') if CRLF else s

# ---------------------------------------------------------------- the change
OLD = nl("""const PREVIEW_FILE = {
  alabaster:'alabaster.jpg', bronze:'bronze.jpg', charcoal_chalk:'charcoal.jpg',
  ebony:'ebony.jpg', folded_book:'folded book.jpg', impressionist:'impressionist.jpg',
  iron:'iron.jpg', pencil_sketch:'pencil sketch.jpg', sheet_music:'sheet music.jpg',
  stone:'stone.jpg', torn_paper:'torn paper.jpg', walnut:'walnut.jpg',
}
const DEMO_SUBJECT = {
  f_child:'f_child_a', f_teen:'f_teen_a', f_young:'f_young_a',
  f_adult:'f_adult_a', f_mature:'f_mature_a', f_senior:'f_senior_a',
  m_child:'m_child_a', m_teen:'m_teen_b', m_young:'m_young_b',
  m_adult:'m_adult_a', m_mature:'m_mature_a', m_senior:'m_senior_a',
}
function previewSrc(preset) {
  if (state.detectedGender && state.detectedAgeGroup) {
    const key = state.detectedGender + '_' + state.detectedAgeGroup
    const subj = DEMO_SUBJECT[key]
    if (subj) return PREVIEW_BASE + encodeURIComponent(preset) + '/' + encodeURIComponent(subj) + '.jpg'
  }
  return PREVIEW_BASE + encodeURIComponent(PREVIEW_FILE[preset] || '')
}""")

NEW = nl("""// Each effect ships four previews, deliberately varied across gender, age and
// ethnicity so the gallery reads as broad rather than aimed at the viewer.
// Previews are NEVER matched to the uploader — that was the earlier approach
// and it is retired. Hashing the preset spreads different faces across the
// grid at once; the session seed shifts the set between visits; both together
// keep it steady while the customer is looking at it.
const PREVIEW_VARIANTS = 4
const PREVIEW_SEED = Math.floor(Math.random() * PREVIEW_VARIANTS)
function previewSrc(preset) {
  const p = String(preset || '')
  let hash = 0
  for (let i = 0; i < p.length; i++) hash = (hash * 31 + p.charCodeAt(i)) | 0
  const base = ((hash % PREVIEW_VARIANTS) + PREVIEW_VARIANTS) % PREVIEW_VARIANTS
  const n = ((base + PREVIEW_SEED) % PREVIEW_VARIANTS) + 1
  return PREVIEW_BASE + encodeURIComponent(p) + '/' + n + '.jpg'
}""")

if h.count(OLD) != 1:
    print(f'ANCHOR FAIL: preview block found {h.count(OLD)} times, expected 1')
    print('The base file differs from the one this build was written against.')
    sys.exit(1)
h = h.replace(OLD, NEW, 1)

# ---------------------------------------------------------------- gate
fail = []

def ids_of(doc):    return re.findall(r'(?<![-\w])id="([^"]+)"', doc)
def fetches(doc):   return len(re.findall(r'\bfetch\s*\(', doc))
def funcs(doc):
    s = ' '.join(re.findall(r'<script[^>]*>(.*?)</script>', doc, re.S))
    return set(re.findall(r'function\s+([A-Za-z_$][\w$]*)', s))

b_ids, a_ids   = set(ids_of(before)), set(ids_of(h))
b_fx,  a_fx    = fetches(before), fetches(h)
b_fn,  a_fn    = funcs(before), funcs(h)

lost_ids = b_ids - a_ids
lost_fn  = b_fn - a_fn
if lost_ids: fail.append(f'LOST IDS: {sorted(lost_ids)}')
if a_fx != b_fx: fail.append(f'FETCH COUNT CHANGED: {b_fx} -> {a_fx}')
if lost_fn: fail.append(f'LOST FUNCTIONS: {sorted(lost_fn)}')

dupes = {i for i in ids_of(h) if ids_of(h).count(i) > 1}
if dupes: fail.append(f'DUPLICATE IDS: {sorted(dupes)}')

# the removed maps must be gone, and nothing may still reference them
for tok in ['DEMO_SUBJECT', 'PREVIEW_FILE']:
    if tok in h: fail.append(f'REMOVED MAP STILL REFERENCED: {tok}')

# the state it read must have no remaining reader
for tok in ['state.detectedGender &&', 'state.detectedAgeGroup +']:
    if tok in h: fail.append(f'DEMOGRAPHIC MATCHING SURVIVES: {tok}')

# every preview path must now resolve to 1..4
for m in re.finditer(r'PREVIEW_BASE \+ [^\n]*', h):
    line = m.group(0)
    if 'PREVIEW_VARIANTS' not in line and "+ n + '.jpg'" not in line:
        fail.append(f'UNGUARDED PREVIEW PATH: {line[:70]}')

# markup outside <script> must be byte-identical
strip = lambda d: re.sub(r'<script[^>]*>.*?</script>', '', d, flags=re.S)
if strip(h) != strip(before): fail.append('MARKUP DRIFT — b1 is a script-only change')

# style block balance
if '<style' in h:
    st = h[h.index('<style'):h.rindex('</style>')]
    if st.count('{') != st.count('}'): fail.append('STYLE BRACE IMBALANCE')

# JS must parse
for i, s in enumerate(re.findall(r'<script[^>]*>(.*?)</script>', h, re.S)):
    if not s.strip(): continue
    fn = f'/tmp/b1_{i}.js'
    open(fn, 'w', encoding='utf-8').write(s)
    r = subprocess.run(['node', '--check', fn], capture_output=True, text=True)
    if r.returncode != 0:
        fail.append(f'SCRIPT[{i}] SYNTAX: ' + r.stderr.strip().split("\n")[0][:110])

if fail:
    print('GATE FAILED — nothing written:')
    for f in fail: print('  ' + f)
    sys.exit(1)

open(OUT, 'w', encoding='utf-8', newline='').write(h)

print('ALL GATES PASSED')
print(f'  ids       {len(b_ids)} -> {len(a_ids)}   (none lost)')
print(f'  fetch     {b_fx} -> {a_fx}')
print(f'  functions {len(b_fn)} -> {len(a_fn)}')
print(f'  markup    unchanged')
print(f'  JS        parses')
print(f'WROTE {OUT}')
print('')
print('Next:  node scripts/check-previews.js public/portraits-b1.html')
print('       then view localhost:3000/portraits-b1.html')
