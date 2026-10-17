// lib/v1/shared/favorite-adaptation.ts
//
// Adapting the customer's APPROVED artwork to another frame shape (a Gift Wizard product composition), by giving NB2.1 that
// artwork as a second reference image and saying what the two images are. The effect prompts themselves are never touched: this
// clause is appended after them, the same way the style-reference clause is, and only when a reference image is really sent.
//
// NB2.1 reads the leading images of image_input as the subject and the trailing ones as reference, so the order matters:
// the original photograph first, the approved artwork second. Nothing here guarantees the result is identical to the approved
// artwork. It is a new generation; the customer sees it and approves it before anything is made.

export const FAVORITE_ADAPTATION_CLAUSE =
  'ADAPTING AN APPROVED ARTWORK. The first image is the original photograph and is the authority for who the subject is. ' +
  'The second image is the customer\'s already-approved artwork made from that photograph. Recreate the SECOND image\'s artwork ' +
  'in the frame shape requested: the same artistic effect and materials, the same subject with the same likeness, expression, ' +
  'pose, clothing, colours, lighting and composition, and every important element it contains. Where the frame is wider or taller, ' +
  'extend the surroundings and background naturally. Do not crop, stretch or distort anything; do not add or remove people or ' +
  'objects; do not restyle. If something would not fit without cropping, scale the whole picture down instead.'

export interface AdaptationInput { adaptation?: unknown; referenceImages: number }

/** The prompt, with the adaptation clause only when an adaptation was asked for AND a reference image is actually being sent. */
export function applyFavoriteAdaptation(prompt: string, input: AdaptationInput): string {
  return input.adaptation === 'favorite' && input.referenceImages > 0 ? `${prompt}\n\n${FAVORITE_ADAPTATION_CLAUSE}` : prompt
}
