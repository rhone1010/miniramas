// lib/structure/buildStructureLock.ts
// Converts AnchorBlueprint into hard constraint text blocks.
// Returned by /analyze and stored immutably on the client.
// NOTE: assemblePrompt also builds an anchor lock from the blueprint directly —
// this output is kept for backwards compat and debug visibility in the lab.

import { AnchorBlueprint } from './extractBlueprint'

export function buildStructureLock(bp: AnchorBlueprint): string {
  const lines: string[] = []

  lines.push(`STRUCTURAL LOCK — NON-NEGOTIABLE`)
  lines.push(``)
  lines.push(`The source image is the absolute structural reference.`)
  lines.push(`The following elements were detected and must be preserved exactly.`)
  lines.push(``)

  // High-importance anchors only (≥7.0) — these are hard constraints
  const locked = bp.anchors
    .filter(a => a.type === 'structure' && a.importance >= 7.0)
    .sort((a, b) => b.importance - a.importance)

  if (locked.length > 0) {
    lines.push(`REQUIRED ELEMENTS (importance ≥ 7.0):`)
    for (const anchor of locked) {
      lines.push(`- [${anchor.importance.toFixed(1)}] ${anchor.description}`)
    }
    lines.push(``)
  }

  // Lower importance anchors for context
  const supporting = bp.anchors
    .filter(a => a.type === 'structure' && a.importance < 7.0)
    .sort((a, b) => b.importance - a.importance)

  if (supporting.length > 0) {
    lines.push(`SUPPORTING ELEMENTS:`)
    for (const anchor of supporting) {
      lines.push(`- [${anchor.importance.toFixed(1)}] ${anchor.description}`)
    }
    lines.push(``)
  }

  lines.push(`DO NOT:`)
  lines.push(`- Generate a generic or idealized version of this structure`)
  lines.push(`- Simplify or remove any element listed above`)
  lines.push(`- Change the orientation of any element relative to the image frame`)
  lines.push(`- Substitute familiar architectural templates`)
  lines.push(``)
  lines.push(`If structural conflict occurs → preserve source structure over aesthetics.`)

  return lines.join('\n')
}

export function buildAntiDrift(): string {
  return `ANTI-DRIFT RULES:

Do NOT generate a generic or idealized version of this structure.
Do NOT invent symmetry that does not exist in the source.
Do NOT simplify asymmetric or complex elements for visual cleanliness.
Do NOT prioritize aesthetics over structural accuracy.
Do NOT substitute familiar style templates (Victorian, Craftsman, Colonial, etc.).

The source image is ground truth. Match it exactly.`
}
