'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function CancelInner() {
  const params = useSearchParams()
  const sessionId = params?.get('session_id')
  const [voided, setVoided] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    void (async () => {
      try {
        await fetch(`/api/v1/checkout/${sessionId}/cancel`, { method: 'POST' })
        setVoided(true)
      } catch {
        // ignore
      }
    })()
  }, [sessionId])

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=Inter:wght@400;500;600&display=swap"
      />
      <div className="cancel-shell">
        <div className="cancel-card">
          <h1>Checkout cancelled</h1>
          <p className="muted">
            No charge was made.{' '}
            {voided && <>We&apos;ve marked the session as cancelled.{' '}</>}
            If a generation already started, the result will be discarded.
          </p>
          <a href="/store" className="btn-primary">Back to store</a>
        </div>
      </div>
      <style jsx global>{`
        body { background: var(--bg, #FAFAF7); color: var(--ink, #1A1814); font-family: var(--sans, 'Inter', system-ui, sans-serif); }
        .cancel-shell { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .cancel-card {
          width: 100%; max-width: 420px; background: var(--surface, #fff);
          border: 1px solid var(--border, #E8E4DA); border-radius: 10px;
          padding: 32px; text-align: center;
        }
        .cancel-card h1 {
          font-family: var(--serif, 'Cormorant Garamond', Georgia, serif);
          font-size: 26px; line-height: 1.2; margin: 0 0 8px; font-weight: 400;
        }
        .cancel-card .muted { color: var(--ink-2, #5C564E); font-size: 13px; line-height: 1.55; margin-bottom: 18px; }
        .btn-primary {
          display: inline-block; padding: 10px 18px;
          background: var(--ink, #1A1814); color: #fff; text-decoration: none;
          border-radius: 6px; font-size: 13px; font-weight: 600;
        }
      `}</style>
    </>
  )
}
