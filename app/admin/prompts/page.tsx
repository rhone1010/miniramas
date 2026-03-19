'use client'

import { useEffect, useState } from 'react'

interface PromptsConfig {
  base_prompt: string
  memory_enhancement: string
  styles: Record<string, string>
}

const styleLabels: Record<string, string> = {
  landscape_diorama: 'Landscape Diorama',
  architecture_miniature: 'Home Miniature',
  interior_dollhouse: 'Interior Dollhouse',
  snowglobe: 'Snow Globe',
  sports_realistic: 'Sports Memorabilia',
  sports_fan: 'Fan Experience',
  people_miniature: 'Miniature Figures',
  mixed_scene: 'Mixed Scene Diorama',
}

export default function PromptEditor() {
  const [prompts, setPrompts] = useState<PromptsConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/prompts')
      .then(res => res.json())
      .then(data => setPrompts(data))
  }, [])

  if (!prompts) return (
    <div style={{ background: '#0B1128', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'sans-serif' }}>
      Loading prompts...
    </div>
  )

  function handleChange(field: string, value: string) {
    setPrompts(prev => prev ? { ...prev, [field]: value } : prev)
  }

  function handleStyleChange(style: string, value: string) {
    setPrompts(prev => prev ? {
      ...prev,
      styles: { ...prev.styles, [style]: value }
    } : prev)
  }

  async function savePrompts() {
    setSaving(true)
    await fetch('/api/prompts/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompts)
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const textareaStyle = {
    width: '100%',
    background: '#1E2847',
    color: 'white',
    border: '1px solid rgba(0,201,200,0.2)',
    borderRadius: '8px',
    padding: '0.75rem',
    fontSize: '0.78rem',
    lineHeight: 1.6,
    fontFamily: 'monospace',
    resize: 'vertical' as const
  }

  const labelStyle = {
    display: 'block',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: '#00C9C8',
    marginBottom: '0.5rem',
    marginTop: '1.5rem'
  }

  return (
    <main style={{ background: '#0B1128', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.25rem' }}>
              🔮 HoneScale Prompt Editor
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
              Changes save to data/prompts.json — never exposed to users
            </p>
          </div>
          <button
            onClick={savePrompts}
            disabled={saving}
            style={{
              background: saved ? '#00C9C8' : 'linear-gradient(135deg, #7B5EA7, #00C9C8)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '0.75rem 1.5rem',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Prompts'}
          </button>
        </div>

        <div style={{ background: '#141B35', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
          <label style={labelStyle}>Base Prompt</label>
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginBottom: '0.75rem' }}>
            Applied to every generation. Sets the core rules.
          </p>
          <textarea
            rows={10}
            value={prompts.base_prompt}
            onChange={e => handleChange('base_prompt', e.target.value)}
            style={textareaStyle}
          />
        </div>

        <div style={{ background: '#141B35', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.06)' }}>
          <label style={labelStyle}>Memory Enhancement</label>
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginBottom: '0.75rem' }}>
            Applied after every style. Adds emotional quality.
          </p>
          <textarea
            rows={8}
            value={prompts.memory_enhancement}
            onChange={e => handleChange('memory_enhancement', e.target.value)}
            style={textareaStyle}
          />
        </div>

        <div style={{ background: '#141B35', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
          <label style={{ ...labelStyle, marginTop: 0 }}>Style Prompts</label>
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginBottom: '1rem' }}>
            Each style adds specific transformation instructions.
          </p>
          {Object.entries(prompts.styles).map(([key, value]) => (
            <div key={key} style={{ marginBottom: '1.5rem' }}>
              <label style={{ ...labelStyle, color: '#A07FD4', marginTop: '0.5rem' }}>
                {styleLabels[key] || key}
              </label>
              <textarea
                rows={6}
                value={value}
                onChange={e => handleStyleChange(key, e.target.value)}
                style={textareaStyle}
              />
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button
            onClick={savePrompts}
            disabled={saving}
            style={{
              background: saved ? '#00C9C8' : 'linear-gradient(135deg, #7B5EA7, #00C9C8)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '0.9rem 2rem',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save All Prompts'}
          </button>
        </div>

      </div>
    </main>
  )
}