# -*- coding: utf-8 -*-
"""
build_s109_print_shop_light.py  ·  2026-08-03  ·  CUI V25

The Print Shop, rebuilt to Rich's mockup.

WHAT THE MOCKUP GETS RIGHT AND s101 DID NOT

  · FINISH BEFORE SIZE. Six families against four sizes is twenty-four
    options, and s101 listed them flat. That was readable at four and
    unreadable at twenty-four. Family first with a "from" price, then the
    sizes inside it, is the only shape that survives the real catalogue.
  · THE ORDER IS VISIBLE WHILE YOU BUILD IT. s101 hid it behind a tab, so a
    customer could not see what was configured while configuring the next
    one. It is a strip along the foot now, with ready and needs-options
    counted separately.
  · THE PIECE IS SHOWN AT SIZE. s101 put a thumbnail in the flyout. The
    decision being made is how this picture should look on a wall, and it
    was being made against a 100px square.

LIGHT, AND THE TEXTURE
    Ruled 2026-08-03. The shop is vellum rather than coffee — it is a shop,
    not a store room. Limestone under a wash, the same recipe as the Curator
    panel and the footer, with the noise layer over it. Not a flat cream
    rectangle; the surfaces in this file have never been flat.

THE OPTIONS ARE STILL sku-map.ts's
    Nothing here invents a SKU or a price. The build reads
    lib/v1/print/sku-map.ts and groups by `family` where the map carries
    one, falling back to the finish where it does not. So it renders the two
    families that exist today and the six that will exist once the Prodigi
    validation lands, with no edit here.

    ONE THING sku-map.ts NEEDS, FOR RICH: a `family` and `familyLabel` on
    each entry. Without them "Fine Art Print" and "Premium Fine Art Print"
    both read as `unframed` and collapse into one card.

    The sizes in the mockup are 4:5. Portraits renders 1:1, so every one of
    them would letterbox. The squares come with the validated map.

Run from the repo root:  python scripts\\build_s109_print_shop_light.py
"""

import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s108.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s109.html')
SKU_MAP = os.path.join(ROOT, 'lib', 'v1', 'print', 'sku-map.ts')

EXPECTED_ROUTES = 15

SIZE_LABEL = {
    '8x8': '8 × 8″', '12x12': '12 × 12″', '16x16': '16 × 16″', '20x20': '20 × 20″',
    '8x10': '8 × 10″', '12x16': '12 × 16″', '18x24': '18 × 24″',
}

# Where the map carries no family of its own, the finish is the family.
FALLBACK_FAMILY = {
    'unframed': ('fine_art', 'Fine Art Print', 'Enhanced matte art paper'),
    'framed':   ('framed', 'Framed Print', 'Framed and mounted, ready to hang'),
}


def die(msg):
    print('GATE FAILED · ' + msg)
    sys.exit(1)


def rep(text, old, new, label):
    for a, b in ((old, new), (old.replace('\r\n', '\n'), new.replace('\r\n', '\n'))):
        if text.count(a) == 1:
            return text.replace(a, b)
    die('anchor "%s" appears %d times, expected 1' % (label, text.count(old)))


# ── read the price authority ────────────────────────────────────────────────
if not os.path.exists(SKU_MAP):
    die('sku-map.ts not found at ' + SKU_MAP)

with open(SKU_MAP, encoding='utf-8') as f:
    ts = f.read()

# Every family in SKU_MAP, in the order they are written. The first cut
# knew only 'unframed' and 'framed' and would have shown four of the
# twenty-four options once the real map landed.
map_start = ts.index('export const SKU_MAP')
brace = ts.index('{', map_start)
depth = 0
for k in range(brace, len(ts)):
    if ts[k] == '{':
        depth += 1
    elif ts[k] == '}':
        depth -= 1
        if depth == 0:
            map_end = k
            break
map_body = ts[brace + 1:map_end]

FAMILY_KEYS = [m.group(1) for m in re.finditer(r'^  ([a-z_]+):\s*\{', map_body, re.M)]
if not FAMILY_KEYS:
    die('no families found in SKU_MAP')

