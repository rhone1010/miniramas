// The Preview guard: a Vercel Preview must never reach Prodigi's live API. Every request is intercepted by a
// fake fetch, so nothing here touches the network, and the keys below are dummies.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getProduct, getQuote, createOrder, getOrder, cancelOrder, getEnv, ProdigiLiveBlockedError } from './prodigi-client'

const SANDBOX_URL = 'https://api.sandbox.prodigi.com/v4.0', LIVE_URL = 'https://api.prodigi.com/v4.0'
const KEYS = { PRODIGI_KEY_SANDBOX: 'dummy-sandbox-key', PRODIGI_KEY_LIVE: 'dummy-live-key' }
let fetchMock: ReturnType<typeof vi.fn>

function setEnv(vars: { VERCEL_ENV?: string; PRODIGI_ENV?: string; NODE_ENV?: string }) {
  for (const k of ['VERCEL_ENV', 'PRODIGI_ENV']) vi.stubEnv(k, '')
  vi.unstubAllEnvs()
  // `undefined` means "not set at all", which is different from an empty string.
  for (const k of ['VERCEL_ENV', 'PRODIGI_ENV'] as const) delete (process.env as any)[k]
  for (const [k, v] of Object.entries({ ...KEYS, ...vars })) if (v !== undefined) vi.stubEnv(k, v)
}

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ outcome: 'Ok', product: {}, quotes: [], order: { id: 'o' } }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

const operations: Array<[string, () => Promise<unknown>]> = [
  ['getProduct', () => getProduct('GLOBAL-FAP-8X8')],
  ['getQuote', () => getQuote({ destinationCountryCode: 'US', currencyCode: 'USD', items: [{ sku: 'GLOBAL-FAP-8X8', copies: 1 }] } as any)],
  ['createOrder', () => createOrder({ shippingMethod: 'Budget', recipient: {} as any, items: [] } as any)],
  ['getOrder', () => getOrder('ord_1')],
  ['cancelOrder', () => cancelOrder('ord_1')],
]

