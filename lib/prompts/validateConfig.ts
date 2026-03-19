// lib/prompts/validateConfig.ts

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

  // Ensure all top-level keys exist
  next.composition = next.composition || {}
  next.style = next.style || {} as MiniramaConfig['style']
  next.subject = next.subject || {} as MiniramaConfig['subject']
  next.scene = next.scene || {} as MiniramaConfig['scene']
  next.detail = next.detail || {}

  // Camera angle: 25–40 degrees, default 30
  if (
    typeof next.composition.camera_angle !== 'number' ||
    next.composition.camera_angle < 25 ||
    next.composition.camera_angle > 45
  ) {
    next.composition.camera_angle = 35
  }

  // Margin ratio: 0.10–0.25, default 0.15
  if (
    typeof next.composition.margin_ratio !== 'number' ||
    next.composition.margin_ratio < 0.10 ||
    next.composition.margin_ratio > 0.25
  ) {
    next.composition.margin_ratio = 0.15
  }

  // Depth of field
  if (!['shallow', 'medium'].includes(next.composition.depth_of_field || '')) {
    next.composition.depth_of_field = 'shallow'
  }

  // Background style
  if (!next.style.background_style) {
    next.style.background_style = 'blurred_home'
  }

  // Detail level
  if (!next.detail.level) {
    next.detail.level = 'high'
  }

  // Identity defaults
  if (next.subject.preserve_identity !== false) {
    next.subject.preserve_identity = true
  }
  if (next.subject.pose_preservation !== false) {
    next.subject.pose_preservation = true
  }

  // Scene reconstruct default
  if (next.scene.reconstruct_environment !== false) {
    next.scene.reconstruct_environment = true
  }

  return next
}

// Map flat style string from UI to structured subject type
export function styleToSubjectType(style: string): MiniramaConfig['subject']['type'] {
  const map: Record<string, MiniramaConfig['subject']['type']> = {
    'people':           'single_person',
    'people_diorama':   'family',
    'couple':           'couple',
    'family':           'family',
    'architecture':     'architecture',
    'landscape':        'landscape',
    'dollhouse':        'object',
    'sports':           'single_person',
  }
  return map[style] || 'landscape'
}

// Map flat style string from UI to scene type
export function styleToSceneType(style: string): MiniramaConfig['scene']['type'] {
  const map: Record<string, MiniramaConfig['scene']['type']> = {
    'people':           'custom',
    'people_diorama':   'custom',
    'couple':           'custom',
    'family':           'custom',
    'architecture':     'home_interior',
    'landscape':        'custom',
    'dollhouse':        'home_interior',
    'sports':           'stadium',
  }
  return map[style] || 'custom'
}