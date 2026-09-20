import { beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { fakeSupabase } from './helpers/fake-supabase'
const h = vi.hoisted(() => ({ fake: null as any, user: null as any }))
vi.mock('@/lib/supabase', () => ({ get supabaseAdmin() { return h.fake.sb }, supabase: {} }))
vi.mock('@/lib/store/auth', () => ({ getUser: async () => h.user }))
import { GET } from '@/app/api/v1/portfolios/[portfolioId]/art/[previewId]/route'
import { GET as statusGET } from '@/app/api/v1/portfolios/[portfolioId]/status/route'
import { bakeFoyerWatermark } from '@/lib/v1/foyer/foyer-watermark'

const context = { params: Promise.resolve({ portfolioId: 'p', previewId: 'art' }) }
const request = new Request('https://preview.test/api/v1/portfolios/p/art/art')
let source: Buffer
beforeEach(async () => {
  h.user = { id: 'owner' }
  source = await sharp({ create: { width: 390, height: 520, channels: 3, background: '#808080' } }).jpeg().toBuffer()
  h.fake = fakeSupabase({ tables: {
    portfolios: [{ id: 'p', user_id: 'owner' }],
    portfolio_items: [{ id: 'i', portfolio_id: 'p', preview_id: 'art', status: 'done' }],
    preview_ledger: [{ id: 'art', storage_path: 'portraits/art.png', unlocked_at: null }],
  }, objects: { 'portraits/art.png': source } })
})
describe('collection Foyer image delivery', () => {
  it('supplies the new image URL to the shared gallery/detail artwork reader', async () => {
    const res = await statusGET(request as any, context)
    const body = await res.json()
    expect(body.items[0].previewUrl).toBe('/api/v1/portfolios/p/art/art')
    expect(body.items[0].unlocked).toBe(false)
  })
  it('returns the exact Foyer image for existing locked art, without storage writes', async () => {
    const res = await GET(request, context)
    const expected = await sharp(Buffer.from(await bakeFoyerWatermark(source.toString('base64')), 'base64'))
      .toColourspace('srgb').jpeg({ quality: 82, progressive: true, mozjpeg: true }).toBuffer()
    expect(res.status).toBe(200)
    expect(Buffer.from(await res.arrayBuffer())).toEqual(expected)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(h.fake.calls.uploads).toEqual([])
    expect(h.fake.objects.get('portraits/art.png')).toEqual(source)
    expect(h.fake.tables.preview_ledger[0].unlocked_at).toBeNull()
  })
  it('returns an owned original unchanged', async () => {
    h.fake.tables.preview_ledger[0].unlocked_at = '2026-09-20T00:00:00Z'
    const res = await GET(request, context)
    expect(Buffer.from(await res.arrayBuffer())).toEqual(source)
  })
  it('refuses signed-out requests', async () => {
    h.user = null
    expect((await GET(request, context)).status).toBe(401)
  })
  it('refuses another owner', async () => {
    h.user.id = 'other'
    expect((await GET(request, context)).status).toBe(404)
  })
  it('refuses a preview outside the named portfolio', async () => {
    h.fake.tables.portfolio_items[0].portfolio_id = 'other'
    expect((await GET(request, context)).status).toBe(404)
  })
  it('fails closed if the watermark source is unreadable', async () => {
    h.fake.objects.set('portraits/art.png', Buffer.from('invalid'))
    const res = await GET(request, context)
    expect(res.status).toBe(503)
    expect((await res.arrayBuffer()).byteLength).toBe(0)
  })
})
