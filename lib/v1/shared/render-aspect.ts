// lib/v1/shared/render-aspect.ts
//
// THE ASPECT RATIO, IN ONE PLACE.
//
// Rich, 20 August: 1:1 for the soft launch, and easy to change later —
// aspect returns as an adjunct the customer chooses, not something baked
// into a prompt.
//
// ── WHY IT IS A CONSTANT AND NOT A SENTENCE IN A BODY ──────────────────
//
// Because it has been a sentence in a body twice, and both times it cost a
// day.
//
// Fifty-five Halloween bodies carried "Keep subject in lower 2/3 of image
// to allow for phone UI elements" and the like. Those were correct at 9:16
// and produced a square with an empty top third the moment the aspect
// changed — a prompt describing the SHAPE of the output rather than its
// content. Both files were stripped on 20 August.
//
// Two Groups effects carried `aspect: '16:9'` as a field, which is better
// but still per-effect: twenty-eight places for one decision to live.
//
// A body says what the picture is OF. The surface says what shape it comes
// out in. When those two are in the same string they argue, and the string
// wins.
//
// ── ONE CONSTANT PER SURFACE, NOT ONE GLOBAL ───────────────────────────
//
// Mobile Wallpapers is genuinely 9:16 and always will be — it is a phone
// screen, not a preference. Everything on litenco main is square for the
// soft launch. Two surfaces, two values, and neither reaches into the
// other.
//
// WHEN ASPECT BECOMES A CUSTOMER CHOICE, this is the only file that
// changes: MAIN_ASPECT stops being a constant and becomes a default, and
// the routes take an argument that falls back to it. Nothing in any prompt
// body has to be touched, which is the entire point.

/**
 * Everything on litenco main: Portraits, Groups, Pets, and the Halloween
 * effects when crafted as pieces rather than as wallpapers.
 *
 * Square, for the soft launch. Approved against 101 renders on 20 August.
 */
export const MAIN_ASPECT = '1:1'

/**
 * Mobile Wallpapers. Not a preference — the shape of a phone screen.
 *
 * Kept separate from MAIN_ASPECT deliberately: a change to the soft
 * launch's shape must not silently reshape the wallpaper room, which is
 * the one place the phone framing is still correct.
 */
export const WALLPAPER_ASPECT = '9:16'

/**
 * The phone framing clause, appended by the WALLPAPER surface only.
 *
 * This is where the sentences stripped out of the Halloween bodies now
 * live. A wallpaper is a picture with a clock across the top quarter and
 * an icon grid over the bottom half, so the subject belongs low — and that
 * is a fact about the SURFACE, true of every effect, which is exactly why
 * it should never have been written into individual bodies.
 *
 * Appended last, because whatever comes after a body is the later
 * instruction and the later one wins.
 */
export const PHONE_COMPOSITION =
  'Composed for a phone screen: the subject sits low in the tall frame, ' +
  'with the upper third quiet and progressively darker where a clock and ' +
  'date will sit. Do not include phone elements.'

/**
 * What main appends. Nothing.
 *
 * A square needs no framing instruction — the bodies already say what the
 * picture is, and the renders approved on 20 August had no composition
 * clause at all. Exported as an empty string rather than omitted so the
 * two surfaces have the same shape and a future square-specific clause has
 * an obvious home.
 */
export const MAIN_COMPOSITION = ''
