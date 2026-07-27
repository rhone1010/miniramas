// houses-effect-curator.ts
// lib/v1/houses-effect-curator.ts
//
// THE CURATOR'S BRAIN — Houses silo. Mirrors portraits-effect-curator.ts.
// GPT-4o reads the source photograph and returns 5 treatment
// recommendations from the full catalog, each with a quality_level
// assessment specific to this photo.
//
// quality_level is driven by each treatment's detail_dependency
// cross-referenced against what the photo shows: a Pen & Ink treatment
// needs crisp visible architectural detail ('high'); a Snow Globe is
// forgiving ('low'). The Curator advises — it never blocks.

import OpenAI from 'openai'
import type { PresetId, Mode } from './houses-shared'

export type QualityLevel = 'Excellent' | 'Good' | 'Limited'

export interface HousesEffectRecommendation {
  preset_id:     PresetId
  collection:    Mode
  label:         string
  description:   string
  quality_level: QualityLevel
}

interface CatalogEntry {
  collection:        Mode
  label:             string
  detail_dependency: 'high' | 'medium' | 'low'
  description:       string
}

// One-sentence, plain-language style descriptions — shown verbatim on
// the effect cards. Hardcoded, not GPT-written (Portraits V2 decision).
export const HOUSES_EFFECT_CATALOG: Record<string, CatalogEntry> = {
  // ── Materials (8) ──
  bronze:               { collection: 'materials',   label: 'Bronze',            detail_dependency: 'medium', description: 'Cast in patinated bronze with sculpted grounds and gallery light.' },
  walnut:               { collection: 'materials',   label: 'Walnut',            detail_dependency: 'medium', description: 'Turned from dark walnut, the grain flowing across every wall and roof.' },
  alabaster:            { collection: 'materials',   label: 'Alabaster',         detail_dependency: 'medium', description: 'Carved in translucent alabaster that glows softly from within.' },
  glass:                { collection: 'materials',   label: 'Glass',             detail_dependency: 'medium', description: 'Hand-blown glass, luminous and delicate on its stand.' },
  carved_wood:          { collection: 'materials',   label: 'Carved Wood',       detail_dependency: 'medium', description: 'Carved from a single block of wood, the grain showing through.' },
  carved_stone:         { collection: 'materials',   label: 'Carved Stone',      detail_dependency: 'medium', description: 'Cut in stone with honest tool marks and quiet weight.' },
  wax:                  { collection: 'materials',   label: 'Wax',               detail_dependency: 'low',    description: 'A warm wax miniature, soft-edged, as if by candlelight.' },
  iron:                 { collection: 'materials',   label: 'Iron',              detail_dependency: 'medium', description: 'Cast in blackened iron, weighty, exact, and architectural.' },
  // ── Curiosities (10) ──
  dollhouse:            { collection: 'curiosities', label: 'Dollhouse',         detail_dependency: 'medium', description: 'An open-back dollhouse with furnished, lit rooms.' },
  amber_inclusion:      { collection: 'curiosities', label: 'Amber Inclusion',   detail_dependency: 'medium', description: 'Your home suspended in a drop of golden amber, warm and eternal.' },
  enchanted_crystal:    { collection: 'curiosities', label: 'Enchanted Crystal', detail_dependency: 'medium', description: 'Grown as a faceted crystal, light caught in every plane.' },
  ukiyo_e:              { collection: 'curiosities', label: 'Ukiyo-e',           detail_dependency: 'low',    description: 'A Japanese woodblock print — flat color, bold line, drifting cloud.' },
  art_nouveau:          { collection: 'curiosities', label: 'Art Nouveau',       detail_dependency: 'low',    description: 'Flowing iron vines and stained-glass light in the Art Nouveau style.' },
  cubism:               { collection: 'curiosities', label: 'Cubism',            detail_dependency: 'low',    description: 'Fractured into cubist planes, the house seen from every angle at once.' },
  daguerreotype:        { collection: 'curiosities', label: 'Daguerreotype',     detail_dependency: 'medium', description: 'An early silvered daguerreotype, ghostly and precise on polished metal.' },
  art_deco:             { collection: 'curiosities', label: 'Art Deco',          detail_dependency: 'low',    description: 'Gilded Art Deco geometry — symmetry, chrome, and polished stone.' },
  gingerbread:          { collection: 'curiosities', label: 'Gingerbread',       detail_dependency: 'low',    description: 'A gingerbread house, iced, trimmed, and entirely charming.' },
  snow_globe:           { collection: 'curiosities', label: 'Snow Globe',        detail_dependency: 'low',    description: 'Your home inside a glass snow globe, lit warmly from within.' },
  // ── Seasons (4) ──
  spring:               { collection: 'seasons',     label: 'Spring',            detail_dependency: 'low',    description: 'Your home in full spring — blossom, fresh green, soft light.' },
  summer:               { collection: 'seasons',     label: 'Summer',            detail_dependency: 'low',    description: 'High summer — deep greens, long light, full leaf.' },
  fall:                 { collection: 'seasons',     label: 'Fall',              detail_dependency: 'low',    description: 'Autumn color around the house, leaves on the ground.' },
  winter:               { collection: 'seasons',     label: 'Winter',            detail_dependency: 'low',    description: 'Snow on the roof, warm windows, winter stillness.' },
  // ── Events (5) ──
  haunted:              { collection: 'events',      label: 'Haunted',           detail_dependency: 'low',    description: 'The haunted version — moonlit, overgrown, alive at the windows.' },
  fire:                 { collection: 'events',      label: 'Fire',              detail_dependency: 'low',    description: 'Caught dramatically ablaze, embers in the dark.' },
  alien:                { collection: 'events',      label: 'Alien',             detail_dependency: 'low',    description: 'A visitation overhead, the house lit from above.' },
  explosion:            { collection: 'events',      label: 'Explosion',         detail_dependency: 'low',    description: 'The cinematic moment of the blast, frozen mid-air.' },
  abandoned:            { collection: 'events',      label: 'Abandoned',         detail_dependency: 'medium', description: 'Decades abandoned — peeling, overgrown, beautiful decay.' },
  // ── Artists (4) — engine ids stay long (impressionist_oil / watercolor_study) ──
  impressionist_oil:    { collection: 'artists',     label: 'Impressionist',     detail_dependency: 'medium', description: 'The house formed from thick sculpted oil paint, knife-built and confident.' },
  watercolor_study:     { collection: 'artists',     label: 'Watercolor',        detail_dependency: 'medium', description: 'A dimensional watercolor rising from the painted sheet.' },
  charcoal_chalk:       { collection: 'artists',     label: 'Charcoal & Chalk',  detail_dependency: 'high',   description: 'Charcoal blacks and chalk highlights on the drafting sheet.' },
  pen_ink:              { collection: 'artists',     label: 'Pen & Ink',         detail_dependency: 'high',   description: 'The architect\u2019s ink rendering, crosshatched and precise.' },
}

