// app/api/v1/feedback/route.ts
//
// "Something off?" panel — bug reports and site feedback.
//
// POST body matches the glass contract in litenco-feedback-modal.html:
//   { kinds, severity, where, what, expected, context, screenshot }
//
// Auth required (test release). Screenshot decoded → Supabase Storage
// feedback-shots/<id>.jpg. GitHub issue opened on insert; if GitHub
// fails the row still saves and the issue number comes back null.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }            from '@/lib/supabase'
import { getUser }                   from '@/lib/store/auth'

export const runtime = 'nodejs'

const MAX_WHAT       = 4000
const MAX_EXPECTED   = 2000
const MAX_SCREENSHOT = 2 * 1024 * 1024  // 2 MB as base64 string length
const RATE_WINDOW_MS = 60 * 60 * 1000   // 1 hour
const RATE_MAX       = 10

const VALID_KINDS  = ['broken', 'visual', 'confusing', 'slow', 'idea']
const VALID_WHERE  = ['discovery', 'review', 'mycoll']

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────
    const user = await getUser().catch(() => null)
    if (!user?.id) {
      return NextResponse.json({ ok: false, reason: 'auth' }, { status: 401 })
    }

    // ── Parse ─────────────────────────────────────────────────
    const body = await req.json().catch(() => ({} as any))

    const kinds: string[] = Array.isArray(body.kinds)
      ? body.kinds.filter((k: any) => typeof k === 'string' && VALID_KINDS.includes(k))
      : []
    if (!kinds.length) {
      return NextResponse.json({ ok: false, reason: 'kinds_required' }, { status: 400 })
    }

    const severity = typeof body.severity === 'number' && body.severity >= 0 && body.severity <= 2
      ? body.severity
      : 0

    const where = typeof body.where === 'string' && VALID_WHERE.includes(body.where)
      ? body.where
      : 'discovery'

    const what = typeof body.what === 'string' ? body.what.trim().slice(0, MAX_WHAT) : ''
    if (what.length < 3) {
      return NextResponse.json({ ok: false, reason: 'what_required' }, { status: 400 })
    }

    const expected = typeof body.expected === 'string'
      ? body.expected.trim().slice(0, MAX_EXPECTED) || null
      : null

    const context = body.context && typeof body.context === 'object' && !Array.isArray(body.context)
      ? body.context
      : {}

    const screenshot: string | null = typeof body.screenshot === 'string' && body.screenshot.startsWith('data:image/')
      ? body.screenshot
      : null

    // ── Screenshot size check ─────────────────────────────────
    if (screenshot && screenshot.length > MAX_SCREENSHOT) {
      return NextResponse.json({ ok: false, reason: 'screenshot_too_large' }, { status: 413 })
    }

    // ── Rate limit ────────────────────────────────────────────
    const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
    const { count } = await supabaseAdmin
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', since)

    if ((count ?? 0) >= RATE_MAX) {
      return NextResponse.json({ ok: false, reason: 'too_many' }, { status: 429 })
    }

    // ── Insert row ────────────────────────────────────────────
    const { data: row, error: insErr } = await supabaseAdmin
      .from('feedback')
      .insert({
        user_id:    user.id,
        handle:     context.userId || null,
        kinds,
        severity,
        where,
        what,
        expected,
        context,
        screenshot: null,  // updated below if upload succeeds
        url:        typeof context.url === 'string' ? context.url.slice(0, 2000) : null,
        viewport:   typeof context.viewport === 'string' ? context.viewport.slice(0, 40) : null,
        release:    'test',
        status:     'new',
      })
      .select('id')
      .single()

    if (insErr || !row?.id) {
      console.error('[feedback] insert failed:', insErr?.message)
      return NextResponse.json({ ok: false, reason: 'insert_failed' }, { status: 500 })
    }

    const feedbackId = row.id as string

    // ── Screenshot upload ─────────────────────────────────────
    let screenshotPath: string | null = null
    if (screenshot) {
      try {
        const match = screenshot.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/)
        if (match) {
          const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
          const buf = Buffer.from(match[2], 'base64')
          const path = `${feedbackId}.${ext}`

          const { error: upErr } = await supabaseAdmin.storage
            .from('feedback-shots')
            .upload(path, buf, {
              contentType: `image/${match[1]}`,
              upsert: false,
            })

          if (upErr) {
            console.error('[feedback] screenshot upload failed:', upErr.message)
          } else {
            screenshotPath = path
            await supabaseAdmin
              .from('feedback')
              .update({ screenshot: path })
              .eq('id', feedbackId)
          }
        }
      } catch (e: any) {
        console.error('[feedback] screenshot processing error:', e?.message)
      }
    }

    // ── GitHub issue ──────────────────────────────────────────
    let issueNumber: number | null = null
    const ghToken = process.env.GITHUB_TOKEN
    if (ghToken) {
      try {
        issueNumber = await openGitHubIssue({
          token: ghToken,
          kinds,
          severity,
          where,
          what,
          expected,
          context,
          feedbackId,
          screenshotPath,
        })
        if (issueNumber) {
          await supabaseAdmin
            .from('feedback')
            .update({ github_issue: issueNumber })
            .eq('id', feedbackId)
        }
      } catch (e: any) {
        // Row saves regardless. Issue can be retried.
        console.error('[feedback] GitHub issue failed:', e?.message)
      }
    } else {
      console.warn('[feedback] GITHUB_TOKEN not set — skipping issue creation')
    }

    console.log(`[feedback] saved id=${feedbackId} kinds=${kinds.join(',')} sev=${severity} where=${where} issue=${issueNumber ?? 'none'}`)

    // ── Retry orphaned rows (non-blocking) ─────────────────────
    // On each new submission, check for rows where github_issue is
    // null and created_at is older than 2 minutes. Retry up to 3
    // at a time to avoid blocking the response. Fire-and-forget.
    if (ghToken) {
      retryOrphanedIssues(ghToken).catch(() => {})
    }

    return NextResponse.json({ id: feedbackId, issue: issueNumber })

  } catch (e: any) {
    console.error('[feedback] fatal:', e?.message || e)
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500 })
  }
}