# The entries reference FAMILY_LABEL.x and FAMILY_NOTE.x rather than
# repeating the strings twenty-four times, so those constants are resolved
# here. A build that read only literals would have produced blank shelves.
def const_map(name):
    i = ts.find('const ' + name)
    if i < 0:
        return {}
    return dict(re.findall(r"(\w+):\s*'([^']*)'", ts[i:ts.index('}', i)]))

FAM_LABELS = const_map('FAMILY_LABEL')
FAM_NOTES = const_map('FAMILY_NOTE')

OPTS = []
for finish in FAMILY_KEYS:
    m = re.search(r'^  ' + finish + r':\s*\{(.*?)^  \},?$', map_body, re.S | re.M)
    if not m:
        die('could not read the %s block from sku-map.ts' % finish)
    for sm in re.finditer(r"'([0-9]+x[0-9]+)':\s*\{(.*?)\n    \}", m.group(1), re.S):
        size, body = sm.group(1), sm.group(2)
        cents = re.search(r'retailCents:\s*([0-9]+)', body)
        fam = re.search(r"family:\s*'([a-z_]+)'", body)
        # familyLabel/familyNote may be a constant reference rather than a
        # literal, so the label written on the size is preferred where it
        # exists and the constant is resolved below where it is not.
        famlab = re.search(r"familyLabel:\s*'([^']*)'", body)
        note = re.search(r"familyNote:\s*'([^']*)'", body)
        sizelab = re.search(r"label:\s*'([^']*)'", body)
        if not cents:
            die('no retailCents for %s %s' % (finish, size))
        fb = FALLBACK_FAMILY.get(finish, (finish, finish.title(), ''))
        OPTS.append({
            'size': size,
            'finish': finish,
            'cents': int(cents.group(1)),
            'sizeLabel': sizelab.group(1) if sizelab else SIZE_LABEL.get(size, size),
            'family': fam.group(1) if fam else fb[0],
            'familyLabel': (famlab.group(1) if famlab
                            else FAM_LABELS.get(fam.group(1) if fam else '', fb[1])),
            'familyNote': (note.group(1) if note
                           else FAM_NOTES.get(fam.group(1) if fam else '', fb[2])),
        })

if len(OPTS) < 2:
    die('only %d print options read from sku-map.ts' % len(OPTS))

seen = set()
for o in OPTS:
    k = (o['size'], o['finish'])
    if k in seen:
        die('%s %s read twice from sku-map.ts' % k)
    seen.add(k)

# families, in the order they first appear, each with its sizes cheapest first
fams = []
for o in OPTS:
    if not any(f['id'] == o['family'] for f in fams):
        fams.append({'id': o['family'], 'label': o['familyLabel'],
                     'note': o['familyNote'], 'sizes': []})
    for f in fams:
        if f['id'] == o['family']:
            f['sizes'].append({'size': o['size'], 'finish': o['finish'],
                               'cents': o['cents'], 'label': o['sizeLabel']})
for f in fams:
    f['sizes'].sort(key=lambda s: s['cents'])

lines = ['  var PRINT_FAMILIES = [']
for n, f in enumerate(fams):
    sizes = ', '.join(
        '{ size:%s, finish:%s, cents:%d, label:%s }' % (
            json.dumps(s['size']), json.dumps(s['finish']), s['cents'],
            json.dumps(s['label'])) for s in f['sizes'])
    lines.append('    { id:%s, label:%s, note:%s,\n      sizes:[%s] }%s' % (
        json.dumps(f['id']), json.dumps(f['label']), json.dumps(f['note']),
        sizes, ',' if n < len(fams) - 1 else ''))
lines.append('  ];')
FAMILIES_JS = '\r\n'.join(lines)

# ── apply ───────────────────────────────────────────────────────────────────
with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

doc = src

