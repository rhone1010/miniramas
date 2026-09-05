#!/usr/bin/env node
// test-checkout-e2e.mjs — real Stripe checkout test via dev server
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnv() {
  const lines = readFileSync(resolve(root, '.env.local'), 'utf8').replace(/\r/g, '').split('\n')
  for (const line of lines) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const AUTH_URL = `${SUPABASE_URL}/auth/v1`
const DEV_BASE = 'http://localhost:3000'
const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1]

async function getTestSession() {
  const testEmail = 'cc-feedback-test@litenco.test'
  const testPass = 'TestFeedback2026!'
  const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify({ email: testEmail, password: testPass }),
  })
  if (!res.ok) { console.error('Sign in failed'); process.exit(1) }
  return res.json()
}

function buildCookie(session) {
  const cookieName = `sb-${PROJECT_REF}-auth-token`
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + session.expires_in,
    expires_in: session.expires_in,
    token_type: 'bearer',
    type: 'access',
    user: session.user,
  })
  return `${cookieName}=base64-${Buffer.from(payload).toString('base64url')}`
}

async function main() {
  console.log('=== Checkout E2E Test ===\n')

  const session = await getTestSession()
  console.log(`User: ${session.user.email}`)
  const cookie = buildCookie(session)

  // ── Test: Portfolio checkout (4 effects) ───────────────────────
  console.log('\n--- Portfolio checkout (4 effects, $4.99) ---')
  const res = await fetch(`${DEV_BASE}/api/v1/portfolios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
    body: JSON.stringify({
      series: 'portraits',
      selectedEffectIds: ['elizabethan', 'renaissance', 'deco_twenties', 'victorian'],
      sourceImageRef: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA',
      returnUrl: 'http://localhost:3000/discovery-consolidated-draft.html',
      clientPriceUsd: 4.99,
    }),
  })

  const data = await res.json()
  console.log(`  Status: ${res.status}`)
  console.log(`  Response:`, JSON.stringify(data, null, 2))

  if (data.url) {
    console.log(`  Stripe URL: ${data.url.slice(0, 100)}...`)
    console.log(`  Portfolio ID: ${data.portfolioId}`)
    // Verify it's a real Stripe checkout URL
    console.log(`  Is Stripe checkout: ${data.url.startsWith('https://checkout.stripe.com/')}`)
  } else if (data.error) {
    console.log(`  Error: ${data.error}`)
    if (data.message) console.log(`  Message: ${data.message}`)
  }

  // ── Test: Single checkout (1 effect) ───────────────────────────
  console.log('\n--- Single checkout (1 effect) ---')
  const res2 = await fetch(`${DEV_BASE}/api/v1/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
    body: JSON.stringify({
      skuId: 'single',
      style: 'elizabethan',
      variant: 'elizabethan',
      sourceImageRef: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA',
    }),
  })

  const data2 = await res2.json()
  console.log(`  Status: ${res2.status}`)
  console.log(`  Response:`, JSON.stringify(data2, null, 2))

  if (data2.checkoutUrl) {
    console.log(`  Stripe URL: ${data2.checkoutUrl.slice(0, 100)}...`)
    console.log(`  Is Stripe checkout: ${data2.checkoutUrl.startsWith('https://checkout.stripe.com/')}`)
  } else if (data2.error) {
    console.log(`  Error: ${data2.error}`)
  }

  // ── Test: Price mismatch rejection ─────────────────────────────
  console.log('\n--- Price mismatch test ---')
  const res3 = await fetch(`${DEV_BASE}/api/v1/portfolios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
    body: JSON.stringify({
      series: 'portraits',
      selectedEffectIds: ['elizabethan', 'renaissance', 'deco_twenties', 'victorian'],
      sourceImageRef: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA',
      returnUrl: 'http://localhost:3000/',
      clientPriceUsd: 9.99, // wrong price
    }),
  })
  const data3 = await res3.json()
  console.log(`  Status: ${res3.status} (expected: 400)`)
  console.log(`  Error: ${data3.error}`)
  console.log(`  Price mismatch detected: ${res3.status === 400 && data3.error?.startsWith('price_mismatch')}`)

  // ── Test: Auth required (no cookie) ────────────────────────────
  console.log('\n--- No-auth test ---')
  const res4 = await fetch(`${DEV_BASE}/api/v1/portfolios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      series: 'portraits',
      selectedEffectIds: ['elizabethan', 'renaissance', 'deco_twenties', 'victorian'],
      sourceImageRef: 'test',
      returnUrl: 'http://localhost:3000/',
      clientPriceUsd: 4.99,
    }),
  })
  const data4 = await res4.json()
  console.log(`  Status: ${res4.status} (expected: 401)`)
  console.log(`  Auth required: ${res4.status === 401}`)

  console.log('\n=== Done ===')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