// ── GitHub issue helper ───────────────────────────────────────────
async function openGitHubIssue(opts: {
  token: string
  kinds: string[]
  severity: number
  where: string
  what: string
  expected: string | null
  context: Record<string, any>
  feedbackId: string
  screenshotPath: string | null
}): Promise<number | null> {
  const sevLabel = ['annoying', 'blocked', 'lost-work'][opts.severity] || 'annoying'
  const whatPreview = opts.what.length > 60 ? opts.what.slice(0, 60) + '…' : opts.what
  const title = `[test] ${opts.where} · ${opts.kinds.join(', ')} · sev${opts.severity} — ${whatPreview}`

  const labels = [
    'test-release',
    'from-feedback',
    `where:${opts.where}`,
    `sev:${opts.severity}`,
  ]

  // Build body
  const contextLines = Object.entries(opts.context)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `| ${k} | ${typeof v === 'object' ? JSON.stringify(v) : String(v)} |`)
    .join('\n')

  let body = `## What happened\n\n${opts.what}\n`
  if (opts.expected) {
    body += `\n## Expected\n\n${opts.expected}\n`
  }
  if (contextLines) {
    body += `\n## Context\n\n| Key | Value |\n|-----|-------|\n${contextLines}\n`
  }
  body += `\n---\n_Feedback ID: \`${opts.feedbackId}\`_`

  if (opts.screenshotPath) {
    const url = process.env.SUPABASE_URL
    if (url) {
      // Create a signed URL (7-day expiry) for the screenshot
      const { data } = await supabaseAdmin.storage
        .from('feedback-shots')
        .createSignedUrl(opts.screenshotPath, 7 * 24 * 60 * 60)
      if (data?.signedUrl) {
        body += `\n\n## Screenshot\n\n![screenshot](${data.signedUrl})`
      }
    }
  }

  const res = await fetch('https://api.github.com/repos/rhone1010/miniramas/issues', {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${opts.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ title, body, labels }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[feedback] GitHub API error:', res.status, detail.slice(0, 300))
    return null
  }

  const issue = await res.json()
  return issue.number ?? null
}

// ── Retry orphaned issues ─────────────────────────────────────────
// Rows where github_issue is null and created_at > 2 minutes ago.
// Runs at most 3 per invocation, fire-and-forget from the main handler.
async function retryOrphanedIssues(token: string) {
  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const { data: orphans } = await supabaseAdmin
    .from('feedback')
    .select('id, kinds, severity, where, what, expected, context, screenshot')
    .is('github_issue', null)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(3)

  if (!orphans?.length) return

  for (const row of orphans) {
    try {
      const num = await openGitHubIssue({
        token,
        kinds: row.kinds,
        severity: row.severity,
        where: row.where,
        what: row.what,
        expected: row.expected,
        context: row.context ?? {},
        feedbackId: row.id,
        screenshotPath: row.screenshot,
      })
      if (num) {
        await supabaseAdmin
          .from('feedback')
          .update({ github_issue: num })
          .eq('id', row.id)
        console.log(`[feedback] retry: backfilled issue #${num} for ${row.id}`)
      }
    } catch (e: any) {
      console.error(`[feedback] retry failed for ${row.id}:`, e?.message)
    }
  }
}
