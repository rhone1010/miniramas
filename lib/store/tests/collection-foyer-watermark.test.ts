import { afterEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { fakeSupabase } from './helpers/fake-supabase'

const h = vi.hoisted(() => ({ fake: null as any }))
vi.mock('@/lib/supabase', () => ({ get supabaseAdmin() { return h.fake.sb }, supabase: {} }))
vi.mock('@/lib/store/stripe', () => ({ getAppUrl: () => 'https://example.test' }))

import { renderOnePortfolioItem } from '../portfolio-render'
import { bakeFoyerWatermark } from '@/lib/v1/foyer/foyer-watermark'
import { LOCKED_PREVIEW_QUALITY } from '../preview'

afterEach(() => vi.unstubAllGlobals())

describe('staged collection uses the exact Foyer watermark', () => {
  it.each(['preview', 'purchased'])('preserves %s entitlement and clean master', async delivery => {
    const source = await sharp({ create: {
      width: 390, height: 520, channels: 3, background: '#808080',
    } }).jpeg().toBuffer()
    h.fake = fakeSupabase({ tables: {
      portfolio_items: [{ id: 'item-1', portfolio_id: 'pf-1', slot: 0,
        preset: 'bronze', status: 'rendering', attempts: 1 }],
      portfolios: [{ id: 'pf-1', series: 'portraits', source_image: 'SRC', delivery }],
    } })
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200,
      json: async () => ({ result: { ok: true, image_b64: source.toString('base64') } }),
    }))
    await renderOnePortfolioItem('item-1')
    expect(h.fake.row('portfolio_items', 'item-1').status).toBe('done')
    const ledger = h.fake.tables.preview_ledger[0]
    expect(Boolean(ledger.unlocked_at)).toBe(delivery === 'purchased')
    expect(h.fake.objects.get(ledger.storage_path)).toEqual(source)
    const expected = await sharp(Buffer.from(
      await bakeFoyerWatermark(source.toString('base64')), 'base64',
    )).toColourspace('srgb').jpeg({ quality: LOCKED_PREVIEW_QUALITY, progressive: true, mozjpeg: true }).toBuffer()
    expect(h.fake.objects.get(`locked/portraits/${ledger.id}.jpg`)).toEqual(expected)
  })
})
