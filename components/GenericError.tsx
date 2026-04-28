'use client'

interface GenericErrorProps {
  message?:        string
  onRetry?:        () => void
  onDismiss:       () => void
  supportEmail?:   string
}

export default function GenericError({
  message = 'Something went wrong on our end. Please try again or contact support.',
  onRetry,
  onDismiss,
  supportEmail = 'support@minirama.com',
}: GenericErrorProps) {
  return (
    <div className="ge-overlay" onClick={onDismiss}>
      <div className="ge-card" onClick={(e) => e.stopPropagation()}>
        <div className="ge-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8"  x2="12" y2="13" />
            <circle cx="12" cy="16.5" r="0.7" fill="currentColor" />
          </svg>
        </div>
        <h2 className="ge-title">That didn&apos;t work</h2>
        <p className="ge-sub">{message}</p>
        <div className="ge-actions">
          {onRetry && (
            <button type="button" className="ge-btn-secondary" onClick={onRetry}>Try again</button>
          )}
          <a className="ge-link" href={`mailto:${supportEmail}`}>Contact support</a>
          <button type="button" className="ge-btn-primary" onClick={onDismiss}>Close</button>
        </div>
      </div>
      <style jsx>{`
        .ge-overlay {
          position: fixed;
          inset: 0;
          background: rgba(26, 24, 20, 0.55);
          backdrop-filter: blur(2px);
          z-index: 1100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .ge-card {
          width: 100%;
          max-width: 400px;
          background: var(--surface, #fff);
          border: 1px solid var(--border, #E8E4DA);
          border-top: 4px solid var(--danger, #A85050);
          border-radius: 10px;
          padding: 22px 24px 18px;
          font-family: var(--sans, 'Inter', system-ui, sans-serif);
          color: var(--ink, #1A1814);
          box-shadow: 0 16px 48px -16px rgba(26, 24, 20, 0.35);
        }
        .ge-icon {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          background: var(--danger-soft, #F5EAEA);
          color: var(--danger, #A85050);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }
        .ge-title {
          font-family: var(--serif, 'Cormorant Garamond', Georgia, serif);
          font-size: 22px;
          line-height: 1.2;
          margin: 0 0 6px;
          font-weight: 400;
        }
        .ge-sub {
          font-size: 13px;
          color: var(--ink-2, #5C564E);
          line-height: 1.55;
          margin: 0 0 16px;
        }
        .ge-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        .ge-btn-primary,
        .ge-btn-secondary {
          padding: 8px 14px;
          font-size: 12.5px;
          font-weight: 600;
          font-family: inherit;
          border-radius: 6px;
          cursor: pointer;
          border: 1px solid transparent;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
        }
        .ge-btn-primary {
          background: var(--ink, #1A1814);
          color: #fff;
          border-color: var(--ink, #1A1814);
        }
        .ge-btn-primary:hover {
          background: var(--ink-2, #5C564E);
        }
        .ge-btn-secondary {
          background: var(--surface, #fff);
          color: var(--ink-2, #5C564E);
          border-color: var(--border-strong, #D4CEC0);
        }
        .ge-btn-secondary:hover {
          color: var(--ink, #1A1814);
          border-color: var(--ink-3, #8E877C);
        }
        .ge-link {
          font-size: 12px;
          color: var(--accent, #6B5BA8);
          text-decoration: none;
        }
        .ge-link:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}
