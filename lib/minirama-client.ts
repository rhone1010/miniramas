// lib/minirama-client.ts
// Frontend/client-side orchestrator for the reinforcement loop.
// The UI calls runMinirama() and receives progress callbacks.

import { ArchitectureBlueprint, PassResult, Scorecard } from './structure/types'
import { GenerationModel } from './structure/generateImage'

export interface MiniramaRunOptions {
  imageB64: string
  imageId?: string
  model?: GenerationModel
  styleReference?: string
  maxPasses?: number
  targetScore?: number
  onProgress?: (event: MiniramaProgressEvent) => void
}

export type MiniramaProgressEvent =
  | { type: 'analyzing' }
  | { type: 'blueprint_ready'; blueprint: ArchitectureBlueprint; summary: BlueprintSummary }
  | { type: 'pass_start'; iteration: number; model: GenerationModel }
  | { type: 'pass_complete'; result: PassResult; iteration: number }
  | { type: 'converged'; finalResult: PassResult; iterations: number }
  | { type: 'error'; error: string }

export interface BlueprintSummary {
  building_type: string
  style: string
  stories: number
  porch: string
  non_negotiables: string[]
}

export interface MiniramaFinalResult {
  best_result: PassResult
  all_passes: PassResult[]
  blueprint: ArchitectureBlueprint
  total_iterations: number
  converged: boolean
}

export async function runMinirama(options: MiniramaRunOptions): Promise<MiniramaFinalResult> {
  const {
    imageB64,
    imageId,
    model = 'gpt-image-1',
    styleReference,
    maxPasses = 3,
    targetScore = 85,
    onProgress,
  } = options

  const emit = (event: MiniramaProgressEvent) => onProgress?.(event)

  // ── PHASE 1: Analyze (runs once) ──────────────────────────────────────────
  emit({ type: 'analyzing' })

  const analyzeRes = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_b64: imageB64,
      image_id: imageId || `img_${Date.now()}`,
    }),
  })

  if (!analyzeRes.ok) {
    const err = await analyzeRes.json()
    emit({ type: 'error', error: err.error || 'Analysis failed' })
    throw new Error(err.error || 'Analysis failed')
  }

  const analyzeData = await analyzeRes.json()
  const {
    blueprint,
    structure_lock,
    anti_drift,
    summary,
  }: {
    blueprint: ArchitectureBlueprint
    structure_lock: string
    anti_drift: string
    summary: BlueprintSummary
  } = analyzeData

  emit({ type: 'blueprint_ready', blueprint, summary })

  // ── PHASE 2: Reinforcement loop ───────────────────────────────────────────
  const allPasses: PassResult[] = []
  let currentPatch: string | undefined
  let previousScore: number | undefined
  let bestResult: PassResult | null = null

  for (let iteration = 1; iteration <= maxPasses; iteration++) {
    emit({ type: 'pass_start', iteration, model })

    const passRes = await fetch('/api/run-pass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blueprint,           // immutable — same object every pass
        structure_lock,      // immutable
        anti_drift,          // immutable
        iteration,
        model,
        patch: currentPatch,
        style_reference: styleReference,
        previous_score: previousScore,
      }),
    })

    if (!passRes.ok) {
      const err = await passRes.json()
      emit({ type: 'error', error: err.error || `Pass ${iteration} failed` })
      throw new Error(err.error || `Pass ${iteration} failed`)
    }

    const passData = await passRes.json()
    const result: PassResult = {
      image_b64: passData.image_b64,
      score: passData.score,
      scorecard: passData.scorecard,
      hard_capped: passData.hard_capped,
      cap_reason: passData.cap_reason,
      patch: passData.patch,
      iteration,
      prompt_used: passData.prompt_used,
    }

    allPasses.push(result)
    emit({ type: 'pass_complete', result, iteration })

    // Track best result across passes
    if (!bestResult || result.score > bestResult.score) {
      bestResult = result
    }

    previousScore = result.score

    // Check convergence
    if (result.score >= targetScore) {
      emit({ type: 'converged', finalResult: result, iterations: iteration })
      return {
        best_result: bestResult,
        all_passes: allPasses,
        blueprint,
        total_iterations: iteration,
        converged: true,
      }
    }

    // Set patch for next pass (from the formatted patch block)
    currentPatch = passData.patch_formatted || undefined
  }

  // Max passes reached
  return {
    best_result: bestResult!,
    all_passes: allPasses,
    blueprint,
    total_iterations: maxPasses,
    converged: false,
  }
}
