// lib/v1/print/upscale/providers.ts
//
// prunaai/p-image-upscale through two interchangeable routes:
//   replicate  POST https://api.replicate.com/v1/models/prunaai/p-image-upscale/predictions
//   pruna      POST https://api.pruna.ai/v1/predictions   (header Model: p-image-upscale)
//
// Both are ASYNCHRONOUS here: start() returns a prediction id immediately, and poll() reports on it.
// That is what lets a job save the id and survive a crash (process.ts). Neither route is called with
// a synchronous "wait" mode.
//
// BOTH TAKE AN IMAGE URL. The prepared artwork is uploaded to the private print-assets bucket and a
// short-lived signed URL is passed, so there are no data-URI size limits and both routes behave alike.
//
// RESOLUTION: both are driven by integer-megapixel `target` (Pruna's direct API documents no `factor`),
// so behaviour and cost are the same whichever route is active.
//
// DUPLICATE CHARGES, honestly: no provider offers an idempotency key. The only protection is that
// process.ts saves the prediction id the moment start() returns. If the process dies in the instant
// between the provider creating a prediction and that save:
//   replicate  findRecent() lists recent predictions and recovers it by the job's unique input path.
//   pruna      has no list endpoint; the job is re-submitted ONCE, flagged possible_duplicate for reconciliation.

import type { UpscaleSettings } from './settings'

export const REPLICATE_MODEL = 'prunaai/p-image-upscale'
export const PRUNA_MODEL = 'p-image-upscale'

export type PredictionStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'

export interface PredictionState {
  status: PredictionStatus
  outputUrl?: string
  error?: string
  /** Provider-reported compute time, when it says. */
  predictMs?: number
}

export interface StartInput { imageUrl: string; targetMp: number; settings: UpscaleSettings }

export interface UpscaleProvider {
  readonly name: 'replicate' | 'pruna'
  start(input: StartInput): Promise<{ id: string }>
  poll(id: string): Promise<PredictionState>
  download(url: string): Promise<Buffer>
  /** Recover a prediction created just before a crash. Undefined where the provider cannot list. */
  findRecent?(args: { pathMarker: string; since: Date }): Promise<string | null>
  /** Pruna's own file store (POST /v1/files): the direct API wants a URL, and this makes one. Used by tools; production passes signed storage URLs. */
  upload?(data: Buffer, name?: string): Promise<string>
}

export class ProviderError extends Error {
  /** `ambiguous`: the request may have been received and acted on (timeout, dropped connection, 5xx). Only an ambiguous start() can leave an uncounted prediction behind. */
  constructor(public code: 'not_configured' | 'rejected' | 'unavailable' | 'bad_response', message: string, public retryable: boolean, public ambiguous: boolean = false) { super(message) }
}

export interface ProviderDeps {
  fetchImpl?: typeof fetch
  env?: Record<string, string | undefined>
  timeoutMs?: number
}

/**
 * Published per-image prices by output megapixels (Pruna's pricing; Replicate's own rate for this
 * model has not been verified, so cost is recorded as an ESTIMATE with its basis).
 */
export const PRICE_TIERS: Array<{ upToMp: number; usd: number }> = [
  { upToMp: 4, usd: 0.005 }, { upToMp: 8, usd: 0.01 }, { upToMp: 16, usd: 0.02 },
  { upToMp: 32, usd: 0.04 }, { upToMp: 64, usd: 0.06 }, { upToMp: 128, usd: 0.12 },
]

export function estimateCostUsd(targetMp: number, provider: 'replicate' | 'pruna'): { usd: number; basis: string } {
  const tier = PRICE_TIERS.find(t => targetMp <= t.upToMp) ?? PRICE_TIERS[PRICE_TIERS.length - 1]
  return {
    usd: tier.usd,
    basis: provider === 'pruna'
      ? 'pruna published tier (docs.api.pruna.ai, 2026-10)'
      : 'pruna published tier; replicate rate for this model unverified',
  }
}

function base(deps: ProviderDeps) {
  const f = deps.fetchImpl ?? fetch
  const timeout = deps.timeoutMs ?? 30_000
  return {
    async json(url: string, init: RequestInit): Promise<{ status: number; body: any }> {
      let res: Response
      try { res = await f(url, { ...init, signal: AbortSignal.timeout(timeout) }) }
      catch (e) { throw new ProviderError('unavailable', 'provider request failed or timed out', true, true) }
      let body: any = null
      try { body = await res.json() } catch { /* non-JSON error page */ }
      return { status: res.status, body }
    },
    async bytes(url: string, headers?: Record<string, string>): Promise<Buffer> {
      let res: Response
      try { res = await f(url, { headers, signal: AbortSignal.timeout(Math.max(timeout, 90_000)) }) }
      catch { throw new ProviderError('unavailable', 'output download failed or timed out', true, false) }
      if (!res.ok) throw new ProviderError('unavailable', `output download HTTP ${res.status}`, res.status >= 500)
      return Buffer.from(await res.arrayBuffer())
    },
  }
}

const failureFor = (status: number, what: string): ProviderError =>
  new ProviderError(status === 401 || status === 403 ? 'not_configured' : status >= 500 || status === 429 ? 'unavailable' : 'rejected',
    `${what} HTTP ${status}`, status >= 500 || status === 429, status >= 500)

