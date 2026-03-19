import Link from 'next/link'

export default function Home() {
  return (
    <main style={{
      background: '#0B1128',
      minHeight: '100vh',
      fontFamily: "'Nunito Sans', sans-serif",
      color: 'white'
    }}>

      {/* NAV */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        height: '58px',
        background: '#0B1128',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'relative'
      }}>
        <div style={{
          fontFamily: 'Nunito, sans-serif',
          fontSize: '1.5rem',
          fontWeight: 900,
          letterSpacing: '-0.02em'
        }}>
          <span style={{ color: '#00C9C8' }}>mini</span>
          <span style={{ color: 'white' }}>rama</span>
          <span style={{ color: '#FFD60A' }}>.</span>
        </div>
        <div style={{
          fontSize: '0.62rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          padding: '0.3rem 0.75rem',
          borderRadius: '20px',
          background: '#1E2847',
          color: '#00C9C8',
          border: '1px solid rgba(0,201,200,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '5px'
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#00C9C8',
            display: 'inline-block'
          }}/>
          HoneScale AI
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        maxWidth: '680px',
        margin: '0 auto',
        padding: '5rem 1.5rem 3rem',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#00C9C8',
          marginBottom: '1rem'
        }}>
          Turn your memories into tiny worlds
        </div>

        <h1 style={{
          fontFamily: 'Nunito, sans-serif',
          fontSize: '3.2rem',
          fontWeight: 900,
          lineHeight: 1.1,
          marginBottom: '1.25rem',
          background: 'linear-gradient(135deg, #ffffff, #00C9C8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Your photos as beautiful miniature worlds
        </h1>

        <p style={{
          fontSize: '1rem',
          color: 'rgba(255,255,255,0.6)',
          lineHeight: 1.7,
          marginBottom: '2.5rem',
          maxWidth: '480px',
          margin: '0 auto 2.5rem'
        }}>
          Upload any photo — your home, a landscape, a family moment.
          HoneScale AI transforms it into a stunning miniature diorama
          you'll want to keep forever.
        </p>

        <Link href="/create" style={{
          display: 'inline-block',
          fontFamily: 'Nunito, sans-serif',
          fontSize: '0.9rem',
          fontWeight: 800,
          padding: '1rem 2.5rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #7B5EA7, #00C9C8)',
          color: 'white',
          textDecoration: 'none',
          letterSpacing: '0.03em'
        }}>
          ✨ Create your miniature
        </Link>

        <div style={{
          marginTop: '1rem',
          fontSize: '0.72rem',
          color: 'rgba(255,255,255,0.3)'
        }}>
          From $1.99 · No account needed · Instant preview
        </div>
      </section>

      {/* STYLES GRID */}
      <section style={{
        maxWidth: '680px',
        margin: '0 auto',
        padding: '2rem 1.5rem 5rem'
      }}>
        <div style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.3)',
          textAlign: 'center',
          marginBottom: '1.25rem'
        }}>
          Four HoneScale styles
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px'
        }}>
          {[
            { name: 'Landscape Diorama', desc: 'Parks, nature, travel, beaches', emoji: '🏔️' },
            { name: 'Dollhouse Interiors', desc: 'Kitchens, rooms, living spaces', emoji: '🏠' },
            { name: 'Architecture Diorama', desc: 'Houses, buildings, storefronts', emoji: '🏛️' },
            { name: 'People Diorama', desc: 'Family moments, group shots', emoji: '👨‍👩‍👧' },
          ].map((style) => (
            <div key={style.name} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px',
              padding: '1.25rem',
              textAlign: 'left'
            }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
                {style.emoji}
              </div>
              <div style={{
                fontFamily: 'Nunito, sans-serif',
                fontSize: '0.9rem',
                fontWeight: 800,
                marginBottom: '0.25rem'
              }}>
                {style.name}
              </div>
              <div style={{
                fontSize: '0.72rem',
                color: 'rgba(255,255,255,0.4)',
                lineHeight: 1.5
              }}>
                {style.desc}
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <Link href="/create" style={{
            fontFamily: 'Nunito, sans-serif',
            fontSize: '0.85rem',
            fontWeight: 800,
            padding: '0.9rem 2rem',
            borderRadius: '12px',
            background: '#FFD60A',
            color: '#0B1128',
            textDecoration: 'none',
            display: 'inline-block'
          }}>
            Try it now — from $1.99 →
          </Link>
        </div>
      </section>

    </main>
  )
}