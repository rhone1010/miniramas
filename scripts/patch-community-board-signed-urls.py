#!/usr/bin/env python3
"""
patch-community-board-signed-urls.py

app/api/v1/community/posts/route.ts

THE BOARD CANNOT RENDER AN IMAGE. community_board carries image_path, which
is a storage key in the private `collection` bucket - not a URL. Dropped into
an <img src> it renders nothing. /api/v1/portraits/pieces has always signed
its paths before returning them; this route never did, because nothing was
consuming it yet.

Signed in ONE batch, not one call per card. Twenty-four round trips to
storage on the one page in this shop that exists to be fast is not a page
anybody waits for.

image_path is dropped from the response on the way out, the same instinct
this file already has about owner_key: the glass gets a URL it can draw,
not a key it could walk.

Dry run by default. --write to apply.
"""

import argparse
import sys
from pathlib import Path

TARGET = Path('app/api/v1/community/posts/route.ts')

# ---- anchor 1 · the constants ------------------------------------------
A1 = "const PAGE = 24\n"

A1_NEW = """const PAGE = 24

// The pieces live in the private `collection` bucket, written by
// /api/v1/portraits/pieces. Same bucket, same 24h signature that route
// hands the workshop.
//
// A signed URL is not shareable past its window, so a board image pasted
// into a message dies within the day. If the board is ever meant to be
// hotlinked, embedded, or cached by a CDN, the answer is a PUBLIC COPY
// MADE AT POST TIME - not a longer signature.
const BOARD_BUCKET   = 'collection'
const SIGNED_URL_TTL = 60 * 60 * 24
"""

# ---- anchor 2 · sign, after the page is sliced --------------------------
A2 = """    const rows = data ?? []
    const more = rows.length > PAGE
    const posts = rows.slice(0, PAGE)
"""

A2_NEW = """    const rows = data ?? []
    const more = rows.length > PAGE
    const posts = rows.slice(0, PAGE)

    // One call for the whole page. createSignedUrls answers in the order it
    // was asked but is keyed by path here anyway - an answer that silently
    // shifted by one would put a stranger's face under somebody's handle.
    const paths = posts
      .map((p: { image_path: string | null }) => p.image_path)
      .filter((s: string | null): s is string => !!s)

    const urls: Record<string, string> = {}
    if (paths.length) {
      const { data: signed, error: sErr } = await db.storage
        .from(BOARD_BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL)
      if (sErr) console.error('[community/posts] sign failed:', sErr.message)
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) urls[s.path] = s.signedUrl
      }
    }
"""

# ---- anchor 3 · the response -------------------------------------------
A3 = """    return NextResponse.json({
      ok: true,
      posts,
      more,
      hearted,
      signed_in: !!me,
    })
"""

A3_NEW = """    return NextResponse.json({
      ok: true,
      // Built by hand rather than spread. image_path must not leave this
      // route, and a spread that drops it is one refactor away from not
      // dropping it.
      posts: posts.map((p: {
        id: string; effect_id: string; series: string; image_path: string | null;
        heart_count: number; comment_count: number; handle: string | null;
        created_at: string;
      }) => ({
        id:            p.id,
        effect_id:     p.effect_id,
        series:        p.series,
        heart_count:   p.heart_count,
        comment_count: p.comment_count,
        handle:        p.handle,
        created_at:    p.created_at,
        // null rather than absent. A card whose signature failed shows the
        // empty state and keeps its handle and its hearts; it does not
        // vanish out of somebody's board because storage was slow.
        image_url:     p.image_path ? (urls[p.image_path] ?? null) : null,
      })),
      more,
      hearted,
      signed_in: !!me,
    })
"""

EDITS = [
    ('the bucket and TTL constants', A1, A1_NEW),
    ('the batch signing block',      A2, A2_NEW),
    ('the GET response',             A3, A3_NEW),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true', help='apply the edits')
    args = ap.parse_args()

    if not TARGET.exists():
        print(f'MISSING: {TARGET}')
        print('Run this from the repo root (D:\\minramas).')
        return 1

    raw = TARGET.read_bytes()
    crlf = b'\r\n' in raw
    text = raw.decode('utf-8').replace('\r\n', '\n')

    # Already applied? Asked BEFORE the anchors, because a patched file
    # fails anchor 3 by design and "anchor did not match" is the wrong
    # thing to tell somebody whose file is already correct.
    if 'BOARD_BUCKET' in text:
        print('Already patched (BOARD_BUCKET present). No write.')
        return 0

    # EVERY ANCHOR ASSERTED BEFORE ANY WRITE.
    fail = False
    for name, old, _new in EDITS:
        n = text.count(old)
        print(f'ANCHOR {name}: expected 1, found {n}')
        if n != 1:
            fail = True

    if fail:
        print('\nNo write. An anchor did not match exactly once.')
        return 1

    out = text
    for _name, old, new in EDITS:
        out = out.replace(old, new, 1)

    # Balance check. A route that will not parse is worse than an unsigned one.
    for ch_open, ch_close, label in (('{', '}', 'braces'), ('(', ')', 'parens')):
        if out.count(ch_open) != out.count(ch_close):
            print(f'\nREFUSED: {label} unbalanced after edit '
                  f'({out.count(ch_open)} open, {out.count(ch_close)} close).')
            return 1

    if not args.write:
        print('\nDry run. Three edits would apply. Re-run with --write.')
        return 0

    if crlf:
        out = out.replace('\n', '\r\n')
    TARGET.write_bytes(out.encode('utf-8'))
    print('\nWritten. app/api/v1/community/posts/route.ts now signs board images.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