# 1 · the surface turns light
doc = rep(
    doc,
    ".pshop{\n"
    "  position:fixed; z-index:56;\n"
    "  top:var(--mh-h); bottom:0; right:0;\n"
    "  left:calc(var(--stage-gutter) + var(--spine-w) + var(--room-gap));\n"
    "  display:flex; flex-direction:column;\n"
    "  padding:clamp(16px,1.2vw,26px) clamp(14px,1vw,22px) 0;\n"
    "  background:#1a1613;\n"
    "  border-left:1px solid rgba(174,133,78,.26);\n"
    "  transform:translateX(101%);\n"
    "  transition:transform .72s cubic-bezier(.16,1,.3,1);\n"
    "  overflow:hidden;\n"
    "}\n"
    ".pshop.is-open{ transform:translateX(0) }\n"
    ".pshop::before{\n"
    "  content:\"\"; position:absolute; inset:0; z-index:0; pointer-events:none;\n"
    "  background-image:url('/textures/noise.png');\n"
    "  background-size:13rem; opacity:.12; mix-blend-mode:soft-light;\n"
    "}\n"
    ".pshop > *{ position:relative; z-index:1 }\n",

    "/* Ruled 2026-08-03: the shop is vellum, not coffee. It is a shop, not a\n"
    "   store room, and the pieces have to be judged against something close\n"
    "   to the wall they will hang on.\n"
    "\n"
    "   Limestone under a wash, the same stack the Curator panel and the\n"
    "   footer use, with the noise layer over it. Nothing in this file is a\n"
    "   flat rectangle of colour and this must not be the first. */\n"
    ".pshop{\n"
    "  position:fixed; z-index:56;\n"
    "  top:var(--mh-h); bottom:0; right:0;\n"
    "  left:calc(var(--stage-gutter) + var(--spine-w) + var(--room-gap));\n"
    "  display:flex; flex-direction:column;\n"
    "  padding:clamp(16px,1.2vw,26px) clamp(14px,1vw,22px) 0;\n"
    "  isolation:isolate;\n"
    "  background-color:var(--limestone);\n"
    "  background-image:\n"
    "    radial-gradient(circle at 8% 0%, rgba(255,255,255,.4), transparent 44%),\n"
    "    radial-gradient(circle at 94% 96%, rgba(118,82,45,.04), transparent 46%),\n"
    "    linear-gradient(0deg,\n"
    "      rgba(241,236,227,var(--ls-wash)), rgba(241,236,227,var(--ls-wash))),\n"
    "    url(\"/textures/limestone.jpg\");\n"
    "  background-repeat:no-repeat,no-repeat,repeat,repeat;\n"
    "  background-size:auto,auto,auto,var(--ls-tile) var(--ls-tile);\n"
    "  background-position:center,center,center,center;\n"
    "  border-left:1px solid rgba(137,105,67,.24);\n"
    "  box-shadow:inset 0 1px 0 rgba(255,255,255,.6), -1.2rem 0 2.4rem rgba(46,32,18,.18);\n"
    "  transform:translateX(101%);\n"
    "  transition:transform .72s cubic-bezier(.16,1,.3,1);\n"
    "  overflow:hidden;\n"
    "}\n"
    ".pshop.is-open{ transform:translateX(0) }\n"
    ".pshop::before{\n"
    "  content:\"\"; position:absolute; inset:0; z-index:-1; pointer-events:none;\n"
    "  background-image:url(\"/textures/noise.png\");\n"
    "  background-repeat:repeat; background-size:14rem 14rem;\n"
    "  opacity:.045; mix-blend-mode:multiply;\n"
    "}\n"
    ".pshop > *{ position:relative; z-index:1 }\n"
    "/* The head came from My Collection, which is dark. On vellum it needs\n"
    "   the ink treatment or it reads as a hole. */\n"
    ".pshop .mc-head{ border-bottom-color:rgba(137,105,67,.22) }\n"
    ".pshop .mc-close{ color:var(--ink-soft) }\n"
    ".pshop .mc-close:hover{ color:var(--oxblood) }\n"
    ".pshop .mc-title{ color:var(--ink) }\n"
    ".pshop .mc-n{ color:var(--ink-soft) }\n"
    ".pshop .mc-say{ color:var(--ink-soft) }\n",
    'pshop surface',
)

