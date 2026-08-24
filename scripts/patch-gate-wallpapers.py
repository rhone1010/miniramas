#!/usr/bin/env python3
"""
patch-gate-wallpapers.py

Adds the wallpapers Series to app/api/v1/credits/gate/route.ts.

-- WHY THE GATE AND NOT /checkout ------------------------------------------

CUI 42's sync points the store at POST /api/v1/checkout, which is the Stripe
path. Rich ruled 24 August that wallpapers are bought with CREDITS. Credits
are spent here.

-- WHY WALLPAPERS DO NOT FIT THE EXISTING SHAPE ----------------------------

This route prices PER IMAGE and multiplies: `total = n * costPer`. It then
writes one craft_events row and one credit_ledger row per image, each moving
costPer, with balance_after walking down by costPer.

Wallpapers price as a BUNDLE. Rich, 23 August: one for 3 credits, five for
10. Five wallpapers cost 10, not 15, so there is no per-image figure that is
true. Forcing 2 into cost_per to make five come to 10 would put a false
number in the ledger and in the response.

So priceFor() gains a second shape: a Series may return a TOTAL instead of a
per-image cost, and the route uses it directly. Portraits and Groups are
untouched - both still return `cost` and the arithmetic below them is
unchanged, so the diff for either is nil.

-- FOUR DELIBERATE DIFFERENCES, EACH RULED BY RICH -------------------------

1. NO CAP. MAX_PAYLOAD is 10 and exists because the render queue caps there.
   Nothing renders here - the files already exist in the public bucket - so
   the cap does not apply. Rich, 24 August: "cap is none."

2. ONE LEDGER ROW, NOT n. A purchase of five wallpapers is one purchase, not
   five crafts. Five rows at a fictional per-item price would misdescribe it.

3. reason = 'wallpapers', NOT 'craft'. The refund route matches
   reason='craft' AND ref_id, so this is deliberately unrefundable. Rich,
   24 August: "no refund." A wallpaper is an instant download of a file that
   already exists - nothing renders and nothing can fail, so there is
   nothing to reverse. THIS IS THE ONE DECISION HERE THAT CANNOT BE UNDONE
   QUIETLY: if it is ever revisited, old rows still say 'wallpapers' and the
   refund route will still not see them.

4. NO craft_events ROW. That table describes renders. `event` is
   'craft_started' and a wallpaper purchase never starts a craft.

-- WHAT IS NOT HERE --------------------------------------------------------

Fulfilment. Writing the five collection_pieces rows belongs in its own
route. The gate spends credits; teaching it about storage buckets and
filename parsing is how a money path grows a second job.

-- DISCIPLINE --------------------------------------------------------------
  Dry run by default. --write to write.
  Anchors must match exactly once.
  Line ending read off the file, never assumed.

USAGE
  python scripts/patch-gate-wallpapers.py
  python scripts/patch-gate-wallpapers.py --write
"""

import re
import sys
import os

PATH = os.path.join('app', 'api', 'v1', 'credits', 'gate', 'route.ts')


def detect_eol(text):
    crlf = text.count('\r\n')
    return '\r\n' if crlf and crlf >= text.count('\n') - crlf else '\n'


# ---- 1. the price function -------------------------------------------------
OLD_SIG = """function priceFor(series: string, subjectCount: unknown):
  { ok: true; cost: number; subjects: number | null } |
  { ok: false; reason: string; detail?: unknown } {

  if (series !== 'groups') {
    return { ok: true, cost: CREDITS_PER_IMAGE, subjects: null }
  }
"""

NEW_SIG = """function priceFor(series: string, subjectCount: unknown, count: number):
  { ok: true; cost: number; total?: number; subjects: number | null } |
  { ok: false; reason: string; detail?: unknown } {

  // WALLPAPERS ARE PRICED AS A BUNDLE, NOT PER IMAGE.
  //
  // Rich, 23 August: one for 3 credits, five for 10. Every full five costs
  // ten and the remainder costs three each, so six is 13 and ten is 20.
  // Confirmed 24 August.
  //
  // There is no honest per-image figure here - five at 10 is two apiece and
  // one at 3 is three - so this returns a TOTAL and the route uses it
  // directly instead of multiplying. `cost` is still populated because the
  // response carries cost_per, and it is the average rounded down, marked
  // as such where it is read.
  if (series === 'wallpapers') {
    const n = Math.floor(Number(count))
    if (!Number.isFinite(n) || n < 1) {
      return { ok: false, reason: 'count_required' }
    }
    const total = Math.floor(n / 5) * 10 + (n % 5) * 3
    if (!Number.isFinite(total) || total <= 0) {
      return { ok: false, reason: 'price_unavailable' }
    }
    return { ok: true, cost: Math.floor(total / n), total, subjects: null }
  }

  if (series !== 'groups') {
    return { ok: true, cost: CREDITS_PER_IMAGE, subjects: null }
  }
"""

