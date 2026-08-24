#!/usr/bin/env python3
"""
patch-groups-aspect-and-outpaint.py

Two changes to lib/v1/groups/groups-generator.ts, both ruled by Rich on
23 August after the aspect test.

── 1. ASPECT FOLLOWS THE SOURCE, WITHIN A BAND ────────────────────────

Every Groups render sent MAIN_ASPECT ('1:1'). Group photographs are
overwhelmingly LANDSCAPE, and a square output of a wide source is not a
crop - NB2 recomposes, and eight people spread across a wide frame get
resolved as separate stacked figures because that is what fits a square.

That was the "cutout" failure in every stained_glass render. Proved by
running the same prompt with the aspect field omitted: it came back as one
coherent piece.

Rich's band: 1:1 to 4:3, with 5:4 allowed. NOT 16:9 - the gallery system
is 1:1 and a very wide piece has nowhere to live yet.

So the source ratio is measured and snapped to the NEAREST of three:

    1:1     up to 1.125
    5:4     1.125 to 1.292   (1.25)
    4:3     above 1.292      (1.333, and the ceiling)

PORTRAIT AND SQUARE SOURCES GET 1:1. Rich's band is landscape only and he
did not rule on a portrait group photo. 1:1 is the conservative answer -
it is what production already sends - and 3:4 should not be added without
him saying so.

Anything wider than 4:3 is CAPPED at 4:3 rather than passed through. A
16:9 source will be recomposed slightly, which is a smaller compromise
than a piece the gallery cannot show.

── 2. THE OUTPAINT STAGE COMES OUT ────────────────────────────────────

Stage 3 called Stability on EVERY render to add an 8% margin, because
"NB2 does not leave margins and every Groups render to date crops at the
frame edge."

That was true of renders squeezed into a square. With the aspect right the
composition has its own margin. Rich, 23 August: "no need for outpaint
anymore."

Removing it saves a paid API call per craft and a failure mode.

WHAT IS KEPT: `outpainted` and `outpaint_skip` stay on the result object.
They are declared in GroupsGenerateResult and something may read them.
They now report false and 'disabled'. Removing the fields is a type change
across the silo and is not what this patch is for.

`readJpegDimensions` is KEPT - it is no longer used by the outpaint stage
but it is exactly what the aspect clamp needs.

── DISCIPLINE ─────────────────────────────────────────────────────────
  Dry run by default. --write to write.
  Every anchor must match exactly once or nothing is written.
  newline='' throughout - the file is CRLF.

USAGE
  python scripts/patch-groups-aspect-and-outpaint.py
  python scripts/patch-groups-aspect-and-outpaint.py --write
"""

import re
import sys
import os

PATH = os.path.join('lib', 'v1', 'groups', 'groups-generator.ts')

# ── LINE ENDINGS ARE NOT UNIFORM IN THIS DIRECTORY ────────────────────
#
# groups-effects.ts is CRLF. groups-generator.ts is LF. Assuming either one
# rewrites every line of the other, which is the near-miss recorded in the
# 22-23 August carryover.
#
# So the ending is READ off the file and every inserted line uses it. Never
# hardcoded, and never Python's text mode - open(..., newline='') below is
# what keeps the read honest.
def detect_eol(text: str) -> str:
    return '\r\n' if text.count('\r\n') > text.count('\n') - text.count('\r\n') else '\n'

# ── EDIT 1: the import ────────────────────────────────────────────────
OLD_IMPORT_BARE = "import { outpaintMargin } from '../shared/outpaint'"
NEW_IMPORT = ""

# ── EDIT 2: the aspect helper, inserted before the NB2 call site ──────
OLD_ASPECT_LINE = "        aspectRatio:       MAIN_ASPECT,"
NEW_ASPECT_LINE = "        aspectRatio:       groupsAspect(sources[0]),"