# 2 · the shelf, from the map
doc = rep(
    doc,
    "  var PRINT_OPTS = [",
    "  /* GENERATED from lib/v1/print/sku-map.ts at build time — grouped by\n"
    "     family so the flyout can ask which product before which size. Six\n"
    "     families of four squares is twenty-four options and a flat list of\n"
    "     twenty-four is not a choice, it is a wall.\n"
    "\n"
    "     Where the map carries no `family`, the finish stands in for one. */\n"
    + FAMILIES_JS + "\n"
    "\n"
    "  /* Kept flat as well: the cart, the quote and the checkout all speak in\n"
    "     size+finish and none of them needs to know about families. */\n"
    "  var PRINT_OPTS = [",
    'families',
)

# 3 · the flyout asks family first
doc = rep(
    doc,
    "  var PS_PIECE = null;    /* the piece open in the flyout */\r\n"
    "  var PS_OPT   = 0;\r\n",
    "  var PS_PIECE = null;    /* the piece open in the flyout */\r\n"
    "  var PS_OPT   = 0;\r\n"
    "  var PS_FAM   = 0;       /* which family is open */\r\n"
    "  var PS_SIZE  = 0;       /* which size within it */\r\n"
    "  var PS_QTY   = 1;\r\n",
    'flyout state',
)

