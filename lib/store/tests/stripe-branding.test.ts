// lib/store/tests/stripe-branding.test.ts
//
// The branding we put on a Checkout Session, and the promise that it can
// never cost a sale. Embedded Checkout has no Appearance API -- the session
// is the only place the payment form can be branded from -- so these values
// are the whole of our control over how it looks.

import { describe, it, expect, vi } from 'vitest'
import {
  LITEN_CHECKOUT_BRANDING, LITEN_OXBLOOD, LITEN_LOGO_URL, createBrandedSession,
} from '@/lib/store/stripe-branding'

const fakeStripe = (create: any) => ({ checkout: { sessions: { create } } }) as any
const PARAMS = { mode: 'payment', ui_mode: 'embedded', line_items: [{ price: 'price_1', quantity: 1 }] } as any

describe('what we send', () => {
  it('is exactly the branding Rich specified', () => {
    expect(LITEN_CHECKOUT_BRANDING).toEqual({
      background_color: '#faf6ec',
      button_color:     '#7d4242',
      border_style:     'rounded',
      font_family:      'lora',
      display_name:     'LITEN & CO',
      logo:             { type: 'url', url: 'https://litenco.com/icons/liten-and-co.png' },
    })
  })

  it('the button is the product\'s own oxblood, not a near miss', () => {
    expect(LITEN_OXBLOOD).toBe('#7d4242')
    expect(LITEN_CHECKOUT_BRANDING.button_color).toBe(LITEN_OXBLOOD)
  })

  /* Stripe fetches this itself. Every *.vercel.app URL is behind the project's
     SSO (all_except_custom_domains), so only the custom domain is reachable --
     a Preview URL here would hand Stripe a login wall. */
  it('the logo is on the public custom domain, never a deployment URL', () => {
    expect(LITEN_LOGO_URL).toMatch(/^https:\/\/litenco\.com\//)
    expect(LITEN_LOGO_URL).not.toMatch(/vercel\.app/)
  })

  /* icons/LitenCo_Gear.png is 404 on litenco.com -- it has never been
     deployed to Production. Naming a URL Stripe cannot fetch is worse than
     naming none. */
  it('claims no icon, because we have no square asset Stripe could fetch', () => {
    expect(LITEN_CHECKOUT_BRANDING).not.toHaveProperty('icon')
  })

  it('adds no custom text and no custom fields', () => {
    expect(Object.keys(LITEN_CHECKOUT_BRANDING).sort()).toEqual(
      ['background_color', 'border_style', 'button_color', 'display_name', 'font_family', 'logo'],
    )
  })
})

describe('branding never costs a sale', () => {
  it('sends the caller\'s params untouched, plus the branding', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'cs_1' })
    await createBrandedSession(fakeStripe(create), PARAMS)
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0]).toEqual({ ...PARAMS, branding_settings: LITEN_CHECKOUT_BRANDING })
  })

  it('when Stripe refuses the branding, the session is still created -- unbranded', async () => {
    const create = vi.fn()
      .mockRejectedValueOnce(new Error('Received unknown parameter: branding_settings'))
      .mockResolvedValueOnce({ id: 'cs_2' })
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {})
    const s = await createBrandedSession(fakeStripe(create), PARAMS)
    expect(s).toEqual({ id: 'cs_2' })
    expect(create).toHaveBeenCalledTimes(2)
    // the retry is the SAME sale: same mode, same line items, no branding
    expect(create.mock.calls[1][0]).toEqual(PARAMS)
    expect(create.mock.calls[1][0]).not.toHaveProperty('branding_settings')
    warn.mockRestore()
  })

  it('a genuine failure still throws -- it is not swallowed into a silent no-op', async () => {
    const create = vi.fn().mockRejectedValue(new Error('card_declined'))
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(createBrandedSession(fakeStripe(create), PARAMS)).rejects.toThrow('card_declined')
    expect(create).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})

describe('every Checkout Session we create is branded', () => {
  it('the three session-create sites call createBrandedSession', async () => {
    const { readFileSync } = await import('fs')
    const path = await import('path')
    const files = [
      'lib/store/portfolio-checkout.ts',     // the collection purchase (embedded)
      'app/api/v1/credits/purchase/route.ts', // credits (embedded)
      'lib/store/checkout.ts',                // cart / unlock (hosted)
    ]
    for (const f of files) {
      const src = readFileSync(path.join(process.cwd(), f), 'utf8')
      expect(src, f).toMatch(/createBrandedSession\(stripe, \{/)
    }
  })
})
