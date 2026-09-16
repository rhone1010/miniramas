// lib/store/tests/internal-fetch.test.ts
//
// Where a self-call goes, and what it carries. The 4-image purchase of
// 2026-09-16 failed because all three self-calls used getAppUrl(), which on
// Preview names an old, SSO-protected deployment: four dispatches refused at
// the edge in 60ms, nothing claimed, the whole portfolio left to the cron.
//
// These run the shipped internalBaseUrl/internalHeaders against a controlled
// process.env. The rule being held: Production is untouched, Preview talks to
// the deployment actually running, and nothing outside the environment can
// move the target.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@/lib/store/stripe', () => ({
  getAppUrl: () => {
    const u = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL
    if (!u) throw new Error('APP_URL is not set')
    return u.replace(/\/$/, '')
  },
}))

import { internalBaseUrl, internalHeaders } from '@/lib/store/internal-fetch'

const KEYS = ['VERCEL_ENV', 'VERCEL_URL', 'APP_URL', 'NEXT_PUBLIC_APP_URL', 'VERCEL_AUTOMATION_BYPASS_SECRET'] as const
let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  saved = {}
  for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k] }
})
afterEach(() => {
  for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
})

describe('where a self-call goes', () => {
  it('on Production, the custom domain APP_URL — exactly as before', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.APP_URL = 'https://litenco.com'
    process.env.VERCEL_URL = 'miniramas-abc123-litenco.vercel.app'
    expect(internalBaseUrl()).toBe('https://litenco.com')
  })

  it('on Preview, the deployment running the code — not APP_URL', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_URL = 'miniramas-1poszsdfx-litenco.vercel.app'
    process.env.APP_URL = 'https://miniramas-git-feature-store-commerce-litenco.vercel.app'
    expect(internalBaseUrl()).toBe('https://miniramas-1poszsdfx-litenco.vercel.app')
  })

  it('locally, APP_URL — unchanged', () => {
    process.env.APP_URL = 'http://localhost:3000'
    expect(internalBaseUrl()).toBe('http://localhost:3000')
  })

  it('a Preview with no VERCEL_URL falls back rather than building a broken URL', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.APP_URL = 'https://litenco.com'
    expect(internalBaseUrl()).toBe('https://litenco.com')
  })

  it('a trailing slash on APP_URL is still trimmed', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.APP_URL = 'https://litenco.com/'
    expect(internalBaseUrl()).toBe('https://litenco.com')
  })
})

describe('what a self-call carries', () => {
  it('Preview presents the protection bypass', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_URL = 'miniramas-1poszsdfx-litenco.vercel.app'
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 's3cr3t'
    expect(internalHeaders()['x-vercel-protection-bypass']).toBe('s3cr3t')
  })

  it('Production sends no bypass — its target is not behind the wall', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.APP_URL = 'https://litenco.com'
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 's3cr3t'
    expect(internalHeaders()).not.toHaveProperty('x-vercel-protection-bypass')
  })

  it('no bypass secret means no header, not an empty one', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_URL = 'miniramas-1poszsdfx-litenco.vercel.app'
    expect(internalHeaders()).not.toHaveProperty('x-vercel-protection-bypass')
  })

  it('the caller\'s own headers survive — Authorization is never dropped', () => {
    process.env.VERCEL_ENV = 'preview'
    process.env.VERCEL_URL = 'miniramas-1poszsdfx-litenco.vercel.app'
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 's3cr3t'
    const h = internalHeaders({ 'Content-Type': 'application/json', Authorization: 'Bearer cron' })
    expect(h).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer cron',
      'x-vercel-protection-bypass': 's3cr3t',
    })
  })

  it('locally, nothing is added', () => {
    process.env.APP_URL = 'http://localhost:3000'
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = 's3cr3t'
    expect(internalHeaders({ 'Content-Type': 'application/json' })).toEqual({ 'Content-Type': 'application/json' })
  })
})

describe('the target comes from the environment and nowhere else', () => {
  it('the module exports no way to pass a URL in', () => {
    expect(internalBaseUrl.length).toBe(0)          // takes no argument at all
    // internalHeaders takes headers to merge, never a target
    const h = internalHeaders({ 'x-vercel-protection-bypass': 'attacker' } as Record<string, string>)
    process.env.VERCEL_ENV = 'production'
    process.env.APP_URL = 'https://litenco.com'
    // whatever a caller passes, the URL is still the environment's
    expect(internalBaseUrl()).toBe('https://litenco.com')
    expect(typeof h).toBe('object')
  })
})
