#!/usr/bin/env python3
"""
patch-revert-piece-crafting-scene-r1.py
CUI 45, 30 Aug 2026.

Exact inverse of patch-piece-crafting-scene-r1.py. Removes the Unicorn
Studio scene wiring from the .piece.is-crafting wait state, restoring
the file to exactly what it was before that patch -- ring/shimmer
fallback as the ONLY state again, not "fallback beneath a scene."

Reason: confirmed with Rich (30 Aug) that a real WebGL scene per
crafting tile doesn't hold up with multiple concurrent windows and
streaming, even capped at 4. Being replaced with a polished CSS-only
spinner instead. Shipping the revert and the replacement together
rather than leaving two competing mechanisms live at once.

Same FIVE anchors as the original patch, atomic -- all must match
exactly once or nothing is applied. Byte-exact CRLF, binary mode,
same discipline as every patch this session.

Usage:
  python patch-revert-piece-crafting-scene-r1.py <path-to-file.html>
  python patch-revert-piece-crafting-scene-r1.py <path-to-file.html> --apply
"""
import sys
import argparse

# These are the AFTER states from the original patch -- what we're
# searching for now, to remove and restore back to BEFORE.

AFTER_1 = (
    b".piece__wait{\r\n"
    b"  position:absolute; inset:0; z-index:1;\r\n"
    b"  display:grid; place-items:center;\r\n"
    b"}\r\n"
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
BEFORE_1 = (
    b".piece__wait{\r\n"
    b"  position:absolute; inset:0; z-index:1;\r\n"
    b"  display:grid; place-items:center;\r\n"
    b"}"
)

AFTER_2 = (
    b"        '<div class=\"piece__scene\" id=\"pieceScene-' + esc(p.id) + '\"></div>' +\r\n"
    b"        '<div class=\"piece__wait\"><div class=\"piece__ring\"></div></div>' +"
)
BEFORE_2 = (
    b"        '<div class=\"piece__wait\"><div class=\"piece__ring\"></div></div>' +"
)

AFTER_3_PREFIX = (
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
    b"  function renderCollection(){"
)
BEFORE_3 = (
    b"  function renderCollection(){"
)

AFTER_4 = (
    b"    destroyAllPieceScenes();\r\n"
    b"    mcGrid.innerHTML = '';"
)
BEFORE_4 = (
    b"    mcGrid.innerHTML = '';"
)

AFTER_5 = (
    b"      list.forEach(function(p){ mini.appendChild(pieceTile(p)); });\r\n"
    b"      startPieceScenesForCrafting(list);"
)
BEFORE_5 = (
    b"      list.forEach(function(p){ mini.appendChild(pieceTile(p)); });"
)

MUST_VANISH = [b"piece__scene", b"MAX_PIECE_SCENES", b"startPieceScenesForCrafting", b"destroyAllPieceScenes"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    with open(args.path, "rb") as f:
        content = f.read()

    checks = [
        ("Anchor 1 (CSS)",          AFTER_1),
        ("Anchor 2 (markup)",       AFTER_2),
        ("Anchor 3 (JS functions)", AFTER_3_PREFIX),
        ("Anchor 4 (grid wipe)",    AFTER_4),
        ("Anchor 5 (tile render)",  AFTER_5),
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
        print("If this file was never patched with the scene wiring, that's why --")
        print("nothing to revert. Check with: Select-String -Path <file> -Pattern 'piece__scene'")
        sys.exit(1)

    new_content = content
    new_content = new_content.replace(AFTER_1, BEFORE_1)
    new_content = new_content.replace(AFTER_2, BEFORE_2)
    new_content = new_content.replace(AFTER_3_PREFIX, BEFORE_3)
    new_content = new_content.replace(AFTER_4, BEFORE_4)
    new_content = new_content.replace(AFTER_5, BEFORE_5)

    if not args.apply:
        print(f"\n[DRY RUN] All 5 anchors matched exactly once. Would remove "
              f"{len(content) - len(new_content)} bytes, restoring the pre-scene state.")
        print("Re-run with --apply to write the change.")
        return

    with open(args.path, "wb") as f:
        f.write(new_content)

    with open(args.path, "rb") as f:
        verify = f.read()
    all_gone = all(m not in verify for m in MUST_VANISH)
    print(f"\nAll scene-wiring markers removed: {all_gone}")
    if all_gone:
        print("Done. Verified. File byte-count delta:", len(new_content) - len(content))
    else:
        print("WARNING: post-write verification failed. Check the file by hand.")
        sys.exit(1)

if __name__ == "__main__":
    main()