doc = rep(
    doc,
    "  function renderFly(){\r\n"
    "    var f = document.getElementById('psFly');\r\n"
    "    if (!f) return;\r\n"
    "    if (!PS_PIECE){ f.hidden = true; f.innerHTML = ''; return; }\r\n"
    "    f.hidden = false;\r\n"
    "    var opts = PRINT_OPTS.map(function(o, i){\r\n"
    "      return '<button class=\"ps-opt' + (i === PS_OPT ? ' is-on' : '') +\r\n"
    "             '\" type=\"button\" data-opt=\"' + i + '\">' +\r\n"
    "             '<span>' + esc(o.label) +\r\n"
    "             '<span class=\"note\">' + esc(o.note) + '</span></span>' +\r\n"
    "             '<span class=\"pr\">' + money(o.cents) + '</span></button>';\r\n"
    "    }).join('');\r\n"
    "    f.innerHTML =\r\n"
    "      '<img class=\"art\" src=\"' + esc(PS_PIECE.art) + '\" alt=\"\">' +\r\n"
    "      '<h3>' + esc(PS_PIECE.name || 'Crafted Image') + '</h3>' +\r\n"
    "      '<div class=\"ps-lab\">Size and finish</div>' + opts +\r\n"
    "      '<button class=\"ps-add\" id=\"psAdd\" type=\"button\">Add to your order</button>';\r\n"
    "  }\r\n",

    "  /* Three questions in order — which product, which size, how many — and\r\n"
    "     each one narrows the next. Asking all twenty-four at once is what\r\n"
    "     s101 did and it does not survive the real catalogue. */\r\n"
    "  function currentFamily(){ return PRINT_FAMILIES[PS_FAM] || PRINT_FAMILIES[0]; }\r\n"
    "  function currentSize(){\r\n"
    "    var fam = currentFamily();\r\n"
    "    return fam && (fam.sizes[PS_SIZE] || fam.sizes[0]);\r\n"
    "  }\r\n"
    "  function fromPrice(fam){\r\n"
    "    return fam.sizes.reduce(function(m, s){ return Math.min(m, s.cents); }, Infinity);\r\n"
    "  }\r\n"
    "\r\n"
    "  function renderFly(){\r\n"
    "    var f = document.getElementById('psFly');\r\n"
    "    if (!f) return;\r\n"
    "    if (!PS_PIECE){ f.hidden = true; f.innerHTML = ''; return; }\r\n"
    "    f.hidden = false;\r\n"
    "\r\n"
    "    var fams = PRINT_FAMILIES.map(function(fam, i){\r\n"
    "      return '<button class=\"ps-fam' + (i === PS_FAM ? ' is-on' : '') +\r\n"
    "        '\" type=\"button\" data-fam=\"' + i + '\">' +\r\n"
    "        '<span class=\"nm\">' + esc(fam.label) + '</span>' +\r\n"
    "        '<span class=\"fr\">From ' + money(fromPrice(fam)) + '</span>' +\r\n"
    "        '</button>';\r\n"
    "    }).join('');\r\n"
    "\r\n"
    "    var fam = currentFamily();\r\n"
    "    var sizes = fam.sizes.map(function(s, i){\r\n"
    "      return '<button class=\"ps-size' + (i === PS_SIZE ? ' is-on' : '') +\r\n"
    "        '\" type=\"button\" data-size=\"' + i + '\">' +\r\n"
    "        '<span class=\"nm\">' + esc(s.label) + '</span>' +\r\n"
    "        '<span class=\"pr\">' + money(s.cents) + '</span>' +\r\n"
    "        '</button>';\r\n"
    "    }).join('');\r\n"
    "\r\n"
    "    var size = currentSize();\r\n"
    "    f.innerHTML =\r\n"
    "      '<div class=\"ps-fly-head\">' +\r\n"
    "        '<img src=\"' + esc(PS_PIECE.art) + '\" alt=\"\">' +\r\n"
    "        '<div><h3>' + esc(PS_PIECE.name || 'Crafted Image') + '</h3>' +\r\n"
    "        (fam.note ? '<p>' + esc(fam.note) + '</p>' : '') + '</div>' +\r\n"
    "      '</div>' +\r\n"
    "      '<div class=\"ps-step\"><b>1</b> Choose your finish</div>' +\r\n"
    "      '<div class=\"ps-fams\">' + fams + '</div>' +\r\n"
    "      '<div class=\"ps-step\"><b>2</b> Select size</div>' +\r\n"
    "      '<div class=\"ps-sizes\">' + sizes + '</div>' +\r\n"
    "      '<div class=\"ps-step\"><b>3</b> Quantity</div>' +\r\n"
    "      '<div class=\"ps-qrow\">' +\r\n"
    "        '<div class=\"ps-qty\">' +\r\n"
    "          '<button type=\"button\" data-q2=\"-\">\\u2212</button>' +\r\n"
    "          '<span>' + PS_QTY + '</span>' +\r\n"
    "          '<button type=\"button\" data-q2=\"+\">+</button>' +\r\n"
    "        '</div>' +\r\n"
    "        '<span class=\"ps-price\">' + money((size ? size.cents : 0) * PS_QTY) + '</span>' +\r\n"
    "      '</div>' +\r\n"
    "      '<button class=\"ps-add\" id=\"psAdd\" type=\"button\">Add to your order</button>';\r\n"
    "  }\r\n",
    'renderFly',
)

# 4 · adding uses the three answers
doc = rep(
    doc,
    "  function addToOrder(){\r\n"
    "    if (!PS_PIECE || !printable(PS_PIECE)) return;\r\n"
    "    var o = PRINT_OPTS[PS_OPT];\r\n"
    "    if (!o) return;\r\n",
    "  function addToOrder(){\r\n"
    "    if (!PS_PIECE || !printable(PS_PIECE)) return;\r\n"
    "    var o = currentSize();\r\n"
    "    if (!o) return;\r\n",
    'addToOrder option',
)

doc = rep(
    doc,
    "    if (at >= 0){ ORDER[at].copies += 1; }\r\n",
    "    if (at >= 0){ ORDER[at].copies += PS_QTY; }\r\n",
    'addToOrder copies',
)

doc = rep(
    doc,
    "        copies:   1,\r\n"
    "        cents:    o.cents\r\n",
    "        copies:   PS_QTY,\r\n"
    "        cents:    o.cents\r\n",
    'addToOrder qty',
)

doc = rep(
    doc,
    "    PS_SHIP = null;   /* the order changed; the quote is no longer true */\r\n"
    "    renderWall();\r\n"
    "  }\r\n",
    "    PS_SHIP = null;   /* the order changed; the quote is no longer true */\r\n"
    "    PS_QTY = 1;\r\n"
    "    renderWall();\r\n"
    "  }\r\n",
    'addToOrder reset',
)

