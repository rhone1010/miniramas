// components/print/AddressForm.tsx
//
// Email + full shipping address. US-only at launch (countryCode hard-coded).
// Address grid: full-width on the wide rows, 1fr / 80px / 90px for city/state/ZIP.

'use client'

import type { ShippingAddress } from './types'

interface AddressFormProps {
  email:    string
  address:  ShippingAddress
  onEmailChange(value: string): void
  onAddressChange(addr: ShippingAddress): void
}

export default function AddressForm({
  email, address, onEmailChange, onAddressChange,
}: AddressFormProps) {

  const update = (patch: Partial<ShippingAddress>) => {
    onAddressChange({ ...address, ...patch })
  }

  return (
    <section>
      <div className="ps-label">Shipping to</div>
      <div className="ps-address">
        <input
          className="ps-input ps-input-full"
          type="email"
          placeholder="Email for receipt"
          value={email}
          onChange={e => onEmailChange(e.target.value)}
          autoComplete="email"
        />
        <input
          className="ps-input ps-input-full"
          type="text"
          placeholder="Full name"
          value={address.name}
          onChange={e => update({ name: e.target.value })}
          autoComplete="name"
        />
        <input
          className="ps-input ps-input-full"
          type="text"
          placeholder="Street address"
          value={address.line1}
          onChange={e => update({ line1: e.target.value })}
          autoComplete="address-line1"
        />
        <input
          className="ps-input ps-input-full"
          type="text"
          placeholder="Apartment, suite (optional)"
          value={address.line2}
          onChange={e => update({ line2: e.target.value })}
          autoComplete="address-line2"
        />
        <input
          className="ps-input"
          type="text"
          placeholder="City"
          value={address.city}
          onChange={e => update({ city: e.target.value })}
          autoComplete="address-level2"
        />
        <input
          className="ps-input ps-input-sm"
          type="text"
          placeholder="State"
          maxLength={2}
          value={address.state}
          onChange={e => update({ state: e.target.value.toUpperCase() })}
          autoComplete="address-level1"
        />
        <input
          className="ps-input ps-input-sm"
          type="text"
          placeholder="ZIP"
          value={address.postcode}
          onChange={e => update({ postcode: e.target.value })}
          autoComplete="postal-code"
          inputMode="numeric"
        />
      </div>

      <style jsx>{`
        .ps-label {
          font-family: var(--ps-mono, "JetBrains Mono", Menlo, monospace);
          font-size: 11px; font-weight: 600;
          letter-spacing: .18em; text-transform: uppercase;
          color: var(--ps-ink, #2a241e);
          margin-bottom: .55rem;
        }
        .ps-address {
          display: grid;
          grid-template-columns: 1fr 80px 90px;
          gap: .45rem;
        }
        .ps-input {
          font-family: var(--ps-sans, "Inter", system-ui, sans-serif);
          font-size: .92rem;
          color: var(--ps-ink, #2a241e);
          background: var(--ps-bg, #f3ede1);
          border: 1px solid var(--ps-hairline, rgba(42,36,30,.08));
          border-radius: 4px;
          padding: .5rem .7rem .55rem;
          transition: border-color .15s, background .15s;
        }
        .ps-input::placeholder {
          color: var(--ps-ink-faintest, #aaa097);
          font-family: var(--ps-serif, "Cormorant Garamond", Georgia, serif);
          font-style: italic;
          font-size: .92rem;
        }
        .ps-input:focus {
          outline: none;
          border-color: var(--ps-sage-border, rgba(127,138,106,.40));
          background: rgba(255,255,255,.5);
        }
        .ps-input-full { grid-column: 1 / -1 }

        @media (max-width: 720px) {
          .ps-address { grid-template-columns: 1fr 1fr 1fr }
        }
      `}</style>
    </section>
  )
}

/** Returns true if the form is filled enough to submit. */
export function isAddressComplete(email: string, addr: ShippingAddress): boolean {
  return (
    email.trim().length > 3 && email.includes('@') &&
    addr.name.trim().length > 0 &&
    addr.line1.trim().length > 0 &&
    addr.city.trim().length > 0 &&
    addr.state.trim().length === 2 &&
    addr.postcode.trim().length >= 5
  )
}
