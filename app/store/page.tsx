'use client'

import { useEffect, useState } from 'react'
import type { Sku } from '@/lib/store/types'
import { VARIANTS_BY_STYLE } from '@/lib/v1/group-generator'
import type { SceneStyle, SceneVariant } from '@/lib/v1/group-generator'
import SigninModal from '@/components/SigninModal'

const STYLES = Object.keys(VARIANTS_BY_STYLE) as SceneStyle[]
const STYLE_LABELS: Record<SceneStyle, string> = {
  figurine:    'Figurine',
  plushy:      'Plushy',
  stop_motion: 'Stop Motion',
  designer:    'Designer',
}

interface AuthState { user: { id: string; email: string | null } | null; ready: boolean }

export default function StorePage() {
  const [skus,     setSkus]     = useState<Sku[] | null>(null)
  const [skusErr,  setSkusErr]  = useState<string | null>(null)
  const [auth,     setAuth]     = useState<AuthState>({ user: null, ready: false })
  const [activeSku, setActiveSku] = useState<Sku | null>(null)
  const [showSignin, setShowSignin] = useState(false)
  const [pendingBundleId, setPendingBundleId] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/v1/skus', { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setSkus(data.skus ?? [])
      } catch (e) {
        setSkusErr(e instanceof Error ? e.message : 'Failed to load')
      }
    })()
  }, [])

  // Best-effort auth check via cookie. We don't gate render on it.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/v1/auth/me', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setAuth({ user: data.user, ready: true })
        } else {
          setAuth({ user: null, ready: true })
        }
      } catch {
        setAuth({ user: null, ready: true })
      }
    })()
  }, [])

  function onBuyClick(sku: Sku) {
    if (sku.kind === 'single') {
      setActiveSku(sku)
      return
    }
    // bundle
    if (!auth.user) {
      setPendingBundleId(sku.id)
      setShowSignin(true)
      return
    }
    void launchBundleCheckout(sku.id)
  }

  async function launchBundleCheckout(skuId: string) {
    try {
      const res = await fetch('/api/v1/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ skuId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || `Checkout failed: ${res.status}`)
        return
      }
      const { checkoutUrl } = await res.json()
      window.location.href = checkoutUrl
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Network error')
    }
  }

  function onSignedIn(user: { id: string; email: string | null }) {
    setAuth({ user, ready: true })
    setShowSignin(false)
    if (pendingBundleId) {
      const id = pendingBundleId
      setPendingBundleId(null)
      void launchBundleCheckout(id)
    }
  }

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap"
      />
      <div className="store-shell">
        <header className="store-topbar">
          <a className="store-home" href="/index.html">← Home</a>
          <span className="store-logo">mini<em>Rama</em></span>
          <span className="store-suffix">Store</span>
          {auth.user ? (
            <a className="store-account" href="/account">{auth.user.email ?? 'Account'}</a>
          ) : (
            <button className="store-signin" onClick={() => setShowSignin(true)}>Sign in</button>
          )}
        </header>

        <main className="store-main">
          <h1 className="store-title">Buy a generation</h1>
          <p className="store-sub">
            One generation, or a pack to use across the catalog.
          </p>

          {skusErr && <div className="banner-error">{skusErr}</div>}
          {!skus && !skusErr && <div className="store-loading">Loading…</div>}
          {skus && skus.length === 0 && (
            <div className="empty-state">No products available right now.</div>
          )}

          {skus && skus.length > 0 && (
            <div className="sku-grid">
              {skus.map((s) => (
                <SkuCard
                  key={s.id}
                  sku={s}
                  signedIn={!!auth.user}
                  onBuy={() => onBuyClick(s)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {activeSku && (
        <SingleConfigDialog
          sku={activeSku}
          existingEmail={auth.user?.email ?? null}
          onCancel={() => setActiveSku(null)}
        />
      )}

      {showSignin && (
        <SigninModal
          onSignedIn={onSignedIn}
          onDismiss={() => { setShowSignin(false); setPendingBundleId(null) }}
          next="/store"
        />
      )}

      <style jsx global>{globalStyles}</style>
    </>
  )
}

function SkuCard({ sku, signedIn, onBuy }: { sku: Sku; signedIn: boolean; onBuy: () => void }) {
  const dollars = (sku.priceCents / 100).toFixed(2)
  const isBundle = sku.kind === 'bundle'
  const subtitle = isBundle
    ? `${sku.count} generations — pick a style each time`
    : 'One image, locked to your chosen style'
  return (
    <div className="sku-card">
      <div className="sku-kind">{isBundle ? 'Pack' : 'Single'}</div>
      <div className="sku-name">{sku.displayName}</div>
      <div className="sku-sub">{subtitle}</div>
      <div className="sku-price">${dollars}</div>
      {isBundle && !signedIn && (
        <div className="sku-hint">Sign in required for packs.</div>
      )}
      <button className="sku-buy" onClick={onBuy}>
        {isBundle ? `Buy ${sku.count} generations` : 'Buy & generate'}
      </button>
    </div>
  )
}

// ── Single-purchase config dialog ────────────────────────────────
// Anonymous users can buy a single. Stripe collects the email as part
// of Checkout, so we don't strictly need it here, but if the user is
// logged in we don't ask for it.

function SingleConfigDialog({ sku, existingEmail, onCancel }: {
  sku: Sku
  existingEmail: string | null
  onCancel: () => void
}) {
  const [style, setStyle]     = useState<SceneStyle>('figurine')
  const [variant, setVariant] = useState<SceneVariant>('standard')
  const [email, setEmail]     = useState(existingEmail ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset variant when style changes (variant lists differ per style).
  useEffect(() => {
    const allowed = VARIANTS_BY_STYLE[style].map((v) => v.key)
    if (!allowed.includes(variant)) setVariant(VARIANTS_BY_STYLE[style][0].key)
  }, [style, variant])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!existingEmail && !trimmedEmail) {
      setError('Email is required.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skuId:      sku.id,
          guestEmail: existingEmail ? undefined : trimmedEmail,
          style,
          variant,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || `Checkout failed: ${res.status}`)
        return
      }
      const { checkoutUrl } = await res.json()
      window.location.href = checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <form className="dialog-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="dialog-eyebrow">{sku.displayName} · ${(sku.priceCents / 100).toFixed(2)}</div>
        <h2 className="dialog-title">What should we make?</h2>

        <label className="dialog-label">Style</label>
        <select className="dialog-input" value={style} onChange={(e) => setStyle(e.target.value as SceneStyle)}>
          {STYLES.map((s) => <option key={s} value={s}>{STYLE_LABELS[s]}</option>)}
        </select>

        <label className="dialog-label">Variant</label>
        <select className="dialog-input" value={variant} onChange={(e) => setVariant(e.target.value as SceneVariant)}>
          {VARIANTS_BY_STYLE[style].map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
        </select>

        {!existingEmail && (
          <>
            <label className="dialog-label">Email</label>
            <input
              className="dialog-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <div className="dialog-hint">We&apos;ll email you the result link.</div>
          </>
        )}

        {error && <div className="dialog-error">{error}</div>}

        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Redirecting…' : `Continue to checkout`}
          </button>
        </div>
      </form>
    </div>
  )
}

const globalStyles = `
  body { background: var(--bg); color: var(--ink); font-family: var(--sans); }
  .store-shell { min-height: 100vh; }
  .store-topbar {
    height: 56px; background: var(--surface); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; padding: 0 24px; gap: 18px;
  }
  .store-home {
    color: var(--ink-2); text-decoration: none; font-size: 12px;
  }
  .store-home:hover { color: var(--ink); }
  .store-logo {
    font-family: var(--serif); font-size: 22px; color: var(--ink);
  }
  .store-logo em { font-style: italic; color: var(--accent); }
  .store-suffix {
    font-size: 11px; color: var(--ink-3); letter-spacing: 0.08em;
    text-transform: uppercase; padding-left: 12px; border-left: 1px solid var(--border);
  }
  .store-signin, .store-account {
    margin-left: auto; padding: 7px 14px; background: var(--surface);
    border: 1px solid var(--border-strong); border-radius: 4px; color: var(--ink-2);
    font-size: 12px; font-weight: 500; cursor: pointer; font-family: var(--sans);
    text-decoration: none; transition: all 0.15s;
  }
  .store-signin:hover, .store-account:hover { border-color: var(--ink-3); color: var(--ink); }
  .store-main { max-width: 880px; margin: 0 auto; padding: 32px 24px; }
  .store-title {
    font-family: var(--serif); font-size: 36px; color: var(--ink); margin-bottom: 6px; line-height: 1.1;
  }
  .store-sub { color: var(--ink-2); font-size: 14px; margin-bottom: 28px; }
  .store-loading, .empty-state {
    text-align: center; padding: 60px 24px; color: var(--ink-3); font-size: 13px;
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
  }
  .banner-error {
    padding: 10px 14px; background: var(--danger-soft); border: 1px solid var(--danger);
    border-radius: 6px; color: var(--danger); font-size: 12px; margin-bottom: 16px;
  }
  .sku-grid {
    display: grid; gap: 14px; grid-template-columns: 1fr;
  }
  @media (min-width: 720px) {
    .sku-grid { grid-template-columns: 1fr 1fr; }
  }
  .sku-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
    padding: 22px 22px 18px; display: flex; flex-direction: column; gap: 6px;
  }
  .sku-kind {
    font-size: 10px; font-weight: 600; color: var(--ink-3); letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .sku-name {
    font-family: var(--serif); font-size: 26px; color: var(--ink); line-height: 1.15;
  }
  .sku-sub { color: var(--ink-2); font-size: 13px; line-height: 1.5; }
  .sku-price {
    font-size: 24px; font-weight: 600; color: var(--accent); margin-top: 8px;
  }
  .sku-hint { color: var(--ink-3); font-size: 11px; }
  .sku-buy {
    margin-top: 12px; padding: 11px 14px; background: var(--ink); color: #fff; border: none;
    border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: var(--sans);
    letter-spacing: 0.02em; transition: background 0.15s;
  }
  .sku-buy:hover { background: var(--ink-2); }
  .dialog-overlay {
    position: fixed; inset: 0; background: rgba(26,24,20,.55); z-index: 1100;
    display: flex; align-items: center; justify-content: center; padding: 16px;
    backdrop-filter: blur(2px);
  }
  .dialog-card {
    width: 100%; max-width: 420px; background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; padding: 24px; box-shadow: 0 16px 48px -16px rgba(26,24,20,.35);
  }
  .dialog-eyebrow {
    font-size: 11px; color: var(--ink-3); letter-spacing: 0.06em; margin-bottom: 4px;
    text-transform: uppercase; font-family: var(--mono);
  }
  .dialog-title {
    font-family: var(--serif); font-size: 24px; color: var(--ink); margin-bottom: 16px; line-height: 1.2;
    font-weight: 400;
  }
  .dialog-label {
    display: block; font-size: 10px; font-weight: 600; color: var(--ink-3);
    letter-spacing: 0.1em; text-transform: uppercase; margin: 14px 0 6px;
  }
  .dialog-input {
    width: 100%; padding: 9px 12px; background: var(--surface); border: 1px solid var(--border-strong);
    border-radius: 4px; color: var(--ink); font-size: 13px; font-family: var(--sans);
  }
  .dialog-input:focus { outline: none; border-color: var(--accent); }
  .dialog-hint { font-size: 11px; color: var(--ink-3); margin-top: 4px; }
  .dialog-error {
    margin-top: 12px; padding: 8px 10px; background: var(--danger-soft);
    border: 1px solid var(--danger); border-radius: 4px; color: var(--danger); font-size: 12px;
  }
  .dialog-actions {
    display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px;
  }
  .btn-primary, .btn-secondary {
    padding: 10px 16px; font-size: 13px; font-weight: 600; border-radius: 6px;
    cursor: pointer; font-family: var(--sans); border: 1px solid transparent;
    transition: all 0.15s;
  }
  .btn-primary { background: var(--ink); color: #fff; border-color: var(--ink); }
  .btn-primary:hover:not(:disabled) { background: var(--ink-2); }
  .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
  .btn-secondary {
    background: var(--surface); color: var(--ink-2); border-color: var(--border-strong);
  }
  .btn-secondary:hover:not(:disabled) { color: var(--ink); border-color: var(--ink-3); }
`