# 5 · the handlers for the three steps
doc = rep(
    doc,
    "  if (psFly) psFly.addEventListener('click', function(e){\r\n"
    "    var o = e.target.closest('[data-opt]');\r\n"
    "    if (o){ PS_OPT = parseInt(o.dataset.opt, 10) || 0; renderFly(); return; }\r\n"
    "    if (e.target.closest('#psAdd')) addToOrder();\r\n"
    "  });\r\n",

    "  if (psFly) psFly.addEventListener('click', function(e){\r\n"
    "    var fam = e.target.closest('[data-fam]');\r\n"
    "    if (fam){\r\n"
    "      PS_FAM = parseInt(fam.dataset.fam, 10) || 0;\r\n"
    "      /* A family may not carry the size that was chosen in the last one,\r\n"
    "         so the size resets rather than pointing at nothing. */\r\n"
    "      PS_SIZE = 0;\r\n"
    "      renderFly(); return;\r\n"
    "    }\r\n"
    "    var sz = e.target.closest('[data-size]');\r\n"
    "    if (sz){ PS_SIZE = parseInt(sz.dataset.size, 10) || 0; renderFly(); return; }\r\n"
    "    var q = e.target.closest('[data-q2]');\r\n"
    "    if (q){\r\n"
    "      if (q.dataset.q2 === '+') PS_QTY = Math.min(PS_QTY + 1, 20);\r\n"
    "      else PS_QTY = Math.max(PS_QTY - 1, 1);\r\n"
    "      renderFly(); return;\r\n"
    "    }\r\n"
    "    if (e.target.closest('#psAdd')) addToOrder();\r\n"
    "  });\r\n",
    'flyout handlers',
)

