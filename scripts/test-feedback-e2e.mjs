#!/usr/bin/env node
// test-feedback-e2e.mjs — end-to-end feedback endpoint tests
// Run: node scripts/test-feedback-e2e.mjs
//
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// NEXT_PUBLIC_SUPABASE_ANON_KEY, GITHUB_TOKEN.
// Also requires a running Next.js dev server on port 3000.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// ── Load .env.local ──────────────────────────────────────────────
function loadEnv() {
  const lines = readFileSync(resolve(root, '.env.local'), 'utf8').replace(/\r/g, '').split('\n')
  for (const line of lines) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const GH_TOKEN     = process.env.GITHUB_TOKEN

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('Missing env vars')
  console.error('  SUPABASE_URL:', !!SUPABASE_URL)
  console.error('  SERVICE_KEY:', !!SERVICE_KEY)
  console.error('  ANON_KEY:', !!ANON_KEY)
  process.exit(1)
}

const supaAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const DEV_BASE = 'http://localhost:3000'
const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1]
const AUTH_URL = `${SUPABASE_URL}/auth/v1`

// ── Auth via GoTrue REST API (service role) ─────────────────────
async function getTestSession() {
  const testEmail = 'cc-feedback-test@litenco.test'
  const testPass  = 'TestFeedback2026!'

  // Try sign in first
  let res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({ email: testEmail, password: testPass }),
  })

  if (res.ok) {
    const data = await res.json()
    console.log('  Signed in existing test user')
    return data
  }

  // User exists but password may not match — look up user and set password
  console.log('  Looking up existing user...')
  let usersRes = await fetch(`${AUTH_URL}/admin/users?page=1&per_page=50`, {
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  })
  const usersData = await usersRes.json()
  const users = usersData.users || usersData
  const existing = (Array.isArray(users) ? users : []).find(u => u.email === testEmail)

  if (existing) {
    console.log(`  Found user ${existing.id}, updating password...`)
    await fetch(`${AUTH_URL}/admin/users/${existing.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ password: testPass, email_confirm: true }),
    })
  } else {
    // Create user
    console.log('  Creating test user...')
    res = await fetch(`${AUTH_URL}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPass,
        email_confirm: true,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('  Create user failed:', res.status, err.slice(0, 300))
      process.exit(1)
    }
  }

  console.log('  Signing in...')

  // Now sign in
  res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
    },
    body: JSON.stringify({ email: testEmail, password: testPass }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('  Sign in failed:', res.status, err.slice(0, 300))
    process.exit(1)
  }

  return res.json()
}

function buildCookie(session) {
  const cookieName = `sb-${PROJECT_REF}-auth-token`
  // @supabase/ssr stores session as: base64-<base64url(JSON)>
  const payload = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + session.expires_in,
    expires_in: session.expires_in,
    token_type: 'bearer',
    type: 'access',
    user: session.user,
  })
  const value = 'base64-' + Buffer.from(payload).toString('base64url')
  // Chunking: createChunks uses encodeURIComponent length <= 3180
  const encodedValue = encodeURIComponent(value)
  if (encodedValue.length <= 3180) {
    return `${cookieName}=${value}`
  }
  // Split into chunks by encoded length
  const chunks = []
  let remaining = encodedValue
  let idx = 0
  while (remaining.length > 0) {
    let head = remaining.slice(0, 3180)
    // Avoid splitting a %XX escape
    const lastPct = head.lastIndexOf('%')
    if (lastPct > 3180 - 3) head = head.slice(0, lastPct)
    const decoded = decodeURIComponent(head)
    chunks.push(`${cookieName}.${idx}=${decoded}`)
    remaining = remaining.slice(head.length)
    idx++
  }
  return chunks.join('; ')
}

