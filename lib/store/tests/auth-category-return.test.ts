import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({ otp: vi.fn(), exchange: vi.fn(), verify: vi.fn(), set: vi.fn() }))
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: {
  signInWithOtp: h.otp, exchangeCodeForSession: h.exchange, verifyOtp: h.verify,
} }) }))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: h.set }) }))
import { POST } from '@/app/api/v1/auth/signin/route'
import { GET as callback } from '@/app/auth/callback/route'
import { GET as confirm } from '@/app/auth/confirm/route'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VERCEL_ENV', 'production')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://auth.test')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-key')
  h.otp.mockResolvedValue({ error: null })
  h.exchange.mockResolvedValue({ error: null })
  h.verify.mockResolvedValue({ error: null })
})
afterEach(() => vi.unstubAllEnvs())

describe.each(['/pets/discovery', '/discovery', '/groups', '/halloween'])('sign-in return to %s', next => {
  it('carries the originating category from email request through PKCE callback', async () => {
    const response = await POST(new NextRequest('https://litenco.com/api/v1/auth/signin', {
      method: 'POST', body: JSON.stringify({ email: 'customer@example.test', next }),
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(response.status).toBe(200)
    const destination = new URL(h.otp.mock.calls[0][0].options.emailRedirectTo)
    expect(destination.origin).toBe('https://litenco.com')
    expect(destination.searchParams.get('next')).toBe(next)
    destination.searchParams.set('code', 'test-code')
    const result = await callback(new NextRequest(destination))
    expect(result.headers.get('location')).toBe('https://litenco.com' + next)
  })
  it('preserves the category through the existing token-hash confirmation route', async () => {
    const url = new URL('https://litenco.com/auth/confirm')
    url.searchParams.set('token_hash', 'test-hash')
    url.searchParams.set('type', 'email')
    url.searchParams.set('next', next)
    const response = await confirm(new NextRequest(url))
    expect(response.headers.get('location')).toBe('https://litenco.com' + next)
    expect(h.verify).toHaveBeenCalledWith({ token_hash: 'test-hash', type: 'email' })
  })
})
