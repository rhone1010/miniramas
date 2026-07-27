// lib/v1/portraits/portraits-effect-curator.ts
//
// Effect Curator — picks 5 artistic styles for the source subject and rates
// the expected quality of each based on what the photo actually provides
// (face-only vs head-and-shoulders vs upper-torso vs full-body) AND what
// each style needs to land well.
//
// Per Rich's "Curator Workflow - Portrait Intake & Style Recommendation"
// spec (2026-06):
//   "Each recommendation includes: Style preview image, Style name,
//    One-sentence description, Expected quality level (Excellent / Good /
//    Limited)"
//
// Behavioral change from the prior implementation: the Curator NO LONGER
// writes personality-matched reasoning per subject. Style descriptions are
// hardcoded metadata about the artistic style itself; the Curator's job
// is to (1) pick which 5 styles to surface and (2) honestly assess the
// quality ceiling for THIS photo.

import OpenAI from 'openai'
import type { PortraitsStyleId, PortraitsPresetId } from './portraits-shared'

export type QualityLevel = 'Excellent' | 'Good' | 'Limited'

export interface EffectRecommendation {
  id:            string                // 'rec_1' .. 'rec_5'
  series:        PortraitsStyleId      // 'realistic' | 'artists_gallery'
  preset:        PortraitsPresetId
  preset_label:  string                // human label, e.g. "Folded Book"
  description:   string                // hardcoded 1-sentence style description
  quality_level: QualityLevel          // 'Excellent' | 'Good' | 'Limited'
}

export interface CurateEffectsInput {
  sourceImageB64:    string
  upperBodyConcept?: string | null     // vestigial — new flow doesn't populate
  openaiApiKey:      string
  // Deterministic rotation counter. The client persists and increments this
  // (e.g. localStorage) and sends it so the hero rotation advances per
  // recommendation set. When absent, a best-effort module counter is used
  // (resets on serverless cold start — pass the index for true determinism).
  rotationIndex?:    number
}

export interface CurateEffectsResult {
  recommendations: EffectRecommendation[]
  durationMs:      number
}

// Catalog of available styles. Each entry carries:
//   - label: human-visible name on the card
//   - description: one-sentence generic style description shown to the user
//   - body_dependency: how much the style benefits from visible body in the source
//       'high'   — material-transformation effects that need surface area
//                  (Folded Book, Sheet Music, Charcoal, Antique Clock, etc.)
//       'medium' — improves with body but works face-forward (Impressionist,
//                  Pencil Sketch, Torn Paper)
//       'low'    — face-forward styles where torso info matters less
//                  (Bronze, Alabaster, Ceramic — traditional busts)
//
// body_dependency drives quality_level assessment for face-only sources.
// The GPT-4o pass also looks at the actual photo to factor in lighting,
// expression clarity, age suitability, etc.
const EFFECT_CATALOG = [
  // Realistic series
  { series: 'realistic' as const,       preset: 'bronze' as const,         label: 'Bronze',          body_dependency: 'low' as const,
    description: 'Traditional museum-quality bronze portrait emphasizing realism and likeness.' },
  { series: 'realistic' as const,       preset: 'alabaster' as const,      label: 'Alabaster',       body_dependency: 'low' as const,
    description: 'Translucent carved alabaster with warm subsurface scattering, faint amber veining, and milky glowing depth.' },
  { series: 'realistic' as const,       preset: 'stone' as const,          label: 'Stone',           body_dependency: 'medium' as const,
    description: 'Polished multicolored quartzite with natural mineral bands of rust, cream, gray, rose, and ochre.' },
  { series: 'realistic' as const,       preset: 'ebony' as const,          label: 'Ebony',           body_dependency: 'medium' as const,
    description: 'Carved ebony wood sculpture in deep black-brown with visible grain and dignified presence.' },
  { series: 'realistic' as const,       preset: 'walnut' as const,         label: 'Walnut',          body_dependency: 'medium' as const,
    description: 'Carved walnut wood sculpture in rich warm tones with considered casual character.' },
  { series: 'realistic' as const,       preset: 'iron' as const,           label: 'Iron',            body_dependency: 'medium' as const,
    description: 'Dark forged iron with burnished highlights, hammer-work texture, and natural oxide patina.' },

  // Artists Gallery series — material-transformation effects, body-dependent
  { series: 'artists_gallery' as const, preset: 'impressionist' as const,  label: 'Impressionist',   body_dependency: 'medium' as const,
    description: 'Thick impasto paint strokes with real visible texture form a painterly sculptural portrait.' },
  { series: 'artists_gallery' as const, preset: 'torn_paper' as const,     label: 'Torn Paper',      body_dependency: 'high' as const,
    description: 'Thousands of torn and layered paper contours stack into a topographic terrain-map sculpture.' },
  { series: 'artists_gallery' as const, preset: 'folded_book' as const,    label: 'Folded Book',     body_dependency: 'high' as const,
    description: 'Flowing paper ribbons emerge from an open book to form a contemporary gallery sculpture (best with visible upper body).' },
  { series: 'artists_gallery' as const, preset: 'charcoal_chalk' as const, label: 'Charcoal & Chalk', body_dependency: 'high' as const,
    description: 'Compressed charcoal and white Conté chalk carve a dramatic sculptural form with airborne dust and chalk.' },
  { series: 'artists_gallery' as const, preset: 'pencil_sketch' as const,  label: 'Pencil Sketch',   body_dependency: 'medium' as const,
    description: 'A figure actively emerging from a vertical sketch — one side solid graphite sculpture, the other still pencil construction lines.' },
  { series: 'artists_gallery' as const, preset: 'sheet_music' as const,    label: 'Sheet Music',     body_dependency: 'high' as const,
    description: 'Sheet music and musical notation transform into elegant sculptural forms and flowing movement.' },
]

