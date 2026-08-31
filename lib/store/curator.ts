// lib/store/curator.ts
// Implements CENG_DISCOVERY_ENGINE_SPEC.md section 10 — Curator
// recommendation logic for Discovery states 3, 4, 5.
//
// ALL user-facing message strings are DRAFT placeholders — Rich approves
// before ship. Search "DRAFT" to find every one.
//
// Photo analysis reuses the same OpenAI vision pattern as
// detectFaceVisibility (portraits-refine.ts) and classifySubject
// (subject-redirect.ts): local OpenAI client, gpt-4o, base64 image,
// JSON response format.

import OpenAI from 'openai'
import { getPortraitsCatalogMap, type SiloId } from './discovery-catalog'

// ─── Contract types (unchanged from the original stub) ──────────

export interface CuratorRequest {
  sessionId: string
  sourceImageB64?: string
  sourceAssetAnalysis?: PhotoAnalysis
  visitedEffectIds: string[]
  selectedEffectIds: string[]
  userIntentText?: string
  quickChoice?: string
  tierContext?: string
  targetCount?: number
}

export interface CuratorResponse {
  message: string
  recommendedEffectIds: string[]
  suggestedIntent?: string
  followUpQuestion?: string
}

// ─── Photo analysis ─────────────────────────────────────────────

export interface PhotoAnalysis {
  genderPresentation: 'masculine' | 'feminine' | 'androgynous' | 'unknown'
  ageRange: 'child' | 'teen' | 'young_adult' | 'adult' | 'mature' | 'senior'
  expressionEnergy: 'warm' | 'intense' | 'serene' | 'playful' | 'serious' | 'neutral'
  dominantTones: string[]    // e.g. ['warm', 'earthy'] or ['cool', 'high-contrast']
  compositionType: 'face_only' | 'head_shoulders' | 'upper_body' | 'full_body'
  subjectDescription: string // brief factual description, NOT customer-facing
}

const PHOTO_ANALYSIS_PROMPT = `Analyze this portrait photograph for an art recommendation engine. Return JSON only.

{
  "genderPresentation": "masculine" | "feminine" | "androgynous" | "unknown",
  "ageRange": "child" | "teen" | "young_adult" | "adult" | "mature" | "senior",
  "expressionEnergy": "warm" | "intense" | "serene" | "playful" | "serious" | "neutral",
  "dominantTones": ["warm" or "cool" or "earthy" or "high-contrast" or "muted" or "vibrant" — pick 1-3],
  "compositionType": "face_only" | "head_shoulders" | "upper_body" | "full_body",
  "subjectDescription": "Brief factual description of the subject (20 words max)"
}`

