'use client'

// app/result/[jobId]/ResultViewer.tsx
//
// Placeholder viewer. The application chat replaces the body of this
// component with its real image-rendering UI once the generation pipeline
// stores results somewhere fetchable. Until then this polls
// /api/v1/result/[jobId] and shows a "preparing" state.

import { useEffect, useState } from 'react'

interface ResultPayload {
  status:     'pending' | 'ready' | 'failed'
  imageUrl?:  string
  message?:   string
}

export default function ResultViewer({ jobId }: { jobId: string }) {
  const [result, setResult] = useState<ResultPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    async function poll() {
      try {
        const res = await fetch(`/api/v1/result/${jobId}`, { cache: 'no-store' })
        if (cancelled) return
        if (res.status === 404) {
          // Application chat hasn't implemented the endpoint yet — stay
          // in pending state and keep polling. Slow down the cadence so
          // we don't hammer.
          setResult({ status: 'pending', message: 'Result storage not implemented yet (application-chat scope).' })
          timer = setTimeout(poll, 5000)
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = await res.json() as ResultPayload
        setResult(body)
        if (body.status === 'pending') {
          timer = setTimeout(poll, 2000)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Network error')
      }
    }
    void poll()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [jobId])

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=Inter:wght@400;500;600&display=swap"
      />
      <div className="result-shell">
        <div className="result-card">
          {error ? (
            <>
              <h1>Couldn&apos;t load your result</h1>
              <p className="muted">{error}</p>
            </>
          ) : !result || result.status === 'pending' ? (
            <>
              <div className="spinner" />
              <h1>Your miniature is being prepared</h1>
              <p className="muted">
                {result?.message ?? 'This usually takes 10–30 seconds. The link works on any device — keep this page open or come back later.'}
              </p>
              <p className="muted small">Job <code>{jobId}</code></p>
            </>
          ) : result.status === 'failed' ? (
            <>
              <h1>Generation failed</h1>
              <p className="muted">{result.message ?? 'We hit a problem rendering your image. Reach out to support and we&apos;ll make it right.'}</p>
            </>
          ) : (
            <>
              {result.imageUrl ? (
                <img src={result.imageUrl} alt="Your miniature" className="result-image" />
              ) : (
                <p className="muted">Result is ready but no image URL was returned.</p>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        body { background: var(--bg, #FAFAF7); color: var(--ink, #1A1814); font-family: var(--sans, 'Inter', system-ui, sans-serif); }
        .result-shell { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .result-card {
          width: 100%; max-width: 560px; background: var(--surface, #fff);
          border: 1px solid var(--border, #E8E4DA); border-radius: 10px;
          padding: 30px; text-align: center;
        }
        .result-card h1 {
          font-family: var(--serif, 'Cormorant Garamond', Georgia, serif);
          font-size: 26px; line-height: 1.25; margin: 0 0 8px; font-weight: 400;
        }
        .result-card .muted { color: var(--ink-2, #5C564E); font-size: 13px; line-height: 1.55; margin: 0 0 8px; }
        .result-card .small { font-size: 11px; color: var(--ink-3, #8E877C); }
        .result-card .small code { background: var(--surface-2, #F4F2EC); padding: 1px 6px; border-radius: 3px; font-family: var(--mono, ui-monospace, monospace); }
        .result-image { width: 100%; max-width: 500px; border-radius: 6px; }
        .spinner {
          width: 32px; height: 32px; border: 3px solid var(--border, #E8E4DA);
          border-top-color: var(--accent, #6B5BA8); border-radius: 50%;
          margin: 0 auto 14px; animation: result-spin 1s linear infinite;
        }
        @keyframes result-spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
