// lib/v1/generators/landscaping.ts
// Returns a landscaping text block based on style choice.
// Called by each lighting generator — independent of lighting mode.

export type LandscapingStyle = 'sparse' | 'moderate' | 'lush' | string

export function getLandscaping(style?: LandscapingStyle): string {
  const s = style || 'moderate'

  const density: Record<string, string> = {
    sparse: `
Landscaping is minimal — short grass, a few small shrubs close to the foundation.
Open ground visible across most of the base. Clean and uncluttered.
`.trim(),

    moderate: `
Landscaping is balanced — well-maintained grass, shrubs of varied height,
a small flower bed or two near the foundation, and a clear stone or brick path to the entrance.
Natural and professionally designed without being overgrown.
`.trim(),

    lush: `
Landscaping is full and abundant — dense ground cover, layered shrubs, flowering plants,
tall ornamental grasses, and rich garden beds hugging the foundation.
Abundant but not wild — feels like a well-loved garden at peak season.
`.trim(),
  }

  const base = density[s] || density['moderate']

  return `
LANDSCAPING:
${base}
Organic, asymmetrical layout — no patterns, no symmetry, no evenly spaced rows.
Natural clustering of plants with varied heights and density.
Soft transitions between lawn, beds, and hardscape.
Regionally appropriate plant species based on source location.
Preserve walkway placement from source image if present.
Trees frame the left, right, and rear of the base — tall enough to partially frame the roofline.
`.trim()
}
