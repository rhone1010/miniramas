import { describe, it, expect } from 'vitest'
import { checkLaunchEnv } from './launch-env'

const GOOD = { STRIPE_SECRET_KEY: 'sk_live_x', NEXT_PUBLIC_STRIPE_PUBLIC_KEY: 'pk_live_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k', REPLICATE_API_TOKEN: 't', OPENAI_API_KEY: 'o', STABILITY_API_KEY: 's',
  CRON_SECRET: '0123456789abcdef0123', APP_URL: 'https://litenco.com', PRODIGI_ENV: 'sandbox', PRODIGI_KEY_SANDBOX: 'p', RESEND_API_KEY: 'r', SUPPORT_TO_EMAIL: 'help@litenco.com' }
const names = (e: Record<string, string | undefined>, level = 'error', t: 'production' | 'preview' = 'production') => checkLaunchEnv(e, t).issues.filter(i => i.level === level).map(i => i.name).sort()

describe('the launch environment check', () => {
  it('a complete Production environment has no errors, and the sandbox/test-mode notes are information', () => {
    expect(checkLaunchEnv(GOOD).ok).toBe(true); expect(names(GOOD)).toEqual([])
    const test = { ...GOOD, STRIPE_SECRET_KEY: 'sk_test_x', NEXT_PUBLIC_STRIPE_PUBLIC_KEY: 'pk_test_x' }
    expect(names(test, 'info')).toContain('STRIPE_SECRET_KEY'); expect(checkLaunchEnv(test).ok).toBe(true)
  })
  it('reports exactly what is missing or wrong, by name', () => {
    expect(names({})).toEqual(['APP_URL', 'NEXT_PUBLIC_STRIPE_PUBLIC_KEY', 'OPENAI_API_KEY', 'CRON_SECRET', 'REPLICATE_API_TOKEN', 'RESEND_API_KEY', 'PRODIGI_KEY_SANDBOX', 'STABILITY_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL', 'SUPPORT_TO_EMAIL'].sort())
    expect(names({ ...GOOD, APP_URL: 'http://localhost:3000' })).toEqual(['APP_URL']); expect(names({ ...GOOD, APP_URL: 'https://preview.vercel.app' })).toEqual(['APP_URL'])
    expect(names({ ...GOOD, NEXT_PUBLIC_STRIPE_PUBLIC_KEY: 'pk_test_x' })).toEqual(['NEXT_PUBLIC_STRIPE_PUBLIC_KEY'])             // mixed live/test
    expect(names({ ...GOOD, STRIPE_WEBHOOK_SECRET: 'sk_oops' })).toEqual(['STRIPE_WEBHOOK_SECRET']); expect(names({ ...GOOD, SUPPORT_TO_EMAIL: 'nobody' })).toEqual(['SUPPORT_TO_EMAIL'])
  })
  it('the gate and scene switches, the test-only tools directory and live manufacturing are called out', () => {
    expect(names({ ...GOOD, GIFT_REQUIRE_APPROVED_SCENE: '0' })).toEqual(['GIFT_REQUIRE_APPROVED_SCENE']); expect(names({ ...GOOD, GIFT_REQUIRE_APPROVED_SCENE: '1' })).toEqual([])
    expect(names({ ...GOOD, GIFT_SCENE_MOCKUPS: '0' })).toEqual(['GIFT_SCENE_MOCKUPS']); expect(names({ ...GOOD, GIFT_MOCKUP_TOOLS_DIR: '/tmp/x' })).toEqual(['GIFT_MOCKUP_TOOLS_DIR'])
    expect(names({ ...GOOD, PRODIGI_ENV: 'live', PRODIGI_KEY_LIVE: 'k' }, 'warn')).toEqual(['PRODIGI_ENV']); expect(names({ ...GOOD, PRODIGI_ENV: 'live' })).toEqual(['PRODIGI_KEY_LIVE'])
    expect(names({ ...GOOD, PRODIGI_ENV: 'bogus' })).toContain('PRODIGI_ENV'); expect(names({ ...GOOD, GIFT_COMPOSITIONS_BEFORE_PAYMENT: '1' }, 'warn')).toEqual(['GIFT_COMPOSITIONS_BEFORE_PAYMENT'])
  })
  it('Preview must stay in test mode', () => {
    expect(names({ ...GOOD, APP_URL: 'https://x.vercel.app' }, 'error', 'preview')).toEqual(['STRIPE_SECRET_KEY'])
    expect(names({ ...GOOD, STRIPE_SECRET_KEY: 'sk_test_x', NEXT_PUBLIC_STRIPE_PUBLIC_KEY: 'pk_test_x', APP_URL: 'https://x.vercel.app' }, 'error', 'preview')).toEqual([])
  })
  it('never echoes a value', () => {
    const out = JSON.stringify(checkLaunchEnv({ ...GOOD, STRIPE_SECRET_KEY: 'sk_live_SUPERSECRETVALUE', CRON_SECRET: 'tiny' }).issues)
    expect(out).not.toContain('SUPERSECRETVALUE'); expect(out).not.toContain('"tiny"')
  })
})
