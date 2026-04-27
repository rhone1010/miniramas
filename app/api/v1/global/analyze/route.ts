// global-analyze-route.ts
// app/api/v1/global/analyze/route.ts
//
// Top-level meta-analyzer. Single GPT-4o vision call returns:
//   - suitability score per Miniscape module (0-100)
//   - the single suggested module that best fits this image
//   - short reason text for both the suggestion and the runners-up
//
// PRE-FLIGHT: Every request runs through moderateUploadedImage() FIRST.
// If the image is rejected, we return 422 with a clean reason and log the
// rejection to the pattern store. We never call gpt-4o on a rejected image.
//
// RATE LIMIT: Users with many recent rejections see a graduated delay. This
// is friction, not a ban — they can keep trying as long as they're patient.

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { moderateUploadedImage } from '@/lib/v1/moderation'
import { logRejection, deriveUserId } from '@/lib/v1/rejection-log'
import { checkRateLimit } from '@/lib/v1/rate-limit'

interface ModuleSuitability {
  score:  number
  suited: boolean
  why:    string
}

interface GlobalAnalysis {
  suggested: { module: string; reason: string }
  suitability: Record<string, ModuleSuitability>
  display_name?: string
}

const SUPPORTED_MODULES = ['structures', 'landscapes', 'groups', 'sportsmem', 'interiors', 'actionmini'] as const

const ANALYZE_PROMPT = `You are the routing analyzer for Miniscape — a service that turns photos into miniature scale-model dioramas. Your job is to determine which Miniscape MODULE best fits this image.

The six modules are:

1. STRUCTURES — buildings, homes, architecture. Best when the image shows a clear single building, house, storefront, church, etc., with visible structure and form. NOT for landscapes, people, or interiors.

2. LANDSCAPES — natural places, vistas, beaches, forests, coastlines, parks, gardens, scenic outdoor settings. Best when the image is about the PLACE more than any single subject. NOT for buildings or people.

3. GROUPS — multiple people in a portrait or group photo. Best when 2+ people are the clear subjects, not in active motion. Family shots, team photos, friend groups, wedding parties.

4. SPORTSMEM (Sports Memorabilia) — fans at a sports event, people at a stadium, team supporters in venue context. Best when the image shows people in a sports-event environment as fans/supporters, not athletes in action. Distinguishes from ACTIONMINI by static fan posture vs athletic action.

5. INTERIORS — rooms, dollhouse-style cutaway scenes, kitchens, living rooms, libraries. Best when the image is about an INTERIOR SPACE, not the people inside it. NOT for exterior photos or close-ups of people.

6. ACTIONMINI (Action Minis) — kinetic athletic action: surfing, skiing, mountain biking, climbing, running, skating, kayaking, dancing, wrestling, gymnastics, parkour. Best when there's a clear hero figure mid-action with kinetic energy. NOT for static portraits or landscape shots.

Score each module 0-100 based on how well this image fits it. Most images will score high in 1-2 modules and low in others. Provide a 1-sentence "why" for each score (max ~80 chars).

Then pick the SINGLE BEST module as your suggestion with a 1-2 sentence reason.

Also give a short 2-4 word display_name describing what's in the image.

Respond ONLY with valid JSON in exactly this shape:
{
  "suggested": {
    "module": "actionmini",
    "reason": "A clear shot of a hurdler mid-jump with strong kinetic energy and dynamic pose."
  },
  "suitability": {
    "structures":  { "score": 5,  "suited": false, "why": "No buildings visible." },
    "landscapes":  { "score": 25, "suited": false, "why": "Setting present but action dominates." },
    "groups":      { "score": 10, "suited": false, "why": "Single person, mid-motion." },
    "sportsmem":   { "score": 35, "suited": false, "why": "Athletic context but hero is performing, not spectating." },
    "interiors":   { "score": 0,  "suited": false, "why": "Outdoor scene." },
    "actionmini":  { "score": 92, "suited": true,  "why": "Hurdler captured at jump apex." }
  },
  "display_name": "Hurdle Jump"
}

The "suited" boolean should be true when score >= 60.

Respond ONLY with valid JSON. No markdown, no commentary.`