# 6 · the new light dress for everything inside the shop
doc = rep(
    doc,
    "/* the shipping choices. Same shape as the size options in the flyout —\n",

    "/* ---- the shop on vellum ------------------------------------------------\n"
    "   Everything below was drawn for coffee in s101 and is re-dressed here.\n"
    "   Ink on limestone, oxblood for the act of choosing, brass hairlines. */\n"
    ".pshop .ps-wall{ padding-bottom:1.4rem }\n"
    ".pshop .ps-pc{\n"
    "  background:rgba(255,255,255,.5);\n"
    "  border:1px solid rgba(137,105,67,.22);\n"
    "  box-shadow:0 .4rem 1rem rgba(59,41,25,.08);\n"
    "}\n"
    ".pshop .ps-pc:hover{ border-color:rgba(125,66,66,.45) }\n"
    ".pshop .ps-pc.is-on{ border-color:var(--oxblood); box-shadow:0 0 0 1px var(--oxblood) inset }\n"
    ".pshop .ps-pc .nm{ color:var(--ink) }\n"
    ".pshop .ps-pc .tag{ background:var(--oxblood); color:var(--vellum-100) }\n"
    ".pshop .ps-pc.is-waiting .tag{ background:rgba(90,70,50,.35) }\n"
    "\n"
    "/* the flyout — the piece, then three questions */\n"
    ".pshop .ps-fly{\n"
    "  background:rgba(255,255,255,.58);\n"
    "  border:1px solid rgba(137,105,67,.24);\n"
    "  box-shadow:inset 0 1px 0 rgba(255,255,255,.7), 0 .6rem 1.6rem rgba(59,41,25,.1);\n"
    "}\n"
    ".ps-fly-head{ display:flex; gap:.8em; align-items:flex-start; margin-bottom:1.1em }\n"
    ".ps-fly-head img{\n"
    "  width:74px; height:74px; flex:0 0 auto; object-fit:cover;\n"
    "  border-radius:6px; border:1px solid rgba(137,105,67,.28);\n"
    "}\n"
    ".ps-fly-head h3{\n"
    "  font-family:var(--serif); font-style:italic; font-weight:400;\n"
    "  font-size:1.32rem; line-height:1.15; color:var(--ink);\n"
    "}\n"
    ".ps-fly-head p{\n"
    "  font-family:var(--sans); font-size:.78rem; line-height:1.45;\n"
    "  color:var(--ink-soft); margin-top:.25em;\n"
    "}\n"
    ".ps-step{\n"
    "  display:flex; align-items:center; gap:.55em;\n"
    "  margin:1.15em 0 .55em;\n"
    "  font-family:var(--serif); font-size:1.15rem; color:var(--ink);\n"
    "}\n"
    ".ps-step b{\n"
    "  display:inline-flex; align-items:center; justify-content:center;\n"
    "  width:1.5em; height:1.5em; border-radius:50%;\n"
    "  background:var(--oxblood); color:var(--vellum-100);\n"
    "  font-family:var(--sans); font-size:.72rem; font-weight:600;\n"
    "}\n"
    ".ps-fams{ display:grid; grid-template-columns:repeat(auto-fit,minmax(112px,1fr)); gap:.45em }\n"
    ".ps-fam{\n"
    "  display:flex; flex-direction:column; gap:.3em;\n"
    "  padding:.7em .6em; border-radius:6px; cursor:pointer; text-align:left;\n"
    "  background:rgba(255,255,255,.55); border:1px solid rgba(137,105,67,.24);\n"
    "  transition:border-color .2s ease, background .2s ease;\n"
    "}\n"
    ".ps-fam:hover{ border-color:rgba(125,66,66,.45) }\n"
    ".ps-fam.is-on{ border-color:var(--oxblood); background:rgba(125,66,66,.07) }\n"
    ".ps-fam .nm{ font-family:var(--serif); font-size:1.0625rem; line-height:1.2; color:var(--ink) }\n"
    ".ps-fam .fr{ font-family:var(--sans); font-size:.72rem; color:var(--ink-soft) }\n"
    ".ps-sizes{ display:grid; grid-template-columns:repeat(auto-fit,minmax(92px,1fr)); gap:.45em }\n"
    ".ps-size{\n"
    "  display:flex; flex-direction:column; gap:.2em; align-items:center;\n"
    "  padding:.6em .4em; border-radius:6px; cursor:pointer;\n"
    "  background:rgba(255,255,255,.55); border:1px solid rgba(137,105,67,.24);\n"
    "  transition:border-color .2s ease, background .2s ease;\n"
    "}\n"
    ".ps-size:hover{ border-color:rgba(125,66,66,.45) }\n"
    ".ps-size.is-on{ border-color:var(--oxblood); background:rgba(125,66,66,.07) }\n"
    ".ps-size .nm{ font-family:var(--serif); font-size:1.0625rem; color:var(--ink) }\n"
    ".ps-size .pr{ font-family:var(--sans); font-size:.8rem; color:var(--ink-soft) }\n"
    ".ps-qrow{ display:flex; align-items:center; gap:1em }\n"
    ".ps-price{\n"
    "  margin-left:auto; font-family:var(--serif); font-size:1.5rem; color:var(--ink);\n"
    "}\n"
    ".pshop .ps-qty{ border-color:rgba(137,105,67,.3) }\n"
    ".pshop .ps-qty button{ background:rgba(125,66,66,.08); color:var(--ink) }\n"
    ".pshop .ps-qty span{ color:var(--ink) }\n"
    ".pshop .ps-add{ background:var(--oxblood); color:var(--vellum-100) }\n"
    ".pshop .ps-lab{ color:var(--brass) }\n"
    "\n"
    "/* the order */\n"
    ".pshop .ps-line{\n"
    "  background:rgba(255,255,255,.5);\n"
    "  border:1px solid rgba(137,105,67,.2);\n"
    "}\n"
    ".pshop .ps-line .ti{ color:var(--ink) }\n"
    ".pshop .ps-line .pf,.pshop .ps-line .lp{ color:var(--ink-soft) }\n"
    ".pshop .ps-line .lp{ color:var(--ink) }\n"
    ".pshop .ps-rm{ color:var(--ink-soft) }\n"
    ".pshop .ps-rm:hover{ color:var(--oxblood) }\n"
    ".pshop .ps-addr input,.pshop .ps-addr select{\n"
    "  background:rgba(255,255,255,.66); color:var(--ink);\n"
    "  border-color:rgba(137,105,67,.28);\n"
    "}\n"
    ".pshop .ps-addr input::placeholder{ color:rgba(60,48,34,.42) }\n"
    ".pshop .ps-summ{\n"
    "  background:rgba(255,255,255,.6); border-color:rgba(137,105,67,.3);\n"
    "  box-shadow:inset 0 1px 0 rgba(255,255,255,.7);\n"
    "}\n"
    ".pshop .ps-summ .rows{ color:var(--ink-soft) }\n"
    ".pshop .ps-summ .rows b,.pshop .ps-summ .tot{ color:var(--ink) }\n"
    ".pshop .ps-co{ background:var(--oxblood); color:var(--vellum-100) }\n"
    ".pshop .ps-note,.pshop .ps-empty{ color:var(--ink-soft) }\n"
    ".pshop .ps-tab{\n"
    "  background:rgba(255,255,255,.5); border-color:rgba(137,105,67,.28);\n"
    "  color:var(--ink);\n"
    "}\n"
    ".pshop .ps-tab:hover{ background:rgba(125,66,66,.1) }\n"
    ".pshop .ps-ship-opt{\n"
    "  background:rgba(255,255,255,.5); border-color:rgba(137,105,67,.22);\n"
    "  color:var(--ink);\n"
    "}\n"
    ".pshop .ps-ship-opt:hover{ border-color:rgba(125,66,66,.45) }\n"
    ".pshop .ps-ship-opt.is-on{ border-color:var(--oxblood); background:rgba(125,66,66,.08) }\n"
    ".pshop .ps-ship-opt .car{ color:var(--ink-soft) }\n"
    "\n"
    "/* the shipping choices. Same shape as the size options in the flyout —\n",
    'light dress',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# the surface is light, and textured
if 'background:#1a1613;\n  border-left:1px solid rgba(174,133,78,.26);' in doc:
    die('the shop is still coffee')
ps = doc[doc.index('.pshop{'):doc.index('.pshop.is-open{')]
if 'limestone.jpg' not in ps:
    die('the shop has no stone under it')
if 'noise.png' not in doc[doc.index('.pshop::before{'):doc.index('.pshop > *{')]:
    die('the shop has no noise over it')

# three questions, in order, from the map
if 'var PRINT_FAMILIES = [' not in doc:
    die('the families were not inlined')
if doc.count("'<div class=\"ps-step\"><b>1</b> Choose your finish</div>'") != 1:
    die('step one is missing')
if 'data-fam=' not in doc or 'data-size=' not in doc:
    die('family and size are not separate choices')
if 'PS_SIZE = 0;' not in doc:
    die('changing family could leave the size pointing at nothing')

# nothing invented
for fam in fams:
    if json.dumps(fam['label']) not in doc:
        die('family %s did not reach the shelf' % fam['id'])
for stray in ('$99', '$129', '$159', '$189', '4:5'):
    if stray in probe:
        die("the mockup's numbers reached the build: %s" % stray)

# every class introduced carries a rule
for sel in ('.ps-fly-head{', '.ps-step{', '.ps-fams{', '.ps-fam{', '.ps-sizes{',
            '.ps-size{', '.ps-qrow{', '.ps-price{', '.ps-fam.is-on{', '.ps-size.is-on{'):
    if sel not in doc:
        die('no rule for %s' % sel)

# declared above their readers
for name in ('var PS_FAM', 'var PS_SIZE', 'var PS_QTY'):
    if probe.index(name) > probe.index('function renderFly('):
        die('%s is declared below renderFly' % name)

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

print('GATE PASSED · vellum and stone · %d families from sku-map.ts · %d routes'
      % (len(fams), routes))
for f in fams:
    print('   %-22s %s' % (f['label'], ', '.join(s['label'] for s in f['sizes'])))
print('wrote ' + OUT)
