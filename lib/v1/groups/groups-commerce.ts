// lib/v1/groups/groups-commerce.ts
//
// Groups pricing and SKU definitions. September 2026.
//
// Groups pricing is FLAT-RATE: one price per package, regardless of
// subject count, identical for group_photo and multi_photo.
//
// This replaces the subject-count banding in groupsCreditCost().
// Groups no longer spends from the shared credit pool.
//
// ── THE FOUR PACKAGES ───────────────────────────────────────────────
//
//   1 Craft   $4.99   0 included unlocks
//   4 Crafts  $8.99   1 included unlock
//   8 Crafts  $13.99  2 included unlocks
//  16 Crafts  $21.99  4 included unlocks
//
// Stripe test-mode Price IDs supplied by Rich, September 2026.
// Production Price IDs will be supplied separately before launch.
//
// ── ENTITLEMENT REUSE ─────────────────────────────────────────────
//
// Groups does NOT have its own entitlement table. It reuses the
// canonical `entitlements` table (migration 003):
//
//   Craft rights:   locked_style = GROUPS_CRAFT_STYLE, locked_variant = null
//   Included unlocks: locked_style = null, locked_variant = null
//
// One craft = one entitlement consumed, regardless of subject count
// or group_photo / multi_photo intake. Included unlocks are global
// (usable for any piece in My Collection), identical to the basket
// path (basket-checkout.ts line 228).
//
// Spending uses the existing consume_entitlement_atomic() function.
// Balance is a count query on entitlements filtered by locked_style.

/** The locked_style value for Groups craft entitlements. Consumed by
 *  the gate/craft path to find and spend one craft right. */
export const GROUPS_CRAFT_STYLE = 'groups_craft'

/** The four Groups packages, keyed by craft count. */
export const GROUPS_PACKAGES = {
  1:  {
    crafts:           1,
    includedUnlocks:  0,
    priceCents:       499,
    stripePriceId:    'price_1ULTGVCWHIffAtyWbMcHDmxM',
    skuId:            'groups_1',
    displayName:      '1 Group Craft',
  },
  4:  {
    crafts:           4,
    includedUnlocks:  1,
    priceCents:       899,
    stripePriceId:    'price_1ULTH6CWHIffAtyWPnC8AhnW',
    skuId:            'groups_4',
    displayName:      '4 Group Crafts',
  },
  8:  {
    crafts:           8,
    includedUnlocks:  2,
    priceCents:       1399,
    stripePriceId:    'price_1ULTHUCWHIffAtyWxJUWWz9b',
    skuId:            'groups_8',
    displayName:      '8 Group Crafts',
  },
  16: {
    crafts:           16,
    includedUnlocks:  4,
    priceCents:       2199,
    stripePriceId:    'price_1ULTHrCWHIffAtyWGDHEiru0',
    skuId:            'groups_16',
    displayName:      '16 Group Crafts',
  },
} as const

export type GroupsPackageCount = keyof typeof GROUPS_PACKAGES

/** Resolve included unlocks from a craft count (the SKU's `count` field).
 *  Authoritative — the DB does not store this; it is derived here. */
export function includedUnlocksForPackage(crafts: number): number {
  const pkg = GROUPS_PACKAGES[crafts as GroupsPackageCount]
  return pkg?.includedUnlocks ?? 0
}

/** All Groups Stripe Price IDs, for webhook matching. */
export const GROUPS_STRIPE_PRICE_IDS = Object.values(GROUPS_PACKAGES).map(
  p => p.stripePriceId,
)

/** Whether a Stripe Price ID belongs to a Groups package. */
export function isGroupsStripePriceId(priceId: string): boolean {
  return (GROUPS_STRIPE_PRICE_IDS as readonly string[]).includes(priceId)
}

/** Build the entitlement rows to insert on purchase confirmation.
 *  Called by confirmPurchase in the webhook path.
 *
 *  Returns `count` craft entitlements (locked_style = GROUPS_CRAFT_STYLE)
 *  plus `includedUnlocks` global unlock entitlements (locked_style = null).
 */
export function groupsEntitlementRows(args: {
  purchaseId: string
  userId:     string
  count:      number
}): Array<{
  purchase_id:    string
  user_id:        string
  guest_email:    null
  locked_style:   string | null
  locked_variant: null
  status:         'available'
}> {
  const unlocks = includedUnlocksForPackage(args.count)
  const rows: Array<{
    purchase_id:    string
    user_id:        string
    guest_email:    null
    locked_style:   string | null
    locked_variant: null
    status:         'available'
  }> = []

  // Craft entitlements
  for (let i = 0; i < args.count; i++) {
    rows.push({
      purchase_id:    args.purchaseId,
      user_id:        args.userId,
      guest_email:    null,
      locked_style:   GROUPS_CRAFT_STYLE,
      locked_variant: null,
      status:         'available',
    })
  }

  // Included global unlock entitlements (same shape as basket unlocks)
  for (let i = 0; i < unlocks; i++) {
    rows.push({
      purchase_id:    args.purchaseId,
      user_id:        args.userId,
      guest_email:    null,
      locked_style:   null,
      locked_variant: null,
      status:         'available',
    })
  }

  return rows
}
