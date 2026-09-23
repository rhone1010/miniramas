import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'

const h = vi.hoisted(() => ({ client: vi.fn(), cookies: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient: h.client }))
vi.mock('next/headers', () => ({ cookies: h.cookies }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: {} }))
import { GET } from '@/app/tester/route'

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })
describe('existing tester capability and Pets resume', () => {
  it('is absent in Production, including the capability request', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    const r = await GET(new NextRequest('https://example.test/tester?status=1'))
    expect(r.status).toBe(404)
    expect(h.client).not.toHaveBeenCalled()
  })
  it('reports configured Preview capability without identity creation or key disclosure', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('TESTER_ACCESS_KEY', 'test-only-key')
    const r = await GET(new NextRequest('https://example.test/tester?status=1'))
    expect(await r.json()).toEqual({ available: true })
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(h.client).not.toHaveBeenCalled()
    expect(h.cookies).not.toHaveBeenCalled()
  })
  it('retains the key guard on actual tester authentication', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('TESTER_ACCESS_KEY', 'test-only-key')
    expect((await GET(new NextRequest('https://example.test/tester?k=wrong'))).status).toBe(404)
    expect(h.client).not.toHaveBeenCalled()
  })
  it('preserves existing resume only for the disabled Preview email response', () => {
    const page = readFileSync('public/pets.html', 'utf8')
    expect(page).toContain("if (!d || d.reason !== 'preview_email_disabled') clearResume();")
    expect(page).toContain('if (d && d.available) saveResume();')
    expect(page).toContain('if (ME){ showReview(); return; }')
    expect(page).not.toContain('TESTER_ACCESS_KEY')
  })
})