HELPER_LINES = [
"",
"// ═══════════════════════════════════════════════════════════════",
"// ASPECT",
"// ═══════════════════════════════════════════════════════════════",
"",
"/**",
" * The three ratios a Groups piece may come out in, widest last.",
" *",
" * Rich's band, 23 August: 1:1 to 4:3, with 5:4 allowed, and NOT 16:9 -",
" * the gallery renders at 1:1 and a very wide piece has nowhere to live",
" * yet. My Collection crops its tiles to square; the full-size view shows",
" * the true shape.",
" */",
"const GROUPS_RATIOS: Array<{ label: string; value: number }> = [",
"  { label: '1:1', value: 1 },",
"  { label: '5:4', value: 1.25 },",
"  { label: '4:3', value: 4 / 3 },",
"]",
"",
"/**",
" * Snaps the source photograph's shape to the nearest allowed ratio.",
" *",
" * WHY THIS EXISTS AT ALL. Production sent MAIN_ASPECT ('1:1') on every",
" * render. A square output of a landscape source is not a crop - NB2",
" * recomposes to fit, and a wide group becomes separate stacked figures",
" * because that is what fits a square. Proved 23 August: the same prompt",
" * with the aspect field omitted came back as one coherent piece.",
" *",
" * PORTRAIT AND SQUARE SOURCES GET 1:1. The band is landscape only and",
" * Rich has not ruled on a portrait group photo. 1:1 is what production",
" * already sent, so it is the conservative answer. Do not add 3:4 without",
" * him.",
" *",
" * ANYTHING WIDER THAN 4:3 IS CAPPED, not passed through.",
" *",
" * Falls back to MAIN_ASPECT when the dimensions cannot be read - a",
" * source we cannot measure is not a reason to fail a craft.",
" */",
"function groupsAspect(sourceB64: string): string {",
"  let dims: { width: number; height: number } | null = null",
"  try {",
"    dims = readJpegDimensions(Buffer.from(sourceB64, 'base64'))",
"  } catch {",
"    dims = null",
"  }",
"",
"  if (!dims || !dims.width || !dims.height) {",
"    console.warn('[groups] source dimensions unreadable, falling back to MAIN_ASPECT')",
"    return MAIN_ASPECT",
"  }",
"",
"  const ratio = dims.width / dims.height",
"  if (ratio <= 1) return '1:1'",
"",
"  let best = GROUPS_RATIOS[0]",
"  for (const r of GROUPS_RATIOS) {",
"    if (Math.abs(ratio - r.value) < Math.abs(ratio - best.value)) best = r",
"  }",
"",
"  console.log(",
"    `[groups] source ${dims.width}x${dims.height} (${ratio.toFixed(3)}) -> ${best.label}`,",
"  )",
"  return best.label",
"}",
"",
]

# ── EDIT 3: the outpaint stage ────────────────────────────────────────
OLD_OUTPAINT = """  // ── Outpaint, every render ──
  //
  // Not conditional, unlike Wallpapers. NB2 does not leave margins and
  // every Groups render to date crops at the frame edge, so the piece
  // needs room around it before it reaches a print.
  let outpainted   = false
  let outpaintSkip: string | null = null
  let outB64 = finalB64

  if (input.stabilityApiKey) {
    try {
      const buf  = Buffer.from(finalB64, 'base64')
      const dims = readJpegDimensions(buf)
      if (!dims) {
        outpaintSkip = 'dimensions_unreadable'
      } else {
        const r = await outpaintMargin({
          image:           buf,
          width:           dims.width,
          height:          dims.height,
          stabilityApiKey: input.stabilityApiKey,
        })
        if (r.outpainted) {
          outB64     = r.image.toString('base64')
          outpainted = true
        } else {
          outpaintSkip = r.reason || 'unknown'
        }
      }
    } catch (e: any) {
      console.warn(`[groups] outpaint hard fail (non-fatal): ${e?.message}`)
      outpaintSkip = `error: ${e?.message}`
    }
  } else {
    outpaintSkip = 'STABILITY_API_KEY not set'
  }
"""

NEW_OUTPAINT = """  // ── OUTPAINT REMOVED, 2026-08-23 ──
  //
  // Stage 3 called Stability on EVERY render to add an 8% margin, because
  // NB2 left none and every Groups render cropped at the frame edge.
  //
  // That was true of renders squeezed into a SQUARE. The figures were
  // pressed to the edges because the composition did not fit the shape it
  // was being forced into. With the aspect following the source the
  // composition has its own margin, and a paid API call per craft to fix a
  // problem that no longer exists is a cost and a failure mode for
  // nothing. Rich, 23 August.
  //
  // The two fields are KEPT on the result. They are declared in
  // GroupsGenerateResult and removing them is a type change across the
  // silo. They now report the truth: nothing was outpainted, and the
  // reason is that the stage is gone.
  //
  // `stabilityApiKey` is still accepted on the input and is now unused.
  // Left in place so callers do not have to change; delete it when
  // something else needs that signature touched.
  const outpainted   = false
  const outpaintSkip: string | null = 'disabled'
  const outB64 = finalB64
"""


