// store/generation-kickoff.ts
// lib/store/generation-kickoff.ts
//
// Stub implementation of GenerationKickoff. The application chat replaces
// this with the real call into lib/v1/* when it integrates the create-page
// flow. Until then, optimistic generation is logged but no actual work
// happens — the entitlement is reserved and waits for a future caller.
//
// To wire the real implementation, the application chat should:
//   1. Replace the body of `start()` with a call to whatever generation
//      pipeline applies (groups, structures, landscapes, etc.).
//   2. On success: call consumeEntitlement() with the jobId.
//   3. On terminal failure: call restoreEntitlement().
//   4. Persist the result image such that /result/[jobId] can render it.

import type { GenerationKickoff } from './types'

export const defaultGenerationKickoff: GenerationKickoff = {
  async start(args) {
    const refDisplay =
      args.sourceImageRef === null
        ? '<none>'
        : args.sourceImageRef.length > 64
          ? args.sourceImageRef.slice(0, 64) + '…'
          : args.sourceImageRef
    console.log(
      '[generation-kickoff:STUB] would start generation',
      `jobId=${args.jobId}`,
      `entitlementId=${args.entitlementId}`,
      `style=${args.style}`,
      `variant=${args.variant}`,
      `sourceImageRef=${refDisplay}`,
    )
    // Application chat replaces this with the real pipeline call.
  },
}
