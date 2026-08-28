// lib/store/curator.ts
// Implements CENG_DISCOVERY_ENGINE_SPEC.md section 10 - contract shape
// only. The actual Curator voice/prompt text is NOT written here - per
// standing rule, Curator copy is Rich's and gets approved before it
// ships, never invented. The `message` field below is a structural
// placeholder marked DRAFT; whoever wires the real OpenAI call replaces
// buildCuratorPrompt's body with Rich's approved wording, not this.
//
// Recommendation logic itself (which effects get suggested) is also not
// implemented - this only defines the contract shape both sides can
// build against, consistent with the spec doc's own type definitions.

export interface CuratorRequest {
  sessionId: string
  sourceAssetAnalysis?: Record<string, unknown>
  visitedEffectIds: string[]
  selectedEffectIds: string[]
  userIntentText?: string
  quickChoice?: string
  tierContext?: string
}

export interface CuratorResponse {
  message: string
  recommendedEffectIds: string[]
  suggestedIntent?: string
}

/** NOT IMPLEMENTED. Structural stub so the route below has something
 *  real to call and type-check against, without fabricating a live
 *  recommendation engine or Curator copy. Throws explicitly rather than
 *  returning a fake response - a silent fake here is worse than an
 *  obvious failure, per spec section 18 ("gallery remains fully usable"
 *  on Curator failure - the CALLER handles this throw as a normal
 *  failure case, same as any other Curator-down scenario).
 */
export async function getCuratorRecommendation(
  req: CuratorRequest,
): Promise<CuratorResponse> {
  throw new Error(
    'curator_not_implemented: recommendation logic and copy are not ' +
    'built - needs Rich-approved Curator voice (see product spec section ' +
    '10) plus a real recommendation strategy (source analysis + catalog ' +
    '+ intent -> effect IDs), neither of which exist yet.',
  )
}
