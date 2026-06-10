// components/print/PriceSummary.tsx
//
// Subtotal + Total. Shipping is rolled INTO the total silently — per brand policy,
// premium studios don't surface shipping as a line item. The carrier and lab name
// appear as italic-serif voice copy instead.
//
// The /quote endpoint returns a retailShippingCents value; we add it to retail
// total but never display it. If you ever want to surface it (e.g. for an order
// receipt page), the value lives on QuoteResponse.

'use client'

import type { QuoteResponse } from './types'

interface PriceSummaryProps {
  subtotalUsd:   number          // selected.retailUsd × copies
  quote:         QuoteResponse | null
  quoteLoading:  boolean
  quoteError:    string | null
}

function formatUsd(cents: number | undefined | null): string {
  if (cents === undefined || cents === null) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

export default function PriceSummary({
  subtotalUsd, quote, quoteLoading, quoteError,
}: PriceSummaryProps) {

  return (
    <div className="ps-totals">

      <div className="ps-total-row">
        <span className="ps-total-label">Subtotal</span>
        <span className="ps-total-val">${subtotalUsd.toFixed(2)}</span>
      </div>

      <div className="ps-total-row ps-total-grand">
        <span className="ps-total-label">Total</span>
        <span className="ps-total-val">
          {quoteLoading ? (
            <span className="ps-loading">calculating…</span>
          ) : quote ? (
            formatUsd(quote.retailTotalCents)
          ) : (
            <span className="ps-faint">${subtotalUsd.toFixed(2)}</span>
          )}
        </span>
      </div>

      <div className="ps-shipping-note">
        {quote ? (
          <>Shipping included{quote.carrier ? `, via ${quote.carrier}` : ''}.</>
        ) : (
          <>Shipping included.</>
        )}
      </div>

      {quoteError && (
        <div className="ps-quote-error">{quoteError}</div>
      )}

      <style jsx>{`
        .ps-totals { margin-bottom: 1rem }
        .ps-total-row {
          display: flex; justify-content: space-between; align-items: baseline;
          padding: .3rem 0;
          font-family: var(--ps-serif, "Cormorant Garamond", Georgia, serif);
          font-style: italic;
          font-size: 1.05rem;
          color: var(--ps-ink-soft, #5b5246);
        }
        .ps-total-grand {
          font-size: 1.3rem;
          color: var(--ps-ink, #2a241e);
          padding-top: .65rem;
          margin-top: .35rem;
          border-top: 1px solid var(--ps-hairline, rgba(42,36,30,.08));
        }
        .ps-total-label { font-style: italic }
        .ps-total-val {
          font-family: var(--ps-mono, "JetBrains Mono", Menlo, monospace);
          font-style: normal;
          font-weight: 600;
          letter-spacing: .02em;
        }
        .ps-total-grand .ps-total-val { font-size: 1.15rem }
        .ps-loading, .ps-faint {
          font-family: var(--ps-serif, "Cormorant Garamond", Georgia, serif);
          font-style: italic;
          font-weight: 400;
          font-size: .95rem;
        }
        .ps-loading { color: var(--ps-ink-faint, #8a8175) }
        .ps-faint   { color: var(--ps-ink-faintest, #aaa097) }
        .ps-shipping-note {
          font-family: var(--ps-serif, "Cormorant Garamond", Georgia, serif);
          font-style: italic;
          font-size: .88rem;
          color: var(--ps-ink-faint, #8a8175);
          margin-top: .55rem;
          text-align: right;
        }
        .ps-quote-error {
          font-family: var(--ps-serif, "Cormorant Garamond", Georgia, serif);
          font-style: italic;
          font-size: .88rem;
          color: var(--ps-status-fail, #a64545);
          margin-top: .55rem;
        }
      `}</style>
    </div>
  )
}

export { formatUsd }
