// lib/v1/groups/groups-expand.ts
//
// Outpaint passthrough for the Groups silo. Outpaint was originally added
// to give renders gallery breathing room around the figures, but NB2's
// native framing has improved to the point where the post-process margin
// is no longer needed — and the outpaint step was contributing soft seam
// artifacts at the image edges.
//
// This module is now a no-op that preserves the call signature so the
// orchestrator doesn't need restructuring. The function returns the input
// image unchanged. If outpainting ever needs to come back (e.g. for a
// specific style that benefits from a wider canvas), the Stability call
// can be restored here — the rest of the pipeline doesn't need to know.

import type { Scale } from './groups-shared'

export interface GroupsExpandInput {
  imageB64:          string
  scale:             Scale
  stabilityApiKey?:  string
}

export interface GroupsExpandOutput {
  imageB64:    string
  expanded:    boolean
  durationMs:  number
  reason?:     string
}

export async function expandGroupsImage(
  input: GroupsExpandInput,
): Promise<GroupsExpandOutput> {
  // Outpaint removed from Groups. NB2's native framing is the final framing.
  return {
    imageB64:   input.imageB64,
    expanded:   false,
    durationMs: 0,
    reason:     'outpaint disabled — NB2 native framing is final',
  }
}
