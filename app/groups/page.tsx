'use client'

import { useEffect, useState } from 'react'
import type { Bundle, BundleItem, ChooseOption } from '@/lib/bundles/types'
import type { SceneStyle, SceneVariant } from '@/lib/v1/group-generator'

// ── TYPES ────────────────────────────────────────────────────────

interface AnalyzeResult {
  tier:          string
  proceedable:   boolean
  message:       string
  warnings?:     string[]
  subject_count: number
  error?:        string
}

interface ResultCard {
  id:        string
  itemId:    string
  style:     SceneStyle
  variant:   SceneVariant
  state:     'loading' | 'done' | 'error'
  imageUrl?: string
  moodLabel?: string
  warning?:  string | null
  error?:    string
}

type Phase =
  | 'idle'           // waiting for upload
  | 'analyzing'      // analyze running
  | 'analysis-error' // analyze failed / not proceedable
  | 'picking'        // bundles loaded, choosing one
  | 'choosing'       // bundle picked, working through choose-items
  | 'confirming'     // choices done, plaque+notes+confirm visible
  | 'generating'     // results streaming in

const STYLE_LABELS: Record<SceneStyle, string> = {
  figurine:    'Figurine',
  plushy:      'Plushy',
  stop_motion: 'Stop Motion',
  designer:    'Designer',
}

// ── PAGE ─────────────────────────────────────────────────────────

