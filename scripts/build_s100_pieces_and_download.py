# -*- coding: utf-8 -*-
"""
build_s100_pieces_and_download.py  ·  2026-08-03  ·  CUI V25

Crafted pieces were never saved anywhere.

    The generate route returns image_b64 in the response body, the stage held
    it as a data URL in memory, and that was the whole life of the piece.
    Close the tab and it was gone — ten credits spent, nothing to show, no
    way back. My Collection was a session, not a collection.

    `app/api/v1/portraits/pieces/route.ts` has existed since migration 006
    and no surface has ever called it. POST uploads the JPEG to the private
    'collection' bucket, names the piece from an atomic sequence, and writes
    a collection_pieces row against the owner key. GET returns the lot as
    signed URLs. Both degrade to a no-op rather than blocking a craft.

WHAT LANDS

  · Every finished piece is persisted the moment it lands. The tile appears
    first and the save follows, so the wait is never in front of the
    customer.
  · The collection is read from the server on arrival. A returning customer
    sees their work.
  · Download is real. It was a flash of "Downloading ✓" over nothing — in
    the lightbox, on the featured piece, and on the multi-select bar. The
    file comment said as much: the real calls land with the Print Shop.
    A signed URL is cross-origin, so an <a download> is ignored by the
    browser; the bytes are fetched, made into a blob, and saved under the
    piece's own name.
  · Multi-select downloads one after another rather than as a zip. No zip
    library is available to a static file, and three saves beat a dependency.

ROUTE COUNT 10 -> 13, deliberately. Two are routes — POST and GET on
    /portraits/pieces. The third is not a route at all: it is the blob read of
    a URL the page already holds, which is how a cross-origin file is saved.
    The gate counts fetch( and so counts it; better that than a gate that
    quietly ignores a category of call.

Run from the repo root:  python scripts\\build_s100_pieces_and_download.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-02-s99.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s100.html')

ROUTES_BEFORE = 10
ROUTES_AFTER = 13   # 10 + POST + GET on /pieces + the blob read below


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

if src.count('fetch(') != ROUTES_BEFORE:
    die('expected %d routes in s99, found %d' % (ROUTES_BEFORE, src.count('fetch(')))

doc = src

# ────────────────────────────────────────────────────── 1 · the persistence lane

doc = rep(
    doc,
    "  window.__pieceLanded = function(piece){",

    "  /* ---- the collection is durable now -----------------------------------\n"
    "     /portraits/pieces has existed since migration 006 and nothing has ever\n"
    "     called it. Until this build a crafted piece lived as a data URL in this\n"
    "     tab and nowhere else.\n"
    "\n"
    "     The tile lands first and the save follows it. A customer never waits on\n"
    "     an upload to see their own work, and a failed save costs them the\n"
    "     durability rather than the piece. */\n"
    "  var PIECES_URL = '/api/v1/portraits/pieces';\n"
    "  var SERIES_LABEL = { portraits:'Portraits', pets:'Pets', groups:'Groups',\n"
    "                       action:'Action', actionmini:'Action',\n"
    "                       wallpapers:'Mobile Wallpapers' };\n"
    "\n"
    "  function savePiece(clientId, item){\n"
    "    if (!item || !item.result || !item.result.image_b64) return;\n"
    "    fetch(PIECES_URL, {\n"
    "      method:'POST',\n"
    "      headers:{ 'Content-Type':'application/json' },\n"
    "      credentials:'same-origin',\n"
    "      body: JSON.stringify({\n"
    "        image_b64: item.result.image_b64,\n"
    "        series:    'portraits',\n"
    "        preset:    item.effectId,\n"
    "        mode:      item.mode || null,\n"
    "        meta:      { likeness: item.likeness_score, silo: item.siloId }\n"
    "      })\n"
    "    }).then(function(r){ return r.json(); }).then(function(d){\n"
    "      if (!d || !d.ok || !d.piece) {\n"
    "        console.warn('[pieces] not saved:', (d && d.reason) || 'unknown');\n"
    "        return;\n"
    "      }\n"
    "      /* Same client id, so the tile is replaced where it stands rather\n"
    "         than appearing a second time. The server's name wins — it carries\n"
    "         the account-wide sequence this file cannot know. */\n"
    "      var at = -1;\n"
    "      PIECES.forEach(function(p, i){ if (p.id === clientId) at = i; });\n"
    "      if (at < 0) return;\n"
    "      PIECES[at].serverId = d.piece.id;\n"
    "      if (d.piece.label)     PIECES[at].name = d.piece.label;\n"
    "      if (d.piece.image_url) PIECES[at].art  = d.piece.image_url;\n"
    "      renderCollection();\n"
    "    }).catch(function(e){\n"
    "      console.warn('[pieces] not saved:', e.message || e);\n"
    "    });\n"
    "  }\n"
    "\n"
    "  /* On arrival. A returning customer has a collection; this is where they\n"
    "     get it back. Soft on every failure — the route answers { pieces: [] }\n"
    "     rather than an error, and an empty collection must never stop the\n"
    "     workshop from opening. */\n"
    "  function loadPieces(){\n"
    "    return fetch(PIECES_URL, { credentials:'same-origin' })\n"
    "      .then(function(r){ return r.json(); })\n"
    "      .then(function(d){\n"
    "        var rows = (d && d.pieces) || [];\n"
    "        if (!rows.length) return 0;\n"
    "        var seen = {};\n"
    "        PIECES.forEach(function(p){ if (p.serverId) seen[p.serverId] = true; });\n"
    "        rows.forEach(function(p){\n"
    "          if (seen[p.id]) return;\n"
    "          PIECES.push({\n"
    "            id:       'srv_' + p.id,\n"
    "            serverId: p.id,\n"
    "            name:     p.label || 'Crafted Image',\n"
    "            series:   SERIES_LABEL[p.series] || 'Portraits',\n"
    "            art:      p.image_url || null,\n"
    "            crafting: false\n"
    "          });\n"
    "        });\n"
    "        renderCollection();\n"
    "        return rows.length;\n"
    "      })\n"
    "      .catch(function(e){\n"
    "        console.warn('[pieces] collection not loaded:', e.message || e);\n"
    "        return 0;\n"
    "      });\n"
    "  }\n"
    "\n"
    "  /* ---- saving a file ----------------------------------------------------\n"
    "     A signed URL is cross-origin, and the browser ignores the download\n"
    "     attribute across origins — it navigates instead, which loses the tab.\n"
    "     So the bytes are fetched, wrapped in a blob and saved under the\n"
    "     piece's own name. A data URL takes the same path and costs nothing. */\n"
    "  function safeFileName(s){\n"
    "    return String(s || 'crafted-image')\n"
    "      .replace(/[\\\\/:*?\"<>|]+/g, '-')\n"
    "      .replace(/\\s+/g, ' ')\n"
    "      .trim()\n"
    "      .slice(0, 120) + '.jpg';\n"
    "  }\n"
    "\n"
    "  function downloadPiece(piece){\n"
    "    if (!piece || !piece.art) return Promise.resolve(false);\n"
    "    return fetch(piece.art)\n"
    "      .then(function(r){\n"
    "        if (!r.ok) throw new Error('http ' + r.status);\n"
    "        return r.blob();\n"
    "      })\n"
    "      .then(function(blob){\n"
    "        var url = URL.createObjectURL(blob);\n"
    "        var a = document.createElement('a');\n"
    "        a.href = url;\n"
    "        a.download = safeFileName(piece.name);\n"
    "        document.body.appendChild(a);\n"
    "        a.click();\n"
    "        document.body.removeChild(a);\n"
    "        /* Revoked late: Safari reads the blob after the click returns. */\n"
    "        setTimeout(function(){ URL.revokeObjectURL(url); }, 20000);\n"
    "        return true;\n"
    "      })\n"
    "      .catch(function(e){\n"
    "        console.warn('[download] failed:', e.message || e);\n"
    "        return false;\n"
    "      });\n"
    "  }\n"
    "\n"
    "  /* One after another. A zip wants a library and this file has no build\n"
    "     step; three saves are better than a dependency. */\n"
    "  function downloadMany(list){\n"
    "    var i = 0;\n"
    "    function next(){\n"
    "      if (i >= list.length) return Promise.resolve();\n"
    "      return downloadPiece(list[i++]).then(function(){\n"
    "        return new Promise(function(res){ setTimeout(res, 350); });\n"
    "      }).then(next);\n"
    "    }\n"
    "    return next();\n"
    "  }\n"
    "\n"
    "  window.__pieceLanded = function(piece){",
    'persistence lane',
)

# ─────────────────────────────────────────────────── 2 · save when a piece lands

doc = rep(
    doc,
    "  var LANDED = 0;\r\n"
    "  function land(item){\r\n"
    "    var n = String(++LANDED).padStart(3, '0');\r\n"
    "    window.__pieceLanded({\r\n"
    "      id:       'q' + item.id,\r\n"
    "      name:     'Portraits - ' + effectLabel(item.effectId) + ' - ' + n,\r\n"
    "      series:   'Portraits',\r\n"
    "      art:      'data:image/png;base64,' + item.result.image_b64,\r\n"
    "      crafting: false\r\n"
    "    });\r\n"
    "  }",

    "  var LANDED = 0;\r\n"
    "  function land(item){\r\n"
    "    var n = String(++LANDED).padStart(3, '0');\r\n"
    "    var clientId = 'q' + item.id;\r\n"
    "    window.__pieceLanded({\r\n"
    "      id:       clientId,\r\n"
    "      name:     'Portraits - ' + effectLabel(item.effectId) + ' - ' + n,\r\n"
    "      series:   'Portraits',\r\n"
    "      art:      'data:image/png;base64,' + item.result.image_b64,\r\n"
    "      crafting: false\r\n"
    "    });\r\n"
    "    /* The tile is already on the glass. The piece is made durable behind\r\n"
    "       it, and the server's name and signed URL replace the local ones\r\n"
    "       when they arrive. */\r\n"
    "    if (typeof savePiece === 'function') savePiece(clientId, item);\r\n"
    "  }",
    'land',
)

# ───────────────────────────────────────────────────── 3 · load it on arrival

doc = rep(
    doc,
    "  whoAmI().then(function(u){\r\n"
    "    if (u) restoreResume();\r\n"
    "  });",

    "  whoAmI().then(function(u){\r\n"
    "    if (u) restoreResume();\r\n"
    "    /* Their work, waiting for them. Signed out the route answers with an\r\n"
    "       empty list rather than an error, so this is safe either way. */\r\n"
    "    if (typeof loadPieces === 'function') loadPieces();\r\n"
    "  });",
    'boot load',
)

# ──────────────────────────────────────────────────────── 4 · real downloads

doc = rep(
    doc,
    "  /* Download and Print report on the button and settle back. The real calls\r\n"
    "     are the wiring's; this build must not invent their contract. */\r\n"
    "  var mcDownload = document.getElementById('mcDownload');\r\n"
    "  var mcPrint    = document.getElementById('mcPrint');\r\n"
    "  var mcClear    = document.getElementById('mcClear');\r\n"
    "  if (mcDownload) mcDownload.addEventListener('click', function(){\r\n"
    "    var n = mcCount();\r\n"
    "    flash(mcDownload, n > 1 ? ('Downloading ' + n + ' as .zip \\u2713') : 'Downloading \\u2713', 'Download');\r\n"
    "  });",

    "  /* Download is real from here. Print still reports and settles back — the\r\n"
    "     Print Shop is its own surface and is not built yet. */\r\n"
    "  var mcDownload = document.getElementById('mcDownload');\r\n"
    "  var mcPrint    = document.getElementById('mcPrint');\r\n"
    "  var mcClear    = document.getElementById('mcClear');\r\n"
    "  if (mcDownload) mcDownload.addEventListener('click', function(){\r\n"
    "    var picked = PIECES.filter(function(p){ return PICKED[p.id] && p.art; });\r\n"
    "    if (!picked.length) return;\r\n"
    "    flash(mcDownload, picked.length > 1\r\n"
    "      ? ('Saving ' + picked.length + ' \\u2713') : 'Saving \\u2713', 'Download');\r\n"
    "    downloadMany(picked);\r\n"
    "  });",
    'bulk download',
)

doc = rep(
    doc,
    "    if (what === 'dl') flash(b, 'Downloading \\u2713', 'Download');",
    "    if (what === 'dl'){\r\n"
    "      var one = lbList()[LB_AT];\r\n"
    "      flash(b, 'Saving \\u2713', 'Download');\r\n"
    "      downloadPiece(one);\r\n"
    "    }",
    'lightbox download',
)

doc = rep(
    doc,
    "      if (d1) d1.addEventListener('click', function(){ flash(d1, 'Downloading \\u2713', 'Download'); });",
    "      if (d1) d1.addEventListener('click', function(){\r\n"
    "        flash(d1, 'Saving \\u2713', 'Download');\r\n"
    "        downloadPiece(feat);\r\n"
    "      });",
    'featured download',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != ROUTES_AFTER:
    die('route count is %d, expected %d' % (routes, ROUTES_AFTER))
if doc.count("fetch(PIECES_URL") != 2:
    die('pieces is not called exactly twice — one POST, one GET')
if doc.count('fetch(piece.art)') != 1:
    die('the blob read is not exactly once')

# no download may report success over nothing ever again
if 'Downloading ' in doc:
    die('a flash-only download survived')
for fn in ('function downloadPiece(', 'function downloadMany(', 'function savePiece(',
           'function loadPieces(', 'function safeFileName('):
    if doc.count(fn) != 1:
        die('%s is not declared exactly once' % fn)
for call in ('downloadPiece(one)', 'downloadPiece(feat)', 'downloadMany(picked)'):
    if call not in doc:
        die('%s is never called' % call)

# a signed URL is cross-origin: the bytes must be fetched, not linked
if 'return r.blob();' not in doc:
    die('download does not fetch the bytes')

# the piece is saved when it lands, and the collection is read on arrival
if 'savePiece(clientId, item)' not in doc:
    die('a landed piece is not persisted')
if 'loadPieces();' not in doc:
    die('the collection is not read on arrival')

# declared above their callers — a var assigned below its reader ships inert
for name, reader in (('var PIECES_URL', 'function savePiece('),
                     ('var SERIES_LABEL', 'function loadPieces(')):
    if doc.index(name) > doc.index(reader):
        die('%s is declared below %s' % (name, reader))
# savePiece and loadPieces are function DECLARATIONS and hoist whole, so
# position does not matter for them — only the vars they close over, which
# are asserted above. Both call sites also run after boot, never during it.

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

print('GATE PASSED · pieces persisted and read back · download is real · %d routes'
      % routes)
print('wrote ' + OUT)
