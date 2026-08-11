// lib/v1/wallpapers/wallpaper-outpaint.ts
//
// Extends a near-square render to a phone aspect by outpainting upward and
// downward with Stability. Route-side sibling of scripts/outpaint-splash.mjs
// — same endpoint, same creativity, same reasoning; buffers in and out
// instead of folders, and no .env.local read.
//
// WHY THE PAD IS NOT SPLIT EVENLY
//   The splash script adds height evenly because a plate on a marketing
//   reel wants the subject centred. A wallpaper does not. The clock and
//   date sit across the top quarter of the screen and the icon grid covers
//   the bottom half, so the subject belongs in the lower-middle third with
//   clean air above it. TOP_BIAS puts most of the new height on top.
//
// CREATIVITY
//   0.35, not the 0.5 the app pipeline uses elsewhere. That pipeline is
//   extending a generated scene; this is extending a portrait somebody will
//   recognise themselves in, and a creative outpaint invents shoulders.
//   Lower is duller and duller is right here.
//
// FAILURE POSTURE
//   Non-fatal by design. If Stability errors, times out, or the pad exceeds
//   its ceiling, the caller gets the original buffer back and `outpainted:
//   false`. A square wallpaper is a worse wallpaper, not a broken one.

const STABILITY_OUTPAINT_URL =
  'https://api.stability.ai/v2beta/stable-image/edit/outpaint'

/** Phone aspect. Devices are taller (about 9:19.5) but the status bar and
 *  home indicator take the difference, and 9:16 is what the reel uses. */
export const TARGET_RATIO = 9 / 16

/** Stability's ceiling per direction. */
const MAX_PAD = 2000

/** Share of the added height that goes above the subject. */
const TOP_BIAS = 0.7

const CREATIVITY = '0.35'

const DEFAULT_TIMEOUT_MS = 60_000

export interface OutpaintInput {
  /** The render as it came back from NB2. */
  image: Buffer
  /** Source pixel dimensions. The caller already has these from the
   *  generator; re-reading them here would mean a sharp dependency in the
   *  route for no gain. */
  width: number
  height: number
  stabilityApiKey: string
  /** Override the phone aspect if a silo ever wants a different shape. */
  targetRatio?: number
  timeoutMs?: number
}

export interface OutpaintResult {
  image: Buffer
  outpainted: boolean
  /** Populated when outpainted is false. Never thrown — the caller ships
   *  the square image and this goes to the log. */
  reason?: string
  padTop?: number
  padBottom?: number
}

export async function outpaintToPhone(
  input: OutpaintInput,
): Promise<OutpaintResult> {
  const {
    image,
    width,
    height,
    stabilityApiKey,
    targetRatio = TARGET_RATIO,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = input

  if (!stabilityApiKey) {
    return { image, outpainted: false, reason: 'no_api_key' }
  }
  if (!width || !height) {
    return { image, outpainted: false, reason: 'no_dimensions' }
  }

  // Width stays. Padding sideways would only make the face smaller.
  const wantHeight = Math.round(width / targetRatio)
  const need = wantHeight - height

  if (need <= 0) {
    return { image, outpainted: false, reason: 'already_tall_enough' }
  }

  const padTop = Math.ceil(need * TOP_BIAS)
  const padBottom = need - padTop

  if (padTop > MAX_PAD || padBottom > MAX_PAD) {
    return {
      image,
      outpainted: false,
      reason: `pad_over_ceiling:${Math.max(padTop, padBottom)}`,
    }
  }

  const form = new FormData()
  form.append('image', new Blob([image], { type: 'image/jpeg' }), 'render.jpg')
  form.append('up', String(padTop))
  form.append('down', String(padBottom))
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

    return { image: out, outpainted: true, padTop, padBottom }
  } catch (e: any) {
    const reason =
      e?.name === 'AbortError' ? 'timeout' : `fetch_failed:${e?.message || e}`
    return { image, outpainted: false, reason }
  } finally {
    clearTimeout(timer)
  }
}
