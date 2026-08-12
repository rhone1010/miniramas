// lib/v1/wallpapers/studio-store.ts
//
// Where a Studio clean file lives between generate and keep.
//
// Both routes need the same bucket and the same key, and the two of them
// disagreeing is a class of bug that only shows up after somebody has paid.
// So neither route builds a path — they both call this.
//
// ── WHY THE PREVIEWS BUCKET AND NOT A NEW ONE ──────────────────────────
//
// `previews` is already private and already holds exactly this shape of
// thing: a rendered file that has been paid for by nobody yet, released
// when it is. A second private bucket would be a second set of policies to
// get right for no gain.
//
// The `studio/` prefix keeps it apart from `portraits/`, which is swept and
// audited on its own terms.
//
// ── THESE FILES ARE NOT PREVIEWS ───────────────────────────────────────
//
// Ruled 11 August: Studio previews are not kept. The watermarked image goes
// back inline in the generate response and is never stored — nobody pays to
// store rounds nobody wanted.
//
// What IS stored is the CLEAN file, which is the opposite thing: the object
// being sold, held out of reach until keep pays for it. Nothing here should
// ever be served to a browser without a credit spend behind it.

export const STUDIO_BUCKET = 'previews'

/** JPEG, not PNG. flux-schnell returns JPEG and the file is 768x1344 —
 *  re-encoding to PNG for storage would quadruple the bytes and improve
 *  nothing. Portraits stores PNG because its originals feed a print path;
 *  these never reach Prodigi. */
export function studioCleanPath(imageId: string): string {
  return `studio/${imageId}.jpg`
}

/** How long a keep link stays good. Long enough to survive a slow phone on
 *  a bad connection, short enough that a link pasted into a group chat
 *  stops working. */
export const STUDIO_SIGNED_URL_SECONDS = 60 * 60
