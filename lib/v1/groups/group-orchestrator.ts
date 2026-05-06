// group-orchestrator.ts
// lib/v1/group-orchestrator.ts
//
// MINIMAL PIPELINE — TEMPORARY.
//
// Stages:
//   1. Analyze              — GPT-4o static-pose description
//   2. Generate             — Nano Banana on Replicate
//   3. Brand overlay        — composite miniRama wordmark
//
// REMOVED (parked for re-enable):
//   - Tier classification (face-tier.ts) — let everything through
//   - Face similarity scoring (face-similarity.ts) — no quality gate
//   - Retry loop — single attempt, ship whatever Nano Banana returns
//
// To restore the full pipeline, see git history of this file.

import { analyzeGroup }                    from './group-analyzer'
import { generateGroup, GroupGenerateOptions } from './group-generator'
import { applyBrandOverlay }               from './brand-overlay'

// ── PUBLIC TYPES ─────────────────────────────────────────────────

export interface GroupPipelineInput {
  sourceImageB64:    string
  options:           Omit<GroupGenerateOptions, 'description'>
  openaiApiKey:      string
  replicateApiKey:   string
  skipBrandOverlay?: boolean
  /** Kept for API compatibility but ignored in this build. */
  skipScoring?:      boolean
}

export interface GroupPipelineResult {
  imageB64:        string
  promptUsed:      string
  description:     string
  moodSummary:     string
  /** Always null in this build (tier check disabled) */
  tier:            null
  /** Always null in this build (scoring disabled) */
  similarity:      null
  /** Always 1 in this build (no retry loop) */
  attempts:        number
  qualityWarning:  string | null
  warnings:        string[]
}

export interface GroupPipelineRejection {
  rejected: true
  tier:     'bust' | 'hard' | 'reject'
  message:  string
}

// ── PUBLIC API ───────────────────────────────────────────────────

export async function runGroupPipeline(
  input: GroupPipelineInput,
): Promise<GroupPipelineResult | GroupPipelineRejection> {

  // STAGE 1: ANALYZE (GPT-4o description for the prompt)
  const analysis = await analyzeGroup({
    sourceImageB64: input.sourceImageB64,
    openaiApiKey:   input.openaiApiKey,
  })

  // STAGE 2: GENERATE — with one retry on transient failure
  const gen = await generateWithRetry({
    sourceImageB64:    input.sourceImageB64,
    replicateApiToken: input.replicateApiKey,
    options:           { ...input.options, description: analysis.description },
  })
  let imageB64    = gen.imageB64
  const promptUsed = gen.promptUsed
  const attempts   = gen.attempts

  // STAGE 3: BRAND OVERLAY
  if (!input.skipBrandOverlay) {
    const branded = await applyBrandOverlay({ imageB64 })
    imageB64 = branded.imageB64
  }

  return {
    imageB64,
    promptUsed,
    description:    analysis.description,
    moodSummary:    analysis.moodSummary,
    tier:           null,
    similarity:     null,
    attempts,
    qualityWarning: null,
    warnings:       [],
  }
}

// ── RETRY HELPER ─────────────────────────────────────────────────
// Nano Banana 2 occasionally returns transient errors (Replicate-side
// flake, rate-limit hiccups, model cold-starts). One retry catches
// most of them without doubling latency on the happy path.

async function generateWithRetry(input: {
  sourceImageB64:    string
  replicateApiToken: string
  options:           GroupGenerateOptions
}): Promise<{ imageB64: string; promptUsed: string; attempts: number }> {
  try {
    const r = await generateGroup(input)
    return { ...r, attempts: 1 }
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    console.warn(`[orchestrator] generate attempt 1 failed: ${msg} — retrying once`)

    // Brief backoff before retry — gives transient issues a chance to clear
    await new Promise(resolve => setTimeout(resolve, 1500))

    try {
      const r = await generateGroup(input)
      console.log('[orchestrator] retry succeeded on attempt 2')
      return { ...r, attempts: 2 }
    } catch (err2: any) {
      const msg2 = err2?.message ?? String(err2)
      console.error(`[orchestrator] generate retry also failed: ${msg2}`)
      // Re-throw the second error so the route gets the most recent failure
      throw err2
    }
  }
}
