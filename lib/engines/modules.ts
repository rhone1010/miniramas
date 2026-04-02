// lib/engines/modules.ts
// One assembler per engine.
// Takes: base prompt (from saved prompts) + blueprint + patch
// Returns: final prompt string ready for gpt-image-1
// Nothing is generated here — pure assembly.

import { formatAnchors, formatBlueprintContext } from './blueprints'

// ── Base prompts — loaded from saved prompts files ────────────────────────────
// These are the prompts that WORKED in ChatGPT. Do not modify them.

const BASE_PROMPTS: Record<string, string> = {

  architecture: `Transform the provided image into a highly detailed miniature architectural diorama.
CORE RULE:
This is a physical miniature model of a real structure, not a stylized illustration.
SUBJECT:
- Preserve the exact architectural identity of the house
- Maintain rooflines, window placement, porch structure, and proportions
- Do not redesign or simplify key architectural features
MATERIALS:
- painted wood siding with fine grain texture
- realistic shingles with subtle variation
- miniature glass windows with reflections
- detailed trim, railings, and columns
- landscaped base with grass, shrubs, flowers, and stone paths
- all materials should resemble handcrafted architectural scale models
ENVIRONMENT:
- place the house on a circular wooden diorama base
- include full yard layout: walkway, garden beds, small trees, ground cover
- maintain realistic spatial relationships from the original image
- do not invent major new structures
HONE SCALE RULES:
- entire scene exists within the round base
- include ~10–20% margin between base and image edge
- all elements must be fully 3D (no flat backgrounds)
- background environment should be softly blurred or removed
CAMERA:
- ~35–45 degree elevated angle looking down
- centered composition showing full structure and yard
- macro photography style
LIGHTING:
- warm, soft indoor lighting
- subtle shadows to enhance depth
- no dramatic or cinematic lighting
DEPTH OF FIELD:
- shallow depth of field to emphasize miniature scale
- foreground sharp, background softly blurred
STRICT CONSTRAINTS:
- no cartoon or stylized rendering
- no exaggerated proportions
- no missing architectural details
- no environment hallucination
ANCHORING RULE:
Use the uploaded image as the exact structural reference.
Do not reinterpret the building — only convert it into a physical miniature model.
If any detail is unclear, preserve the original structure rather than inventing new elements.`,

  people: `Transform the provided image into a realistic miniature figurine diorama of a single person.
CRITICAL — IDENTITY PRESERVATION:
- Preserve the exact facial features, proportions, and identity of the person
- Maintain their pose, posture, and body proportions
- Do not stylize into cartoon or exaggerated toy form
- The person must clearly look like the original individual
FIGURINE TRANSFORMATION:
- Convert the person into a high-quality physical miniature figurine
- Use realistic proportions (not chibi or caricature)
- Maintain clothing details, folds, and colors
- Ensure the figurine has subtle handcrafted realism, not plastic toy exaggeration
POSE & PRESENCE:
- The figure must be standing or grounded naturally (no floating)
- Maintain original stance and orientation
- Ensure weight and balance feel physically correct
BASE + ENVIRONMENT:
- Place the figurine on a visible physical display base (wood, terrain, or contextual surface)
- The base should reflect the original setting in simplified miniature form
- Include minimal but meaningful environmental context (ground, texture, small props if relevant)
- Ensure visible margins around the base
SIMPLIFICATION RULES:
- Remove unnecessary background clutter
- Keep only essential environmental cues
- Focus on the subject as the primary element
MATERIALS:
- Use realistic miniature materials (matte resin, subtle paint texture)
- Skin should have natural tone with slight material softness
- Clothing should show texture and small-scale detail
- Avoid glossy toy-like plastic unless explicitly intended
CAMERA:
- Slightly elevated angle (~30–40 degrees)
- Close framing on the figurine and base
- Macro depth of field
- Soft studio lighting
BACKGROUND:
- Neutral, minimal, or softly blurred studio background
- No flat artificial gradients that distract from the subject
COMPLETION:
- The figurine and base must feel like a finished physical collectible object
- No missing areas, no floating elements, no partial scene`,

  sports: `Transform the provided image into a sports memorabilia miniature diorama.
Subject transformation:
Preserve exact facial structure, proportions, and asymmetry from the original subjects with high fidelity.
Do not stylize or exaggerate features. Avoid chibi or cartoon proportions.
Material:
Render subjects as hand-painted miniature figures using matte-to-satin resin materials.
Apply subtle specular highlights only where natural (eyes, slight skin sheen).
Maintain skin texture and facial detail.
Scene transformation:
Place subjects into a live sports stadium environment as if physically present.
Reconstruct posture:
Complete partially visible bodies naturally while preserving pose and interaction.
Environment:
Include stadium seating, crowd depth, and layered background.
Subjects must remain the focal point.
Branding:
Use colors and implied team identity only — avoid direct logos or trademarks.
Integration:
Match lighting, perspective, and depth of field across subjects and environment.
Diorama:
Place entire scene on a physical base with 15–20% outer margins and ~10–15% internal spacing.
Camera:
35–45° downward angle, slightly pulled back for full scene context.
Quality:
Feels like a real memory turned into a high-fidelity miniature collectible.`,

  group: `Transform the provided image into a miniature figurine diorama.
Subject transformation:
Convert all people into collectible figurines while preserving identity and interaction.
Stylization:
- slight edge rounding
- minimal simplification
- no cartoon distortion
Material:
Satin-to-semi-gloss resin finish
- skin: soft sheen
- gear/props: slightly higher gloss
- maintain facial readability
Scene:
Place subjects into an activity-based environment matching the original setting.
Environment enhancement:
If original setting is weak, upgrade to immersive scene while maintaining realism and physical buildability.
Material conversion:
Everything must be 3D: structures, terrain, props, lighting elements.
Diorama:
- contained base
- 10–20% outer margins
- 10–15% internal spacing
Camera:
~40–50° downward, macro depth but subjects sharp.
Lighting:
Studio + optional colored accents where contextually appropriate.
Integration:
Subjects must feel grounded and interacting naturally.
Quality:
Dynamic, playful, premium collectible scene — not flat, not staged, not cartoon.`,

  dollhouse: `Transform the provided image into a miniature dollhouse cutaway scene.
Master constraints:
Scene must appear as a handcrafted miniature dollhouse interior on a visible base.
~10% margin around base.
Camera ~35–45° downward.
Scene transformation:
Convert interior into a cutaway dollhouse:
- 2–3 visible walls
- ceiling removed or partially open
- full layout preserved
Simplification:
- keep cabinets, sink, window, backsplash
- reduce clutter
- remove non-essential construction noise
Material conversion:
- cabinets → painted miniature wood
- sink → glossy ceramic miniature
- counters → resin/stone miniature
- tile → individually defined miniature tiles
- window → framed miniature opening
All elements must be 3D physical objects.
Lighting:
Soft studio lighting + internal cabinet glow
Background:
Neutral studio environment only (no real room continuation)
Quality:
Feels like a handcrafted dollhouse photographed on a table.`,

  landscape: `Transform the provided image into a physical terrain miniature diorama.
Core rule:
This is a handcrafted miniature terrain scene, not a painting or illustration.
Subject:
- Preserve the dominant terrain features and spatial composition
- Convert all natural elements into physical miniature equivalents
- Remove sky entirely — no flat backgrounds
Environment conversion:
- water → sculpted resin with realistic surface
- vegetation → miniature model foliage and trees
- terrain → textured sculpted base material
- structures → scaled miniature models
Diorama:
- place scene on a circular or oval base
- 10–20% margin around base
- all elements fully 3D and physically grounded
Camera:
- 35–45° elevated angle
- macro photography style
Lighting:
- natural directional light matching time of day
- soft shadows for depth
Strict constraints:
- no sky or flat horizon
- no floating elements
- no invented terrain not in source
- remove people entirely`,
}

