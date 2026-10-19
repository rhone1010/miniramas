// The server-side retry of a Discovery portfolio render: it is authorized (it carries the internal secret items/render requires), it only ever moves an item
// this invocation still holds, and it can never reset, fail or overwrite an item that is already finished, so a retry cannot make a second picture.
// The REAL renderOnePortfolioItem; the database (with PostgREST-style conditional updates) and the network are faked. Nothing is generated.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSupabase } from './helpers/fake-supabase'

const h = vi.hoisted(() => ({ fake: null as any, fetches: [] as Array<{ url: string; init: any }>, onGenerate: null as null | (() => void), generate: null as any, clean: vi.fn(), ledger: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ get supabaseAdmin() { return h.fake.sb }, supabase: {} }))
vi.mock('@/lib/store/internal-fetch', () => ({ internalBaseUrl: () => 'https://preview.test', internalHeaders: (v: Record<string, string>) => v }))
vi.mock('@/lib/store/preview', () => ({ storeCleanOriginal: h.clean, recordPreview: h.ledger, lockedPreviewPath: (s: string, id: string) => `locked/${s}/${id}.jpg`, PREVIEW_BUCKET: 'previews', LOCKED_PREVIEW_QUALITY: 90 }))
vi.mock('@/lib/v1/foyer/foyer-watermark', () => ({ bakeFoyerWatermark: async () => Buffer.from('image').toString('base64') }))
vi.mock('sharp', () => ({ default: () => ({ toColourspace: () => ({ jpeg: () => ({ toBuffer: async () => Buffer.from('locked') }) }) }) }))
import { renderOnePortfolioItem } from '@/lib/store/portfolio-render'

const STAMP = '2026-10-18T10:00:00.000Z'
function world(item: Record<string, unknown> = {}, portfolio: Record<string, unknown> = {}) {
  h.fake = fakeSupabase({ tables: {
    portfolio_items: [{ id: 'item-1', portfolio_id: 'pf-1', slot: 0, preset: 'bronze', status: 'rendering', rendering_started_at: STAMP, attempts: 0, preview_id: null, ...item }],
    portfolios: [{ id: 'pf-1', status: 'generating', series: 'portraits', source_image: 'SRC', delivery: 'purchased', pose: null, framing: null, subject: null, aspect_ratio: null, ...portfolio }],
  } })
}
const itemRow = () => h.fake.row('portfolio_items', 'item-1')
const retryCalls = () => h.fetches.filter(f => f.url.endsWith('/api/v1/portfolios/items/render'))
const generateCalls = () => h.fetches.filter(f => f.url.includes('/generate'))

beforeEach(() => {
  process.env.CRON_SECRET = 'cron-secret-for-tests'
  h.fetches = []; h.onGenerate = null; h.clean.mockReset().mockResolvedValue('portraits/clean.png'); h.ledger.mockReset().mockResolvedValue(true)
  h.generate = { ok: false }
  vi.stubGlobal('fetch', async (url: string, init: any) => {
    h.fetches.push({ url, init })
    if (url.includes('/generate')) { h.onGenerate?.(); return { ok: true, status: 200, json: async () => ({ result: h.generate.ok ? { ok: true, image_b64: 'image' } : { ok: false, fatal_error: 'stop' } }) } }
    return { ok: true, status: 200, json: async () => ({ rendered: true }) }                      // the retry endpoint
  })
  world()
})

describe('a failed render is retried, with authorization', () => {
  it('puts the item back in the queue and calls items/render with the internal secret (it used to send none and be refused 401)', async () => {
    await renderOnePortfolioItem('item-1')
    expect(itemRow()).toMatchObject({ status: 'pending', attempts: 1 })
    expect(retryCalls().length).toBe(1); expect(retryCalls()[0].init.headers.Authorization).toBe('Bearer cron-secret-for-tests'); expect(JSON.parse(retryCalls()[0].init.body)).toEqual({ portfolioItemId: 'item-1' })
  })
  it('without the secret nothing is called and the item stays pending for the cron poller', async () => {
    delete process.env.CRON_SECRET
    await renderOnePortfolioItem('item-1')
    expect(itemRow().status).toBe('pending'); expect(retryCalls().length).toBe(0)
  })
  it('a refused retry is logged, not silent', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', async (url: string, init: any) => { h.fetches.push({ url, init }); return url.includes('/generate') ? { ok: true, status: 200, json: async () => ({ result: { ok: false } }) } : { ok: false, status: 401, json: async () => ({}) } })
    await renderOnePortfolioItem('item-1')
    expect(err.mock.calls.some(c => String(c[0]).includes('was refused: HTTP 401'))).toBe(true); err.mockRestore()
  })
  it('the third failure is final: failed, no retry', async () => {
    world({ attempts: 3 })
    await renderOnePortfolioItem('item-1')
    expect(itemRow()).toMatchObject({ status: 'failed', attempts: 4 }); expect(retryCalls().length).toBe(0)
  })
})

