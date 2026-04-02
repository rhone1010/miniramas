// lib/structure/types.ts
// Shared types for the Minirama Structure Engine

export interface RoofConfig {
  type: string           // e.g. 'steep_gable', 'mansard', 'hip', 'flat'
  pitch: 'shallow' | 'medium' | 'steep'
  dormers: number
  gables_visible: number
  chimneys: number
  special_notes: string[]
}

export interface PorchConfig {
  exists: boolean
  wraparound: boolean
  sides: string[]        // e.g. ['front', 'right']
  depth: 'shallow' | 'medium' | 'deep'
  roofed: boolean
  columns: {
    present: boolean
    count_visible_front: number
    count_visible_side: number
    style: string        // e.g. 'slender', 'square', 'decorative'
  }
  railings: boolean
  steps: {
    present: boolean
    position: string     // e.g. 'front_left', 'center', 'front_right'
  }
}

export interface WindowGroup {
  zone: string           // e.g. 'front_first_floor_left'
  type: string           // e.g. 'tall_rectangular', 'bay', 'dormer'
  count: number
}

export interface SecondaryVolume {
  position: string       // e.g. 'right', 'rear', 'left'
  type: string           // e.g. 'side_extension', 'garage', 'addition'
  relative_size: 'small' | 'medium' | 'large'
}

export interface ArchitectureBlueprint {
  scene_type: 'architecture'
  source_image_id: string

  identity: {
    building_type: string        // 'house', 'commercial', 'barn', etc.
    style_guess: string          // 'victorian', 'craftsman', 'farmhouse', 'unknown'
    stories: number              // 1, 1.5, 2, 2.5, 3
    primary_mass_shape: string   // 'rectangular', 'L-shaped', 'T-shaped'
    secondary_volumes: SecondaryVolume[]
  }

  roof: RoofConfig

  porch: PorchConfig

  facade: {
    front_door: {
      present: boolean
      position: string   // 'center', 'center_left', 'center_right', 'left', 'right'
    }
    windows: WindowGroup[]
    bay_or_projection: {
      present: boolean
      position: string
      levels: number
    }
  }

  materials: {
    siding: string
    trim: string
    roof_material: string
    foundation_visibility: 'none' | 'low' | 'medium' | 'high'
  }

  site: {
    yard_visible: boolean
    walkway: {
      present: boolean
      path_type: string
    }
    shrubs: boolean
    trees: boolean
    fence: boolean
  }

  camera_reference: {
    source_angle: string
    target_angle: string
  }

  non_negotiables: string[]
}

// ─── SCORECARD ────────────────────────────────────────────────────────────────

export interface Scorecard {
  structural_fidelity: {
    massing: number        // /10
    roof: number           // /10
    porch: number          // /15
    side_volumes: number   // /10
    subtotal: number       // /45
  }
  facade_fidelity: {
    windows: number        // /10
    entry: number          // /5
    porch_details: number  // /5
    subtotal: number       // /20
  }
  diorama_quality: {
    base: number           // /5
    three_d: number        // /5
    materials: number      // /5
    landscaping: number    // /5
    subtotal: number       // /20
  }
  composition: {
    camera_angle: number   // /5
    framing: number        // /5
    subtotal: number       // /10
  }
  finish: {
    quality: number        // /5
    subtotal: number       // /5
  }
  raw_total: number        // /100
  hard_cap_applied: boolean
  hard_cap_reason: string | null
  final_score: number      // /100 (after caps)
}

// ─── PASS RESULT ──────────────────────────────────────────────────────────────

export interface PassResult {
  image_b64: string
  score: number
  scorecard: Scorecard
  hard_capped: boolean
  cap_reason: string | null
  patch: string[]
  iteration: number
  prompt_used: string
}