describe('Preview', () => {
  it('with PRODIGI_ENV=live fails closed on EVERY operation, with no request and no key read', async () => {
    setEnv({ VERCEL_ENV: 'preview', PRODIGI_ENV: 'live' })
    for (const [name, run] of operations) {
      await expect(run(), name).rejects.toThrow('prodigi_live_blocked_in_preview')
      await expect(run(), name).rejects.toBeInstanceOf(ProdigiLiveBlockedError)
    }
    expect(() => getEnv()).toThrow('prodigi_live_blocked_in_preview')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('does not fall back to the sandbox: the error is the answer', async () => {
    setEnv({ VERCEL_ENV: 'preview', PRODIGI_ENV: 'live' })
    await getProduct('X').catch(() => {})
    expect(fetchMock.mock.calls.some(c => String(c[0]).startsWith(SANDBOX_URL))).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()                       // and not the live host either: nothing is sent at all
  })
  it('blocks regardless of case or spacing of the live setting, and without a live key present', async () => {
    for (const v of ['LIVE', 'Live', 'live']) { setEnv({ VERCEL_ENV: 'preview', PRODIGI_ENV: v }); await expect(getOrder('o')).rejects.toThrow('prodigi_live_blocked_in_preview') }
    setEnv({ VERCEL_ENV: 'PREVIEW', PRODIGI_ENV: 'live' }); await expect(getOrder('o')).rejects.toThrow('prodigi_live_blocked_in_preview')
    vi.unstubAllEnvs(); delete (process.env as any).PRODIGI_KEY_LIVE; vi.stubEnv('VERCEL_ENV', 'preview'); vi.stubEnv('PRODIGI_ENV', 'live'); vi.stubEnv('PRODIGI_KEY_SANDBOX', 'x')
    await expect(getOrder('o')).rejects.toThrow('prodigi_live_blocked_in_preview')            // not "missing PRODIGI_KEY_LIVE"
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('with PRODIGI_ENV=sandbox uses the sandbox endpoint and the sandbox key', async () => {
    setEnv({ VERCEL_ENV: 'preview', PRODIGI_ENV: 'sandbox' })
    for (const [, run] of operations) await run()
    expect(fetchMock).toHaveBeenCalledTimes(operations.length)
    for (const [url, init] of fetchMock.mock.calls as any[]) { expect(String(url).startsWith(SANDBOX_URL)).toBe(true); expect(init.headers['X-API-Key']).toBe('dummy-sandbox-key') }
    expect(getEnv()).toEqual({ env: 'sandbox', baseUrl: SANDBOX_URL })
  })
  it('with PRODIGI_ENV unset defaults to the sandbox', async () => {
    setEnv({ VERCEL_ENV: 'preview' }); await getProduct('X')
    expect(String((fetchMock.mock.calls[0] as any)[0]).startsWith(SANDBOX_URL)).toBe(true)
  })
})

describe('Development (no VERCEL_ENV)', () => {
  it('uses the sandbox by default and with an explicit sandbox setting', async () => {
    setEnv({ NODE_ENV: 'development' }); await getProduct('X')
    setEnv({ NODE_ENV: 'development', PRODIGI_ENV: 'sandbox' }); await getProduct('Y')
    for (const [url, init] of fetchMock.mock.calls as any[]) { expect(String(url).startsWith(SANDBOX_URL)).toBe(true); expect(init.headers['X-API-Key']).toBe('dummy-sandbox-key') }
  })
  it('local development behaves as it always did when explicitly set to live (the guard is for Preview only)', async () => {
    setEnv({ NODE_ENV: 'development', PRODIGI_ENV: 'live' }); await getProduct('X')
    expect(String((fetchMock.mock.calls[0] as any)[0]).startsWith(LIVE_URL)).toBe(true)
  })
})

describe('Production: selection unchanged, driven by PRODIGI_ENV alone', () => {
  it('PRODIGI_ENV=sandbox -> sandbox endpoint and sandbox key', async () => {
    setEnv({ VERCEL_ENV: 'production', PRODIGI_ENV: 'sandbox' }); await getQuote({ destinationCountryCode: 'US', items: [] } as any)
    const [url, init] = fetchMock.mock.calls[0] as any
    expect(String(url).startsWith(SANDBOX_URL)).toBe(true); expect(init.headers['X-API-Key']).toBe('dummy-sandbox-key'); expect(getEnv().env).toBe('sandbox')
  })
  it('PRODIGI_ENV=live -> live endpoint and live key, never blocked', async () => {
    setEnv({ VERCEL_ENV: 'production', PRODIGI_ENV: 'live' })
    for (const [, run] of operations) await run()
    for (const [url, init] of fetchMock.mock.calls as any[]) { expect(String(url).startsWith(LIVE_URL)).toBe(true); expect(init.headers['X-API-Key']).toBe('dummy-live-key') }
    expect(getEnv()).toEqual({ env: 'live', baseUrl: LIVE_URL })
  })
  it('a missing live key still fails with the existing message, not the Preview error', async () => {
    setEnv({ VERCEL_ENV: 'production', PRODIGI_ENV: 'live' }); delete (process.env as any).PRODIGI_KEY_LIVE
    await expect(getOrder('o')).rejects.toThrow('missing PRODIGI_KEY_LIVE')
  })
})

describe('no request path bypasses the guard', () => {
  const root = path.resolve(__dirname, '../../..')
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (['node_modules', '.next', '.git', 'archive', '_recovery', 'Old', 'tools', '.temp'].includes(e.name) || e.name.startsWith('_route')) return []
    const p = path.join(dir, e.name); return e.isDirectory() ? walk(p) : /\.(ts|tsx|js|mjs|cjs)$/.test(e.name) ? [p] : []
  })
  const sources = ['app', 'lib', 'components', 'middleware.ts', 'next.config.ts', 'next.config.js', 'next.config.mjs'].map(p => path.join(root, p)).filter(fs.existsSync)
    .flatMap(p => fs.statSync(p).isDirectory() ? walk(p) : [p]).filter(f => !/\.test\.(ts|tsx)$/.test(f))

  it('only prodigi-client.ts names a Prodigi API host or sends the Prodigi key header', () => {
    const offenders = sources.filter(f => path.basename(f) !== 'prodigi-client.ts').filter(f => /api(\.sandbox)?\.prodigi\.com|X-API-Key/i.test(fs.readFileSync(f, 'utf8')))
    expect(offenders.map(f => path.relative(root, f))).toEqual([])
  })
  it('the client has exactly one fetch, inside call(), which resolves its endpoint through getConfig()', () => {
    const src = fs.readFileSync(path.join(__dirname, 'prodigi-client.ts'), 'utf8')
    expect((src.match(/\bfetch\(/g) || [])).toHaveLength(1)
    const callFn = src.slice(src.indexOf('async function call<T>('), src.indexOf('export async function getProduct'))
    expect(callFn).toContain('getConfig()'); expect(callFn).toContain('fetch(url')
    expect((src.match(/getConfig\(\)/g) || []).length).toBeGreaterThanOrEqual(3)          // definition, call(), getEnv()
  })
  it('no other module reads the Prodigi keys, so none can build its own authenticated request', () => {
    const offenders = sources.filter(f => path.basename(f) !== 'prodigi-client.ts').filter(f => /PRODIGI_KEY_(LIVE|SANDBOX)/.test(fs.readFileSync(f, 'utf8')))
    expect(offenders.map(f => path.relative(root, f))).toEqual([])
  })
})
