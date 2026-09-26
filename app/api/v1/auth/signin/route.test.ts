import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const h = vi.hoisted(() => ({ oauth: vi.fn(), otp: vi.fn(), set: vi.fn(), options: null as any }))
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: h.set }) }))
vi.mock('@supabase/ssr', () => ({ createServerClient: (_url: string, _key: string, options: any) => {
  h.options = options
  return { auth: { signInWithOAuth: h.oauth, signInWithOtp: h.otp } }
} }))
import { POST } from './route'
const post = (body: unknown) => POST(new NextRequest('https://preview.example/api/v1/auth/signin', { method: 'POST', body: JSON.stringify(body) }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VERCEL_ENV', 'preview')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://auth.example')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-placeholder')
  h.oauth.mockResolvedValue({ data: { url: 'https://auth.example/authorize' }, error: null })
  h.otp.mockResolvedValue({ error: null })
})
it.each(['/discovery', '/pets/discovery', '/discovery?auth_collection=1', '/pets/discovery?auth_collection=1'])('preserves Google return destination %s using existing callback and cookie adapter', async next => {
  expect(await (await post({ provider: 'google', next })).json()).toEqual({ ok: true, url: 'https://auth.example/authorize' })
  expect(h.oauth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'https://preview.example/auth/callback?next=' + encodeURIComponent(next), skipBrowserRedirect: true } })
  h.options.cookies.setAll([{ name: 'pkce', value: 'fixture', options: { httpOnly: true } }])
  expect(h.set).toHaveBeenCalledWith('pkce', 'fixture', { httpOnly: true })
  expect(h.otp).not.toHaveBeenCalled()
})
it('preserves email magic-link behavior', async () => {
  expect(await (await post({ email: 'customer@example.com', next: '/pets/discovery' })).json()).toEqual({ ok: true })
  expect(h.otp).toHaveBeenCalledWith({ email: 'customer@example.com', options: { emailRedirectTo: 'https://preview.example/auth/callback?next=%2Fpets%2Fdiscovery' } })
  expect(h.oauth).not.toHaveBeenCalled()
})
it('rejects invalid email and keeps external return URLs off the callback', async () => {
  expect((await post({ email: 'invalid' })).status).toBe(400)
  await post({ provider: 'google', next: '//external.example' })
  expect(h.oauth.mock.calls[0][0].options.redirectTo).toBe('https://preview.example/auth/callback?next=%2Fdiscovery')
})
it('does not return a provider URL after an OAuth error', async () => {
  h.oauth.mockResolvedValue({ data: { url: null }, error: new Error('provider failed') })
  expect((await post({ provider: 'google' })).status).toBe(500)
})
