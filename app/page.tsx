'use client'

import { useEffect, useRef } from 'react'
import { Cormorant_Garamond, Manrope } from 'next/font/google'
import './homepage.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-cormorant',
})

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-manrope',
})

interface HeroSet { set?: number; before: string; after: string }

export default function HomePage() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let cancelled = false
    // setInterval / setTimeout ids to clear on unmount (same numeric id space
    // in the browser, so clearTimeout + clearInterval on each is safe).
    const timers: ReturnType<typeof setTimeout>[] = []

    // \u2500\u2500 HERO FADE WALL \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // Two panels, each with two <img class="layer"> that crossfade through a
    // set's before \u2192 after \u2192 next set's before. Sources are driven from
    // /homepage/hero/hero-sets.json (fetched below). Panels start half a deck
    // apart and panel B is staggered, so the two sides never show the same set.
    const STEP = 2600, STAGGER = 1300
    function runPanel(el: HTMLElement, sets: HeroSet[], startIdx: number) {
      const layers = el.querySelectorAll<HTMLImageElement>('.layer')
      if (layers.length < 2) return
      let top = 0, setIdx = startIdx, phase = 0
      layers[0].src = sets[setIdx].before
      layers[0].style.opacity = '1'
      const id = setInterval(() => {
        const bottom = 1 - top
        const prevTop = top   // capture before advancing \u2014 the rAF fades this out
        let src: string
        if (phase === 0) { src = sets[setIdx].after; phase = 1 }
        else { setIdx = (setIdx + 1) % sets.length; src = sets[setIdx].before; phase = 0 }
        layers[bottom].src = src
        requestAnimationFrame(() => {
          layers[bottom].style.opacity = '1'
          layers[prevTop].style.opacity = '0'
        })
        top = bottom
      }, STEP)
      timers.push(id)
    }

    fetch('/homepage/hero/hero-sets.json')
      .then(r => r.json())
      .then((sets: HeroSet[]) => {
        if (cancelled || !Array.isArray(sets) || sets.length === 0) return
        const pA = root.querySelector<HTMLElement>('#pA')
        const pB = root.querySelector<HTMLElement>('#pB')
        const half = Math.floor(sets.length / 2)
        if (pA) runPanel(pA, sets, 0)
        const t = setTimeout(() => { if (!cancelled && pB) runPanel(pB, sets, half) }, STAGGER)
        timers.push(t)
      })
      .catch(() => { /* leave the dark wall in place if the manifest is missing */ })

    // \u2500\u2500 bundle preview crossfade \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    root.querySelectorAll<HTMLDivElement>('.bun-hero').forEach((hero, hi) => {
      const sl = hero.querySelectorAll<HTMLImageElement>('.xf-slide')
      if (sl.length < 2) return; let i = 0
      const t = setTimeout(() => {
        const id = setInterval(() => {
          sl[i].classList.remove('show'); i = (i + 1) % sl.length; sl[i].classList.add('show')
        }, 2600)
        timers.push(id)
      }, hi * 1300)
      timers.push(t)
    })

    return () => {
      cancelled = true
      timers.forEach(t => { clearTimeout(t); clearInterval(t) })
    }
  }, [])

  return (
    <div ref={rootRef} className={`homepage ${cormorant.variable} ${manrope.variable}`}>
      <header className="topbar">
        <a className="brand" href="#">
          <img className="logo" src="/homepage/liten-and-co.png" alt="Liten & Co" />
          <span className="wordmark">Crafted Portraits</span>
        </a>
        <nav className="tabs">
          <button className="tab">My Collection</button>
          <button className="tab">Sets</button>
          <button className="tab">Print Shop</button>
        </nav>
      </header>

      <section className="hero-wall">
        <div className="wall">
          <div className="panel" id="pA">
            <img className="layer" alt="" />
            <img className="layer" alt="" />
          </div>
          <div className="panel" id="pB">
            <img className="layer" alt="" />
            <img className="layer" alt="" />
          </div>
        </div>
        <div className="scrim"></div>
        <div className="hero-copy">
          <h1>We turn your photographs into Crafted Images.</h1>
          <p className="sub">Your favorite moments, reimagined by the studio &mdash; kept as digital files, printable on demand.</p>
          <div className="ctas">
            {/* Aug-1 (§3): one primary CTA. "Start with the Curator" removed. */}
            <a className="cta cta-fill" href="/portraits.html">Upload Your Photo</a>
          </div>
        </div>
      </section>

      {/* Gallery — Places & People */}
      <section className="g-band">
        <hr className="divider" />
        <div className="g-head">
          <div className="eyebrow">Explore the Galleries</div>
          <h2>Places &amp; People</h2>
          <p>Where a story is set &mdash; and the people and creatures who matter.</p>
        </div>
        {/* Aug-1 (§3): five Series only. Houses + Landscapes removed. Places & People = Portraits · Pets · Groups. */}
        <div className="gal">
          <a className="gtile big" href="/portraits.html">
            <img src="/homepage/portrait.jpg" alt="Portraits" />
            <div className="gcap"><h3>Portraits</h3><span className="gstep">Step Inside Portraits &rsaquo;</span></div>
          </a>
          <a className="gtile std is-ph" href="/pets.html">
            <div className="ph"><span className="ph-eb">Sample coming</span></div>
            <div className="gcap"><h3>Pets</h3><span className="gstep">Step Inside Pets &rsaquo;</span></div>
          </a>
          <a className="gtile std" href="/groups.html">
            <img src="/homepage/groups.jpg" alt="Groups" />
            <div className="gcap"><h3>Groups</h3><span className="gstep">Step Inside Groups &rsaquo;</span></div>
          </a>
        </div>
      </section>

      {/* Gallery — Motion & Material */}
      <section className="g-band">
        <hr className="divider" />
        <div className="g-head">
          <div className="eyebrow">Explore the Galleries</div>
          <h2>Motion &amp; Material</h2>
          <p>Where the studio gets playful.</p>
        </div>
        {/* Aug-1 (§3): Artist Series + For Fun removed. Motion & Material = Action (+ Mobile
            Wallpapers when its route lands — recon 4.1 flag-gated; not wired here to avoid a
            dead link, see CC-PROGRESS-AND-FLAGS). */}
        <div className="gal">
          <a className="gtile big" href="/actionmini.html">
            <img src="/homepage/action.jpg" alt="Action" />
            <div className="gcap"><h3>Action</h3><span className="gstep">Step Inside Action &rsaquo;</span></div>
          </a>
        </div>
      </section>

      {/* Bundles */}
      <section className="bun-band">
        <hr className="divider" />
        <div className="g-head">
          <div className="eyebrow">Studio Bundles</div>
          <h2>Sets Worth Keeping</h2>
          <p>One moment, crafted many ways &mdash; kept as a set.</p>
        </div>
        <div className="bun-grid">
          <div className="bun-card">
            <div className="bun-hero">
              <img className="xf-slide show" src="/previews/portraits/impressionist/1.jpg" alt="Impressionist" />
              <img className="xf-slide" src="/previews/portraits/torn_paper/1.jpg" alt="Torn Paper" />
              <img className="xf-slide" src="/previews/portraits/folded_book/1.jpg" alt="Folded Book" />
              <img className="xf-slide" src="/previews/portraits/charcoal_chalk/1.jpg" alt="Charcoal" />
              <img className="xf-slide" src="/previews/portraits/pencil_sketch/1.jpg" alt="Pencil Sketch" />
              <img className="xf-slide" src="/previews/portraits/sheet_music/1.jpg" alt="Sheet Music" />
            </div>
            <div className="bun-body">
              <h3>The Artist Portrait</h3>
              <p className="bun-sub">One face, crafted seven ways by the studio &mdash; The Artist Series.</p>
              <div className="bun-note">&#9670; Higher likeness bar &mdash; Likeness Guaranteed</div>
              <div className="bun-buy">
                <div className="bun-price"><span className="amt">$25.99</span></div>
                <button className="btn-fill">Craft This Set</button>
              </div>
            </div>
          </div>

          <div className="bun-card">
            <div className="bun-hero">
              <img className="xf-slide show" src="/homepage/groups-mixed-metals.jpg" alt="Groups — Mixed Metals" />
              <img className="xf-slide" src="/homepage/groups-aged-bronze.jpg" alt="Groups — Aged Bronze" />
              <img className="xf-slide" src="/homepage/groups-carved-wood.jpg" alt="Groups — Carved Wood" />
              <img className="xf-slide" src="/homepage/groups-alabaster.jpg" alt="Groups — Alabaster" />
            </div>
            <div className="bun-body">
              <h3>Groups in Material</h3>
              <p className="bun-sub">Your people, crafted in seven materials.</p>
              <div className="bun-note" style={{ visibility: 'hidden' }}>spacer</div>
              <div className="bun-buy">
                <div className="bun-price"><span className="amt">$24.59</span></div>
                <button className="btn-fill">Craft This Set</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <div className="foot-inner">
          <div className="foot-brand">
            <div className="row">
              <img className="foot-logo" src="/homepage/liten-and-co.png" alt="Liten & Co" />
              <span className="wm">Crafted Portraits</span>
            </div>
            <p className="foot-tag">We turn your photographs into Crafted Images.</p>
            <div className="foot-social">
              <a aria-label="Instagram">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a aria-label="Pinterest">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.9 0 1.3.6 1.3 1.4 0 .9-.6 2.2-.9 3.4-.2 1 .5 1.8 1.5 1.8 1.8 0 3.1-1.9 3.1-4.6 0-2.4-1.7-4.1-4.2-4.1-2.9 0-4.6 2.1-4.6 4.4 0 .9.3 1.8.7 2.3.1.1.1.2.1.3l-.3 1.1c0 .2-.2.2-.3.1-1.2-.6-2-2.3-2-3.7 0-3 2.2-5.8 6.3-5.8 3.3 0 5.9 2.4 5.9 5.5 0 3.3-2.1 5.9-5 5.9-1 0-1.9-.5-2.2-1.1l-.6 2.3c-.2.8-.8 1.9-1.2 2.5A10 10 0 1 0 12 2z" />
                </svg>
              </a>
              <a aria-label="Facebook">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V3.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V10H7.4v3h2.9v8h3.2z" />
                </svg>
              </a>
              <a aria-label="X">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.5 3h3l-6.6 7.6L21.7 21h-6l-4.7-6.1L5.6 21h-3l7-8L2.6 3h6.1l4.3 5.7L17.5 3zm-1 16h1.7L7.6 4.7H5.8L16.5 19z" />
                </svg>
              </a>
              <a aria-label="TikTok">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 3c.3 2 1.6 3.6 3.5 3.9v2.6c-1.3 0-2.5-.4-3.5-1.1v5.7c0 2.9-2.3 5.2-5.2 5.2S6.1 19 6.1 16.1s2.3-5.2 5.2-5.2c.3 0 .5 0 .8.1v2.7c-.3-.1-.5-.1-.8-.1-1.4 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5 2.6-1.1 2.6-2.5V3h2.6z" />
                </svg>
              </a>
            </div>
          </div>
          <nav className="foot-links">
            <a>Privacy Policy</a><a>Terms of Service</a><a>Legal</a><a>Help</a><a>Contact</a>
            <a className="foot-mail" href="mailto:hello@litenco.com">hello@litenco.com</a>
          </nav>
        </div>
        <div className="foot-legal">
          <p className="foot-privacy"><strong>Privacy.</strong> [Placeholder] Liten &amp; Co collects only what is needed to craft and deliver your pieces. We never sell your photographs or personal data. A full privacy policy will be published here.</p>
          <p className="foot-terms"><strong>Legal.</strong> [Placeholder] Crafted images are licensed for personal use. Full Terms of Service and legal notices will be published here.</p>
          <p className="foot-copy">&copy; 2026 Liten &amp; Co &middot; All rights reserved</p>
        </div>
      </footer>
    </div>
  )
}