const VALID_PRESETS = new Set(EFFECT_CATALOG.map(e => e.preset))
const VALID_SERIES  = new Set(['realistic', 'artists_gallery'])
const ENTRY_BY_PRESET: Record<string, typeof EFFECT_CATALOG[number]> = Object.fromEntries(
  EFFECT_CATALOG.map(e => [e.preset, e]),
)

function buildCuratorPrompt(): string {
  const catalogText = EFFECT_CATALOG.map(e =>
    `- preset: "${e.preset}" | series: ${e.series} | label: ${e.label} | body-dependency: ${e.body_dependency}`,
  ).join('\n')

  return `You are the Curator for a fine-art sculpture studio. A user has uploaded a portrait photograph. Your job: pick FIVE styles from the catalog below and honestly rate the expected quality for THIS photo of THIS person.

STEP 1 — Read the photograph:
- Does it show face only, head and shoulders, upper torso, or full body?
- Is the face well-lit, sharp, and clearly visible?
- Age, expression, hair character, gender presentation, energy
- Any quality concerns: heavy shadows, blur, partial occlusion, low resolution, group photo

STEP 2 — Pick 5 styles from the catalog.
- Mix across the catalog: include at least 2 Artists Gallery and at least 2 Realistic styles unless the subject very clearly leans one way
- Pick styles that genuinely suit this person — don't recommend something that conflicts with their character just for variety
- Order by your STRONGEST recommendation first (rec_1 is your top pick)

STEP 3 — Assess quality level for each pick. Use exactly one of: "Excellent", "Good", "Limited"

Quality assessment rules:
- "Excellent" — strong fit: the photo provides what this style needs (good face information, and where relevant, visible shoulders/torso/clothing); identity preservation should be high
- "Good" — solid result expected with minor caveats (e.g. medium body-dependency style + face-only source, or slight lighting concerns)
- "Limited" — material-transformation style (body-dependency: high) being applied to a face-only source, OR significant photo-quality issues. The result may still be interesting but the artistic effect will compress onto the face and the bust may feel light on torso surface area.

CATALOG OF AVAILABLE STYLES:
${catalogText}

OUTPUT JSON ONLY — no markdown, no preamble:
{
  "recommendations": [
    {
      "id":            "rec_1",
      "series":        "artists_gallery",
      "preset":        "folded_book",
      "quality_level": "Excellent"
    },
    {
      "id":            "rec_2",
      "series":        "realistic",
      "preset":        "walnut",
      "quality_level": "Good"
    },
    {
      "id":            "rec_3", "series": "...", "preset": "...", "quality_level": "..."
    },
    {
      "id":            "rec_4", "series": "...", "preset": "...", "quality_level": "..."
    },
    {
      "id":            "rec_5", "series": "...", "preset": "...", "quality_level": "..."
    }
  ]
}

The preset_label and description fields are hardcoded from the catalog and will be added downstream — you only need to return the IDs and quality_level.`
}

// ═══════════════════════════════════════════════════════════════
// HERO ROTATION
// Some pieces are our strongest and should be guaranteed into the top
// slots on a schedule, rather than left entirely to GPT's photo-aware
// picks (which already tend to include them, but not deterministically).
//
// PRIMARY (slot 1, every call) — impressionist every other call; the
// off-positions cycle walnut → charcoal → bronze → pencil_sketch.
// SECONDARY (every 8th call) — also force one of iron → sheet_music →
// alabaster → walnut into a top slot, advancing once per full cycle.
//
// To retune: edit these two arrays. "paper sketch" is mapped to
// pencil_sketch; swap to 'torn_paper' here if that's what was meant.
// ═══════════════════════════════════════════════════════════════
const HERO_PRIMARY: PortraitsPresetId[] = [
  'impressionist', 'walnut',
  'impressionist', 'charcoal_chalk',
  'impressionist', 'bronze',
  'impressionist', 'pencil_sketch',
]
const HERO_SECONDARY: PortraitsPresetId[] = ['iron', 'sheet_music', 'alabaster', 'walnut']

// Best-effort counter for when the client doesn't pass rotationIndex.
let moduleRotationCounter = 0

function seriesOf(preset: PortraitsPresetId): PortraitsStyleId {
  return ENTRY_BY_PRESET[preset]?.series ?? 'artists_gallery'
}

