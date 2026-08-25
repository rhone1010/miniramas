#!/usr/bin/env python3
"""
patch-purchase-collection-copy.py

Bought wallpapers land in the collection bucket, exactly like crafted
pieces. Fixes src="null" in My Collection.

-- THE BUG -------------------------------------------------------------------

The pieces reader signs EVERY row's image_path against the private
'collection' bucket (app/api/v1/portraits/pieces/route.ts, BUCKET =
'collection', createSignedUrl on each row). Crafted pieces store
<owner>/<uuid>.jpg there. The purchase route stored
studio/<section>/<filename> - a path in the PUBLIC wallpapers bucket.
Signing a path that does not exist in 'collection' yields null, the glass
renders src="null", and every bought wallpaper is a blank tile.

-- THE FIX -------------------------------------------------------------------

Same field, same form, CUI's spec: at purchase time each bought file is
COPIED from the wallpapers bucket into collection at <owner>/<uuid>.jpg,
and THAT path goes into image_path. The studio path stays in meta
(source_path key) - provenance is not lost, and the wallpapers bucket
remains the master.

Copy failures refuse the whole basket BEFORE the charge, same posture as
validation: nothing is billed for tiles that would be blank.

The charge-fail unwind (archive the rows) is unchanged; copied files stay
in collection as orphans rather than being deleted - the standing rule,
and storage is cheaper than a delete that guesses wrong.

Existing rows are NOT touched here - scripts/backfill-wallpaper-pieces.mjs
repairs them, shipped alongside.

Dry run by default. --write to write.
"""
import os, sys

PATH = os.path.join('app', 'api', 'v1', 'wallpapers', 'purchase', 'route.ts')

OLD_ROWS = """    const rows = items.map(it => ({
      owner_key: owner,
      user_id: owner,
      series: 'wallpapers',
      preset: it.filename.replace(/\\.jpg$/, '').split('_')[1] ?? null,  // the world, for filtering
      label: wallpaperLabel(it.filename),
      image_path: wallpaperPath(it),
      meta: { ...wallpaperMeta(it), purchase_ref: refId },
      archived: false,
    }))"""

NEW_ROWS = """    // ── COPY INTO THE COLLECTION BUCKET, before any row or charge ───
    //
    // The pieces reader signs image_path against the private 'collection'
    // bucket - the same one crafted pieces live in, <owner>/<uuid>.jpg.
    // The public studio path CANNOT go into image_path: signing it yields
    // null and the tile renders blank. So each bought file is copied under
    // the buyer's prefix and the row carries the collection path; the
    // studio path stays in meta as source_path.
    //
    // A copy failure refuses the whole basket here, before anything is
    // written or billed - same posture as validation, and for the same
    // reason: nobody pays for a blank tile.
    const copied: Array<{ it: WallpaperItem; collectionPath: string }> = []
    for (const it of items) {
      const src = wallpaperPath(it)
      const { data: blob, error: dlErr } = await db.storage
        .from('wallpapers').download(src)
      if (dlErr || !blob) {
        console.error('[wallpapers/purchase] download failed:', src, dlErr?.message)
        return NextResponse.json(
          { ok: false, reason: 'items_rejected',
            rejected: [{ filename: it.filename, reason: 'copy_failed' }] },
          { status: 503 })
      }
      const collectionPath = `${owner}/${crypto.randomUUID()}.jpg`
      const { error: upErr } = await db.storage
        .from('collection')
        .upload(collectionPath, blob, { contentType: 'image/jpeg', upsert: false })
      if (upErr) {
        console.error('[wallpapers/purchase] copy failed:', collectionPath, upErr.message)
        return NextResponse.json(
          { ok: false, reason: 'items_rejected',
            rejected: [{ filename: it.filename, reason: 'copy_failed' }] },
          { status: 503 })
      }
      copied.push({ it, collectionPath })
    }

    const rows = copied.map(({ it, collectionPath }) => ({
      owner_key: owner,
      user_id: owner,
      series: 'wallpapers',
      preset: it.filename.replace(/\\.jpg$/, '').split('_')[1] ?? null,  // the world, for filtering
      label: wallpaperLabel(it.filename),
      image_path: collectionPath,
      meta: { ...wallpaperMeta(it), purchase_ref: refId, source_path: wallpaperPath(it) },
      archived: false,
    }))"""

def main():
    write = '--write' in sys.argv
    if not os.path.exists(PATH):
        raise SystemExit('REFUSED: %s not found. Run from the repo root.' % PATH)
    with open(PATH, 'r', encoding='utf-8', newline='') as f:
        src = f.read()
    eol = '\r\n' if src.count('\r\n') > src.count('\n') - src.count('\r\n') else '\n'
    if 'collectionPath' in src:
        raise SystemExit('REFUSED: already patched. Nothing written.')
    o = OLD_ROWS.replace('\n', eol)
    if src.count(o) != 1:
        raise SystemExit('REFUSED: rows anchor not found exactly once - the file drifted. Nothing written.')
    out = src.replace(o, NEW_ROWS.replace('\n', eol), 1)
    if out.count("image_path: collectionPath") != 1 or "image_path: wallpaperPath(it)" in out:
        raise SystemExit('REFUSED: image_path not rewritten cleanly. Nothing written.')
    print('  %s' % PATH)
    print('  bought files copy into collection/<owner>/<uuid>.jpg before row and charge')
    print('  %+d bytes' % (len(out) - len(src)))
    if not write:
        print('  DRY RUN. Re-run with --write.')
        return
    with open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(out)
    print('  WRITTEN. Run: npx tsc --noEmit 2>&1 | findstr /C:"wallpapers"')

if __name__ == '__main__':
    main()
