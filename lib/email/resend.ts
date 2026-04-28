// email/resend.ts
// lib/email/resend.ts
//
// Resend wrapper for the two transactional emails we send today:
//   - completion: "your image is ready"
//   - apology:    "we couldn't finish your image"
//
// FROM address is configured via RESEND_FROM_EMAIL. Sending domain setup
// (DNS, DKIM, etc.) is operator-owned — this file only invokes the SDK.

import { Resend } from 'resend'
import type { QueuedProduct } from '@/lib/queue/types'

const PRODUCT_NAMES: Record<QueuedProduct, string> = {
  groups:     'group sculpture',
  structures: 'diorama',
  landscapes: 'landscape',
  interior:   'interior',
  stadium:    'stadium scene',
  actionmini: 'action mini',
  sportsmem:  'sports memory',
  moments:    'moment',
}

function productName(p: string): string {
  return (PRODUCT_NAMES as Record<string, string>)[p] ?? 'image'
}

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  return new Resend(key)
}

function getFrom(): string {
  const from = process.env.RESEND_FROM_EMAIL
  if (!from) throw new Error('RESEND_FROM_EMAIL is not set')
  return from
}

// Cream/ink/purple to match the project design system.
const COLORS = {
  bg:      '#FAFAF7',
  surface: '#FFFFFF',
  border:  '#E8E4DA',
  ink:     '#1A1814',
  ink2:    '#5C564E',
  ink3:    '#8E877C',
  accent:  '#6B5BA8',
}

const SERIF = "'Cormorant Garamond', Georgia, serif"
const SANS  = "'Inter', system-ui, -apple-system, sans-serif"

function brandHeader(): string {
  return `
    <div style="font-family:${SERIF};font-size:28px;color:${COLORS.ink};letter-spacing:0.01em;">
      mini<em style="font-style:italic;color:${COLORS.accent};">Rama</em>
    </div>
  `
}

function shell(innerHtml: string, preheader: string): string {
  return `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:${COLORS.bg};font-family:${SANS};color:${COLORS.ink};">
  <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;font-size:1px;color:${COLORS.bg};">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:8px;">
        <tr><td style="padding:32px 32px 8px;">
          ${brandHeader()}
        </td></tr>
        <tr><td style="padding:8px 32px 28px;">
          ${innerHtml}
        </td></tr>
      </table>
      <div style="margin-top:14px;font-size:11px;color:${COLORS.ink3};font-family:${SANS};">
        miniRama · sent because you asked us to email you when your image was ready.
      </div>
    </td></tr>
  </table>
</body></html>
  `.trim()
}

export async function sendCompletionEmail(opts: {
  to:        string
  product:   string
  resultUrl: string
}): Promise<void> {
  const product = productName(opts.product)
  const subject = `Your ${product} is ready`
  const inner = `
    <p style="font-family:${SERIF};font-style:italic;font-size:24px;color:${COLORS.ink};margin:0 0 14px;line-height:1.25;">
      Thank you for waiting — your ${product} is finished.
    </p>
    <p style="font-size:14px;color:${COLORS.ink2};line-height:1.6;margin:0 0 22px;">
      You can view and download it here:
    </p>
    <p style="margin:0 0 22px;">
      <a href="${opts.resultUrl}" style="display:inline-block;padding:12px 22px;background:${COLORS.ink};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:13px;letter-spacing:0.02em;">
        View your image
      </a>
    </p>
    <p style="font-size:12px;color:${COLORS.ink3};line-height:1.5;margin:0;">
      Or paste this into your browser:<br>
      <a href="${opts.resultUrl}" style="color:${COLORS.accent};word-break:break-all;">${opts.resultUrl}</a>
    </p>
  `
  const html = shell(inner, `Your ${product} is ready to view.`)

  const resend = getResend()
  await resend.emails.send({
    from:    getFrom(),
    to:      opts.to,
    subject,
    html,
  })
}

export async function sendApologyEmail(opts: {
  to:           string
  product:      string
  errorContext: string
}): Promise<void> {
  const product = productName(opts.product)
  const subject = `Sorry — we couldn't finish your ${product}`
  const inner = `
    <p style="font-family:${SERIF};font-style:italic;font-size:24px;color:${COLORS.ink};margin:0 0 14px;line-height:1.25;">
      We're sorry — your ${product} didn't go through.
    </p>
    <p style="font-size:14px;color:${COLORS.ink2};line-height:1.6;margin:0 0 14px;">
      We tried several times but couldn't finish your image. We haven't charged you, and we'd
      love to have another go when you're ready.
    </p>
    <p style="font-size:12px;color:${COLORS.ink3};line-height:1.5;margin:0;">
      If you'd like a hand, just reply to this email and we'll take a look.
    </p>
  `
  const html = shell(inner, `We couldn't finish your ${product} — sorry.`)

  const resend = getResend()
  await resend.emails.send({
    from:    getFrom(),
    to:      opts.to,
    subject,
    html,
  })
}
