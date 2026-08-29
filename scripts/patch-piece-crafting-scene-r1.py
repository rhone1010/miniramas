#!/usr/bin/env python3
"""
patch-piece-crafting-scene-r1.py
CUI 45, 29 Aug 2026.

Wires the real Unicorn Studio scene into the EXISTING .piece.is-crafting
wait state in My Collection, replacing nothing -- the ring/shimmer stays
as the fallback, exactly per the original file's own philosophy ("the
CSS smoke is the fallback, and not a decision").

Capped at MAX_PIECE_SCENES=4 concurrent real scene instances. Up to 10
pieces can craft simultaneously per Rich (29 Aug); running 10 live
WebGL contexts for a decorative wait state is not a risk worth taking
on the live site. Pieces beyond the cap keep the ring/shimmer they
already had -- nothing about them changes or breaks.

Per-tile independent scenes, not a shared masked grid: pieces land
asynchronously and interleaved among already-finished tiles, not as a
clean synchronized batch, so there is no fixed column/row pattern a
shared mask could target. Confirmed with Rich before building this.

renderCollection() wipes and rebuilds the whole grid on every land
event (mcGrid.innerHTML = ''), so scene instances are tracked outside
the DOM and destroyed unconditionally right before that wipe, then
restarted fresh for whichever tiles are still crafting after the
re-render. This avoids any stale-reference risk entirely -- matches
the original's "destroyed, not hidden" rule.

FIVE independent anchors, byte-exact CRLF, binary mode. ALL must match
exactly once or the whole patch refuses -- this is atomic, not
partial-apply.

Usage:
  python patch-piece-crafting-scene-r1.py <path-to-portraits.html>
  python patch-piece-crafting-scene-r1.py <path-to-portraits.html> --apply
"""
import sys
import argparse

# ── Anchor 1: CSS, insert new rules right after .piece__wait's closing brace ──
ANCHOR_1 = (
    b".piece__wait{\r\n"
    b"  position:absolute; inset:0; z-index:1;\r\n"
    b"  display:grid; place-items:center;\r\n"
    b"}"
)
INSERT_1 = (
    b"\r\n"
    b"/* Real Unicorn Studio scene, layered beneath the existing ring/shimmer.\r\n"
    b"   Ring always stays visible (small, reassuring, matches the original\r\n"
    b"   scene mockup's own \"reassurance, not decision\" rule); the shimmer\r\n"
    b"   background only fades once a real scene is actually rendering.\r\n"
    b"   Capped at MAX_PIECE_SCENES concurrent instances in the JS below --\r\n"
    b"   ten pieces can craft at once, and ten live WebGL contexts is not a\r\n"
    b"   risk worth taking on the live site for a decorative wait state.\r\n"
    b"   Ruled with Rich, 29 Aug 2026. */\r\n"
    b".piece__scene{\r\n"
    b"  position:absolute; inset:0; z-index:0; pointer-events:none;\r\n"
    b"  overflow:hidden;\r\n"
    b"}\r\n"
    b".piece__scene canvas{\r\n"
    b"  width:100% !important; height:100% !important; display:block; object-fit:cover;\r\n"
    b"}\r\n"
    b".piece.has-scene .piece__wait::after{ display:none }"
)

# ── Anchor 2: markup, add the scene div before the existing wait div ──
ANCHOR_2 = (
    b"        '<div class=\"piece__wait\"><div class=\"piece__ring\"></div></div>' +"
)
INSERT_2_BEFORE = (
    b"        '<div class=\"piece__scene\" id=\"pieceScene-' + esc(p.id) + '\"></div>' +\r\n"
)

