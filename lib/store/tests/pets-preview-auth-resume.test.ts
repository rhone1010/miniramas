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
  it.each(['production', 'development', ''])('rejects automation outside Preview: %s', async (environment) => {
    vi.stubEnv('VERCEL_ENV', environment)
    vi.stubEnv('CODEX_TESTER_ACCESS_KEY', 'automation-test-key')
    const r = await GET(new NextRequest('https://example.test/tester', { headers: { 'x-codex-tester-access-key': 'automation-test-key' } }))
    expect(r.status).toBe(404)
    expect(h.client).not.toHaveBeenCalled()
  })
  it.each(['', 'wrong', 'automation-test-key-extra'])('rejects missing or incorrect automation credentials: %s', async (key) => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('TESTER_ACCESS_KEY', 'legacy-test-key')
    vi.stubEnv('CODEX_TESTER_ACCESS_KEY', 'automation-test-key')
    const r = await GET(new NextRequest('https://example.test/tester', { headers: { 'x-codex-tester-access-key': key } }))
    expect(r.status).toBe(404)
    expect(h.client).not.toHaveBeenCalled()
  })
  it('does not accept the automation key in the query string', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('TESTER_ACCESS_KEY', 'legacy-test-key')
    vi.stubEnv('CODEX_TESTER_ACCESS_KEY', 'automation-test-key')
    expect((await GET(new NextRequest('https://example.test/tester?k=automation-test-key'))).status).toBe(404)
    expect(h.client).not.toHaveBeenCalled()
  })
  it.each(['legacy', 'automation'])('uses the unchanged session path for %s authorization', async (mode) => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('TESTER_ACCESS_KEY', 'legacy-test-key')
    vi.stubEnv('CODEX_TESTER_ACCESS_KEY', 'automation-test-key')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon')
    h.cookies.mockResolvedValue({ getAll: () => [] })
    h.client.mockReturnValue({ auth: { getUser: async () => ({ data: { user: { email: 'tester+fixture@preview.litenco.test' } } }) } })
    const r = await GET(new NextRequest('https://example.test/tester' + (mode === 'legacy' ? '?k=legacy-test-key' : ''), {
      headers: mode === 'automation' ? { 'x-codex-tester-access-key': 'automation-test-key' } : {},
    }))
    expect(r.status).toBe(307)
    expect(r.headers.get('location')).toBe('https://example.test/')
    expect(h.client).toHaveBeenCalledOnce()
  })
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