# ---- 2. the payload cap ----------------------------------------------------
OLD_CAP = """    const n = Math.max(1, Math.floor(Number(body.count) || 1))
    if (n > MAX_PAYLOAD) {
      return NextResponse.json(
        { ok: false, reason: 'payload_too_large', max: MAX_PAYLOAD }, { status: 400 })
    }

    const series = typeof body.series === 'string' ? body.series : 'portraits'
"""

NEW_CAP = """    const n = Math.max(1, Math.floor(Number(body.count) || 1))
    const series = typeof body.series === 'string' ? body.series : 'portraits'

    // MAX_PAYLOAD exists because the RENDER QUEUE caps at ten. Wallpapers
    // render nothing - every file is already sitting in the public bucket -
    // so the cap has nothing to protect. Rich, 24 August: "cap is none."
    if (series !== 'wallpapers' && n > MAX_PAYLOAD) {
      return NextResponse.json(
        { ok: false, reason: 'payload_too_large', max: MAX_PAYLOAD }, { status: 400 })
    }
"""

# ---- 3. the call site ------------------------------------------------------
OLD_CALL = "    const priced = priceFor(series, body.subject_count)"
NEW_CALL = "    const priced = priceFor(series, body.subject_count, n)"

# ---- 4. the total ----------------------------------------------------------
OLD_TOTAL = """    const total  = n * costPer          // credits, not images"""
NEW_TOTAL = """    // Bundled Series quote a total; per-image Series multiply. Wallpapers is
    // the only bundled one today, and `priced.total` is absent everywhere
    // else, so the fallback is the original arithmetic unchanged.
    const total  = priced.total ?? (n * costPer)   // credits, not images"""

# ---- 5. the audit rows -----------------------------------------------------
OLD_AUDIT = """    // Audit \u2014 one craft_started event and one ledger row per image, each
    // moving cost_per. balance_after walks from the pre-spend balance down.
    const delta = isAdmin ? 0 : -costPer

    const events = Array.from({ length: n }, (_, i) => ({
      owner_key: owner,
      series,
      preset: presets[i] ?? presets[0] ?? null,
      event: 'craft_started',
      attempts: 1,
      credits_delta: delta,
      source_photo_id: refId,   // the only reference column on this table
    }))
    const { error: evErr } = await db.from('craft_events').insert(events)
    if (evErr) console.error('[credits/gate] craft_events insert failed', evErr)

    const ledger = Array.from({ length: n }, (_, k) => ({
      owner_key: owner,
      delta,
      reason: 'craft',
      ref_id: refId,          // the refund route matches on this
      balance_after: isAdmin ? balanceAfter : balanceAfter + (n - 1 - k) * costPer,
    }))
    const { error: ldErr } = await db.from('credit_ledger').insert(ledger)
    if (ldErr) console.error('[credits/gate] credit_ledger insert failed', ldErr)
"""

NEW_AUDIT = """    // Audit. Two shapes, because two things are being described.
    //
    // A CRAFT is n renders that can each fail, so it gets one craft_events
    // row and one ledger row per image, each moving cost_per, with
    // balance_after walking from the pre-spend balance down. Unchanged.
    //
    // A WALLPAPER PURCHASE is one transaction for files that already exist.
    // It gets ONE ledger row for the whole basket and no craft_events row at
    // all - that table describes renders, its event column is
    // 'craft_started', and nothing was crafted here.
    //
    // reason='wallpapers' rather than 'craft' makes it UNREFUNDABLE by
    // construction: the refund route matches reason='craft' AND ref_id and
    // will never see these rows. Rich, 24 August. Nothing renders and
    // nothing can fail, so there is nothing to reverse - but if that is ever
    // revisited, rows already written still say 'wallpapers'.
    const delta = isAdmin ? 0 : -costPer

    if (series === 'wallpapers') {
      const { error: ldErr } = await db.from('credit_ledger').insert([{
        owner_key: owner,
        delta: isAdmin ? 0 : -total,
        reason: 'wallpapers',
        ref_id: refId,
        balance_after: balanceAfter,
      }])
      if (ldErr) console.error('[credits/gate] credit_ledger insert failed', ldErr)
    } else {
      const events = Array.from({ length: n }, (_, i) => ({
        owner_key: owner,
        series,
        preset: presets[i] ?? presets[0] ?? null,
        event: 'craft_started',
        attempts: 1,
        credits_delta: delta,
        source_photo_id: refId,   // the only reference column on this table
      }))
      const { error: evErr } = await db.from('craft_events').insert(events)
      if (evErr) console.error('[credits/gate] craft_events insert failed', evErr)

      const ledger = Array.from({ length: n }, (_, k) => ({
        owner_key: owner,
        delta,
        reason: 'craft',
        ref_id: refId,          // the refund route matches on this
        balance_after: isAdmin ? balanceAfter : balanceAfter + (n - 1 - k) * costPer,
      }))
      const { error: ldErr } = await db.from('credit_ledger').insert(ledger)
      if (ldErr) console.error('[credits/gate] credit_ledger insert failed', ldErr)
    }
"""

