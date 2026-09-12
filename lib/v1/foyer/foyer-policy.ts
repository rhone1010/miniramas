// lib/v1/foyer/foyer-policy.ts
//
// THE FOYER'S FREE PERSONAL REVEAL -- every number and list it runs on, in
// one place. Product authority is Rich, 2026-09-12.

import { byId } from '@/lib/v1/portraits/effect-registry'

/* The six effects a visitor's one free reveal is drawn from. PRODUCT
   AUTHORITY -- not derived from the foyer's fan cards, its riffle frames or
   the glass's demo REVEAL_POOL. None of the six has a _woman twin. */
export const FOYER_REVEAL_EFFECTS = [
  'plushy',
  'petal_sculpture',
  'impressionist',
  'neon',
  'quilted',
  'stained_glass',
] as const
export type FoyerRevealEffect = (typeof FOYER_REVEAL_EFFECTS)[number]

/* The allowance: 3 successful reveals per rolling 24 hours. */
export const REVEALS_PER_WINDOW = 3
export const REVEAL_WINDOW      = '24 hours'
/* A claim not finalized by now belongs to a render that died (a function
   killed at maxDuration never reaches its finally). Past this it stops
   counting. Longer than any render can live: NB2's own bound is ~2 minutes
   and the route's maxDuration is 5. */
export const CLAIM_TTL          = '10 minutes'

/* The photo intake is an anonymous call to a vision model -- the reason
   /portraits/analyze was put behind an account. It is capped per IP so the
   foyer cannot become that open tap again. Every reveal needs one intake;
   this leaves room for several photographs a day without being a faucet. */
export const INTAKES_PER_WINDOW = 20
export const INTAKE_WINDOW      = '24 hours'

/* An intake verdict is good for this long: the reveal that follows it is
   seconds later. */
export const INTAKE_TOKEN_TTL_MS = 15 * 60 * 1000

/* The foyer card is .69 wide per 1 tall; its riffle and fan frames were all
   rendered at 2:3 so they sit in it uncropped. The reveal lands in the same
   card. */
export const FOYER_ASPECT = '2:3'

/* Anything larger than the Portraits fit ceiling (~3.3MB of file, ~4.4MB of
   base64) did not come from the foyer's own fitting and is refused unread. */
export const MAX_SOURCE_B64 = 4_500_000

export function pickRevealEffect(rand: () => number = Math.random): FoyerRevealEffect {
  const i = Math.min(FOYER_REVEAL_EFFECTS.length - 1, Math.floor(rand() * FOYER_REVEAL_EFFECTS.length))
  return FOYER_REVEAL_EFFECTS[i]
}

/* The customer-facing name, from the registry every other surface reads. */
export function revealLabel(effectId: string): string {
  return byId(effectId)?.label ?? effectId
}
