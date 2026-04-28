'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Bundle, BundleInput } from '@/lib/bundles/types'
import BundleForm from './BundleForm'

type Mode =
  | { kind: 'list' }
  | { kind: 'new' }
  | { kind: 'edit'; bundle: Bundle }

export default function AdminStorePage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [bundles, setBundles] = useState<Bundle[] | null>(null)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadBundles = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/admin/bundles', { cache: 'no-store' })
      if (res.status === 401) {
        router.push('/admin/login')
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setBundles(data.bundles)
      setAuthChecked(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setAuthChecked(true)
    }
  }, [router])

  useEffect(() => { loadBundles() }, [loadBundles])

  async function handleLogout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  async function handleSave(input: BundleInput, existingId?: string): Promise<string | null> {
    setBusy(true)
    try {
      const url = existingId ? `/api/admin/bundles/${existingId}` : '/api/admin/bundles'
      const method = existingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.error === 'slug_already_exists') return 'A bundle with that slug already exists.'
        if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
          return data.errors.map((e: { field: string; message: string }) => `${e.field}: ${e.message}`).join('; ')
        }
        return data.error || `HTTP ${res.status}`
      }
      await loadBundles()
      setMode({ kind: 'list' })
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Save failed'
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this bundle? This cannot be undone.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/bundles/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(`Delete failed: ${data.error || res.status}`)
        return
      }
      await loadBundles()
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleActive(b: Bundle) {
    setBusy(true)
    try {
      const input: BundleInput = {
        slug:         b.slug,
        name:         b.name,
        tagline:      b.tagline,
        priceCents:   b.priceCents,
        displayOrder: b.displayOrder,
        isActive:     !b.isActive,
        items: b.items.map((it) => ({
          mode:          it.mode,
          fixedStyle:    it.fixedStyle,
          fixedVariant:  it.fixedVariant,
          chooseLabel:   it.chooseLabel,
          chooseOptions: it.chooseOptions,
        })),
      }
      const res = await fetch(`/api/admin/bundles/${b.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(input),
      })
      if (!res.ok) alert('Toggle failed.')
      await loadBundles()
    } finally {
      setBusy(false)
    }
  }

  async function moveBundle(idx: number, dir: -1 | 1) {
    if (!bundles) return
    const j = idx + dir
    if (j < 0 || j >= bundles.length) return
    const sorted = [...bundles].sort((a, b) => a.displayOrder - b.displayOrder)
    ;[sorted[idx], sorted[j]] = [sorted[j], sorted[idx]]
    const order = sorted.map((b, i) => ({ id: b.id, displayOrder: i }))
    setBusy(true)
    try {
      const res = await fetch('/api/admin/bundles/reorder', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ order }),
      })
      if (!res.ok) alert('Reorder failed.')
      await loadBundles()
    } finally {
      setBusy(false)
    }
  }

  if (!authChecked) {
    return (
      <div className="loading-shell">
        <div className="loading-text">Loading…</div>
        <style jsx global>{globalStyles}</style>
      </div>
    )
  }

  if (mode.kind === 'new' || mode.kind === 'edit') {
    return (
      <>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap"
        />
        <BundleForm
          bundle={mode.kind === 'edit' ? mode.bundle : null}
          existingSlugs={(bundles ?? [])
            .filter((b) => mode.kind === 'edit' ? b.id !== mode.bundle.id : true)
            .map((b) => b.slug)}
          nextDisplayOrder={
            mode.kind === 'new'
              ? Math.max(0, ...((bundles ?? []).map((b) => b.displayOrder + 1)))
              : mode.bundle.displayOrder
          }
          onCancel={() => setMode({ kind: 'list' })}
          onSave={handleSave}
          busy={busy}
        />
        <style jsx global>{globalStyles}</style>
      </>
    )
  }

  const sortedBundles = (bundles ?? []).slice().sort((a, b) => a.displayOrder - b.displayOrder)

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap"
      />
      <div className="admin-shell">
        <header className="admin-topbar">
          <div className="admin-logo">
            mini<em>Rama</em>
            <span className="admin-logo-suffix">Admin · Bundles</span>
          </div>
          <button className="admin-logout" onClick={handleLogout}>Sign out</button>
        </header>

        <main className="admin-main">
          <div className="admin-header-row">
            <div>
              <h1 className="admin-title">Bundle catalog</h1>
              <p className="admin-sub">{sortedBundles.length} bundle{sortedBundles.length === 1 ? '' : 's'} · only active bundles appear to customers.</p>
            </div>
            <button className="btn-primary" onClick={() => setMode({ kind: 'new' })} disabled={busy}>
              + New bundle
            </button>
          </div>

          {error && <div className="banner-error">{error}</div>}

          {sortedBundles.length === 0 ? (
            <div className="empty">
              <div className="empty-title">No bundles yet</div>
              <div className="empty-sub">Click &quot;New bundle&quot; to create your first one.</div>
            </div>
          ) : (
            <div className="bundle-list">
              {sortedBundles.map((b, idx) => (
                <BundleCard
                  key={b.id}
                  bundle={b}
                  isFirst={idx === 0}
                  isLast={idx === sortedBundles.length - 1}
                  busy={busy}
                  onEdit={() => setMode({ kind: 'edit', bundle: b })}
                  onDelete={() => handleDelete(b.id)}
                  onToggle={() => handleToggleActive(b)}
                  onMoveUp={() => moveBundle(idx, -1)}
                  onMoveDown={() => moveBundle(idx, 1)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
      <style jsx global>{globalStyles}</style>
    </>
  )
}

function BundleCard({
  bundle, isFirst, isLast, busy, onEdit, onDelete, onToggle, onMoveUp, onMoveDown,
}: {
  bundle: Bundle
  isFirst: boolean
  isLast: boolean
  busy: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const dollars = (bundle.priceCents / 100).toFixed(2)
  return (
    <div className={`bundle-card ${bundle.isActive ? 'is-active' : 'is-inactive'}`}>
      <div className="bundle-card-reorder">
        <button onClick={onMoveUp} disabled={busy || isFirst} title="Move up">▲</button>
        <button onClick={onMoveDown} disabled={busy || isLast} title="Move down">▼</button>
      </div>

      <div className="bundle-card-main">
        <div className="bundle-card-head">
          <div>
            <div className="bundle-name">{bundle.name}</div>
            {bundle.tagline && <div className="bundle-tagline">{bundle.tagline}</div>}
            <div className="bundle-meta">
              <span className="bundle-slug">{bundle.slug}</span>
              <span className="bundle-dot">·</span>
              <span>{bundle.items.length} item{bundle.items.length === 1 ? '' : 's'}</span>
              <span className="bundle-dot">·</span>
              <span className="bundle-price">${dollars}</span>
              <span className="bundle-cents">({bundle.priceCents} cents)</span>
            </div>
          </div>
          <div className={`bundle-status ${bundle.isActive ? 'on' : 'off'}`}>
            {bundle.isActive ? 'Active' : 'Inactive'}
          </div>
        </div>

        <div className="bundle-items">
          {bundle.items.map((it, i) => (
            <div className="bundle-item-pill" key={it.id}>
              <span className="bundle-item-pos">{i + 1}</span>
              {it.mode === 'fixed' ? (
                <span>{it.fixedStyle} · {it.fixedVariant}</span>
              ) : (
                <span>Choose: {it.chooseLabel || `${it.chooseOptions?.length ?? 0} options`}</span>
              )}
            </div>
          ))}
        </div>

        <div className="bundle-actions">
          <button className="btn-secondary" onClick={onToggle} disabled={busy}>
            {bundle.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button className="btn-secondary" onClick={onEdit} disabled={busy}>Edit</button>
          <button className="btn-danger" onClick={onDelete} disabled={busy}>Delete</button>
        </div>
      </div>
    </div>
  )
}

const globalStyles = `
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: var(--sans);
  }
  .loading-shell {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .loading-text {
    color: var(--ink-3);
    font-size: 13px;
  }
  .admin-shell {
    min-height: 100vh;
    background: var(--bg);
  }
  .admin-topbar {
    height: 56px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
  }
  .admin-logo {
    font-family: var(--serif);
    font-size: 22px;
    color: var(--ink);
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
  .admin-logo em {
    font-style: italic;
    color: var(--accent);
  }
  .admin-logo-suffix {
    font-family: var(--sans);
    font-size: 11px;
    color: var(--ink-3);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding-left: 12px;
    border-left: 1px solid var(--border);
  }
  .admin-logout {
    padding: 7px 14px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    color: var(--ink-2);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--sans);
    transition: all 0.15s;
  }
  .admin-logout:hover {
    border-color: var(--ink-3);
    color: var(--ink);
  }
  .admin-main {
    max-width: 920px;
    margin: 0 auto;
    padding: 32px 24px;
  }
  .admin-header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 20px;
    margin-bottom: 24px;
  }
  .admin-title {
    font-family: var(--serif);
    font-size: 32px;
    color: var(--ink);
    line-height: 1.1;
    margin-bottom: 6px;
  }
  .admin-sub {
    font-size: 12px;
    color: var(--ink-3);
  }
  .btn-primary {
    padding: 10px 16px;
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
    white-space: nowrap;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--ink-2);
  }
  .btn-primary:disabled {
    background: var(--surface-2);
    color: var(--ink-3);
    cursor: not-allowed;
  }
  .btn-secondary {
    padding: 7px 12px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    color: var(--ink-2);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--sans);
    transition: all 0.15s;
  }
  .btn-secondary:hover:not(:disabled) {
    border-color: var(--ink-3);
    color: var(--ink);
  }
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-danger {
    padding: 7px 12px;
    background: var(--surface);
    border: 1px solid var(--danger);
    border-radius: 4px;
    color: var(--danger);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--sans);
    transition: all 0.15s;
  }
  .btn-danger:hover:not(:disabled) {
    background: var(--danger-soft);
  }
  .btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .banner-error {
    padding: 10px 14px;
    background: var(--danger-soft);
    border: 1px solid var(--danger);
    border-radius: 6px;
    color: var(--danger);
    font-size: 12px;
    margin-bottom: 16px;
  }
  .empty {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 60px 24px;
    text-align: center;
  }
  .empty-title {
    font-family: var(--serif);
    font-size: 24px;
    color: var(--ink);
    margin-bottom: 6px;
  }
  .empty-sub {
    font-size: 13px;
    color: var(--ink-3);
  }
  .bundle-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .bundle-card {
    display: flex;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    transition: opacity 0.15s;
  }
  .bundle-card.is-inactive {
    opacity: 0.65;
  }
  .bundle-card-reorder {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border);
    background: var(--surface-2);
  }
  .bundle-card-reorder button {
    flex: 1;
    width: 32px;
    background: transparent;
    border: none;
    color: var(--ink-3);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.12s;
  }
  .bundle-card-reorder button:first-child {
    border-bottom: 1px solid var(--border);
  }
  .bundle-card-reorder button:hover:not(:disabled) {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .bundle-card-reorder button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .bundle-card-main {
    flex: 1;
    padding: 16px 18px;
  }
  .bundle-card-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }
  .bundle-name {
    font-family: var(--serif);
    font-size: 22px;
    color: var(--ink);
    line-height: 1.2;
    margin-bottom: 2px;
  }
  .bundle-tagline {
    font-size: 13px;
    color: var(--ink-2);
    font-style: italic;
    font-family: var(--serif);
    margin-bottom: 6px;
  }
  .bundle-meta {
    font-size: 11px;
    color: var(--ink-3);
    font-family: var(--mono);
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .bundle-slug {
    background: var(--surface-2);
    padding: 1px 6px;
    border-radius: 3px;
  }
  .bundle-dot {
    color: var(--border-strong);
  }
  .bundle-price {
    color: var(--ink);
    font-weight: 600;
  }
  .bundle-cents {
    color: var(--ink-3);
  }
  .bundle-status {
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .bundle-status.on {
    background: var(--success-soft);
    color: var(--success);
    border: 1px solid var(--success);
  }
  .bundle-status.off {
    background: var(--surface-2);
    color: var(--ink-3);
    border: 1px solid var(--border-strong);
  }
  .bundle-items {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
  }
  .bundle-item-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px 3px 4px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 11px;
    color: var(--ink-2);
    font-family: var(--mono);
  }
  .bundle-item-pos {
    width: 18px;
    height: 18px;
    border-radius: 3px;
    background: var(--accent);
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--sans);
  }
  .bundle-actions {
    display: flex;
    gap: 6px;
  }
  @media (max-width: 600px) {
    .admin-main {
      padding: 20px 16px;
    }
    .admin-title {
      font-size: 26px;
    }
    .admin-header-row {
      flex-direction: column;
      align-items: stretch;
    }
    .bundle-card-head {
      flex-direction: column;
    }
  }
`