async function postFeedback(cookie, body) {
  const res = await fetch(`${DEV_BASE}/api/v1/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

async function getRow(id) {
  const { data, error } = await supaAdmin.from('feedback').select('*').eq('id', id).single()
  if (error) console.error('  Row fetch error:', error.message)
  return data
}

async function checkStorage(path) {
  const { data, error } = await supaAdmin.storage.from('feedback-shots').createSignedUrl(path, 60)
  return { exists: !error && !!data?.signedUrl, signedUrl: data?.signedUrl, error: error?.message }
}

async function checkGitHubIssue(number) {
  const res = await fetch(`https://api.github.com/repos/rhone1010/miniramas/issues/${number}`, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${GH_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) return null
  return res.json()
}

// ── Small 1x1 red pixel JPEG as base64 data URL ─────────────────
const TINY_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsM' +
  'DhEQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQU' +
  'FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFAAB' +
  'AAAAAAAAAAAAAAAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q=='

function makeOversizedScreenshot() {
  return 'data:image/jpeg;base64,' + 'A'.repeat(2_100_000)
}

// ── Tests ────────────────────────────────────────────────────────
async function main() {
  console.log('=== Feedback E2E Tests ===\n')

  console.log('Acquiring test session...')
  const session = await getTestSession()
  console.log(`  User: ${session.user.email} (${session.user.id})`)
  const cookie = buildCookie(session)
  console.log(`  Cookie built (${cookie.length} chars)\n`)

  // ── Test 1: Normal submission with screenshot ──────────────────
  console.log('--- Test 1: Normal submission with screenshot ---')
  const r1 = await postFeedback(cookie, {
    kinds: ['broken', 'visual'],
    severity: 1,
    where: 'discovery',
    what: 'E2E test: cards overlap on narrow viewport after selecting 3+ effects',
    expected: 'Cards should stack vertically below 600px',
    context: {
      screen: 'discovery',
      series: 'Portraits',
      count: 3,
      tier: 'Signature',
      slotsOpen: 2,
      hasPhoto: true,
      lastActions: ['select', 'select', 'select'],
      userId: 'cc-test',
      url: 'http://localhost:3000/discovery',
      viewport: '375x812',
    },
    screenshot: TINY_JPEG,
  })
  console.log(`  Status: ${r1.status}`)
  console.log(`  Response:`, JSON.stringify(r1.data))

  if (r1.status === 200 && r1.data?.id) {
    const row = await getRow(r1.data.id)
    if (row) {
      console.log(`  Row landed:`)
      console.log(`    id:            ${row.id}`)
      console.log(`    kinds:         ${JSON.stringify(row.kinds)}`)
      console.log(`    severity:      ${row.severity}`)
      console.log(`    where:         ${row.where}`)
      console.log(`    what:          ${row.what?.slice(0, 80)}`)
      console.log(`    expected:      ${row.expected?.slice(0, 60)}`)
      console.log(`    screenshot:    ${row.screenshot}`)
      console.log(`    github_issue:  ${row.github_issue}`)
      console.log(`    status:        ${row.status}`)
      console.log(`    release:       ${row.release}`)
      console.log(`    context keys:  ${Object.keys(row.context || {}).join(', ')}`)
    }

    if (row?.screenshot) {
      const storage = await checkStorage(row.screenshot)
      console.log(`  Storage: exists=${storage.exists}`)
      if (storage.signedUrl) console.log(`    URL: ${storage.signedUrl.slice(0, 120)}...`)
    }

    if (r1.data.issue) {
      const issue = await checkGitHubIssue(r1.data.issue)
      if (issue) {
        console.log(`  GitHub issue #${issue.number}: "${issue.title}"`)
        console.log(`    Labels: ${issue.labels.map(l => l.name).join(', ')}`)
        console.log(`    URL: ${issue.html_url}`)
        console.log(`    Body preview: ${issue.body?.slice(0, 200)}...`)
      } else {
        console.log(`  GitHub issue #${r1.data.issue}: could not fetch`)
      }
    } else {
      console.log('  GitHub issue: not created (null)')
    }
  }

  console.log()

  // ── Test 2: Submission without screenshot ──────────────────────
  console.log('--- Test 2: Submission without screenshot ---')
  const r2 = await postFeedback(cookie, {
    kinds: ['idea'],
    severity: 0,
    where: 'review',
    what: 'E2E test: would love a compare-side-by-side feature in review',
    expected: null,
    context: {
      screen: 'review',
      series: 'Portraits',
      count: 5,
      tier: 'Bust',
      userId: 'cc-test',
    },
  })
  console.log(`  Status: ${r2.status}`)
  console.log(`  Response:`, JSON.stringify(r2.data))

  if (r2.status === 200 && r2.data?.id) {
    const row = await getRow(r2.data.id)
    if (row) {
      console.log(`  Row landed:`)
      console.log(`    screenshot: ${row.screenshot} (should be null)`)
      console.log(`    github_issue: ${row.github_issue}`)
    }

    if (r2.data.issue) {
      const issue = await checkGitHubIssue(r2.data.issue)
      if (issue) {
        console.log(`  GitHub issue #${issue.number}: "${issue.title}"`)
        console.log(`    Has screenshot section: ${issue.body?.includes('## Screenshot')}`)
        console.log(`    URL: ${issue.html_url}`)
      }
    }
  }

  console.log()

  // ── Test 3: Oversized screenshot (413) ─────────────────────────
  console.log('--- Test 3: Oversized screenshot -> 413 ---')
  const oversized = makeOversizedScreenshot()
  console.log(`  Screenshot string length: ${oversized.length} (limit: ${2 * 1024 * 1024})`)

  const r3 = await postFeedback(cookie, {
    kinds: ['broken'],
    severity: 2,
    where: 'discovery',
    what: 'E2E test: oversized screenshot should be rejected with 413',
    context: { screen: 'discovery' },
    screenshot: oversized,
  })
  console.log(`  Status: ${r3.status} (expected: 413)`)
  console.log(`  Response:`, JSON.stringify(r3.data))
  console.log(`  413 correctly returned: ${r3.status === 413}`)

  // Simulate the client 413-retry: retry without screenshot
  console.log('  Retrying without screenshot (client 413 retry)...')
  const r3retry = await postFeedback(cookie, {
    kinds: ['broken'],
    severity: 2,
    where: 'discovery',
    what: 'E2E test: oversized screenshot should be rejected with 413',
    context: { screen: 'discovery' },
    screenshot: null,
  })
  console.log(`  Retry status: ${r3retry.status} (expected: 200)`)
  console.log(`  Retry response:`, JSON.stringify(r3retry.data))
  console.log(`  413-retry succeeded: ${r3retry.status === 200 && !!r3retry.data?.id}`)

  if (r3retry.data?.id) {
    const row = await getRow(r3retry.data.id)
    console.log(`  Retry row screenshot: ${row?.screenshot} (should be null)`)
  }

  console.log()

  // ── Test 4: Labels check ───────────────────────────────────────
  console.log('--- Test 4: GitHub labels ---')
  if (r1.data?.issue) {
    const issue = await checkGitHubIssue(r1.data.issue)
    if (issue) {
      const labelNames = issue.labels.map(l => l.name)
      const expected = ['test-release', 'from-feedback', 'where:discovery', 'sev:1']
      console.log(`  Expected labels: ${expected.join(', ')}`)
      console.log(`  Actual labels:   ${labelNames.join(', ')}`)
      const allPresent = expected.every(l => labelNames.includes(l))
      console.log(`  All expected labels present: ${allPresent}`)
      for (const l of expected) {
        console.log(`    ${l}: ${labelNames.includes(l) ? 'present' : 'MISSING'}`)
      }
      // Note whether labels were auto-created by GitHub
      console.log(`  (GitHub auto-creates labels on first use if the token has repo scope)`)
    }
  } else {
    console.log('  Skipped — no GitHub issue from Test 1')
  }

  console.log()

  // ── Test 5: Rate limit logic review ────────────────────────────
  console.log('--- Test 5: Rate limit logic (code review + live count) ---')
  console.log('  Route: app/api/v1/feedback/route.ts:76-85')
  console.log('  Window: RATE_WINDOW_MS = 60*60*1000 (1 hour)')
  console.log('  Max: RATE_MAX = 10')
  console.log('  Query: supabaseAdmin.from("feedback").select("id",{count:"exact",head:true})')
  console.log('         .eq("user_id", user.id).gte("created_at", since)')
  console.log('  Logic: if (count >= 10) -> 429 { ok:false, reason:"too_many" }')

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await supaAdmin
    .from('feedback')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .gte('created_at', since)
  console.log(`  Current count for test user in last hour: ${count ?? 0} / 10`)
  console.log('  Assessment: query is sound — counts per-user rows in sliding 1hr window,')
  console.log('  uses supabaseAdmin (bypasses RLS), head:true avoids fetching data.')
  console.log('  Not exhaustively testing to avoid spamming real GitHub issues.')

  console.log('\n=== All tests complete ===')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
