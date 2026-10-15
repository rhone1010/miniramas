'use client'

// app/admin/print-assets.tsx
//
// Print artwork controls inside the existing admin panel (Fulfilment tab): the upscale settings, with
// product-specific overrides, and the queue of print files waiting for a person. Uses the panel's own
// classes. Reads and writes only through the admin-gated routes; no provider key is ever shown or sent here.

import { useCallback, useEffect, useState } from 'react'

type Row = { scope: string; version?: number; updated_at?: string; updated_by?: string | null } & Record<string, any>
type Job = {
  id: string; order_id: string; item_index: number; sku: string; status: 'review' | 'failed'; provider: string | null
  review_reason: string | null; error: string | null; warnings: Array<{ code: string; detail: string }>
  qa_verdict: string | null; qa: any; source_ppi: number | null; target_mp: number | null
  input: [number | null, number | null]; output: [number | null, number | null]; final: [number | null, number | null]
  cost_usd_est: number | null; cost_basis: string | null; prediction_id: string | null; possible_duplicate: boolean
  events: Array<{ at: string; step: string; note?: string }>; has_file: boolean
  links: { reference_preview: string | null; result_preview: string | null; reference_full: string | null; result_full: string | null }
}
type Pipeline = { flag: boolean; active: boolean; reason: 'disabled' | 'not_ready' | null; problems: string[] }
type Payload = { pipeline: Pipeline; settings: Row[]; queue: Job[]; recent: any[]; error?: string }

const FIELDS: Array<{ key: string; label: string; kind: 'select' | 'int' | 'bool'; options?: string[]; min?: number; max?: number }> = [
  { key: 'provider', label: 'Provider', kind: 'select', options: ['replicate', 'pruna'] },
  { key: 'target_ppi', label: 'Target PPI', kind: 'int', min: 72, max: 600 },
  { key: 'max_megapixels', label: 'Max megapixels', kind: 'int', min: 1, max: 128 },
  { key: 'output_format', label: 'Output format', kind: 'select', options: ['jpg', 'png', 'webp'] },
  { key: 'output_quality', label: 'Output quality', kind: 'int', min: 0, max: 100 },
  { key: 'enhance_details', label: 'Enhance details', kind: 'bool' },
  { key: 'enhance_realism', label: 'Enhance realism', kind: 'bool' },
  { key: 'disable_safety_checker', label: 'Disable safety checker', kind: 'bool' },
  { key: 'min_source_ppi', label: 'Low-detail warning level (PPI, informational)', kind: 'int', min: 0, max: 600 },
  { key: 'qa_enabled', label: 'Automatic inspection', kind: 'bool' },
  { key: 'human_approval', label: 'Human approval', kind: 'select', options: ['flagged', 'all'] },
]

const REASON: Record<string, string> = {
  qa_uncertain: 'Inspection could not confirm the enlargement matches', qa_defect: 'Inspection found a defect', qa_unavailable: 'Inspection could not run',
  qa_disabled: 'Automatic inspection is off', source_quality_below_floor: 'Low native detail for this size (informational)',
  human_approval_required: 'Set to hold every job', possible_duplicate_charge: 'A provider call may have been charged twice',
  submit_state_unresolved: 'Could not confirm whether the upscale was requested',
}
const why = (r: string | null) => (r ?? '').split(',').filter(Boolean).map(x => REASON[x.split(':')[0]] ?? x).join(' · ')

