// lib/structure/buildPatch.ts
// UPDATE: Generic dimension-based patches.
// No object-specific instructions — patterns only.
// Severity-scaled. Dimension priority: geometry > completion > materials > lighting > color.

import { AnchorBlueprint }  from './extractBlueprint'
import { AnchorScorecard }  from './scoreImage'

// ── DIMENSION PATCH GENERATORS ────────────────────────────────────────────────

function patchGeometry(description: string, severity: number): string {
  const desc = description.toLowerCase()
  const strength = severity >= 0.8 ? 'completely' : severity >= 0.5 ? 'clearly' : 'more'

  // Projection integrity
  if (desc.includes('project') || desc.includes('forward') || desc.includes('protrude')) {
    return `Restore depth and separation of all architectural projections relative to the main facade plane. ` +
      `Each projecting volume must be ${strength} distinct — visibly in front of the wall surface behind it. ` +
      `The depth gap between projection face and recessed wall must be physically readable. ` +
      `Roof sections over projections must step forward with the volume, not remain flush.`
  }

  // Facade depth / planes
  if (desc.includes('facade') || desc.includes('plane') || desc.includes('depth layer')) {
    return `Restore all facade depth layers. Each wall plane must exist at a distinct depth. ` +
      `Do not collapse multiple depth layers into a single flat surface. ` +
      `The structural silhouette must match the source complexity.`
  }

  // Porch wrap
  if (desc.includes('porch') && (desc.includes('wrap') || desc.includes('side run'))) {
    return `Restore the full porch geometry. The porch must wrap completely around its detected corner — ` +
      `the side run must extend ${strength} along the side wall, parallel to the building, ` +
      `with visible columns and roofing along the full side run length.`
  }

  // Porch general
  if (desc.includes('porch')) {
    return `Restore the full porch structure. A covered porch with visible columns must span ` +
      `the front face of the building, set clearly forward of the main facade plane.`
  }

  // Window rhythm
  if (desc.includes('window') || desc.includes('rhythm')) {
    return `Restore window rhythm and alignment. Window positions, spacing, and sizing must match the source. ` +
      `Do not redistribute windows for visual symmetry. Preserve exact floor-by-floor alignment.`
  }

  // Roof
  if (desc.includes('roof') || desc.includes('ridge')) {
    return `Restore roof geometry. The ridge orientation and height asymmetry must match the source exactly. ` +
      `Do not normalize or center the roof. All roof planes must remain separately defined.`
  }

  // Side extension / mass
  if (desc.includes('extension') || desc.includes('side volume') || desc.includes('secondary')) {
    return `Restore all secondary building volumes. Each side extension must be ${strength} visible ` +
      `with its own wall plane, depth, and roofline. Do not merge secondary volumes into the main mass.`
  }

  // Generic geometry
  return `Restore structural geometry. Preserve all detected depth relationships, projections, ` +
    `and facade planes. Do not simplify or flatten any part of the structure.`
}

function patchCompletion(description: string, severity: number): string {
  return `Ensure physical completion of all scene regions. ` +
    `Every visible area must be filled with physically constructed miniature material. ` +
    `No empty areas, flat backgrounds, or unfinished sections are allowed. ` +
    (severity >= 0.7 ? `This is a critical completion failure — all regions must be addressed. ` : '') +
    `The base must be fully covered with terrain. The building must have no missing surfaces.`
}

function patchMaterials(description: string, severity: number): string {
  return `Increase material realism throughout. All surfaces must read as physical miniature materials. ` +
    `Introduce subtle surface texture and handcrafted imperfections. ` +
    `Building surfaces: painted resin with fine detail. ` +
    `Roof: realistic tile or shingle texture. ` +
    `Base: dark walnut wood with beveled edge. ` +
    (severity >= 0.7 ? `Eliminate any plastic-like or overly smooth surfaces. ` : '') +
    `No photographic textures from the source image.`
}

function patchLighting(description: string, severity: number): string {
  return `Improve lighting depth and directionality. ` +
    `Use a single soft key light from one side — not centered, not flat. ` +
    `Increase shadow definition to reinforce depth and volume. ` +
    `Add gentle edge highlights on raised surfaces and roof edges. ` +
    (severity >= 0.7 ? `Eliminate flat lighting entirely. ` : '') +
    `Maintain warm ambient temperature throughout.`
}

function patchColor(description: string, severity: number): string {
  return `Restore natural color palette. ` +
    `Reduce artificial saturation and return to original color relationships from source. ` +
    `Maintain warm, natural tones. ` +
    (severity >= 0.7 ? `Correct any palette drift from source colors. ` : '') +
    `No stylized or oversaturated color grading.`
}

