// lib/v1/shared/outpaint.ts
//
// Stability outpaint, two modes, one endpoint. Route-side sibling of
// scripts/outpaint-splash.mjs — same call, same creativity, same reasoning;
// buffers in and out instead of folders, and no .env.local read.
//
// ── MODE 'aspect' — WALLPAPERS ─────────────────────────────────────────
// Extends a near-square render up and down until it reaches the phone
// aspect. Width never changes; padding sideways would only make the face
// smaller. The split is NOT even: the clock and date sit across the top
// quarter of a phone screen and the icon grid covers the bottom half, so
// the subject belongs low with clean air above it. TOP_BIAS puts 70% of
// the new height on top.
//
// When the render already lands at 9:16 this is a no-op and returns the
// original untouched. Prompting for the shape natively is cheaper and
// safer than extending into it, so the framing clause in each wallpaper
// body is what should be doing the work — this is the fallback.
//
// ── MODE 'margin' — GROUPS ─────────────────────────────────────────────
// Pads all four sides by a percentage of the long edge so the sculpture
// sits inside the frame instead of being cut off at it. Every Groups
// render to date crops at the edge; NB2 does not leave margins. Runs on
// every Groups render, not conditionally.
//
// ── CREATIVITY ─────────────────────────────────────────────────────────
// 0.35, not the 0.5 the old app pipeline used. That pipeline was extending
// a generated scene; this extends a portrait somebody will recognise
// themselves in, and a creative outpaint invents shoulders. Lower is
// duller and duller is right here.
//
// ── FAILURE POSTURE ────────────────────────────────────────────────────
// Non-fatal by design. On any error the caller gets the original buffer
// back with `outpainted: false` and a reason string for the log. A tight
// crop is a worse piece, not a broken one.

const STABILITY_OUTPAINT_URL =
  'https://api.stability.ai/v2beta/stable-image/edit/outpaint'

/** Phone aspect. Devices are taller (about 9:19.5) but the status bar and
 *  home indicator take the difference, and 9:16 is what the reel uses. */
export const PHONE_RATIO = 9 / 16

/** Stability's ceiling per direction. */
const MAX_PAD = 2000

/** Share of added height that goes above the subject, mode 'aspect'. */
const TOP_BIAS = 0.7

/** Margin as a share of the long edge, mode 'margin'. Rich's call,
 *  2026-08-10. Tune on renders. */
export const GROUPS_MARGIN = 0.08

const CREATIVITY = '0.35'

const DEFAULT_TIMEOUT_MS = 60_000

export type OutpaintMode = 'aspect' | 'margin'

export interface OutpaintInput {
  /** The render as it came back from NB2. */
  image: Buffer
  /** Source pixel dimensions. The caller already has these; re-reading
   *  them here would mean a sharp dependency for no gain. */
  width: number
  height: number
  stabilityApiKey: string
  mode: OutpaintMode
  /** mode 'aspect' only. Defaults to the phone shape. */
  targetRatio?: number
  /** mode 'margin' only. Share of the long edge. Defaults to 8%. */
  margin?: number
  timeoutMs?: number
}

export interface OutpaintResult {
  image: Buffer
  outpainted: boolean
  /** Populated when outpainted is false. Never thrown — the caller ships
   *  the original and this goes to the log. */
  reason?: string
  pad?: Pad
}

export interface Pad {
  up: number
  down: number
  left: number
  right: number
}

/** Height added top and bottom until the target aspect is reached, biased
 *  upward. Width untouched. */
function padForAspect(
  width: number,
  height: number,
  targetRatio: number,
): Pad | { skip: string } {
  const wantHeight = Math.round(width / targetRatio)
  const need = wantHeight - height
  if (need <= 0) return { skip: 'already_tall_enough' }

  const up = Math.ceil(need * TOP_BIAS)
  return { up, down: need - up, left: 0, right: 0 }
}

/** Even margin on all four sides, sized off the long edge so a wide piece
 *  and a tall piece get the same visual breathing room. */
function padForMargin(
  width: number,
  height: number,
  margin: number,
): Pad | { skip: string } {
  const pad = Math.round(Math.max(width, height) * margin)
  if (pad <= 0) return { skip: 'margin_zero' }
  return { up: pad, down: pad, left: pad, right: pad }
}

export async function outpaint(
  input: OutpaintInput,
): Promise<OutpaintResult> {
  const {
    image,
    width,
    height,
    stabilityApiKey,
    mode,
    targetRatio = PHONE_RATIO,
    margin = GROUPS_MARGIN,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = input

  if (!stabilityApiKey) {
    return { image, outpainted: false, reason: 'no_api_key' }
  }
  if (!width || !height) {
    return { image, outpainted: false, reason: 'no_dimensions' }
  }

  const computed =
    mode === 'aspect'
      ? padForAspect(width, height, targetRatio)
      : padForMargin(width, height, margin)

  if ('skip' in computed) {
    return { image, outpainted: false, reason: computed.skip }
  }

  const over = Math.max(
    computed.up,
    computed.down,
    computed.left,
    computed.right,
  )
  if (over > MAX_PAD) {
    return { image, outpainted: false, reason: `pad_over_ceiling:${over}` }
  }

  const form = new FormData()
  form.append('image', new Blob([image], { type: 'image/jpeg' }), 'render.jpg')
  if (computed.up) form.append('up', String(computed.up))
  if (computed.down) form.append('down', String(computed.down))
  if (computed.left) form.append('left', String(computed.left))
  if (computed.right) form.append('right', String(computed.right))
  form.append('creativity', CREATIVITY)
  form.append('output_format', 'jpeg')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(STABILITY_OUTPAINT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stabilityApiKey}`,
        Accept: 'image/*',
      },
      body: form,
      signal: controller.signal,
    })

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 160)
      return {
        image,
        outpainted: false,
        reason: `stability_${res.status}:${detail}`,
      }
    }

    const out = Buffer.from(await res.arrayBuffer())
    if (!out.length) {
      return { image, outpainted: false, reason: 'empty_response' }
    }

    return { image: out, outpainted: true, pad: computed }
  } catch (e: any) {
    const reason =
      e?.name === 'AbortError' ? 'timeout' : `fetch_failed:${e?.message || e}`
    return { image, outpainted: false, reason }
  } finally {
    clearTimeout(timer)
  }
}

/** Convenience wrappers so callers read as what they mean. */

export function outpaintToPhone(
  input: Omit<OutpaintInput, 'mode'>,
): Promise<OutpaintResult> {
  return outpaint({ ...input, mode: 'aspect' })
}

export function outpaintMargin(
  input: Omit<OutpaintInput, 'mode'>,
): Promise<OutpaintResult> {
  return outpaint({ ...input, mode: 'margin' })
}
