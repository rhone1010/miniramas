'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface SigninModalProps {
  /** Path the magic-link callback should redirect back to. Default '/account'. */
  next?:        string
  onSignedIn?:  (user: { id: string; email: string | null }) => void
  onDismiss:    () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function SigninModal({ next = '/account', onSignedIn, onDismiss }: SigninModalProps) {
  const [email, setEmail]     = useState('')
  const [stage, setStage]     = useState<'enter' | 'sending' | 'sent'>('enter')
  const [error, setError]     = useState<string | null>(null)

  // Voids onSignedIn lint warnings — wired in later when we add cookie polling.
  void onSignedIn

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (stage !== 'enter') return
    setError(null)
    const trimmed = email.trim().toLowerCase()
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email.')
      return
    }
    setStage('sending')

    try {
      const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!url || !anon) throw new Error('Supabase env not configured')

      const supabase = createBrowserClient(url, anon)
      const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      const { error: err } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: callback,
          shouldCreateUser: true,
        },
      })
      if (err) throw err
      setStage('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
      setStage('enter')
    }
  }

  return (
    <div className="signin-overlay" onClick={onDismiss}>
      <form className="signin-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        {stage !== 'sent' ? (
          <>
            <div className="signin-eyebrow">Sign in</div>
            <h2 className="signin-title">We&apos;ll send you a link.</h2>
            <p className="signin-sub">No password — just an email with a one-tap sign-in link.</p>

            <label className="signin-label" htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              className="signin-input"
              type="email"
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={stage === 'sending'}
              placeholder="you@example.com"
            />
            {error && <div className="signin-error">{error}</div>}
            <div className="signin-actions">
              <button type="button" className="signin-btn-secondary" onClick={onDismiss} disabled={stage === 'sending'}>Cancel</button>
              <button type="submit" className="signin-btn-primary" disabled={stage === 'sending' || !email}>
                {stage === 'sending' ? 'Sending…' : 'Send link'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="signin-eyebrow">Check your email</div>
            <h2 className="signin-title">Link is on its way to {email}.</h2>
            <p className="signin-sub">
              Click the link in the email to finish signing in. You can close this window — the link works on any device.
            </p>
            <div className="signin-actions">
              <button type="button" className="signin-btn-primary signin-btn-full" onClick={onDismiss}>Close</button>
            </div>
          </>
        )}
      </form>
      <style jsx>{`
        .signin-overlay {
          position: fixed; inset: 0; background: rgba(26,24,20,.55);
          z-index: 1200; display: flex; align-items: center; justify-content: center;
          padding: 16px; backdrop-filter: blur(2px);
        }
        .signin-card {
          width: 100%; max-width: 400px; background: var(--surface, #fff);
          border: 1px solid var(--border, #E8E4DA); border-radius: 10px; padding: 26px;
          font-family: var(--sans, 'Inter', system-ui, sans-serif); color: var(--ink, #1A1814);
          box-shadow: 0 16px 48px -16px rgba(26,24,20,.35);
        }
        .signin-eyebrow {
          font-size: 11px; color: var(--ink-3, #8E877C); letter-spacing: 0.06em;
          margin-bottom: 4px; text-transform: uppercase;
          font-family: var(--mono, ui-monospace, monospace);
        }
        .signin-title {
          font-family: var(--serif, 'Cormorant Garamond', Georgia, serif);
          font-size: 24px; line-height: 1.2; color: var(--ink, #1A1814);
          margin: 0 0 6px; font-weight: 400;
        }
        .signin-sub {
          font-size: 13px; color: var(--ink-2, #5C564E); line-height: 1.55;
          margin: 0 0 16px;
        }
        .signin-label {
          display: block; font-size: 10px; font-weight: 600;
          color: var(--ink-3, #8E877C); letter-spacing: 0.1em;
          text-transform: uppercase; margin-bottom: 6px;
        }
        .signin-input {
          width: 100%; padding: 10px 12px;
          background: var(--surface, #fff);
          border: 1px solid var(--border-strong, #D4CEC0);
          border-radius: 4px; color: var(--ink, #1A1814);
          font-size: 14px; font-family: inherit; transition: border-color 0.15s;
        }
        .signin-input:focus { outline: none; border-color: var(--accent, #6B5BA8); }
        .signin-input:disabled { background: var(--surface-2, #F4F2EC); cursor: not-allowed; }
        .signin-error {
          margin-top: 12px; padding: 8px 10px;
          background: var(--danger-soft, #F5EAEA); border: 1px solid var(--danger, #A85050);
          border-radius: 4px; color: var(--danger, #A85050); font-size: 12px;
        }
        .signin-actions {
          display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px;
        }
        .signin-btn-primary, .signin-btn-secondary {
          padding: 10px 16px; font-size: 13px; font-weight: 600;
          font-family: inherit; border-radius: 6px; cursor: pointer;
          letter-spacing: 0.02em; transition: all 0.15s; border: 1px solid transparent;
        }
        .signin-btn-primary { background: var(--ink, #1A1814); color: #fff; border-color: var(--ink, #1A1814); }
        .signin-btn-primary:hover:not(:disabled) { background: var(--ink-2, #5C564E); border-color: var(--ink-2, #5C564E); }
        .signin-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
        .signin-btn-secondary {
          background: var(--surface, #fff); color: var(--ink-2, #5C564E);
          border-color: var(--border-strong, #D4CEC0);
        }
        .signin-btn-secondary:hover:not(:disabled) { color: var(--ink, #1A1814); border-color: var(--ink-3, #8E877C); }
        .signin-btn-secondary:disabled { opacity: 0.55; cursor: not-allowed; }
        .signin-btn-full { flex: 1; }
      `}</style>
    </div>
  )
}
