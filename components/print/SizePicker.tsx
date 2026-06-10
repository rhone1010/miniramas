// components/print/SizePicker.tsx
//
// Renders SKU options as italic-serif rows with sage-tint active state.
// Reads SKU_MAP directly so retail prices stay server-authoritative.

'use client'

import { useMemo } from 'react'
import { SKU_MAP } from '@/lib/v1/print/sku-map'
import type { PrintSize, PrintFinish, SizeOption } from './types'

interface SizePickerProps {
  /** Currently selected key in the form `${size}-${finish}` */
  value: string
  onChange(key: string, opt: SizeOption): void
}

function buildSizeOptions(): SizeOption[] {
  const opts: SizeOption[] = []
  for (const finish of ['unframed', 'framed'] as PrintFinish[]) {
    for (const size of ['8x10', '12x16', '18x24'] as PrintSize[]) {
      const entry = SKU_MAP[finish]?.[size]
      if (!entry) continue
      opts.push({
        size,
        finish,
        label:       size.replace('x', '×') + (finish === 'framed' ? ' framed' : ''),
        description: entry.description,
        retailUsd:   entry.retailCents / 100,
      })
    }
  }
  return opts
}

export default function SizePicker({ value, onChange }: SizePickerProps) {
  const options = useMemo(buildSizeOptions, [])

  return (
    <section>
      <div className="ps-label">Size</div>
      <div className="ps-size-list">
        {options.map(opt => {
          const key    = `${opt.size}-${opt.finish}`
          const active = key === value
          return (
            <button
              key={key}
              className={`ps-size-row${active ? ' active' : ''}`}
              onClick={() => onChange(key, opt)}
              type="button"
            >
              <span className="ps-size-name">{opt.label}</span>
              <span className="ps-size-desc">{opt.description}</span>
              <span className="ps-size-price">${opt.retailUsd.toFixed(0)}</span>
            </button>
          )
        })}
      </div>

      <style jsx>{`
        .ps-label {
          font-family: var(--ps-mono, "JetBrains Mono", Menlo, monospace);
          font-size: 11px; font-weight: 600;
          letter-spacing: .18em; text-transform: uppercase;
          color: var(--ps-ink, #2a241e);
          margin-bottom: .55rem;
        }
        .ps-size-list { display: flex; flex-direction: column; gap: .4rem }
        .ps-size-row {
          display: grid;
          grid-template-columns: 120px 1fr auto;
          gap: 1rem; align-items: center;
          padding: .65rem .9rem .7rem;
          background: transparent;
          border: 1px solid var(--ps-hairline, rgba(42,36,30,.08));
          border-radius: 5px;
          cursor: pointer;
          transition: all .15s;
          text-align: left;
          font-family: inherit;
        }
        .ps-size-row:hover:not(.active) {
          border-color: var(--ps-hairline-strong, rgba(42,36,30,.14));
          background: rgba(42,36,30,.025);
        }
        .ps-size-row.active {
          background: var(--ps-sage-tint, rgba(127,138,106,.14));
          border-color: var(--ps-sage-border, rgba(127,138,106,.40));
        }
        .ps-size-name {
          font-family: var(--ps-serif, "Cormorant Garamond", Georgia, serif);
          font-style: italic;
          font-size: 1.1rem; font-weight: 500;
          color: var(--ps-ink, #2a241e);
        }
        .ps-size-desc {
          font-family: var(--ps-serif, "Cormorant Garamond", Georgia, serif);
          font-style: italic;
          font-size: .88rem;
          color: var(--ps-ink-faint, #8a8175);
          line-height: 1.35;
        }
        .ps-size-price {
          font-family: var(--ps-mono, "JetBrains Mono", Menlo, monospace);
          font-size: .9rem; font-weight: 600;
          color: var(--ps-ink, #2a241e);
          letter-spacing: .02em;
        }
      `}</style>
    </section>
  )
}

export { buildSizeOptions }
