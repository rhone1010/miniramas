#!/usr/bin/env python3
"""
patch-halloween-preset-alias.py

One alias short, one room dark. Adds `preset` to the halloween generate
route's accepted effect keys.

THE BUG. The route's own comment promises alias tolerance so there is "no
silent drop either way" - and its chain reads effect_id ?? effect ??
preset_id. The glass sends the bare word `preset` (captured live, 24 Aug:
{"preset":"moon_beast", ...}). Undefined falls through, every craft in the
room arrives id-less, and all 28 human effects (and the 27 pet ones, same
payload shape) answer `unknown effect_id` 400. First seen as one effect
failing (moon_beast); it was never one effect.

THE FIX is the route honouring its own stated posture: `preset` joins the
chain. Glass modernising to effect_id later costs nothing; the room works
tonight.

Dry run by default. --write to write.
"""
import os, sys

PATH = os.path.join('app', 'api', 'v1', 'halloween', 'generate', 'route.ts')

OLD = "  const rawEffect = body.effect_id ?? body.effect ?? body.preset_id"
NEW = ("  // `preset` (bare) joined 25 Aug: the glass sends exactly that, the\n"
       "  // chain missed it, and every craft in both rooms arrived id-less -\n"
       "  // 'unknown effect_id' across the catalogue, first misread as one\n"
       "  // broken effect. The comment above promised no silent drop; now true.\n"
       "  const rawEffect = body.effect_id ?? body.effect ?? body.preset_id ?? body.preset")

def main():
    write = '--write' in sys.argv
    if not os.path.exists(PATH):
        raise SystemExit('REFUSED: %s not found. Run from the repo root.' % PATH)
    with open(PATH, 'r', encoding='utf-8', newline='') as f:
        src = f.read()
    eol = '\r\n' if src.count('\r\n') > src.count('\n') - src.count('\r\n') else '\n'
    if 'body.preset' in src.replace('body.preset_id',''):
        raise SystemExit('REFUSED: bare preset already accepted. Nothing written.')
    if src.count(OLD) != 1:
        raise SystemExit('REFUSED: alias chain not found exactly once - the file drifted. Nothing written.')
    out = src.replace(OLD, NEW.replace('\n', eol), 1)
    if '?? body.preset' not in out:
        raise SystemExit('REFUSED: alias not added. Nothing written.')
    print('  %s' % PATH)
    print('  alias chain: effect_id ?? effect ?? preset_id ?? preset')
    print('  %+d bytes' % (len(out) - len(src)))
    if not write:
        print('  DRY RUN. Re-run with --write.')
        return
    with open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(out)
    print('  WRITTEN. Run: npx tsc --noEmit 2>&1 | findstr /C:"halloween"')

if __name__ == '__main__':
    main()
