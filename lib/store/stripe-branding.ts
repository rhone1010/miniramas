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
// NO FONT IS SET, ON PURPOSE. Stripe's font_family takes one of about
// twenty-five named families and Cormorant Garamond is not among them, so no
// value here could match the site's type. Rather than pick the nearest serif
// and get a form that is neither Stripe's nor ours, the typography is left as
// Stripe draws it (Rich, 2026-09-16).

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
  display_name:     'LITEN & CO',
  logo:             { type: 'url', url: LITEN_LOGO_URL },
}

/* ONE CALL, NO FALLBACK (Rich, 2026-09-16).
 *
 * An earlier cut of this tried the branded session and, if Stripe refused the
 * parameter, quietly created an unbranded one -- insurance against an account
 * API version older than `branding_settings`. Rich removed it: the real
 * account is about to be tested on Preview, and a guess about how it might
 * fail does not belong in the payment path. If Stripe refuses the parameter
 * the call throws, the caller's existing error handling reports it, and we
 * will have learned something true instead of hiding it.
 *
 * This is the only place branding is attached, so every session carries the
 * same settings and none of them can drift.
 */
export async function createBrandedSession(
  stripe: Stripe,
  params: Stripe.Checkout.SessionCreateParams,
): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.create({ ...params, branding_settings: LITEN_CHECKOUT_BRANDING })
}
