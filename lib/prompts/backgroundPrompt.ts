// lib/prompts/backgroundPrompt.ts
// Destination: lib/prompts/backgroundPrompt.ts
//
// Generates the gpt-image-1 prompt for the premium product photography
// background. Called once per final pass — the background is generated
// independently, then the diorama is composited on top via Sharp.
//
// The background must:
//   - have an empty central presentation area
//   - be clearly a real interior environment, not a studio sweep
//   - have a polished tabletop surface in the lower portion of the frame
//   - feel warm, upscale, and calm

import { ContextSetting } from '@/lib/structure/assemblePrompt'

// ── PER-CONTEXT DESCRIPTORS ───────────────────────────────────────────────────

const CONTEXT_DESCRIPTORS: Record<ContextSetting, {
  room:    string
  table:   string
  light:   string
  accents: string
}> = {
  living_room: {
    room:    'elegant living room with warm neutral walls, soft furnishings slightly visible at edges, upholstered sofa blurred in background',
    table:   'polished dark walnut side table or console, subtle wood grain visible, semi-gloss finish with mild soft reflections',
    light:   'warm ambient lamp glow from sides, soft diffused window light from upper left, gentle warm-toned fill',
    accents: 'soft blurred cushions and warm decor at extreme edges, no strong patterns or clutter near centre',
  },
  studio_neutral: {
    room:    'clean minimal studio environment, seamless light warm-grey backdrop, no furniture visible behind the surface',
    table:   'smooth lacquered light surface, barely-there sheen, very subtle grain, clean and architectural',
    light:   'even soft diffused overhead lighting, very gentle fill from both sides, no strong directional shadows',
    accents: 'no decor elements — pure negative space, slight vignette at corners only',
  },
  library_desk: {
    room:    'warm study or library, blurred bookshelves with warm spines visible at edges, dark wood panelling suggested in background',
    table:   'rich dark mahogany or oak desk surface, visible grain, warm gloss with soft reflections',
    light:   'warm focused desk lamp glow from upper right, soft fill from left, amber-warm colour temperature throughout',
    accents: 'blurred book spines and a soft lamp base at edge, small framed objects suggested but never sharp',
  },
  soft_interior: {
    room:    'soft home interior, warm plaster walls with gentle natural light, minimal and calm, feels like a weekend morning',
    table:   'light natural wood surface — pale ash or maple tone, fine grain visible, matte-to-satin finish',
    light:   'diffused natural window light from one side, very soft fill, cool-to-warm balanced temperature',
    accents: 'a single soft plant or object extremely blurred at far edge, otherwise open and quiet',
  },
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export function buildBackgroundPrompt(context: ContextSetting = 'living_room'): string {
  const d = CONTEXT_DESCRIPTORS[context]

  return `Create a softly blurred premium interior product-photography environment.

ROOM ENVIRONMENT:
${d.room}

SURFACE:
${d.table}
The surface occupies the lower 30–35% of the frame.
The transition from wall/background to surface is soft and natural — no hard horizon line.

LIGHTING:
${d.light}
No harsh reflections. No strong patterns. Lighting should feel calm and warm.

COMPOSITION:
- The centre of the frame is completely empty — reserved for compositing a medium-sized display object
- The empty area spans at least 50% of the frame width and is unobstructed
- No objects, furniture edges, or decor cross the central foreground area
- Negative space in centre must be clean and uncluttered
- The surface extends generously beyond where the object will sit — visible on all sides

ACCENTS:
${d.accents}

TECHNICAL:
- Gentle depth of field — background elements are softly blurred, surface is relatively sharp
- No sharp background details
- No obvious furniture edges crossing the centre
- The overall feel is upscale, calm, and warmly lit
- This image will have a product placed on the surface in post — do NOT add any object or placeholder

OUTPUT: photorealistic interior photograph, product photography style, no text, no overlays`
}