export async function analyzeSourcePhoto(sourceImageB64: string): Promise<PhotoAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('curator_openai_key_missing')

  const openai = new OpenAI({ apiKey, timeout: 15_000, maxRetries: 1 })

  const response = await openai.chat.completions.create({
    model:           'gpt-4o-mini',
    max_tokens:      300,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${sourceImageB64}`, detail: 'low' } },
        { type: 'text', text: PHOTO_ANALYSIS_PROMPT },
      ],
    }],
  })

  const raw = (response.choices[0]?.message?.content || '{}').trim()
  let parsed: any = {}
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn('[curator] photo analysis JSON parse failed — using defaults')
  }

  return {
    genderPresentation: ['masculine', 'feminine', 'androgynous', 'unknown'].includes(parsed.genderPresentation)
      ? parsed.genderPresentation : 'unknown',
    ageRange: ['child', 'teen', 'young_adult', 'adult', 'mature', 'senior'].includes(parsed.ageRange)
      ? parsed.ageRange : 'adult',
    expressionEnergy: ['warm', 'intense', 'serene', 'playful', 'serious', 'neutral'].includes(parsed.expressionEnergy)
      ? parsed.expressionEnergy : 'neutral',
    dominantTones: Array.isArray(parsed.dominantTones) ? parsed.dominantTones.slice(0, 3).map(String) : [],
    compositionType: ['face_only', 'head_shoulders', 'upper_body', 'full_body'].includes(parsed.compositionType)
      ? parsed.compositionType : 'head_shoulders',
    subjectDescription: typeof parsed.subjectDescription === 'string'
      ? parsed.subjectDescription.slice(0, 120) : '',
  }
}

// ─── Silo affinity scoring ──────────────────────────────────────
//
// Maps intent signals to silo weights. Higher weight = more likely
// to draw effects from that silo. This is the "taste" logic — the
// photo analysis and intent text both contribute to which silos
// get boosted.

const SILO_LABELS: Record<SiloId, string> = {
  another_age:      'historical, period, costume, era, vintage, classical, antique',
  earth_ore:        'natural, earthy, mineral, raw, grounded, solid, stone, metal',
  light_glass:      'luminous, translucent, bright, glowing, ethereal, glass, ice, crystal',
  living_world:     'organic, botanical, nature, wood, coral, floral, garden',
  made_by_hand:     'craft, handmade, playful, whimsical, soft, toy, fabric',
  artists_gallery:  'artistic, painterly, drawn, sketch, classical art, gallery, fine art',
  ink_paper:        'graphic, bold, stylized, print, literary, decorative, pattern',
  fantasy_future:   'dramatic, fantasy, sci-fi, fire, dragon, robot, magical, cosmic',
}

function scoreSiloAffinity(
  analysis: PhotoAnalysis,
  intentText: string | undefined,
  quickChoice: string | undefined,
): Record<SiloId, number> {
  const scores: Record<SiloId, number> = {
    another_age: 1, earth_ore: 1, light_glass: 1, living_world: 1,
    made_by_hand: 1, artists_gallery: 1, ink_paper: 1, fantasy_future: 1,
  }

  // Intent text matching — boost silos whose keywords match
  const intent = (intentText || quickChoice || '').toLowerCase()
  if (intent) {
    for (const [silo, keywords] of Object.entries(SILO_LABELS)) {
      for (const kw of keywords.split(', ')) {
        if (intent.includes(kw)) {
          scores[silo as SiloId] += 3
        }
      }
    }
  }

  // Quick-choice presets — these map common user desires to silo boosts
  if (quickChoice) {
    const qc = quickChoice.toLowerCase()
    if (qc.includes('dramatic') || qc.includes('bold')) {
      scores.fantasy_future += 4
      scores.light_glass += 2
      scores.another_age += 2
    } else if (qc.includes('natural') || qc.includes('organic')) {
      scores.earth_ore += 4
      scores.living_world += 4
    } else if (qc.includes('artistic') || qc.includes('creative')) {
      scores.artists_gallery += 4
      scores.ink_paper += 3
    } else if (qc.includes('classic') || qc.includes('timeless')) {
      scores.earth_ore += 3
      scores.another_age += 3
      scores.artists_gallery += 2
    } else if (qc.includes('fun') || qc.includes('playful')) {
      scores.made_by_hand += 4
      scores.fantasy_future += 2
    } else if (qc.includes('elegant') || qc.includes('refined')) {
      scores.light_glass += 3
      scores.another_age += 3
      scores.artists_gallery += 2
    }
  }

  // Photo-driven adjustments
  if (analysis.expressionEnergy === 'playful') {
    scores.made_by_hand += 2
    scores.fantasy_future += 1
  } else if (analysis.expressionEnergy === 'intense' || analysis.expressionEnergy === 'serious') {
    scores.earth_ore += 2
    scores.fantasy_future += 2
    scores.another_age += 1
  } else if (analysis.expressionEnergy === 'warm' || analysis.expressionEnergy === 'serene') {
    scores.living_world += 2
    scores.artists_gallery += 1
    scores.light_glass += 1
  }

  if (analysis.dominantTones.some(t => t === 'warm' || t === 'earthy')) {
    scores.earth_ore += 1
    scores.living_world += 1
  }
  if (analysis.dominantTones.some(t => t === 'cool' || t === 'high-contrast')) {
    scores.light_glass += 1
    scores.fantasy_future += 1
  }

  return scores
}

// ─── Effect selection ───────────────────────────────────────────

/**
 * Selects exactly `targetCount` canonical effect IDs from the
 * 56-position catalog. Ensures:
 * - No null effects (the dead beaded slot)
 * - No already-selected effects
 * - Reasonable spread: max 2 per silo for counts <= 8, max 3 for 16
 * - Weighted toward silos that match the photo + intent
 */
export function selectRecommendedEffects(
  analysis: PhotoAnalysis,
  intentText: string | undefined,
  quickChoice: string | undefined,
  targetCount: number,
  alreadySelected: string[],
): string[] {
  const catalog = getPortraitsCatalogMap()
  const selectedSet = new Set(alreadySelected)

  // Build a pool of eligible effects with silo-weighted scores
  const siloScores = scoreSiloAffinity(analysis, intentText, quickChoice)
  const maxPerSilo = targetCount <= 8 ? 2 : 3

  const pool: Array<{ effectId: string; siloId: SiloId; score: number }> = []
  for (const entry of catalog) {
    if (!entry.effectId) continue
    if (selectedSet.has(entry.effectId)) continue
    pool.push({
      effectId: entry.effectId,
      siloId: entry.siloId,
      score: siloScores[entry.siloId] + Math.random() * 0.5,
    })
  }

  // Sort by score descending (with random jitter for variety)
  pool.sort((a, b) => b.score - a.score)

  // Pick effects respecting the per-silo cap
  const picked: string[] = []
  const siloCount: Record<string, number> = {}

  for (const candidate of pool) {
    if (picked.length >= targetCount) break
    const currentSiloCount = siloCount[candidate.siloId] || 0
    if (currentSiloCount >= maxPerSilo) continue
    picked.push(candidate.effectId)
    siloCount[candidate.siloId] = currentSiloCount + 1
  }

  // If we didn't get enough (unlikely with 55 live effects), fill
  // from remaining pool ignoring silo cap
  if (picked.length < targetCount) {
    const pickedSet = new Set(picked)
    for (const candidate of pool) {
      if (picked.length >= targetCount) break
      if (pickedSet.has(candidate.effectId)) continue
      picked.push(candidate.effectId)
    }
  }

  return picked.slice(0, targetCount)
}

// ─── Quick-choice options (state 4) ─────────────────────────────
// DRAFT - Rich approves before ship
export const QUICK_CHOICES = [
  { id: 'dramatic',  label: 'Something dramatic' },        // DRAFT
  { id: 'natural',   label: 'Natural and organic' },       // DRAFT
  { id: 'artistic',  label: 'Artistic and creative' },     // DRAFT
  { id: 'classic',   label: 'Classic and timeless' },      // DRAFT
  { id: 'fun',       label: 'Fun and playful' },           // DRAFT
  { id: 'elegant',   label: 'Elegant and refined' },       // DRAFT
]

// ─── Main entry point ───────────────────────────────────────────

export async function getCuratorRecommendation(
  req: CuratorRequest,
): Promise<CuratorResponse> {
  // Resolve photo analysis — use cached if provided, otherwise analyze
  let analysis: PhotoAnalysis
  if (req.sourceAssetAnalysis) {
    analysis = req.sourceAssetAnalysis
  } else if (req.sourceImageB64) {
    analysis = await analyzeSourcePhoto(req.sourceImageB64)
  } else {
    // No image available — use neutral defaults
    analysis = {
      genderPresentation: 'unknown',
      ageRange: 'adult',
      expressionEnergy: 'neutral',
      dominantTones: [],
      compositionType: 'head_shoulders',
      subjectDescription: '',
    }
  }

  const hasIntent = !!(req.userIntentText || req.quickChoice)

  // ── State 3: Pick for me ──────────────────────────────────────
  if (!hasIntent && !req.quickChoice) {
    // No intent at all — this is "Pick for me"
    // Per Rich: ASKS which size first. The route/CUI handles the size
    // question before calling this. By the time we get here, targetCount
    // should be set. If it isn't, default to 4 (smallest portfolio).
    const count = req.targetCount || 4
    const recommended = selectRecommendedEffects(
      analysis, undefined, undefined, count, req.selectedEffectIds,
    )

    return {
      // DRAFT - Rich approves before ship
      message: `Here are ${count} effects chosen for your photo.`,
      recommendedEffectIds: recommended,
    }
  }

  // ── State 4: Help me choose (quick-choice buttons) ────────────
  if (req.quickChoice && !req.userIntentText) {
    const count = req.targetCount || 4
    const recommended = selectRecommendedEffects(
      analysis, undefined, req.quickChoice, count, req.selectedEffectIds,
    )

    // One follow-up question max for this first build
    const followUp = recommended.length < count
      ? undefined
      // DRAFT - Rich approves before ship
      : `Would you like to adjust any of these, or are you happy with this selection?`

    return {
      // DRAFT - Rich approves before ship
      message: `Based on "${req.quickChoice}", here are ${count} effects that match.`,
      recommendedEffectIds: recommended,
      suggestedIntent: req.quickChoice,
      followUpQuestion: followUp,
    }
  }

  // ── State 5: Describe what you're looking for (free text) ─────
  // Also handles state 4 follow-up when user refines with text
  {
    const count = req.targetCount || 4
    const recommended = selectRecommendedEffects(
      analysis, req.userIntentText, req.quickChoice, count, req.selectedEffectIds,
    )

    return {
      // DRAFT - Rich approves before ship
      message: `Here are ${count} effects based on what you described.`,
      recommendedEffectIds: recommended,
      suggestedIntent: req.userIntentText,
    }
  }
}
