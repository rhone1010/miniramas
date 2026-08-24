#!/usr/bin/env python3
"""
patch-groups-generator-emptyresult.py

Fixes two out-of-scope references in `emptyResult` in
lib/v1/groups/groups-generator.ts.

── THE BUG ────────────────────────────────────────────────────────────

    function emptyResult(req, prompt, t0): GroupsGenerateResult {
      return {
        prompt_used:   finalPrompt,      <- not in scope
        subject_count: detectedCount,    <- not in scope

`finalPrompt` and `detectedCount` are locals of `generateGroupsRender`.
`emptyResult` is a module-level helper and cannot see them. TypeScript
reports TS2304 on both, lines 458 and 460.

**THIS PRE-DATES TODAY'S WORK.** It is present in the copy Rich sent on the
morning of 23 August, before the aspect and outpaint patch touched the
file. Which means `groups-generator.ts` HAS NEVER COMPILED, and something
has been committed without `npx tsc --noEmit` coming back clean. Worth
knowing separately from this fix.

── THE FIX ────────────────────────────────────────────────────────────

Both values are already available, and neither needs a signature change:

  prompt_used    -> `prompt`, the parameter the function is handed. Every
                    caller already passes the right thing:
                    `emptyResult(req, finalPrompt, t0)` at line 330,
                    and the two early exits pass '' because no prompt had
                    been built yet.

  subject_count  -> `req.subject_count`, the count the CALLER sent.

                    Deliberately not the detected count. `emptyResult` runs
                    on failure paths, and two of them fire BEFORE the
                    pre-flight has counted anybody - there is no detected
                    count to report at that moment. The caller's number is
                    the only thing that is true on every path through here.

                    It can differ from the count a successful render would
                    have reported, and that is correct: a craft that failed
                    before detection never had a detected count.

── DISCIPLINE ─────────────────────────────────────────────────────────
  Dry run by default. --write to write.
  Both anchors must match exactly once IN THIS FUNCTION - the same two
  names appear nineteen times elsewhere in the file, all of them
  legitimate locals of generateGroupsRender, and none may be touched.
  Line ending read off the file. groups-generator.ts is LF;
  groups-effects.ts beside it is CRLF.

USAGE
  python scripts/patch-groups-generator-emptyresult.py
  python scripts/patch-groups-generator-emptyresult.py --write
"""

import re
import sys
import os

PATH = os.path.join('lib', 'v1', 'groups', 'groups-generator.ts')


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
    fp_before = src.count('finalPrompt')
    dc_before = src.count('detectedCount')

    print(f'  {PATH}')
    print(f'  {before_len} bytes, {"CRLF" if EOL == chr(13)+chr(10) else "LF"}')
    print(f'  finalPrompt x{fp_before}, detectedCount x{dc_before} in the file')
    print('')

    # ── ISOLATE emptyResult ──────────────────────────────────────────
    #
    # Scoped to the function body rather than replaced across the file.
    # Nineteen other references are correct and a global replace would
    # break every one of them.
    m = re.search(
        r'function emptyResult\((?:.*?)\r?\n\}',
        src, re.S,
    )
    if not m:
        raise SystemExit('REFUSED: emptyResult not found. Nothing written.')

    body = m.group(0)

    edits = [
        ('prompt_used:   finalPrompt,',        'prompt_used:   prompt,'),
        ('subject_count: detectedCount,',      'subject_count: req.subject_count,'),
    ]

    for old, _new in edits:
        n = body.count(old)
        if n != 1:
            raise SystemExit(
                f'REFUSED: "{old}" appears {n} times inside emptyResult, expected 1.'
                f' Nothing written.'
            )

    # The parameters being referenced must actually exist on the signature.
    if 'prompt: string' not in body:
        raise SystemExit('REFUSED: emptyResult has no `prompt` parameter. Nothing written.')
    if 'req: GroupsGenerateRequest' not in body:
        raise SystemExit('REFUSED: emptyResult has no `req` parameter. Nothing written.')

    patched = body
    for old, new in edits:
        patched = patched.replace(old, new, 1)
        print(f'  {old:38} -> {new}')

    out = src[:m.start()] + patched + src[m.end():]

    # ── POST-WRITE ───────────────────────────────────────────────────
    m2 = re.search(r'function emptyResult\((?:.*?)\r?\n\}', out, re.S)
    if not m2:
        raise SystemExit('REFUSED: emptyResult lost after patch. Nothing written.')
    if 'finalPrompt' in m2.group(0) or 'detectedCount' in m2.group(0):
        raise SystemExit('REFUSED: out-of-scope name survives in emptyResult. Nothing written.')

    # Exactly two references removed, everywhere else untouched.
    if out.count('finalPrompt') != fp_before - 1:
        raise SystemExit('REFUSED: finalPrompt count wrong. Nothing written.')
    if out.count('detectedCount') != dc_before - 1:
        raise SystemExit('REFUSED: detectedCount count wrong. Nothing written.')

    if EOL == '\n' and '\r' in out:
        raise SystemExit('REFUSED: CR introduced into an LF file. Nothing written.')

    print('')
    print(f'  {len(out) - before_len:+d} bytes')
    print(f'  finalPrompt {fp_before} -> {out.count("finalPrompt")}, '
          f'detectedCount {dc_before} -> {out.count("detectedCount")}')

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