export default function GroupsPage() {
  const [phase, setPhase] = useState<Phase>('idle')

  const [fileB64,     setFileB64]     = useState<string | null>(null)
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null)
  const [analyze,     setAnalyze]     = useState<AnalyzeResult | null>(null)
  const [analyzeErr,  setAnalyzeErr]  = useState<string | null>(null)

  const [bundles,         setBundles]         = useState<Bundle[] | null>(null)
  const [bundlesLoadErr,  setBundlesLoadErr]  = useState<string | null>(null)
  const [bundle,          setBundle]          = useState<Bundle | null>(null)
  const [choices,         setChoices]         = useState<Record<string, ChooseOption>>({})

  const [plaqueTitle, setPlaqueTitle] = useState('')
  const [noPlaque,    setNoPlaque]    = useState(false)
  const [notes,       setNotes]       = useState('')
  const [optionsOpen, setOptionsOpen] = useState(false)

  const [stack,    setStack]    = useState<ResultCard[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  // Lazy-load bundles when the user reaches a state that needs them.
  useEffect(() => {
    if (bundles !== null || bundlesLoadErr) return
    if (phase !== 'picking' && phase !== 'choosing' && phase !== 'confirming' && phase !== 'generating') return
    void (async () => {
      try {
        const res = await fetch('/api/v1/bundles', { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setBundles(data.bundles ?? [])
      } catch (e) {
        setBundlesLoadErr(e instanceof Error ? e.message : 'Failed to load bundles')
      }
    })()
  }, [phase, bundles, bundlesLoadErr])

  // ── upload + analyze ───────────────────────────────────────────

  async function onUpload(file: File) {
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      const b64 = dataUrl.split(',')[1]
      setFileB64(b64)
      setPreviewUrl(dataUrl)
      setPhase('analyzing')
      setAnalyze(null)
      setAnalyzeErr(null)
      try {
        const res = await fetch('/api/v1/groups/analyze', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ image_b64: b64 }),
        })
        const data = await res.json()
        if (data.error) {
          setAnalyzeErr(data.error)
          setPhase('analysis-error')
          return
        }
        setAnalyze(data)
        if (!data.proceedable) {
          setPhase('analysis-error')
        } else {
          setPhase('picking')
        }
      } catch (e) {
        setAnalyzeErr(e instanceof Error ? e.message : 'Network error')
        setPhase('analysis-error')
      }
    }
    reader.readAsDataURL(file)
  }

  function startOver() {
    setPhase('idle')
    setFileB64(null)
    setPreviewUrl(null)
    setAnalyze(null)
    setAnalyzeErr(null)
    setBundle(null)
    setChoices({})
    setPlaqueTitle('')
    setNoPlaque(false)
    setNotes('')
    setOptionsOpen(false)
    setStack([])
    setActiveId(null)
  }

  // ── bundle pick & choose flow ──────────────────────────────────

  function pickBundle(b: Bundle) {
    setBundle(b)
    setChoices({})
    const hasChoose = b.items.some((it) => it.mode === 'choose')
    setPhase(hasChoose ? 'choosing' : 'confirming')
  }

  function changeBundle() {
    setBundle(null)
    setChoices({})
    setPhase('picking')
  }

  function chooseOption(item: BundleItem, opt: ChooseOption) {
    setChoices((prev) => ({ ...prev, [item.id]: opt }))
  }

  // Move from 'choosing' to 'confirming' once all choose-items have a pick.
  useEffect(() => {
    if (phase !== 'choosing' || !bundle) return
    const allChosen = bundle.items
      .filter((it) => it.mode === 'choose')
      .every((it) => choices[it.id])
    if (allChosen) setPhase('confirming')
  }, [phase, bundle, choices])

  // ── confirm + generate ─────────────────────────────────────────

  async function confirmAndPay() {
    if (!bundle || !fileB64) return
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[groups] payment TODO skipped in dev — proceeding directly to generation')
    }
    // TODO: payment confirmation here — owned by store/billing chat
    setPhase('generating')
    fireBundle(bundle)
  }

  function fireBundle(b: Bundle) {
    const placeholders: ResultCard[] = b.items.map((it) => {
      const resolved = resolveItem(it)
      return {
        id:      makeCardId(),
        itemId:  it.id,
        style:   resolved.style,
        variant: resolved.variant,
        state:   'loading',
      }
    })
    setStack((prev) => [...placeholders, ...prev])
    setActiveId(placeholders[0]?.id ?? null)
    placeholders.forEach((card) => {
      void fireOne(card)
    })
  }

  function resolveItem(it: BundleItem): { style: SceneStyle; variant: SceneVariant } {
    if (it.mode === 'fixed') {
      return { style: it.fixedStyle!, variant: it.fixedVariant! }
    }
    const opt = choices[it.id]
    return { style: opt.style, variant: opt.variant }
  }

  async function fireOne(card: ResultCard) {
    const body = {
      source_image_b64: fileB64,
      plaque_title:     plaqueTitle.trim() || undefined,
      no_plaque:        noPlaque,
      scene_style:      card.style,
      scene_variant:    card.variant,
      notes:            notes.trim() || undefined,
    }
    try {
      const res = await fetch('/api/v1/groups/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      setStack((prev) => prev.map((c) => {
        if (c.id !== card.id) return c
        if (data.rejected) {
          return { ...c, state: 'error', error: data.message || "This photo couldn't be used." }
        }
        if (data.error) {
          return { ...c, state: 'error', error: data.error }
        }
        if (!data.result) {
          return { ...c, state: 'error', error: 'No result returned.' }
        }
        return {
          ...c,
          state:     'done',
          imageUrl:  'data:image/jpeg;base64,' + data.result.image_b64,
          moodLabel: data.result.mood_summary || '',
          warning:   data.result.quality_warning || null,
        }
      }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStack((prev) => prev.map((c) => c.id === card.id ? { ...c, state: 'error', error: msg } : c))
    }
  }

  function retryCard(cardId: string) {
    const card = stack.find((c) => c.id === cardId)
    if (!card) return
    setStack((prev) => prev.map((c) => c.id === cardId ? { ...c, state: 'loading', error: undefined } : c))
    void fireOne({ ...card, state: 'loading' })
  }

  function bringToFront(cardId: string) {
    setStack((prev) => {
      const idx = prev.findIndex((c) => c.id === cardId)
      if (idx <= 0) return prev
      const next = [...prev]
      const [c] = next.splice(idx, 1)
      next.unshift(c)
      return next
    })
    setActiveId(cardId)
  }

  function downloadOne(card: ResultCard) {
    if (!card.imageUrl) return
    const a = document.createElement('a')
    a.href = card.imageUrl
    const variantPart = card.variant !== 'standard' ? `-${card.variant}` : ''
    a.download = `minirama-${card.style}${variantPart}.jpg`
    a.click()
  }

  function downloadAll() {
    stack.filter((c) => c.state === 'done').forEach((c, i) => {
      setTimeout(() => downloadOne(c), i * 200)
    })
  }

  const showSidebarContent = phase !== 'idle'

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap"
      />
      <div className="g-shell">
        <header className="g-topbar">
          <a className="g-home" href="/index.html">← Home</a>
          <span className="g-logo">mini<em>Rama</em></span>
          <span className="g-suffix">Group Figurines</span>
        </header>

        <div className="g-app">
          <aside className="g-side">
            <div className="g-section">
              <UploadZone previewUrl={previewUrl} onPick={onUpload} disabled={phase === 'analyzing' || phase === 'generating'} />
              {phase !== 'idle' && (
                <button className="g-link-btn" onClick={startOver}>Start over</button>
              )}
            </div>

            {showSidebarContent && (
              <div className="g-section">
                <div className="g-section-label">Photo analysis</div>
                <AnalysisCard phase={phase} analyze={analyze} analyzeErr={analyzeErr} onReset={startOver} />
              </div>
            )}

            {(phase === 'picking' || phase === 'choosing' || phase === 'confirming') && (
              <div className="g-section">
                <div className="g-section-label">Bundle</div>
                {bundle ? (
                  <SelectedBundleCard bundle={bundle} onChange={changeBundle} />
                ) : bundles === null && !bundlesLoadErr ? (
                  <div className="g-empty-mini">Loading bundles…</div>
                ) : bundlesLoadErr ? (
                  <div className="g-error-mini">{bundlesLoadErr}</div>
                ) : bundles && bundles.length === 0 ? (
                  <div className="g-empty-mini">No bundles available right now.</div>
                ) : (
                  <BundlePicker bundles={bundles ?? []} onPick={pickBundle} />
                )}
              </div>
            )}

            {(phase === 'choosing' || phase === 'confirming') && bundle && (
              <ChooseScreens bundle={bundle} choices={choices} onChoose={chooseOption} />
            )}

            {phase === 'confirming' && bundle && (
              <>
                <div className="g-section">
                  <button
                    type="button"
                    className="g-options-toggle"
                    onClick={() => setOptionsOpen((v) => !v)}
                    aria-expanded={optionsOpen}
                  >
                    <span>Options</span>
                    <span className={`g-options-caret ${optionsOpen ? 'open' : ''}`}>▾</span>
                  </button>
                  {optionsOpen && (
                    <div className="g-options-body">
                      <label className="g-label">Plaque title</label>
                      <input
                        className="g-input"
                        value={plaqueTitle}
                        onChange={(e) => setPlaqueTitle(e.target.value)}
                        placeholder="Leave blank — we'll suggest something"
                        maxLength={60}
                        disabled={noPlaque}
                      />
                      <label className="g-check">
                        <input type="checkbox" checked={noPlaque} onChange={(e) => setNoPlaque(e.target.checked)} />
                        <span>No plaque or text</span>
                      </label>
                      <label className="g-label" style={{ marginTop: 12 }}>Notes</label>
                      <textarea
                        className="g-input"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Anything specific you'd like the sculptor to know…"
                      />
                    </div>
                  )}
                </div>

                <div className="g-section">
                  <ConfirmButton bundle={bundle} onConfirm={confirmAndPay} />
                </div>
              </>
            )}
          </aside>

          <main className="g-stage">
            {stack.length === 0 ? (
              <StageEmpty />
            ) : (
              <ResultStack
                stack={stack}
                activeId={activeId}
                onBring={bringToFront}
                onRetry={retryCard}
                onDownloadOne={downloadOne}
                onDownloadAll={downloadAll}
              />
            )}
          </main>
        </div>
      </div>
      <style jsx global>{styles}</style>
    </>
  )
}

