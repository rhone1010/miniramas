'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface PurchaseStatus {
  id:           string
  status:       'pending' | 'paid' | 'failed' | 'refunded'
  skuId:        string
  amountCents:  number
  paidAt:       string | null
  resultUrl:    string | null
  entitlements: Array<{
    id:            string
    status:        string
    lockedStyle:   string | null
    lockedVariant: string | null
    jobId:         string | null
  }>
}

const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS  = 30_000

export default function SuccessInner() {
  const router = useRouter()
  const params = useSearchParams()
  const sessionId = params?.get('session_id')

  const [purchase, setPurchase] = useState<PurchaseStatus | null>(null)
  const [stalled,  setStalled]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setError('Missing session id.')
      return
    }
    const startedAt = Date.now()
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    async function tick() {
      try {
        const res = await fetch(`/api/v1/checkout/${sessionId}`, { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const { purchase: p } = await res.json() as { purchase: PurchaseStatus }
        if (cancelled) return
        setPurchase(p)
        if (p.status === 'paid' || p.status === 'failed' || p.status === 'refunded') {
          return
        }
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setStalled(true)
          return
        }
        timer = setTimeout(tick, POLL_INTERVAL_MS)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error')
      }
    }
    void tick()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [sessionId])

  useEffect(() => {
    if (!purchase || purchase.status !== 'paid') return
    if (purchase.resultUrl) {
      router.replace(purchase.resultUrl)
    } else {
      router.replace('/account')
    }
  }, [purchase, router])

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=Inter:wght@400;500;600&display=swap"
      />
      <div className="success-shell">
        <div className="success-card">
          {error ? (
            <>
              <h1>Something went wrong</h1>
              <p className="muted">{error}</p>
              <a href="/store" className="link">Back to store</a>
            </>
          ) : !sessionId ? (
            <>
              <h1>Missing session</h1>
              <a href="/store" className="link">Back to store</a>
            </>
          ) : stalled ? (
            <>
              <h1>Still processing your payment…</h1>
              <p className="muted">
                Stripe is taking a bit longer than usual. We&apos;ll email you when your generation is ready,
                or you can check your <a href="/account" className="link">account</a> for status.
              </p>
            </>
          ) : (
            <>
              <div className="spinner" />
              <h1>Processing payment + generating miniature</h1>
              <p className="muted">This usually takes 10–30 seconds.</p>
              {purchase && (
                <div className="status-row">Status: <span className="status-pill">{purchase.status}</span></div>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        body { background: var(--bg, #FAFAF7); color: var(--ink, #1A1814); font-family: var(--sans, 'Inter', system-ui, sans-serif); }
        .success-shell { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .success-card {
          width: 100%; max-width: 460px; background: var(--surface, #fff);
          border: 1px solid var(--border, #E8E4DA); border-radius: 10px;
          padding: 32px; text-align: center;
        }
        .success-card h1 {
          font-family: var(--serif, 'Cormorant Garamond', Georgia, serif);
          font-size: 24px; line-height: 1.25; margin: 0 0 8px; font-weight: 400;
        }
        .success-card .muted { color: var(--ink-2, #5C564E); font-size: 13px; line-height: 1.55; }
        .spinner {
          width: 32px; height: 32px; border: 3px solid var(--border, #E8E4DA);
          border-top-color: var(--accent, #6B5BA8); border-radius: 50%;
          margin: 0 auto 16px; animation: success-spin 1s linear infinite;
        }
        @keyframes success-spin { to { transform: rotate(360deg); } }
        .status-row {
          margin-top: 14px; font-size: 11px; color: var(--ink-3, #8E877C);
          font-family: var(--mono, ui-monospace, monospace); letter-spacing: 0.04em;
        }
        .status-pill {
          background: var(--surface-2, #F4F2EC); padding: 1px 8px;
          border-radius: 3px; color: var(--ink, #1A1814);
        }
        .link { color: var(--accent, #6B5BA8); }
      `}</style>
    </>
  )
}
