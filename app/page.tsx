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
  const messages = isPeopleMode ? [
    { icon: '📷', text: 'Analysing your photo...' },
    { icon: '🔍', text: 'Extracting identity features...' },
    { icon: '🏗️', text: 'Building your figurine...' },
    { icon: '🎨', text: 'Rendering pass 1 of 3...' },
    { icon: '🧪', text: 'Scoring identity fidelity...' },
    { icon: '🎨', text: 'Rendering pass 2 of 3...' },
    { icon: '🧪', text: 'Checking likeness...' },
    { icon: '🎨', text: 'Rendering pass 3 of 3...' },
    { icon: '✨', text: 'Putting on the finishing touches...' },
  ] : [
    { icon: '📷', text: 'Analysing your photo...' },
    { icon: '🏗️', text: 'Building your scene...' },
    { icon: '🎨', text: 'Rendering your miniature...' },
    { icon: '✨', text: 'Putting on the finishing touches...' },
  ]

  const durations = isPeopleMode
    ? [8, 6, 2, 22, 8, 22, 8, 18, 10]
    : [5, 2, 18, 5]

  const [messageIndex, setMessageIndex] = useState(0)
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
    let elapsed = 0
    const timers: ReturnType<typeof setTimeout>[] = []
    durations.forEach((dur, i) => {
      const t = setTimeout(() => setMessageIndex(i), elapsed * 1000)
      timers.push(t)
      elapsed += dur
    })
    return () => timers.forEach(clearTimeout)
  }, [isPeopleMode])

  const current = messages[messageIndex]

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
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeMsg {
          0% { opacity: 0; transform: translateY(5px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseRing {
          0%, 100% { transform: scale(0.95); opacity: 0.7; }
          50% { transform: scale(1.05); opacity: 1; }
        }
      `}</style>

      {/* DIORAMA SCENE */}
      <div style={{ position: 'relative', width: '220px', height: '210px', marginBottom: '2.5rem' }}>
        {[
          { top: '10%', left: '15%', color: '#00C9C8', delay: '0s',   size: '9px' },
          { top: '6%',  left: '70%', color: '#FFD60A', delay: '0.4s', size: '7px' },
          { top: '20%', left: '88%', color: '#7B5EA7', delay: '0.8s', size: '8px' },
          { top: '55%', left: '6%',  color: '#00C9C8', delay: '0.2s', size: '7px' },
          { top: '35%', left: '94%', color: '#FFD60A', delay: '1.1s', size: '9px' },
          { top: '65%', left: '22%', color: '#7B5EA7', delay: '0.6s', size: '7px' },
          { top: '12%', left: '48%', color: '#00C9C8', delay: '1.4s', size: '8px' },
          { top: '58%', left: '78%', color: '#FFD60A', delay: '0.9s', size: '7px' },
        ].map((s, i) => (
          <div key={i} style={{ position: 'absolute', top: s.top, left: s.left, width: s.size, height: s.size, borderRadius: '50%', background: s.color, animation: 'sparkleFloat 1.8s ease-in-out infinite', animationDelay: s.delay }} />
        ))}

        {treesVisible && (
          <div style={{ position: 'absolute', bottom: '30px', left: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'popIn 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
            <div style={{ width: 0, height: 0, borderLeft: '18px solid transparent', borderRight: '18px solid transparent', borderBottom: '30px solid #1e7a3a' }} />
            <div style={{ width: '7px', height: '11px', background: '#5C3D1E' }} />
          </div>
        )}
        {treesVisible && (
          <div style={{ position: 'absolute', bottom: '30px', right: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'popIn 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards', animationDelay: '0.15s', opacity: 0 }}>
            <div style={{ width: 0, height: 0, borderLeft: '15px solid transparent', borderRight: '15px solid transparent', borderBottom: '25px solid #166832' }} />
            <div style={{ width: '6px', height: '9px', background: '#5C3D1E' }} />
          </div>
        )}
        {houseVisible && (
          <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
            <div style={{ width: 0, height: 0, borderLeft: '40px solid transparent', borderRight: '40px solid transparent', borderBottom: '34px solid #7B5EA7' }} />
            <div style={{ position: 'relative', width: '62px', height: '42px', background: '#a0bfd8' }}>
              <div style={{ position: 'absolute', top: '8px', left: '6px', width: '14px', height: '14px', background: '#FFD60A', borderRadius: '1px', animation: 'shimmerWin 1.8s ease-in-out infinite', animationDelay: '0.3s' }} />
              <div style={{ position: 'absolute', top: '8px', right: '6px', width: '14px', height: '14px', background: '#FFD60A', borderRadius: '1px', animation: 'shimmerWin 1.8s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '15px', height: '22px', background: '#5C3D1E', borderRadius: '3px 3px 0 0' }} />
            </div>
          </div>
        )}
        {pathVisible && (
          <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: '12px', height: '14px', background: '#b0a080', borderRadius: '1px', animation: 'popIn 0.3s ease forwards' }} />
        )}
        <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: '160px', height: '14px', background: '#2d6a1f', borderRadius: '50% 50% 0 0 / 60% 60% 0 0', animation: 'popIn 0.4s ease forwards', animationDelay: '0.15s', opacity: 0 }} />
        <div style={{ position: 'absolute', bottom: '0', left: '50%', transform: 'translateX(-50%)', width: '180px', height: '22px', background: '#5C3D1E', borderRadius: '4px', boxShadow: '0 5px 0 #3a2410' }} />
      </div>

      {/* TITLE */}
      <div style={{ fontFamily: 'Nunito, sans-serif', fontSize: '1.3rem', fontWeight: 900, color: 'white', marginBottom: '0.25rem' }}>
        Crafting your diorama...
      </div>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#00C9C8', marginBottom: isPeopleMode ? '0.6rem' : '1.75rem' }}>
        HoneScale AI
      </div>

      {isPeopleMode && (
        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: '1.75rem', maxWidth: '260px', lineHeight: 1.5 }}>
          Identity-preserved figurines run up to 3 scoring passes — usually 60–90 seconds.
        </div>
      )}

      {/* SPINNER + MESSAGE */}
      <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '1.1rem', marginBottom: '2rem' }}>
        <div style={{ position: 'relative', width: '80px', height: '80px' }}>
          {/* Spinning ring */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '3px solid transparent',
            borderTopColor: '#00C9C8',
            borderRightColor: '#7B5EA7',
            animation: 'spin 1.4s linear infinite',
          }} />
          {/* Inner circle with icon */}
          <div style={{
            position: 'absolute', inset: '9px', borderRadius: '50%',
            background: 'rgba(123,94,167,0.15)',
            border: '1px solid rgba(0,201,200,0.25)',
            animation: 'pulseRing 2s ease-in-out infinite',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px',
          }}>
            {current.icon}
          </div>
        </div>

        {/* Status message — fades on change */}
        <div key={messageIndex} style={{
          fontSize: '0.88rem', fontWeight: 700,
          color: 'rgba(255,255,255,0.85)',
          animation: 'fadeMsg 0.35s ease forwards',
          minHeight: '1.3em',
        }}>
          {current.text}
        </div>
      </div>

      {/* COMPLETED STAGE TICKS */}
      {messageIndex > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const, justifyContent: 'center', maxWidth: '280px', marginBottom: '1.5rem' }}>
          {messages.slice(0, messageIndex).map((s, i) => (
            <div key={i} title={s.text} style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: '#00C9C8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', opacity: 0.65,
            }}>
              ✓
            </div>
          ))}
        </div>
      )}

      {/* DOTS */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {[{ color: '#00C9C8', delay: '0s' }, { color: '#7B5EA7', delay: '0.2s' }, { color: '#FFD60A', delay: '0.4s' }].map((d, i) => (
          <div key={i} style={{ width: '9px', height: '9px', borderRadius: '50%', background: d.color, animation: 'dotPulse 1.4s ease-in-out infinite', animationDelay: d.delay }} />
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