# ---- 6. the response -------------------------------------------------------
OLD_RESP = """      cost_per: costPer,
      subject_count: priced.subjects,   // null off Groups"""
NEW_RESP = """      // On a bundled Series this is the AVERAGE, floored - it is not what any
      // single item cost, because no single item has a price. `spent` above
      // is the figure that is true.
      cost_per: costPer,
      bundled: priced.total !== undefined,
      subject_count: priced.subjects,   // null off Groups"""

EDITS = [
    ('priceFor signature and the wallpapers band', OLD_SIG, NEW_SIG),
    ('the payload cap',                            OLD_CAP, NEW_CAP),
    ('the priceFor call site',                     OLD_CALL, NEW_CALL),
    ('the total',                                  OLD_TOTAL, NEW_TOTAL),
    ('the audit rows',                             OLD_AUDIT, NEW_AUDIT),
    ('the response',                               OLD_RESP, NEW_RESP),
]


def main():
    write = '--write' in sys.argv

    if not os.path.exists(PATH):
        raise SystemExit('REFUSED: %s not found. Run from the repo root.' % PATH)

    with open(PATH, 'r', encoding='utf-8', newline='') as f:
        src = f.read()

    EOL = detect_eol(src)
    before_len = len(src)

    print('  %s' % PATH)
    print('  %d bytes, %s' % (before_len, 'CRLF' if EOL == '\r\n' else 'LF'))
    print('')

    if "series === 'wallpapers'" in src:
        raise SystemExit('REFUSED: wallpapers already handled here. Nothing written.')

    for name, old, _new in EDITS:
        o = old.replace('\n', EOL)
        n = src.count(o)
        if n != 1:
            raise SystemExit(
                'REFUSED: anchor "%s" appears %d times, expected 1. Nothing written.' % (name, n))

    out = src
    for name, old, new in EDITS:
        out = out.replace(old.replace('\n', EOL), new.replace('\n', EOL), 1)
        print('  patched   %s' % name)

    # ---- POST-WRITE --------------------------------------------------------
    if out.count("reason: 'wallpapers'") != 1:
        raise SystemExit('REFUSED: wallpapers ledger reason not written once. Nothing written.')
    if out.count("reason: 'craft'") != 1:
        raise SystemExit('REFUSED: the craft ledger row was lost. Nothing written.')
    if out.count("event: 'craft_started'") != 1:
        raise SystemExit('REFUSED: craft_events row disturbed. Nothing written.')
    # priceFor is also named twice in the header comments, so the count is
    # against the definition and the call site specifically.
    if out.count('function priceFor(') != 1:
        raise SystemExit('REFUSED: priceFor not defined exactly once. Nothing written.')
    if out.count('const priced = priceFor(series, body.subject_count, n)') != 1:
        raise SystemExit('REFUSED: the call site was not updated. Nothing written.')
    if 'groupsCreditCost' not in out:
        raise SystemExit('REFUSED: the Groups band was lost. Nothing written.')
    if EOL == '\n' and '\r' in out:
        raise SystemExit('REFUSED: CR introduced into an LF file. Nothing written.')

    print('')
    print('  %+d bytes' % (len(out) - before_len))
    print('')
    print('  Prices: 1=3  2=6  3=9  4=12  5=10  6=13  10=20')

    if not write:
        print('')
        print('  DRY RUN. Nothing written. Re-run with --write.')
        return

    with open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(out)

    print('')
    print('  WRITTEN. %s is now %d bytes.' % (PATH, len(out)))
    print('  Run: npx tsc --noEmit 2>&1 | findstr /C:"credits/gate"')


if __name__ == '__main__':
    main()
