'use client'

interface CuratorVoiceCardProps {
  message: string
  className?: string
}

export default function CuratorVoiceCard({ message, className = '' }: CuratorVoiceCardProps) {
  return (
    <div className={`curator-card ${className}`}>
      <div className="curator-seal">
        <div className="curator-seal-circle" />
        <span className="curator-seal-letter">C</span>
      </div>
      <p className="curator-text">{message}</p>
      <style jsx>{`
        .curator-card {
          position: relative;
          max-width: 625px;
          min-height: 200px;
          padding: 32px 40px 28px 110px;
          background: #EFE9DD;
          border: 3px solid #CDC2BB;
          border-radius: 3px;
          box-shadow: 4px 4px 4px rgba(0, 0, 0, 0.25);
        }
        .curator-seal {
          position: absolute;
          top: 12px;
          left: 37px;
          width: 67px;
          height: 75px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .curator-seal-circle {
          position: absolute;
          top: 17px;
          left: 15px;
          width: 52px;
          height: 58px;
          border-radius: 50%;
          background: #763F41;
        }
        .curator-seal-letter {
          position: relative;
          font-family: var(--serif, 'Cormorant Garamond', Georgia, serif);
          font-style: italic;
          font-size: 70px;
          line-height: 1;
          color: #F0EAE0;
          text-shadow: 2px 2px 4px rgba(118, 63, 65, 0.64);
        }
        .curator-text {
          font-family: var(--serif, 'Cormorant Garamond', Georgia, serif);
          font-style: italic;
          font-size: 33px;
          line-height: normal;
          color: #763F41;
          margin: 0;
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  )
}
