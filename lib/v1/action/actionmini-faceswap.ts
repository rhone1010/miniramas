// lib/v1/actionmini-faceswap.ts
//
// Stage 4 of the Action Minis pipeline — face swap via Replicate.
// Detects faces in the source photo + the rendered miniature and
// swaps the rendered faces for the source faces using an InsightFace-
// based swap model. This is the commercial-grade likeness lock.
//
// Why face swap matters for Action: NB2 (Pass 1) and gpt-image-1 (Pass 2)
// can produce close-but-not-exact likeness. For a commercial product
// rendering miniatures of specific people (family, friends, the user
// themselves), "close" isn't enough. Face swap operates on pixels with
// a model literally trained for "preserve this face" — different
// mechanism, different ceiling.
//
// Soft-fails to the input image on any error — face swap failure never
// blocks a render from returning.

const MAX_RATE_LIMIT_RETRIES = 3
const BASE_RETRY_DELAY_MS    = 2000

// cdingram/face-swap — InsightFace-based, takes swap_image (source face)
// and input_image (target where face goes). Stable, well-documented.
// Pricing: ~$0.0023/run on Replicate (cheap).
const FACESWAP_MODEL_VERSION =
  'cdingram/face-swap:d1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111'

export interface ActionMiniFaceSwapInput {
  renderImageB64:    string   // post-outpaint render
  sourceImageB64:    string   // original source photo (face reference)
  replicateApiToken: string
}

export interface ActionMiniFaceSwapOutput {
  imageB64:    string
  swapped:     boolean
  durationMs:  number
  reason?:     string   // why swap was skipped or failed
}

async function fetchWithRateLimitRetry(
  url:     string,
  options: RequestInit,
  context: string,
): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const res = await fetch(url, options)
    if (res.status !== 429) return res
    if (attempt === MAX_RATE_LIMIT_RETRIES) return res
    const retryAfter = res.headers.get('Retry-After')
    const seconds = retryAfter ? Number(retryAfter) : NaN
    const delayMs = (Number.isFinite(seconds) && seconds > 0)
      ? seconds * 1000
      : BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
    console.warn(
      `[${context}] Replicate 429, retry ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES} after ${delayMs}ms`,
    )
    await new Promise(r => setTimeout(r, delayMs))
  }
  throw new Error('fetchWithRateLimitRetry exhausted retries')
}

export async function swapActionFaces(
  input: ActionMiniFaceSwapInput,
): Promise<ActionMiniFaceSwapOutput> {

  if (!input.replicateApiToken) {
    return {
      imageB64:   input.renderImageB64,
      swapped:    false,
      durationMs: 0,
      reason:     'REPLICATE_API_TOKEN not set',
    }
  }

  const t0 = Date.now()

  try {
    const sourceUri = `data:image/jpeg;base64,${input.sourceImageB64}`
    const renderUri = `data:image/png;base64,${input.renderImageB64}`

    const res = await fetchWithRateLimitRetry(
      'https://api.replicate.com/v1/predictions',
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${input.replicateApiToken}`,
          'Content-Type':  'application/json',
          'Prefer':        'wait=60',
        },
        body: JSON.stringify({
          version: FACESWAP_MODEL_VERSION.split(':')[1],
          input: {
            swap_image:  sourceUri,
            input_image: renderUri,
          },
        }),
      },
      'actionmini/faceswap',
    )

    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`replicate_failed: ${res.status} — ${errBody.slice(0, 240)}`)
    }

    let final: any = await res.json()
    while (final.status === 'starting' || final.status === 'processing') {
      await new Promise(r => setTimeout(r, 1500))
      const pollRes = await fetch(final.urls.get, {
        headers: { 'Authorization': `Bearer ${input.replicateApiToken}` },
      })
      if (!pollRes.ok) throw new Error(`replicate_poll_failed: ${pollRes.status}`)
      final = await pollRes.json()
    }

    if (final.status !== 'succeeded') {
      throw new Error(`replicate_${final.status}: ${final.error || final.status}`)
    }

    const outputUrl: string = Array.isArray(final.output) ? final.output[0] : final.output
    if (!outputUrl) throw new Error('replicate_no_output')

    const imgRes = await fetch(outputUrl)
    if (!imgRes.ok) throw new Error(`output_fetch_failed: ${imgRes.status}`)
    const imgBuf = Buffer.from(await imgRes.arrayBuffer())
    const b64 = imgBuf.toString('base64')

    const durationMs = Date.now() - t0
    console.log(`[actionmini/faceswap] swap done in ${durationMs}ms`)

    return {
      imageB64:  b64,
      swapped:   true,
      durationMs,
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown'
    console.warn(`[actionmini/faceswap] swap failed, returning unswapped: ${msg}`)
    return {
      imageB64:   input.renderImageB64,
      swapped:    false,
      durationMs: Date.now() - t0,
      reason:     `error: ${msg}`,
    }
  }
}