describe('a failure for good is dated, and never lost to a missing column', () => {
  it('records when the item failed (the automatic recovery backoff counts from it)', async () => {
    world({ attempts: 3 })
    await renderOnePortfolioItem('item-1')
    expect(itemRow().status).toBe('failed'); expect(Date.now() - Date.parse(itemRow().failed_at)).toBeLessThan(60_000)
  })
  it('if migration 053 has not been applied (no failed_at column) the failure is still recorded, without it', async () => {
    world({ attempts: 3 })
    h.fake.fault({ op: 'update', table: 'portfolio_items', match: patch => 'failed_at' in patch, message: 'column portfolio_items.failed_at does not exist' })
    await renderOnePortfolioItem('item-1')
    expect(itemRow()).toMatchObject({ status: 'failed', attempts: 4 }); expect(itemRow().failed_at).toBeUndefined()
  })
  it('an unexpected error is dated too, with its message kept', async () => {
    h.generate = { ok: true }; h.clean.mockRejectedValue(new Error('storage exploded'))
    await renderOnePortfolioItem('item-1')
    expect(itemRow()).toMatchObject({ status: 'failed', error: 'storage exploded' }); expect(itemRow().failed_at).toBeTruthy()
  })
})

describe('a retry never touches an item it does not hold', () => {
  it('already done or already failed: nothing is generated, nothing is written', async () => {
    for (const status of ['done', 'failed']) {
      h.fetches = []; world({ status, preview_id: status === 'done' ? 'P0' : null })
      await renderOnePortfolioItem('item-1')
      expect(generateCalls().length, status).toBe(0); expect(itemRow().status, status).toBe(status)
    }
  })
  it('a late failure on an item that finished meanwhile does not reset, fail or retry it', async () => {
    h.onGenerate = () => Object.assign(itemRow(), { status: 'done', preview_id: 'P0' })
    await renderOnePortfolioItem('item-1')
    expect(itemRow()).toMatchObject({ status: 'done', preview_id: 'P0', attempts: 0 }); expect(retryCalls().length).toBe(0)
  })
  it('a late failure after the item was reclaimed by another render (new claim stamp) does not requeue it or start a second render', async () => {
    h.onGenerate = () => Object.assign(itemRow(), { rendering_started_at: '2026-10-18T10:11:00.000Z' })
    await renderOnePortfolioItem('item-1')
    expect(itemRow()).toMatchObject({ status: 'rendering', rendering_started_at: '2026-10-18T10:11:00.000Z', attempts: 0 }); expect(retryCalls().length).toBe(0)
  })
  it('a success after the claim was lost is discarded: the finished picture is not overwritten and the portfolio is not re-flipped', async () => {
    h.generate = { ok: true }
    h.onGenerate = () => Object.assign(itemRow(), { status: 'done', preview_id: 'P0' })
    await renderOnePortfolioItem('item-1')
    expect(itemRow()).toMatchObject({ status: 'done', preview_id: 'P0' }); expect(h.fake.row('portfolios', 'pf-1').status).toBe('generating')
  })
  it('an unexpected error does not turn a finished item into a failed one, but does fail one it holds', async () => {
    h.generate = { ok: true }; h.clean.mockRejectedValue(new Error('storage exploded'))
    h.onGenerate = () => Object.assign(itemRow(), { status: 'done', preview_id: 'P0' })
    await renderOnePortfolioItem('item-1'); expect(itemRow()).toMatchObject({ status: 'done', preview_id: 'P0' })
    world(); h.generate = { ok: true }; h.onGenerate = null
    await renderOnePortfolioItem('item-1'); expect(itemRow()).toMatchObject({ status: 'failed', error: 'storage exploded' })
  })
})

describe('the normal path is unchanged', () => {
  it('a held item that renders is marked done with its preview and the portfolio flips to ready', async () => {
    h.generate = { ok: true }
    await renderOnePortfolioItem('item-1')
    expect(itemRow()).toMatchObject({ status: 'done' }); expect(itemRow().preview_id).toBeTruthy(); expect(h.fake.row('portfolios', 'pf-1').status).toBe('ready')
    expect(generateCalls().length).toBe(1); expect(retryCalls().length).toBe(0)
  })
  it('an item with no recorded claim stamp (older rows) is still moved, by status alone', async () => {
    world({ rendering_started_at: null }); h.generate = { ok: true }
    await renderOnePortfolioItem('item-1'); expect(itemRow().status).toBe('done')
  })
})
