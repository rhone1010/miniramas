#!/usr/bin/env python3
"""
patch-groups-restore-outpaint.py

Puts the Stability outpaint margin stage back into
lib/v1/groups/groups-generator.ts.

── WHY IT WAS REMOVED AND WHY IT IS COMING BACK ───────────────────────

Removed on 23 August. The reasoning at the time: the stage existed because
"NB2 does not leave margins and every Groups render crops at the frame
edge", and that cropping was caused by squeezing landscape group photographs
into a 1:1 square. Fix the aspect, fix the cropping, drop the paid API call.

Half right. Aspect fixed the COMPOSITION - the group came back as one
coherent piece instead of separate stacked cutouts. It did not fix the
MARGIN. The 4:5 card shoots on 24 August still ran hands, elbows and the
base of the piece off the edge of the frame.

Two separate problems, and I treated them as one. Rich, 24 August: "yes
outpaint 8% surrounding all sides."

A piece that crops at the edge is a worse piece once it reaches a print,
which is the whole reason the stage was written.

── WHAT GOES BACK ─────────────────────────────────────────────────────

The stage exactly as it was, restored from groups-generator_001.ts in
H:\\minramas. GROUPS_MARGIN in lib/v1/shared/outpaint.ts is 0.08 - eight per
cent of the long edge on all four sides - and is untouched by this patch.

Failure posture is unchanged and is the reason this is safe to run on every
craft: outpaintMargin never throws to the caller. On any error the original
buffer comes back with outpainted:false and a reason string for the log. A
tight crop is a worse piece, not a broken one.

`readJpegDimensions` is already in the file - the aspect clamp uses it - so
nothing new is imported except outpaintMargin itself.

── DISCIPLINE ─────────────────────────────────────────────────────────
  Dry run by default. --write to write.
  Refuses if the stage is already present.
  Line ending read off the file. groups-generator.ts is LF;
  groups-effects.ts beside it is CRLF.

USAGE
  python scripts/patch-groups-restore-outpaint.py
  python scripts/patch-groups-restore-outpaint.py --write
"""

import re
import sys
import os

PATH = os.path.join('lib', 'v1', 'groups', 'groups-generator.ts')

IMPORT_ANCHOR = "import { MAIN_ASPECT } from '../shared/render-aspect'"
IMPORT_LINE   = "import { outpaintMargin } from '../shared/outpaint'"

OLD_BLOCK = """  // ── OUTPAINT REMOVED, 2026-08-23 ──
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

NEW_BLOCK = """  // ── Outpaint, every render ──
  //
  // Not conditional, unlike Wallpapers. NB2 does not leave margins and a
  // Groups render crops at the frame edge, so the piece needs room around
  // it before it reaches a print.
  //
  // REMOVED 23 AUGUST AND RESTORED 24 AUGUST. The removal reasoned that the
  // cropping came from squeezing landscape sources into a square, and that
  // fixing the aspect would fix the margin too. Aspect fixed the
  // COMPOSITION - one coherent piece instead of stacked cutouts - and did
  // nothing for the MARGIN: the 4:5 shoots still ran hands, elbows and the
  // base of the piece off the edge. Two problems, not one.
  //
  // Non-fatal by construction: outpaintMargin never throws to here. On any
  // error the original buffer comes back with outpainted:false and a reason
  // for the log, because a tight crop is a worse piece and not a broken
  // one.
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


def detect_eol(text):
    crlf = text.count('\r\n')
    return '\r\n' if crlf and crlf >= text.count('\n') - crlf else '\n'


def main():
    write = '--write' in sys.argv

    if not os.path.exists(PATH):
        raise SystemExit(f'REFUSED: {PATH} not found. Run from the repo root.')

    with open(PATH, 'r', encoding='utf-8', newline='') as f:
        src = f.read()

    EOL = detect_eol(src)
    before_len = len(src)

    print(f'  {PATH}')
    print(f'  {before_len} bytes, {"CRLF" if EOL == chr(13)+chr(10) else "LF"}')
    print('')

    if 'outpaintMargin' in src:
        raise SystemExit('REFUSED: outpaintMargin already present. Nothing written.')

    old = OLD_BLOCK.replace('\n', EOL)
    new = NEW_BLOCK.replace('\n', EOL)

    if src.count(old) != 1:
        raise SystemExit(
            'REFUSED: the removal block was not found exactly once. The file has '
            'changed since this patch was written. Nothing written.'
        )
    if src.count(IMPORT_ANCHOR) != 1:
        raise SystemExit('REFUSED: import anchor not found once. Nothing written.')

    # The restored stage depends on both of these already being in the file.
    if 'function readJpegDimensions' not in src:
        raise SystemExit('REFUSED: readJpegDimensions not found. Nothing written.')
    if 'stabilityApiKey?:' not in src:
        raise SystemExit('REFUSED: stabilityApiKey not on the input type. Nothing written.')

    out = src.replace(IMPORT_ANCHOR, IMPORT_LINE + EOL + IMPORT_ANCHOR, 1)
    print('  added     import { outpaintMargin }')

    out = out.replace(old, new, 1)
    print('  restored  outpaint stage (Stage 3), 8% margin all four sides')

    # ── POST-WRITE ───────────────────────────────────────────────────
    if out.count('outpaintMargin(') != 1:
        raise SystemExit('REFUSED: outpaintMargin not called exactly once. Nothing written.')
    if out.count(IMPORT_LINE) != 1:
        raise SystemExit('REFUSED: import not added exactly once. Nothing written.')
    if 'OUTPAINT REMOVED' in out:
        raise SystemExit('REFUSED: removal comment survived. Nothing written.')
    if "outpaintSkip: string | null = 'disabled'" in out:
        raise SystemExit('REFUSED: disabled stub survived. Nothing written.')
    # groupsAspect must be untouched - the aspect fix and this are independent.
    if out.count('function groupsAspect') != 1:
        raise SystemExit('REFUSED: groupsAspect disturbed. Nothing written.')
    if EOL == '\n' and '\r' in out:
        raise SystemExit('REFUSED: CR introduced into an LF file. Nothing written.')

    print('')
    print(f'  {len(out) - before_len:+d} bytes')

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