function patchBase(description: string, severity: number): string {
  return `Restore physical base presentation. ` +
    `Replace any loose ground or undefined surface with a solid dark walnut wood plinth. ` +
    `The base edge must be clearly defined with visible beveling. ` +
    `A clear margin must exist between the base edge and the image frame on all sides. ` +
    (severity >= 0.7 ? `The base must be fully visible including bottom edge. ` : '') +
    `Ground surface must be covered with static grass or terrain material.`
}

// ── PATCH ROUTER ─────────────────────────────────────────────────────────────
// Routes by failure type category, not by specific object.

function routePatch(failureType: string, description: string, severity: number): string | null {
  const t = failureType.toLowerCase()

  // Geometry dimension
  if (t.includes('projection_integrity') || t.includes('projection_definition'))
    return patchGeometry('projection forward', severity)
  if (t.includes('facade_rhythm') || t.includes('facade_depth') || t.includes('structural_simplification'))
    return patchGeometry('facade plane depth', severity)
  if (t.includes('window_rhythm') || t.includes('window'))
    return patchGeometry('window rhythm', severity)
  if (t.includes('porch'))
    return patchGeometry(description, severity)
  if (t.includes('roof'))
    return patchGeometry('roof', severity)
  if (t.includes('extension') || t.includes('side_volume'))
    return patchGeometry('extension side volume', severity)

  // Completion dimension
  if (t.includes('scene_completion') || t.includes('completion'))
    return patchCompletion(description, severity)

  // Base physicality
  if (t.includes('base_physicality') || t.includes('base'))
    return patchBase(description, severity)

  // Materials dimension
  if (t.includes('material_unrealism') || t.includes('material'))
    return patchMaterials(description, severity)

  // Lighting dimension
  if (t.includes('lighting_flatness') || t.includes('lighting'))
    return patchLighting(description, severity)

  // Color dimension
  if (t.includes('color_shift') || t.includes('color'))
    return patchColor(description, severity)

  // Anchor-based fallback — use description to route
  return patchGeometry(description, severity)
}

// ── MAIN EXPORTS ──────────────────────────────────────────────────────────────

export function buildPatch(
  scorecard: AnchorScorecard,
  blueprint: AnchorBlueprint
): string[] {
  const patches: string[] = []
  const seen = new Set<string>()

  // Priority order: geometry > completion > materials > lighting > color
  const priorityOrder = [
    'geometry', 'projection', 'facade', 'structural', 'porch', 'roof', 'window', 'extension',
    'completion', 'scene_completion',
    'base',
    'material',
    'lighting',
    'color',
  ]

  // Sort failures by dimension priority then severity
  const sorted = [...(scorecard.failed_anchors || [])]
    .filter(a => a.importance >= 5.0)
    .sort((a, b) => {
      const aPriority = priorityOrder.findIndex(p => a.type?.toLowerCase().includes(p) || a.id?.toLowerCase().includes(p))
      const bPriority = priorityOrder.findIndex(p => b.type?.toLowerCase().includes(p) || b.id?.toLowerCase().includes(p))
      const ap = aPriority === -1 ? 99 : aPriority
      const bp = bPriority === -1 ? 99 : bPriority
      if (ap !== bp) return ap - bp
      return b.importance - a.importance
    })

  for (const failed of sorted) {
    const anchor = blueprint.anchors.find(a => a.id === failed.id)
    if (!anchor) continue

    const anchorScore = (scorecard as any).anchor_scores?.find((s: any) => s.anchor_id === failed.id)
    const scoreNote   = anchorScore?.notes || ''

    // Determine failure type — use anchor id as type if no explicit type
    const failureType = failed.type || anchor.id

    // Deduplicate by dimension
    const dimensionKey = failureType.split('_')[0]
    if (seen.has(dimensionKey)) continue
    seen.add(dimensionKey)

    const patch = routePatch(failureType, anchor.description, failed.importance / 10)
    if (patch) patches.push(patch)
  }

  // Scorecard-level quality patches
  if ((scorecard.diorama_quality?.base || 0) < 3 && !seen.has('base')) {
    patches.push(patchBase('base physicality', 0.7))
  }
  if ((scorecard.diorama_quality?.three_d || 0) < 3 && !seen.has('completion')) {
    patches.push(patchCompletion('scene completion', 0.7))
  }
  if ((scorecard.diorama_quality?.materials || 0) < 3 && !seen.has('material')) {
    patches.push(patchMaterials('material realism', 0.6))
  }
  if ((scorecard.composition?.framing || 0) < 3) {
    patches.push(
      'Pull camera back until the entire base — including bottom edge — is fully visible ' +
      'with at least 15% clear margin on all sides.'
    )
  }

  return patches
}

export function formatPatchBlock(patches: string[]): string {
  if (patches.length === 0) return ''

  return `CORRECTIONS REQUIRED — APPLY ALL:

${patches.map((p, i) => `${i + 1}. ${p}`).join('\n\n')}

Apply every correction above. Partial compliance is not acceptable.
Do not change anything that is already correct.`
}
