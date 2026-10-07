// Approved package amounts and entitlement counts. Stripe prices are resolved from the existing SKU database by portfolio checkout.
/** The locked_style value for Groups craft entitlements. Consumed by
 *  the gate/craft path to find and spend one craft right. */
export const GROUPS_CRAFT_STYLE = 'groups_craft'

/** The four Groups packages, keyed by craft count. */
export const GROUPS_PACKAGES = {
  1:  {
    crafts:           1,
    includedUnlocks:  0,
    priceCents:       499,
    skuId:            'groups_1',
    displayName:      '1 Group Craft',
  },
  4:  {
    crafts:           4,
    includedUnlocks:  1,
    priceCents:       899,
    skuId:            'groups_4',
    displayName:      '4 Group Crafts',
  },
  8:  {
    crafts:           8,
    includedUnlocks:  2,
    priceCents:       1399,
    skuId:            'groups_8',
    displayName:      '8 Group Crafts',
  },
  16: {
    crafts:           16,
    includedUnlocks:  4,
    priceCents:       2199,
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

