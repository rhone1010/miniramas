'use client'

import { useState, useEffect } from 'react'

async function generateMiniature(
  file: File,
  style: string,
  mood: string,
  detail: string,
  composition: string
) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('style', style)
  formData.append('mood', mood)
  formData.append('detail', detail)
  formData.append('composition', composition)
  formData.append('email', 'anonymous')

  const response = await fetch('/api/jobs/create', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Generation failed')
  }

  return response.json()
}

// ─── LOADING SCREEN ──────────────────────────────────────────────────────────

function LoadingScreen({ isPeopleMode }: { isPeopleMode: boolean }) {
  const totalDuration = isPeopleMode ? 90 : 30

  const stages = isPeopleMode ? [
    { label: 'Analysing photo',       icon: '📷', duration: 8  },
    { label: 'Extracting identity',   icon: '🔍', duration: 6  },
    { label: 'Building prompt',       icon: '🏗️', duration: 2  },
    { label: 'Rendering pass 1 of 3', icon: '🎨', duration: 22 },
    { label: 'Scoring identity',      icon: '🧪', duration: 8  },
    { label: 'Rendering pass 2 of 3', icon: '🎨', duration: 22 },
    { label: 'Scoring identity',      icon: '🧪', duration: 8  },
    { label: 'Rendering pass 3 of 3', icon: '🎨', duration: 18 },
    { label: 'Finalising',            icon: '✨', duration: 4  },
  ] : [
    { label: 'Analysing photo',     icon: '📷', duration: 5  },
    { label: 'Building scene',      icon: '🏗️', duration: 2  },
    { label: 'Rendering miniature', icon: '🎨', duration: 20 },
    { label: 'Finalising',          icon: '✨', duration: 3  },
  ]

  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [treesVisible, setTreesVisible] = useState(false)
  const [houseVisible, setHouseVisible] = useState(false)
  const [pathVisible, setPathVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setTreesVisible(true), 300)
    const t2 = setTimeout(() => setHouseVisible(true), 700)
    const t3 = setTimeout(() => setPathVisible(true), 1000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(s => Math.min(s + 1, totalDuration - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [totalDuration])

  // Derive current stage from elapsed time
  let currentStageIndex = 0
  let accumulated = 0
  for (let i = 0; i < stages.length; i++) {
    accumulated += stages[i].duration
    if (elapsedSeconds < accumulated) { currentStageIndex = i; break }
    currentStageIndex = i
  }

  const pct = Math.round((elapsedSeconds / totalDuration) * 100)
  const remainingSeconds = Math.max(0, totalDuration - elapsedSeconds)
  const remainingMins = Math.floor(remainingSeconds / 60)
  const remainingSecs = remainingSeconds % 60
  const timeLabel = remainingMins > 0
    ? `${remainingMins}m ${remainingSecs}s remaining`
    : `${remainingSecs}s remaining`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', textAlign: 'center' }}>
      <style>{`
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.4) translateY(8px); }
          70% { transform: scale(1.1) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes shimmerWin { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes sparkleFloat {
          0%, 100% { opacity: 0.2; transform: scale(0.7); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* DIORAMA SCENE */}
      <div style={{ position: 'relative', width: '220px', height: '210px', marginBottom: '2rem' }}>
        {[
          { top: '10%', left: '15%', color: '#00C9C8', delay: '0s'   },
          { top: '6%',  left: '70%', color: '#FFD60A', delay: '0.4s' },
          { top: '20%', left: '88%', color: '#7B5EA7', delay: '0.8s' },
          { top: '55%', left: '6%',  color: '#00C9C8', delay: '0.2s' },
          { top: '35%', left: '94%', color: '#FFD60A', delay: '1.1s' },
          { top: '65%', left: '22%', color: '#7B5EA7', delay: '0.6s' },
          { top: '12%', left: '48%', color: '#00C9C8', delay: '1.4s' },
          { top: '58%', left: '78%', color: '#FFD60A', delay: '0.9s' },
        ].map((s, i) => (
          <div key={i} style={{ position: 'absolute', top: s.top, left: s.left, width: '6px', height: '6px', borderRadius: '50%', background: s.color, animation: 'sparkleFloat 1.8s ease-in-out infinite', animationDelay: s.delay }} />
        ))}

        {treesVisible && (
          <div style={{ position: 'absolute', bottom: '30px', left: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'popIn 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
            <div style={{ width: 0, height: 0, borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderBottom: '24px solid #1e7a3a' }} />
            <div style={{ width: '6px', height: '9px', background: '#5C3D1E' }} />
          </div>
        )}
        {treesVisible && (
          <div style={{ position: 'absolute', bottom: '30px', right: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'popIn 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards', animationDelay: '0.15s', opacity: 0 }}>
            <div style={{ width: 0, height: 0, borderLeft: '12px solid transparent', borderRight: '12px solid transparent', borderBottom: '20px solid #166832' }} />
            <div style={{ width: '5px', height: '8px', background: '#5C3D1E' }} />
          </div>
        )}
        {houseVisible && (
          <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
            <div style={{ width: 0, height: 0, borderLeft: '36px solid transparent', borderRight: '36px solid transparent', borderBottom: '30px solid #7B5EA7' }} />
            <div style={{ position: 'relative', width: '56px', height: '38px', background: '#a0bfd8' }}>
              <div style={{ position: 'absolute', top: '7px', left: '5px', width: '11px', height: '11px', background: '#FFD60A', borderRadius: '1px', animation: 'shimmerWin 1.8s ease-in-out infinite', animationDelay: '0.3s' }} />
              <div style={{ position: 'absolute', top: '7px', right: '5px', width: '11px', height: '11px', background: '#FFD60A', borderRadius: '1px', animation: 'shimmerWin 1.8s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '13px', height: '19px', background: '#5C3D1E', borderRadius: '3px 3px 0 0' }} />
            </div>
          </div>
        )}
        {pathVisible && (
          <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: '11px', height: '13px', background: '#b0a080', borderRadius: '1px', animation: 'popIn 0.3s ease forwards' }} />
        )}
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: '150px', height: '13px', background: '#2d6a1f', borderRadius: '50% 50% 0 0 / 60% 60% 0 0', animation: 'popIn 0.4s ease forwards', animationDelay: '0.15s', opacity: 0 }} />
        <div style={{ position: 'absolute', bottom: '0', left: '50%', transform: 'translateX(-50%)', width: '170px', height: '20px', background: '#5C3D1E', borderRadius: '4px', boxShadow: '0 5px 0 #3a2410' }} />
      </div>

      {/* TITLE */}
      <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: '1.25rem', fontWeight: 900, color: 'white', marginBottom: '0.3rem' }}>
        Crafting your diorama...
      </div>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#00C9C8', marginBottom: isPeopleMode ? '0.6rem' : '1.25rem' }}>
        HoneScale AI
      </div>

      {isPeopleMode && (
        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: '1.25rem', maxWidth: '260px', lineHeight: 1.5 }}>
          Identity-preserved figurines run up to 3 scoring passes — usually 60–90 seconds.
        </div>
      )}

      {/* CURRENT STAGE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '16px' }}>{stages[currentStageIndex].icon}</span>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'white' }}>{stages[currentStageIndex].label}</span>
      </div>

      {/* PROGRESS BAR */}
      <div style={{ width: '260px', height: '8px', background: 'rgba(0,201,200,0.1)', borderRadius: '10px', overflow: 'hidden', marginBottom: '0.5rem' }}>
        <div style={{ height: '100%', background: 'linear-gradient(90deg, #7B5EA7, #00C9C8)', borderRadius: '10px', width: `${pct}%`, transition: 'width 1s linear' }} />
      </div>

      {/* PCT + TIME */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '260px', marginBottom: '1.75rem' }}>
        <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{pct}%</span>
        <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{timeLabel}</span>
      </div>

      {/* STAGE INDICATORS — only completed + active */}
      <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' as const, justifyContent: 'center', maxWidth: '320px' }}>
        {stages.map((s, i) => {
          const isCompleted = i < currentStageIndex
          const isCurrent = i === currentStageIndex
          if (!isCompleted && !isCurrent) return null
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '5px', opacity: isCurrent ? 1 : 0.45, transition: 'opacity 0.4s ease' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: isCompleted ? '#00C9C8' : 'linear-gradient(135deg, #7B5EA7, #00C9C8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                {isCompleted ? '✓' : s.icon}
              </div>
              <div style={{ fontSize: '0.56rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: isCurrent ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)', textAlign: 'center' as const, maxWidth: '52px' }}>
                {s.label}
              </div>
            </div>
          )
        })}
      </div>

      {/* DOTS */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '1.75rem' }}>
        {[{ color: '#00C9C8', delay: '0s' }, { color: '#7B5EA7', delay: '0.2s' }, { color: '#FFD60A', delay: '0.4s' }].map((d, i) => (
          <div key={i} style={{ width: '7px', height: '7px', borderRadius: '50%', background: d.color, animation: 'dotPulse 1.4s ease-in-out infinite', animationDelay: d.delay }} />
        ))}
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function CreatePage() {
  const [step, setStep] = useState(1)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [style, setStyle] = useState('landscape')
  const [mood, setMood] = useState('realistic')
  const [detail, setDetail] = useState('clean')
  const [composition, setComposition] = useState('full')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const styles = [
    { id: 'landscape_diorama',     name: 'Landscape Diorama',    desc: 'Parks, nature, travel, beaches',  emoji: '🏔️' },
    { id: 'interior_dollhouse',    name: 'Dollhouse Interiors',   desc: 'Kitchens, rooms, living spaces',  emoji: '🏠' },
    { id: 'architecture_miniature', name: 'Architecture Diorama', desc: 'Houses, buildings, storefronts', emoji: '🏛️' },
    { id: 'people_miniature',      name: 'People Diorama',        desc: 'Family moments, group shots',     emoji: '👨‍👩‍👧' },
    { id: 'snowglobe',             name: 'Snow Globe',            desc: 'Cozy globe keepsake',             emoji: '🔮' },
    { id: 'mixed_scene',           name: 'Mixed Scene',           desc: 'People + environment together',   emoji: '🌍' },
  ]

  const btnPrimary = {
    fontFamily: 'Nunito, sans-serif', fontSize: '0.85rem', fontWeight: 800,
    padding: '0.9rem', borderRadius: '12px',
    background: 'linear-gradient(135deg, #7B5EA7, #00C9C8)',
    color: 'white', border: 'none', cursor: 'pointer', width: '100%', marginTop: '1rem'
  } as React.CSSProperties

  const btnGhost = {
    fontFamily: 'Nunito, sans-serif', fontSize: '0.78rem', fontWeight: 700,
    padding: '0.7rem', borderRadius: '12px', background: 'transparent',
    color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer', width: '100%', marginTop: '8px'
  } as React.CSSProperties

  return (
    <main style={{ background: '#0B1128', minHeight: '100vh', fontFamily: "'Nunito Sans', sans-serif", color: 'white' }}>

      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', height: '58px', background: '#0B1128', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <a href="/" style={{ fontFamily: 'Nunito, sans-serif', fontSize: '1.5rem', fontWeight: 900, textDecoration: 'none' }}>
          <span style={{ color: '#00C9C8' }}>mini</span>
          <span style={{ color: 'white' }}>rama</span>
          <span style={{ color: '#FFD60A' }}>.</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, background: step === n ? 'linear-gradient(135deg, #7B5EA7, #00C9C8)' : step > n ? '#00C9C8' : 'rgba(255,255,255,0.08)', color: step >= n ? 'white' : 'rgba(255,255,255,0.3)' }}>
                {step > n ? '✓' : n}
              </div>
              {n < 4 && <div style={{ width: '20px', height: '2px', background: step > n ? '#00C9C8' : 'rgba(255,255,255,0.08)', borderRadius: '2px' }} />}
            </div>
          ))}
        </div>
        <div style={{ width: '80px' }} />
      </nav>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* STEP 1 — UPLOAD */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7B5EA7', marginBottom: '0.35rem' }}>Step 1 of 4</div>
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontSize: '1.9rem', fontWeight: 900, marginBottom: '0.4rem' }}>Drop your photo in 📸</h2>
            <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1.5rem', lineHeight: 1.65 }}>
              Any photo works — your home, a favourite place, a family moment. HoneScale will turn it into a tiny world.
            </p>
            {previewUrl && <img src={previewUrl} alt="Preview" style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '12px', marginBottom: '1rem', border: '2px solid rgba(0,201,200,0.3)' }} />}
            <label style={{ display: 'block', border: '2px dashed rgba(0,201,200,0.3)', borderRadius: '16px', padding: '2.5rem 1.5rem', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}>
              <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📷</div>
              <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.3rem' }}>{previewUrl ? 'Change photo' : 'Drop your photo here'}</div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>JPG, PNG, WEBP · up to 20MB</div>
            </label>
            <button style={{ ...btnPrimary, opacity: !uploadedFile ? 0.4 : 1, cursor: !uploadedFile ? 'not-allowed' : 'pointer' }} disabled={!uploadedFile} onClick={() => setStep(2)}>
              Choose a style →
            </button>
          </div>
        )}

        {/* STEP 2 — STYLE */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7B5EA7', marginBottom: '0.35rem' }}>Step 2 of 4</div>
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontSize: '1.9rem', fontWeight: 900, marginBottom: '0.4rem' }}>Pick your style 🎨</h2>
            <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1.5rem', lineHeight: 1.65 }}>HoneScale has four specialised rendering modes. Pick the one that fits your photo best.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '1.25rem' }}>
              {styles.map((s) => (
                <div key={s.id} onClick={() => setStyle(s.id)} style={{ border: style === s.id ? '2px solid #00C9C8' : '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1rem', cursor: 'pointer', background: style === s.id ? 'rgba(0,201,200,0.06)' : 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{s.emoji}</div>
                  <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: '0.85rem', fontWeight: 800, marginBottom: '0.2rem' }}>{s.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{s.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '0.5rem' }}>Mood</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const }}>
                {['realistic', 'cozy', 'cinematic', 'collectible'].map((m) => (
                  <button key={m} onClick={() => setMood(m)} style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.35rem 0.9rem', borderRadius: '20px', border: mood === m ? 'none' : '1px solid rgba(255,255,255,0.1)', background: mood === m ? 'linear-gradient(135deg, #7B5EA7, #00C9C8)' : 'transparent', color: 'white', cursor: 'pointer', textTransform: 'capitalize' as const }}>{m}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '0.5rem' }}>Detail</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['clean', 'handcrafted', 'ultra'].map((d) => (
                  <button key={d} onClick={() => setDetail(d)} style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.35rem 0.9rem', borderRadius: '20px', border: detail === d ? 'none' : '1px solid rgba(255,255,255,0.1)', background: detail === d ? 'linear-gradient(135deg, #7B5EA7, #00C9C8)' : 'transparent', color: 'white', cursor: 'pointer', textTransform: 'capitalize' as const }}>{d}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '0.5rem' }}>Composition</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['full', 'tight', 'wide'].map((c) => (
                  <button key={c} onClick={() => setComposition(c)} style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.35rem 0.9rem', borderRadius: '20px', border: composition === c ? 'none' : '1px solid rgba(255,255,255,0.1)', background: composition === c ? 'linear-gradient(135deg, #7B5EA7, #00C9C8)' : 'transparent', color: 'white', cursor: 'pointer', textTransform: 'capitalize' as const }}>{c}</button>
                ))}
              </div>
            </div>

            <button style={btnPrimary} disabled={isGenerating} onClick={async () => {
              if (!uploadedFile) return
              setIsGenerating(true)
              setError(null)
              setStep(3)
              try {
                const result = await generateMiniature(uploadedFile, style, mood, detail, composition)
                setGeneratedImageUrl(result.previewUrl)
                setJobId(result.jobId)
                setStep(4)
              } catch (err) {
                setError('Generation failed. Please try again.')
                setStep(2)
              } finally {
                setIsGenerating(false)
              }
            }}>
              {isGenerating ? 'Generating...' : '✨ Generate with HoneScale'}
            </button>
            <button style={btnGhost} onClick={() => setStep(1)}>← Change photo</button>
          </div>
        )}

        {/* STEP 3 — GENERATING */}
        {step === 3 && <LoadingScreen isPeopleMode={style === 'people_miniature'} />}

        {/* STEP 4 — RESULTS */}
        {step === 4 && (
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7B5EA7', marginBottom: '0.35rem' }}>Step 4 of 4</div>
            <h2 style={{ fontFamily: 'Nunito, sans-serif', fontSize: '1.6rem', fontWeight: 900, marginBottom: '0.5rem' }}>Your tiny world is ready! 🎉</h2>
            <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1.25rem' }}>This is a watermarked preview. Unlock the full HD version below.</p>

            {error && <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#FF9999' }}>{error}</div>}

            {generatedImageUrl && (
              <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                <img src={generatedImageUrl} alt="Generated miniature" style={{ width: '100%', borderRadius: '16px', border: '2px solid rgba(0,201,200,0.2)' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', transform: 'rotate(-35deg)', whiteSpace: 'nowrap' }}>
                    miniramas · preview only
                  </div>
                </div>
              </div>
            )}

            <div style={{ background: '#141B35', borderRadius: '16px', padding: '1.25rem', marginBottom: '0.85rem', border: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 style={{ fontFamily: 'Nunito, sans-serif', fontSize: '1.1rem', fontWeight: 900, marginBottom: '0.2rem' }}>Unlock your miniature 🔓</h3>
              <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginBottom: '1rem' }}>Remove watermark · Full HD · Instant download</p>
              {[
                { name: 'Taster — 1 generation',       desc: 'This image · HD download',        price: '$1.99' },
                { name: 'Keepsake — 5 generations',    desc: 'HD · gallery · regenerate',       price: '$19',  badge: 'Popular' },
                { name: 'Memory Box — 10 generations', desc: 'HD · gift card · print-ready',    price: '$39',  badge: 'Gift' },
                { name: 'Studio — 25 generations',     desc: 'All styles · commercial licence', price: '$79' },
              ].map((opt) => (
                <div key={opt.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 0.9rem', borderRadius: '10px', marginBottom: '6px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                      {opt.name}
                      {opt.badge && <span style={{ fontSize: '0.55rem', fontWeight: 800, padding: '0.15rem 0.45rem', borderRadius: '20px', marginLeft: '6px', verticalAlign: 'middle', background: opt.badge === 'Popular' ? '#FFD60A' : '#FF6B6B', color: opt.badge === 'Popular' ? '#0B1128' : 'white' }}>{opt.badge}</span>}
                    </div>
                    <div style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.3)', marginTop: '1px' }}>{opt.desc}</div>
                  </div>
                  <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: '1.2rem', fontWeight: 900, color: '#00C9C8' }}>{opt.price}</div>
                </div>
              ))}
              <button style={{ ...btnPrimary, background: 'linear-gradient(135deg, #FFD60A, #FFAA00)', color: '#0B1128', marginTop: '1rem' }}>
                🎉 Purchase & Download
              </button>
            </div>

            <button style={btnGhost} onClick={() => setStep(2)}>← Change style & regenerate</button>
            <button style={btnGhost} onClick={() => { setStep(1); setUploadedFile(null); setPreviewUrl(null); setGeneratedImageUrl(null) }}>Start over with a new photo</button>
          </div>
        )}

      </div>
    </main>
  )
}