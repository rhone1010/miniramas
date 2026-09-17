// lib/store/stripe-branding.ts
//
// HOW OUR CHECKOUT IS BRANDED, in one place, for every Checkout Session we
// create (Rich, 2026-09-16).
//
// WHAT THIS IS NOT. Embedded Checkout is Stripe Checkout in an iframe, not
// Elements. It has no Appearance API: StripeEmbeddedCheckoutOptions accepts
// clientSecret, fetchClientSecret, onComplete, onShippingDetailsChange,
// onLineItemsChange and onAnalyticsEvent -- and nothing else. Our CSS cannot
// reach inside the frame either. So the only way to brand the payment form is
// from the SERVER, on the session, which is what this is.
//
// Without it, Checkout falls back to the account's Dashboard branding, and
// where that is unset, to Stripe's own defaults -- the white surface and
// #635BFF buttons.
//
// THE FONT IS A FIXED LIST. Stripe accepts one of about twenty-five named
// families; Cormorant Garamond is not among them. 'lora' is the closest
// serif the list offers (Rich's choice). The payment form will therefore
// never match the site's type exactly, and that is a Stripe limit, not a
// decision taken here.

import type Stripe from 'stripe'

/** The product's oxblood. `--oxblood` in every public page's :root. */
export const LITEN_OXBLOOD = '#7d4242'

/* THE LOGO URL IS PRODUCTION'S, DELIBERATELY, IN EVERY ENVIRONMENT.
   Stripe fetches this itself, from its own servers. The project's SSO covers
   all_except_custom_domains, so every *.vercel.app URL -- Preview and the
   Production deployment URLs alike -- answers Stripe with a login wall. Only
   the custom domain is reachable. getAppUrl() would therefore hand Stripe an
   unfetchable URL on Preview, which is exactly the mistake that broke the
   render self-calls; this is the one place a hardcoded host is the correct
   answer rather than a shortcut.

   WHICH LOCKUP, AND WHY NOT THE BIG ONE. There are two, and they are
   different colourways of the same mark:

     icons/liten-and-co.png     1024x860, ink rgb(255,255,255) -- for dark
     homepage/liten-and-co.png   132x108, ink rgb(43,36,30)    -- for light

   The large one is the reverse cut. On the #faf6ec ground above it is cream
   on cream and effectively invisible, so its size is no help. This is the
   existing asset that suits a light background; recolouring or upscaling
   either of them would be making a brand asset, which is Rich's lane.

   It is small, and Stripe may render it soft. Flagged for Rich rather than
   fixed here. Verified public 2026-09-16: HTTP 200, image/png, 9803 bytes. */
export const LITEN_LOGO_URL = 'https://litenco.com/homepage/liten-and-co.png'

/* NO ICON. Stripe wants a square image for `icon`, and the only square mark
   we have -- icons/LitenCo_Gear.png -- is 404 on litenco.com: it lives on the
   Discovery branch and has never been deployed to Production. Naming a URL
   Stripe cannot fetch is worse than naming none, and creating or recutting a
   brand asset is not CC's to do. Omitted until Rich says otherwise. */

export const LITEN_CHECKOUT_BRANDING: Stripe.Checkout.SessionCreateParams.BrandingSettings = {
  background_color: '#faf6ec',
  button_color:     LITEN_OXBLOOD,
  border_style:     'rounded',
  font_family:      'lora',
  display_name:     'LITEN & CO',
  logo:             { type: 'url', url: LITEN_LOGO_URL },
}

/* BRANDING MUST NEVER COST A SALE.
 *
 * `branding_settings` is a recent parameter, and this codebase deliberately
 * does not pin an API version (stripe.ts:16) -- it takes whatever the account
 * is set to. If that version predates the parameter, Stripe rejects the whole
 * call and the customer gets no payment form at all.
 *
 * So: try the branded session, and if Stripe refuses it, create the identical
 * session without the branding. The happy path is one call and unchanged. The
 * failure path used to be "no checkout" and is now "plain checkout", which is
 * strictly better and changes nothing about what is charged -- same mode,
 * same line_items, same metadata, same return_url.
 */
export async function createBrandedSession(
  stripe: Stripe,
  params: Stripe.Checkout.SessionCreateParams,
): Promise<Stripe.Checkout.Session> {
  try {
    return await stripe.checkout.sessions.create({ ...params, branding_settings: LITEN_CHECKOUT_BRANDING })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[stripe-branding] branded session refused, retrying unbranded:', msg)
    return await stripe.checkout.sessions.create(params)
  }
}
