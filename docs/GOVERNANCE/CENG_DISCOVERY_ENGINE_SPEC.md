# CENG — Discovery Engine / State / Commerce Specification
**Owner:** CENG
**Depends on:** `LITEN_DISCOVERY_PRODUCT_SPEC.md`
**Goal:** Provide authoritative state and business logic so CUI never invents pricing, catalog, entitlement, or selection behavior.

## 1. Principle
CENG owns:
- catalog hierarchy
- effect variants
- selection state
- selection order
- pricing/tier resolution
- unlock entitlements
- generation jobs
- rerender policy
- watermark state
- checkout state
- My Collection asset state

CUI owns rendering and motion only.

## 2. Canonical entities
```ts
type Series = {
  id: string
  name: string
  siloIds: string[]
}

type Silo = {
  id: string
  seriesId: string
  name: string
  effectIds: string[] // max 7 canonical effects
  sortOrder: number
}

type Effect = {
  id: string
  siloId: string
  name: string
  sortOrder: number
  previewAsset: string
  variantPolicy: "single" | "gender_presented"
  variants?: {
    male?: string
    female?: string
  }
}

type DiscoverySession = {
  sessionId: string
  sourceAssetId: string
  currentSeriesId: string
  currentSiloId: string
  selectedEffectIds: string[]
  visitedEffectIds: string[]
  curatorRecommendedEffectIds: string[]
  createdAt: string
  updatedAt: string
}
```

## 3. 56-position map
The minimap indexes canonical effects only.

```ts
type CatalogMapEntry = {
  mapIndex: number // 0..55
  seriesId: string
  siloId: string
  effectId: string
}
```

Gender-presented variants do not create additional minimap entries.

## 4. Variant resolution
For an effect with `variantPolicy: "gender_presented"`:
1. resolve the appropriate presentation variant from source metadata/product rules;
2. allow future override only if product explicitly enables it;
3. selection still stores the canonical `effectId`;
4. generation job stores the resolved variant ID used.

Do not expose an extra selectable effect count to CUI.

## 5. Selection behavior
CENG exposes idempotent selection operations:

```ts
selectEffect(sessionId, effectId)
removeEffect(sessionId, effectId)
toggleEffect(sessionId, effectId)
```

Rules:
- No duplicate canonical effect IDs.
- Preserve selection order.
- Recalculate pricing after every mutation.
- Persist across silo/series navigation.
- Removing effects compacts selection order unless a stable historical order is required elsewhere.

## 6. Pricing resolver
Authoritative function:

```ts
resolveSelectionOffer(count: number): SelectionOffer
```

```ts
type SelectionOffer = {
  count: number
  tier: "tier_1" | "tier_2" | "tier_3" | "tier_4" | "complete"
  priceUsd: number
  nextThreshold: number | null
  capacityAtCurrentPrice: number
  remainingAtCurrentPrice: number
  includedUnlocks: number
}
```

Rules:

```txt
count 0       => no purchasable offer
1..4          => tier_1, $2.99, 0 unlocks, capacity 4
5..9          => tier_2, $4.99, 1 unlock, capacity 9
10..19        => tier_3, $7.99, 1 unlock, capacity 19
20..39        => tier_4, $12.99, 2 unlocks, capacity 39
40..56        => complete, $24.99, 3 unlocks, capacity 56
```

CUI must never reimplement this table.

## 7. Example response
```json
{
  "count": 12,
  "tier": "tier_3",
  "priceUsd": 7.99,
  "nextThreshold": 20,
  "capacityAtCurrentPrice": 19,
  "remainingAtCurrentPrice": 7,
  "includedUnlocks": 1
}
```

## 8. Tier event emission
After selection mutation CENG may emit:

```ts
type TierChangeEvent = {
  previousTier: string | null
  currentTier: string | null
  direction: "up" | "down" | "none"
}
```

This allows CUI to trigger material transitions without deriving business rules.

## 9. Portfolio paging helper
CUI can derive visual pages, but CENG may provide stable ordering:

```ts
portfolioPosition(index: number) => {
  pageIndex: Math.floor(index / 8),
  slotIndex: index % 8
}
```

8 works per page state is a UX rule, not a pricing rule.

## 10. Curator contract
Curator receives:
- source image analysis/metadata
- available catalog
- visited effects
- selected effects
- user intent text/quick-choice
- optional tier context

Curator returns canonical effect IDs, not arbitrary render instructions unless explicitly part of the product.

```ts
type CuratorResponse = {
  message: string
  recommendedEffectIds: string[]
  suggestedIntent?: string
}
```

CUI highlights those IDs in their native gallery locations.

## 11. Checkout contract
At purchase initiation:
1. freeze a checkout snapshot of selected canonical effect IDs in order;
2. resolve offer from snapshot count;
3. charge that offer;
4. on success create a generation batch;
5. later gallery edits must not mutate a paid batch.

```ts
type CheckoutSnapshot = {
  sessionId: string
  selectedEffectIds: string[]
  tier: string
  priceUsd: number
  includedUnlocks: number
  createdAt: string
}
```

## 12. Generation batch
```ts
type GenerationBatch = {
  batchId: string
  checkoutId: string
  sourceAssetId: string
  jobs: GenerationJob[]
  status: "queued" | "running" | "partial" | "complete" | "failed"
}

type GenerationJob = {
  jobId: string
  effectId: string
  resolvedVariantId?: string
  portfolioOrder: number
  status: "queued" | "running" | "complete" | "retrying" | "failed"
  attempts: number
  previewAssetId?: string
  watermarkState: "watermarked" | "unlocked"
}
```

## 13. Rerenders
Rerender/retry policy remains engine-owned.
Requirements:
- maintain original effect ID and portfolio order;
- never create an extra user-visible selection count;
- replacement output supersedes failed/rejected attempt;
- track attempts for cost analytics;
- My Collection should present one canonical result per purchased effect unless product explicitly exposes alternates.

## 14. Progressive My Collection
As jobs complete, CUI may render them progressively.
Preferred display order follows `portfolioOrder`, while incomplete jobs keep placeholders.

## 15. Unlock entitlements
After batch completion/partial completion:
```ts
type UnlockEntitlement = {
  batchId: string
  includedTotal: number
  includedRemaining: number
  additionallyPurchased: number
}
```

Redeeming an included unlock:
- must be idempotent;
- marks chosen asset as unlocked;
- decrements included remaining;
- does not alter preview purchase history.

Additional unlock purchase is a separate commerce transaction.

## 16. Analytics events
At minimum:
- discovery_session_started
- silo_viewed
- minimap_navigated
- effect_selected
- effect_removed
- tier_changed
- curator_prompted
- curator_recommendation_shown
- portfolio_quick_opened
- portfolio_full_opened
- checkout_started
- checkout_completed
- generation_completed
- included_unlock_redeemed
- additional_unlock_purchased

Include session ID, canonical effect IDs, tier, count, and source lane where appropriate.

## 17. Persistence
Selection session should survive:
- silo navigation
- series navigation
- route changes within the product where appropriate
- accidental reload, if current auth/session architecture supports it

Do not silently discard a Portfolio.

## 18. Error handling
- If catalog load fails: do not fabricate effects.
- If one generation job fails: allow batch to continue.
- If payment fails: preserve discovery session and Portfolio selections.
- If Curator fails: gallery remains fully usable.
- If variant resolution fails: use approved fallback or return explicit engine error; CUI must not guess.

## 19. Engine prohibition
CENG must not introduce UI concepts such as Queue, cart, wizard stages, badges, or extra tiers.
