#!/usr/bin/env python3
# patch-pieces-wallpaper-url.py
# D:\lanes\cui42\scripts\patch-pieces-wallpaper-url.py
#
# THE ONE CHANGE: My Collection's GET signs every image_path against the
# private 'collection' bucket. A purchased store wallpaper's path lives
# in the PUBLIC 'wallpapers' bucket (studio/<section>/<file>), so the
# signing fails and the piece renders src="null". Verified 25 Aug
# against a real row (Cosmos - Eclipse, studio/general/0003_...jpg,
# image_url null on the wire).
#
# The GET gains one branch: a path starting "studio/" resolves to the
# wallpapers bucket's public URL; everything else signs exactly as
# before. Heals existing rows with no backfill - the data was always
# right, only the reader looked in the wrong bucket.
#
# DRIFT-SAFE: exact anchor, refuses on drift, dry run default.
#
#   python D:\lanes\cui42\scripts\patch-pieces-wallpaper-url.py
#   python D:\lanes\cui42\scripts\patch-pieces-wallpaper-url.py --apply

import os, sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOWNLOADS = os.path.join(os.environ.get('USERPROFILE', ''), 'Downloads')
APPLY = '--apply' in sys.argv
REL = os.path.join('app', 'api', 'v1', 'portraits', 'pieces', 'route.ts')

OLD = (
"    const pieces = await Promise.all(data.map(async (r: any) => {\r\n"
"      const { data: sImg } = await db.storage.from(BUCKET).createSignedUrl(r.image_path, SIGNED_URL_TTL)\r\n"
).encode()

NEW = (
"    const pieces = await Promise.all(data.map(async (r: any) => {\r\n"
"      // PURCHASED STORE WALLPAPERS live in the PUBLIC 'wallpapers'\r\n"
"      // bucket (studio/<section>/<file>), not the private collection\r\n"
"      // bucket - signing there fails and the piece rendered\r\n"
"      // src=\"null\". Public bucket, public URL, no signing needed.\r\n"
"      // CUI 42, 25 Aug 2026.\r\n"
"      let imageUrl: string | null = null\r\n"
"      if (typeof r.image_path === 'string' && r.image_path.startsWith('studio/')) {\r\n"
"        imageUrl = db.storage.from('wallpapers').getPublicUrl(r.image_path).data.publicUrl ?? null\r\n"
"      } else {\r\n"
"        const { data: sImg } = await db.storage.from(BUCKET).createSignedUrl(r.image_path, SIGNED_URL_TTL)\r\n"
"        imageUrl = sImg?.signedUrl ?? null\r\n"
"      }\r\n"
).encode()

OLD2 = b"        image_url: sImg?.signedUrl ?? null, source_url: sourceUrl,\r\n"
NEW2 = b"        image_url: imageUrl, source_url: sourceUrl,\r\n"

def main():
    src = os.path.join(REPO, REL)
    name = 'route.ts'
    if not os.path.exists(src):
        print(f'REFUSED  {REL}: not found'); sys.exit(1)
    data = open(src, 'rb').read()
    if data.count(NEW):
        print('REFUSED  already applied'); sys.exit(0)
    c1, c2 = data.count(OLD), data.count(OLD2)
    if c1 != 1 or c2 != 1:
        print(f'REFUSED  anchors found {c1} and {c2} times - file has drifted. '
              f'Nothing written. Report this.')
        sys.exit(1)
    if not APPLY:
        print('ok       both anchors found once, would write')
        print('DRY RUN -- nothing written. Re-run with --apply.')
        return
    out = os.path.join(DOWNLOADS, name)
    new = data.replace(OLD, NEW).replace(OLD2, NEW2)
    with open(out, 'wb') as f:
        f.write(new)
    check = open(out, 'rb').read()
    if check.count(NEW) == 1 and check.count(OLD2) == 0:
        print(f'WROTE    {out}  ({len(check)} bytes)')
        print('Install with:')
        print(f'powershell -ExecutionPolicy Bypass -File {REPO}\\scripts\\Install-File.ps1 '
              f'app\\api\\v1\\portraits\\pieces\\route.ts')
    else:
        print('FAILED   post-write verification'); sys.exit(1)

main()
