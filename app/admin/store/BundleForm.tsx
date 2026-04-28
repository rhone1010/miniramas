'use client'

import { useState } from 'react'
import type { Bundle, BundleInput, BundleItemInput, ChooseOption } from '@/lib/bundles/types'
import { VARIANTS_BY_STYLE } from '@/lib/v1/group-generator'
import type { SceneStyle, SceneVariant } from '@/lib/v1/group-generator'

const STYLES = Object.keys(VARIANTS_BY_STYLE) as SceneStyle[]
const STYLE_LABELS: Record<SceneStyle, string> = {
  figurine:    'Figurine',
  plushy:      'Plushy',
  stop_motion: 'Stop Motion',
  designer:    'Designer',
}

function defaultVariantFor(style: SceneStyle): SceneVariant {
  return VARIANTS_BY_STYLE[style][0].key
}

function newFixedItem(): BundleItemInput {
  return {
    mode:         'fixed',
    fixedStyle:   'figurine',
    fixedVariant: defaultVariantFor('figurine'),
  }
}

function newChooseItem(): BundleItemInput {
  return {
    mode:        'choose',
    chooseLabel: 'Pick a style',
    chooseOptions: [
      { style: 'figurine', variant: defaultVariantFor('figurine'), label: 'Figurine' },
    ],
  }
}

interface Props {
  bundle: Bundle | null
  existingSlugs: string[]
  nextDisplayOrder: number
  onCancel: () => void
  onSave: (input: BundleInput, existingId?: string) => Promise<string | null>
  busy: boolean
}