// ── Replicate ──────────────────────────────────────────────────────────────
export function replicateProvider(deps: ProviderDeps = {}): UpscaleProvider {
  const http = base(deps)
  const env = deps.env ?? process.env
  const token = () => {
    const t = env.REPLICATE_API_TOKEN
    if (!t) throw new ProviderError('not_configured', 'REPLICATE_API_TOKEN is not set', false)
    return t
  }
  const auth = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' })
  const API = 'https://api.replicate.com/v1'
  return {
    name: 'replicate',
    async start({ imageUrl, targetMp, settings }) {
      const { status, body } = await http.json(`${API}/models/${REPLICATE_MODEL}/predictions`, {
        method: 'POST', headers: auth(),
        body: JSON.stringify({ input: {
          image: imageUrl, upscale_mode: 'target', target: targetMp,
          output_format: settings.output_format, output_quality: settings.output_quality,
          enhance_details: settings.enhance_details, enhance_realism: settings.enhance_realism,
          disable_safety_checker: settings.disable_safety_checker,
        } }),
      })
      if (status < 200 || status >= 300) throw failureFor(status, 'replicate create')
      if (!body?.id) throw new ProviderError('bad_response', 'replicate returned no prediction id', false)
      return { id: String(body.id) }
    },
    async poll(id) {
      const { status, body } = await http.json(`${API}/predictions/${encodeURIComponent(id)}`, { headers: auth() })
      if (status < 200 || status >= 300) throw failureFor(status, 'replicate poll')
      const out = Array.isArray(body?.output) ? body.output[0] : body?.output
      return {
        status: body?.status as PredictionStatus,
        outputUrl: typeof out === 'string' ? out : undefined,
        error: body?.error ? String(body.error).slice(0, 300) : undefined,
        predictMs: typeof body?.metrics?.predict_time === 'number' ? Math.round(body.metrics.predict_time * 1000) : undefined,
      }
    },
    download: url => http.bytes(url),
    async findRecent({ pathMarker, since }) {
      const { status, body } = await http.json(`${API}/predictions`, { headers: auth() })
      if (status < 200 || status >= 300) return null
      const floor = since.getTime() - 60_000
      for (const p of body?.results ?? []) {
        const created = Date.parse(p?.created_at ?? '')
        const model = String(p?.model ?? '')
        const image = String(p?.input?.image ?? '')
        if (Number.isFinite(created) && created >= floor && model.includes('p-image-upscale') && image.includes(pathMarker)) return String(p.id)
      }
      return null
    },
  }
}

// ── Pruna direct ───────────────────────────────────────────────────────────
export function prunaProvider(deps: ProviderDeps = {}): UpscaleProvider {
  const http = base(deps)
  const env = deps.env ?? process.env
  const key = () => {
    const k = env.PRUNA_API_KEY
    if (!k) throw new ProviderError('not_configured', 'PRUNA_API_KEY is not set', false)
    return k
  }
  const API = 'https://api.pruna.ai/v1'
  return {
    name: 'pruna',
    async start({ imageUrl, targetMp, settings }) {
      const { status, body } = await http.json(`${API}/predictions`, {
        method: 'POST', headers: { apikey: key(), Model: PRUNA_MODEL, 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: {
          image: imageUrl, target: targetMp,
          output_format: settings.output_format, output_quality: settings.output_quality,
          enhance_details: settings.enhance_details, enhance_realism: settings.enhance_realism,
          disable_safety_checker: settings.disable_safety_checker,
        } }),
      })
      if (status < 200 || status >= 300) throw failureFor(status, 'pruna create')
      if (!body?.id) throw new ProviderError('bad_response', 'pruna returned no prediction id', false)
      return { id: String(body.id) }
    },
    async poll(id) {
      const { status, body } = await http.json(`${API}/predictions/status/${encodeURIComponent(id)}`, { headers: { apikey: key() } })
      if (status < 200 || status >= 300) throw failureFor(status, 'pruna poll')
      return {
        status: body?.status as PredictionStatus,
        outputUrl: typeof body?.generation_url === 'string' ? body.generation_url : undefined,
        error: body?.error || body?.message ? String(body.error || body.message).slice(0, 300) : undefined,
      }
    },
    // Pruna's output is fetched with the same key.
    download: url => http.bytes(url, { apikey: key() }),
    // No list endpoint is documented: crash-window recovery is not available on this route.
    async upload(data, name = 'image.jpg') {
      const form = new FormData()
      form.append('content', new Blob([new Uint8Array(data)], { type: 'image/jpeg' }), name)
      const f = deps.fetchImpl ?? fetch
      const apikey = key()
      let res: Response
      try { res = await f(`${API}/files`, { method: 'POST', headers: { apikey }, body: form, signal: AbortSignal.timeout(deps.timeoutMs ?? 60_000) }) }
      catch { throw new ProviderError('unavailable', 'pruna upload failed or timed out', true, false) }
      const body: any = await res.json().catch(() => null)
      if (!res.ok) throw failureFor(res.status, 'pruna upload')
      const url = body?.urls?.get
      if (typeof url !== 'string') throw new ProviderError('bad_response', 'pruna upload returned no url', false)
      return url
    },
  }
}

export function makeProvider(name: 'replicate' | 'pruna', deps: ProviderDeps = {}): UpscaleProvider {
  return name === 'pruna' ? prunaProvider(deps) : replicateProvider(deps)
}
