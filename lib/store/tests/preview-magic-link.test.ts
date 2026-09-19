import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const h = vi.hoisted(() => ({ otp: vi.fn(), client: vi.fn(), cookies: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient: h.client }))
vi.mock('@supabase/supabase-js', () => ({ createClient: h.client }))
vi.mock('next/headers', () => ({ cookies: h.cookies }))
import { POST as signin } from '../../../app/api/v1/auth/signin/route'
import { POST as invite } from '../../../app/api/v1/invite/route'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.invalid')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test')
  vi.stubEnv('SUPABASE_URL', 'https://test.invalid')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test')
  vi.stubEnv('LITEN_ACCESS_CODE', '')
  h.otp.mockResolvedValue({ error: null })
  h.cookies.mockResolvedValue({ getAll: () => [], set: vi.fn() })
  const query: any = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { email: 'review@example.com' } }) }
  h.client.mockReturnValue({ auth: { signInWithOtp: h.otp }, from: () => query })
})
afterEach(() => vi.unstubAllEnvs())
const request = (path: string) => new NextRequest('https://review.example.com' + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'review@example.com', next: '/discovery-consolidated-draft.html' }),
})
describe.each([['signin', signin], ['invite', invite]] as const)('%s Preview email guard', (name, handler) => {
  it.each(['preview', 'development', ''])('blocks %s before constructing an auth client or changing cookies', async env => {
    vi.stubEnv('VERCEL_ENV', env)
    const response = await handler(request('/api/v1/' + name))
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ ok: false, reason: 'preview_email_disabled', message: 'Sign-in email disabled during Preview review.' })
    expect(h.otp).not.toHaveBeenCalled()
    expect(h.client).not.toHaveBeenCalled()
    expect(h.cookies).not.toHaveBeenCalled()
  })
  it('retains the Production magic-link path', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    const response = await handler(request('/api/v1/' + name))
    expect(response.status).toBe(200)
    expect(h.otp).toHaveBeenCalledTimes(1)
    expect(h.otp).toHaveBeenCalledWith(expect.objectContaining({ email: 'review@example.com', options: { emailRedirectTo: expect.stringContaining('/auth/callback?next=') } }))
  })
})