export default function BundleForm({ bundle, existingSlugs, nextDisplayOrder, onCancel, onSave, busy }: Props) {
  const [slug,         setSlug]         = useState(bundle?.slug ?? '')
  const [name,         setName]         = useState(bundle?.name ?? '')
  const [tagline,      setTagline]      = useState(bundle?.tagline ?? '')
  const [priceCents,   setPriceCents]   = useState<number>(bundle?.priceCents ?? 0)
  const [isActive,     setIsActive]     = useState(bundle?.isActive ?? false)
  const [items,        setItems]        = useState<BundleItemInput[]>(
    bundle?.items.map((it) => ({
      mode:          it.mode,
      fixedStyle:    it.fixedStyle,
      fixedVariant:  it.fixedVariant,
      chooseLabel:   it.chooseLabel,
      chooseOptions: it.chooseOptions ? [...it.chooseOptions] : undefined,
    })) ?? [newFixedItem()],
  )
  const [error, setError] = useState<string | null>(null)

  function updateItem(idx: number, patch: Partial<BundleItemInput>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function changeItemMode(idx: number, mode: 'fixed' | 'choose') {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it
        return mode === 'fixed' ? newFixedItem() : newChooseItem()
      }),
    )
  }

  function moveItem(idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    setItems(next)
  }

  function removeItem(idx: number) {
    if (items.length === 1) {
      setError('Bundle must have at least one item.')
      return
    }
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function addItem(mode: 'fixed' | 'choose') {
    setItems((prev) => [...prev, mode === 'fixed' ? newFixedItem() : newChooseItem()])
  }

  function updateChooseOption(itemIdx: number, optIdx: number, patch: Partial<ChooseOption>) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== itemIdx || it.mode !== 'choose') return it
        const opts = (it.chooseOptions ?? []).map((o, j) => (j === optIdx ? { ...o, ...patch } : o))
        return { ...it, chooseOptions: opts }
      }),
    )
  }

  function addChooseOption(itemIdx: number) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== itemIdx || it.mode !== 'choose') return it
        const opts = [...(it.chooseOptions ?? []), {
          style:   'figurine' as SceneStyle,
          variant: defaultVariantFor('figurine'),
          label:   STYLE_LABELS.figurine,
        }]
        return { ...it, chooseOptions: opts }
      }),
    )
  }

  function removeChooseOption(itemIdx: number, optIdx: number) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== itemIdx || it.mode !== 'choose') return it
        const opts = (it.chooseOptions ?? []).filter((_, j) => j !== optIdx)
        if (opts.length === 0) return it // keep at least one
        return { ...it, chooseOptions: opts }
      }),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const slugTrim = slug.trim()
    if (!/^[a-z0-9-]+$/.test(slugTrim)) {
      setError('Slug must use lowercase letters, numbers, and dashes only.')
      return
    }
    if (existingSlugs.includes(slugTrim)) {
      setError('That slug is already taken.')
      return
    }
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (!Number.isInteger(priceCents) || priceCents < 0) {
      setError('Price must be a non-negative integer (cents).')
      return
    }

    const input: BundleInput = {
      slug:         slugTrim,
      name:         name.trim(),
      tagline:      tagline.trim() || null,
      priceCents,
      displayOrder: bundle ? bundle.displayOrder : nextDisplayOrder,
      isActive,
      items,
    }

    const saveError = await onSave(input, bundle?.id)
    if (saveError) setError(saveError)
  }

  return (
    <div className="form-shell">
      <header className="form-topbar">
        <div className="form-logo">
          mini<em>Rama</em>
          <span className="form-suffix">{bundle ? 'Edit bundle' : 'New bundle'}</span>
        </div>
        <button type="button" className="form-cancel" onClick={onCancel} disabled={busy}>← Back</button>
      </header>

      <form onSubmit={handleSubmit} className="form-main">

        <section className="form-section">
          <div className="form-row">
            <div className="form-col">
              <label className="form-label">Slug</label>
              <input
                className="form-input"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="starter"
                pattern="[a-z0-9-]+"
                required
              />
              <div className="form-hint">URL-safe: lowercase letters, numbers, dashes.</div>
            </div>
            <div className="form-col">
              <label className="form-label">Name</label>
              <input
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="The Starter Bundle"
                required
              />
            </div>
          </div>

          <label className="form-label" style={{ marginTop: 14 }}>Tagline</label>
          <textarea
            className="form-input"
            rows={2}
            value={tagline ?? ''}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Optional — shown to customers under the bundle name."
          />

          <div className="form-row" style={{ marginTop: 14 }}>
            <div className="form-col">
              <label className="form-label">Price (cents) — e.g. 999 for $9.99</label>
              <input
                className="form-input"
                type="number"
                min={0}
                step={1}
                value={priceCents}
                onChange={(e) => setPriceCents(parseInt(e.target.value, 10) || 0)}
                required
              />
              <div className="form-hint">${(priceCents / 100).toFixed(2)}</div>
            </div>
            <div className="form-col">
              <label className="form-label">Status</label>
              <label className="form-toggle">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>{isActive ? 'Active (visible to customers)' : 'Inactive (hidden)'}</span>
              </label>
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-head">
            <h2 className="form-h2">Items</h2>
            <div className="form-section-meta">{items.length} item{items.length === 1 ? '' : 's'}</div>
          </div>
          <p className="form-hint" style={{ marginBottom: 14 }}>
            Each item produces one image. Use &quot;Fixed&quot; for a specific (style, variant) pair, or &quot;Choose&quot; to let the customer pick from a list of options.
          </p>

          <div className="items-list">
            {items.map((item, idx) => (
              <ItemEditor
                key={idx}
                idx={idx}
                item={item}
                isFirst={idx === 0}
                isLast={idx === items.length - 1}
                onChangeMode={(m) => changeItemMode(idx, m)}
                onUpdate={(p) => updateItem(idx, p)}
                onUpdateOption={(j, p) => updateChooseOption(idx, j, p)}
                onAddOption={() => addChooseOption(idx)}
                onRemoveOption={(j) => removeChooseOption(idx, j)}
                onMoveUp={() => moveItem(idx, -1)}
                onMoveDown={() => moveItem(idx, 1)}
                onRemove={() => removeItem(idx)}
                canRemove={items.length > 1}
              />
            ))}
          </div>

          <div className="add-item-row">
            <button type="button" className="btn-secondary" onClick={() => addItem('fixed')}>+ Fixed item</button>
            <button type="button" className="btn-secondary" onClick={() => addItem('choose')}>+ Choose item</button>
          </div>
        </section>

        {error && <div className="banner-error">{error}</div>}

        <div className="form-footer">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : bundle ? 'Save changes' : 'Create bundle'}
          </button>
        </div>
      </form>

      <style jsx global>{formStyles}</style>
    </div>
  )
}

