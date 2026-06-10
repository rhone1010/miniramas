// components/print/PrintOrderCard.tsx
//
// Single order row in the My Orders list. Status badge mirrors the Orders room
// palette from the v4 mock: sage = shipped/delivered, brass = in_transit,
// oxblood = preparing/placed/in_production, ink = created/paid (digital), red = error.

'use client'

import type { PrintOrderSummary, PrintOrderStatus } from './types'

interface PrintOrderCardProps {
  order: PrintOrderSummary
  onClick?(orderId: string): void
}

interface StatusDisplay {
  label: string
  className: string
}

function statusDisplay(status: PrintOrderStatus): StatusDisplay {
  switch (status) {
    case 'created':       return { label: 'Awaiting payment', className: 'created' }
    case 'paid':          return { label: 'Preparing',         className: 'preparing' }
    case 'placed':        return { label: 'Preparing',         className: 'preparing' }
    case 'in_production': return { label: 'In production',     className: 'preparing' }
    case 'shipped':       return { label: 'In transit',        className: 'in-transit' }
    case 'delivered':     return { label: 'Delivered',         className: 'delivered' }
    case 'cancelled':     return { label: 'Cancelled',         className: 'cancelled' }
    case 'error':         return { label: 'Issue — see studio', className: 'error' }
    default:              return { label: status,              className: 'created' }
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function itemSummary(items: PrintOrderSummary['items']): string {
  if (items.length === 0) return ''
  if (items.length === 1) {
    const item = items[0]
    const label = item.size.replace('x', '×')
    const finish = item.finish === 'framed' ? ' framed' : ''
    const copies = item.copies > 1 ? ` × ${item.copies}` : ''
    return `${label}${finish}${copies}`
  }
  return `${items.length} prints`
}

export default function PrintOrderCard({ order, onClick }: PrintOrderCardProps) {
  const { label, className } = statusDisplay(order.status)
  const summary = itemSummary(order.items)
  const date = formatDate(order.placedAt || order.paidAt || order.createdAt)

  const firstItem = order.items[0]
  const renderUrl = firstItem?.renderUrl

  return (
    <button
      className="poc-row"
      onClick={() => onClick?.(order.id)}
      type="button"
    >
      <div className="poc-thumb">
        {renderUrl ? (
          <img src={renderUrl} alt="" />
        ) : (
          <div className="poc-thumb-placeholder" />
        )}
        {order.items.length > 1 && (
          <span className="poc-thumb-count">+{order.items.length - 1}</span>
        )}
      </div>

      <div className="poc-body">
        <div className="poc-title-row">
          <span className="poc-title">{summary}</span>
          <span className="poc-id">#{order.id.slice(0, 8).toUpperCase()}</span>
        </div>
        <div className="poc-detail">
          {date && <span className="poc-date">{date}</span>}
          {order.shippingCarrier && <span className="poc-carrier"> · {order.shippingCarrier}</span>}
        </div>
      </div>

      <div className="poc-right">
        <span className={`poc-status ${className}`}>{label}</span>
        {order.trackingUrl && (
          <a
            className="poc-track"
            href={order.trackingUrl}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
          >
            Track package
          </a>
        )}
        <span className="poc-amount">${(order.retailTotalCents / 100).toFixed(2)}</span>
      </div>

      <style jsx>{`
        .poc-row {
          display: grid;
          grid-template-columns: 80px 1fr auto;
          gap: 1.2rem;
          background: rgba(255,255,255,.4);
          border: 1px solid var(--ps-hairline, rgba(42,36,30,.08));
          border-radius: 5px;
          padding: .95rem 1.1rem;
          align-items: center;
          transition: background .2s, transform .15s;
          width: 100%; text-align: left;
          font-family: inherit;
          cursor: pointer;
        }
        .poc-row:hover {
          background: rgba(255,255,255,.65);
          transform: translateY(-1px);
        }

        .poc-thumb {
          width: 64px; height: 64px;
          position: relative;
          border-radius: 4px; overflow: hidden;
          background: linear-gradient(135deg, #b89a5a 0%, #75623a 100%);
        }
        .poc-thumb img {
          width: 100%; height: 100%;
          object-fit: cover; display: block;
        }
        .poc-thumb-placeholder {
          width: 100%; height: 100%;
        }
        .poc-thumb-count {
          position: absolute; bottom: .2rem; right: .2rem;
          background: rgba(42,36,30,.85);
          color: #f3ede1;
          font-family: var(--ps-mono, "JetBrains Mono", Menlo, monospace);
          font-size: 9.5px; font-weight: 600;
          letter-spacing: .04em;
          padding: .1rem .35rem;
          border-radius: 2px;
        }

        .poc-body { display: flex; flex-direction: column; gap: .25rem; min-width: 0 }
        .poc-title-row {
          display: flex; align-items: baseline; gap: .7rem; flex-wrap: wrap;
        }
        .poc-title {
          font-family: var(--ps-serif, "Cormorant Garamond", Georgia, serif);
          font-style: italic;
          font-size: 1.12rem; font-weight: 500;
          color: var(--ps-ink, #2a241e);
        }
        .poc-id {
          font-family: var(--ps-mono, "JetBrains Mono", Menlo, monospace);
          font-size: 10.5px;
          letter-spacing: .12em; text-transform: uppercase;
          color: var(--ps-ink-faint, #8a8175);
        }
        .poc-detail {
          font-family: var(--ps-sans, "Inter", system-ui, sans-serif);
          font-size: .88rem;
          color: var(--ps-ink-soft, #5b5246);
        }
        .poc-date {
          font-family: var(--ps-mono, "JetBrains Mono", Menlo, monospace);
          font-size: 11px;
          color: var(--ps-ink-faint, #8a8175);
          letter-spacing: .04em;
        }
        .poc-carrier {
          font-family: var(--ps-serif, "Cormorant Garamond", Georgia, serif);
          font-style: italic;
          color: var(--ps-ink-soft, #5b5246);
        }

        .poc-right {
          display: flex; flex-direction: column;
          align-items: flex-end; gap: .35rem;
          text-align: right;
        }
        .poc-status {
          font-family: var(--ps-mono, "JetBrains Mono", Menlo, monospace);
          font-size: 10.5px; font-weight: 600;
          letter-spacing: .18em; text-transform: uppercase;
          padding: .22rem .6rem;
          border-radius: 3px;
          display: inline-block;
        }
        .poc-status.created    { background: rgba(42,36,30,.06);     color: var(--ps-ink-soft, #5b5246);   border: 1px solid var(--ps-hairline-strong, rgba(42,36,30,.14)) }
        .poc-status.preparing  { background: rgba(125,66,66,.10);    color: var(--ps-oxblood, #7d4242);    border: 1px solid rgba(125,66,66,.3) }
        .poc-status.in-transit { background: rgba(184,122,60,.15);   color: #b87a3c;                       border: 1px solid rgba(184,122,60,.4) }
        .poc-status.delivered  { background: rgba(127,138,106,.15);  color: var(--ps-sage-deep, #6e7a5a);  border: 1px solid var(--ps-sage-border, rgba(127,138,106,.40)) }
        .poc-status.cancelled  { background: rgba(42,36,30,.04);     color: var(--ps-ink-faint, #8a8175); border: 1px solid var(--ps-hairline, rgba(42,36,30,.08)) }
        .poc-status.error      { background: rgba(166,69,69,.10);    color: var(--ps-status-fail, #a64545); border: 1px solid rgba(166,69,69,.3) }

        .poc-track {
          font-family: var(--ps-serif, "Cormorant Garamond", Georgia, serif);
          font-style: italic; font-size: .88rem;
          color: var(--ps-brass, #75623a);
          text-decoration: none;
          border-bottom: 1px solid transparent;
        }
        .poc-track:hover { border-bottom-color: var(--ps-brass, #75623a) }

        .poc-amount {
          font-family: var(--ps-mono, "JetBrains Mono", Menlo, monospace);
          font-size: .92rem; font-weight: 600;
          color: var(--ps-ink, #2a241e);
          letter-spacing: .02em;
        }

        @media (max-width: 640px) {
          .poc-row { grid-template-columns: 60px 1fr; row-gap: .6rem }
          .poc-right { grid-column: 1 / -1; flex-direction: row; align-items: center;
            justify-content: space-between; gap: .7rem }
        }
      `}</style>
    </button>
  )
}
