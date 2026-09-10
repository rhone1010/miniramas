// lib/store/tests/discovery-internal-auth.test.ts
//
// Discovery's server-side portfolio render presents the internal secret to
// /portraits/generate, which now refuses clean output to anyone else. Nothing
// else about the request changes.
//
// The REAL renderOnePortfolioItem; the database and the network are faked.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSupabase } from './helpers/fake-supabase'

const h = vi.hoisted(() => ({ fake: null as any, fetches: [] as Array<{ url: string; init: any }> }))
vi.mock('@/lib/supabase', () => ({ get supabaseAdmin() { return h.fake.sb }, supabase: {} }))
vi.mock('@/lib/store/stripe', () => ({ getAppUrl: () => 'https://litenco.com' }))

import { renderOnePortfolioItem } from '@/lib/store/portfolio-render'

beforeEach(() => {
  process.env.CRON_SECRET = 'cron-secret-for-tests'
  h.fetches = []
  h.fake = fakeSupabase({ tables: {
    portfolio_items: [{ id: 'item-1', portfolio_id: 'pf-1', slot: 0, preset: 'bronze', status: 'rendering', attempts: 3 }],
    portfolios: [{ id: 'pf-1', series: 'portraits', source_image: 'SRC', delivery: 'preview', pose: null, framing: null, subject: null, aspect_ratio: null }],
  } })
  // generate answers not-ok, so the render stops at its failure path.
  vi.stubGlobal('fetch', async (url: string, init: any) => {
    h.fetches.push({ url, init })
    return { ok: true, status: 200, json: async () => ({ result: { ok: false, fatal_error: 'stop here' } }) }
  })
})

describe('Discovery portfolio render -> /portraits/generate', () => {
  it('sends Authorization: Bearer $CRON_SECRET', async () => {
    await renderOnePortfolioItem('item-1')
    const gen = h.fetches.find((f) => f.url.endsWith('/api/v1/portraits/generate'))!
    expect(gen.init.headers.Authorization).toBe('Bearer cron-secret-for-tests')
    expect(gen.init.headers['Content-Type']).toBe('application/json')
  })

  it('and the body it sends is unchanged: bust / close_up for a preview bundle, no grant', async () => {
    await renderOnePortfolioItem('item-1')
    const body = JSON.parse(h.fetches.find((f) => f.url.endsWith('/api/v1/portraits/generate'))!.init.body)
    expect(body).toEqual({ source_image_b64: 'SRC', style_id: body.style_id, preset_id: 'bronze', framing: 'bust', scale: 'close_up' })
    expect(body.grant_id).toBeUndefined()
  })
})