function makeCardId() {
  return 'card_' + Math.random().toString(36).slice(2, 10)
}

// ── COMPONENTS ───────────────────────────────────────────────────

function UploadZone({ previewUrl, onPick, disabled }: { previewUrl: string | null; onPick: (file: File) => void; disabled: boolean }) {
  return (
    <label className={`g-upload ${previewUrl ? 'has-image' : ''} ${disabled ? 'disabled' : ''}`}>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          e.target.value = ''
        }}
      />
      {previewUrl ? (
        <img src={previewUrl} alt="source photo" />
      ) : (
        <>
          <div className="g-upload-icon">+</div>
          <div className="g-upload-text">Tap to upload a photo</div>
          <div className="g-upload-sub">JPG, PNG, HEIC · use your camera</div>
        </>
      )}
    </label>
  )
}

function AnalysisCard({ phase, analyze, analyzeErr, onReset }: {
  phase: Phase
  analyze: AnalyzeResult | null
  analyzeErr: string | null
  onReset: () => void
}) {
  if (phase === 'analyzing') {
    return (
      <div className="g-analysis analyzing">
        <div className="g-analysis-row">
          <div className="g-analysis-spinner" />
          <div>
            <div className="g-analysis-title">Analyzing your photo…</div>
            <div className="g-analysis-msg">This takes a few seconds.</div>
          </div>
        </div>
      </div>
    )
  }
  if (phase === 'analysis-error') {
    const msg = analyzeErr ?? analyze?.message ?? 'This photo needs adjustment.'
    return (
      <div className="g-analysis tier-reject">
        <div className="g-analysis-title">This photo needs adjustment</div>
        <div className="g-analysis-msg">{msg}</div>
        <div className="g-reject-actions">
          <button className="g-reject-btn" onClick={onReset}>New upload</button>
          <a className="g-reject-btn" href="/index.html">Back home</a>
        </div>
      </div>
    )
  }
  if (analyze && analyze.proceedable) {
    const name = analyze.subject_count === 1 ? '1 subject ready' : `${analyze.subject_count} subjects ready`
    return (
      <div className="g-analysis tier-ok">
        <div className="g-analysis-title">{name}</div>
        {analyze.message && <div className="g-analysis-msg">{analyze.message}</div>}
        {analyze.warnings && analyze.warnings.length > 0 && (
          <div className="g-analysis-warnings">
            {analyze.warnings.map((w, i) => <div key={i} className="g-analysis-warn">⚠ {w}</div>)}
          </div>
        )}
      </div>
    )
  }
  return null
}

