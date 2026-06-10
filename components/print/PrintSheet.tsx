// components/print/PrintSheet.tsx
//
// Composed shell. Owns state, runs the debounced /quote fetch on input change,
// POSTs to /checkout on Pay, redirects the browser to Stripe.
//
// Composed of:
//   - SizePicker     — picks SKU
//   - AddressForm    — email + shipping fields
//   - PriceSummary   — subtotal + total (shipping rolled in)
//
// Endpoints (real, no mock):
//   POST /api/v1/print/quote     → live shipping + total
//   POST /api/v1/print/checkout  → Stripe session URL

'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import SizePicker, { buildSizeOptions } from './SizePicker'
import AddressForm, { isAddressComplete } from './AddressForm'
import PriceSummary, { formatUsd } from './PriceSummary'
import type {
  PrintSheetRender,
  ShippingAddress,
  QuoteResponse,
  SizeOption,
} from './types'

interface PrintSheetProps {
  render: PrintSheetRender
  open:   boolean
  onClose(): void
}

const DEFAULT_KEY: string = '12x16-unframed'

export default function PrintSheet({ render, open, onClose }: PrintSheetProps) {
  const [selectedKey, setSelectedKey] = useState<string>(DEFAULT_KEY)
  const [copies, setCopies]           = useState<number>(1)

  const [email, setEmail] = useState<string>('')
  const [address, setAddress] = useState<ShippingAddress>({
    name:        '',
    line1:       '',
    line2:       '',
    city:        '',
    state:       '',
    postcode:    '',
    countryCode: 'US',
  })

  const [quote, setQuote]                     = useState<QuoteResponse | null>(null)
  const [quoteLoading, setQuoteLoading]       = useState<boolean>(false)
  const [quoteError, setQuoteError]           = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false)
  const [checkoutError, setCheckoutError]     = useState<string | null>(null)

  const selected = useMemo<SizeOption>(() => {
    const opts = buildSizeOptions()
    return opts.find(o => `${o.size}-${o.finish}` === selectedKey) || opts[0]
  }, [selectedKey])

  const subtotalUsd = selected.retailUsd * copies

  // Live quote, debounced
  const quoteTimer = useRef<number | null>(null)
  const fetchQuote = useCallback(async () => {
    if (!address.postcode || address.postcode.trim().length < 5) {
      setQuote(null)
      setQuoteError(null)
      return
    }
    setQuoteLoading(true)
    setQuoteError(null)
    try {
      const res = await fetch('/api/v1/print/quote', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ size: selected.size, finish: selected.finish, copies }],
          destination: {
            countryCode: address.countryCode,
            postcode:    address.postcode.trim(),
          },
          shippingMethod: 'Budget',
        }),
      })
      if (!res.ok) {
        const errBody = await res.text()
        throw new Error(errBody.slice(0, 200) || `Quote failed (${res.status})`)
      }
      const data: QuoteResponse = await res.json()
      setQuote(data)
    } catch (err) {
      setQuote(null)
      setQuoteError(err instanceof Error ? err.message : 'Could not calculate shipping. Try again.')
    } finally {
      setQuoteLoading(false)
    }
  }, [selected, copies, address.postcode, address.countryCode])

  useEffect(() => {
    if (!open) return
    if (quoteTimer.current) window.clearTimeout(quoteTimer.current)
    quoteTimer.current = window.setTimeout(fetchQuote, 400)
    return () => {
      if (quoteTimer.current) window.clearTimeout(quoteTimer.current)
    }
  }, [open, fetchQuote])

  const canCheckout =
    isAddressComplete(email, address) &&
    !!quote && !quoteLoading && !checkoutLoading

  const handlePay = useCallback(async () => {
    if (!canCheckout) return
    setCheckoutLoading(true)
    setCheckoutError(null)
    try {
      const origin = window.location.origin
      const successUrl = `${origin}/library/cart/success?session={CHECKOUT_SESSION_ID}`
      const cancelUrl  = `${origin}/library/gallery`

      const res = await fetch('/api/v1/print/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            renderId:  render.id,
            renderUrl: render.url,
            size:      selected.size,
            finish:    selected.finish,
            copies,
          }],
          email,
          shippingAddress: {
            name:        address.name,
            line1:       address.line1,
            line2:       address.line2 || null,
            city:        address.city,
            state:       address.state,
            postcode:    address.postcode,
            countryCode: address.countryCode,
          },
          shippingMethod: 'Budget',
          successUrl,
          cancelUrl,
        }),
      })
      if (!res.ok) {
        const errBody = await res.text()
        throw new Error(errBody.slice(0, 200) || `Checkout failed (${res.status})`)
      }
      const data = await res.json()
      if (!data.checkoutUrl) throw new Error('No checkout URL returned.')
      window.location.href = data.checkoutUrl
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Could not start checkout.')
      setCheckoutLoading(false)
    }
  }, [canCheckout, render, selected, copies, email, address])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="ps-overlay" onClick={onClose}>
      <div className="ps-sheet" onClick={e => e.stopPropagation()}>

        <header className="ps-head">
          <div>
            <div className="ps-eyebrow">A print of</div>
            <div className="ps-title">{render.title}</div>
            <div className="ps-style">{render.style}</div>
          </div>
          <button className="ps-close" onClick={onClose} aria-label="Close" type="button">×</button>
        </header>

        <div className="ps-body">

          <div className="ps-preview">
            <img src={render.url} alt={render.title} />
            <div className="ps-preview-disclosure">
              Printed on Enhanced Matte Art paper, 200gsm. Museum-grade Giclée.
            </div>
          </div>

          <div className="ps-options">
            <SizePicker
              value={selectedKey}
              onChange={key => setSelectedKey(key)}
            />

            <section>
              <div className="ps-label">Quantity</div>
              <div className="ps-qty">
                <button
                  className="ps-qty-btn"
                  onClick={() => setCopies(Math.max(1, copies - 1))}
                  disabled={copies <= 1}
                  aria-label="Decrease quantity"
                  type="button"
                >−</button>
                <span className="ps-qty-num">{copies}</span>
                <button
                  className="ps-qty-btn"
                  onClick={() => setCopies(Math.min(10, copies + 1))}
                  disabled={copies >= 10}
                  aria-label="Increase quantity"
                  type="button"
                >+</button>
              </div>
            </section>

            <AddressForm
              email={email}
              address={address}
              onEmailChange={setEmail}
              onAddressChange={setAddress}
            />
          </div>
        </div>

        <footer className="ps-foot">
          <PriceSummary
            subtotalUsd={subtotalUsd}
            quote={quote}
            quoteLoading={quoteLoading}
            quoteError={quoteError}
          />

          <button
            className="ps-pay"
            onClick={handlePay}
            disabled={!canCheckout}
            type="button"
          >
            {checkoutLoading ? <>Opening checkout…</> : <>Pay</>}
            {!checkoutLoading && quote && (
              <span className="ps-pay-amount">{formatUsd(quote.retailTotalCents)}</span>
            )}
          </button>

          {checkoutError && (
            <div className="ps-checkout-error">{checkoutError}</div>
          )}

          <div className="ps-promise">
            One print, one piece — finished by hand at our nearest lab, shipped within five working days.
          </div>
        </footer>

      </div>

      <style jsx>{`
        :root, .ps-sheet {
          --ps-bg: #f3ede1;
          --ps-ink: #2a241e;
          --ps-ink-soft: #5b5246;
          --ps-ink-faint: #8a8175;
          --ps-ink-faintest: #aaa097;
          --ps-hairline: rgba(42,36,30,.08);
          --ps-hairline-soft: rgba(42,36,30,.04);
          --ps-hairline-strong: rgba(42,36,30,.14);
          --ps-sage-tint: rgba(127,138,106,.14);
          --ps-sage-border: rgba(127,138,106,.40);
          --ps-sage-deep: #6e7a5a;
          --ps-brass: #75623a;
          --ps-oxblood: #7d4242;
          --ps-status-fail: #a64545;
          --ps-serif: "Cormorant Garamond", Garamond, Georgia, serif;
          --ps-sans: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
          --ps-mono: "JetBrains Mono", Menlo, monospace;
        }

        .ps-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(42,36,30,.42);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 2rem 1rem;
          animation: psOverlayIn .2s ease;
        }
        @keyframes psOverlayIn { from { opacity: 0 } to { opacity: 1 } }

        .ps-sheet {
          background-color: var(--ps-bg);
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.42 0 0 0 0 0.32 0 0 0 0 0.20 0 0 0 0.06 0'/></filter><rect width='320' height='320' filter='url(%23n)'/></svg>");
          width: 100%; max-width: 920px;
          max-height: calc(100vh - 4rem);
          border-radius: 8px;
          box-shadow: 0 24px 64px rgba(42,36,30,.32);
          display: flex; flex-direction: column;
          overflow: hidden;
          color: var(--ps-ink);
          font-family: var(--ps-sans);
          font-size: 15px; line-height: 1.5;
          animation: psSheetIn .25s ease;
        }
        @keyframes psSheetIn {
          from { opacity: 0; transform: translateY(8px) }
          to   { opacity: 1; transform: translateY(0) }
        }

        .ps-head {
          flex: 0 0 auto;
          padding: 1.3rem 1.6rem 1.1rem;
          border-bottom: 1px solid var(--ps-hairline);
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 1rem;
        }
        .ps-eyebrow {
          font-family: var(--ps-mono);
          font-size: 11px; font-weight: 500;
          letter-spacing: .18em; text-transform: uppercase;
          color: var(--ps-ink-faint);
          margin-bottom: .25rem;
        }
        .ps-title {
          font-family: var(--ps-serif);
          font-style: italic;
          font-size: 1.85rem; font-weight: 500;
          letter-spacing: -.005em; line-height: 1.15;
          color: var(--ps-ink);
        }
        .ps-style {
          font-family: var(--ps-serif);
          font-style: italic;
          font-size: 1.05rem;
          color: var(--ps-oxblood);
          margin-top: .15rem;
        }
        .ps-close {
          background: none; border: none;
          font-size: 1.7rem; line-height: 1;
          color: var(--ps-ink-faint);
          cursor: pointer;
          padding: .1rem .3rem;
          font-family: var(--ps-serif);
        }
        .ps-close:hover { color: var(--ps-ink) }

        .ps-body {
          flex: 1 1 auto;
          overflow-y: auto;
          padding: 1.4rem 1.6rem;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 2rem;
          scrollbar-width: thin;
          scrollbar-color: var(--ps-hairline-strong) transparent;
        }
        .ps-body::-webkit-scrollbar { width: 6px }
        .ps-body::-webkit-scrollbar-thumb { background: var(--ps-hairline-strong); border-radius: 3px }

        .ps-preview { display: flex; flex-direction: column; gap: .7rem }
        .ps-preview img {
          width: 100%;
          aspect-ratio: 1 / 1;
          object-fit: cover;
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(42,36,30,.08);
          background: rgba(42,36,30,.04);
        }
        .ps-preview-disclosure {
          font-family: var(--ps-serif);
          font-style: italic;
          font-size: .88rem;
          color: var(--ps-ink-faint);
          line-height: 1.45;
        }

        .ps-options { display: flex; flex-direction: column; gap: 1.3rem }

        .ps-label {
          font-family: var(--ps-mono);
          font-size: 11px; font-weight: 600;
          letter-spacing: .18em; text-transform: uppercase;
          color: var(--ps-ink);
          margin-bottom: .55rem;
        }

        .ps-qty {
          display: inline-flex; align-items: center; gap: .3rem;
          background: rgba(42,36,30,.04);
          border-radius: 5px;
          padding: 2px;
        }
        .ps-qty-btn {
          background: transparent; border: none;
          width: 32px; height: 32px;
          font-family: var(--ps-serif);
          font-style: italic;
          font-size: 1.2rem; font-weight: 500;
          color: var(--ps-ink-soft);
          cursor: pointer;
          border-radius: 3px;
          transition: all .15s;
        }
        .ps-qty-btn:hover:not(:disabled) {
          background: var(--ps-bg);
          color: var(--ps-ink);
        }
        .ps-qty-btn:disabled { opacity: .3; cursor: not-allowed }
        .ps-qty-num {
          font-family: var(--ps-serif);
          font-style: italic;
          font-size: 1.15rem; font-weight: 500;
          color: var(--ps-ink);
          min-width: 28px; text-align: center;
        }

        .ps-foot {
          flex: 0 0 auto;
          padding: 1.1rem 1.6rem 1.4rem;
          border-top: 1px solid var(--ps-hairline);
          background: rgba(243,237,225,.55);
        }

        .ps-pay {
          width: 100%;
          background: var(--ps-ink); color: var(--ps-bg);
          border: none; border-radius: 5px;
          padding: .85rem 1.3rem .9rem;
          font-family: var(--ps-serif);
          font-style: italic;
          font-size: 1.2rem; font-weight: 500;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: .85rem;
          transition: background .15s;
        }
        .ps-pay:hover:not(:disabled) { background: var(--ps-oxblood) }
        .ps-pay:disabled { opacity: .35; cursor: not-allowed }
        .ps-pay-amount {
          font-family: var(--ps-mono);
          font-style: normal;
          font-weight: 500; font-size: .92rem;
          color: rgba(243,237,225,.95);
          border-left: 1px solid rgba(243,237,225,.3);
          padding-left: .8rem;
        }

        .ps-checkout-error {
          margin-top: .7rem; text-align: center;
          font-family: var(--ps-serif);
          font-style: italic;
          font-size: .88rem;
          color: var(--ps-status-fail);
        }

        .ps-promise {
          margin-top: .9rem;
          font-family: var(--ps-serif);
          font-style: italic;
          font-size: .92rem;
          color: var(--ps-ink-faint);
          text-align: center;
          line-height: 1.45;
        }

        @media (max-width: 720px) {
          .ps-body { grid-template-columns: 1fr; gap: 1.4rem; padding: 1.1rem 1.3rem }
          .ps-head { padding: 1rem 1.3rem .9rem }
          .ps-foot { padding: 1rem 1.3rem 1.2rem }
          .ps-title { font-size: 1.55rem }
        }
      `}</style>
    </div>
  )
}
