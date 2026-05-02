// lib/v1/actionmini-shared.ts
// Bare-bones shared types for Action Minis. All scene/staging/lighting/camera/
// kinetic/composition guidance has been removed — nano banana handles the
// entire image based on the preset line alone.

// ── HERO + SECONDARIES (kept for analyzer typing only) ───────
export interface ActionMiniHero {
  pose?:        string
  expression?:  string
  age_range?:   string
  build?:       string
  hair?:        string
  skin?:        string
  apparel?:     string
  identity_features?: string[]
}

export interface SecondaryFigures {
  count:       number
  description: string
}

export interface SharedInput {
  sourceImageB64:        string
  kineticMedium?:        KineticMedium
  actionDescription?:    string
  hero?:                 ActionMiniHero | null
  secondaryFigures?:     SecondaryFigures
  environment?:          string
  displayName?:          string
  notes?:                string
}

// ── KINETIC MEDIUM (kept for analyzer + UI badge labelling only) ──
// No longer drives prompt construction — nano banana sees only the preset line.
export type KineticMedium =
  | 'whitewater' | 'surf' | 'snow' | 'skate' | 'bike'
  | 'climb' | 'run' | 'dance' | 'combat' | 'other'

// ── PROMPT ASSEMBLY ──────────────────────────────────────────
// Final prompt = preset line. Optional notes appended if present.
// That's it. No kinetic block. No medium effects. No composition. No camera.
export function assemblePrompt(input: {
  presetLine: string
  notes?:     string
}): string {
  if (input.notes?.trim()) {
    return `${input.presetLine}\n\n${input.notes.trim()}`
  }
  return input.presetLine
}
