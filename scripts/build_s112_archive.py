# -*- coding: utf-8 -*-
"""
build_s112_archive.py  ·  2026-08-03  ·  CUI V25

Putting pieces away.

    Rich, on a collection of twenty-three: "it would be a dream come true if
    my users get into dozens of images — but either way we need a way to
    clean the stage up."

    Ruled 2026-08-03: archive, not delete, and not tabs. A tab implies two
    equal places; this is putting something away, which is not the same act.

  · An "Archived" pill sits at the end of the Series pills. It is only drawn
    once something has been put away — an empty archive is not a place.
  · Every piece carries an archive control. In the archive it reads
    "Bring back".
  · NOTHING IS EVER DESTROYED. There is no delete here and the route has no
    DELETE handler. A Crafted Image cost ten credits and a click must not be
    able to throw it away.
  · AN ARCHIVED PIECE IS STILL PRINTABLE — ruled. The Print Shop asks the
    route for everything; only the collection view filters.
  · The change is written to the server and reflected at once. A failure
    puts the piece back where it was rather than leaving the glass telling a
    lie about what is stored.

Needs migration 014 and the rewritten pieces route.

Run from the repo root:  python scripts\\build_s112_archive.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s111.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s112.html')

ROUTES_BEFORE = 15
ROUTES_AFTER = 16     # + PATCH /portraits/pieces


def die(msg):
    print('GATE FAILED · ' + msg)
    sys.exit(1)


def rep(text, old, new, label):
    """Anchors are written in whichever ending the section happened to use,
    because earlier builds wrote some blocks with CRLF and some with LF.
    Both directions are tried; the first cut only tried one and missed an
    anchor that was sitting right there."""
    lf = (old.replace('\r\n', '\n'), new.replace('\r\n', '\n'))
    crlf = (lf[0].replace('\n', '\r\n'), lf[1].replace('\n', '\r\n'))
    for a, b in ((old, new), lf, crlf):
        if text.count(a) == 1:
            return text.replace(a, b)
    die('anchor "%s" appears %d times, expected 1' % (label, text.count(old)))


with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

if src.count('fetch(') != ROUTES_BEFORE:
    die('expected %d routes in s111, found %d' % (ROUTES_BEFORE, src.count('fetch(')))

doc = src

# ───────────────────────────────────────────────────────────────────── 1 · CSS

doc = rep(
    doc,
    "/* ---- head ------------------------------------------------------------- */\r\n"
    ".mc-head{",

    "/* the archive control on a piece. Small, and it appears on hover or\n"
    "   focus — putting something away is a deliberate act and does not need\n"
    "   a permanent button on every tile. */\n"
    ".pc-arch{\n"
    "  position:absolute; top:.4em; right:.4em; z-index:2;\n"
    "  display:inline-flex; align-items:center; gap:.3em;\n"
    "  padding:.25em .55em; border-radius:999px; border:0; cursor:pointer;\n"
    "  background:rgba(20,16,13,.72); color:rgba(243,237,225,.9);\n"
    "  font-family:var(--sans); font-size:.68rem; letter-spacing:.04em;\n"
    "  opacity:0; transition:opacity .22s ease, background .22s ease;\n"
    "}\n"
    ".piece:hover .pc-arch,\n"
    ".piece:focus-within .pc-arch,\n"
    ".pc-arch:focus-visible{ opacity:1 }\n"
    ".pc-arch:hover{ background:var(--oxblood) }\n"
    ".pc-arch svg{ width:.8em; height:.8em; fill:none; stroke:currentColor; stroke-width:2 }\n"
    "/* Touch has no hover. Never hide the only way back out of the archive. */\n"
    "@media (hover:none){ .pc-arch{ opacity:.85 } }\n"
    "\n"
    "/* the archive pill sits apart from the Series pills — it is a different\n"
    "   kind of filter, and reading it as a sixth Series would be wrong. */\n"
    ".mc-filter.is-archive{\n"
    "  margin-left:auto;\n"
    "  border-color:rgba(196,169,110,.4);\n"
    "  font-style:italic;\n"
    "}\n"
    "\n"
    "/* ---- head ------------------------------------------------------------- */\r\n"
    ".mc-head{",
    'archive css',
)

# ─────────────────────────────────────────────────── 2 · the filter knows archive

doc = rep(
    doc,
    "  function mcVisible(){\r\n"
    "    if (MC_FILT === 'all') return PIECES;\r\n"
    "    return PIECES.filter(function(p){ return p.series === MC_FILT; });\r\n"
    "  }\r\n",

    "  /* The archive is a filter, not a second collection. One list, one\r\n"
    "     source of truth, and `archived` decides which side of the wall a\r\n"
    "     piece is on. */\r\n"
    "  function mcVisible(){\r\n"
    "    if (MC_FILT === 'archive'){\r\n"
    "      return PIECES.filter(function(p){ return p.archived; });\r\n"
    "    }\r\n"
    "    var live = PIECES.filter(function(p){ return !p.archived; });\r\n"
    "    if (MC_FILT === 'all') return live;\r\n"
    "    return live.filter(function(p){ return p.series === MC_FILT; });\r\n"
    "  }\r\n"
    "  function mcArchivedCount(){\r\n"
    "    return PIECES.filter(function(p){ return p.archived; }).length;\r\n"
    "  }\r\n",
    'mcVisible',
)

# ───────────────────────────────────────────────────────────── 3 · the pill

doc = rep(
    doc,
    "    mcFilters.innerHTML = rows.map(function(r){\r\n"
    "      var held = r.id === 'all'\r\n"
    "        ? PIECES.length\r\n"
    "        : PIECES.filter(function(p){ return p.series === r.id; }).length;\r\n"
    "      return '<button class=\"mc-filter' + (MC_FILT === r.id ? ' is-on' : '') + '\" type=\"button\"' +\r\n"
    "             ' data-filter=\"' + esc(r.id) + '\" data-empty=\"' + (held ? '0' : '1') + '\">' +\r\n"
    "             esc(r.label) + '</button>';\r\n"
    "    }).join('');\r\n",

    "    /* Counts are of what is ON THE WALL. An archived Portrait must not\r\n"
    "       make the Portraits pill claim a piece the customer put away. */\r\n"
    "    var live = PIECES.filter(function(p){ return !p.archived; });\r\n"
    "    var html = rows.map(function(r){\r\n"
    "      var held = r.id === 'all'\r\n"
    "        ? live.length\r\n"
    "        : live.filter(function(p){ return p.series === r.id; }).length;\r\n"
    "      return '<button class=\"mc-filter' + (MC_FILT === r.id ? ' is-on' : '') + '\" type=\"button\"' +\r\n"
    "             ' data-filter=\"' + esc(r.id) + '\" data-empty=\"' + (held ? '0' : '1') + '\">' +\r\n"
    "             esc(r.label) + '</button>';\r\n"
    "    }).join('');\r\n"
    "\r\n"
    "    /* Drawn only once something is in it. An empty archive is not a\r\n"
    "       place, and a pill for it would be a question nobody asked. */\r\n"
    "    var put = mcArchivedCount();\r\n"
    "    if (put){\r\n"
    "      html += '<button class=\"mc-filter is-archive' +\r\n"
    "              (MC_FILT === 'archive' ? ' is-on' : '') + '\" type=\"button\"' +\r\n"
    "              ' data-filter=\"archive\">Archived \\u00b7 ' + put + '</button>';\r\n"
    "    } else if (MC_FILT === 'archive'){\r\n"
    "      /* The last piece came back out while we were looking at it. */\r\n"
    "      MC_FILT = 'all';\r\n"
    "    }\r\n"
    "    mcFilters.innerHTML = html;\r\n",
    'archive pill',
)

# ────────────────────────────────────────── 4 · the control on the piece

doc = rep(
    doc,
    "  var PIECES_URL         = '/api/v1/portraits/pieces';\n",
    "  var PIECES_URL         = '/api/v1/portraits/pieces';\n"
    "  var ARCHIVE_ICON =\n"
    "    '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\">' +\n"
    "    '<path d=\"M3 7h18v3H3zM5 10v9h14v-9M10 14h4\" stroke-linecap=\"round\"/></svg>';\n",
    'archive icon',
)

# ─────────────────────────────────────────────── 5 · saying so to the server

doc = rep(
    doc,
    "  /* ---- saving a file ---",

    "  /* ---- putting a piece away ----------------------------------------------\n"
    "     Ruled 2026-08-03. Archive, never delete: a Crafted Image cost ten\n"
    "     credits and a click must not be able to destroy it. The route has no\n"
    "     DELETE handler at all, on purpose.\n"
    "\n"
    "     The glass moves first so the tile does not hang, and moves BACK if\n"
    "     the server refuses — a collection that shows a piece as put away\n"
    "     when the database disagrees is worse than a slow one. */\n"
    "  function setArchived(piece, archived){\n"
    "    if (!piece || !piece.serverId) return Promise.resolve(false);\n"
    "    var was = !!piece.archived;\n"
    "    piece.archived = archived;\n"
    "    renderCollection();\n"
    "    return fetch(PIECES_URL, {\n"
    "      method: 'PATCH',\n"
    "      headers: { 'Content-Type': 'application/json' },\n"
    "      credentials: 'same-origin',\n"
    "      body: JSON.stringify({ id: piece.serverId, archived: archived })\n"
    "    }).then(function(r){ return r.json(); }).then(function(d){\n"
    "      if (d && d.ok) return true;\n"
    "      console.warn('[archive] refused:', (d && d.reason) || 'unknown');\n"
    "      piece.archived = was;\n"
    "      renderCollection();\n"
    "      return false;\n"
    "    }).catch(function(e){\n"
    "      console.warn('[archive] failed:', e.message || e);\n"
    "      piece.archived = was;\n"
    "      renderCollection();\n"
    "      return false;\n"
    "    });\n"
    "  }\n"
    "\n"
    "  /* ---- saving a file ---",
    'setArchived',
)

# ─────────────────────────────────────────── 6 · the archive travels back

doc = rep(
    doc,
    "          PIECES.push({\n"
    "            id:       'srv_' + p.id,\n"
    "            serverId: p.id,\n"
    "            name:     p.label || 'Crafted Image',\n"
    "            series:   SERIES_LABEL[p.series] || 'Portraits',\n"
    "            art:      p.image_url || null,\n"
    "            crafting: false\n"
    "          });\n",
    "          PIECES.push({\n"
    "            id:       'srv_' + p.id,\n"
    "            serverId: p.id,\n"
    "            name:     p.label || 'Crafted Image',\n"
    "            series:   SERIES_LABEL[p.series] || 'Portraits',\n"
    "            art:      p.image_url || null,\n"
    "            archived: !!p.archived,\n"
    "            crafting: false\n"
    "          });\n",
    'loadPieces archived',
)

# the collection asks for everything, and filters here
doc = rep(
    doc,
    "    return fetch(PIECES_URL, { credentials:'same-origin' })\n",
    "    /* ?all=1 — an archived piece is still printable, so the client holds\n"
    "       both and the view decides what to show. */\n"
    "    return fetch(PIECES_URL + '?all=1', { credentials:'same-origin' })\n",
    'loadPieces all',
)


# ──────────────────────────────── 7 · the control on every finished tile

doc = rep(
    doc,
    "      a.innerHTML =\r\n"
    "        '<img class=\"piece__img\" src=\"' + esc(p.art) + '\" alt=\"\" loading=\"lazy\">' +\r\n"
    "        '<span class=\"piece__pick\" data-pick=\"' + esc(p.id) + '\">\\u2713</span>' +\r\n",

    "      a.innerHTML =\r\n"
    "        '<img class=\"piece__img\" src=\"' + esc(p.art) + '\" alt=\"\" loading=\"lazy\">' +\r\n"
    "        '<span class=\"piece__pick\" data-pick=\"' + esc(p.id) + '\">\\u2713</span>' +\r\n"
    "        /* Only a piece the server knows about can be put away — a tile\r\n"
    "           still saving has no id to send. */\r\n"
    "        (p.serverId\r\n"
    "          ? '<button class=\"pc-arch\" type=\"button\" data-arch=\"' + esc(p.id) + '\">' +\r\n"
    "            ARCHIVE_ICON + (p.archived ? 'Bring back' : 'Archive') + '</button>'\r\n"
    "          : '') +\r\n",
    'archive button',
)

doc = rep(
    doc,
    "  if (mcFilters){\r\n"
    "    mcFilters.addEventListener('click', function(e){\r\n",

    "  /* The control is inside the tile, and the tile opens the lightbox on\r\n"
    "     click. stopPropagation or putting a piece away also opens it. */\r\n"
    "  if (mcGrid) mcGrid.addEventListener('click', function(e){\r\n"
    "    var b = e.target.closest('[data-arch]'); if (!b) return;\r\n"
    "    e.stopPropagation();\r\n"
    "    e.preventDefault();\r\n"
    "    var id = b.dataset.arch, piece = null;\r\n"
    "    PIECES.forEach(function(p){ if (p.id === id) piece = p; });\r\n"
    "    if (piece) setArchived(piece, !piece.archived);\r\n"
    "  }, true);\r\n"
    "\r\n"
    "  if (mcFilters){\r\n"
    "    mcFilters.addEventListener('click', function(e){\r\n",
    'archive click',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != ROUTES_AFTER:
    die('route count is %d, expected %d' % (routes, ROUTES_AFTER))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# NOTHING may delete a piece
for word in ("method: 'DELETE'", 'method:"DELETE"'):
    if word in probe:
        die('something can destroy a piece: %s' % word)

# One splice on PIECES is legitimate: it clears the placeholder tiles for
# crafts that failed and were refunded, and it is guarded by `crafting`.
# Any splice that is NOT so guarded would be removing a real piece.
for m in re.finditer(r'PIECES\.splice\(', probe):
    line_start = probe.rfind('\n', 0, m.start()) + 1
    line = probe[line_start:probe.index('\n', m.start())]
    if 'crafting' not in line:
        die('a real piece can be spliced out of the collection: ' + line.strip())

# archive is a filter over one list, not a second collection
if "MC_FILT === 'archive'" not in doc:
    die('the archive is not a filter')
if 'function mcArchivedCount(' not in doc:
    die('nothing counts what has been put away')
if "return live.filter(function(p){ return p.series === MC_FILT; });" not in doc:
    die('the Series pills would show archived pieces')

# the pill only exists when there is something in it
if 'if (put){' not in doc:
    die('an empty archive would still show a pill')
if "MC_FILT = 'all';" not in doc:
    die('emptying the archive would strand the customer in it')

# the server is told, and the glass corrects itself when refused
if doc.count("method: 'PATCH'") != 1:
    die('archive does not write to the server exactly once')
if doc.count('piece.archived = was;') != 2:
    die('a refused archive does not put the piece back')

# the Print Shop still sees everything
if "PIECES_URL + '?all=1'" not in doc:
    die('the collection no longer asks for archived pieces')

# declared above their readers
at = probe.index('var ARCHIVE_ICON')
for m in re.finditer(r'\bARCHIVE_ICON\b', probe):
    if m.start() < at:
        die('ARCHIVE_ICON is read above its declaration')

# the control exists on the tile and is wired
if 'data-arch=' not in doc:
    die('no archive control on the tile')
if "(p.archived ? 'Bring back' : 'Archive')" not in doc:
    die('the control does not say which way it goes')
if "e.target.closest('[data-arch]')" not in doc:
    die('the archive control is not wired')
if 'e.stopPropagation();' not in doc:
    die('archiving would also open the lightbox')
if 'p.serverId\r\n          ?' not in doc and 'p.serverId\n          ?' not in doc:
    die('a piece still saving could be archived with no id to send')

for sel in ('.pc-arch{', '.pc-arch:hover{', '.mc-filter.is-archive{'):
    if sel not in doc:
        die('no rule for %s' % sel)

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

print('GATE PASSED · archive, never delete · still printable · %d routes' % routes)
print('wrote ' + OUT)