function makeRec(preset: PortraitsPresetId, quality: QualityLevel, id: string): EffectRecommendation {
  const entry = ENTRY_BY_PRESET[preset]
  return {
    id,
    series:        seriesOf(preset),
    preset,
    preset_label:  entry.label,
    description:   entry.description,
    quality_level: quality,
  }
}

// Force the scheduled hero(es) into the leading slots, then fill the rest
// from GPT's picks (deduped, order preserved), then from a crowd-pleaser
// pad if still short. Always returns exactly 5.
function applyHeroRotation(
  gptRecs: EffectRecommendation[],
  counter: number,
): EffectRecommendation[] {
  const c = ((counter % 8) + 8) % 8
  const forced: PortraitsPresetId[] = [HERO_PRIMARY[c]]
  if (c === 7) {
    const cycle = Math.floor(counter / 8)
    forced.push(HERO_SECONDARY[((cycle % 4) + 4) % 4])
  }

  const qualityFor = (preset: PortraitsPresetId): QualityLevel =>
    gptRecs.find(r => r.preset === preset)?.quality_level ?? 'Good'

  const out: EffectRecommendation[] = []
  const used = new Set<PortraitsPresetId>()
  for (const preset of forced) {
    if (used.has(preset) || !ENTRY_BY_PRESET[preset]) continue
    out.push(makeRec(preset, qualityFor(preset), `rec_${out.length + 1}`))
    used.add(preset)
  }
  for (const r of gptRecs) {
    if (out.length === 5) break
    if (used.has(r.preset)) continue
    out.push({ ...r, id: `rec_${out.length + 1}` })
    used.add(r.preset)
  }
  // Pad from strong crowd-pleasers if GPT under-delivered.
  const PAD: PortraitsPresetId[] = ['impressionist', 'bronze', 'walnut', 'folded_book', 'iron', 'alabaster']
  for (const preset of PAD) {
    if (out.length === 5) break
    if (used.has(preset) || !ENTRY_BY_PRESET[preset]) continue
    out.push(makeRec(preset, 'Good', `rec_${out.length + 1}`))
    used.add(preset)
  }
  return out.slice(0, 5)
}

export async function curateEffects(input: CurateEffectsInput): Promise<CurateEffectsResult> {
  const t0 = Date.now()
  const openai = new OpenAI({ apiKey: input.openaiApiKey, timeout: 25_000, maxRetries: 1 })

  const promptText = buildCuratorPrompt()
  const counter = typeof input.rotationIndex === 'number'
    ? input.rotationIndex
    : moduleRotationCounter++

  console.log(`[portraits/curate-effects] start rotation=${counter}`)

  const response = await openai.chat.completions.create({
    model:           'gpt-4o',
    max_tokens:      900,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: {
            url:    `data:image/jpeg;base64,${input.sourceImageB64}`,
            detail: 'high',
        }},
        { type: 'text', text: promptText },
      ],
    }],
  })

  const raw = (response.choices[0]?.message?.content || '{}').trim()
  let parsed: any = {}
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn('[portraits/curate-effects] JSON parse failed — falling back to rotation slate')
  }

  const rawRecs: any[] = Array.isArray(parsed.recommendations) ? parsed.recommendations : []
  const VALID_QUALITY: QualityLevel[] = ['Excellent', 'Good', 'Limited']

  // Validate each rec against the catalog. Drop any that reference an
  // unknown series/preset. Hydrate description + label from the catalog.
  const recommendations: EffectRecommendation[] = rawRecs
    .slice(0, 5)
    .map((r, i): EffectRecommendation | null => {
      const seriesOk    = typeof r?.series === 'string' && VALID_SERIES.has(r.series)
      const presetOk    = typeof r?.preset === 'string' && VALID_PRESETS.has(r.preset)
      const quality     = typeof r?.quality_level === 'string' && (VALID_QUALITY as string[]).includes(r.quality_level)
                            ? (r.quality_level as QualityLevel) : 'Good'
      if (!seriesOk || !presetOk) return null
      const entry = ENTRY_BY_PRESET[r.preset]
      return {
        id:            `rec_${i + 1}`,
        series:        r.series as PortraitsStyleId,
        preset:        r.preset as PortraitsPresetId,
        preset_label:  entry.label,
        description:   entry.description,
        quality_level: quality,
      }
    })
    .filter((r): r is EffectRecommendation => r !== null)

  // Force scheduled heroes into the top slots; fill the rest from GPT's
  // photo-aware picks. Always returns exactly 5 — never empty, so the UI
  // never shows the "stumbled" state on a recoverable call.
  const finalRecs = applyHeroRotation(recommendations, counter)

  console.log(
    `[portraits/curate-effects] done in ${Date.now() - t0}ms — ` +
    `gpt=${recommendations.length} final=${finalRecs.length} ` +
    `forced=${finalRecs.slice(0, 2).map(r => r.preset).join(',')} ` +
    `quality=[${finalRecs.map(r => r.quality_level).join(',')}]`,
  )

  return { recommendations: finalRecs, durationMs: Date.now() - t0 }
}