const CURATOR_SYSTEM_PROMPT = `You are the Curator at Liten & Co, a studio that crafts photographs of homes into museum-quality artwork. You are looking at a customer's photograph of a building.

From the catalog below, choose exactly 5 treatments that would produce the most striking results FOR THIS SPECIFIC BUILDING — its architectural style, detail level, setting, and the photo's quality.

Selection rules:
- Exactly 5 picks, all different
- Spread across at least 3 different collections
- No more than 2 from any single collection
- Favor treatments whose character suits the building (ornate detail rewards high-detail treatments; simple forms suit forgiving ones)

For each pick, assess quality_level — how well THIS photo supports THAT treatment:
- "Excellent" — the photo gives this treatment everything it needs
- "Good" — solid result expected, minor compromises
- "Limited" — workable, but this treatment wants more detail or a clearer view than this photo provides

A treatment with detail_dependency "high" needs sharp, unobstructed architectural detail to earn "Excellent". Treatments with "low" dependency are rarely below "Good".

CATALOG (preset_id · collection · detail_dependency · description):
${Object.entries(HOUSES_EFFECT_CATALOG)
  .map(([id, e]) => `${id} · ${e.collection} · ${e.detail_dependency} · ${e.description}`)
  .join('\n')}

Respond with ONLY a JSON object:
{ "picks": [ { "preset_id": "<id from catalog>", "quality_level": "Excellent|Good|Limited" }, ... 5 total ] }

No preamble, no markdown fences.`

export async function curateHousesEffects(input: {
  sourceImageB64:   string
  additionalCount?: number
  openaiApiKey:     string
}): Promise<HousesEffectRecommendation[]> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey, timeout: 25_000, maxRetries: 1 })

  const contextNote = input.additionalCount
    ? `The customer also provided ${input.additionalCount} additional angle photo(s).`
    : 'This is the only photo provided.'

  const response = await openai.chat.completions.create({
    model:      'gpt-4o',
    max_tokens: 400,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: CURATOR_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.sourceImageB64}`, detail: 'low' } },
          { type: 'text', text: `Choose 5 treatments for this building. ${contextNote}` },
        ],
      },
    ],
  })

  const content = (response.choices[0]?.message?.content || '{}').trim()
  let picks: Array<{ preset_id: string; quality_level: string }> = []
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed.picks)) picks = parsed.picks
  } catch {
    // fall through to fallback below
  }

  const recs: HousesEffectRecommendation[] = []
  for (const p of picks) {
    const entry = HOUSES_EFFECT_CATALOG[p.preset_id]
    if (!entry) continue
    const q: QualityLevel =
      p.quality_level === 'Excellent' || p.quality_level === 'Limited' ? p.quality_level : 'Good'
    recs.push({
      preset_id:     p.preset_id as PresetId,
      collection:    entry.collection,
      label:         entry.label,
      description:   entry.description,
      quality_level: q,
    })
    if (recs.length === 5) break
  }

  // Fallback — if GPT-4o failed or under-delivered, fill from a safe
  // crowd-pleaser slate so the Curator never returns empty-handed.
  const FALLBACK: string[] = ['bronze', 'snow_globe', 'impressionist_oil', 'fall', 'gingerbread']
  for (const id of FALLBACK) {
    if (recs.length === 5) break
    if (recs.some(r => r.preset_id === id)) continue
    const entry = HOUSES_EFFECT_CATALOG[id]
    recs.push({
      preset_id:     id as PresetId,
      collection:    entry.collection,
      label:         entry.label,
      description:   entry.description,
      quality_level: 'Good',
    })
  }

  return recs
}
