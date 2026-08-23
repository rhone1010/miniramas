// app/api/v1/community/posts/mine/route.ts
//
// GET - which of my pieces are on the wall.
//
// WHY THIS EXISTS. My Collection holds pieces and knows nothing about the
// board, so a customer could not see that a piece was posted and could not
// take it down without going to the board, finding it, and pressing "Take
// it down" there. Somebody who wants their picture off a public page had to
// go and look at it on that page first, which is the wrong way round.
//
// SEPARATE ROUTE RATHER THAN RIDING ON A COLLECTION RESPONSE. Offered by
// CUI as an option and declined: folding this into a room payload makes
// every room a place that knows about community state, and the next person
// adding a room has to remember to carry it. One call, one concern.
//
// NOTHING HERE TOUCHES HEARTS. This was bundled with the un-heart request
// and parked with it, which was my error - hearts are broken at the schema
// (live community_hearts keys on viewer_hash, the route sends owner_key, so
// no row has ever been written) and that has nothing to do with reading
// community_posts, which works and has live rows in it.

import { NextResponse } from 'next/server'
import { svc, owner } from '@/lib/community/db'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// EVERY EXIT IS THE SAME SHAPE. The board's GET was corrected on 2026-08-20
// for exactly this: short answers that omitted `signed_in` meant a caller
// reading it off a degraded response saw undefined, which is falsy, so A
// SIGNED-IN CUSTOMER LOOKED SIGNED OUT the moment the database hiccuped.
//
// `posts` has the worse version of the same fault here: the collection will
// index into it per tile, and undefined is not an empty object. So it is an
// object on every path, including the ones that failed.
// ---------------------------------------------------------------------------
function empty(signedIn: boolean) {
  return NextResponse.json({
    ok:        true,
    signed_in: signedIn,
    posts:     {} as Record<string, string>,
  })
}

export async function GET() {
  try {
    // Read BEFORE the database check so every exit below reports sign-in
    // honestly. A session read, not a query - it does not depend on the
    // board being available.
    const me = await owner()

    // Signed out is not an error. The collection renders for nobody in
    // particular in that state and simply marks no tiles.
    if (!me) return empty(false)

    const db = svc()
    if (!db) return empty(true)

    // state = 'live' ONLY. A withdrawn or removed post is not on the wall,
    // and an "On The Wall" badge over a piece that was taken down is a lie
    // told to the person who took it down.
    //
    // Reads community_posts directly rather than community_board: the view
    // is the PRIVACY boundary for the public board and deliberately carries
    // no owner_key, so it cannot answer "mine". This route scopes by
    // owner_key in the query itself, which is the same guarantee reached a
    // different way.
    const { data, error } = await db
      .from('community_posts')
      .select('id, piece_id')
      .eq('owner_key', me)
      .eq('state', 'live')

    if (error) {
      console.error('[community/posts/mine] read failed:', error.message)
      // Degraded, not broken. The collection loses its badges for this load
      // and everything else on the page still works.
      return empty(true)
    }

    // KEYED ON piece_id, VALUED WITH post_id.
    //
    // piece_id is the key because the collection holds pieces; an array of
    // posts would make every room build this map for itself.
    //
    // post_id is the value because DELETE /api/v1/community/posts/<id> takes
    // the post id, so returning it here is the whole reason unposting can
    // happen from the collection without a second lookup.
    const posts: Record<string, string> = {}
    for (const row of (data ?? []) as Array<{ id: string; piece_id: string }>) {
      if (row.piece_id) posts[row.piece_id] = row.id
    }

    return NextResponse.json({ ok: true, signed_in: true, posts })
  } catch (e) {
    console.error('[community/posts/mine] GET threw:', (e as Error).message)
    // The one exit that cannot report sign-in honestly - the throw may have
    // come from owner() itself. Stated rather than hidden.
    return empty(false)
  }
}
