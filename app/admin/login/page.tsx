'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      })
      if (!res.ok) {
        setError(res.status === 401 ? 'Incorrect password.' : 'Login failed.')
        return
      }
      router.push('/admin/store')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap"
      />
      <div className="login-shell">
        <form className="login-card" onSubmit={onSubmit}>
          <div className="login-logo">
            mini<em>Rama</em>
            <span className="login-suffix">Admin</span>
          </div>
          <p className="login-sub">Sign in to manage the bundle catalog.</p>

          <label className="login-label" htmlFor="pw">Password</label>
          <input
            id="pw"
            className="login-input"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />

          {error && <div className="login-error">{error}</div>}

          <button className="login-btn" type="submit" disabled={submitting || !password}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
      <style jsx global>{`
        body {
          background: var(--bg);
          font-family: var(--sans);
          color: var(--ink);
        }
        .login-shell {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .login-card {
          width: 100%;
          max-width: 380px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 32px;
          box-shadow: 0 4px 14px -6px rgba(26, 24, 20, 0.1);
        }
        .login-logo {
          font-family: var(--serif);
          font-size: 28px;
          color: var(--ink);
          margin-bottom: 4px;
          display: flex;
          align-items: baseline;
          gap: 12px;
        }
        .login-logo em {
          font-style: italic;
          color: var(--accent);
        }
        .login-suffix {
          font-family: var(--sans);
          font-size: 11px;
          color: var(--ink-3);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding-left: 12px;
          border-left: 1px solid var(--border);
        }
        .login-sub {
          font-size: 13px;
          color: var(--ink-2);
          margin-bottom: 20px;
        }
        .login-label {
          display: block;
          font-size: 10px;
          font-weight: 600;
          color: var(--ink-3);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .login-input {
          width: 100%;
          padding: 10px 12px;
          background: var(--surface);
          border: 1px solid var(--border-strong);
          border-radius: 4px;
          color: var(--ink);
          font-size: 14px;
          font-family: var(--sans);
          transition: border-color 0.15s;
        }
        .login-input:focus {
          outline: none;
          border-color: var(--accent);
        }
        .login-input:disabled {
          background: var(--surface-2);
          cursor: not-allowed;
        }
        .login-error {
          margin-top: 12px;
          padding: 8px 10px;
          background: var(--danger-soft);
          border: 1px solid var(--danger);
          border-radius: 4px;
          color: var(--danger);
          font-size: 12px;
        }
        .login-btn {
          width: 100%;
          margin-top: 18px;
          padding: 11px;
          background: var(--ink);
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: var(--sans);
          letter-spacing: 0.02em;
          transition: background 0.15s;
        }
        .login-btn:hover:not(:disabled) {
          background: var(--ink-2);
        }
        .login-btn:disabled {
          background: var(--surface-2);
          color: var(--ink-3);
          cursor: not-allowed;
        }
      `}</style>
    </>
  )
}