// ── Assemble final prompt ─────────────────────────────────────────────────────

export function assemblePrompt(params: {
  engineId:   string
  blueprint:  Record<string, any>
  userPrompt?: string
  patchBlock?: string
}): string {
  const { engineId, blueprint, userPrompt, patchBlock } = params

  // Pick base prompt — group uses the group base
  const baseKey  = engineId === 'group' ? 'group' : engineId
  const base     = BASE_PROMPTS[baseKey] || BASE_PROMPTS.architecture

  const context  = formatBlueprintContext(blueprint, engineId)
  const anchors  = formatAnchors(blueprint)

  const parts: string[] = [base]

  if (context) parts.push(context)
  if (anchors) parts.push(anchors)

  if (userPrompt?.trim()) {
    parts.push(`USER INSTRUCTIONS — APPLY THESE:\n${userPrompt.trim()}`)
  }

  if (patchBlock?.trim()) {
    parts.push(`[PATCH — MUST APPLY]\n${patchBlock.trim()}`)
  }

  return parts.join('\n\n')
}

// ── Build patch block from scored failures ────────────────────────────────────

export interface ScoredFailure {
  type:     string
  severity: number  // 0–1
  fix:      string
}

export function buildPatchBlock(failures: ScoredFailure[]): string {
  if (!failures?.length) return ''
  return failures
    .filter(f => f.severity > 0.4)
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 5)
    .map(f => {
      if (f.severity > 0.75) return `CRITICAL: ${f.fix}`
      if (f.severity > 0.5)  return `Strongly apply: ${f.fix}`
      return `Apply: ${f.fix}`
    })
    .join('\n')
}
