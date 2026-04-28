'use client'

import { useState, FormEvent } from 'react'

interface HighDemandErrorProps {
  product:     string
  requestBody: object
  onRetry:     () => void
  onDismiss:   () => void
}

type Stage = 'initial' | 'capture' | 'submitting' | 'confirmed'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function HighDemandError({ product, requestBody, onRetry, onDismiss }: HighDemandErrorProps) {
  const [stage, setStage] = useState<Stage>('initial')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim().toLowerCase()
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email.')
      return
    }
    setStage('submitting')
    try {
      const res = await fetch('/api/v1/queue', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: trimmed, product, requestBody }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || `HTTP ${res.status}`)
        setStage('capture')
        return
      }
      setStage('confirmed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setStage('capture')
    }
  }

  return (
    <div className="hde-overlay" onClick={onDismiss}>
      <div className="hde-card" onClick={(e) => e.stopPropagation()}>
        <div className="hde-icon" aria-hidden="true">
          {/* Hourglass-ish glyph in the warm accent */}
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 3h14M5 21h14M6 3v3a6 6 0 0 0 12 0V3M6 21v-3a6 6 0 0 1 12 0v3" />
          </svg>
        </div>

        {(stage === 'initial' || stage === 'capture' || stage === 'submitting') && (
          <h2 className="hde-title">Our image studio is busy right now</h2>
        )}
        {stage === 'confirmed' && (
          <h2 className="hde-title">We&apos;ll let you know</h2>
        )}

        {stage === 'initial' && (
          <>
            <p className="hde-sub">
              We&apos;re seeing high demand. Try again in a few minutes — or we can email you when your image is ready.
            </p>
            <div className="hde-actions">
              <button type="button" className="hde-btn-secondary" onClick={onRetry}>
                Try again
              </button>
              <button type="button" className="hde-btn-primary" onClick={() => setStage('capture')}>
                Email me when ready
              </button>
            </div>
          </>
        )}

        {(stage === 'capture' || stage === 'submitting') && (
          <form onSubmit={submit}>
            <p className="hde-sub">Drop your email and we&apos;ll send a link to your finished image.</p>
            <label className="hde-label" htmlFor="hde-email">Email</label>
            <input
              id="hde-email"
              className="hde-input"
              type="email"
              autoFocus
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={stage === 'submitting'}
            />
            {error && <div className="hde-error">{error}</div>}
            <div className="hde-actions">
              <button
                type="button"
                className="hde-btn-secondary"
                onClick={() => { setStage('initial'); setError(null) }}
                disabled={stage === 'submitting'}
              >
                Back
              </button>
              <button
                type="submit"
                className="hde-btn-primary"
                disabled={stage === 'submitting' || !email}
              >
                {stage === 'submitting' ? 'Sending…' : 'Send me a notification'}
              </button>
            </div>
          </form>
        )}

        {stage === 'confirmed' && (
          <>
            <p className="hde-sub">
              Thanks! We&apos;ll email you within a few minutes when your image is ready.
            </p>
            <div className="hde-actions">
              <button type="button" className="hde-btn-primary hde-btn-full" onClick={onDismiss}>
                Close
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .hde-overlay {
          position: fixed;
          inset: 0;
          background: rgba(26, 24, 20, 0.55);
          backdrop-filter: blur(2px);
          z-index: 1100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: hde-fade-in 0.18s ease-out;
        }
        @keyframes hde-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .hde-card {
          width: 100%;
          max-width: 420px;
          background: var(--surface, #fff);
          border: 1px solid var(--border, #E8E4DA);
          border-top: 4px solid var(--warn, #B8893A);
          border-radius: 10px;
          padding: 26px 26px 22px;
          font-family: var(--sans, 'Inter', system-ui, sans-serif);
          color: var(--ink, #1A1814);
          box-shadow: 0 16px 48px -16px rgba(26, 24, 20, 0.35);
          animation: hde-card-in 0.22s ease-out;
        }
        @keyframes hde-card-in {
          from { transform: translateY(8px); opacity: 0; }
          to   { transform: none;            opacity: 1; }
        }
        .hde-icon {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          background: var(--warn-soft, #F5EFE5);
          color: var(--warn, #B8893A);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
        }
        .hde-title {
          font-family: var(--serif, 'Cormorant Garamond', Georgia, serif);
          font-size: 26px;
          line-height: 1.2;
          color: var(--ink, #1A1814);
          margin: 0 0 8px;
          font-weight: 400;
        }
        .hde-sub {
          font-size: 13.5px;
          color: var(--ink-2, #5C564E);
          line-height: 1.55;
          margin: 0 0 18px;
        }
        .hde-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          color: var(--ink-3, #8E877C);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .hde-input {
          width: 100%;
          padding: 10px 12px;
          background: var(--surface, #fff);
          border: 1px solid var(--border-strong, #D4CEC0);
          border-radius: 4px;
          color: var(--ink, #1A1814);
          font-size: 14px;
          font-family: inherit;
          transition: border-color 0.15s;
          margin-bottom: 12px;
        }
        .hde-input:focus {
          outline: none;
          border-color: var(--accent, #6B5BA8);
        }
        .hde-input:disabled {
          background: var(--surface-2, #F4F2EC);
          cursor: not-allowed;
        }
        .hde-error {
          margin-bottom: 12px;
          padding: 8px 10px;
          background: var(--danger-soft, #F5EAEA);
          border: 1px solid var(--danger, #A85050);
          border-radius: 4px;
          color: var(--danger, #A85050);
          font-size: 12px;
        }
        .hde-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 6px;
        }
        .hde-btn-primary,
        .hde-btn-secondary {
          padding: 10px 16px;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          border-radius: 6px;
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
          border: 1px solid transparent;
        }
        .hde-btn-primary {
          background: var(--ink, #1A1814);
          color: #fff;
          border-color: var(--ink, #1A1814);
        }
        .hde-btn-primary:hover:not(:disabled) {
          background: var(--ink-2, #5C564E);
          border-color: var(--ink-2, #5C564E);
        }
        .hde-btn-primary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .hde-btn-secondary {
          background: var(--surface, #fff);
          color: var(--ink-2, #5C564E);
          border-color: var(--border-strong, #D4CEC0);
        }
        .hde-btn-secondary:hover:not(:disabled) {
          color: var(--ink, #1A1814);
          border-color: var(--ink-3, #8E877C);
        }
        .hde-btn-secondary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .hde-btn-full {
          flex: 1;
        }
      `}</style>
    </div>
  )
}