export default function PrintAssets() {
  const [data, setData] = useState<Payload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [scope, setScope] = useState('global')
  const [draft, setDraft] = useState<Record<string, any>>({})
  const [newScope, setNewScope] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/print-assets', { cache: 'no-store' })
    if (!res.ok) { setErr('Could not load print artwork data.'); return }
    setErr(null); setData(await res.json())
  }, [])
  useEffect(() => { load() }, [load])

  const current = data?.settings.find(r => r.scope === scope)
  useEffect(() => { setDraft({}) }, [scope, data])

  async function post(url: string, body: unknown, key: string) {
    setBusy(key)
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const out = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) alert(`Not done: ${out.error ?? 'failed'}. Nothing was changed.`)
    await load()
    return out
  }

  const save = () => {
    const patch: Record<string, any> = {}
    for (const [k, v] of Object.entries(draft)) patch[k] = v
    if (!Object.keys(patch).length) return
    return post('/api/admin/settings', { kind: 'print_upscale', scope, patch }, 'save')
  }

  const valueOf = (key: string) => (key in draft ? draft[key] : current?.[key])
  const isOverride = scope !== 'global'

  if (err) return <div className="panel"><div className="empty">{err}</div></div>
  if (!data) return <div className="panel"><div className="empty">Loading print artwork controls…</div></div>

  const pl = data.pipeline
  return (
    <>
      <div className="panel">
        <div className="panelhead"><h2>Automatic print preparation</h2><span className={`pill ${pl?.active ? 'p-ok' : pl?.reason === 'not_ready' ? 'p-bad' : 'p-mute'}`}>{pl?.active ? 'active' : pl?.reason === 'not_ready' ? 'switched on, not ready' : 'off'}</span></div>
        <p className="readonly">{pl?.active ? 'New print orders are queued, enlarged, inspected and sent to the lab once approved.' : pl?.reason === 'not_ready' ? 'The switch is on but these are missing, so nothing has started: ' + pl.problems.join(', ') : 'The switch (PRINT_UPSCALE_PIPELINE_ENABLED) is off: paid print orders are held, not prepared. It is an environment setting in Vercel, not changed from this panel.'}</p>
      </div>

      <div className="coffee">
        <div className="panelhead"><h2>Print artwork waiting for you</h2><span className="readonly">{data.queue.length} held</span></div>
        {data.queue.length === 0 ? <div className="empty dark">Nothing is waiting. Files that pass inspection go to the lab on their own.</div> : data.queue.map(j => (
          <div key={j.id} style={{ borderTop: '1px solid rgba(255,255,255,.12)', padding: '14px 0' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={`pill ${j.status === 'failed' ? 'p-bad' : 'p-warn'}`}>{j.status}</span>
              <span className="mono">{j.sku}</span><span className="mono">order {j.order_id.slice(0, 8)}… line {j.item_index + 1}</span>
              {j.possible_duplicate && <span className="pill p-bad">possible double charge</span>}
            </div>
            <p style={{ margin: '8px 0' }}>{j.status === 'failed' ? (j.error ?? 'failed') : why(j.review_reason)}</p>
            {j.warnings.map(w => <p key={w.code} style={{ margin: '2px 0', opacity: .85 }}>⚠ {w.detail}</p>)}
            {j.qa?.summary && <p style={{ margin: '4px 0', opacity: .85 }}>Inspection: {j.qa.summary}</p>}
            {(j.qa?.defects ?? []).map((d: any, i: number) => <p key={i} style={{ margin: '2px 0', opacity: .85 }}>{d.severity === 'major' ? '✖' : '•'} {d.code}: {d.explanation}</p>)}
            <p className="readonly" style={{ margin: '6px 0' }}>
              source {j.source_ppi ?? '–'} PPI · target {j.target_mp ?? '–'} MP · in {j.input.join('×')} · out {j.output.join('×')} · file {j.final.join('×')} · est. ${j.cost_usd_est ?? '–'} ({j.provider ?? 'no provider'}{j.prediction_id ? ` · ${j.prediction_id}` : ''})
            </p>
            {j.links.reference_preview && j.links.result_preview && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '8px 0' }}>
                <figure style={{ margin: 0 }}><img src={j.links.reference_preview} alt="before" style={{ maxWidth: 360, display: 'block' }} /><figcaption className="readonly">Before (aspect-corrected artwork)</figcaption></figure>
                <figure style={{ margin: 0 }}><img src={j.links.result_preview} alt="after" style={{ maxWidth: 360, display: 'block' }} /><figcaption className="readonly">After (enlarged)</figcaption></figure>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {j.links.reference_full && <a className="btn ghost small" href={j.links.reference_full} target="_blank" rel="noreferrer">Open reference</a>}
              {j.links.result_full && <a className="btn ghost small" href={j.links.result_full} target="_blank" rel="noreferrer">Open print file</a>}
              <input placeholder="note" value={notes[j.id] ?? ''} onChange={e => setNotes(n => ({ ...n, [j.id]: e.target.value }))} style={{ minWidth: 180 }} />
              {j.status === 'review' ? (<>
                <button className="btn small" disabled={busy !== null || !j.has_file} title={j.has_file ? '' : 'There is no print file to approve'}
                  onClick={() => post('/api/admin/print-assets', { action: 'review', job_id: j.id, decision: 'approved', note: notes[j.id] ?? '' }, j.id)}>Approve for printing</button>
                <button className="btn ghost small" disabled={busy !== null}
                  onClick={() => post('/api/admin/print-assets', { action: 'review', job_id: j.id, decision: 'rejected', note: notes[j.id] ?? '' }, j.id)}>Reject</button>
              </>) : (
                <button className="btn small" disabled={busy !== null}
                  onClick={() => confirm('Retry from the last saved step? A new provider call may add a charge.') && post('/api/admin/print-assets', { action: 'reset', job_id: j.id }, j.id)}>Retry</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panelhead"><h2>Upscale settings</h2><span className="readonly">Changes apply to new jobs; running jobs keep the settings they started with</span></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <label>Scope&nbsp;
            <select value={scope} onChange={e => setScope(e.target.value)}>
              {data.settings.map(r => <option key={r.scope} value={r.scope}>{r.scope}</option>)}
            </select>
          </label>
          <input placeholder="new override: family:canvas or sku:GLOBAL-CAN-8X8" value={newScope} onChange={e => setNewScope(e.target.value)} style={{ minWidth: 300 }} />
          <button className="btn ghost small" disabled={busy !== null || !newScope}
            onClick={async () => { const out = await post('/api/admin/settings', { kind: 'print_upscale', scope: newScope, patch: { target_ppi: 300 } }, 'new'); if (out?.ok) { setScope(newScope); setNewScope('') } }}>Add override</button>
          {isOverride && <button className="btn ghost small" disabled={busy !== null} onClick={async () => { if (confirm(`Remove the ${scope} override?`)) { await post('/api/admin/settings', { kind: 'print_upscale_clear', scope }, 'clear'); setScope('global') } }}>Remove override</button>}
        </div>
        <p className="readonly">{isOverride ? 'Only the fields you set override the global value. “inherit” uses global.' : 'Global values apply to every product unless an override sets them.'} Version {current?.version ?? '–'}{current?.updated_by ? ` · last changed by ${current.updated_by}` : ''}.</p>
        <table>
          <thead><tr><th>Setting</th><th>Value</th><th>Effective</th></tr></thead>
          <tbody>
            {FIELDS.map(f => {
              const g = data.settings.find(r => r.scope === 'global')?.[f.key]
              const v = valueOf(f.key)
              return (
                <tr key={f.key}>
                  <td>{f.label}</td>
                  <td>
                    {f.kind === 'bool' ? (
                      <select value={v === null || v === undefined ? 'inherit' : String(v)} disabled={!isOverride && false}
                        onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value === 'inherit' ? null : e.target.value === 'true' }))}>
                        {isOverride && <option value="inherit">inherit</option>}<option value="true">on</option><option value="false">off</option>
                      </select>
                    ) : f.kind === 'select' ? (
                      <select value={v ?? 'inherit'} onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value === 'inherit' ? null : e.target.value }))}>
                        {isOverride && <option value="inherit">inherit</option>}{f.options!.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type="number" min={f.min} max={f.max} value={v ?? ''} placeholder={isOverride ? 'inherit' : ''}
                        onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value === '' ? null : Number(e.target.value) }))} style={{ width: 90 }} />
                    )}
                  </td>
                  <td className="mono">{String(v ?? g ?? '')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 10 }}>
          <button className="btn small" disabled={busy !== null || !Object.keys(draft).length} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save changes'}</button>
          <span className="readonly" style={{ marginLeft: 10 }}>Provider API keys are environment variables and cannot be viewed or changed here.</span>
        </div>
      </div>

      <div className="panel">
        <div className="panelhead"><h2>Recent print files</h2></div>
        {data.recent.length === 0 ? <div className="empty">No print files prepared yet.</div> : (
          <table>
            <thead><tr><th>Order</th><th>SKU</th><th>Status</th><th>Provider</th><th className="num">MP</th><th className="num">Est. cost</th><th>Inspection</th><th>Note</th></tr></thead>
            <tbody>{data.recent.map(r => (
              <tr key={r.id}>
                <td className="mono">{String(r.order_id).slice(0, 8)}…</td><td className="mono">{r.sku}</td>
                <td><span className={`pill ${r.status === 'approved' ? 'p-ok' : r.status === 'failed' || r.status === 'rejected' ? 'p-bad' : 'p-warn'}`}>{r.status}</span></td>
                <td>{r.provider ?? '–'}</td><td className="num">{r.target_mp ?? '–'}</td><td className="num">{r.cost_usd_est != null ? `$${Number(r.cost_usd_est).toFixed(3)}` : '–'}</td>
                <td>{r.qa_verdict ?? '–'}</td><td>{r.error ? <span className="err">{String(r.error).slice(0, 50)}</span> : r.possible_duplicate ? 'possible duplicate' : ''}</td>
              </tr>))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
