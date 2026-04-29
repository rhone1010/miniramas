'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface AccountData {
  user: { id: string; email: string | null }
  entitlements: Array<{
    id:             string
    purchaseId:     string
    lockedStyle:    string | null
    lockedVariant:  string | null
    status:         string
    jobId:          string | null
    createdAt:      string
  }>
  purchases: Array<{
    id:              string
    skuId:           string
    status:          string
    amountCents:     number
    stripeSessionId: string
    createdAt:       string
    paidAt:          string | null
  }>
}

export default function AccountPage() {
  const router = useRouter()
  const [data, setData] = useState<AccountData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/v1/entitlements', { cache: 'no-store' })
        if (res.status === 401) {
          router.replace('/?signin=1&next=/account')
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = await res.json()
        setData(body)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error')
      }
    })()
  }, [router])

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!url || !anon) throw new Error('Supabase env not configured')
      const supabase = createBrowserClient(url, anon)
      await supabase.auth.signOut()
    } finally {
      router.replace('/store')
    }
  }

  async function handleDeleteAccount() {
    if (!confirm('Delete your account? Your remaining generations will be forfeited.')) return
    try {
      const res = await fetch('/api/v1/account', { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error || `Delete failed: ${res.status}`)
        return
      }
      const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (url && anon) {
        const supabase = createBrowserClient(url, anon)
        await supabase.auth.signOut()
      }
      router.replace('/store')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Network error')
    }
  }

  if (error) return <ErrorView message={error} />
  if (!data) return <LoadingView />

  const available  = data.entitlements.filter((e) => e.status === 'available')
  const lockedAvailable  = available.filter((e) => e.lockedStyle && e.lockedVariant)
  const credits          = available.filter((e) => !e.lockedStyle && !e.lockedVariant)

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap"
      />
      <div className="acc-shell">
        <header className="acc-topbar">
          <a className="acc-home" href="/index.html">← Home</a>
          <span className="acc-logo">mini<em>Rama</em></span>
          <span className="acc-suffix">Account</span>
          <button className="acc-signout" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </header>

        <main className="acc-main">
          <div className="acc-section">
            <div className="acc-section-label">Signed in as</div>
            <div className="acc-email">{data.user.email}</div>
          </div>

          <div className="acc-section">
            <div className="acc-section-label">Generations</div>
            <div className="acc-credit-stat">
              <span className="acc-credit-num">{credits.length}</span>
              <span className="acc-credit-text">generation{credits.length === 1 ? '' : 's'} remaining</span>
            </div>
            {credits.length === 0 && (
              <div className="acc-empty-mini">
                None remaining. <a href="/store">Pick up a pack</a> to get started.
              </div>
            )}
          </div>

          {lockedAvailable.length > 0 && (
            <div className="acc-section">
              <div className="acc-section-label">Awaiting generation</div>
              <ul className="acc-list">
                {lockedAvailable.map((e) => (
                  <li key={e.id} className="acc-list-row">
                    <span className="acc-pill">{e.lockedStyle}</span>
                    <span className="acc-mono">{e.lockedVariant}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="acc-section">
            <div className="acc-section-label">Recent purchases</div>
            {data.purchases.length === 0 ? (
              <div className="acc-empty-mini">No purchases yet.</div>
            ) : (
              <ul className="acc-list">
                {data.purchases.map((p) => (
                  <li key={p.id} className="acc-list-row">
                    <span className="acc-mono">{new Date(p.createdAt).toLocaleDateString()}</span>
                    <span>{p.skuId}</span>
                    <span className="acc-mono">${(p.amountCents / 100).toFixed(2)}</span>
                    <span className={`acc-status acc-status-${p.status}`}>{p.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="acc-section">
            <button className="acc-btn-danger" onClick={handleDeleteAccount}>Delete account</button>
            <div className="acc-hint">
              This permanently deletes your account. Any unused generations are forfeited.
            </div>
          </div>
        </main>
      </div>

      <style jsx global>{styles}</style>
    </>
  )
}

function LoadingView() {
  return (
    <div className="acc-loading">
      <div className="acc-spinner" />
      <style jsx>{`
        .acc-loading { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg, #FAFAF7); }
        .acc-spinner {
          width: 32px; height: 32px; border: 3px solid var(--border, #E8E4DA);
          border-top-color: var(--accent, #6B5BA8); border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="acc-error">
      <p>{message}</p>
      <a href="/store">Back to store</a>
      <style jsx>{`
        .acc-error {
          min-height: 100vh; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          background: var(--bg, #FAFAF7); color: var(--ink, #1A1814); gap: 12px;
        }
      `}</style>
    </div>
  )
}

const styles = `
  body { background: var(--bg); color: var(--ink); font-family: var(--sans); }
  .acc-shell { min-height: 100vh; }
  .acc-topbar {
    height: 56px; background: var(--surface); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; padding: 0 24px; gap: 18px;
  }
  .acc-home {
    color: var(--ink-2); text-decoration: none; font-size: 12px;
  }
  .acc-home:hover { color: var(--ink); }
  .acc-logo { font-family: var(--serif); font-size: 22px; color: var(--ink); }
  .acc-logo em { font-style: italic; color: var(--accent); }
  .acc-suffix {
    font-size: 11px; color: var(--ink-3); letter-spacing: 0.08em;
    text-transform: uppercase; padding-left: 12px; border-left: 1px solid var(--border);
  }
  .acc-signout {
    margin-left: auto; padding: 7px 14px; background: var(--surface);
    border: 1px solid var(--border-strong); border-radius: 4px; color: var(--ink-2);
    font-size: 12px; font-weight: 500; cursor: pointer; font-family: var(--sans);
    transition: all 0.15s;
  }
  .acc-signout:hover:not(:disabled) { border-color: var(--ink-3); color: var(--ink); }
  .acc-signout:disabled { opacity: 0.55; cursor: not-allowed; }
  .acc-main { max-width: 720px; margin: 0 auto; padding: 28px 24px 60px; }
  .acc-section {
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 18px 22px; margin-bottom: 14px;
  }
  .acc-section-label {
    font-size: 10px; font-weight: 600; color: var(--ink-3); letter-spacing: 0.1em;
    text-transform: uppercase; margin-bottom: 8px;
  }
  .acc-email { font-size: 15px; color: var(--ink); }
  .acc-credit-stat {
    display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px;
  }
  .acc-credit-num {
    font-family: var(--serif); font-size: 38px; line-height: 1; color: var(--accent);
  }
  .acc-credit-text { font-size: 13px; color: var(--ink-2); }
  .acc-empty-mini {
    font-size: 12px; color: var(--ink-3); padding: 6px 0;
  }
  .acc-empty-mini a { color: var(--accent); }
  .acc-list { list-style: none; padding: 0; margin: 0; }
  .acc-list-row {
    display: flex; gap: 14px; padding: 8px 0; border-bottom: 1px solid var(--border);
    align-items: center; font-size: 13px;
  }
  .acc-list-row:last-child { border-bottom: none; }
  .acc-pill {
    background: var(--accent-soft); color: var(--accent);
    padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .acc-mono { font-family: var(--mono); font-size: 11px; color: var(--ink-3); }
  .acc-status { padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-left: auto; }
  .acc-status-paid    { background: var(--success-soft); color: var(--success); }
  .acc-status-pending { background: var(--warn-soft);    color: var(--warn);    }
  .acc-status-failed,
  .acc-status-refunded { background: var(--danger-soft);  color: var(--danger);  }
  .acc-btn-danger {
    padding: 8px 14px; background: var(--surface); border: 1px solid var(--danger);
    border-radius: 6px; color: var(--danger); font-size: 12px; font-weight: 600;
    cursor: pointer; font-family: var(--sans); transition: all 0.15s;
  }
  .acc-btn-danger:hover { background: var(--danger-soft); }
  .acc-hint { font-size: 11px; color: var(--ink-3); margin-top: 8px; }
`