export async function POST(req: NextRequest) {
  try {
    const { image_b64 } = await req.json()
    if (!image_b64) {
      return NextResponse.json({ error: 'image_b64 required' }, { status: 400 })
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
    }

    const userId = deriveUserId(req)

    // ── PRE-FLIGHT MODERATION ────────────────────────────────
    const mod = await moderateUploadedImage({ imageB64: image_b64, openaiApiKey })
    if (!mod.allowed) {
      logRejection({
        userId,
        category:  mod.category,
        verdict:   mod.verdict,
        imageHash: mod.imageHash,
        reason:    mod.reason,
        route:     'global',
      })

      const rate = checkRateLimit(userId)
      return NextResponse.json({
        error:           mod.reason,
        category:        mod.category,
        verdict:         mod.verdict,
        retryable:       mod.verdict === 'soft',
        delayMs:         rate.delayMs,
        rateLimitTier:   rate.tier,
      }, { status: 422 })
    }

    // ── RATE LIMIT (image was allowed but user may still have a cooldown) ─
    const rate = checkRateLimit(userId)
    if (rate.delayMs > 0) {
      return NextResponse.json({
        error:         rate.message || 'Please wait before trying again.',
        delayMs:       rate.delayMs,
        rateLimitTier: rate.tier,
        cooldown:      true,
      }, { status: 429 })
    }

    // ── ROUTING ANALYSIS ─────────────────────────────────────
    const openai = new OpenAI({ apiKey: openaiApiKey })

    const response = await openai.chat.completions.create({
      model:      'gpt-4o',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${image_b64}`, detail: 'low' },
          },
          { type: 'text', text: ANALYZE_PROMPT },
        ],
      }],
    })

    const raw   = response.choices[0]?.message?.content?.trim() || '{}'
    const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

    let parsed: any = {}
    try {
      parsed = JSON.parse(clean)
    } catch {
      console.warn('[global-analyze] JSON parse failed — returning fallback')
      parsed = buildFallback()
    }

    const result = normalizeAnalysis(parsed)
    console.log(
      `[global-analyze] Suggested: ${result.suggested.module} ` +
      `(${result.suitability[result.suggested.module]?.score ?? '?'}/100) — ` +
      `${result.display_name || 'unnamed'}`
    )

    return NextResponse.json(result)

  } catch (err: any) {
    console.error('[global-analyze]', err.message)
    return NextResponse.json(buildFallback(), { status: 200 })
  }
}

// ── HELPERS ─────────────────────────────────────────────────

function buildFallback(): GlobalAnalysis {
  const suitability: Record<string, ModuleSuitability> = {}
  SUPPORTED_MODULES.forEach(m => {
    suitability[m] = { score: 50, suited: false, why: 'Could not analyze automatically.' }
  })
  return {
    suggested: { module: 'actionmini', reason: 'Could not auto-analyze; choose any module manually.' },
    suitability,
    display_name: 'Your Image',
  }
}

function normalizeAnalysis(parsed: any): GlobalAnalysis {
  const suitability: Record<string, ModuleSuitability> = {}
  SUPPORTED_MODULES.forEach(m => {
    const entry = parsed.suitability?.[m] || {}
    const score = Math.max(0, Math.min(100, Number(entry.score) || 0))
    suitability[m] = {
      score,
      suited: typeof entry.suited === 'boolean' ? entry.suited : score >= 60,
      why:    typeof entry.why === 'string' ? entry.why.slice(0, 120) : '',
    }
  })

  let suggestedModule = parsed.suggested?.module
  if (!SUPPORTED_MODULES.includes(suggestedModule)) {
    suggestedModule = SUPPORTED_MODULES.reduce((best, m) =>
      suitability[m].score > suitability[best].score ? m : best
    , SUPPORTED_MODULES[0])
  }

  return {
    suggested: {
      module: suggestedModule,
      reason: typeof parsed.suggested?.reason === 'string'
        ? parsed.suggested.reason.slice(0, 240)
        : 'This module fits the image best.',
    },
    suitability,
    display_name: typeof parsed.display_name === 'string'
      ? parsed.display_name.slice(0, 40)
      : undefined,
  }
}