function BundlePicker({ bundles, onPick }: { bundles: Bundle[]; onPick: (b: Bundle) => void }) {
  return (
    <div className="g-bundle-grid">
      {bundles.map((b) => (
        <button key={b.id} type="button" className="g-bundle-card" onClick={() => onPick(b)}>
          <div className="g-bundle-name">{b.name}</div>
          {b.tagline && <div className="g-bundle-tagline">{b.tagline}</div>}
          <div className="g-bundle-foot">
            <span className="g-bundle-count">{b.items.length} image{b.items.length === 1 ? '' : 's'}</span>
            <span className="g-bundle-price">${(b.priceCents / 100).toFixed(2)}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

function SelectedBundleCard({ bundle, onChange }: { bundle: Bundle; onChange: () => void }) {
  return (
    <div className="g-selected-bundle">
      <div className="g-selected-head">
        <div>
          <div className="g-bundle-name">{bundle.name}</div>
          <div className="g-bundle-foot">
            <span className="g-bundle-count">{bundle.items.length} image{bundle.items.length === 1 ? '' : 's'}</span>
            <span className="g-bundle-price">${(bundle.priceCents / 100).toFixed(2)}</span>
          </div>
        </div>
        <button type="button" className="g-link-btn" onClick={onChange}>Change</button>
      </div>
    </div>
  )
}

function ChooseScreens({ bundle, choices, onChoose }: {
  bundle: Bundle
  choices: Record<string, ChooseOption>
  onChoose: (item: BundleItem, opt: ChooseOption) => void
}) {
  const chooseItems = bundle.items.filter((it) => it.mode === 'choose')
  if (chooseItems.length === 0) return null
  return (
    <div className="g-section">
      <div className="g-section-label">Your picks</div>
      {chooseItems.map((it) => {
        const picked = choices[it.id]
        return (
          <div key={it.id} className="g-choose-block">
            <div className="g-choose-label">{it.chooseLabel || 'Pick a style'}</div>
            <div className="g-choose-options">
              {(it.chooseOptions ?? []).map((opt, j) => {
                const selected = picked && picked.style === opt.style && picked.variant === opt.variant
                return (
                  <button
                    key={j}
                    type="button"
                    className={`g-choose-option ${selected ? 'selected' : ''}`}
                    onClick={() => onChoose(it, opt)}
                  >
                    <span className="g-choose-opt-label">{opt.label}</span>
                    <span className="g-choose-opt-meta">{STYLE_LABELS[opt.style]}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ConfirmButton({ bundle, onConfirm }: { bundle: Bundle; onConfirm: () => void }) {
  return (
    <button type="button" className="g-confirm-btn" onClick={onConfirm}>
      Confirm and pay · ${(bundle.priceCents / 100).toFixed(2)}
    </button>
  )
}

function StageEmpty() {
  return (
    <div className="g-stage-empty">
      <div className="g-stage-empty-title">A figurine for the <em>family</em></div>
      <div className="g-stage-empty-sub">
        Upload a photo of the people you&apos;d like to sculpt — visible from at least the knees up. We&apos;ll handle the rest.
      </div>
    </div>
  )
}

function ResultStack({ stack, activeId, onBring, onRetry, onDownloadOne, onDownloadAll }: {
  stack: ResultCard[]
  activeId: string | null
  onBring: (id: string) => void
  onRetry: (id: string) => void
  onDownloadOne: (c: ResultCard) => void
  onDownloadAll: () => void
}) {
  const doneCount = stack.filter((c) => c.state === 'done').length
  return (
    <div className="g-stack">
      {stack.map((c) => (
        <ResultCardView
          key={c.id}
          card={c}
          isActive={c.id === activeId}
          onBring={onBring}
          onRetry={onRetry}
          onDownload={onDownloadOne}
        />
      ))}
      {doneCount > 1 && (
        <div className="g-stack-actions">
          <button className="g-stack-action-btn" onClick={onDownloadAll}>Download all</button>
        </div>
      )}
    </div>
  )
}

function ResultCardView({ card, isActive, onBring, onRetry, onDownload }: {
  card: ResultCard
  isActive: boolean
  onBring: (id: string) => void
  onRetry: (id: string) => void
  onDownload: (c: ResultCard) => void
}) {
  const styleLabel = STYLE_LABELS[card.style] ?? card.style
  const variantTag = card.variant !== 'standard' ? ` · ${card.variant.replace('_', ' ')}` : ''

  if (card.state === 'loading') {
    return (
      <div className={`g-result loading ${isActive ? 'active' : ''}`}>
        <div className="g-result-img-wrap">
          <div className="g-result-loading">
            <div className="g-result-spin" />
            <div>Sculpting {styleLabel.toLowerCase()}…</div>
          </div>
        </div>
        <div className="g-result-meta">
          <div className="g-result-meta-left">
            <div className="g-result-tag">{styleLabel}{variantTag}</div>
            <div className="g-result-mood">In progress</div>
          </div>
        </div>
      </div>
    )
  }
  if (card.state === 'error') {
    return (
      <div className={`g-result ${isActive ? 'active' : ''}`} onClick={() => onBring(card.id)}>
        <div className="g-result-img-wrap">
          <div className="g-result-error">{card.error}</div>
        </div>
        <div className="g-result-meta">
          <div className="g-result-meta-left">
            <div className="g-result-tag">{styleLabel}{variantTag}</div>
            <div className="g-result-mood">Couldn&apos;t render</div>
          </div>
          <div className="g-result-actions">
            <button className="g-result-btn" onClick={(e) => { e.stopPropagation(); onRetry(card.id) }}>Try again</button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <>
      <div className={`g-result ${isActive ? 'active' : ''}`} onClick={() => onBring(card.id)}>
        <div className="g-result-img-wrap">
          <img
            className="g-result-img"
            src={card.imageUrl}
            alt={card.moodLabel || 'figurine'}
            onClick={(e) => { e.stopPropagation(); openLightbox(card.imageUrl!) }}
          />
        </div>
        <div className="g-result-meta">
          <div className="g-result-meta-left">
            <div className="g-result-tag">{styleLabel}{variantTag}</div>
            <div className="g-result-mood">{card.moodLabel || 'a figurine'}</div>
          </div>
          <div className="g-result-actions">
            <button className="g-result-btn primary" onClick={(e) => { e.stopPropagation(); onDownload(card) }}>Download</button>
          </div>
        </div>
      </div>
      {card.warning && (
        <div className="g-quality-warn">
          <div className="g-quality-warn-label">Note</div>
          {card.warning}
        </div>
      )}
    </>
  )
}

function openLightbox(src: string) {
  if (typeof window === 'undefined') return
  const lb = document.createElement('div')
  lb.className = 'g-lightbox'
  lb.onclick = () => lb.remove()
  const img = document.createElement('img')
  img.src = src
  lb.appendChild(img)
  document.body.appendChild(lb)
}

// ── STYLES ───────────────────────────────────────────────────────

const styles = `
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: var(--sans);
    font-size: 14px;
    line-height: 1.5;
  }
  .g-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .g-topbar {
    height: 56px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 14px;
    flex-shrink: 0;
  }
  .g-home {
    color: var(--ink-2);
    text-decoration: none;
    font-size: 12px;
  }
  .g-home:hover {
    color: var(--ink);
  }
  .g-logo {
    font-family: var(--serif);
    font-size: 22px;
    color: var(--ink);
    letter-spacing: 0.01em;
  }
  .g-logo em {
    font-style: italic;
    color: var(--accent);
  }
  .g-suffix {
    font-size: 11px;
    color: var(--ink-3);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding-left: 12px;
    border-left: 1px solid var(--border);
  }
  .g-app {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .g-side {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .g-stage {
    padding: 20px 16px;
    background: var(--bg);
  }

  .g-section {
    padding: 16px;
    border-bottom: 1px solid var(--border);
  }
  .g-section:last-child {
    border-bottom: none;
  }
  .g-section-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--ink-3);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .g-link-btn {
    margin-top: 10px;
    background: none;
    border: none;
    color: var(--ink-3);
    font-size: 12px;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
    font-family: var(--sans);
  }
  .g-link-btn:hover {
    color: var(--accent);
  }

  .g-upload {
    display: block;
    background: var(--surface-2);
    border: 2px dashed var(--border-strong);
    border-radius: 8px;
    padding: 36px 16px;
    text-align: center;
    cursor: pointer;
    transition: all 0.15s;
    color: var(--ink-3);
    min-height: 140px;
  }
  .g-upload:hover:not(.disabled) {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
  }
  .g-upload.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .g-upload input {
    display: none;
  }
  .g-upload-icon {
    font-size: 32px;
    margin-bottom: 6px;
    font-weight: 300;
  }
  .g-upload-text {
    font-size: 14px;
    font-weight: 500;
  }
  .g-upload-sub {
    font-size: 11px;
    color: var(--ink-3);
    margin-top: 4px;
  }
  .g-upload.has-image {
    padding: 0;
    border-style: solid;
    border-color: var(--border);
    background: var(--surface);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    min-height: 200px;
  }
  .g-upload.has-image img {
    display: block;
    max-width: 100%;
    max-height: 280px;
  }

  .g-analysis {
    padding: 14px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .g-analysis.tier-ok {
    background: var(--success-soft);
    border-color: var(--success);
  }
  .g-analysis.tier-reject {
    background: var(--danger-soft);
    border-color: var(--danger);
  }
  .g-analysis-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .g-analysis-spinner {
    width: 22px;
    height: 22px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: g-spin 1s linear infinite;
    flex-shrink: 0;
  }
  @keyframes g-spin {
    to { transform: rotate(360deg); }
  }
  .g-analysis-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
    margin-bottom: 2px;
  }
  .g-analysis-msg {
    font-size: 12px;
    color: var(--ink-2);
    line-height: 1.45;
  }
  .g-analysis-warnings {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed var(--border-strong);
  }
  .g-analysis-warn {
    font-size: 11px;
    color: var(--warn);
    font-family: var(--mono);
    line-height: 1.5;
  }
  .g-reject-actions {
    margin-top: 10px;
    display: flex;
    gap: 6px;
  }
  .g-reject-btn {
    flex: 1;
    padding: 8px 10px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    color: var(--ink-2);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--sans);
    text-decoration: none;
    text-align: center;
    transition: all 0.15s;
  }
  .g-reject-btn:hover {
    border-color: var(--ink-3);
    color: var(--ink);
  }

  .g-empty-mini, .g-error-mini {
    padding: 14px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12px;
    color: var(--ink-2);
    text-align: center;
  }
  .g-error-mini {
    color: var(--danger);
    background: var(--danger-soft);
    border-color: var(--danger);
  }

  .g-bundle-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .g-bundle-card {
    text-align: left;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    padding: 14px;
    cursor: pointer;
    font-family: var(--sans);
    transition: all 0.15s;
  }
  .g-bundle-card:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
    box-shadow: 0 4px 14px -6px rgba(107, 91, 168, 0.2);
  }
  .g-bundle-name {
    font-family: var(--serif);
    font-size: 22px;
    color: var(--ink);
    line-height: 1.2;
    margin-bottom: 2px;
  }
  .g-bundle-tagline {
    font-family: var(--serif);
    font-style: italic;
    font-size: 13px;
    color: var(--ink-2);
    margin-bottom: 8px;
  }
  .g-bundle-foot {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 6px;
  }
  .g-bundle-count {
    font-size: 11px;
    color: var(--ink-3);
    font-family: var(--mono);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .g-bundle-price {
    font-size: 16px;
    font-weight: 600;
    color: var(--accent);
  }

  .g-selected-bundle {
    background: var(--accent-soft);
    border: 1px solid var(--accent);
    border-radius: 6px;
    padding: 12px 14px;
  }
  .g-selected-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .g-selected-head .g-bundle-name {
    font-size: 18px;
  }
  .g-selected-head .g-bundle-foot {
    margin-top: 2px;
  }

  .g-choose-block {
    margin-bottom: 14px;
  }
  .g-choose-block:last-child {
    margin-bottom: 0;
  }
  .g-choose-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--ink);
    margin-bottom: 8px;
  }
  .g-choose-options {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .g-choose-option {
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    padding: 10px 12px;
    cursor: pointer;
    font-family: var(--sans);
    text-align: left;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    transition: all 0.12s;
  }
  .g-choose-option:hover {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .g-choose-option.selected {
    border-color: var(--accent);
    background: var(--accent);
    color: #fff;
  }
  .g-choose-opt-label {
    font-size: 13px;
    font-weight: 500;
  }
  .g-choose-opt-meta {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-3);
    font-family: var(--mono);
  }
  .g-choose-option.selected .g-choose-opt-meta {
    color: rgba(255, 255, 255, 0.7);
  }

  .g-options-toggle {
    width: 100%;
    background: var(--surface-2);
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    padding: 10px 12px;
    cursor: pointer;
    font-family: var(--sans);
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-2);
    display: flex;
    justify-content: space-between;
    align-items: center;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .g-options-caret {
    transition: transform 0.15s;
  }
  .g-options-caret.open {
    transform: rotate(180deg);
  }
  .g-options-body {
    padding-top: 14px;
  }
  .g-label {
    display: block;
    font-size: 10px;
    font-weight: 600;
    color: var(--ink-3);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .g-input {
    width: 100%;
    padding: 9px 12px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    color: var(--ink);
    font-size: 13px;
    font-family: var(--sans);
  }
  .g-input:focus {
    outline: none;
    border-color: var(--accent);
  }
  .g-input:disabled {
    background: var(--surface-2);
    color: var(--ink-3);
  }
  textarea.g-input {
    resize: vertical;
    line-height: 1.5;
  }
  .g-check {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    font-size: 12px;
    color: var(--ink-2);
    cursor: pointer;
  }
  .g-check input {
    width: 14px;
    height: 14px;
    cursor: pointer;
  }

  .g-confirm-btn {
    width: 100%;
    padding: 14px;
    background: var(--ink);
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--sans);
    letter-spacing: 0.02em;
    transition: background 0.15s;
  }
  .g-confirm-btn:hover {
    background: var(--ink-2);
  }

  .g-stage-empty {
    padding: 60px 20px;
    text-align: center;
    color: var(--ink-3);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    max-width: 600px;
    margin: 0 auto;
  }
  .g-stage-empty-title {
    font-family: var(--serif);
    font-size: 28px;
    color: var(--ink);
    margin-bottom: 8px;
    line-height: 1.2;
  }
  .g-stage-empty-title em {
    font-style: italic;
    color: var(--accent);
  }
  .g-stage-empty-sub {
    font-size: 13px;
    max-width: 460px;
    margin: 0 auto;
    line-height: 1.6;
  }

  .g-stack {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 780px;
    margin: 0 auto;
  }
  .g-stack-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
  }
  .g-stack-action-btn {
    padding: 8px 16px;
    background: var(--ink);
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--sans);
  }
  .g-stack-action-btn:hover {
    background: var(--ink-2);
  }

  .g-result {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    transition: box-shadow 0.15s, border-color 0.15s;
    cursor: pointer;
  }
  .g-result.active {
    border-color: var(--accent);
    box-shadow: 0 4px 14px -4px rgba(107, 91, 168, 0.25);
  }
  .g-result.loading {
    cursor: default;
  }
  .g-result-img-wrap {
    position: relative;
    background: var(--surface-2);
    aspect-ratio: 1 / 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .g-result-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
  .g-result-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: var(--ink-3);
    font-size: 12px;
  }
  .g-result-spin {
    width: 28px;
    height: 28px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: g-spin 1s linear infinite;
  }
  .g-result-error {
    padding: 24px;
    text-align: center;
    color: var(--danger);
    font-size: 12px;
  }
  .g-result-meta {
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }
  .g-result-meta-left {
    flex: 1;
    min-width: 0;
  }
  .g-result-tag {
    font-size: 10px;
    font-weight: 600;
    color: var(--ink-3);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .g-result-mood {
    font-family: var(--serif);
    font-style: italic;
    font-size: 14px;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .g-result-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
  .g-result-btn {
    padding: 6px 12px;
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
  .g-result-btn:hover {
    border-color: var(--ink-3);
    color: var(--ink);
  }
  .g-result-btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .g-result-btn.primary:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
    color: #fff;
  }
  .g-quality-warn {
    margin-top: -4px;
    padding: 10px 12px;
    background: var(--warn-soft);
    border: 1px solid var(--warn);
    border-radius: 6px;
    font-size: 11px;
    color: var(--ink);
    line-height: 1.5;
  }
  .g-quality-warn-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--warn);
    margin-bottom: 3px;
  }

  .g-lightbox {
    position: fixed;
    inset: 0;
    background: rgba(26, 24, 20, 0.92);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    cursor: pointer;
  }
  .g-lightbox img {
    max-width: 96%;
    max-height: 96vh;
    object-fit: contain;
    border-radius: 6px;
  }

  /* Desktop: sidebar + center stage */
  @media (min-width: 900px) {
    .g-topbar {
      padding: 0 24px;
      gap: 20px;
    }
    .g-app {
      flex-direction: row;
      overflow: hidden;
    }
    .g-side {
      width: 380px;
      flex-shrink: 0;
      border-right: 1px solid var(--border);
      border-bottom: none;
      overflow-y: auto;
      max-height: calc(100vh - 56px);
    }
    .g-section {
      padding: 18px 20px;
    }
    .g-stage {
      flex: 1;
      padding: 32px;
      overflow-y: auto;
      max-height: calc(100vh - 56px);
    }
    .g-stage-empty {
      padding: 80px 24px;
    }
    .g-stage-empty-title {
      font-size: 32px;
    }
    .g-bundle-grid {
      gap: 12px;
    }
  }
`