def main():
    write = '--write' in sys.argv

    if not os.path.exists(PATH):
        raise SystemExit(f'REFUSED: {PATH} not found. Run from the repo root.')

    with open(PATH, 'r', encoding='utf-8', newline='') as f:
        src = f.read()

    EOL = detect_eol(src)
    OLD_IMPORT = OLD_IMPORT_BARE + EOL
    HELPER = EOL.join(HELPER_LINES)
    OLD_OUTPAINT_E = OLD_OUTPAINT.replace('\n', EOL)
    NEW_OUTPAINT_E = NEW_OUTPAINT.replace('\n', EOL)

    before_len = len(src)
    eol_before = src.count(EOL)

    if 'function groupsAspect' in src:
        raise SystemExit('REFUSED: groupsAspect already present. Nothing written.')

    checks = [
        ('outpaint import', OLD_IMPORT),
        ('aspect line',     OLD_ASPECT_LINE),
        ('outpaint stage',  OLD_OUTPAINT_E),
    ]
    for name, anchor in checks:
        n = src.count(anchor)
        if n != 1:
            raise SystemExit(
                f'REFUSED: anchor "{name}" appears {n} times, expected 1. Nothing written.'
            )

    # readJpegDimensions must exist - the aspect clamp depends on it.
    if 'function readJpegDimensions' not in src:
        raise SystemExit('REFUSED: readJpegDimensions not found. Nothing written.')

    print(f'  {PATH}')
    print(f'  {before_len} bytes, line endings {"CRLF" if EOL == chr(13)+chr(10) else "LF"}, {eol_before} lines')
    print('')

    out = src
    out = out.replace(OLD_IMPORT, NEW_IMPORT, 1)
    print('  removed   import { outpaintMargin }')

    out = out.replace(OLD_OUTPAINT_E, NEW_OUTPAINT_E, 1)
    print('  removed   outpaint stage (Stage 3)')

    out = out.replace(OLD_ASPECT_LINE, NEW_ASPECT_LINE, 1)
    print('  changed   aspectRatio: MAIN_ASPECT -> groupsAspect(sources[0])')

    # Helper goes immediately before readJpegDimensions so both live together.
    m = re.search(re.escape(EOL) + r'function readJpegDimensions\(', out)
    if not m:
        raise SystemExit('REFUSED: could not place the helper. Nothing written.')
    out = out[:m.start()] + EOL + HELPER + out[m.start():]
    print('  added     groupsAspect() and GROUPS_RATIOS')

    # ── POST-WRITE ────────────────────────────────────────────────────
    for name, anchor in checks[:1] + checks[2:]:
        if anchor and anchor in out:
            raise SystemExit(f'REFUSED: "{name}" still present after patch. Nothing written.')
    if 'outpaintMargin' in out:
        raise SystemExit('REFUSED: outpaintMargin still referenced. Nothing written.')
    if out.count('function groupsAspect') != 1:
        raise SystemExit('REFUSED: groupsAspect not inserted exactly once. Nothing written.')
    if 'MAIN_ASPECT' not in out:
        raise SystemExit('REFUSED: MAIN_ASPECT import would be unused. Nothing written.')
    if out.count(EOL) < eol_before:
        raise SystemExit('REFUSED: line count fell. Nothing written.')
    if EOL == '\n' and '\r' in out:
        raise SystemExit('REFUSED: CR introduced into an LF file. Nothing written.')

    print('')
    print(f'  {len(out) - before_len:+d} bytes, lines {eol_before} -> {out.count(EOL)}')

    if not write:
        print('')
        print('  DRY RUN. Nothing written. Re-run with --write.')
        return

    with open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(out)

    print('')
    print(f'  WRITTEN. {PATH} is now {len(out)} bytes.')
    print('  Run: npx tsc --noEmit 2>&1 | findstr /C:"groups-generator"')


if __name__ == '__main__':
    main()