function ItemEditor({
  idx, item, isFirst, isLast, canRemove,
  onChangeMode, onUpdate, onUpdateOption, onAddOption, onRemoveOption,
  onMoveUp, onMoveDown, onRemove,
}: {
  idx: number
  item: BundleItemInput
  isFirst: boolean
  isLast: boolean
  canRemove: boolean
  onChangeMode: (m: 'fixed' | 'choose') => void
  onUpdate: (patch: Partial<BundleItemInput>) => void
  onUpdateOption: (optIdx: number, patch: Partial<ChooseOption>) => void
  onAddOption: () => void
  onRemoveOption: (optIdx: number) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}) {
  return (
    <div className="item-card">
      <div className="item-head">
        <div className="item-head-left">
          <span className="item-num">{idx + 1}</span>
          <div className="item-mode-tabs">
            <button
              type="button"
              className={`item-mode-tab ${item.mode === 'fixed' ? 'on' : ''}`}
              onClick={() => onChangeMode('fixed')}
            >Fixed</button>
            <button
              type="button"
              className={`item-mode-tab ${item.mode === 'choose' ? 'on' : ''}`}
              onClick={() => onChangeMode('choose')}
            >Choose</button>
          </div>
        </div>
        <div className="item-head-right">
          <button type="button" className="icon-btn" onClick={onMoveUp} disabled={isFirst} title="Move up">▲</button>
          <button type="button" className="icon-btn" onClick={onMoveDown} disabled={isLast} title="Move down">▼</button>
          <button type="button" className="icon-btn icon-btn-danger" onClick={onRemove} disabled={!canRemove} title="Remove">×</button>
        </div>
      </div>

      {item.mode === 'fixed' ? (
        <div className="form-row">
          <div className="form-col">
            <label className="form-label">Style</label>
            <select
              className="form-input"
              value={item.fixedStyle ?? 'figurine'}
              onChange={(e) => {
                const style = e.target.value as SceneStyle
                onUpdate({ fixedStyle: style, fixedVariant: defaultVariantFor(style) })
              }}
            >
              {STYLES.map((s) => (
                <option key={s} value={s}>{STYLE_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="form-col">
            <label className="form-label">Variant</label>
            <select
              className="form-input"
              value={item.fixedVariant ?? defaultVariantFor(item.fixedStyle ?? 'figurine')}
              onChange={(e) => onUpdate({ fixedVariant: e.target.value as SceneVariant })}
            >
              {VARIANTS_BY_STYLE[item.fixedStyle ?? 'figurine'].map((v) => (
                <option key={v.key} value={v.key}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div>
          <label className="form-label">Choice label (shown to customer)</label>
          <input
            className="form-input"
            value={item.chooseLabel ?? ''}
            onChange={(e) => onUpdate({ chooseLabel: e.target.value })}
            placeholder="Pick a style"
          />

          <div className="form-label" style={{ marginTop: 14 }}>Options</div>
          <div className="options-list">
            {(item.chooseOptions ?? []).map((opt, j) => (
              <div className="option-row" key={j}>
                <select
                  className="form-input form-input-sm"
                  value={opt.style}
                  onChange={(e) => {
                    const style = e.target.value as SceneStyle
                    onUpdateOption(j, { style, variant: defaultVariantFor(style) })
                  }}
                >
                  {STYLES.map((s) => (
                    <option key={s} value={s}>{STYLE_LABELS[s]}</option>
                  ))}
                </select>
                <select
                  className="form-input form-input-sm"
                  value={opt.variant}
                  onChange={(e) => onUpdateOption(j, { variant: e.target.value as SceneVariant })}
                >
                  {VARIANTS_BY_STYLE[opt.style].map((v) => (
                    <option key={v.key} value={v.key}>{v.label}</option>
                  ))}
                </select>
                <input
                  className="form-input form-input-sm"
                  value={opt.label}
                  onChange={(e) => onUpdateOption(j, { label: e.target.value })}
                  placeholder="Label"
                />
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  onClick={() => onRemoveOption(j)}
                  disabled={(item.chooseOptions?.length ?? 0) <= 1}
                  title="Remove option"
                >×</button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-secondary" onClick={onAddOption} style={{ marginTop: 8 }}>
            + Option
          </button>
        </div>
      )}
    </div>
  )
}

const formStyles = `
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: var(--sans);
  }
  .form-shell {
    min-height: 100vh;
    background: var(--bg);
  }
  .form-topbar {
    height: 56px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
  }
  .form-logo {
    font-family: var(--serif);
    font-size: 22px;
    color: var(--ink);
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
  .form-logo em {
    font-style: italic;
    color: var(--accent);
  }
  .form-suffix {
    font-family: var(--sans);
    font-size: 11px;
    color: var(--ink-3);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding-left: 12px;
    border-left: 1px solid var(--border);
  }
  .form-cancel {
    padding: 7px 14px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    color: var(--ink-2);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--sans);
  }
  .form-cancel:hover:not(:disabled) {
    border-color: var(--ink-3);
    color: var(--ink);
  }
  .form-main {
    max-width: 760px;
    margin: 0 auto;
    padding: 28px 24px 80px;
  }
  .form-section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px 22px;
    margin-bottom: 16px;
  }
  .form-section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .form-h2 {
    font-family: var(--serif);
    font-size: 22px;
    color: var(--ink);
  }
  .form-section-meta {
    font-size: 11px;
    color: var(--ink-3);
    font-family: var(--mono);
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .form-col {
    min-width: 0;
  }
  .form-label {
    display: block;
    font-size: 10px;
    font-weight: 600;
    color: var(--ink-3);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .form-input {
    width: 100%;
    padding: 9px 12px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    color: var(--ink);
    font-size: 13px;
    font-family: var(--sans);
    transition: border-color 0.15s;
  }
  .form-input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .form-input-sm {
    padding: 7px 10px;
    font-size: 12px;
  }
  textarea.form-input {
    resize: vertical;
    line-height: 1.5;
  }
  .form-hint {
    font-size: 11px;
    color: var(--ink-3);
    margin-top: 4px;
  }
  .form-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 0;
    font-size: 13px;
    color: var(--ink-2);
    cursor: pointer;
  }
  .form-toggle input {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
  .items-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .item-card {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 14px;
  }
  .item-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .item-head-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .item-num {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    background: var(--accent);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .item-mode-tabs {
    display: flex;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    overflow: hidden;
  }
  .item-mode-tab {
    padding: 5px 12px;
    background: transparent;
    border: none;
    color: var(--ink-2);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--sans);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    transition: all 0.12s;
  }
  .item-mode-tab.on {
    background: var(--accent);
    color: #fff;
  }
  .item-head-right {
    display: flex;
    gap: 4px;
  }
  .icon-btn {
    width: 28px;
    height: 28px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    color: var(--ink-2);
    font-size: 11px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--sans);
    transition: all 0.12s;
  }
  .icon-btn:hover:not(:disabled) {
    border-color: var(--ink-3);
    color: var(--ink);
  }
  .icon-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .icon-btn-danger:hover:not(:disabled) {
    border-color: var(--danger);
    color: var(--danger);
    background: var(--danger-soft);
  }
  .options-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .option-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 32px;
    gap: 6px;
    align-items: center;
  }
  .add-item-row {
    display: flex;
    gap: 8px;
    margin-top: 14px;
  }
  .form-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
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
  .banner-error {
    padding: 10px 14px;
    background: var(--danger-soft);
    border: 1px solid var(--danger);
    border-radius: 6px;
    color: var(--danger);
    font-size: 12px;
    margin-bottom: 12px;
  }
  @media (max-width: 600px) {
    .form-main {
      padding: 20px 16px 80px;
    }
    .form-section {
      padding: 16px;
    }
    .form-row {
      grid-template-columns: 1fr;
    }
    .option-row {
      grid-template-columns: 1fr 1fr 32px;
      grid-template-rows: auto auto;
    }
    .option-row > input {
      grid-column: 1 / -1;
      grid-row: 2;
    }
  }
`
