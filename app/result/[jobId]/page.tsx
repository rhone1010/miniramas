// app/result/[jobId]/page.tsx
//
// Public — no auth, gated by the HMAC-signed token in ?t=.
// The image-rendering component is owned by the application chat. This
// page validates the token, then renders a placeholder ResultViewer that
// the application chat can replace once it has a result-storage layer.

import { Suspense } from 'react'
import { verifyResultToken } from '@/lib/store/resultToken'
import ResultViewer from './ResultViewer'

export default async function ResultPage(props: {
  params:       Promise<{ jobId: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { jobId }   = await props.params
  const { t }       = await props.searchParams

  if (!t) return <ExpiredView reason="missing_token" />
  const verified = verifyResultToken(t)
  if (!verified || verified.jobId !== jobId) {
    return <ExpiredView reason="invalid_token" />
  }

  return (
    <Suspense fallback={null}>
      <ResultViewer jobId={jobId} />
    </Suspense>
  )
}

function ExpiredView({ reason }: { reason: 'missing_token' | 'invalid_token' }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=Inter:wght@400;500;600&display=swap"
      />
      <div className="result-expired">
        <div className="result-expired-card">
          <h1>This link has expired or isn&apos;t valid</h1>
          <p className="muted">
            {reason === 'missing_token'
              ? 'The result link is missing its token. Use the link from your confirmation email.'
              : 'We couldn’t verify this link. It may have expired (links last 30 days) or been edited.'}
          </p>
          <p className="muted">
            If you can’t find the original email, request a new link from the email associated with your purchase.
          </p>
          <a href="/store" className="btn-primary">Back to store</a>
        </div>
      </div>

      <style>{`
        body { background: var(--bg, #FAFAF7); color: var(--ink, #1A1814); font-family: var(--sans, 'Inter', system-ui, sans-serif); }
        .result-expired { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .result-expired-card {
          width: 100%; max-width: 460px; background: var(--surface, #fff);
          border: 1px solid var(--border, #E8E4DA); border-top: 4px solid var(--danger, #A85050);
          border-radius: 10px; padding: 28px; text-align: center;
        }
        .result-expired-card h1 {
          font-family: var(--serif, 'Cormorant Garamond', Georgia, serif);
          font-size: 24px; line-height: 1.25; margin: 0 0 8px; font-weight: 400;
        }
        .result-expired-card .muted {
          color: var(--ink-2, #5C564E); font-size: 13px; line-height: 1.55; margin-bottom: 12px;
        }
        .btn-primary {
          display: inline-block; margin-top: 6px; padding: 10px 18px;
          background: var(--ink, #1A1814); color: #fff; text-decoration: none;
          border-radius: 6px; font-size: 13px; font-weight: 600;
        }
      `}</style>
    </>
  )
}
