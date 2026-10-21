// The environment a Gift Wizard Production deployment needs, as one pure check (no I/O, never returns a value, only names and verdicts). scripts/check-launch-env.ts feeds it a
// pulled environment file; docs/GOVERNANCE/GIFT-LAUNCH-ENV-AND-STRIPE-2026-10-21.md is the human version. Names come from the code (grep of process.env in lib/v1/gift, lib/v1/print, the webhook routes).

export interface EnvIssue { name: string; level: 'error' | 'warn' | 'info'; problem: string }
const has = (v: string | undefined) => typeof v === 'string' && v.trim().length > 0
const host = (v: string | undefined) => { try { return new URL(String(v)).host } catch { return '' } }

export function checkLaunchEnv(env: Record<string, string | undefined>, target: 'production' | 'preview' = 'production'): { issues: EnvIssue[]; ok: boolean } {
  const issues: EnvIssue[] = []
  const add = (name: string, level: EnvIssue['level'], problem: string) => issues.push({ name, level, problem })
  const required = (name: string, why: string) => { if (!has(env[name])) add(name, 'error', `missing: ${why}`) }

  // Stripe: mode must be consistent across the keys, and the webhook secret must be a signing secret
  const sk = env.STRIPE_SECRET_KEY, pk = env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY
  if (!has(sk)) add('STRIPE_SECRET_KEY', 'error', 'missing: checkout, payment verification and refunds')
  else if (!/^sk_(live|test)_/.test(sk!)) add('STRIPE_SECRET_KEY', 'error', 'not a Stripe secret key (expected sk_live_ or sk_test_)')
  if (!has(pk)) add('NEXT_PUBLIC_STRIPE_PUBLIC_KEY', 'error', 'missing: embedded checkout')
  else if (!/^pk_(live|test)_/.test(pk!)) add('NEXT_PUBLIC_STRIPE_PUBLIC_KEY', 'error', 'not a Stripe publishable key')
  if (has(sk) && has(pk) && /^sk_(live|test)_/.test(sk!) && /^pk_(live|test)_/.test(pk!) && sk!.slice(3, 7) !== pk!.slice(3, 7)) add('NEXT_PUBLIC_STRIPE_PUBLIC_KEY', 'error', 'mode differs from STRIPE_SECRET_KEY (one is live, the other test)')
  if (has(sk) && sk!.startsWith('sk_test_')) add('STRIPE_SECRET_KEY', 'info', target === 'production' ? 'TEST mode: no real payment can be taken (correct until live payments are authorized)' : 'test mode (required in Preview)')
  if (has(sk) && sk!.startsWith('sk_live_') && target === 'preview') add('STRIPE_SECRET_KEY', 'error', 'live key in Preview: Preview must stay in test mode')
  if (!has(env.STRIPE_WEBHOOK_SECRET)) add('STRIPE_WEBHOOK_SECRET', 'error', 'missing: the main webhook (/api/v1/webhooks/stripe) rejects every event with 503')
  else if (!/^whsec_/.test(env.STRIPE_WEBHOOK_SECRET!)) add('STRIPE_WEBHOOK_SECRET', 'error', 'not a webhook signing secret (expected whsec_...)')

  // Database
  if (!has(env.SUPABASE_URL) && !has(env.NEXT_PUBLIC_SUPABASE_URL)) add('SUPABASE_URL', 'error', 'missing (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL)')
  required('SUPABASE_SERVICE_ROLE_KEY', 'every server-side Gift read and write')

  // Providers
  required('REPLICATE_API_TOKEN', 'NB2.1 generation and the prunaai/p-image-upscale print upscaler')
  required('OPENAI_API_KEY', 'photo age and people-count gate, likeness scoring and print QA')
  required('STABILITY_API_KEY', 'bounded background extension of compositions')
  if (!has(env.CRON_SECRET)) add('CRON_SECRET', 'error', 'missing: the app authenticates its own internal generate calls and the cron poller with it')
  else if (env.CRON_SECRET!.length < 16) add('CRON_SECRET', 'warn', 'shorter than 16 characters')

  // The app calls its own generate routes at APP_URL: a localhost or wrong host breaks every generation ("fetch failed")
  const app = env.APP_URL || env.NEXT_PUBLIC_APP_URL
  if (!has(app)) add('APP_URL', 'error', 'missing (APP_URL or NEXT_PUBLIC_APP_URL): checkout return URLs and the internal generate calls')
  else if (target === 'production' && (!/^https:\/\//.test(app!) || host(app) !== 'litenco.com')) add(env.APP_URL ? 'APP_URL' : 'NEXT_PUBLIC_APP_URL', 'error', `must be https://litenco.com in Production (is ${host(app) || 'not a URL'})`)
  if (target === 'production' && has(env.APP_URL) && has(env.NEXT_PUBLIC_APP_URL) && host(env.APP_URL) !== host(env.NEXT_PUBLIC_APP_URL)) add('NEXT_PUBLIC_APP_URL', 'warn', 'differs from APP_URL')

  // Manufacturing: sandbox until the owner authorizes live
  const pe = (env.PRODIGI_ENV || 'sandbox').toLowerCase()
  if (!['sandbox', 'live'].includes(pe)) add('PRODIGI_ENV', 'error', "must be 'sandbox' or 'live'")
  else if (pe === 'live') add('PRODIGI_ENV', 'warn', "LIVE: real orders will be manufactured and billed; needs the owner's explicit authorization")
  else add('PRODIGI_ENV', 'info', 'sandbox: nothing is manufactured for real (correct for a controlled launch)')
  // (The Prodigi key names are checked by scripts/check-launch-env.ts: a structural test forbids every module under lib/ from naming them, so only prodigi-client.ts does.)
  if (target === 'preview' && pe === 'live') add('PRODIGI_ENV', 'error', 'live is blocked in Preview')

  // Mail and support
  required('RESEND_API_KEY', 'order, refund and remedy emails')
  if (!has(env.SUPPORT_TO_EMAIL)) add('SUPPORT_TO_EMAIL', 'error', 'missing: the support inbox and delayed-order studio notices go nowhere')
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env.SUPPORT_TO_EMAIL!)) add('SUPPORT_TO_EMAIL', 'error', 'not an email address')

  // Gift behavior flags
  if (env.GIFT_REQUIRE_APPROVED_SCENE === '0') add('GIFT_REQUIRE_APPROVED_SCENE', 'error', "'0' switches OFF the approved-scene payment gate: unsupported configurations could be paid for; remove it")
  if (env.GIFT_SCENE_MOCKUPS === '0') add('GIFT_SCENE_MOCKUPS', 'error', "'0' is the scene kill switch: no product could be shown or approved; remove it")
  if (has(env.GIFT_MOCKUP_TOOLS_DIR)) add('GIFT_MOCKUP_TOOLS_DIR', 'error', 'a test-only override of the scene files; must be unset')
  if (env.GIFT_COMPOSITIONS_BEFORE_PAYMENT === '1') add('GIFT_COMPOSITIONS_BEFORE_PAYMENT', 'warn', "'1' composes before payment (an optional draft flow); the approved journey composes after checkout")
  if (has(env.VERCEL_AUTOMATION_BYPASS_SECRET) && target === 'production') add('VERCEL_AUTOMATION_BYPASS_SECRET', 'info', 'only used on Preview self-calls; harmless in Production')
  if (has(env.STRIPE_PRINT_WEBHOOK_SECRET)) add('STRIPE_PRINT_WEBHOOK_SECRET', 'info', 'only for the separate Print Shop endpoint /api/v1/print/webhook (not subscribed today)')
  if (!has(env.PRUNA_API_KEY)) add('PRUNA_API_KEY', 'info', 'only needed if the upscaler provider is switched from replicate to Pruna direct')

  return { issues, ok: !issues.some(i => i.level === 'error') }
}
