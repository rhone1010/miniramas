// lib/prompts/validateConfig.ts

// ─── PLAQUE CONFIG ────────────────────────────────────────────────────────────

export interface PlaqueConfig {
  mode: 'user' | 'ai'
  tone?: 'appropriate' | 'funny' | 'witty' | 'sarcastic'
  text?: string
}

export function validatePlaque(plaque?: Partial<PlaqueConfig>): PlaqueConfig {
  if (!plaque) return { mode: 'ai', tone: 'appropriate' }
  const mode = plaque.mode === 'user' ? 'user' : 'ai'
  const validTones = ['appropriate', 'funny', 'witty', 'sarcastic'] as const
  const tone = validTones.includes(plaque.tone as any)
    ? (plaque.tone as PlaqueConfig['tone'])
    : 'appropriate'
  return {
    mode,
    tone,
    ...(mode === 'user' && plaque.text ? { text: plaque.text.slice(0, 80) } : {}),
  }
}

// ─── BASE THEME CONFIG ────────────────────────────────────────────────────────
// Controls how much storytelling/scene context appears on the base floor.

export type BaseTheme =
  | 'match_environment'    // Default: source floor texture, clean + polished
  | 'enhanced_environment' // Source floor + subtle enhancement + possible toy placement
  | 'play_scene'           // Source floor + intentional props telling a story
  | 'memory_scene'         // Curated, slightly staged memory composition
  | 'minimal_premium'      // Clean base, no clutter, plaque focus

export function validateBaseTheme(theme?: string): BaseTheme {
  const valid: BaseTheme[] = [
    'match_environment',
    'enhanced_environment',
    'play_scene',
    'memory_scene',
    'minimal_premium',
  ]
  return valid.includes(theme as BaseTheme) ? (theme as BaseTheme) : 'match_environment'
}

// ─── MINIRAMA CONFIG ──────────────────────────────────────────────────────────

export interface MiniramaConfig {
  subject: {
    type: 'single_person' | 'couple' | 'family' | 'object' | 'architecture' | 'landscape'
    preserve_identity?: boolean
    pose_preservation?: boolean
  }
  scene: {
    type: 'stadium' | 'beach' | 'forest' | 'home_interior' | 'urban' | 'custom'
    reconstruct_environment?: boolean
  }
  style: {
    base_style: 'circular_wood_plinth' | 'oval_display_base' | 'square_diorama' | 'snowglobe' | 'open_diorama'
    base_theme?: BaseTheme
    material_style: 'painted_resin' | 'semi_gloss_collectible' | 'matte_resin' | 'ceramic_like'
    lighting_style: 'warm_studio' | 'golden_hour' | 'soft_indoor' | 'neutral_studio'
    background_style?: 'blurred_home' | 'neutral_gradient' | 'tabletop_scene'
  }
  composition: {
    camera_angle?: number
    margin_ratio?: number
    depth_of_field?: 'shallow' | 'medium'
  }
  detail: {
    level?: 'balanced' | 'high' | 'ultra'
  }
  plaque?: PlaqueConfig
  prompt_tuning?: Record<string, boolean | number>
  optimizer?: {
    enabled?: boolean
    max_iterations?: number
    target_score?: number
    retry_on_fail?: boolean
  }
}

export function validateConfig(config: Partial<MiniramaConfig>): MiniramaConfig {
  const next = JSON.parse(JSON.stringify(config)) as MiniramaConfig

  next.composition = next.composition || {}
  next.style = next.style || {} as MiniramaConfig['style']
  next.subject = next.subject || {} as MiniramaConfig['subject']
  next.scene = next.scene || {} as MiniramaConfig['scene']
  next.detail = next.detail || {}

  // Camera angle: 25–45 degrees, default 35
  if (
    typeof next.composition.camera_angle !== 'number' ||
    next.composition.camera_angle < 25 ||
    next.composition.camera_angle > 45
  ) {
    next.composition.camera_angle = 35
  }

  // Margin ratio: 0.10–0.25, default 0.18 (slightly more breathing room)
  if (
    typeof next.composition.margin_ratio !== 'number' ||
    next.composition.margin_ratio < 0.10 ||
    next.composition.margin_ratio > 0.25
  ) {
    next.composition.margin_ratio = 0.18
  }

  // Depth of field
  if (!['shallow', 'medium'].includes(next.composition.depth_of_field || '')) {
    next.composition.depth_of_field = 'shallow'
  }

  // Background style
  if (!next.style.background_style) {
    next.style.background_style = 'blurred_home'
  }

  // Base theme — default to match_environment
  next.style.base_theme = validateBaseTheme(next.style.base_theme)

  // Detail level
  if (!next.detail.level) {
    next.detail.level = 'balanced'
  }

  // Identity defaults
  if (next.subject.preserve_identity !== false) next.subject.preserve_identity = true
  if (next.subject.pose_preservation !== false) next.subject.pose_preservation = true

  // Scene reconstruct default
  if (next.scene.reconstruct_environment !== false) next.scene.reconstruct_environment = true

  // Plaque config
  next.plaque = validatePlaque(next.plaque)

  return next
}

// ─── STYLE MAPPERS ────────────────────────────────────────────────────────────

export function styleToSubjectType(style: string): MiniramaConfig['subject']['type'] {
  const map: Record<string, MiniramaConfig['subject']['type']> = {
    'people':           'single_person',
    'people_diorama':   'family',
    'people_miniature': 'single_person',
    'couple':           'couple',
    'family':           'family',
    'architecture':     'architecture',
    'landscape':        'landscape',
    'dollhouse':        'object',
    'sports':           'single_person',
  }
  return map[style] || 'landscape'
}

export function styleToSceneType(style: string): MiniramaConfig['scene']['type'] {
  const map: Record<string, MiniramaConfig['scene']['type']> = {
    'people':           'custom',
    'people_diorama':   'custom',
    'people_miniature': 'custom',
    'couple':           'custom',
    'family':           'custom',
    'architecture':     'home_interior',
    'landscape':        'custom',
    'dollhouse':        'home_interior',
    'sports':           'stadium',
  }
  return map[style] || 'custom'
}