# ── Anchor 3: JS, insert the lifecycle functions before renderCollection ──
ANCHOR_3 = (
    b"  function renderCollection(){"
)
INSERT_3_BEFORE = (
    b"  /* ---- crafting-tile scene effect (Unicorn Studio, reused verbatim\r\n"
    b"     lifecycle from studio-accordion-mockup.html) ---------------------\r\n"
    b"     Capped at MAX_PIECE_SCENES concurrent real scenes -- pieces beyond\r\n"
    b"     the cap keep the existing ring/shimmer fallback, which was already\r\n"
    b"     the whole state before this. Nothing is removed, only added to.\r\n"
    b"     Ruled with Rich, 29 Aug 2026. */\r\n"
    b"  var MAX_PIECE_SCENES = 4;\r\n"
    b"  var PIECE_SDK_URL = '/vendor/unicornStudio.umd.js';\r\n"
    b"  var PIECE_SCENE_JSON = '/scenes/studio-field.json';\r\n"
    b"  var __pieceSdk = null;\r\n"
    b"  var __pieceScenes = {};\r\n"
    b"\r\n"
    b"  function __loadPieceSdk(){\r\n"
    b"    if (__pieceSdk) return __pieceSdk;\r\n"
    b"    __pieceSdk = new Promise(function(resolve, reject){\r\n"
    b"      if (window.UnicornStudio) return resolve(window.UnicornStudio);\r\n"
    b"      var el = document.createElement('script');\r\n"
    b"      el.src = PIECE_SDK_URL; el.async = true;\r\n"
    b"      el.onload = function(){ window.UnicornStudio ? resolve(window.UnicornStudio) : reject(new Error('no UnicornStudio')) };\r\n"
    b"      el.onerror = function(){ reject(new Error('sdk failed')) };\r\n"
    b"      document.head.appendChild(el);\r\n"
    b"    });\r\n"
    b"    return __pieceSdk;\r\n"
    b"  }\r\n"
    b"\r\n"
    b"  function destroyAllPieceScenes(){\r\n"
    b"    Object.keys(__pieceScenes).forEach(function(id){\r\n"
    b"      var sc = __pieceScenes[id];\r\n"
    b"      if (sc && sc.destroy) sc.destroy();\r\n"
    b"    });\r\n"
    b"    __pieceScenes = {};\r\n"
    b"  }\r\n"
    b"\r\n"
    b"  function startPieceScenesForCrafting(list){\r\n"
    b"    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;\r\n"
    b"    var phone = window.matchMedia && window.matchMedia('(max-width:820px)').matches;\r\n"
    b"    var crafting = list.filter(function(p){ return p.crafting; }).slice(0, MAX_PIECE_SCENES);\r\n"
    b"    if (!crafting.length) return;\r\n"
    b"    __loadPieceSdk().then(function(US){\r\n"
    b"      crafting.forEach(function(p){\r\n"
    b"        var elId = 'pieceScene-' + p.id;\r\n"
    b"        var el = document.getElementById(elId);\r\n"
    b"        if (!el) return;\r\n"
    b"        var opt = { elementId: elId, fps:60, scale: phone?0.5:1, dpi: phone?1:1.5, lazyLoad:false, filePath:PIECE_SCENE_JSON };\r\n"
    b"        US.addScene(opt).then(function(sc){\r\n"
    b"          __pieceScenes[p.id] = sc;\r\n"
    b"          var tile = el.closest('.piece');\r\n"
    b"          if (tile) tile.classList.add('has-scene');\r\n"
    b"        }).catch(function(){ /* ring/shimmer fallback keeps running */ });\r\n"
    b"      });\r\n"
    b"    }).catch(function(){ /* same -- fallback already showing */ });\r\n"
    b"  }\r\n"
    b"\r\n"
)

# ── Anchor 4: call site, destroy stale scenes right before the grid wipe ──
ANCHOR_4 = (
    b"    mcGrid.innerHTML = '';"
)
REPLACEMENT_4 = (
    b"    destroyAllPieceScenes();\r\n"
    b"    mcGrid.innerHTML = '';"
)

# ── Anchor 5: call site, start fresh scenes right after tiles render ──
ANCHOR_5 = (
    b"      list.forEach(function(p){ mini.appendChild(pieceTile(p)); });"
)
REPLACEMENT_5 = (
    b"      list.forEach(function(p){ mini.appendChild(pieceTile(p)); });\r\n"
    b"      startPieceScenesForCrafting(list);"
)

MUST_APPEAR = [
    b"piece__scene",
    b"MAX_PIECE_SCENES = 4",
    b"destroyAllPieceScenes();\r\n    mcGrid.innerHTML",
    b"startPieceScenesForCrafting(list);",
]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    with open(args.path, "rb") as f:
        content = f.read()

    checks = [
        ("Anchor 1 (CSS)",          ANCHOR_1),
        ("Anchor 2 (markup)",       ANCHOR_2),
        ("Anchor 3 (JS functions)", ANCHOR_3),
        ("Anchor 4 (grid wipe)",    ANCHOR_4),
        ("Anchor 5 (tile render)",  ANCHOR_5),
    ]
    ok = True
    for name, anchor in checks:
        c = content.count(anchor)
        status = "OK" if c == 1 else "REFUSED"
        print(f"{status}: {name} -- found {c} time(s), expected 1")
        if c != 1:
            ok = False

    if not ok:
        print("\nREFUSED: one or more anchors did not match exactly once.")
        print("This patch is atomic -- nothing is applied unless every anchor is clean.")
        sys.exit(1)

    new_content = content
    new_content = new_content.replace(ANCHOR_1, ANCHOR_1 + INSERT_1)
    new_content = new_content.replace(ANCHOR_2, INSERT_2_BEFORE + ANCHOR_2)
    new_content = new_content.replace(ANCHOR_3, INSERT_3_BEFORE + ANCHOR_3)
    new_content = new_content.replace(ANCHOR_4, REPLACEMENT_4)
    new_content = new_content.replace(ANCHOR_5, REPLACEMENT_5)

    if not args.apply:
        print("\n[DRY RUN] All 5 anchors matched exactly once. Would write "
              f"{len(new_content) - len(content)} bytes of net change.")
        print("Re-run with --apply to write the change.")
        return

    with open(args.path, "wb") as f:
        f.write(new_content)

    with open(args.path, "rb") as f:
        verify = f.read()
    all_present = all(m in verify for m in MUST_APPEAR)
    print(f"\nAll MUST_APPEAR markers present: {all_present}")
    if all_present:
        print("Done. Verified. File byte-count delta:", len(new_content) - len(content))
    else:
        print("WARNING: post-write verification failed. Check the file by hand.")
        sys.exit(1)

if __name__ == "__main__":
    main()
